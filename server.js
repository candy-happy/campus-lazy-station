// 校园懒人效率站 - API服务器
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 本地默认路径，Railway部署时设置 DB_PATH=/data/lazy_station.db
const dbPath = process.env.DB_PATH || path.join(__dirname, 'lazy_station.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── 工具函数 ───
const JSON_RES = (res, fn) => { try { res.json(fn()); } catch(e) { res.status(500).json({ error: e.message }); } };
const genOrderNo = () => 'ORD' + Date.now().toString(36).toUpperCase().slice(-8);
const fmtPhone = (p) => p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '';

// ═══════════════════════════════════════════════
// 🔐 认证
// ═══════════════════════════════════════════════
app.post('/api/user/login', (req, res) => JSON_RES(res, () => {
  const { name, phone } = req.body;
  if (!phone || phone.length !== 11) return { error: '请输入正确手机号' };
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    db.prepare('INSERT INTO users (name, phone) VALUES (?, ?)').run(name || '同学', phone);
    user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    db.prepare('INSERT INTO points (phone, total) VALUES (?, 10)').run(phone);
    db.prepare(`INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 10, '注册奖励')`).run(phone);
  }
  return { ok: true, user: { ...user, phone: fmtPhone(user.phone) } };
}));

app.post('/api/rider/login', (req, res) => JSON_RES(res, () => {
  const { name, student_id, phone } = req.body;
  if (!phone || phone.length !== 11) return { error: '请输入正确手机号' };
  let rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(phone);
  if (!rider) {
    db.prepare('INSERT INTO riders (name, student_id, phone, status) VALUES (?, ?, ?, ?)')
      .run(name, student_id, phone, 'online');
    rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(phone);
  }
  return { ok: true, rider: { ...rider, phone: fmtPhone(rider.phone) } };
}));

app.post('/api/admin/login', (req, res) => JSON_RES(res, () => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?').get(username, password);
  if (!admin) return { error: '账号或密码错误' };
  if (admin.status !== 'active') return { error: '账号已被禁用' };
  return { ok: true, admin: { ...admin, password: undefined } };
}));

// ═══════════════════════════════════════════════
// 🏪 服务
// ═══════════════════════════════════════════════
app.get('/api/services', (req, res) => JSON_RES(res, () => db.prepare('SELECT * FROM services').all()));

// ═══════════════════════════════════════════════
// 📦 订单
// ═══════════════════════════════════════════════
app.post('/api/orders', (req, res) => JSON_RES(res, () => {
  const { type, pickup_location, delivery_location, details, phone, tip } = req.body;
  if (!phone || !pickup_location || !delivery_location) return { error: '缺少必填信息' };
  const svc = db.prepare('SELECT * FROM services WHERE key = ?').get(type);
  const price = (svc ? svc.base_price : 2) + (tip || 0);
  const orderNo = genOrderNo();
  db.prepare(`INSERT INTO orders (order_no, type, pickup_location, delivery_location, details, phone, price, tip, status, progress)
    VALUES (?,?,?,?,?,?,?,?,'pending',10)`).run(orderNo, type, pickup_location, delivery_location, details || '', phone, price, tip || 0);
  
  // 奖励积分
  const pts = db.prepare('SELECT * FROM points WHERE phone = ?').get(phone);
  if (pts) {
    db.prepare('UPDATE points SET total = total + ? WHERE phone = ?').run(Math.floor(price), phone);
  } else {
    db.prepare('INSERT INTO points (phone, total) VALUES (?, ?)').run(phone, Math.floor(price));
  }
  db.prepare(`INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', ?, '下单奖励')`).run(phone, Math.floor(price));
  
  // 通知骑手
  const riders = db.prepare("SELECT phone FROM riders WHERE status = 'online'").all();
  const insNotif = db.prepare(`INSERT INTO notifications (phone, type, title, content) VALUES (?, 'order', '新订单通知', ?)`);
  riders.forEach(r => insNotif.run(r.phone, `新订单${orderNo}: ${pickup_location}→${delivery_location}`));
  
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  return { ok: true, order: { ...order, phone: fmtPhone(order.phone) } };
}));

