// middleware/auth.js - 认证中间件
const { verifyToken } = require('../utils/jwt');
const { ErrorCode } = require('../utils/response');

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
function requireAuth(req, res, next) {
  if (!req.user) {
    return makeError(res, 401, AUTH_ERRORS.NO_TOKEN);
  }
  next();
}

// ─── 管理员认证 ───────────────────────────────────────────
// 必须是登录状态 + type === 'admin'
function requireAdmin(req, res, next) {
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

module.exports = { optionalAuth, requireAuth, requireAdmin, requireRole, requireRider };
