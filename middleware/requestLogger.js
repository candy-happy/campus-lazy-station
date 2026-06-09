// middleware/requestLogger.js - 请求日志与异常检测
const fs = require('fs');
const path = require('path');

// 日志目录
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志文件路径
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');

// 可疑IP记录
const suspiciousIPs = new Map();

/**
 * 检测可疑请求模式
 */
function detectSuspicious(req) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // 获取该IP的请求历史
  if (!suspiciousIPs.has(ip)) {
    suspiciousIPs.set(ip, { count: 0, lastRequest: now, blocked: false });
  }
  
  const record = suspiciousIPs.get(ip);
  record.count++;
  record.lastRequest = now;
  
  // 1分钟内超过100次请求，标记为可疑
  if (record.count > 100 && (now - record.lastRequest) < 60000) {
    if (!record.blocked) {
      record.blocked = true;
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip, count: record.count });
    }
    return true;
  }
  
  // 检测路径遍历攻击
  if (req.url.includes('..') || req.url.includes('%2e%2e')) {
    logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', { ip, url: req.url });
    return true;
  }
  
  // 检测SQL注入尝试
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*(--|;|\/\*|\*\/))/i;
  if (sqlPatterns.test(req.url) || sqlPatterns.test(JSON.stringify(req.body || ''))) {
    logSecurityEvent('SQL_INJECTION_ATTEMPT', { ip, url: req.url });
    return true;
  }
  
  // 检测XSS尝试
  const xssPatterns = /(<script|javascript:|on\w+=)/i;
  if (xssPatterns.test(req.url) || xssPatterns.test(JSON.stringify(req.body || ''))) {
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
    fs.appendFile(ACCESS_LOG, logLine, (err) => {
      if (err) console.error('[AccessLog] 写入失败:', err.message);
    });
    
    // 记录慢请求（>1秒）
    if (duration > 1000) {
      console.warn(`[SLOW_REQUEST] ${req.method} ${req.url} took ${duration}ms`);
    }
  });
  
  next();
}

/**
 * 清理过期的可疑IP记录（每5分钟）
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of suspiciousIPs.entries()) {
    // 5分钟内无活动的记录删除
    if (now - record.lastRequest > 300000) {
      suspiciousIPs.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = requestLogger;
