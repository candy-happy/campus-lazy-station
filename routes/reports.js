// routes/reports.js - 统一举报管理（校园墙/二手市场/猫狗日记/教师评价/社团/活动）
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 提交举报（各模块共用） ──────────────────────────
// POST /api/reports
// body: { source: 'wall'|'market'|'pet'|'teacher'|'club'|'activity', target_type, target_id, target_content?, reason, detail? }
router.post('/', requireAuth, (req, res) => JSON_RES(res, () => {
  const { source, target_type, target_id, target_content, reason, detail } = req.body;
  const phone = req.user.phone;
  if (!source || !target_type || !target_id || !reason) return makeError('参数不完整');

  const validSources = ['wall', 'market', 'pet', 'teacher', 'club', 'activity'];
  if (!validSources.includes(source)) return makeError('举报来源无效');

  // 防止重复举报
  const existing = db.prepare(
    'SELECT id FROM reports WHERE source=? AND target_type=? AND target_id=? AND reporter_phone=?'
  ).get(source, target_type, target_id, phone);
  if (existing) return makeError('您已举报过该内容');

  db.prepare(
    `INSERT INTO reports (source, target_type, target_id, target_content, reporter_phone, reason, detail, status, created_at)
     VALUES (?,?,?,?,?,?,?,'pending',datetime('now','localtime'))`
  ).run(source, target_type, target_id, (target_content || '').slice(0, 200), phone, reason, detail || '');

  return { ok: true };
}));

// ─── 管理端：举报列表（聚合所有来源） ───────────────
// GET /api/reports?source=wall&status=pending&page=1&limit=20
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { source, status, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const offset = (p - 1) * l;

  const conditions = [];
  const params = [];

  if (source && source !== 'all') {
    conditions.push('source = ?');
    params.push(source);
  }
  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM reports ${whereClause}`).get(...params).c;
  const rows = db.prepare(
    `SELECT * FROM reports ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, l, offset);

  return { reports: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
}));

// ─── 管理端：按来源统计（用于badge） ────────────────
router.get('/stats', requireAdmin, (req, res) => JSON_RES(res, () => {
  const bySource = db.prepare(
    "SELECT source, status, COUNT(*) as cnt FROM reports GROUP BY source, status"
  ).all();

  const stats = {};
  for (const r of bySource) {
    if (!stats[r.source]) stats[r.source] = { total: 0, pending: 0 };
    stats[r.source].total += r.cnt;
    if (r.status === 'pending') stats[r.source].pending += r.cnt;
  }

  const totalPending = db.prepare(
    "SELECT COUNT(*) as c FROM reports WHERE status='pending'"
  ).get().c;

  return { bySource: stats, totalPending };
}));

// ─── 管理端：处理举报 ──────────────────────────────
router.post('/:id/handle', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { action, admin_note } = req.body; // action: 'dismiss' | 'remove'
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return makeError('举报不存在');

  if (action === 'remove') {
    // 根据来源和目标类型删除内容
    const src = report.source;
    const type = report.target_type;
    const tid = report.target_id;

    if (src === 'wall') {
      if (type === 'post') {
        db.prepare('DELETE FROM wall_reports WHERE target_type=? AND target_id=?').run('post', tid);
        db.prepare('DELETE FROM wall_comments WHERE post_id=?').run(tid);
        db.prepare('DELETE FROM wall_likes WHERE post_id=?').run(tid);
        db.prepare('DELETE FROM wall_posts WHERE id=?').run(tid);
      } else if (type === 'comment') {
        db.prepare('DELETE FROM wall_reports WHERE target_type=? AND target_id=?').run('comment', tid);
        db.prepare('DELETE FROM wall_likes WHERE comment_id=?').run(tid);
        db.prepare('DELETE FROM wall_comments WHERE id=?').run(tid);
      }
    } else if (src === 'market') {
      if (type === 'item') {
        db.prepare('UPDATE market_items SET status=? WHERE id=?').run('removed', tid);
      } else if (type === 'comment') {
        db.prepare('DELETE FROM market_comments WHERE id=?').run(tid);
      }
    } else if (src === 'pet') {
      if (type === 'comment') {
        db.prepare('DELETE FROM pet_comments WHERE id=?').run(tid);
      } else if (type === 'post') {
        db.prepare('DELETE FROM pet_comments WHERE pet_id=?').run(tid);
        db.prepare('DELETE FROM pet_likes WHERE pet_id=?').run(tid);
        db.prepare('DELETE FROM pet_sightings WHERE pet_id=?').run(tid);
        db.prepare('DELETE FROM pets WHERE id=?').run(tid);
      }
    } else if (src === 'teacher') {
      if (type === 'review') {
        db.prepare('DELETE FROM teacher_reviews WHERE id=?').run(tid);
      }
    } else if (src === 'club') {
      if (type === 'post') {
        db.prepare('DELETE FROM club_posts WHERE id=?').run(tid);
      }
    } else if (src === 'activity') {
      if (type === 'post') {
        db.prepare('DELETE FROM activities WHERE id=?').run(tid);
      }
    }

    db.prepare(
      "UPDATE reports SET status='resolved', admin_note=?, handled_at=datetime('now','localtime') WHERE id=?"
    ).run(admin_note || '已删除违规内容', req.params.id);
  } else {
    // dismiss
    db.prepare(
      "UPDATE reports SET status='dismissed', admin_note=?, handled_at=datetime('now','localtime') WHERE id=?"
    ).run(admin_note || '举报不成立', req.params.id);
  }

  return { ok: true };
}));

module.exports = router;
