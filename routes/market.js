// routes/market.js - 二手交易市场路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError, notFound } = require('../utils/response');
const { fmtPhone } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const aiChecker = require('./ai');

// ─── AI审核记录写入辅助 ────────────────────────────────
function logAiReview(source, sourceId, phone, contentPreview, check, action) {
  try {
    db.prepare(`INSERT INTO ai_review_logs (source, source_id, phone, content_preview, violation, level, category, reason, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(source, sourceId, phone, (contentPreview || '').slice(0, 100),
        check.violation ? 1 : 0, check.level || 'none', check.category || '无', check.reason || '', action || 'pass');
  } catch(e) { console.error('[AI审核] 写入审核记录失败:', e.message); }
}

// ─── 商品图片上传配置 ─────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'market');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

// ─── 商品分类 ─────────────────────────────────────────────
const CATEGORIES = [
  { key: 'textbook', name: '教材', icon: '📚' },
  { key: 'digital', name: '数码', icon: '💻' },
  { key: 'daily', name: '日用', icon: '🏠' },
  { key: 'clothing', name: '服饰', icon: '👔' },
  { key: 'beauty', name: '美妆', icon: '💄' },
  { key: 'other', name: '其他', icon: '📦' }
];

// ─── 诚信度计算 ───────────────────────────────────────────
function getTrustLevel(phone) {
  // 统计该用户作为卖家的已完成交易数和好评数
  const sold = db.prepare(
    "SELECT COUNT(*) as cnt FROM market_orders WHERE seller_phone = ? AND status = 'completed'"
  ).get(phone);
  const bought = db.prepare(
    "SELECT COUNT(*) as cnt FROM market_orders WHERE buyer_phone = ? AND status = 'completed'"
  ).get(phone);
  const goodReviews = db.prepare(
    "SELECT COUNT(*) as cnt FROM market_reviews WHERE seller_phone = ? AND rating >= 4"
  ).get(phone);
  const totalReviews = db.prepare(
    "SELECT COUNT(*) as cnt FROM market_reviews WHERE seller_phone = ?"
  ).get(phone);

  const totalDeals = (sold?.cnt || 0) + (bought?.cnt || 0);
  const goodRate = totalReviews?.cnt > 0 ? (goodReviews?.cnt || 0) / totalReviews.cnt : 1;

  let level = 'new', label = '新人', icon = '⭐';
  if (totalDeals >= 30 && goodRate >= 0.95) { level = 'gold'; label = '金牌'; icon = '🥇'; }
  else if (totalDeals >= 10 && goodRate >= 0.9) { level = 'silver'; label = '银牌'; icon = '🥈'; }
  else if (totalDeals >= 3) { level = 'bronze'; label = '铜牌'; icon = '🥉'; }

  return { level, label, icon, totalDeals, goodRate: Math.round(goodRate * 100) };
}

// ─── 获取分类列表 ─────────────────────────────────────────
router.get('/categories', (req, res) => JSON_RES(res, () => {
  return { categories: CATEGORIES };
}));

// ─── 商品列表 ─────────────────────────────────────────────
router.get('/items', (req, res) => JSON_RES(res, () => {
  const { category, keyword, sort, page, limit, seller } = req.query;
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (p - 1) * l;

  let where = "WHERE mi.status = 'active'";
  const params = [];

  if (category && category !== 'all') {
    where += ' AND mi.category = ?';
    params.push(category);
  }
  if (keyword) {
    where += ' AND (mi.title LIKE ? OR mi.description LIKE ?)';
    params.push('%' + keyword + '%', '%' + keyword + '%');
  }
  if (seller) {
    where += ' AND mi.seller_phone = ?';
    params.push(seller);
  }

  let orderBy = 'mi.created_at DESC';
  if (sort === 'price_asc') orderBy = 'mi.price ASC';
  else if (sort === 'price_desc') orderBy = 'mi.price DESC';
  else if (sort === 'views') orderBy = 'mi.views DESC';

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM market_items mi ' + where).get(...params);
  const items = db.prepare(
    'SELECT mi.id, mi.title, mi.description, mi.price, mi.category, mi.condition_level, mi.images, mi.seller_phone, mi.status, mi.views, mi.created_at, u.name as seller_name, u.avatar as seller_avatar, ' +
    'COALESCE((SELECT ROUND(AVG(rating),1) FROM seller_ratings WHERE seller_phone = mi.seller_phone), 0) as seller_avg_rating ' +
    'FROM market_items mi ' +
    'LEFT JOIN users u ON mi.seller_phone = u.phone ' +
    where + ' ORDER BY ' + orderBy + ' LIMIT ? OFFSET ?'
  ).all(...params, l, offset);

  // 填充诚信度和头像处理，手机号脱敏
  items.forEach(item => {
    item.trust = getTrustLevel(item.seller_phone);
    item.seller_phone = fmtPhone(item.seller_phone); // 脱敏手机号
    try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
  });

  return { items, total: countRow.cnt, page: p, limit: l, categories: CATEGORIES };
}));

// ─── 商品详情 ─────────────────────────────────────────────
router.get('/items/:id', (req, res) => JSON_RES(res, () => {
  const item = db.prepare(
    'SELECT mi.*, u.name as seller_name, u.avatar as seller_avatar, ' +
    'COALESCE((SELECT ROUND(AVG(rating),1) FROM seller_ratings WHERE seller_phone = mi.seller_phone), 0) as seller_avg_rating, ' +
    '(SELECT COUNT(*) FROM seller_ratings WHERE seller_phone = mi.seller_phone) as seller_rating_count ' +
    'FROM market_items mi ' +
    'LEFT JOIN users u ON mi.seller_phone = u.phone WHERE mi.id = ?'
  ).get(req.params.id);
  if (!item) return notFound('商品不存在');

  // 浏览量+1
  db.prepare('UPDATE market_items SET views = views + 1 WHERE id = ?').run(item.id);
  item.views += 1;

  item.trust = getTrustLevel(item.seller_phone);
  try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }

  // 卖家其他商品
  const related = db.prepare(
    "SELECT id, title, price, images FROM market_items WHERE seller_phone = ? AND id != ? AND status = 'active' ORDER BY created_at DESC LIMIT 4"
  ).all(item.seller_phone, item.id);
  related.forEach(r => { try { r.images = JSON.parse(r.images || '[]'); } catch(e) { r.images = []; } });
  item.relatedItems = related;

  return item;
}));

// ─── 上架商品 ─────────────────────────────────────────────
router.post('/items', requireAuth, upload.array('images', 9), async (req, res) => {
  try {
    const phone = req.user.phone;
    if (!phone) return res.status(401).json({ error: '请先登录', code: 'AUTH_001' });

    const { title, description, price, original_price, category, condition_level, contact } = req.body;
    if (!title || !price) return res.status(400).json({ error: '标题和价格不能为空', code: ErrorCode.PARAM_MISSING });

    const images = (req.files || []).map(f => '/uploads/market/' + f.filename);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = db.prepare(
      "INSERT INTO market_items (seller_phone, title, description, price, original_price, category, condition_level, images, contact, status, views, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',0,?,?)"
    ).run(phone, title, description || '', parseFloat(price), original_price ? parseFloat(original_price) : null,
      category || 'other', condition_level || '9成新', JSON.stringify(images), contact || '', now, now);

    const itemId = result.lastInsertRowid;

    // 异步AI审核：不阻塞响应，审核完成后违规则自动下架
    setImmediate(async () => {
      try {
        const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(itemId);
        if (!item) return;
        try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
        const check = await aiChecker.checkMarketItem(item);
        if (check.violation && check.level === 'high') {
          // 严重违规：自动下架 + 通知卖家
          db.prepare("UPDATE market_items SET status = 'offline', updated_at = datetime('now','localtime') WHERE id = ?").run(itemId);
          db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'system', '商品被下架', ?, 0, datetime('now','localtime'))")
            .run(phone, `你的商品「${title}」因AI审核发现违规被自动下架。原因：${check.reason || '内容不符合平台规范'}。如有疑问请联系管理员。`);
          console.log(`[AI审核] 商品#${itemId}「${title}」违规模下架: ${check.reason}`);
          logAiReview('market_item', itemId, phone, title, check, '下架');
        } else if (check.violation) {
          console.log(`[AI审核] 商品#${itemId}「${title}」提醒(未下架): level=${check.level}, reason=${check.reason}`);
          logAiReview('market_item', itemId, phone, title, check, 'pass');
        } else {
          console.log(`[AI审核] 商品#${itemId}「${title}」审核通过`);
          logAiReview('market_item', itemId, phone, title, check, 'pass');
        }
      } catch (e) {
        console.error('[AI审核] 商品异步审核失败:', e.message);
      }
    });

    res.json({ ok: true, id: itemId, images });
  } catch (e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});;

