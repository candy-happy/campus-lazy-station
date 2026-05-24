// routes/ads.js - 广告轮播路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 前端：获取活跃广告 ───────────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () =>
  db.prepare("SELECT * FROM ads WHERE status='active' AND (end_time IS NULL OR end_time > datetime('now','localtime')) ORDER BY sort_order ASC").all()
));

// ─── 管理员：广告列表（全部） ─────────────────────────────
router.get('/admin', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM ads ORDER BY sort_order ASC, created_at DESC').all()
));

// ─── 管理员：新增广告 ─────────────────────────────────────
router.post('/admin', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { title, description, image, link_type, link_value, sort_order, status, start_time, end_time } = req.body;
  if (!title) return makeError('请填写标题', ErrorCode.PARAM_MISSING);
  db.prepare(`INSERT INTO ads (title, description, image, link_type, link_value, sort_order, status, start_time, end_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`)
    .run(title, description||'', image||'', link_type||'none', link_value||'', sort_order||0, status||'active', start_time||null, end_time||null);
  return { ok: true };
}));

// ─── 管理员：更新广告 ─────────────────────────────────────
router.put('/admin/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
  if (!ad) return makeError('广告不存在', ErrorCode.NOT_FOUND);
  const { title, description, image, link_type, link_value, sort_order, status, start_time, end_time } = req.body;
  db.prepare(`UPDATE ads SET title=?, description=?, image=?, link_type=?, link_value=?, sort_order=?, status=?,
    start_time=?, end_time=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(
      title??ad.title, description??ad.description, image??ad.image, link_type??ad.link_type,
      link_value??ad.link_value, sort_order??ad.sort_order, status??ad.status,
      start_time??ad.start_time, end_time??ad.end_time, req.params.id
    );
  return { ok: true };
}));

// ─── 管理员：删除广告 ─────────────────────────────────────
router.delete('/admin/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM ads WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

module.exports = router;
