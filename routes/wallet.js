// routes/wallet.js - 骑手钱包 & 提现路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 骑手钱包概览 ──────────────────────────────────────
router.get('/rider/wallet', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) throw new Error('缺少phone');
  const rider = db.prepare('SELECT total_earnings, total_orders FROM riders WHERE phone = ?').get(phone);
  if (!rider) throw new Error('骑手不存在');
  const pending = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM withdraw_logs WHERE phone = ? AND status = 'pending'").get(phone);
  const withdrawn = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM withdraw_logs WHERE phone = ? AND status = 'approved'").get(phone);
  const available = Math.max(0, rider.total_earnings - (withdrawn.total || 0) - (pending.total || 0));
  return {
    total_earnings: rider.total_earnings,
    available: available.toFixed(2) * 1,
    pending: pending.total || 0,
    withdrawn: withdrawn.total || 0
  };
}));

// ─── 申请提现 ──────────────────────────────────────────
router.post('/rider/withdraw', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, amount } = req.body;
  if (!phone || !amount) throw new Error('缺少参数');
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < 1) throw new Error('最低提现1元');
  if (amt > 500) throw new Error('单次最多提现500元');
  const wallet = db.prepare('SELECT total_earnings FROM riders WHERE phone = ?').get(phone);
  if (!wallet) throw new Error('骑手不存在');
  const withdrawn = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM withdraw_logs WHERE phone = ? AND status IN ('pending','approved')").get(phone);
  const available = wallet.total_earnings - (withdrawn.total || 0);
  if (amt > available) throw new Error('余额不足，可提现: ' + available.toFixed(2) + '元');
  db.prepare("INSERT INTO withdraw_logs (phone, amount, status, created_at) VALUES (?, ?, 'pending', datetime('now'))").run(phone, amt);
  return { ok: true, message: '提现申请已提交，等待审核' };
}));

// ─── 提现记录 ──────────────────────────────────────────
router.get('/rider/withdraw/logs', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) throw new Error('缺少phone');
  return db.prepare('SELECT * FROM withdraw_logs WHERE phone = ? ORDER BY created_at DESC').all(phone);
}));

// ─── 收入明细 ──────────────────────────────────────────
router.get('/rider/earnings', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) throw new Error('缺少phone');
  const orders = db.prepare("SELECT order_no, price, completed_at FROM orders WHERE rider_phone = ? AND status = 'completed' ORDER BY completed_at DESC").all(phone);
  return orders.map(o => ({
    order_no: o.order_no,
    amount: Math.round(o.price * 0.8 * 100) / 100,
    time: o.completed_at
  }));
}));

// ─── 管理员审核提现 ──────────────────────────────────────
router.post('/admin/withdraw/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { status, reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw new Error('无效状态');
  const log = db.prepare('SELECT * FROM withdraw_logs WHERE id = ?').get(req.params.id);
  if (!log) throw new Error('记录不存在');
  if (log.status !== 'pending') throw new Error('该申请已处理');
  db.prepare('UPDATE withdraw_logs SET status = ?, reason = ?, processed_at = datetime(\'now\') WHERE id = ?').run(status, reason || '', req.params.id);
  return { ok: true };
}));

// ─── 管理员查看所有提现申请 ──────────────────────────────
router.get('/admin/withdraw', requireAdmin, (req, res) => JSON_RES(res, () => {
  return db.prepare('SELECT w.*, r.name as rider_name FROM withdraw_logs w LEFT JOIN riders r ON w.phone = r.phone ORDER BY w.created_at DESC').all();
}));

module.exports = router;