// ─── 编辑商品 ─────────────────────────────────────────────
router.put('/items/:id', requireAuth, upload.array('images', 9), (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
  if (!item) return notFound('商品不存在');
  if (item.seller_phone !== phone) return makeError('只能编辑自己的商品', ErrorCode.FORBIDDEN);

  const { title, description, price, original_price, category, condition_level, contact, status } = req.body;
  const newImages = (req.files || []).map(f => '/uploads/market/' + f.filename);
  let finalImages;
  try { finalImages = JSON.parse(item.images || '[]'); } catch(e) { finalImages = []; }
  if (newImages.length) finalImages = finalImages.concat(newImages);

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare(
    "UPDATE market_items SET title=COALESCE(?,title), description=COALESCE(?,description), price=COALESCE(?,price), original_price=COALESCE(?,original_price), category=COALESCE(?,category), condition_level=COALESCE(?,condition_level), contact=COALESCE(?,contact), status=COALESCE(?,status), images=?, updated_at=? WHERE id=?"
  ).run(
    title || null, description || null,
    price ? parseFloat(price) : null, original_price ? parseFloat(original_price) : null,
    category || null, condition_level || null, contact || null, status || null,
    JSON.stringify(finalImages), now, req.params.id
  );

  return { ok: true };
}));

// ─── 下架商品 ─────────────────────────────────────────────
router.delete('/items/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
  if (!item) return notFound('商品不存在');
  if (item.seller_phone !== phone) return makeError('只能下架自己的商品', ErrorCode.FORBIDDEN);

  db.prepare("UPDATE market_items SET status = 'removed', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  return { ok: true };
}));

