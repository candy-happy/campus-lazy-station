// routes/orders.js - 订单路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone, genOrderNo, calcRiderLevel, sanitizeString, sanitizeNumber, isValidPhone } = require('../utils/helpers');

// ─── 创建订单 ─────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { type, pickup_location, delivery_location, details, phone, tip } = req.body;
  if (!phone || !pickup_location || !delivery_location) return makeError('缺少必填信息', ErrorCode.PARAM_MISSING);

  // 输入验证
  if (!isValidPhone(phone)) return makeError('手机号格式错误', ErrorCode.PARAM_INVALID);
  const sanitizedPickup = sanitizeString(pickup_location, 100);
  const sanitizedDelivery = sanitizeString(delivery_location, 100);
  const sanitizedDetails = sanitizeString(details || '', 500);
  const sanitizedTip = sanitizeNumber(tip, 0, 1000);

  const svc = db.prepare('SELECT * FROM services WHERE key = ?').get(type);
  const price = (svc ? svc.base_price : 2) + sanitizedTip;
  const orderNo = genOrderNo();

  db.prepare(`INSERT INTO orders (order_no, type, pickup_location, delivery_location, details, phone, price, tip, status, progress, created_at)
    VALUES (?,?,?,?,?,?,?,?,'pending',10,datetime('now','localtime'))`)
    .run(orderNo, type, sanitizedPickup, sanitizedDelivery, sanitizedDetails, phone, price, sanitizedTip);

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

// ─── 订单列表（支持分页） ──────────────────────────────────
router.get('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, rider_phone, status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (phone) { sql += ' AND phone = ?'; params.push(phone); }
  if (rider_phone) { sql += ' AND rider_phone = ?'; params.push(rider_phone); }
  if (status) {
    if (status === 'active') { sql += " AND status IN ('accepted','running')"; }
    else if (status === 'my') { sql += " AND rider_phone IS NOT NULL AND status NOT IN ('pending')"; }
    else { sql += ' AND status = ?'; params.push(status); }
  }
  
  // 先查询总数
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt');
  const total = db.prepare(countSql).get(...params).cnt;
  
  // 添加分页和排序
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  // 优化N+1查询：批量获取用户信息
  const orders = db.prepare(sql).all(...params);
  const phoneSet = new Set(orders.map(o => o.phone));
  const userMap = new Map();
  if (phoneSet.size > 0) {
    const placeholders = Array.from(phoneSet).map(() => '?').join(',');
    const users = db.prepare(`SELECT phone, name FROM users WHERE phone IN (${placeholders})`).all(...phoneSet);
    users.forEach(u => userMap.set(u.phone, u.name));
  }

  return {
    total,
    page: pageNum,
    limit: limitNum,
    list: orders.map(o => ({
      ...o,
      phone: o.phone,
      phoneDisplay: fmtPhone(o.phone),
      user_name: userMap.get(o.phone) || '',
      rider_phone: o.rider_phone,
      rider_phoneDisplay: fmtPhone(o.rider_phone)
    }))
  };
}));

// ─── 订单详情 ─────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  
  // 隐私保护：只有订单创建者、 assigned骑手或管理员可以看到完整手机号
  const isOwner = order.phone === req.user.phone;
  const isRider = order.rider_phone === req.user.phone;
  const isAdmin = req.user.type === 'admin';
  const canSeeFullPhone = isOwner || isRider || isAdmin;
  
  const user = db.prepare('SELECT name FROM users WHERE phone = ?').get(order.phone);
  const result = { ...order, phoneDisplay: fmtPhone(order.phone), user_name: user ? user.name : '' };
  
  if (canSeeFullPhone) {
    result.phone = order.phone;
    if (order.rider_phone) result.rider_phone = order.rider_phone;
  } else {
    // 对其他用户隐藏完整手机号
    delete result.phone;
    delete result.rider_phone;
  }
  
  return result;
}));

