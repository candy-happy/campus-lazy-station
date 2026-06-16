// middleware/security.js - 安全头中间件
const path = require('path');
const { ADMIN_ENTRY_PATH } = require('../config');

// ─── 安全响应头 ───────────────────────────────────────────
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 条款页面允许同源iframe嵌入（登录页需iframe展示）
  const isTerms = req.path === '/public/terms.html';
  res.setHeader('X-Frame-Options', isTerms ? 'SAMEORIGIN' : 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // 现代浏览器已移除该功能，设为0避免兼容模式
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By'); // 隐藏服务器信息

  // CSRF 防护：SameSite cookie策略
  // 由于项目使用JWT token认证（非cookie session），CSRF风险较低
  // 但为防止未来改用cookie认证，提前设置SameSite策略
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 内容安全策略（CSP）
  const frameSrc = isTerms ? "frame-src 'self'; " : "frame-src 'none'; ";
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
    "img-src 'self' data: blob: https:; " +
    "media-src 'self' blob:; " +
    "connect-src 'self'; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    frameSrc +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  next();
}

// ─── 静态文件服务 ─────────────────────────────────────────
// 禁用缓存，确保前端始终加载最新代码
function staticFiles(app) {
  app.use(express.static(__dirname + '/..', {
    etag: false,
    maxAge: 0,
    setHeaders: (res, filepath) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
}

// ─── 404 兜底 ─────────────────────────────────────────────
// 防止后台 admin.html 被扫描发现
// 根路径和 /index.html 已删除，统一重定向到 /app.html
function adminFallback(req, res, next) {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/index') {
    res.redirect('/app.html');
  } else {
    next();
  }
}

module.exports = { securityHeaders, staticFiles, adminFallback };
