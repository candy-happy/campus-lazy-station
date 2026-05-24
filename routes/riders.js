// routes/riders.js - 骑手路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone } = require('../utils/helpers');

// ─── 骑手列表（管理员） ────────────────────────────────────
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM riders ORDER BY total_orders DESC').all()
    .map(r => ({ ...r, phone: r.phone, phoneDisplay: fmtPhone(r.phone) }))
));

// ─── 骑手详情 ─────────────────────────────────────────────
router.get('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(req.params.phone);
  if (!rider) return makeError('骑手不存在', ErrorCode.RIDER_NOT_FOUND);
  return { ...rider, phone: rider.phone, phoneDisplay: fmtPhone(rider.phone) };
}));

// ─── 更新骑手状态 ──────────────────────────────────────────
router.patch('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const { status } = req.body;
  if (status) db.prepare('UPDATE riders SET status = ? WHERE phone = ?').run(status, req.params.phone);
  return { ok: true };
}));

// ─── 删除骑手（管理员） ────────────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM riders WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

module.exports = router;