// ─── 创建商品交流会话 ─────────────────────────────────────
router.post('/items/:id/chat', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
  if (!item) return notFound('商品不存在');
  if (item.seller_phone === phone) return makeError('不能和自己交流', 'MKT_001');

  // 查找或创建会话
  let conv = db.prepare(
    "SELECT * FROM conversations WHERE (user1_phone = ? AND user2_phone = ?) OR (user1_phone = ? AND user2_phone = ?)"
  ).get(phone, item.seller_phone, item.seller_phone, phone);

  if (!conv) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(
      "INSERT INTO conversations (user1_phone, user2_phone, created_at) VALUES (?,?,?)"
    ).run(phone, item.seller_phone, now);
    conv = { id: r.lastInsertRowid, user1_phone: phone, user2_phone: item.seller_phone };

    // 发送商品卡片消息
    const img = (() => { try { const imgs = JSON.parse(item.images || '[]'); return imgs[0] || ''; } catch(e) { return ''; } })();
    db.prepare(
      "INSERT INTO messages (conversation_id, sender_phone, content, type, created_at) VALUES (?,?,?,?,datetime('now','localtime'))"
    ).run(conv.id, phone, JSON.stringify({ itemId: item.id, title: item.title, price: item.price, image: img }), 'market_item');
  }

  return { ok: true, conversation_id: conv.id };
}));

// ─── 购买下单 ─────────────────────────────────────────────
router.post('/orders', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { item_id } = req.body;
  if (!item_id) return makeError('请选择商品', ErrorCode.PARAM_MISSING);

  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(item_id);
  if (!item) return notFound('商品不存在');
  if (item.status !== 'active') return makeError('商品已下架', 'MKT_002');
  if (item.seller_phone === phone) return makeError('不能购买自己的商品', 'MKT_003');

  // 检查是否已有待处理订单
  const existing = db.prepare(
    "SELECT id FROM market_orders WHERE item_id = ? AND status IN ('pending','confirmed','paid') LIMIT 1"
  ).get(item_id);
  if (existing) return makeError('该商品已有待处理的订单', 'MKT_004');

  const img = (() => { try { const imgs = JSON.parse(item.images || '[]'); return imgs[0] || ''; } catch(e) { return ''; } })();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const result = db.prepare(
    "INSERT INTO market_orders (item_id, buyer_phone, seller_phone, title, price, image, status, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(item_id, phone, item.seller_phone, item.title, item.price, img, 'pending', now);

  // 标记商品为交易中
  db.prepare("UPDATE market_items SET status = 'trading' WHERE id = ?").run(item_id);

  return { ok: true, order_id: result.lastInsertRowid };
}));

