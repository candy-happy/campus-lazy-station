// middleware/rateLimit.js - 滑动窗口限速中间件（内存时间戳数组）
const { RATE_LIMIT_CATEGORIES = {} } = require('../config');

// 分类限流默认配置
const DEFAULTS = {
  login:   { windowMs: 15 * 60 * 1000, max: 10 },   // 登录: 15分钟10次
  post:    { windowMs: 1 * 60 * 1000,  max: 20 },   // 发帖/评论: 1分钟20次
  upload:  { windowMs: 1 * 60 * 1000,  max: 10 },   // 上传: 1分钟10次
  admin:   { windowMs: 1 * 60 * 1000,  max: 60 },   // 管理端: 1分钟60次
  browse:  { windowMs: 1 * 60 * 1000,  max: 300 },  // 浏览: 1分钟300次
};

// 合并配置与默认值
const CATEGORIES = {};
for (const [name, defaults] of Object.entries(DEFAULTS)) {
  CATEGORIES[name] = {
    windowMs: RATE_LIMIT_CATEGORIES[name]?.windowMs || defaults.windowMs,
    max: RATE_LIMIT_CATEGORIES[name]?.max || defaults.max,
  };
}

// 滑动窗口存储: Map<"ip:category", number[]>
const windows = new Map();

// 自动推断请求所属分类
function classify(req) {
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url;

  if (url.includes('/login') || url.includes('/auth/login')) return 'login';
  if (method === 'POST' && (url.includes('/upload') || url.match(/\.(png|jpg|jpeg|gif|webp)/i))) return 'upload';
  if (url.startsWith('/api/admins') || url.startsWith('/api/admin')) return 'admin';
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') return 'post';
  if (method === 'GET') return 'browse';
  return 'post'; // fallback
}

// 定期清理过期条目（每5分钟）
const CLEANUP_MS = 5 * 60 * 1000;
let cleanupTimer = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [key, timestamps] of windows) {
      // 找出该key所有分类中最大的windowMs
      const maxWindow = Math.max(...Object.values(CATEGORIES).map(c => c.windowMs));
      const filtered = timestamps.filter(t => now - t <= maxWindow);
      if (filtered.length === 0) {
        windows.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[RateLimit] 清理 ${removed} 条过期窗口 (当前 ${windows.size} 条)`);
    }
  }, CLEANUP_MS);
  cleanupTimer.unref();
}

/**
 * 创建滑动窗口限速中间件
 * @param {string|number} categoryOrMax - 分类名，或旧API的max数字
 * @param {number} [windowMs] - 旧API的时间窗口（毫秒）
 */
function rateLimit(categoryOrMax, windowMs) {
  // 向后兼容: rateLimit(max, windowMs) 旧式调用
  if (typeof categoryOrMax === 'number') {
    return createLimiter({ max: categoryOrMax, windowMs: windowMs || 60000, category: '__custom' });
  }

  const category = categoryOrMax; // 新式: rateLimit('login') 或 rateLimit()
  return createLimiter(category ? null : null, category);
}

// 内部工厂函数
function createLimiter(overrideConfig, category) {
  startCleanup();
  const isCustom = !!overrideConfig;

  return (req, res, next) => {
    const now = Date.now();

    let cat, max, windowMs;
    if (isCustom) {
      cat = '__custom';
      max = overrideConfig.max;
      windowMs = overrideConfig.windowMs;
    } else {
      cat = category || classify(req);
      const cfg = CATEGORIES[cat] || CATEGORIES.post;
      max = cfg.max;
      windowMs = cfg.windowMs;
    }

    const key = req.ip + ':' + cat;

    // 获取或创建该IP的时间戳数组
    let timestamps = windows.get(key);
    if (!timestamps) {
      timestamps = [];
      windows.set(key, timestamps);
    }

    // 滑动窗口：移除窗口外的旧记录
    const cutoff = now - windowMs;
    const filtered = [];
    for (const t of timestamps) {
      if (t > cutoff) filtered.push(t);
    }
    timestamps.length = 0;
    for (const t of filtered) timestamps.push(t);

    // 检查是否超限
    if (timestamps.length >= max) {
      // 计算最早记录还有多久过期
      const oldest = timestamps[0];
      const retryAfterMs = oldest - cutoff;
      const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));

      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil((oldest + windowMs) / 1000)));
      res.set('X-RateLimit-Category', cat);

      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_001',
        retryAfter,
        category: cat,
      });
    }

    // 记录本次请求
    timestamps.push(now);
    const remaining = max - timestamps.length;

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
    res.set('X-RateLimit-Category', cat);

    next();
  };
}

// 导出命名分类中间件（方便路由中显式使用）
rateLimit.login = () => rateLimit('login');
rateLimit.post = () => rateLimit('post');
rateLimit.upload = () => rateLimit('upload');
rateLimit.admin = () => rateLimit('admin');
rateLimit.browse = () => rateLimit('browse');

module.exports = rateLimit;
