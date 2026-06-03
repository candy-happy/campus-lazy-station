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

// ─── 生成唯一UID ──────────────────────────────────────────
function generateUid() {
  // 查找所有R开头的UID，取最大数字编号
  const rows = db.prepare("SELECT uid FROM riders WHERE uid GLOB 'R[0-9]*'").all();
  let maxNum = 0;
  rows.forEach(r => {
    const num = parseInt(r.uid.replace(/^R/, ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  });
  return 'R' + String(maxNum + 1).padStart(3, '0');
}

// ─── 骑手列表（管理员） ────────────────────────────────────
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM riders ORDER BY total_orders DESC').all()
    .map(r => ({ ...r, phone: r.phone, phoneDisplay: fmtPhone(r.phone) }))
));

// ─── 检查UID是否已存在 ─────────────────────────────────────
router.get('/check-uid/:uid', requireAdmin, (req, res) => JSON_RES(res, () => {
  const existing = db.prepare('SELECT id FROM riders WHERE uid = ?').get(req.params.uid);
  return { exists: !!existing };
}));

// ─── 骑手冻结状态检查（骑手端轮询用，不需要admin） ────────────
router.get('/frozen-check/:phone', (req, res) => {
  const rider = db.prepare('SELECT frozen, frozen_reason FROM riders WHERE phone = ?').get(req.params.phone);
  if (!rider) return res.json({ frozen: false });
  return res.json({ frozen: !!rider.frozen, frozen_reason: rider.frozen_reason || null });
});

// ─── 管理员创建骑手 ────────────────────────────────────────
router.post('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { name, student_id, phone, dormitory } = req.body;
  if (!name) return makeError('请输入骑手姓名', 'PARAM_001');
  if (!phone || phone.length !== 11) return makeError('请输入正确的11位手机号', 'PARAM_002');

  // 检查手机号是否已存在
  const existing = db.prepare('SELECT id, uid FROM riders WHERE phone = ?').get(phone);
  if (existing) return makeError('该手机号已注册为骑手(UID: ' + existing.uid + ')', 'RIDER_002');

  const uid = generateUid();
  db.prepare("INSERT INTO riders (uid, name, student_id, phone, dormitory, status, frozen, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))")
    .run(uid, name, student_id || '', phone, dormitory || '', 'offline');

  const rider = db.prepare('SELECT * FROM riders WHERE uid = ?').get(uid);
  return { ok: true, rider: { ...rider, phone: rider.phone, phoneDisplay: fmtPhone(rider.phone) } };
}));

// ─── 冻结骑手 ──────────────────────────────────────────────
router.put('/:id/freeze', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { reason } = req.body;
  const rider = db.prepare('SELECT * FROM riders WHERE id = ?').get(req.params.id);
  if (!rider) return makeError('骑手不存在', ErrorCode.RIDER_NOT_FOUND);
  if (rider.frozen) return makeError('该骑手已被冻结', 'RIDER_003');

  db.prepare('UPDATE riders SET frozen = 1, frozen_reason = ?, status = ? WHERE id = ?')
    .run(reason || '管理员冻结', 'frozen', req.params.id);

  // 将该骑手手机号对应的所有token加入黑名单（使其几秒内退出）
  // JWT中存储的是 phone 字段
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO token_blacklist (token, rider_phone, created_at) VALUES (?, ?, ?)')
    .run('__phone__:' + rider.phone, rider.phone, now);

  const updated = db.prepare('SELECT * FROM riders WHERE id = ?').get(req.params.id);
  return { ok: true, rider: { ...updated, phoneDisplay: fmtPhone(updated.phone) } };
}));

// ─── 解冻骑手 ──────────────────────────────────────────────
router.put('/:id/unfreeze', requireAdmin, (req, res) => JSON_RES(res, () => {
  const rider = db.prepare('SELECT * FROM riders WHERE id = ?').get(req.params.id);
  if (!rider) return makeError('骑手不存在', ErrorCode.RIDER_NOT_FOUND);
  if (!rider.frozen) return makeError('该骑手未冻结', 'RIDER_004');

  db.prepare('UPDATE riders SET frozen = 0, frozen_reason = NULL, status = ? WHERE id = ?')
    .run('offline', req.params.id);

  // 清除该骑手的token黑名单
  db.prepare('DELETE FROM token_blacklist WHERE rider_phone = ?').run(rider.phone);

  const updated = db.prepare('SELECT * FROM riders WHERE id = ?').get(req.params.id);
  return { ok: true, rider: { ...updated, phoneDisplay: fmtPhone(updated.phone) } };
}));

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
