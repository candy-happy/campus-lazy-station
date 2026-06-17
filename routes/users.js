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



// ─── 管理端：用户搜索（支持搜索） ─────────────────────────
router.get('/search', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { q, page = 1, size = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const siz = Math.min(100, Math.max(1, parseInt(size) || 20));
  const offset = (pageNum - 1) * siz;

  let where = 'WHERE 1=1';
  let params = [];
  if (q && q.trim()) {
    const kw = '%' + q.trim() + '%';
    where += ' AND (phone LIKE ? OR name LIKE ? OR nickname LIKE ? OR student_id LIKE ? OR dormitory LIKE ?)';
    params.push(kw, kw, kw, kw, kw);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM users ${where}`).get(...params).n;
  const list = db.prepare(
    `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, siz, offset);

  return { total, page: pageNum, size: siz, list: list.map(u => ({ ...u, phoneDisplay: fmtPhone(u.phone) })) };
}));

// ─── 管理端：用户数据总览 ────────────────────────────────
router.get('/:phone/summary', requireAdmin, (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return makeError('用户不存在', ErrorCode.USER_NOT_FOUND);

  const counts = {};
  counts.wall_posts = db.prepare('SELECT COUNT(*) as n FROM wall_posts WHERE phone=?').get(phone).n;
  counts.wall_comments = db.prepare('SELECT COUNT(*) as n FROM wall_comments WHERE phone=?').get(phone).n;
  counts.wall_likes = db.prepare('SELECT COUNT(*) as n FROM wall_likes WHERE phone=?').get(phone).n;
  counts.orders = db.prepare('SELECT COUNT(*) as n FROM orders WHERE phone=?').get(phone).n;
  counts.market_items = db.prepare('SELECT COUNT(*) as n FROM market_items WHERE phone=?').get(phone).n;
  counts.pet_sightings = db.prepare('SELECT COUNT(*) as n FROM pet_sightings WHERE phone=?').get(phone).n;
  counts.pet_comments = db.prepare('SELECT COUNT(*) as n FROM pet_comments WHERE phone=?').get(phone).n;
  counts.teacher_reviews = db.prepare('SELECT COUNT(*) as n FROM teacher_reviews WHERE phone=?').get(phone).n;
  counts.teacher_likes = db.prepare('SELECT COUNT(*) as n FROM teacher_likes WHERE phone=?').get(phone).n;
  counts.messages = db.prepare('SELECT COUNT(*) as n FROM messages WHERE sender_phone=?').get(phone).n;
  counts.conversations = db.prepare("SELECT COUNT(*) as n FROM conversations WHERE user1_phone=? OR user2_phone=?").get(phone, phone).n;
  counts.feedback = db.prepare('SELECT COUNT(*) as n FROM feedback WHERE phone=?').get(phone).n;
  counts.reports = db.prepare('SELECT COUNT(*) as n FROM reports WHERE reporter_phone=?').get(phone).n;
  counts.notifications = db.prepare('SELECT COUNT(*) as n FROM notifications WHERE phone=?').get(phone).n;
  counts.following = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE follower_phone=?').get(phone).n;
  counts.followers = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE following_phone=?').get(phone).n;
  counts.blocks = db.prepare('SELECT COUNT(*) as n FROM wall_blocks WHERE blocker_phone=?').get(phone).n;
  counts.blocked_by = db.prepare('SELECT COUNT(*) as n FROM wall_blocks WHERE blocked_phone=?').get(phone).n;
  counts.review_materials = db.prepare('SELECT COUNT(*) as n FROM review_materials WHERE phone=?').get(phone).n;
  try { counts.campus_star = db.prepare('SELECT COUNT(*) as n FROM campus_star WHERE phone=?').get(phone).n; } catch(e) { counts.campus_star = 0; }
  try { counts.club_members = db.prepare('SELECT COUNT(*) as n FROM club_members WHERE phone=?').get(phone).n; } catch(e) { counts.club_members = 0; }

  return { user: { ...user, phoneDisplay: fmtPhone(user.phone) }, counts };
}));

