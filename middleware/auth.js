// middleware/auth.js - 认证中间件
const { verifyToken } = require('../utils/jwt');
const { ErrorCode } = require('../utils/response');
const db = require('../config/database');
const config = require('../config');

// ─── 登录暴力破解防护 ───────────────────────────────────
const loginFailures = new Map(); // Map<ip, {count, firstFailTime, blockedUntil}>
const BRUTE_FORCE_MAX = 5;       // 5次失败即封
const BRUTE_FORCE_WINDOW = 15 * 60 * 1000; // 15分钟窗口
const BRUTE_FORCE_BLOCK = 15 * 60 * 1000;  // 封15分钟

// 定期清理过期记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginFailures) {
    if (now > record.blockedUntil && now - record.firstFailTime > BRUTE_FORCE_WINDOW) {
      loginFailures.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

// 检查是否已被封禁
function isLoginBlocked(ip) {
  const record = loginFailures.get(ip);
  if (!record) return false;
  const now = Date.now();
  if (record.blockedUntil && now < record.blockedUntil) return true;
  // 窗口过期则自动清除
  if (now - record.firstFailTime > BRUTE_FORCE_WINDOW) {
    loginFailures.delete(ip);
    return false;
  }
  return false;
}

// 获取封禁剩余秒数
function getLoginBlockSeconds(ip) {
  const record = loginFailures.get(ip);
  if (!record || !record.blockedUntil) return 0;
  return Math.ceil((record.blockedUntil - Date.now()) / 1000);
}

// 记录登录失败
function recordLoginFailure(ip) {
  const now = Date.now();
  let record = loginFailures.get(ip);
  if (!record || now - record.firstFailTime > BRUTE_FORCE_WINDOW) {
    record = { count: 0, firstFailTime: now, blockedUntil: 0 };
    loginFailures.set(ip, record);
  }
  record.count++;
  if (record.count >= BRUTE_FORCE_MAX) {
    record.blockedUntil = now + BRUTE_FORCE_BLOCK;
  }
}

// 登录成功清除记录
function clearLoginFailures(ip) {
  loginFailures.delete(ip);
}

// 暴力破解检查中间件（放在登录路由前）
function bruteForceGuard(req, res, next) {
  if (isLoginBlocked(req.ip)) {
    const retryAfter = getLoginBlockSeconds(req.ip);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `登录失败次数过多，请${Math.ceil(retryAfter / 60)}分钟后重试`,
      code: 'AUTH_BRUTE',
      retryAfter
    });
  }
  next();
}

// ─── 骑手冻结缓存 ──────────────────────────────────────
let frozenRiders = new Set();
let frozenCacheTime = 0;
const FROZEN_CACHE_TTL = 30000; // 30秒刷新一次
function getFrozenRiders() {
  if (Date.now() - frozenCacheTime > FROZEN_CACHE_TTL) {
    try {
      const rows = db.prepare('SELECT rider_phone FROM token_blacklist').all();
      frozenRiders = new Set(rows.map(r => r.rider_phone));
      frozenCacheTime = Date.now();
    } catch(e) { /* DB 错误时继续使用旧缓存 */ }
  }
  return frozenRiders;
}

// ─── 通用错误码映射 ──────────────────────────────────────
const AUTH_ERRORS = {
  NO_TOKEN: { code: 'AUTH_001', message: '请先登录' },
  TOKEN_INVALID: { code: 'AUTH_002', message: '登录状态已失效，请重新登录' },
  TOKEN_EXPIRED: { code: 'AUTH_003', message: '登录已过期，请重新登录' },
  ADMIN_REQUIRED: { code: 'AUTH_004', message: '需要管理员权限' },
  USER_TYPE_MISMATCH: { code: 'AUTH_005', message: '用户类型不匹配' },
};

function makeError(res, status, err) {
  return res.status(status).json({ error: err.message, code: err.code });
}

// ─── 可选认证 ─────────────────────────────────────────────
// 解码token并挂载到 req.user，但不断言必须存在
// 后续中间件/路由可自行判断 req.user 是否存在
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload) req.user = payload;
  }
  next();
}

// ─── 强制认证 ─────────────────────────────────────────────
// 必须登录，否则 401
// 同时检查骑手冻结状态（冻结骑手的token会被拉黑）
function requireAuth(req, res, next) {
  if (!req.user) {
    return makeError(res, 401, AUTH_ERRORS.NO_TOKEN);
  }
  // 检查骑手是否被冻结：内存缓存（每30秒刷新）
  if (req.user.type === 'rider' && req.user.phone) {
    if (getFrozenRiders().has(req.user.phone)) {
      return res.status(403).json({
        error: '你的账号已被冻结，即将退出',
        code: 'RIDER_FROZEN',
        frozen: true
      });
    }
  }
  next();
}

// ─── 管理员认证 ───────────────────────────────────────────
// 必须是登录状态 + type === 'admin'
function requireAdmin(req, res, next) {
  // API Key 认证：X-Admin-Key 头匹配即通过
  const apiKey = req.headers['x-admin-key'];
  if (config.ADMIN_API_KEY && apiKey === config.ADMIN_API_KEY) {
    req.user = { type: 'admin', id: 'api-key', username: 'admin' };
    return next();
  }
  // 常规 JWT 认证
  if (!req.user) {
    return makeError(res, 401, AUTH_ERRORS.NO_TOKEN);
  }
  if (req.user.type !== 'admin') {
    return makeError(res, 403, AUTH_ERRORS.ADMIN_REQUIRED);
  }
  next();
}

// ─── 角色约束 ─────────────────────────────────────────────
// 限制只有特定角色可访问（如需区分骑手/用户端权限）
function requireRole(...allowedTypes) {
  return (req, res, next) => {
    if (!req.user) return makeError(res, 401, AUTH_ERRORS.NO_TOKEN);
    if (!allowedTypes.includes(req.user.type)) {
      return makeError(res, 403, AUTH_ERRORS.USER_TYPE_MISMATCH);
    }
    next();
  };
}

// ─── 骑手认证 ─────────────────────────────────────────────
function requireRider(req, res, next) {
  if (!req.user) return makeError(res, 401, AUTH_ERRORS.NO_TOKEN);
  if (req.user.type !== 'rider') return makeError(res, 403, { code: 'AUTH_006', message: '需要骑手权限' });
  next();
}

module.exports = { optionalAuth, requireAuth, requireAdmin, requireRole, requireRider, bruteForceGuard, recordLoginFailure, clearLoginFailures };
