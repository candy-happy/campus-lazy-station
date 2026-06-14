// routes/auth.js - 认证路由（用户/骑手/管理员登录）
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');
const config = require('../config');
const { generateToken } = require('../utils/jwt');
const { fmtPhone, sanitizeString, isValidPhone } = require('../utils/helpers');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const captcha = require('../utils/captcha');
const crypto = require('crypto');
const { optionalAuth, requireAuth, requireAdmin, bruteForceGuard, recordLoginFailure, clearLoginFailures } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { auditFromReq } = require('../utils/audit');

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

// ─── 用户登录（学号+密码） ────────────────────────────────
// 登录接口严格限速：每IP每分钟最多5次
const loginRateLimit = rateLimit(5, 60 * 1000);

router.post('/user/login', loginRateLimit, (req, res) => JSON_RES(res, () => {
  const { student_id, password, captcha: captchaInput, captchaKey } = req.body;

  // 输入验证
  if (!student_id || !/^\d{9}$/.test(student_id)) return makeError('请输入正确的9位学号', ErrorCode.PARAM_INVALID);
  if (!password) return makeError('请输入密码', ErrorCode.PARAM_MISSING);

  // 验证码验证
  if (!captchaInput) return makeError('请输入验证码', ErrorCode.PARAM_MISSING);
  const key = captchaKey || student_id;
  if (!captcha.verify(key, captchaInput)) return makeError('验证码错误或已过期', ErrorCode.CAPTCHA_INVALID);

  let user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);

  if (!user) {
    // 首次登录 → 自动注册，使用默认密码
    if (password !== 'shoujihao') return makeError('账号不存在，首次登录请使用默认密码 shoujihao', ErrorCode.PASSWORD_WRONG);

    const defaultHash = bcrypt.hashSync('shoujihao', 10);
    db.prepare('INSERT INTO users (name, phone, student_id, password) VALUES (?, ?, ?, ?)')
      .run('同学', student_id, student_id, defaultHash);
    user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);

    // 注册奖励积分（用 student_id 代替 phone）
    try { db.prepare('INSERT INTO points (phone, total) VALUES (?, 10)').run(student_id); } catch(e) {}
    try { db.prepare("INSERT INTO point_logs (phone, type, amount, description) VALUES (?, 'earn', 10, '注册奖励')").run(student_id); } catch(e) {}

    // 记录登录日志
    db.prepare(`INSERT INTO login_logs (phone, type, ip, user_agent, created_at) VALUES (?, 'user', ?, ?, datetime('now','localtime'))`)
      .run(student_id, req.ip || '', req.get('user-agent') || '');

    return {
      ok: true,
      user: { ...user, password: undefined },
      token: generateToken({ type: 'user', student_id: user.student_id, phone: user.phone || '' }),
      isNewUser: true
    };
  }

  // 已有账号 → 验证密码
  if (!user.password) {
    // 老用户还没有设置密码 → 首次迁移，使用默认密码验证
    if (password !== 'shoujihao') return makeError('密码错误', ErrorCode.FORBIDDEN);
    // 自动给老用户设置默认密码hash
    const defaultHash = bcrypt.hashSync('shoujihao', 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(defaultHash, user.id);
    user.password = defaultHash;
  }

  const matched = bcrypt.compareSync(password, user.password);
  if (!matched) return makeError('密码错误', ErrorCode.FORBIDDEN);

  // 记录登录日志
  db.prepare(`INSERT INTO login_logs (phone, type, ip, user_agent, created_at) VALUES (?, 'user', ?, ?, datetime('now','localtime'))`)
    .run(user.student_id || user.phone || '', req.ip || '', req.get('user-agent') || '');

  return {
    ok: true,
    user: { ...user, password: undefined },
    token: generateToken({ type: 'user', student_id: user.student_id, phone: user.phone || '' })
  };
}));

// ─── 验证旧密码 ───────────────────────────────────────────
router.post('/user/verify-password', requireAuth, (req, res) => JSON_RES(res, () => {
  const { oldPassword } = req.body;
  if (!oldPassword) return makeError('请输入旧密码', ErrorCode.PARAM_MISSING);

  const student_id = req.user.student_id;
  if (!student_id) return makeError('当前账号未绑定学号', ErrorCode.FORBIDDEN);

  const user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);
  if (!user) return makeError('用户不存在', ErrorCode.USER_NOT_FOUND);

  let matched = false;
  if (user.password) {
    matched = bcrypt.compareSync(oldPassword, user.password);
  } else {
    matched = (oldPassword === 'shoujihao');
  }
  return { ok: true, valid: matched };
}));

// ─── 修改密码 ─────────────────────────────────────────────
router.post('/user/change-password', requireAuth, (req, res) => JSON_RES(res, () => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return makeError('请输入旧密码和新密码', ErrorCode.PARAM_MISSING);
  if (newPassword.length < 6) return makeError('新密码长度至少6位', ErrorCode.PARAM_INVALID);
  if (oldPassword === newPassword) return makeError('新密码不能与旧密码相同', ErrorCode.PARAM_INVALID);

  const student_id = req.user.student_id;
  if (!student_id) return makeError('当前账号未绑定学号，无法修改密码', ErrorCode.FORBIDDEN);

  const user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);
  if (!user) return makeError('用户不存在', ErrorCode.USER_NOT_FOUND);

  // 验证旧密码
  let matched = false;
  if (user.password) {
    matched = bcrypt.compareSync(oldPassword, user.password);
  } else {
    // 老用户未设置密码 → 默认密码
    matched = (oldPassword === 'shoujihao');
  }
  if (!matched) return makeError('旧密码不正确', ErrorCode.FORBIDDEN);

  // 更新密码
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);

  return { ok: true, message: '密码修改成功' };
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
// 暴力破解防护：5次失败封IP 15分钟 + 频率限速

router.post('/admin/login', bruteForceGuard, (req, res) => JSON_RES(res, () => {
  const { username, password, api_key } = req.body;

  // ── API Key 登录（优先） ──
  if (api_key) {
    if (!config.ADMIN_API_KEY) {
      recordLoginFailure(req.ip);
      return makeError('服务器未配置管理密钥', ErrorCode.FORBIDDEN);
    }
    if (api_key !== config.ADMIN_API_KEY) {
      recordLoginFailure(req.ip);
      return makeError('管理密钥无效', ErrorCode.FORBIDDEN);
    }
    clearLoginFailures(req.ip);
    auditFromReq(req, 'admin.login', { type: 'admin' }, 'API密钥登录');
    return {
      ok: true,
      admin: { id: 'key', username: 'admin', role: 'super' },
      token: generateToken({ type: 'admin', id: 'key', username: 'admin', role: 'super' })
    };
  }

  // ── 传统用户名密码登录 ──
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) {
    recordLoginFailure(req.ip);
    return makeError('账号或密码错误', ErrorCode.FORBIDDEN);
  }
  if (admin.status !== 'active') {
    recordLoginFailure(req.ip);
    return makeError('账号已被禁用', ErrorCode.FORBIDDEN);
  }

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
  if (!matched) {
    recordLoginFailure(req.ip);
    return makeError('账号或密码错误', ErrorCode.FORBIDDEN);
  }

  clearLoginFailures(req.ip);
  return {
    ok: true,
    admin: { ...admin, password: undefined },
    token: generateToken({ type: 'admin', id: admin.id, username: admin.username })
  };
}));

module.exports = router;