// ─── 我的交易订单 ─────────────────────────────────────────
router.get('/orders', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { role } = req.query; // 'buyer' | 'seller' | 不传则全部

  let sql, params;
  if (role === 'buyer') {
    sql = "SELECT mo.*, mi.condition_level, mi.category, mi.contact FROM market_orders mo LEFT JOIN market_items mi ON mo.item_id = mi.id WHERE mo.buyer_phone = ? ORDER BY mo.created_at DESC";
    params = [phone];
  } else if (role === 'seller') {
    sql = "SELECT mo.*, mi.condition_level, mi.category, mi.contact FROM market_orders mo LEFT JOIN market_items mi ON mo.item_id = mi.id WHERE mo.seller_phone = ? ORDER BY mo.created_at DESC";
    params = [phone];
  } else {
    sql = "SELECT mo.*, mi.condition_level, mi.category, mi.contact FROM market_orders mo LEFT JOIN market_items mi ON mo.item_id = mi.id WHERE mo.buyer_phone = ? OR mo.seller_phone = ? ORDER BY mo.created_at DESC";
    params = [phone, phone];
  }

  const orders = db.prepare(sql).all(...params);

  // 填充买卖双方信息
  orders.forEach(o => {
    const buyer = db.prepare('SELECT name, avatar FROM users WHERE phone = ?').get(o.buyer_phone);
    const seller = db.prepare('SELECT name, avatar FROM users WHERE phone = ?').get(o.seller_phone);
    o.buyer_name = buyer?.name || o.buyer_phone;
    o.buyer_avatar = buyer?.avatar || '';
    o.seller_name = seller?.name || o.seller_phone;
    o.seller_avatar = seller?.avatar || '';
    o.is_buyer = o.buyer_phone === phone;
    o.is_seller = o.seller_phone === phone;
  });

  return { orders };
}));

// ─── 确认/完成/取消交易 ───────────────────────────────────
router.put('/orders/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { action } = req.body; // 'confirm' | 'complete' | 'cancel'
  if (!action) return makeError('请指定操作', ErrorCode.PARAM_MISSING);

  const order = db.prepare('SELECT * FROM market_orders WHERE id = ?').get(req.params.id);
  if (!order) return notFound('订单不存在');

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (action === 'confirm') {
    // 卖家确认订单
    if (order.seller_phone !== phone) return makeError('只有卖家能确认', ErrorCode.FORBIDDEN);
    if (order.status !== 'pending') return makeError('当前状态不可确认', 'MKT_005');
    db.prepare("UPDATE market_orders SET status = 'confirmed' WHERE id = ?").run(order.id);
  } else if (action === 'complete') {
    // 买家确认完成
    if (order.buyer_phone !== phone) return makeError('只有买家能确认完成', ErrorCode.FORBIDDEN);
    if (order.status !== 'confirmed' && order.status !== 'paid') return makeError('当前状态不可完成', 'MKT_006');
    db.prepare("UPDATE market_orders SET status = 'completed' WHERE id = ?").run(order.id);
    // 商品标记已售
    db.prepare("UPDATE market_items SET status = 'sold' WHERE id = ?").run(order.item_id);
  } else if (action === 'cancel') {
    if (order.status !== 'pending' && order.status !== 'confirmed') return makeError('当前状态不可取消', 'MKT_007');
    db.prepare("UPDATE market_orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    // 商品恢复上架
    db.prepare("UPDATE market_items SET status = 'active' WHERE id = ?").run(order.item_id);
  } else {
    return makeError('无效操作', ErrorCode.PARAM_INVALID);
  }

  return { ok: true };
}));

