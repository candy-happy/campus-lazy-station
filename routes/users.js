// routes/users.js - 用户路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone } = require('../utils/helpers');
const { withCompress } = require('../utils/upload');
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
  
  // 隐私保护：只有用户本人或管理员可以看到完整手机号
  const isOwner = req.user.phone === user.phone;
  const isAdmin = req.user.type === 'admin';
  
  if (isOwner || isAdmin) {
    return { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone) };
  } else {
    // 对其他用户隐藏完整手机号
    const { phone, ...rest } = user;
    return { ...rest, phoneDisplay: fmtPhone(user.phone) };
  }
}));

// ─── 更新用户资料 ──────────────────────────────────────────
router.put('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  // IDOR防护：只能修改自己的资料（管理员除外）
  if (req.user.type !== 'admin' && req.user.phone !== req.params.phone) {
    return makeError('无权修改他人资料', 'FORBIDDEN');
  }

  const { nickname, name, avatar, bio, dormitory, room, bg_image, bg_color, wechat, qq, show_phone_on_wall, show_wechat_on_wall, show_qq_on_wall, wall_privacy } = req.body;
  const sets = [];
  const vals = [];
  if (nickname !== undefined) { sets.push('nickname=?'); vals.push(String(nickname).slice(0, 50)); }
  if (name !== undefined) { sets.push('name=?'); vals.push(String(name).slice(0, 50)); }
  if (avatar !== undefined) { sets.push('avatar=?'); vals.push(String(avatar).slice(0, 255)); }
  if (bio !== undefined) { sets.push('bio=?'); vals.push(String(bio).slice(0, 500)); }
  if (dormitory !== undefined) { sets.push('dormitory=?'); vals.push(String(dormitory).slice(0, 100)); }
  if (room !== undefined) { sets.push('room=?'); vals.push(String(room).slice(0, 20)); }
  if (bg_image !== undefined) { sets.push('bg_image=?'); vals.push(String(bg_image).slice(0, 500)); }
  if (bg_color !== undefined) { sets.push('bg_color=?'); vals.push(String(bg_color).slice(0, 20)); }
  if (wechat !== undefined) { sets.push('wechat=?'); vals.push(String(wechat).slice(0, 50)); }
  if (qq !== undefined) { sets.push('qq=?'); vals.push(String(qq).slice(0, 20)); }
  if (show_phone_on_wall !== undefined) { sets.push('show_phone_on_wall=?'); vals.push(show_phone_on_wall ? 1 : 0); }
  if (show_wechat_on_wall !== undefined) { sets.push('show_wechat_on_wall=?'); vals.push(show_wechat_on_wall ? 1 : 0); }
  if (show_qq_on_wall !== undefined) { sets.push('show_qq_on_wall=?'); vals.push(show_qq_on_wall ? 1 : 0); }
  if (wall_privacy !== undefined) { sets.push('wall_privacy=?'); vals.push(typeof wall_privacy === 'string' ? wall_privacy : JSON.stringify(wall_privacy)); }
  if (!sets.length) return makeError('无更新内容', ErrorCode.USER_NO_UPDATE);

  vals.push(req.params.phone);
  db.prepare('UPDATE users SET ' + sets.join(',') + ' WHERE phone=?').run(...vals);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  return { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone) };
}));

// ─── 用户头像上传 ──────────────────────────────────────────
router.post('/:phone/avatar', requireAuth, withCompress(avatarUpload.single('avatar')), (req, res) => JSON_RES(res, () => {
  // IDOR防护：只能上传自己的头像（管理员除外）
  if (req.user.type !== 'admin' && req.user.phone !== req.params.phone) {
    return makeError('无权修改他人资料', 'FORBIDDEN');
  }
  if (!req.file) return makeError('请选择图片', 'PARAM_001');
  const url = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE users SET avatar = ? WHERE phone = ?').run(url, req.params.phone);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  return { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone), avatarUrl: url };
}));

// ─── 封面图上传配置 ──────────────────────────────────────
const BG_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'covers');
if (!fs.existsSync(BG_UPLOAD_DIR)) fs.mkdirSync(BG_UPLOAD_DIR, { recursive: true });

const bgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BG_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'cover-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const bgUpload = multer({
  storage: bgStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

// ─── 封面图上传 ──────────────────────────────────────────
router.post('/:phone/cover', requireAuth, withCompress(bgUpload.single('cover')), (req, res) => JSON_RES(res, () => {
  if (req.user.type !== 'admin' && req.user.phone !== req.params.phone) {
    return makeError('无权修改他人资料', 'FORBIDDEN');
  }
  if (!req.file) return makeError('请选择图片', 'PARAM_001');
  const url = '/uploads/covers/' + req.file.filename;
  db.prepare('UPDATE users SET bg_image = ? WHERE phone = ?').run(url, req.params.phone);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(req.params.phone);
  return { ...user, phone: user.phone, bgImageUrl: url };
}));

module.exports = router;