// ─── 骑手接单 ─────────────────────────────────────────────
router.post('/:id/accept', requireAuth, (req, res) => JSON_RES(res, () => {
  const { rider_phone, rider_name } = req.body;
  
  // 验证骑手身份：请求者必须是骑手本人
  if (req.user.phone !== rider_phone) {
    return makeError('只能接自己的单', ErrorCode.FORBIDDEN);
  }
  
  // 验证骑手存在且状态正常
  const rider = db.prepare('SELECT * FROM riders WHERE phone = ? AND status = 1').get(rider_phone);
  if (!rider) {
    return makeError('骑手不存在或已被冻结', ErrorCode.FORBIDDEN);
  }
  
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
  
  // 验证操作者身份：只有骑手本人或管理员可以完成订单
  if (order.rider_phone && req.user.phone !== order.rider_phone && req.user.type !== 'admin') {
    return makeError('只能完成自己的订单', ErrorCode.FORBIDDEN);
  }
  
  db.prepare(`UPDATE orders SET status='completed', progress=100, completed_at=datetime('now','localtime') WHERE id = ?`).run(order.id);

  if (order.rider_phone) {
    // 骑手收入 = 订单金额 * 80%（平台抽成20%）
    const riderEarning = Math.round(order.price * 0.8 * 100) / 100;
    db.prepare('UPDATE riders SET total_orders = total_orders + 1, total_earnings = total_earnings + ? WHERE phone = ?')
      .run(riderEarning, order.rider_phone);
    const rider = db.prepare('SELECT total_orders FROM riders WHERE phone = ?').get(order.rider_phone);
    const newLevel = calcRiderLevel(rider.total_orders);
    db.prepare('UPDATE riders SET level = ? WHERE phone = ?').run(newLevel, order.rider_phone);
  }
  return { ok: true };
}));

// ─── 取消订单 ─────────────────────────────────────────────
// pending→用户直接取消 accepted/running→发起取消申请等待审核
router.post('/:id/cancel', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);

  // IDOR防护：只有订单创建者或管理员可以取消
  if (req.user.type !== 'admin' && order.phone !== req.user.phone) {
    return makeError('无权操作此订单', 'FORBIDDEN');
  }

  const { reason } = req.body;

  // 已有取消申请待审核
  if (order.cancel_request_status === 'pending') return makeError('已有取消申请待审核');
  // 已有退款申请待审核
  if (order.refund_status === 'pending') return makeError('已有退款申请待审核');

  if (order.status === 'pending') {
    // 未接单：用户直接取消
    db.prepare(`UPDATE orders SET status='cancelled', cancelled_at=datetime('now','localtime'), cancel_reason=?
      WHERE id=?`).run(reason || '用户取消', order.id);
    return { ok: true, direct: true };
  } else if (order.status === 'accepted' || order.status === 'running') {
    // 已接单/配送中：发起取消申请
    db.prepare(`UPDATE orders SET cancel_request_status='pending', cancel_request_reason=?, cancel_requested_at=datetime('now','localtime')
      WHERE id=?`).run(reason || '用户申请取消', order.id);
    return { ok: true, direct: false, message: '取消申请已提交，等待审核' };
  } else {
    return makeError('当前订单状态不可取消');
  }
}));

// ─── 退款申请（已完成订单）─────────────────────────────────
router.post('/:id/refund', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);

  // IDOR防护：只有订单创建者或管理员可以申请退款
  if (req.user.type !== 'admin' && order.phone !== req.user.phone) {
    return makeError('无权操作此订单', 'FORBIDDEN');
  }

  const { reason } = req.body;

  if (order.status !== 'completed') return makeError('只有已完成的订单可以申请退款');
  if (order.refund_status === 'pending') return makeError('已有退款申请待审核');
  if (order.refund_status === 'approved_full' || order.refund_status === 'approved_partial') return makeError('退款已处理');

  db.prepare(`UPDATE orders SET refund_status='pending', refund_reason=?, refund_requested_at=datetime('now','localtime')
    WHERE id=?`).run(reason || '用户申请退款', order.id);
  return { ok: true, message: '退款申请已提交，等待管理员审核' };
}));