app.get('/api/orders', (req, res) => JSON_RES(res, () => {
  const { phone, rider_phone, status } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1'; const params = [];
  if (phone) { sql += ' AND phone = ?'; params.push(phone); }
  if (rider_phone) { sql += ' AND rider_phone = ?'; params.push(rider_phone); }
  if (status) {
    if (status === 'active') { sql += " AND status IN ('accepted','running')"; }
    else if (status === 'my') { sql += " AND status NOT IN ('pending','cancelled')"; }
    else { sql += ' AND status = ?'; params.push(status); }
  }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params).map(o => ({ ...o, phone: fmtPhone(o.phone), rider_phone: fmtPhone(o.rider_phone) }));
}));

app.get('/api/orders/:id', (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return { error: '订单不存在' };
  return { ...order, phone: fmtPhone(order.phone) };
}));

// 骑手接单
app.post('/api/orders/:id/accept', (req, res) => JSON_RES(res, () => {
  const { rider_phone, rider_name } = req.body;
  db.prepare(`UPDATE orders SET status='accepted', rider_phone=?, rider_name=?, progress=30, accepted_at=datetime('now','localtime') WHERE (id=? OR order_no=?) AND status='pending'`)
    .run(rider_phone, rider_name, req.params.id, req.params.id);
  db.prepare(`INSERT INTO notifications (phone, type, title, content) VALUES (?, 'order', '订单已接单', ?)`)
    .run(rider_phone, `骑手${rider_name}已接单`);
  return { ok: true };
}));

// 开始配送
app.post('/api/orders/:id/start', (req, res) => JSON_RES(res, () => {
  db.prepare(`UPDATE orders SET status='running', progress=60 WHERE (id=? OR order_no=?) AND status='accepted'`)
    .run(req.params.id, req.params.id);
  return { ok: true };
}));

// 完成订单
app.post('/api/orders/:id/complete', (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return { error: '订单不存在' };
  db.prepare(`UPDATE orders SET status='completed', progress=100, completed_at=datetime('now','localtime') WHERE id = ?`).run(order.id);
  if (order.rider_phone) {
    db.prepare('UPDATE riders SET total_orders = total_orders + 1, total_earnings = total_earnings + ? WHERE phone = ?')
      .run(order.price, order.rider_phone);
    const rider = db.prepare('SELECT total_orders FROM riders WHERE phone = ?').get(order.rider_phone);
    updateRiderLevel(order.rider_phone, rider.total_orders);
  }
  return { ok: true };
}));

// 取消订单
app.post('/api/orders/:id/cancel', (req, res) => JSON_RES(res, () => {
  db.prepare(`UPDATE orders SET status='cancelled', cancelled_at=datetime('now','localtime'), cancel_reason=? WHERE (id=? OR order_no=?) AND status IN ('pending','accepted')`)
    .run(req.body.reason || '用户取消', req.params.id, req.params.id);
  return { ok: true };
}));

// 评价
app.post('/api/orders/:id/rate', (req, res) => JSON_RES(res, () => {
  const { stars, comment, phone } = req.body;
  db.prepare(`UPDATE orders SET rating_stars=?, rating_comment=?, rating_at=datetime('now','localtime') WHERE (id=? OR order_no=?) AND status='completed'`)
    .run(stars, comment || '', req.params.id, req.params.id);
  db.prepare('UPDATE points SET total = total + 2 WHERE phone = ?').run(phone);
  db.prepare(`INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 2, '评价奖励')`).run(phone);
  return { ok: true };
}));

