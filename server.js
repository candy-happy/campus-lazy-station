// server.js - 校园圈 v3.0 (模块化架构)
// 本文件只负责启动，所有业务逻辑在 routes/ 目录下
const express = require('express');
const path = require('path');
const config = require('./config');
const { securityHeaders, adminFallback } = require('./middleware/security');
const rateLimit = require('./middleware/rateLimit');
const requestLogger = require('./middleware/requestLogger');
const { optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = config.PORT;

// ─── 基础中间件 ────────────────────────────────────────
app.use(require('compression')()); // gzip/deflate 压缩
app.use(securityHeaders);
app.use(requestLogger); // 请求日志与安全检测
// CORS 配置：限制来源白名单
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = config.CORS_ORIGINS
      ? config.CORS_ORIGINS.split(',').map(s => s.trim())
      : [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost',
          'http://campus-lazy-station.local',
          'http://124.221.67.29',
          'https://124.221.67.29',
          null, // 允许 file:// 等无 origin 的请求
          undefined
        ];
    // 开发环境允许所有来源
    if (config.NODE_ENV === 'development' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};
app.use(require('cors')(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));
app.use(rateLimit());

// ─── 静态文件服务（禁用缓存） ────────────────────────────
app.use(express.static(path.join(__dirname), {
  etag: true,
  maxAge: config.NODE_ENV === 'production' ? 3600000 : 0,
  setHeaders: (res, filePath) => {
    // 统一禁用缓存（生产/开发一致），方便调试和迭代
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// ─── uploads 目录静态服务 ────────────────────────────────
// 先添加路径遍历防护中间件
app.use('/uploads', (req, res, next) => {
  // 防止路径遍历攻击
  if (req.url.includes('..') || req.url.includes('%2e%2e') || req.url.includes('%252e')) {
    return res.status(403).json({ error: '非法路径' });
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d', // 上传文件可缓存7天
  dotfiles: 'ignore', // 忽略隐藏文件
  index: false, // 禁用目录索引（防止目录遍历）
  setHeaders: (res, filePath) => {
    // 为静态资源设置安全头
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 图片/视频文件设置缓存控制
    if (/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// ─── 认证中间件（可选，全局挂载） ──────────────────────────
app.use(optionalAuth);

// ─── 根路径返回宣传页面 ──────────────────────────────────
app.get('/', (req, res) => res.redirect('/app.html'));

// ─── API 路由挂载 ────────────────────────────────────────
// 认证
app.use('/api', require('./routes/auth'));

// 服务
app.use('/api/services', require('./routes/services'));

// 订单
app.use('/api/orders', require('./routes/orders'));

// 骑手
app.use('/api/riders', require('./routes/riders'));

// 用户
app.use('/api/users', require('./routes/users'));

// 优惠券
app.use('/api/coupons', require('./routes/coupons'));

// 积分
app.use('/api/points', require('./routes/points'));

// 地址
app.use('/api/addresses', require('./routes/addresses'));

// 广告
app.use('/api/ads', require('./routes/ads'));

// 通知
app.use('/api/notifications', require('./routes/notifications'));

// 统计
app.use('/api/stats', require('./routes/stats'));

// 管理员
app.use('/api/admins', require('./routes/admins'));

// 校园墙
app.use('/api/wall', require('./routes/wall'));

// 聊天
app.use('/api/chat', require('./routes/chat'));

// 钱包 & 提现
app.use('/api', require('./routes/wallet'));

// GIF
app.use('/api/gif', require('./routes/gif'));

// 二手交易市场
app.use('/api/market', require('./routes/market'));

// AI 内容审核
app.use('/api/ai', require('./routes/ai'));

// 豆包文生图
app.use('/api/ai/image', require('./routes/doubao'));

// 教师评价
app.use('/api/teachers', require('./routes/teachers'));

// 猫狗日记
app.use('/api/pets', require('./routes/pets'));

// 问题反馈
app.use('/api/feedback', require('./routes/feedback'));

// 社团
app.use('/api/clubs', require('./routes/clubs'));

// 活动
app.use('/api/activities', require('./routes/activities'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));

// ─── 404 + SPA 兜底 ───────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在', code: 'SYS_004' });
});
// SPA 兜底：非 API 路径的 GET 请求返回对应 HTML
app.get('*', (req, res) => {
  const fallbacks = { rider: 'rider.html', admin: 'admin.html' };
  for (const [prefix, file] of Object.entries(fallbacks)) {
    if (req.path.startsWith(`/${prefix}`)) return res.sendFile(path.join(__dirname, file));
  }
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  res.sendFile(path.join(__dirname, 'app.html'));
});

// ─── 全局错误处理 ────────────────────────────────────────
app.use((err, req, res, next) => {
  const isDev = config.NODE_ENV === 'development';
  
  // 仅开发环境输出详细错误日志
  if (isDev) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    console.error(err.stack);
  } else {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  }
  
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: '文件上传失败', code: 'SYS_007' });
  }
  
  // CORS错误
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: '跨域请求被拒绝', code: 'SYS_008' });
  }
  
  // 生产环境不泄露详细错误信息
  res.status(500).json({
    error: isDev ? '服务器内部错误: ' + err.message : '服务器内部错误',
    code: 'SYS_001',
    detail: isDev ? { message: err.message, stack: err.stack } : undefined
  });
});

// ─── 数据库优雅关闭 ─────────────────────────────────────
const db = require('./config/database');
function gracefulShutdown(signal) {
  console.log(`\n${signal} 收到信号，正在关闭服务器...`);
  db.close();
  console.log('数据库连接已关闭');
  process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ─── 未捕获异常处理（防止静默崩溃） ────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.message);
  console.error(err.stack);
  // 记录后优雅退出，让 PM2 重启
  gracefulShutdown(err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  // 致命未处理Promise应重启恢复干净状态
  gracefulShutdown(new Error('unhandledRejection: ' + String(reason)));
});

// ─── 确保上传目录存在 ──────────────────────────────────
(() => {
  const fs = require('fs');
  const dirs = ['uploads', 'uploads/wall', 'uploads/market', 'uploads/pets', 'uploads/wall_originals', 'uploads/avatars'];
  for (const d of dirs) {
    const full = path.join(__dirname, d);
    if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); console.log(`[init] 创建目录: ${d}`); }
  }
})();

// ─── 启动 ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦥 校园圈 v3.0 已启动！`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📱 用户端: http://localhost:${PORT}/app.html`);
  console.log(`🚴 骑手端: http://localhost:${PORT}/rider.html`);
  console.log(`🔒 管理端: http://localhost:${PORT}/admin.html`);
  console.log(`📦 架构: 模块化 (${require('fs').readdirSync(path.join(__dirname, 'routes')).length} 个路由模块)\n`);
  console.log('💡 提示: 使用 Ctrl+C 优雅关闭服务器，避免数据库锁问题\n');
});

// ─── uploads 定期清理（每天一次，删除30天前的文件） ─────
(function cleanupUploads() {
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  const walk = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); try { fs.rmdirSync(full); } catch(_){} }
        else if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); cleaned++; }
      }
    } catch(_) {}
  };
  walk(uploadsDir);
  if (cleaned > 0) console.log(`[uploads] 清理了 ${cleaned} 个过期文件`);
  setTimeout(cleanupUploads, 24 * 60 * 60 * 1000);
})();

module.exports = app;
