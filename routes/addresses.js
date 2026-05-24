// routes/addresses.js - 地址管理路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 地址列表 ─────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) return makeError('缺少phone', ErrorCode.PARAM_MISSING);
  return db.prepare('SELECT * FROM addresses WHERE phone = ? ORDER BY is_default DESC, created_at DESC').all(phone);
}));

// ─── 新增地址 ─────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, name, location, note, is_default } = req.body;
  if (!phone || !name || !location) return makeError('请填写必填项', ErrorCode.PARAM_MISSING);
  if (is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE phone = ?').run(phone);
  const r = db.prepare(`INSERT INTO addresses (phone, name, location, note, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`).run(phone, name, location, note || '', is_default ? 1 : 0);
  return { ok: true, id: r.lastInsertRowid };
}));

// ─── 更新地址 ─────────────────────────────────────────────
router.put('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const { name, location, note, is_default, phone } = req.body;
  const addr = db.prepare('SELECT * FROM addresses WHERE id = ?').get(req.params.id);
  if (!addr) return makeError('地址不存在', ErrorCode.NOT_FOUND);
  if (is_default && phone) db.prepare('UPDATE addresses SET is_default = 0 WHERE phone = ?').run(phone);
  db.prepare('UPDATE addresses SET name=?, location=?, note=?, is_default=? WHERE id=?')
    .run(name || addr.name, location || addr.location, note !== undefined ? note : addr.note, is_default ? 1 : 0, req.params.id);
  return { ok: true };
}));

// ─── 删除地址 ─────────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

module.exports = router;
