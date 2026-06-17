// routes/feedback.js - 问题反馈路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, makeError } = require('../utils/response');

// ─── 提交反馈 ───
router.post('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { category, content, contact } = req.body;
  const phone = req.user.phone;
  if (!content || !content.trim()) return makeError('请输入反馈内容');
  if (content.length > 1000) return makeError('反馈内容不能超过1000字');

  const validCategories = ['bug', 'feature', 'complaint', 'other'];
  const cat = validCategories.includes(category) ? category : 'other';

  // 获取用户昵称
  const user = db.prepare('SELECT name, nickname FROM users WHERE phone = ?').get(phone);
  const nickname = (user && (user.nickname || user.name)) || '';

  const info = db.prepare(
    'INSERT INTO feedback (phone, nickname, category, content, contact) VALUES (?, ?, ?, ?, ?)'
  ).run(phone, nickname, cat, content.trim(), contact || '');

  return { ok: true, id: info.lastInsertRowid };
}));

// ─── 获取我的反馈列表 ───
router.get('/mine', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const list = db.prepare(
    'SELECT * FROM feedback WHERE phone = ? ORDER BY created_at DESC LIMIT 50'
  ).all(phone);
  return list;
}));

// ─── 获取反馈详情 ───
router.get('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!fb) return makeError('反馈不存在');
  // 普通用户只能看自己的
  if (fb.phone !== req.user.phone && (!req.user.role || req.user.role !== 'admin')) {
    return makeError('无权查看');
  }
  return fb;
}));

// ─── 管理端：获取所有反馈 ───
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { status, category, page = 1, size = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const sizeNum = Math.min(100, Math.max(1, parseInt(size) || 20));
  const offset = (pageNum - 1) * sizeNum;

  let where = 'WHERE 1=1';
  const params = [];
  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }
  if (category && category !== 'all') { where += ' AND category = ?'; params.push(category); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM feedback ${where}`).get(...params).n;
  const list = db.prepare(
    `SELECT * FROM feedback ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, sizeNum, offset);

  return { total, page: pageNum, size: sizeNum, list };
}));

// ─── 管理端：回复反馈 ───
router.post('/:id/reply', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { reply, status } = req.body;
  const id = req.params.id;
  const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id);
  if (!fb) return makeError('反馈不存在');
  if (!reply || !reply.trim()) return makeError('请输入回复内容');

  const newStatus = status || 'replied';
  db.prepare(
    "UPDATE feedback SET reply = ?, reply_by = ?, reply_at = datetime('now','localtime'), status = ? WHERE id = ?"
  ).run(reply.trim(), req.admin.username || 'admin', newStatus, id);

  // 给用户发通知
  try {
    db.prepare(
      "INSERT INTO notifications (phone, type, title, content, created_at) VALUES (?, 'system', ?, ?, datetime('now','localtime'))"
    ).run(fb.phone, '反馈回复', '你的问题反馈已收到回复，请查看');
  } catch(e) { /* 通知失败不影响主流程 */ }

  return { ok: true };
}));

// ─── 管理端：通过反馈（触发判官勋章） ───
router.post('/:id/approve', requireAdmin, (req, res) => JSON_RES(res, () => {
  const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!fb) return makeError('反馈不存在');
  db.prepare("UPDATE feedback SET status = 'approved', reply_by = ?, reply_at = datetime('now','localtime') WHERE id = ?")
    .run(req.admin.username || 'admin', req.params.id);

  // 触发勋章检查（判官勋章按 approved 计数）
  try { const { checkBadges } = require('./badges'); if (checkBadges) checkBadges(fb.phone); } catch (e) { /* ignore */ }

  // 通知用户
  try {
    db.prepare(
      "INSERT INTO notifications (phone, type, title, content, created_at) VALUES (?, 'system', ?, ?, datetime('now','localtime'))"
    ).run(fb.phone, '反馈已通过', '你的问题反馈已被审核通过，感谢贡献！');
  } catch(e) { /* 通知失败不影响主流程 */ }

  return { ok: true };
}));

// ─── 管理端：驳回反馈 ───
router.post('/:id/reject', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { reason } = req.body;
  const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!fb) return makeError('反馈不存在');
  db.prepare("UPDATE feedback SET status = 'rejected', reply = ?, reply_by = ?, reply_at = datetime('now','localtime') WHERE id = ?")
    .run(reason || '暂不处理', req.admin.username || 'admin', req.params.id);

  // 通知用户
  try {
    db.prepare(
      "INSERT INTO notifications (phone, type, title, content, created_at) VALUES (?, 'system', ?, ?, datetime('now','localtime'))"
    ).run(fb.phone, '反馈已驳回', reason || '你的问题反馈暂未通过审核');
  } catch(e) { /* ignore */ }

  return { ok: true };
}));

// ─── 管理端：更新反馈状态 ───
router.patch('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { status } = req.body;
  const validStatus = ['pending', 'processing', 'replied', 'closed', 'approved', 'rejected'];
  if (!validStatus.includes(status)) return makeError('无效状态');
  const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!fb) return makeError('反馈不存在');
  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, req.params.id);
  return { ok: true };
}));

// ─── 管理端：删除反馈 ───
router.delete('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM feedback WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

// ─── 管理端：反馈统计 ───
router.get('/stats/summary', requireAdmin, (req, res) => JSON_RES(res, () => {
  const total = db.prepare('SELECT COUNT(*) as n FROM feedback').get().n;
  const pending = db.prepare("SELECT COUNT(*) as n FROM feedback WHERE status='pending'").get().n;
  const replied = db.prepare("SELECT COUNT(*) as n FROM feedback WHERE status='replied'").get().n;
  const closed = db.prepare("SELECT COUNT(*) as n FROM feedback WHERE status='closed'").get().n;
  const processing = db.prepare("SELECT COUNT(*) as n FROM feedback WHERE status='processing'").get().n;
  const approved = db.prepare("SELECT COUNT(*) as n FROM feedback WHERE status='approved'").get().n;
  const rejected = db.prepare("SELECT COUNT(*) as n FROM feedback WHERE status='rejected'").get().n;
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM feedback GROUP BY category').all();
  return { total, pending, replied, closed, processing, approved, rejected, by_category: byCategory };
}));

module.exports = router;
