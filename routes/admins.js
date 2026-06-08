// routes/admins.js - 管理员管理路由
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 管理员列表 ───────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT id, username, role, status FROM admins').all()
));

// ─── 新增管理员 ───────────────────────────────────────────
router.post('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { username, password, role } = req.body;
  if (!username || !password) return makeError('缺少账号密码', ErrorCode.PARAM_MISSING);
  const exist = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (exist) return makeError('账号已存在', ErrorCode.DUPLICATE);
  db.prepare('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), role || 'admin');
  return { ok: true };
}));

// ─── 删除管理员（禁止删除 super） ─────────────────────────
router.delete('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  db.prepare("DELETE FROM admins WHERE id = ? AND role != 'super'").run(req.params.id);
  return { ok: true };
}));

// ─── 禁用/启用管理员 ───────────────────────────────────────
router.patch('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  db.prepare("UPDATE admins SET status = ? WHERE id = ? AND role != 'super'").run(req.body.status, req.params.id);
  return { ok: true };
}));

module.exports = router;
