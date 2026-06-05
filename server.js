// server.js - 校园懒人效率站 v3.0 (模块化架构)
// 本文件只负责启动，所有业务逻辑在 routes/ 目录下
const express = require('express');
const path = require('path');
const config = require('./config');
const { securityHeaders, adminFallback } = require('./middleware/security');
const rateLimit = require('./middleware/rateLimit');
const { optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = config.PORT;

// ─── 基础中间件 ────────────────────────────────────────
app.use(securityHeaders);
app.use(require('cors')());
app.use(express.json());
app.use(rateLimit());

// ─── 静态文件服务（禁用缓存） ────────────────────────────
app.use(express.static(path.join(__dirname), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// ─── uploads 目录静态服务 ─────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d', // 上传文件可缓存7天
}));

// ─── 认证中间件（可选，全局挂载） ──────────────────────────
app.use(optionalAuth);

// ─── 根路径重定向 ────────────────────────────────────────
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

// 教师评价
app.use('/api/teachers', require('./routes/teachers'));

// ─── 404 处理 ────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在', code: 'SYS_004' });
});

// ─── 全局错误处理 ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: '文件上传失败: ' + err.message, code: 'SYS_007' });
  }
  res.status(500).json({
    error: '服务器内部错误',
    code: 'SYS_001',
    detail: config.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── 启动 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦥 校园懒人效率站 v3.0 已启动！`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📱 用户端: http://localhost:${PORT}/app.html`);
  console.log(`🚴 骑手端: http://localhost:${PORT}/rider.html`);
  console.log(`🔒 管理端: http://localhost:${PORT}/admin.html`);
  console.log(`👤 总管理员: admin / admin123`);
  console.log(`📦 架构: 模块化 (${require('fs').readdirSync(path.join(__dirname, 'routes')).length} 个路由模块)\n`);
});

module.exports = app;
