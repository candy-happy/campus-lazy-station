// routes/ads.js - 广告轮播路由
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { auditFromReq } = require('../utils/audit');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { withCompress } = require('../utils/upload');

// ─── 广告媒体上传配置 ────────────────────────────────────
const ADS_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'ads');
if (!fs.existsSync(ADS_UPLOAD_DIR)) fs.mkdirSync(ADS_UPLOAD_DIR, { recursive: true });

const adStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ADS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith('video') ? '.mp4' : '.jpg');
    cb(null, 'ad-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});

const adUpload = multer({
  storage: adStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('只支持图片(jpg/png/gif/webp)和视频(mp4/webm)文件'));
  }
});

// ─── 前端：获取活跃广告 ───────────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () =>
  db.prepare("SELECT * FROM ads WHERE status='active' AND (end_time IS NULL OR end_time > datetime('now','localtime')) ORDER BY sort_order ASC").all()
));

// ─── 管理员：广告列表（全部） ─────────────────────────────
router.get('/admin', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM ads ORDER BY sort_order ASC, created_at DESC').all()
));

// ─── 管理员：上传广告媒体（图片/视频） ─────────────────────
router.post('/admin/upload', requireAdmin, withCompress(adUpload.single('media')), (req, res) => JSON_RES(res, () => {
  if (!req.file) return makeError('请选择文件', ErrorCode.PARAM_MISSING);
  const url = '/uploads/ads/' + req.file.filename;
  const isVideo = req.file.mimetype.startsWith('video/');
  return { url, filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size, isVideo };
}));

// ─── 管理员：新增广告 ─────────────────────────────────────
router.post('/admin', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { title, description, image, media_url, link_url, link_type, link_value, sort_order, status, start_time, end_time } = req.body;
  if (!title) return makeError('请填写标题', ErrorCode.PARAM_MISSING);
  db.prepare(`INSERT INTO ads (title, description, image, media_url, link_url, link_type, link_value, sort_order, status, start_time, end_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`)
    .run(title, description||'', image||'', media_url||'', link_url||'', link_type||'none', link_value||'', sort_order||0, status||'active', start_time||null, end_time||null);
  auditFromReq(req, 'ad.create', { type: 'ad', id: '' }, `创建广告: ${title}`);
  return { ok: true };
}));

// ─── 管理员：更新广告 ─────────────────────────────────────
router.put('/admin/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
  if (!ad) return makeError('广告不存在', ErrorCode.NOT_FOUND);
  const { title, description, image, media_url, link_url, link_type, link_value, sort_order, status, start_time, end_time } = req.body;
  db.prepare(`UPDATE ads SET title=?, description=?, image=?, media_url=?, link_url=?, link_type=?, link_value=?, sort_order=?, status=?,
    start_time=?, end_time=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(
      title??ad.title, description??ad.description, image??ad.image, media_url??ad.media_url,
      link_url??ad.link_url, link_type??ad.link_type, link_value??ad.link_value, sort_order??ad.sort_order,
      status??ad.status, start_time??ad.start_time, end_time??ad.end_time, req.params.id
    );
  return { ok: true };
}));

// ─── 管理员：删除广告 ─────────────────────────────────────
router.delete('/admin/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const ad = db.prepare('SELECT media_url FROM ads WHERE id = ?').get(req.params.id);
  if (ad?.media_url) {
    const fp = path.join(__dirname, '..', ad.media_url.replace(/^\//, ''));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  db.prepare('DELETE FROM ads WHERE id = ?').run(req.params.id);
  auditFromReq(req, 'ad.delete', { type: 'ad', id: req.params.id }, `删除广告 #${req.params.id}`);
  return { ok: true };
}));

// ─── 前端：记录广告浏览（展示/点击） ───────────────────────
router.post('/:id/view', requireAuth, (req, res) => JSON_RES(res, () => {
  const adId = parseInt(req.params.id);
  const { event_type } = req.body; // 'impression' | 'click'
  if (!adId || !['impression','click'].includes(event_type)) return makeError('参数错误', ErrorCode.PARAM_INVALID);
  const ad = db.prepare('SELECT id FROM ads WHERE id = ?').get(adId);
  if (!ad) return makeError('广告不存在', ErrorCode.NOT_FOUND);
  const phone = req.user?.phone || '';
  // 插入浏览记录
  db.prepare('INSERT INTO ad_views (ad_id, phone, event_type, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
    .run(adId, phone, event_type, req.ip || '', req.get('user-agent') || '');
  // 更新广告快照计数
  const col = event_type === 'impression' ? 'view_count' : 'click_count';
  db.prepare(`UPDATE ads SET ${col} = ${col} + 1 WHERE id = ?`).run(adId);
  return { ok: true };
}));

// ─── 管理员：广告浏览统计 ────────────────────────────────
router.get('/admin/stats', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { start_date } = req.query;
  // 默认最近30天
  const start = start_date || new Date(Date.now() - 29*86400000).toISOString().slice(0,10);
  // 按广告汇总
  const summary = db.prepare(`
    SELECT a.id, a.title, a.view_count, a.click_count,
      COALESCE(v.views, 0) as period_views, COALESCE(v.clicks, 0) as period_clicks
    FROM ads a
    LEFT JOIN (
      SELECT ad_id,
        SUM(CASE WHEN event_type='impression' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) as clicks
      FROM ad_views
      WHERE created_at >= ?
      GROUP BY ad_id
    ) v ON a.id = v.ad_id
    ORDER BY a.sort_order ASC, a.created_at DESC
  `).all(start);
  // 按天汇总趋势
  const daily = db.prepare(`
    SELECT date(created_at) as date, event_type, COUNT(*) as count
    FROM ad_views
    WHERE created_at >= ?
    GROUP BY date(created_at), event_type
    ORDER BY date(created_at) ASC
  `).all(start);
  return { summary, daily };
}));

module.exports = router;