// ─── 评价交易 ─────────────────────────────────────────────
router.post('/orders/:id/review', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5) return makeError('请给1-5星评分', ErrorCode.PARAM_INVALID);

  const order = db.prepare('SELECT * FROM market_orders WHERE id = ?').get(req.params.id);
  if (!order) return notFound('订单不存在');
  if (order.buyer_phone !== phone) return makeError('只有买家能评价', ErrorCode.FORBIDDEN);
  if (order.status !== 'completed') return makeError('只能评价已完成的订单', 'MKT_008');

  // 检查是否已评价
  const existing = db.prepare('SELECT id FROM market_reviews WHERE order_id = ?').get(order.id);
  if (existing) return makeError('已评价过', 'MKT_009');

  db.prepare(
    "INSERT INTO market_reviews (order_id, item_id, buyer_phone, seller_phone, rating, review, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))"
  ).run(order.id, order.item_id, phone, order.seller_phone, rating, review || '');

  // 更新订单评价字段
  db.prepare("UPDATE market_orders SET rating = ? WHERE id = ?").run(rating, order.id);

  return { ok: true };
}));

// ─── 商品留言评论 ─────────────────────────────────────────
// 获取评论列表
router.get('/items/:id/comments', (req, res) => JSON_RES(res, () => {
  const itemId = req.params.id;
  const item = db.prepare('SELECT id FROM market_items WHERE id = ?').get(itemId);
  if (!item) return notFound('商品不存在');

  // 获取顶层评论
  const comments = db.prepare(
    'SELECT mc.*, u.name as user_name, u.avatar as user_avatar ' +
    'FROM market_comments mc LEFT JOIN users u ON mc.user_phone = u.phone ' +
    'WHERE mc.item_id = ? AND mc.parent_id IS NULL ORDER BY mc.created_at DESC'
  ).all(itemId);

  // 获取每条评论的回复
  comments.forEach(c => {
    const replies = db.prepare(
      'SELECT mc.*, u.name as user_name, u.avatar as user_avatar ' +
      'FROM market_comments mc LEFT JOIN users u ON mc.user_phone = u.phone ' +
      'WHERE mc.parent_id = ? ORDER BY mc.created_at ASC'
    ).all(c.id);
    c.replies = replies;
    c.reply_count = replies.length;
  });

  const total = db.prepare('SELECT COUNT(*) as cnt FROM market_comments WHERE item_id = ?').get(itemId).cnt;
  return { comments, total };
}));

// 发表评论（支持图片/视频）
const commentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, 'comment-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('仅支持图片/视频'));
  }
});

