// middleware/requestLogger.js - 请求日志与安全攻击检测
const fs = require('fs');
const path = require('path');

// 日志目录
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const ACCESS_LOG = path.join(LOG_DIR, 'access.log');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');

// ⚠️ 限流已统一由 middleware/rateLimit.js 处理，本文件只做安全攻击检测

/**
 * 检测安全攻击（路径遍历 / SQL注入 / XSS）
 */
function detectSuspicious(req) {
  const ip = req.ip || req.connection.remoteAddress;

  // 路径遍历攻击
  if (req.url.includes('..') || req.url.includes('%2e%2e')) {
    logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', { ip, url: req.url });
    return true;
  }

  // SQL注入检测（仅检查 URL，不再检查 body 避免误杀合法帖子内容）
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*(--|;|\/\*|\*\/))/i;
  if (sqlPatterns.test(req.url)) {
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

module.exports = requestLogger;
