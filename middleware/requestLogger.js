// middleware/requestLogger.js - 请求日志与异常检测（分类限流版）
const fs = require('fs');
const path = require('path');

// 日志目录
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const ACCESS_LOG = path.join(LOG_DIR, 'access.log');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');

// ─── 分类限流配置 ─────────────────────────────────────
const RATE_LIMITS = {
  // 登录注册：严格限制（防爆破）
  login: {
    windowMs: 15 * 60 * 1000, // 15分钟窗口
    max: 10,                    // 最多10次
  },
  // 发帖/评论/二手发布：适度限制（防刷屏）
  post: {
    windowMs: 60 * 1000,      // 1分钟窗口
    max: 20,                   // 最多20次
  },
  // 上传文件：限制（已修复，仅API上传接口）
  upload: {
    windowMs: 60 * 1000,
    max: 300,
  },
  // 管理员接口：严格
  admin: {
    windowMs: 60 * 1000,
    max: 60,
  },
  // 普通浏览：宽松
  browse: {
    windowMs: 60 * 1000,
    max: 300,
  }
};

/**
 * 根据 URL 和方法判断限流类型
 */
function getLimitType(req) {
  const url = req.url;
  const method = req.method;

  // 管理员接口
  if (url.includes('/api/admin/')) return 'admin';

  // 登录/注册
  if (url.includes('/login') || url.includes('/register')) return 'login';

  // 内容发布（POST）
  if (method === 'POST' && (
    url.includes('/wall/') ||
    url.includes('/comments') ||
    url.includes('/market/') ||
    url.includes('/pets/') ||
    url.includes('/activities') ||
    url.includes('/clubs')
  )) return 'post';

  // 文件上传（仅API上传接口，不包括静态文件下载）
  if (url.includes('/api/') && url.includes('/upload')) return 'upload';

  // 其余均为浏览
  return 'browse';
}

// ─── 可疑IP记录 ───────────────────────────────────────
// 结构: Map<ip, Map<type, timestamp[]>>
const suspiciousIPs = new Map();

/**
 * 滑动窗口检查（单类型）
 */
function checkSlidingWindow(ip, type, limitConfig, now) {
  if (!suspiciousIPs.has(ip)) {
    suspiciousIPs.set(ip, {});
  }

  const ipData = suspiciousIPs.get(ip);
  if (!ipData[type]) {
    ipData[type] = [];
  }

  const timestamps = ipData[type];

  // 滑动窗口：移除窗口外的时间戳
  while (timestamps.length > 0 && timestamps[0] < now - limitConfig.windowMs) {
    timestamps.shift();
  }

  // 记录当前请求
  timestamps.push(now);

  // 检查是否超限
  if (timestamps.length > limitConfig.max) {
    return { blocked: true, count: timestamps.length, limit: limitConfig.max };
  }

  return { blocked: false, count: timestamps.length, limit: limitConfig.max };
}

/**
 * 检测可疑请求
 */
function detectSuspicious(req) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const type = getLimitType(req);
  const limitConfig = RATE_LIMITS[type];

  const result = checkSlidingWindow(ip, type, limitConfig, now);

  if (result.blocked) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      ip,
      type,
      count: result.count,
      limit: result.limit,
      windowMs: limitConfig.windowMs,
      url: req.url
    });
    return true;
  }

  // ── 安全攻击检测（独立于限流）──────────────────────

  // 路径遍历攻击
  if (req.url.includes('..') || req.url.includes('%2e%2e')) {
    logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', { ip, url: req.url });
    return true;
  }

  // SQL注入检测
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*(--|;|\/\*|\*\/))/i;
  if (sqlPatterns.test(req.url) || sqlPatterns.test(JSON.stringify(req.body || ''))) {
    logSecurityEvent('SQL_INJECTION_ATTEMPT', { ip, url: req.url });
    return true;
  }

  // XSS检测（URL 只检测 <script 和 javascript:，避免 phone= 等参数误杀）
  const xssUrlPattern = /(<script|javascript:)/i;
  const xssBodyPattern = /(<script|javascript:|on\w+\s*=)/i;
  if (xssUrlPattern.test(req.url) || xssBodyPattern.test(JSON.stringify(req.body || ''))) {
    logSecurityEvent('XSS_ATTEMPT', { ip, url: req.url });
    return true;
  }

  return false;
}

/**
 * 记录安全事件
 */
function logSecurityEvent(event, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...details
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFile(SECURITY_LOG, logLine, (err) => {
    if (err) console.error('[SecurityLog] 写入失败:', err.message);
  });

  console.warn(`[SECURITY] ${event}:`, JSON.stringify(details));
}

/**
 * 请求日志中间件
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const ip = req.ip || req.connection.remoteAddress;

  // 检测可疑请求
  if (detectSuspicious(req)) {
    return res.status(403).json({ error: '请求被拒绝', code: 'SECURITY_BLOCKED' });
  }

  // 记录响应完成
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent') || ''
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // 日志轮转：超过10MB自动滚动
    try {
      const stat = fs.statSync(ACCESS_LOG, { throwIfNoEntry: false });
      if (stat && stat.size > 10 * 1024 * 1024) {
        const rotated = ACCESS_LOG.replace('.log', `.${Date.now()}.log`);
        fs.renameSync(ACCESS_LOG, rotated);
      }
    } catch (_) {}

    fs.appendFile(ACCESS_LOG, logLine, (err) => {
      if (err) console.error('[AccessLog] 写入失败:', err.message);
    });

    // 慢请求告警（>1秒）
    if (duration > 1000) {
      console.warn(`[SLOW_REQUEST] ${req.method} ${req.url} took ${duration}ms`);
    }
  });

  next();
}

/**
 * 清理不活跃的IP记录（每5分钟）
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, ipData] of suspiciousIPs.entries()) {
    // 检查所有类型是否都已过期
    let allExpired = true;
    for (const type of Object.keys(ipData)) {
      const limitConfig = RATE_LIMITS[type];
      if (!limitConfig) continue;

      // 保留数组最新时间戳判断整体活跃
      const timestamps = ipData[type];
      if (timestamps.length > 0 && timestamps[timestamps.length - 1] >= now - limitConfig.windowMs) {
        allExpired = false;
        break;
      }
    }
    if (allExpired) {
      suspiciousIPs.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = requestLogger;
