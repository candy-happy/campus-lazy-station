// routes/reports.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, makeError } = require('../utils/response');
const { auditFromReq } = require('../utils/audit');

// ─── 提交举报 ─────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { source, target_type, target_id, reason } = req.body;
  const phone = req.user.phone || req.user.student_id || '';

  db.prepare(`INSERT INTO reports (source, target_type, target_id, reason, reporter_phone, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now','localtime'))`)
    .run(source, target_type, target_id, reason, phone);
  return { ok: true };
}));

// ─── 管理端：举报列表 ────────────────────────────────────
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { page = 1, limit = 20, status, source } = req.query;
  const l = Math.min(parseInt(limit) || 20, 100);
  const offset = (Math.max(1, parseInt(page) || 1) - 1) * l;
  let where = []; let params = [];
  if (status && status !== 'all') { where.push('r.status = ?'); params.push(status); }
  if (source && source !== 'all') { where.push('r.source = ?'); params.push(source); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM reports r ${whereClause}`).get(...params).c;
  const reports = db.prepare(`SELECT * FROM reports r ${whereClause} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).all(...params, l, offset);
  return { reports, total, page: parseInt(page) };
}));

// ─── 举报统计 ───────────────────────────────────────────
router.get('/stats', requireAdmin, (req, res) => JSON_RES(res, () => {
  const total = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get().c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'resolved'").get().c;
  const dismissed = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'dismissed'").get().c;
  return { total, pending, resolved, dismissed };
}));

// ─── 处理举报 ───────────────────────────────────────────
router.post('/:id/handle', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { action, admin_note } = req.body; // action: 'dismiss' | 'remove'
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return makeError('举报不存在');

  let detailMsg = '';
  if (action === 'remove') {
    const src = report.source;
    const type = report.target_type;
    const tid = report.target_id;

    if (src === 'wall') {
      if (type === 'post') {
        db.prepare('DELETE FROM wall_reports WHERE target_type=? AND target_id=?').run('post', tid);
        db.prepare('DELETE FROM wall_comments WHERE post_id=?').run(tid);
        db.prepare('DELETE FROM wall_likes WHERE post_id=?').run(tid);
        db.prepare('DELETE FROM wall_posts WHERE id=?').run(tid);
        detailMsg = `删除帖子 #${tid}`;
      } else if (type === 'comment') {
        db.prepare('DELETE FROM wall_reports WHERE target_type=? AND target_id=?').run('comment', tid);
        db.prepare('DELETE FROM wall_comments WHERE id=?').run(tid);
        detailMsg = `删除评论 #${tid}`;
      }
    } else if (src === 'market') {
      if (type === 'item') { db.prepare('DELETE FROM market_items WHERE id=?').run(tid); detailMsg = `删除二手商品 #${tid}`; }
      if (type === 'comment') { db.prepare('DELETE FROM market_comments WHERE id=?').run(tid); detailMsg = `删除二手评论 #${tid}`; }
    } else if (src === 'pets') {
      if (type === 'comment') { db.prepare('DELETE FROM pet_comments WHERE id=?').run(tid); detailMsg = `删除猫狗评论 #${tid}`; }
    } else if (src === 'teachers') {
      if (type === 'review') { db.prepare('DELETE FROM teacher_reviews WHERE id=?').run(tid); detailMsg = `删除教师评价 #${tid}`; }
    }
  } else {
    detailMsg = `驳回举报 #${report.id}`;
  }

  const status = action === 'remove' ? 'resolved' : 'dismissed';
  db.prepare('UPDATE reports SET status = ?, admin_note = ?, handled_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(status, admin_note || '', report.id);

  auditFromReq(req, action === 'remove' ? 'report.remove' : 'report.dismiss',
    { type: report.target_type, id: report.target_id }, detailMsg);
  return { ok: true };
}));

module.exports = router;
