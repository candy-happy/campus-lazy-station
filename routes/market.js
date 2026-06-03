// routes/market.js - 二手交易市场路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError, notFound } = require('../utils/response');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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
  const { category, keyword, sort, page, limit } = req.query;
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

  let orderBy = 'mi.created_at DESC';
  if (sort === 'price_asc') orderBy = 'mi.price ASC';
  else if (sort === 'price_desc') orderBy = 'mi.price DESC';
  else if (sort === 'views') orderBy = 'mi.views DESC';

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM market_items mi ' + where).get(...params);
  const items = db.prepare(
    'SELECT mi.*, u.name as seller_name, u.avatar as seller_avatar FROM market_items mi ' +
    'LEFT JOIN users u ON mi.seller_phone = u.phone ' +
    where + ' ORDER BY ' + orderBy + ' LIMIT ? OFFSET ?'
  ).all(...params, l, offset);

  // 填充诚信度和头像处理
  items.forEach(item => {
    item.trust = getTrustLevel(item.seller_phone);
    try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
  });

  return { items, total: countRow.cnt, page: p, limit: l, categories: CATEGORIES };
}));

// ─── 商品详情 ─────────────────────────────────────────────
router.get('/items/:id', (req, res) => JSON_RES(res, () => {
  const item = db.prepare(
    'SELECT mi.*, u.name as seller_name, u.avatar as seller_avatar FROM market_items mi ' +
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
router.post('/items', requireAuth, upload.array('images', 9), (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  if (!phone) return makeError('请先登录', 'AUTH_001');

  const { title, description, price, original_price, category, condition_level, contact } = req.body;
  if (!title || !price) return makeError('标题和价格不能为空', ErrorCode.PARAM_MISSING);

  const images = (req.files || []).map(f => '/uploads/market/' + f.filename);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const result = db.prepare(
    "INSERT INTO market_items (seller_phone, title, description, price, original_price, category, condition_level, images, contact, status, views, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',0,?,?)"
  ).run(phone, title, description || '', parseFloat(price), original_price ? parseFloat(original_price) : null,
    category || 'other', condition_level || '9成新', JSON.stringify(images), contact || '', now, now);

  return { ok: true, id: result.lastInsertRowid, images };
}));

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
    sql = "SELECT mo.*, mi.condition_level, mi.category FROM market_orders mo LEFT JOIN market_items mi ON mo.item_id = mi.id WHERE mo.buyer_phone = ? ORDER BY mo.created_at DESC";
    params = [phone];
  } else if (role === 'seller') {
    sql = "SELECT mo.*, mi.condition_level, mi.category FROM market_orders mo LEFT JOIN market_items mi ON mo.item_id = mi.id WHERE mo.seller_phone = ? ORDER BY mo.created_at DESC";
    params = [phone];
  } else {
    sql = "SELECT mo.*, mi.condition_level, mi.category FROM market_orders mo LEFT JOIN market_items mi ON mo.item_id = mi.id WHERE mo.buyer_phone = ? OR mo.seller_phone = ? ORDER BY mo.created_at DESC";
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

module.exports = router;
