// routes/admins.js - 管理员管理路由
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { auditFromReq } = require('../utils/audit');

// ─── 管理员列表 ───────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT id, username, role, status, created_at FROM admins ORDER BY id').all()
));

// ─── 新增管理员 ───────────────────────────────────────────
router.post('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { username, password, role } = req.body;
  if (!username || !password) return makeError('缺少账号密码', ErrorCode.PARAM_MISSING);
  if (username.length < 3) return makeError('账号至少3个字符', ErrorCode.PARAM_INVALID);
  if (password.length < 6) return makeError('密码至少6位', ErrorCode.PARAM_INVALID);
  const exist = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (exist) return makeError('账号已存在', ErrorCode.DUPLICATE);
  const result = db.prepare('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), role || 'admin');

  auditFromReq(req, 'admin.create', { type: 'admin', id: result.lastInsertRowid }, `创建管理员: ${username}`);
  return { ok: true, id: result.lastInsertRowid };
}));

// ─── 删除管理员（禁止删除 super） ─────────────────────────
router.delete('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!admin) return makeError('管理员不存在', ErrorCode.USER_NOT_FOUND);
  if (admin.role === 'super') return makeError('不能删除总管理员', ErrorCode.FORBIDDEN);
  db.prepare("DELETE FROM admins WHERE id = ?").run(req.params.id);

  auditFromReq(req, 'admin.delete', { type: 'admin', id: req.params.id }, `删除管理员: ${admin.username}`);
  return { ok: true };
}));

// ─── 禁用/启用管理员 ───────────────────────────────────────
router.patch('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!admin) return makeError('管理员不存在', ErrorCode.USER_NOT_FOUND);
  if (admin.role === 'super') return makeError('不能操作总管理员', ErrorCode.FORBIDDEN);
  const newStatus = req.body.status;
  if (!['active', 'disabled'].includes(newStatus)) return makeError('无效状态', ErrorCode.PARAM_INVALID);
  db.prepare("UPDATE admins SET status = ? WHERE id = ?").run(newStatus, req.params.id);

  const action = newStatus === 'active' ? 'admin.enable' : 'admin.disable';
  auditFromReq(req, action, { type: 'admin', id: req.params.id }, `${newStatus === 'active' ? '启用' : '禁用'}管理员: ${admin.username}`);
  return { ok: true };
}));

// ─── 查看审计日志（快捷入口：跳转到审计页面） ──────────────
router.get('/me', requireAdmin, (req, res) => JSON_RES(res, () => {
  return { admin: { id: req.user.id, username: req.user.username, type: req.user.type } };
}));

module.exports = router;
