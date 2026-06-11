// routes/auth.js - 认证路由（用户/骑手/管理员登录）
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { fmtPhone, sanitizeString, isValidPhone } = require('../utils/helpers');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const captcha = require('../utils/captcha');
const crypto = require('crypto');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// ─── 获取图形验证码 ─────────────────────────────────────────
// 用 phone 作为 key，同一手机号一段时间内只能有一个有效验证码
// 限速：每IP每分钟最多 10 次，防止暴力调用耗尽内存
const captchaRateLimit = rateLimit(10, 60 * 1000);
router.get('/captcha', captchaRateLimit, (req, res) => {
  const phone = req.query.phone || 'default';
  const { svg } = captcha.create(phone);
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(svg);
});

// ─── 用户登录 ─────────────────────────────────────────────
// 登录接口严格限速：每IP每分钟最多5次
const loginRateLimit = rateLimit(5, 60 * 1000);

router.post('/user/login', loginRateLimit, (req, res) => JSON_RES(res, () => {
  const { name, phone, captcha: captchaInput, captchaKey } = req.body;
  
  // 输入验证
  if (!phone || !isValidPhone(phone)) return makeError('请输入正确手机号', ErrorCode.USER_PHONE_INVALID);
  const sanitizedName = sanitizeString(name || '同学', 20);

  // 验证码验证
  if (!captchaInput) return makeError('请输入验证码', ErrorCode.PARAM_MISSING);
  const key = captchaKey || phone;
  if (!captcha.verify(key, captchaInput)) return makeError('验证码错误或已过期', ErrorCode.CAPTCHA_INVALID);

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    db.prepare('INSERT INTO users (name, phone) VALUES (?, ?)').run(sanitizedName, phone);
    user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    // 注册奖励积分
    db.prepare('INSERT INTO points (phone, total) VALUES (?, 10)').run(phone);
    db.prepare("INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 10, '注册奖励')").run(phone);
  }

  // 记录登录日志
  db.prepare(`INSERT INTO login_logs (phone, type, ip, user_agent, created_at) VALUES (?, 'user', ?, ?, datetime('now','localtime'))`)
    .run(phone, req.ip || '', req.get('user-agent') || '');

  return {
    ok: true,
    user: { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone) },
    token: generateToken({ type: 'user', phone: user.phone })
  };
}));

// ─── 骑手登录 ─────────────────────────────────────────────
router.post('/rider/login', loginRateLimit, (req, res) => JSON_RES(res, () => {
  const { uid, student_id, phone } = req.body;
  if (!uid) return makeError('请输入UID编号', ErrorCode.PARAM_MISSING);
  if (!student_id) return makeError('请输入学号', ErrorCode.PARAM_MISSING);
  if (!phone || !isValidPhone(phone)) return makeError('请输入正确手机号', ErrorCode.USER_PHONE_INVALID);

  // 骑手必须由管理端创建，不再自动注册
  const rider = db.prepare('SELECT * FROM riders WHERE phone = ?').get(phone);
  if (!rider) return makeError('该手机号未注册为骑手，请联系管理员', ErrorCode.RIDER_NOT_FOUND);

  // 验证UID匹配
  if (rider.uid !== uid) return makeError('UID编号不匹配，请联系管理员', ErrorCode.RIDER_UID_MISMATCH);

  // 验证学号匹配
  if (rider.student_id !== student_id) return makeError('学号不匹配，请联系管理员', ErrorCode.RIDER_STUDENT_MISMATCH);

  // 检查冻结状态
  if (rider.frozen) return makeError('你的账号已被冻结，原因: ' + (rider.frozen_reason || '管理员冻结'), 'RIDER_FROZEN');

  // 登录成功，清除该骑手的token黑名单（允许重新登录）
  db.prepare('DELETE FROM token_blacklist WHERE rider_phone = ?').run(rider.phone);

  return {
    ok: true,
    rider: { ...rider, phone: rider.phone, phoneDisplay: fmtPhone(rider.phone) },
    token: generateToken({ type: 'rider', phone: rider.phone })
  };
}));

// ─── 管理员登录 ───────────────────────────────────────────
// 管理员登录更严格限速：每IP每分钟最多3次
const adminRateLimit = rateLimit(3, 60 * 1000);

router.post('/admin/login', adminRateLimit, (req, res) => JSON_RES(res, () => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) return makeError('账号或密码错误', ErrorCode.FORBIDDEN);
  if (admin.status !== 'active') return makeError('账号已被禁用', ErrorCode.FORBIDDEN);

  let matched = false;
  if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
    matched = bcrypt.compareSync(password, admin.password);
  } else {
    matched = admin.password === password;
    if (matched) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hash, admin.id);
    }
  }
  if (!matched) return makeError('账号或密码错误', ErrorCode.FORBIDDEN);

  return {
    ok: true,
    admin: { ...admin, password: undefined },
    token: generateToken({ type: 'admin', id: admin.id, username: admin.username })
  };
}));

module.exports = router;
