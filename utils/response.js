// utils/response.js - 统一响应与错误码体系

// ─── 业务错误码定义 ──────────────────────────────────────
// 格式: 模块_序号，方便定位
const ErrorCode = {
  // 通用 1xxx
  SUCCESS: 'OK',
  UNKNOWN_ERROR: 'SYS_001',
  PARAM_MISSING: 'SYS_002',
  PARAM_INVALID: 'SYS_003',
  NOT_FOUND: 'SYS_004',
  DUPLICATE: 'SYS_005',
  FORBIDDEN: 'SYS_006',

  // 认证 AUTH_xxx (见 middleware/auth.js)
  // 订单 ORD_xxx
  ORDER_NOT_FOUND: 'ORD_001',
  ORDER_STATUS_INVALID: 'ORD_002',
  ORDER_CANNOT_ACCEPT: 'ORD_003',
  ORDER_CANNOT_CANCEL: 'ORD_004',
  ORDER_NOT_COMPLETED: 'ORD_005',

  // 骑手 RID_xxx
  RIDER_NOT_FOUND: 'RID_001',
  RIDER_UID_MISMATCH: 'RID_002',
  RIDER_LEVEL_UPDATE: 'RID_003',
  RIDER_STUDENT_MISMATCH: 'RID_004',

  // 用户 USR_xxx
  USER_NOT_FOUND: 'USR_001',
  USER_PHONE_INVALID: 'USR_002',
  USER_NO_UPDATE: 'USR_003',

  // 优惠券 CUP_xxx
  COUPON_NOT_FOUND: 'CUP_001',
  COUPON_EXPIRED: 'CUP_002',
  COUPON_CLAIMED: 'CUP_003',

  // 钱包 WAL_xxx
  WALLET_INSUFFICIENT: 'WAL_001',
  WALLET_AMOUNT_INVALID: 'WAL_002',
  WALLET_ALREADY_PROCESSED: 'WAL_003',

  // 校园墙 WALL_xxx
  WALL_POST_NOT_FOUND: 'WALL_001',
  WALL_CANNOT_FOLLOW_SELF: 'WALL_002',

  // 聊天 CHAT_xxx
  CHAT_PARAM_INCOMPLETE: 'CHAT_001',
  CHAT_PRIVACY_BLOCKED: 'CHAT_002',

  // 限速 RATE_xxx (见 middleware/rateLimit.js)

  // AI审核 AI_xxx
  AI_VIOLATION: 'AI_001',
};

// ─── JSON 响应包装 ─────────────────────────────────────────
// 统一错误格式: { error: string, code: string }
// 统一成功格式: { ok: true, ...data }
function JSON_RES(res, fn) {
  try {
    const result = fn();
    // 如果返回对象包含 error 字段，视为业务错误
    if (result && result.error) {
      const code = result.code || ErrorCode.UNKNOWN_ERROR;
      return res.status(result.status || 400).json({ error: result.error, code });
    }
    res.json(result);
  } catch (e) {
    // 生产环境不泄露详细错误信息
    const isDev = process.env.NODE_ENV === 'development';
    
    // 仅开发环境输出详细错误日志
    if (isDev) {
      console.error(`[ERROR] ${e.message}`, e.stack);
    } else {
      console.error(`[ERROR] ${e.message}`);
    }
    
    res.status(500).json({
      error: isDev ? '服务器内部错误: ' + e.message : '服务器内部错误',
      code: ErrorCode.UNKNOWN_ERROR,
      detail: isDev ? { message: e.message, stack: e.stack } : undefined
    });
  }
}

// ─── 快捷错误构造 ─────────────────────────────────────────
function makeError(message, code, status) {
  return { error: message, code: code || ErrorCode.UNKNOWN_ERROR, status: status || 400 };
}

function notFound(message) {
  return { error: message || '资源不存在', code: ErrorCode.NOT_FOUND, status: 404 };
}

module.exports = { ErrorCode, JSON_RES, makeError, notFound };
