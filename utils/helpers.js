// utils/helpers.js - 通用工具函数

// ─── 手机号脱敏 ───────────────────────────────────────────
function fmtPhone(phone) {
  if (!phone) return '';
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

// ─── 订单号生成 ───────────────────────────────────────────
function genOrderNo() {
  return 'ORD' + Date.now().toString(36).toUpperCase().slice(-8);
}

// ─── 安全 JSON 解析 ────────────────────────────────────────
function safeJSON(str) {
  if (!str) return [];
  try { return JSON.parse(str); } catch { return []; }
}

// ─── 骑手等级更新 ──────────────────────────────────────────
const RIDER_LEVELS = [
  { min: 100, level: 'diamond' },
  { min: 50, level: 'gold' },
  { min: 20, level: 'silver' },
  { min: 0, level: 'bronze' },
];

function calcRiderLevel(totalOrders) {
  for (const { min, level } of RIDER_LEVELS) {
    if (totalOrders >= min) return level;
  }
  return 'bronze';
}

// ─── 分页参数标准化 ────────────────────────────────────────
function normalizePagination(query, defaultLimit = 20, maxLimit = 50) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxLimit, parseInt(query.limit) || defaultLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ─── XSS 转义 ──────────────────────────────────────────────
function escHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 图片/视频 URL 解析 ─────────────────────────────────────
function parseImageUrls(imagesStr) {
  if (!imagesStr) return [];
  return imagesStr.split(',').filter(Boolean).map(url => ({
    url,
    isVideo: /\.mp4|\.mov|\.webm/i.test(url)
  }));
}

module.exports = { fmtPhone, genOrderNo, safeJSON, calcRiderLevel, normalizePagination, escHtml, parseImageUrls };
