// routes/riders.js - 骑手路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── 骑手头像上传配置 ──────────────────────────────────────
const AVATAR_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_UPLOAD_DIR)) fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'rider-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

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

// ─── 更新骑手资料 ──────────────────────────────────────────
router.put('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const { name, avatar, dormitory } = req.body;
  const sets = [];
  const vals = [];
  if (name !== undefined) { sets.push('name=?'); vals.push(name); }
  if (avatar !== undefined) { sets.push('avatar=?'); vals.push(avatar); }
  if (dormitory !== undefined) { sets.push('dormitory=?'); vals.push(dormitory); }
  if (!sets.length) return makeError('无更新内容', ErrorCode.USER_NO_UPDATE);
  vals.push(req.params.phone);
  db.prepare('UPDATE riders SET ' + sets.join(',') + ' WHERE phone=?').run(...vals);
  const rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(req.params.phone);
  return { ...rider, phone: rider.phone, phoneDisplay: fmtPhone(rider.phone) };
}));

// ─── 骑手头像上传 ──────────────────────────────────────────
router.post('/:phone/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => JSON_RES(res, () => {
  if (!req.file) return makeError('请选择图片', 'PARAM_001');
  const url = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE riders SET avatar = ? WHERE phone = ?').run(url, req.params.phone);
  const rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(req.params.phone);
  return { ...rider, phone: rider.phone, phoneDisplay: fmtPhone(rider.phone), avatarUrl: url };
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