router.post('/items/:id/comments', requireAuth, commentUpload.single('media'), async (req, res) => {
  try {
    const phone = req.user.phone;
    if (!phone) return res.status(401).json({ error: '请先登录', code: 'AUTH_001' });
    const content = (req.body.content || '').trim();
    const parent_id = req.body.parent_id || null;
    if (!content && !req.file) return res.status(400).json({ error: '请输入内容或上传媒体', code: ErrorCode.PARAM_MISSING });
    if (content.length > 500) return res.status(400).json({ error: '评论最多500字', code: ErrorCode.PARAM_INVALID });

    const itemId = req.params.id;
    const item = db.prepare('SELECT id, seller_phone FROM market_items WHERE id = ?').get(itemId);
    if (!item) return res.status(404).json({ error: '商品不存在', code: 'SYS_004' });

    if (parent_id) {
      const parent = db.prepare('SELECT id, item_id FROM market_comments WHERE id = ?').get(parent_id);
      if (!parent) return res.status(404).json({ error: '原评论不存在', code: 'SYS_004' });
      if (parent.item_id !== parseInt(itemId)) return res.status(400).json({ error: '回复的评论不属于该商品', code: 'MKT_010' });
    }

    // AI审核评论内容
    if (content) {
      try {
        const check = await aiChecker.checkTextContent(content, '校园二手交易平台');
        if (check.violation && check.level === 'high') {
          logAiReview('market_comment', 0, phone, content, check, 'block');
          return res.status(403).json({ error: '评论内容不符合平台规范：' + (check.reason || '请修改后重新发布'), code: 'AI_001' });
        }
        if (check.violation) console.log(`[AI审核] 市场评论提醒(未拦截): level=${check.level}, reason=${check.reason}`);
        req._aiResult = check;
      } catch (e) {
        console.error('[AI审核] 市场评论审核失败:', e.message);
      }
    }

    const media_url = req.file ? '/uploads/market/' + req.file.filename : null;
    const media_type = req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : null;

    const result = db.prepare(
      "INSERT INTO market_comments (item_id, user_phone, content, parent_id, media_url, media_type, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))"
    ).run(itemId, phone, content || '', parent_id, media_url, media_type);
    logAiReview('market_comment', result.lastInsertRowid, phone, content, req._aiResult || {violation:false,level:'none',category:'无',reason:''}, 'pass');

  // 给卖家发通知（非自己评论自己商品时）
  if (item.seller_phone !== phone && !parent_id) {
    try {
      const user = db.prepare('SELECT name FROM users WHERE phone = ?').get(phone);
      db.prepare(
        "INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?,?,?,?,0,datetime('now','localtime'))"
      ).run(item.seller_phone, 'market_comment', '商品新留言',
        (user?.name || '有人') + '对你的商品留言了' + (content ? '：' + content.substring(0, 50) : '（附带媒体）'));
    } catch(e) { /* 通知失败不影响评论 */ }
  }

  res.json({ ok: true, comment_id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// 删除评论
router.delete('/comments/:commentId', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const comment = db.prepare('SELECT * FROM market_comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return notFound('评论不存在');
  if (comment.user_phone !== phone) return makeError('只能删除自己的评论', ErrorCode.FORBIDDEN);

  // 删除子回复
  db.prepare('DELETE FROM market_comments WHERE parent_id = ?').run(comment.id);
  // 删除评论
  db.prepare('DELETE FROM market_comments WHERE id = ?').run(comment.id);
  return { ok: true };
}));

// ─── 获取用户诚信度 ───────────────────────────────────────
router.get('/trust/:phone', (req, res) => JSON_RES(res, () => {
  const trust = getTrustLevel(req.params.phone);
  // 补充用户信息
  const user = db.prepare('SELECT name, avatar FROM users WHERE phone = ?').get(req.params.phone);
  return { ...trust, name: user?.name || '', avatar: user?.avatar || '' };
}));

// ─── 我的在售商品 ─────────────────────────────────────────
router.get('/my-items', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const items = db.prepare(
    "SELECT * FROM market_items WHERE seller_phone = ? AND status != 'removed' ORDER BY created_at DESC"
  ).all(phone);
  items.forEach(item => {
    try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
  });
  return { items };
}));

// ─── 管理端 API ──────────────────────────────────────────────

// 管理员获取所有商品
router.get('/admin/items', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = "m.status != 'removed'";
  const params = [];
  if (status && status !== 'all') { where += ' AND m.status = ?'; params.push(status); }
  if (search) { where += ' AND (m.title LIKE ? OR m.seller_phone LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const totalWhere = where.replace(/m\./g, '');
  const total = db.prepare('SELECT COUNT(*) as cnt FROM market_items WHERE ' + totalWhere).get(...params).cnt;
  const items = db.prepare('SELECT m.*, u.name as seller_name, u.avatar as seller_avatar FROM market_items m LEFT JOIN users u ON m.seller_phone = u.phone WHERE ' + where + ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?').all(...params, +limit, +offset);
  items.forEach(item => {
    try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
  });
  return { items, total, page: +page, limit: +limit };
}));

// 管理员强制下架商品
router.put('/admin/items/:id/offline', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { reason } = req.body;
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
  if (!item) return notFound('商品');
  db.prepare("UPDATE market_items SET status = 'offline', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  // 通知卖家
  if (item.seller_phone) {
    db.prepare('INSERT INTO notifications (phone, type, title, content) VALUES (?, ?, ?, ?)').run(
      item.seller_phone, 'system', '商品被下架', '您的商品「' + item.title + '」已被管理员下架' + (reason ? '，原因：' + reason : ''));
  }
  return { ok: true };
}));

// 管理员删除商品
router.delete('/admin/items/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
  if (!item) return notFound('商品');
  db.prepare("UPDATE market_items SET status = 'removed', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  if (item.seller_phone) {
    db.prepare('INSERT INTO notifications (phone, type, title, content) VALUES (?, ?, ?, ?)').run(
      item.seller_phone, 'system', '商品被删除', '您的商品「' + item.title + '」已被管理员删除');
  }
  return { ok: true };
}));

// 管理员获取所有交易订单
router.get('/admin/orders', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
  if (status && status !== 'all') { where += ' AND o.status = ?'; params.push(status); }
  if (search) { where += ' AND (o.title LIKE ? OR o.buyer_phone LIKE ? OR o.seller_phone LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  const totalWhere = where.replace(/o\./g, '');
  const total = db.prepare('SELECT COUNT(*) as cnt FROM market_orders WHERE ' + totalWhere).get(...params).cnt;
  const orders = db.prepare(
    'SELECT o.*, b.name as buyer_name, s.name as seller_name FROM market_orders o ' +
    'LEFT JOIN users b ON o.buyer_phone = b.phone LEFT JOIN users s ON o.seller_phone = s.phone ' +
    'WHERE ' + where + ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
  ).all(...params, +limit, +offset);
  return { orders, total, page: +page, limit: +limit };
}));

