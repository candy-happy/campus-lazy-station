// middleware/security.js - 安全头中间件
const path = require('path');
const { ADMIN_ENTRY_PATH } = require('../config');

// ─── 安全响应头 ───────────────────────────────────────────
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By'); // 隐藏服务器信息
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
// 如果请求不是以 /admin.html 结尾，返回 index.html（前端路由兜底）
// 注意：这里不直接暴露 admin.html 路径，只在显式请求时提供
function adminFallback(req, res, next) {
  if (req.path === '/' || req.path === '/index.html') {
    res.redirect('/app.html');
  } else {
    next();
  }
}

module.exports = { securityHeaders, staticFiles, adminFallback };