// ═══════════════════════════════════════════════
// 🚴 骑手
// ═══════════════════════════════════════════════
app.get('/api/riders', (req, res) => JSON_RES(res, () => 
  db.prepare('SELECT * FROM riders ORDER BY total_orders DESC').all().map(r => ({ ...r, phone: fmtPhone(r.phone) }))
));

app.get('/api/riders/:phone', (req, res) => JSON_RES(res, () => {
  const rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(req.params.phone);
  if (!rider) return { error: '骑手不存在' };
  return { ...rider, phone: fmtPhone(rider.phone) };
}));

app.patch('/api/riders/:phone', (req, res) => JSON_RES(res, () => {
  const { status } = req.body;
  if (status) db.prepare('UPDATE riders SET status = ? WHERE phone = ?').run(status, req.params.phone);
  return { ok: true };
}));

function updateRiderLevel(phone, totalOrders) {
  let level = 'bronze';
  if (totalOrders >= 100) level = 'diamond';
  else if (totalOrders >= 50) level = 'gold';
  else if (totalOrders >= 20) level = 'silver';
  db.prepare('UPDATE riders SET level = ? WHERE phone = ?').run(level, phone);
}

// ═══════════════════════════════════════════════
// 👤 用户
// ═══════════════════════════════════════════════
app.get('/api/users', (req, res) => JSON_RES(res, () => 
  db.prepare('SELECT * FROM users ORDER BY total_orders DESC').all().map(u => ({ ...u, phone: fmtPhone(u.phone) }))
));

app.get('/api/users/:phone', (req, res) => JSON_RES(res, () => {
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  return { ...user, phone: fmtPhone(user.phone) };
}));

// ═══════════════════════════════════════════════
// 🎫 优惠券
// ═══════════════════════════════════════════════
app.get('/api/coupons', (req, res) => JSON_RES(res, () => 
  db.prepare("SELECT * FROM coupons WHERE usable=1 AND expire_at > datetime('now','localtime')").all()
));

// ═══════════════════════════════════════════════
// ⭐ 积分
// ═══════════════════════════════════════════════
app.get('/api/points/:phone', (req, res) => JSON_RES(res, () => {
  const pts = db.prepare('SELECT * FROM points WHERE phone = ?').get(req.params.phone);
  const logs = db.prepare('SELECT * FROM point_logs WHERE phone = ? ORDER BY created_at DESC LIMIT 20').all(req.params.phone);
  return { total: pts?.total || 0, history: logs };
}));

// ═══════════════════════════════════════════════
// 🔔 通知
// ═══════════════════════════════════════════════
app.get('/api/notifications/:phone', (req, res) => JSON_RES(res, () => 
  db.prepare('SELECT * FROM notifications WHERE phone = ? ORDER BY created_at DESC LIMIT 30').all(req.params.phone)
));

app.patch('/api/notifications/:phone/read', (req, res) => JSON_RES(res, () => {
  const { ids } = req.body;
  if (ids && ids.length) {
    db.prepare(`UPDATE notifications SET read=1 WHERE phone=? AND id IN (${ids.map(()=>'?').join(',')})`).run(req.params.phone, ...ids);
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE phone = ?').run(req.params.phone);
  }
  return { ok: true };
}));

// ═══════════════════════════════════════════════
// 📊 统计
// ═══════════════════════════════════════════════
app.get('/api/stats', (req, res) => JSON_RES(res, () => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total_orders: db.prepare("SELECT COUNT(*) as n FROM orders").get().n,
    today_orders: db.prepare("SELECT COUNT(*) as n FROM orders WHERE date(created_at) = ?").get(today).n,
    total_revenue: db.prepare("SELECT COALESCE(SUM(price),0) as n FROM orders WHERE status='completed'").get().n,
    today_revenue: db.prepare("SELECT COALESCE(SUM(price),0) as n FROM orders WHERE status='completed' AND date(completed_at) = ?").get(today).n,
    total_riders: db.prepare("SELECT COUNT(*) as n FROM riders").get().n,
    total_users: db.prepare("SELECT COUNT(*) as n FROM users").get().n,
    active_orders: db.prepare("SELECT COUNT(*) as n FROM orders WHERE status IN ('pending','accepted','running')").get().n,
    orders_by_status: db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all()
  };
}));

