// middleware/rateLimit.js - 限速中间件
const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('../config');

const rateMaps = new Map();

/**
 * 创建限速中间件
 * @param {number} max - 时间窗口内最大请求数
 * @param {number} windowMs - 时间窗口毫秒数
 */
function rateLimit(max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
  return (req, res, next) => {
    const key = req.ip + ':' + Math.floor(Date.now() / windowMs);
    const count = (rateMaps.get(key) || 0) + 1;
    rateMaps.set(key, count);

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

    if (count > max) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_001',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    next();
  };
}

// 清理过期记录（每小时执行一次）
setInterval(() => {
  const now = Date.now();
  const currentWindow = Math.floor(now / RATE_LIMIT_WINDOW_MS);
  // 保留当前窗口和前一个窗口，删除更早的
  for (const [key] of rateMaps) {
    const keyWindow = parseInt(key.split(':').pop());
    if (currentWindow - keyWindow > 1) {
      rateMaps.delete(key);
    }
  }
}, 3600000);

module.exports = rateLimit;
