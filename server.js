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