// ═══════════════════════════════════════════════
// 🔒 管理员
// ═══════════════════════════════════════════════
app.get('/api/admins', (req, res) => JSON_RES(res, () => 
  db.prepare('SELECT id, username, role, status FROM admins').all()
));
app.post('/api/admins', (req, res) => JSON_RES(res, () => {
  const { username, password, role } = req.body;
  if (!username || !password) return { error: '缺少账号密码' };
  const exist = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (exist) return { error: '账号已存在' };
  db.prepare('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)').run(username, password, role || 'admin');
  return { ok: true };
}));
app.delete('/api/admins/:id', (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM admins WHERE id = ? AND role != ?').run(req.params.id, 'super');
  return { ok: true };
}));
app.patch('/api/admins/:id', (req, res) => JSON_RES(res, () => {
  db.prepare('UPDATE admins SET status = ? WHERE id = ? AND role != ?').run(req.body.status, req.params.id, 'super');
  return { ok: true };
}));

// ═══════════════════════════════════════════════
// 🧱 校园墙
// ═══════════════════════════════════════════════

// 发帖
app.post('/api/wall/posts', (req, res) => JSON_RES(res, () => {
  const { phone, nickname, avatar, content, images, gif_urls } = req.body;
  if (!phone || !content) return { error: '缺少手机号或内容' };
  const r = db.prepare(`INSERT INTO wall_posts (phone, nickname, avatar, content, images, gif_urls, like_count, comment_count, exposure_count, exposure_done, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, datetime('now','localtime'), datetime('now','localtime'))`)
    .run(phone, nickname || '匿名', avatar || '', content, images || '', gif_urls || '');
  return { ok: true, id: r.lastInsertRowid };
}));

