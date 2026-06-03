// routes/auth.js - 认证路由（用户/骑手/管理员登录）
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { fmtPhone } = require('../utils/helpers');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { optionalAuth, requireAdmin } = require('../middleware/auth');

// ─── 用户登录 ─────────────────────────────────────────────
router.post('/user/login', (req, res) => JSON_RES(res, () => {
  const { name, phone } = req.body;
  if (!phone || phone.length !== 11) return makeError('请输入正确手机号', ErrorCode.USER_PHONE_INVALID);

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    db.prepare('INSERT INTO users (name, phone) VALUES (?, ?)').run(name || '同学', phone);
    user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    // 注册奖励积分
    db.prepare('INSERT INTO points (phone, total) VALUES (?, 10)').run(phone);
    db.prepare("INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 10, '注册奖励')").run(phone);
  }

  return {
    ok: true,
    user: { ...user, phone: user.phone, phoneDisplay: fmtPhone(user.phone) },
    token: generateToken({ type: 'user', phone: user.phone })
  };
}));

// ─── 骑手登录 ─────────────────────────────────────────────
router.post('/rider/login', (req, res) => JSON_RES(res, () => {
  const { uid, student_id, phone } = req.body;
  if (!uid) return makeError('请输入UID编号', ErrorCode.PARAM_MISSING);
  if (!student_id) return makeError('请输入学号', ErrorCode.PARAM_MISSING);
  if (!phone || phone.length !== 11) return makeError('请输入正确手机号', ErrorCode.USER_PHONE_INVALID);

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
router.post('/admin/login', (req, res) => JSON_RES(res, () => {
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
