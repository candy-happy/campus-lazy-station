// middleware/rateLimit.js - 限速中间件（基于SQLite持久化）
const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('../config');
const db = require('../config/database');

// 创建限速记录表（如果不存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    reset_at TEXT NOT NULL
  )
`);

// 定期清理过期记录（每5分钟）
let cleanupInterval = null;
function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    try {
      const result = db.prepare("DELETE FROM rate_limits WHERE reset_at < datetime('now','localtime')").run();
      if (result.changes > 0) {
        console.log(`[RateLimit] 清理 ${result.changes} 条过期记录`);
      }
    } catch (e) {
      console.error('[RateLimit] 清理失败:', e.message);
    }
  }, 5 * 60 * 1000);
  cleanupInterval.unref(); // 不阻止进程退出
}

/**
 * 创建限速中间件
 * @param {number} max - 时间窗口内最大请求数
 * @param {number} windowMs - 时间窗口毫秒数
 */
function rateLimit(max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
  // 启动清理定时器
  startCleanup();

  return (req, res, next) => {
    const key = req.ip + ':' + Math.floor(Date.now() / windowMs);
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);
    const resetAtStr = resetAt.toISOString().replace('T', ' ').slice(0, 19);

    try {
      // 使用事务保证原子性
      const result = db.transaction(() => {
        // 获取或创建记录
        let record = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key);

        if (!record || record.reset_at < now.toISOString().slice(0, 19)) {
          // 窗口过期，重置计数
          db.prepare(
            "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = ?"
          ).run(key, resetAtStr, resetAtStr);
          return { count: 1, allowed: true };
        }

        // 窗口内，增加计数
        const newCount = record.count + 1;
        db.prepare('UPDATE rate_limits SET count = ? WHERE key = ?').run(newCount, key);

        if (newCount > max) {
          return { count: newCount, allowed: false, remaining: 0 };
        }

        return { count: newCount, allowed: true, remaining: max - newCount };
      })();

      // 设置响应头
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(result.remaining !== undefined ? result.remaining : Math.max(0, max - result.count)));
      res.set('X-RateLimit-Reset', String(Math.ceil(resetAt.getTime() / 1000)));

      if (!result.allowed) {
        return res.status(429).json({
          error: '请求过于频繁，请稍后再试',
          code: 'RATE_001',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    } catch (e) {
      // 数据库异常时降级到放行，避免影响正常请求
      console.error('[RateLimit] 数据库异常:', e.message);
      next();
    }
  };
}

module.exports = rateLimit;