// 信息流
app.get('/api/wall/feed', (req, res) => JSON_RES(res, () => {
  const { tab, phone, page, limit } = req.query;
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(50, parseInt(limit) || 20);
  const offset = (p - 1) * l;
  let posts;
  if (tab === 'following' && phone) {
    posts = db.prepare(`SELECT p.* FROM wall_posts p
      JOIN wall_follows f ON f.following_phone = p.phone AND f.follower_phone = ?
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(phone, l, offset);
  } else if (tab === 'hot') {
    posts = db.prepare(`SELECT * FROM wall_posts WHERE exposure_done = 1 ORDER BY like_count DESC, created_at DESC LIMIT ? OFFSET ?`).all(l, offset);
  } else {
    // 最新 + 曝光算法：exposure_done=0的帖子优先
    posts = db.prepare(`SELECT * FROM wall_posts ORDER BY exposure_done ASC, created_at DESC LIMIT ? OFFSET ?`).all(l, offset);
  }
  // 更新曝光
  if (phone) {
    const insExp = db.prepare("INSERT OR IGNORE INTO wall_exposures (post_id, phone, created_at) VALUES (?, ?, datetime('now','localtime'))");
    const updExp = db.prepare('UPDATE wall_posts SET exposure_count = exposure_count + 1, exposure_done = CASE WHEN exposure_count >= 2 THEN 1 ELSE 0 END WHERE id = ?');
    posts.forEach(post => {
      try { insExp.run(post.id, phone); updExp.run(post.id); } catch(e) {}
    });
  }
  return posts.map(p => ({ ...p, images: p.images ? p.images.split(',').filter(Boolean) : [], gif_urls: safeJSON(p.gif_urls) }));
}));

// 帖子详情
app.get('/api/wall/posts/:id', (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id = ?').get(req.params.id);
  if (!post) return { error: '帖子不存在' };
  const comments = db.prepare('SELECT * FROM wall_comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  return { ...post, images: post.images ? post.images.split(',').filter(Boolean) : [], gif_urls: safeJSON(post.gif_urls), comments };
}));

// 点赞
app.post('/api/wall/posts/:id/like', (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  if (!phone) return { error: '缺少手机号' };
  const existing = db.prepare('SELECT id FROM wall_likes WHERE post_id = ? AND phone = ?').get(req.params.id, phone);
  if (existing) {
    db.prepare('DELETE FROM wall_likes WHERE id = ?').run(existing.id);
    db.prepare('UPDATE wall_posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(req.params.id);
    return { ok: true, liked: false };
  } else {
    db.prepare("INSERT INTO wall_likes (post_id, phone, created_at) VALUES (?, ?, datetime('now','localtime'))").run(req.params.id, phone);
    db.prepare('UPDATE wall_posts SET like_count = like_count + 1 WHERE id = ?').run(req.params.id);
    return { ok: true, liked: true };
  }
}));

// 评论
app.post('/api/wall/posts/:id/comments', (req, res) => JSON_RES(res, () => {
  const { phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname } = req.body;
  if (!phone || !content) return { error: '缺少手机号或内容' };
  db.prepare(`INSERT INTO wall_comments (post_id, phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname, like_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now','localtime'))`)
    .run(req.params.id, phone, nickname || '匿名', avatar || '', content, parent_id || null, reply_to_phone || '', reply_to_nickname || '');
  db.prepare('UPDATE wall_posts SET comment_count = comment_count + 1 WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

// 关注
app.post('/api/wall/follow', (req, res) => JSON_RES(res, () => {
  const { follower_phone, following_phone } = req.body;
  if (!follower_phone || !following_phone) return { error: '缺少手机号' };
  if (follower_phone === following_phone) return { error: '不能关注自己' };
  const existing = db.prepare('SELECT id FROM wall_follows WHERE follower_phone = ? AND following_phone = ?').get(follower_phone, following_phone);
  if (existing) {
    db.prepare('DELETE FROM wall_follows WHERE id = ?').run(existing.id);
    return { ok: true, following: false };
  } else {
    db.prepare("INSERT INTO wall_follows (follower_phone, following_phone, created_at) VALUES (?, ?, datetime('now','localtime'))").run(follower_phone, following_phone);
    return { ok: true, following: true };
  }
}));

// 用户主页
app.get('/api/wall/user/:phone', (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const posts = db.prepare('SELECT * FROM wall_posts WHERE phone = ? ORDER BY created_at DESC LIMIT 20').all(phone);
  const followers = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE following_phone = ?').get(phone).n;
  const following = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE follower_phone = ?').get(phone).n;
  const user = db.prepare('SELECT name, phone FROM users WHERE phone = ?').get(phone);
  return {
    nickname: user?.name || '匿名',
    phone,
    followers,
    following,
    postCount: posts.length,
    posts: posts.map(p => ({ ...p, images: p.images ? p.images.split(',').filter(Boolean) : [], gif_urls: safeJSON(p.gif_urls) }))
  };
}));

// 删除帖子
app.delete('/api/wall/posts/:id', (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM wall_posts WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_likes WHERE post_id = ?').run(req.params.id);
  return { ok: true };
}));

// ═══════════════════════════════════════════════
// 💬 聊天
// ═══════════════════════════════════════════════

// 获取或创建会话（订单相关）
app.post('/api/chat/conversation', (req, res) => JSON_RES(res, () => {
  const { user_phone, rider_phone, order_id, order_title } = req.body;
  if (!user_phone || !rider_phone) return { error: '缺少手机号' };
  // 查找已有会话
  let conv = db.prepare(
    "SELECT * FROM conversations WHERE ((user1_phone=? AND user2_phone=?) OR (user1_phone=? AND user2_phone=?)) AND (item_id=? OR 0=?)"
  ).get(user_phone, rider_phone, rider_phone, user_phone, order_id||0, order_id?0:1);
  if (!conv) {
    const r = db.prepare(
      "INSERT INTO conversations (user1_phone,user2_phone,item_id,item_title,created_at) VALUES (?,?,?,?,datetime('now','localtime'))"
    ).run(user_phone, rider_phone, order_id||null, order_title||'');
    conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(r.lastInsertRowid);
  }
  return conv;
}));

// 获取会话列表
app.get('/api/chat/conversations', (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) return [];
  const convs = db.prepare(
    "SELECT c.*, " +
    "(SELECT COUNT(*) FROM messages WHERE conversation_id=c.id AND sender_phone!=? AND is_read=0) as unread " +
    "FROM conversations c WHERE user1_phone=? OR user2_phone=? ORDER BY last_message_at DESC, created_at DESC"
  ).all(phone, phone, phone);
  return convs.map(c => {
    const otherPhone = c.user1_phone === phone ? c.user2_phone : c.user1_phone;
    const otherUser = db.prepare('SELECT name,phone FROM users WHERE phone=?').get(otherPhone)
      || db.prepare('SELECT name,phone FROM riders WHERE phone=?').get(otherPhone)
      || { name: '未知用户', phone: otherPhone };
    return { ...c, other_name: otherUser.name, other_phone: otherPhone };
  });
}));

// 发送消息
app.post('/api/chat/send', (req, res) => JSON_RES(res, () => {
  const { conversation_id, sender_phone, content, type } = req.body;
  if (!conversation_id || !sender_phone || !content) return { error: '参数不完整' };
  const r = db.prepare(
    "INSERT INTO messages (conversation_id,sender_phone,content,type,created_at) VALUES (?,?,?,?,datetime('now','localtime'))"
  ).run(conversation_id, sender_phone, content, type || 'text');
  // 更新会话最后消息
  db.prepare(
    "UPDATE conversations SET last_message=?, last_message_at=datetime('now','localtime'), last_sender=? WHERE id=?"
  ).run(content.slice(0, 100), sender_phone, conversation_id);
  return { ok: true, id: r.lastInsertRowid };
}));

// 获取消息列表
app.get('/api/chat/messages/:conversation_id', (req, res) => JSON_RES(res, () => {
  const cid = req.params.conversation_id;
  const phone = req.query.phone;
  const before = req.query.before; // message id for pagination
  let msgs;
  if (before) {
    msgs = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND id<? ORDER BY id DESC LIMIT 30').all(cid, before);
  } else {
    msgs = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 30').all(cid);
  }
  // 标记已读
  if (phone) {
    db.prepare('UPDATE messages SET is_read=1 WHERE conversation_id=? AND sender_phone!=? AND is_read=0').run(cid, phone);
  }
  return msgs.reverse();
}));

// 获取未读消息数
app.get('/api/chat/unread', (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) return { count: 0 };
  const count = db.prepare(
    'SELECT COUNT(*) as n FROM messages WHERE sender_phone!=? AND is_read=0 AND conversation_id IN (SELECT id FROM conversations WHERE user1_phone=? OR user2_phone=?)'
  ).get(phone, phone, phone).n;
  return { count };
}));

// 安全JSON解析
function safeJSON(str) {
  if (!str) return [];
  try { return JSON.parse(str); } catch(e) { return []; }
}

// 删除骑手
app.delete('/api/riders/:id', (req, res) => JSON_RES(res, () => {
 db.prepare('DELETE FROM riders WHERE id = ?').run(req.params.id);
 return { ok: true };
}));

// 启动
app.listen(PORT, () => {
  console.log(`\n🦥 校园懒人效率站服务已启动！`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📱 用户端: http://localhost:${PORT}/app.html`);
  console.log(`🚴 骑手端: http://localhost:${PORT}/rider.html`);
  console.log(`🔒 管理端: http://localhost:${PORT}/admin.html`);
  console.log(`👤 总管理员: admin / admin123\n`);
});