// 管理员仲裁处理订单
router.put('/admin/orders/:id/resolve', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { action, reason } = req.body; // action: 'complete' | 'cancel'
  const order = db.prepare('SELECT * FROM market_orders WHERE id = ?').get(req.params.id);
  if (!order) return notFound('订单');
  if (action === 'complete') {
    db.prepare("UPDATE market_orders SET status = 'completed', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
    db.prepare("UPDATE market_items SET status = 'sold', updated_at = datetime('now','localtime') WHERE id = ?").run(order.item_id);
  } else if (action === 'cancel') {
    db.prepare("UPDATE market_orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
    db.prepare("UPDATE market_items SET status = 'active', updated_at = datetime('now','localtime') WHERE id = ?").run(order.item_id);
  } else {
    return makeError('无效操作', 'PARAM_001');
  }
  // 通知双方
  const msg = action === 'complete' ? '订单已由管理员确认完成' : '订单已由管理员取消';
  [order.buyer_phone, order.seller_phone].forEach(phone => {
    if (phone) db.prepare('INSERT INTO notifications (phone, type, title, content) VALUES (?, ?, ?, ?)').run(phone, 'system', '订单状态变更', msg + (reason ? '，原因：' + reason : '') + '，商品：' + order.title);
  });
  return { ok: true };
}));

// 管理员获取所有留言
router.get('/admin/comments', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
  if (search) { where += ' AND (c.content LIKE ? OR c.user_phone LIKE ? OR m.title LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  const total = db.prepare('SELECT COUNT(*) as cnt FROM market_comments c LEFT JOIN market_items m ON c.item_id = m.id WHERE ' + where).get(...params).cnt;
  const comments = db.prepare(
    'SELECT c.*, u.name as user_name, u.avatar as user_avatar, m.title as item_title ' +
    'FROM market_comments c ' +
    'LEFT JOIN users u ON c.user_phone = u.phone ' +
    'LEFT JOIN market_items m ON c.item_id = m.id ' +
    'WHERE ' + where + ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?'
  ).all(...params, +limit, +offset);
  return { comments, total, page: +page, limit: +limit };
}));

// 管理员删除留言
router.delete('/admin/comments/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const comment = db.prepare('SELECT * FROM market_comments WHERE id = ?').get(req.params.id);
  if (!comment) return notFound('留言');
  db.prepare('DELETE FROM market_comments WHERE id = ?').run(req.params.id);
  // 同时删除该评论的所有回复
  db.prepare('DELETE FROM market_comments WHERE parent_id = ?').run(req.params.id);
  return { ok: true };
}));

// 管理员统计数据
router.get('/admin/stats', requireAdmin, (req, res) => JSON_RES(res, () => {
  const totalItems = db.prepare("SELECT COUNT(*) as cnt FROM market_items WHERE status != 'removed'").get().cnt;
  const activeItems = db.prepare("SELECT COUNT(*) as cnt FROM market_items WHERE status = 'active'").get().cnt;
  const todayItems = db.prepare("SELECT COUNT(*) as cnt FROM market_items WHERE date(created_at) = date('now','localtime')").get().cnt;
  const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM market_orders').get().cnt;
  const completedOrders = db.prepare("SELECT COUNT(*) as cnt FROM market_orders WHERE status = 'completed'").get().cnt;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(price), 0) as total FROM market_orders WHERE status = 'completed'").get().total;
  const totalComments = db.prepare('SELECT COUNT(*) as cnt FROM market_comments').get().cnt;
  const todayComments = db.prepare("SELECT COUNT(*) as cnt FROM market_comments WHERE date(created_at) = date('now','localtime')").get().cnt;
  // 近7天趋势
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const items = db.prepare("SELECT COUNT(*) as cnt FROM market_items WHERE date(created_at) = ?").get(ds).cnt;
    const orders = db.prepare("SELECT COUNT(*) as cnt FROM market_orders WHERE date(created_at) = ?").get(ds).cnt;
    trend.push({ date: ds.slice(5), items, orders });
  }
  // 分类分布
  const categories = db.prepare("SELECT category, COUNT(*) as cnt FROM market_items WHERE status != 'removed' GROUP BY category ORDER BY cnt DESC").all();
  // 诚信度分布
  const trustDist = { newcomer: 0, bronze: 0, silver: 0, gold: 0 };
  const sellers = db.prepare("SELECT DISTINCT seller_phone FROM market_items WHERE status != 'removed'").all();
  sellers.forEach(s => {
    const t = getTrustLevel(s.seller_phone);
    if (t.level === 'gold') trustDist.gold++;
    else if (t.level === 'silver') trustDist.silver++;
    else if (t.level === 'bronze') trustDist.bronze++;
    else trustDist.newcomer++;
  });
  return { totalItems, activeItems, todayItems, totalOrders, completedOrders, totalRevenue, totalComments, todayComments, trend, categories, trustDist };
}));