// ─── 管理端：批量删除用户 ─────────────────────────────
router.post('/batch-purge', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { phones } = req.body;
  if (!Array.isArray(phones) || phones.length === 0) return makeError('请选择要删除的用户', 'PARAM_001');
  if (phones.length > 50) return makeError('单次最多删除50个用户', 'PARAM_001');

  const del = (sql, phone) => { try { db.prepare(sql).run(phone); } catch(e) {} };
  const del2 = (sql, phone) => { try { db.prepare(sql).run(phone, phone); } catch(e) {} };

  const results = { success: 0, failed: 0, errors: [] };

  for (const phone of phones) {
    const user = db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone);
    if (!user) { results.failed++; results.errors.push(phone + ': 用户不存在'); continue; }

    try {
      db.transaction(() => {
        del('DELETE FROM wall_exposures WHERE phone=?', phone);
        del('DELETE FROM wall_comment_likes WHERE phone=?', phone);
        del2('DELETE FROM wall_follows WHERE follower_phone=? OR following_phone=?', phone);
        del2('DELETE FROM wall_blocks WHERE blocker_phone=? OR blocked_phone=?', phone);
        del('DELETE FROM wall_likes WHERE phone=?', phone);
        del('DELETE FROM wall_comments WHERE phone=?', phone);
        del('DELETE FROM wall_reports WHERE reporter_phone=?', phone);
        del('DELETE FROM wall_posts WHERE phone=?', phone);
        del('DELETE FROM orders WHERE phone=?', phone);
        del('DELETE FROM market_items WHERE phone=?', phone);
        del('DELETE FROM pet_sightings WHERE phone=?', phone);
        del('DELETE FROM pet_comments WHERE phone=?', phone);
        del('DELETE FROM pet_likes WHERE phone=?', phone);
        del('DELETE FROM teacher_reviews WHERE phone=?', phone);
        del('DELETE FROM teacher_likes WHERE phone=?', phone);
        del2('DELETE FROM conversations WHERE user1_phone=? OR user2_phone=?', phone);
        del('DELETE FROM messages WHERE sender_phone=?', phone);
        del('DELETE FROM feedback WHERE phone=?', phone);
        del('DELETE FROM reports WHERE reporter_phone=?', phone);
        del('DELETE FROM notifications WHERE phone=?', phone);
        del('DELETE FROM ai_review_logs WHERE phone=?', phone);
        del('DELETE FROM review_materials WHERE phone=?', phone);
        del('DELETE FROM campus_star WHERE phone=?', phone);
        del('DELETE FROM club_members WHERE phone=?', phone);
        del('DELETE FROM activity_participants WHERE phone=?', phone);
        del('DELETE FROM points WHERE phone=?', phone);
        del('DELETE FROM point_logs WHERE phone=?', phone);
        del('DELETE FROM wallet WHERE phone=?', phone);
        del('DELETE FROM withdraw_logs WHERE phone=?', phone);
        del('DELETE FROM badges_earned WHERE phone=?', phone);
        del('DELETE FROM login_logs WHERE phone=?', phone);
        del('DELETE FROM ad_views WHERE phone=?', phone);
        del('DELETE FROM ads WHERE phone=?', phone);
        del('DELETE FROM users WHERE phone=?', phone);
      })();
      results.success++;
    } catch(e) {
      results.failed++;
      results.errors.push(phone + ': ' + e.message);
    }
  }
  return { ok: true, results };
}));

// ─── 管理端：删除用户及其所有数据 ───────────────────────
router.delete('/:phone/purge', requireAdmin, (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return makeError('用户不存在', ErrorCode.USER_NOT_FOUND);

  const del = (sql) => db.prepare(sql).run(phone);
  const del2 = (sql) => db.prepare(sql).run(phone, phone);

  const transaction = db.transaction(() => {
    del('DELETE FROM wall_exposures WHERE phone=?');
    del('DELETE FROM wall_comment_likes WHERE phone=?');
    del2('DELETE FROM wall_follows WHERE follower_phone=? OR following_phone=?');
    del2('DELETE FROM wall_blocks WHERE blocker_phone=? OR blocked_phone=?');
    del('DELETE FROM wall_likes WHERE phone=?');
    del('DELETE FROM wall_comments WHERE phone=?');
    del('DELETE FROM wall_reports WHERE reporter_phone=?');
    del('DELETE FROM wall_posts WHERE phone=?');
    del('DELETE FROM orders WHERE phone=?');
    del('DELETE FROM market_items WHERE phone=?');
    del('DELETE FROM pet_sightings WHERE phone=?');
    del('DELETE FROM pet_comments WHERE phone=?');
    try { del('DELETE FROM pet_likes WHERE phone=?'); } catch(e) {}
    del('DELETE FROM teacher_reviews WHERE phone=?');
    del('DELETE FROM teacher_likes WHERE phone=?');
    del2("DELETE FROM conversations WHERE user1_phone=? OR user2_phone=?");
    del('DELETE FROM messages WHERE sender_phone=?');
    del('DELETE FROM feedback WHERE phone=?');
    del('DELETE FROM reports WHERE reporter_phone=?');
    del('DELETE FROM notifications WHERE phone=?');
    del('DELETE FROM ai_review_logs WHERE phone=?');
    try { del('DELETE FROM review_materials WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM campus_star WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM club_members WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM activity_participants WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM points WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM point_logs WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM wallet WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM withdraw_logs WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM badges_earned WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM login_logs WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM ad_views WHERE phone=?'); } catch(e) {}
    try { del('DELETE FROM ads WHERE phone=?'); } catch(e) {}
    del('DELETE FROM users WHERE phone=?');
  });

  transaction();
  return { ok: true, deleted: phone };
}));


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

  const { nickname, name, avatar, bio, dormitory, room, bg_image, bg_color, gender, wechat, qq, show_phone_on_wall, show_wechat_on_wall, show_qq_on_wall, wall_privacy } = req.body;
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
  if (gender !== undefined) { sets.push('gender=?'); vals.push(String(gender).slice(0, 10)); }
  if (wechat !== undefined) { sets.push('wechat=?'); vals.push(String(wechat).slice(0, 50)); }
  if (qq !== undefined) { sets.push('qq=?'); vals.push(String(qq).slice(0, 20)); }
  if (show_phone_on_wall !== undefined) { sets.push('show_phone_on_wall=?'); vals.push(show_phone_on_wall ? 1 : 0); }
  if (show_wechat_on_wall !== undefined) { sets.push('show_wechat_on_wall=?'); vals.push(show_wechat_on_wall ? 1 : 0); }
  if (show_qq_on_wall !== undefined) { sets.push('show_qq_on_wall=?'); vals.push(show_qq_on_wall ? 1 : 0); }
  if (wall_privacy != null) { sets.push('wall_privacy=?'); vals.push(typeof wall_privacy === 'string' ? wall_privacy : JSON.stringify(wall_privacy || {})); }
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
