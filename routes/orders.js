// routes/orders.js - 订单路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone, genOrderNo, calcRiderLevel } = require('../utils/helpers');

// ─── 创建订单 ─────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { type, pickup_location, delivery_location, details, phone, tip } = req.body;
  if (!phone || !pickup_location || !delivery_location) return makeError('缺少必填信息', ErrorCode.PARAM_MISSING);

  const svc = db.prepare('SELECT * FROM services WHERE key = ?').get(type);
  const price = (svc ? svc.base_price : 2) + (tip || 0);
  const orderNo = genOrderNo();

  db.prepare(`INSERT INTO orders (order_no, type, pickup_location, delivery_location, details, phone, price, tip, status, progress, created_at)
    VALUES (?,?,?,?,?,?,?,?,'pending',10,datetime('now','localtime'))`)
    .run(orderNo, type, pickup_location, delivery_location, details || '', phone, price, tip || 0);

  // 奖励积分
  const pts = db.prepare('SELECT * FROM points WHERE phone = ?').get(phone);
  if (pts) {
    db.prepare('UPDATE points SET total = total + ? WHERE phone = ?').run(Math.floor(price), phone);
  } else {
    db.prepare('INSERT INTO points (phone, total) VALUES (?, ?)').run(phone, Math.floor(price));
  }
  db.prepare("INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', ?, '下单奖励')")
    .run(phone, Math.floor(price));

  // 通知在线骑手
  const riders = db.prepare("SELECT phone FROM riders WHERE status = 'online'").all();
  const insNotif = db.prepare("INSERT INTO notifications (phone, type, title, content) VALUES (?, 'order', '新订单通知', ?)");
  riders.forEach(r => insNotif.run(r.phone, `新订单${orderNo}: ${pickup_location}→${delivery_location}`));

  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  return { ok: true, order: { ...order, phone: order.phone, phoneDisplay: fmtPhone(order.phone) } };
}));

// ─── 订单列表 ─────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, rider_phone, status } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (phone) { sql += ' AND phone = ?'; params.push(phone); }
  if (rider_phone) { sql += ' AND rider_phone = ?'; params.push(rider_phone); }
  if (status) {
    if (status === 'active') { sql += " AND status IN ('accepted','running')"; }
    else if (status === 'my') { sql += " AND status NOT IN ('pending','cancelled')"; }
    else { sql += ' AND status = ?'; params.push(status); }
  }
  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params).map(o => {
    const user = db.prepare('SELECT name FROM users WHERE phone = ?').get(o.phone);
    return {
      ...o,
      phone: o.phone,
      phoneDisplay: fmtPhone(o.phone),
      user_name: user ? user.name : '',
      rider_phone: o.rider_phone,
      rider_phoneDisplay: fmtPhone(o.rider_phone)
    };
  });
}));

// ─── 订单详情 ─────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  const user = db.prepare('SELECT name FROM users WHERE phone = ?').get(order.phone);
  return { ...order, phone: order.phone, phoneDisplay: fmtPhone(order.phone), user_name: user ? user.name : '' };
}));

// ─── 骑手接单 ─────────────────────────────────────────────
router.post('/:id/accept', requireAuth, (req, res) => JSON_RES(res, () => {
  const { rider_phone, rider_name } = req.body;
  db.prepare(`UPDATE orders SET status='accepted', rider_phone=?, rider_name=?, progress=30, accepted_at=datetime('now','localtime')
    WHERE (id=? OR order_no=?) AND status='pending'`)
    .run(rider_phone, rider_name, req.params.id, req.params.id);
  db.prepare("INSERT INTO notifications (phone, type, title, content) VALUES (?, 'order', '订单已接单', ?)")
    .run(rider_phone, `骑手${rider_name}已接单`);
  return { ok: true };
}));

// ─── 开始配送 ─────────────────────────────────────────────
router.post('/:id/start', requireAuth, (req, res) => JSON_RES(res, () => {
  db.prepare(`UPDATE orders SET status='running', progress=60 WHERE (id=? OR order_no=?) AND status='accepted'`)
    .run(req.params.id, req.params.id);
  return { ok: true };
}));

// ─── 完成订单 ─────────────────────────────────────────────
router.post('/:id/complete', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND);
  db.prepare(`UPDATE orders SET status='completed', progress=100, completed_at=datetime('now','localtime') WHERE id = ?`).run(order.id);

  if (order.rider_phone) {
    db.prepare('UPDATE riders SET total_orders = total_orders + 1, total_earnings = total_earnings + ? WHERE phone = ?')
      .run(order.price, order.rider_phone);
    const rider = db.prepare('SELECT total_orders FROM riders WHERE phone = ?').get(order.rider_phone);
    const newLevel = calcRiderLevel(rider.total_orders);
    db.prepare('UPDATE riders SET level = ? WHERE phone = ?').run(newLevel, order.rider_phone);
  }
  return { ok: true };
}));

// ─── 取消订单 ─────────────────────────────────────────────
router.post('/:id/cancel', requireAuth, (req, res) => JSON_RES(res, () => {
  db.prepare(`UPDATE orders SET status='cancelled', cancelled_at=datetime('now','localtime'), cancel_reason=?
    WHERE (id=? OR order_no=?) AND status IN ('pending','accepted')`)
    .run(req.body.reason || '用户取消', req.params.id, req.params.id);
  return { ok: true };
}));

// ─── 评价订单 ─────────────────────────────────────────────
router.post('/:id/rate', requireAuth, (req, res) => JSON_RES(res, () => {
  const { stars, comment, phone } = req.body;
  db.prepare(`UPDATE orders SET rating_stars=?, rating_comment=?, rating_at=datetime('now','localtime')
    WHERE (id=? OR order_no=?) AND status='completed'`)
    .run(stars, comment || '', req.params.id, req.params.id);
  db.prepare('UPDATE points SET total = total + 2 WHERE phone = ?').run(phone);
  db.prepare("INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 2, '评价奖励')").run(phone);
  return { ok: true };
}));

module.exports = router;