// ─── 管理员审核取消申请 ─────────────────────────────────────
router.post('/:id/cancel-review', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  const { action, admin_name } = req.body; // action: 'approve' | 'reject'

  if (order.cancel_request_status !== 'pending') return makeError('无待审核的取消申请');

  if (action === 'approve') {
    db.prepare(`UPDATE orders SET status='cancelled', cancel_request_status='approved', cancelled_at=datetime('now','localtime'),
      cancel_reason=?, cancel_resolved_at=datetime('now','localtime'), cancel_resolved_by=? WHERE id=?`)
      .run(order.cancel_request_reason, admin_name || '管理员', order.id);
  } else {
    db.prepare(`UPDATE orders SET cancel_request_status='rejected', cancel_resolved_at=datetime('now','localtime'), cancel_resolved_by=? WHERE id=?`)
      .run(admin_name || '管理员', order.id);
  }
  return { ok: true };
}));

// ─── 骑手审核取消申请 ─────────────────────────────────────
router.post('/:id/cancel-rider-review', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  const { action, rider_name } = req.body;

  if (order.cancel_request_status !== 'pending') return makeError('无待审核的取消申请');

  if (action === 'approve') {
    db.prepare(`UPDATE orders SET status='cancelled', cancel_request_status='approved', cancelled_at=datetime('now','localtime'),
      cancel_reason=?, cancel_resolved_at=datetime('now','localtime'), cancel_resolved_by=? WHERE id=?`)
      .run(order.cancel_request_reason, '骑手:' + (rider_name || ''), order.id);
  } else {
    db.prepare(`UPDATE orders SET cancel_request_status='rejected', cancel_resolved_at=datetime('now','localtime'), cancel_resolved_by=? WHERE id=?`)
      .run('骑手:' + (rider_name || ''), order.id);
  }
  return { ok: true };
}));

// ─── 管理员审核退款申请 ─────────────────────────────────────
router.post('/:id/refund-review', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  const { action, refund_amount, admin_name } = req.body;
  // action: 'approve_full' | 'approve_partial' | 'reject'

  if (order.refund_status !== 'pending') return makeError('无待审核的退款申请');

  if (action === 'approve_full') {
    db.prepare(`UPDATE orders SET refund_status='approved_full', refund_amount=?, refund_resolved_at=datetime('now','localtime'), refund_resolved_by=? WHERE id=?`)
      .run(order.price, admin_name || '管理员', order.id);
  } else if (action === 'approve_partial') {
    if (!refund_amount || refund_amount <= 0) return makeError('请填写退款金额');
    if (refund_amount > order.price) return makeError('退款金额不能超过订单金额');
    db.prepare(`UPDATE orders SET refund_status='approved_partial', refund_amount=?, refund_resolved_at=datetime('now','localtime'), refund_resolved_by=? WHERE id=?`)
      .run(refund_amount, admin_name || '管理员', order.id);
  } else {
    db.prepare(`UPDATE orders SET refund_status='rejected', refund_resolved_at=datetime('now','localtime'), refund_resolved_by=? WHERE id=?`)
      .run(admin_name || '管理员', order.id);
  }
  return { ok: true };
}));

// ─── 评价订单 ─────────────────────────────────────────────
router.post('/:id/rate', requireAuth, (req, res) => JSON_RES(res, () => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) return makeError('订单不存在', ErrorCode.ORDER_NOT_FOUND, 404);

  // IDOR防护：只有订单创建者可以评价
  if (order.phone !== req.user.phone) {
    return makeError('无权评价此订单', 'FORBIDDEN');
  }

  // 防止重复评价
  if (order.rating_stars) return makeError('已评价过此订单', 'ORDER_ALREADY_RATED');

  const { stars, comment } = req.body;
  const ratingStars = Math.min(5, Math.max(1, parseInt(stars) || 5));
  const ratingComment = String(comment || '').slice(0, 500);

  db.prepare(`UPDATE orders SET rating_stars=?, rating_comment=?, rating_at=datetime('now','localtime')
    WHERE id=? AND status='completed'`)
    .run(ratingStars, ratingComment, order.id);

  // 使用订单创建者的手机号发放积分（而非请求体中的phone，防止伪造）
  db.prepare('UPDATE points SET total = total + 2 WHERE phone = ?').run(order.phone);
  db.prepare("INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 2, '评价奖励')").run(order.phone);
  return { ok: true };
}));

module.exports = router;
