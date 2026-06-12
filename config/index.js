// config/index.js - 环境配置中心
// 所有配置集中管理，支持 .env 文件覆盖默认值
require('dotenv').config && require('dotenv').config();

module.exports = {
  // 服务器
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // 数据库
  DB_PATH: process.env.DB_PATH || require('path').join(__dirname, '..', 'lazy_station.db'),

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || (() => {
    // 生产环境必须设置 JWT_SECRET，否则抛出错误
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 JWT_SECRET 环境变量');
    }
    // 开发环境使用默认值，但输出警告
    console.warn('⚠️  警告: 使用默认 JWT_SECRET，生产环境请务必在 .env 中设置');
    return 'campus-lazy-secret-2026';
  })(),
  JWT_EXPIRES_MS: 86400000, // 24小时

  // 文件上传
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  ALLOWED_FILE_TYPES: ['image/', 'video/'],

  // 限速（分类限流，可在 .env 中覆盖）
  RATE_LIMIT_CATEGORIES: {
    login:  { windowMs: 15 * 60 * 1000, max: parseInt(process.env.RATE_LOGIN_MAX)  || 10 },
    post:   { windowMs: 1 * 60 * 1000,  max: parseInt(process.env.RATE_POST_MAX)   || 20 },
    upload: { windowMs: 1 * 60 * 1000,  max: parseInt(process.env.RATE_UPLOAD_MAX) || 10 },
    admin:  { windowMs: 1 * 60 * 1000,  max: parseInt(process.env.RATE_ADMIN_MAX)  || 60 },
    browse: { windowMs: 1 * 60 * 1000,  max: parseInt(process.env.RATE_BROWSE_MAX) || 300 },
  },

  // 上传子目录
  WALL_UPLOAD_DIR: 'wall',

  // 管理端入口路径（安全：隐藏后台入口）
  ADMIN_ENTRY_PATH: 'admin.html',

  // CORS 白名单（生产环境可配置。默认空字符串让 server.js 走硬编码兜底）
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
};