// ─── 卖家评分与统计 ──────────────────────────────────────

// 获取卖家统计信息
router.get('/sellers/:phone/stats', (req, res) => JSON_RES(res, () => {
  const { phone } = req.params;
  // 评分统计
  const ratingStats = db.prepare(
    'SELECT COUNT(*) as count, ROUND(AVG(rating), 1) as avg_rating FROM seller_ratings WHERE seller_phone = ?'
  ).get(phone);
  // 在售商品数
  const itemCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM market_items WHERE seller_phone = ? AND status = 'active'"
  ).get(phone).cnt;
  // 校园墙帖子数
  const wallCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM wall_posts WHERE phone = ?'
  ).get(phone).cnt;
  // 卖家名称和头像
  const user = db.prepare(
    'SELECT name, avatar FROM users WHERE phone = ?'
  ).get(phone) || {};
  return {
    avg_rating: ratingStats.avg_rating || 0,
    rating_count: ratingStats.count || 0,
    item_count: itemCount,
    wall_count: wallCount,
    seller_name: user.name || '',
    seller_avatar: user.avatar || ''
  };
}));

// 获取卖家评分列表
router.get('/sellers/:phone/ratings', (req, res) => JSON_RES(res, () => {
  const { phone } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const count = db.prepare('SELECT COUNT(*) as cnt FROM seller_ratings WHERE seller_phone = ?').get(phone).cnt;
  const ratings = db.prepare(
    'SELECT r.id, r.rating, r.comment, r.created_at, mi.title as item_title, mi.id as item_id ' +
    'FROM seller_ratings r LEFT JOIN market_orders mo ON r.order_id = mo.id ' +
    'LEFT JOIN market_items mi ON mo.item_id = mi.id ' +
    'WHERE r.seller_phone = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
  ).all(phone, limit, offset);
  return { ratings, total: count, page, pageSize: limit };
}));

// 给卖家打分
router.post('/sellers/:phone/rate', requireAuth, (req, res) => JSON_RES(res, () => {
  const sellerPhone = req.params.phone;
  const buyerPhone = req.user.phone;
  const { order_id, rating, comment } = req.body;

  if (sellerPhone === buyerPhone) return makeError(ErrorCode.BAD_REQUEST, '不能给自己打分');
  if (!order_id || !rating || rating < 1 || rating > 5) return makeError(ErrorCode.BAD_REQUEST, '参数不合法');

  // 验证订单确实存在且已完成，且买家就是当前用户
  const order = db.prepare(
    'SELECT id, status FROM market_orders WHERE id = ? AND buyer_phone = ? AND seller_phone = ?'
  ).get(order_id, buyerPhone, sellerPhone);

  if (!order) return makeError(ErrorCode.NOT_FOUND, '订单不存在');
  if (order.status !== 'completed') return makeError(ErrorCode.BAD_REQUEST, '只有交易完成后才能评价');

  // 检查是否已评价
  const existing = db.prepare('SELECT id FROM seller_ratings WHERE order_id = ?').get(order_id);
  if (existing) return makeError(ErrorCode.BAD_REQUEST, '您已对该订单进行过评价');

  db.prepare(
    'INSERT INTO seller_ratings (seller_phone, buyer_phone, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)'
  ).run(sellerPhone, buyerPhone, order_id, rating, comment || '');

  return { ok: true };
}));

module.exports = router;
