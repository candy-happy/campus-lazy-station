// routes/users.js - 用户路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── 用户头像上传配置 ──────────────────────────────────────
const AVATAR_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_UPLOAD_DIR)) fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
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

// ─── 用户列表（管理员） ────────────────────────────────────
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM users ORDER BY total_orders DESC').all()
    .map(u => ({ ...u, phone: u.phone, phoneDisplay: fmtPhone(u.phone) }))
));

// ─── 用户详情 ─────────────────────────────────────────────
router.get('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  if (!user) return makeError('用户不存在', ErrorCode.USER_NOT_FOUND);
  return { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone) };
}));

// ─── 更新用户资料 ──────────────────────────────────────────
router.put('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const { nickname, name, avatar, bio, dormitory, room } = req.body;
  const sets = [];
  const vals = [];
  if (nickname !== undefined) { sets.push('nickname=?'); vals.push(nickname); }
  if (name !== undefined) { sets.push('name=?'); vals.push(name); }
  if (avatar !== undefined) { sets.push('avatar=?'); vals.push(avatar); }
  if (bio !== undefined) { sets.push('bio=?'); vals.push(bio); }
  if (dormitory !== undefined) { sets.push('dormitory=?'); vals.push(dormitory); }
  if (room !== undefined) { sets.push('room=?'); vals.push(room); }
  if (!sets.length) return makeError('无更新内容', ErrorCode.USER_NO_UPDATE);

  vals.push(req.params.phone);
  db.prepare('UPDATE users SET ' + sets.join(',') + ' WHERE phone=?').run(...vals);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  return { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone) };
}));

// ─── 用户头像上传 ──────────────────────────────────────────
router.post('/:phone/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => JSON_RES(res, () => {
  if (!req.file) return makeError('请选择图片', 'PARAM_001');
  const url = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE users SET avatar = ? WHERE phone = ?').run(url, req.params.phone);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  return { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone), avatarUrl: url };
}));

module.exports = router;
