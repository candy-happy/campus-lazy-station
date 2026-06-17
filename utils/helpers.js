// utils/helpers.js - 通用工具函数

// ─── 手机号脱敏 ───────────────────────────────────────────
function fmtPhone(phone) {
  if (!phone) return '';
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

// ─── 手机号脱敏（用于API返回数据） ─────────────────────────
// 将对象中的phone字段替换为脱敏版本，同时保留原始phone为_phone
function maskPhone(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const masked = { ...obj };
  if (masked.phone) {
    masked._phone = masked.phone; // 保留原始值供后端内部使用
    masked.phone = fmtPhone(masked.phone); // 对外显示脱敏
  }
  return masked;
}

// ─── 批量手机号脱敏 ───────────────────────────────────────
function maskPhoneList(list) {
  if (!Array.isArray(list)) return list;
  return list.map(maskPhone);
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

// ─── 文件魔数校验 ──────────────────────────────────────────
// 通过读取文件头部字节验证真实文件类型，防止MIME伪造
const fs = require('fs');

// 常见图片/视频格式的魔数签名
const MAGIC_NUMBERS = {
  // JPEG: FF D8 FF
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  // GIF: 47 49 46 38
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  // WebP: 52 49 46 46 ... 57 45 42 50
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  // MP4: 00 00 00 18 66 74 79 70 (ftyp) 或 00 00 00 20 66 74 79 70
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]],
  // WebM/MKV: 1A 45 DF A3
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
};

function validateFileMagic(filePath, expectedMime) {
  try {
    const signatures = MAGIC_NUMBERS[expectedMime];
    if (!signatures) return true; // 未知类型不拦截

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // 检查是否匹配任一签名
    for (const sig of signatures) {
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) { match = false; break; }
      }
      if (match) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// 允许上传的MIME类型及其对应魔数
const ALLOWED_FILE_TYPES = {
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true,
  'video/mp4': true,
  'video/webm': true,
};

function validateUploadFile(file) {
  if (!ALLOWED_FILE_TYPES[file.mimetype]) {
    return { valid: false, error: '不支持的文件类型' };
  }
  if (!validateFileMagic(file.path, file.mimetype)) {
    return { valid: false, error: '文件内容校验失败，疑似伪造文件类型' };
  }
  return { valid: true };
}

// ─── 输入验证 ──────────────────────────────────────────────
// 手机号格式验证
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// 字符串长度限制（防止超长输入攻击）
function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  // 移除控制字符（保留换行和制表符）
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen);
}

// 数字范围限制
function sanitizeNumber(num, min = 0, max = 999999) {
  const n = Number(num);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// 邮箱格式验证
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 防止路径遍历
function sanitizePath(path) {
  if (typeof path !== 'string') return '';
  return path.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
}

// ─── 图片压缩（上传后自动缩放，最大1200px） ──────────────
let _sharp = null;
try { _sharp = require('sharp'); } catch(e) {}

async function compressImage(filePath, maxSize = 1200) {
  if (!_sharp) return; // sharp 未安装则跳过
  const ext = require('path').extname(filePath).toLowerCase();
  if (!['.jpg','.jpeg','.png','.webp'].includes(ext)) return;
  try {
    const fs = require('fs');
    const st = fs.statSync(filePath);
    if (st.size < 50 * 1024) return; // <50KB 小文件（头像等）跳过
    const img = _sharp(filePath);
    const meta = await img.metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    const tmpPath = filePath + '.tmp';
    if (longest > maxSize) {
      // 超大图：缩尺寸 + JPEG Q80
      await img
        .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toFile(tmpPath);
    } else {
      // 小尺寸但可能大体积（PNG截图等）：仅转 JPEG progressive Q85，不缩尺寸
      await img
        .jpeg({ quality: 85, progressive: true })
        .toFile(tmpPath);
    }
    const stNew = fs.statSync(tmpPath);
    if (stNew.size < st.size) {
      fs.renameSync(tmpPath, filePath);
    } else {
      fs.unlinkSync(tmpPath); // 压缩无效果（如原图已是优化JPEG），保留原文件
    }
  } catch(e) { /* 压缩失败静默跳过，不影响上传 */ }
}

// ─── 视频压缩（上传后自动转码，最大720p/30fps）────────────
const { execSync } = require('child_process');
let _ffmpegOk = null;
function _checkFfmpeg() {
  if (_ffmpegOk !== null) return _ffmpegOk;
  try { execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5000 }); _ffmpegOk = true; } catch { _ffmpegOk = false; }
  return _ffmpegOk;
}

async function compressVideo(filePath) {
  if (!_checkFfmpeg()) return; // ffmpeg 未安装则跳过
  const ext = require('path').extname(filePath).toLowerCase();
  if (!['.mp4','.mov','.webm','.avi','.mkv'].includes(ext)) return;
  try {
    // 先检查原视频大小，<2MB 不压缩
    const { statSync } = require('fs');
    const st = statSync(filePath);
    if (st.size < 2 * 1024 * 1024) return; // <2MB 不压缩

    const tmpPath = filePath + '.tmp.mp4';
    // ffmpeg: 最长边720p, CRF28, 30fps, AAC 128k, fast preset
    execSync(
      `ffmpeg -i "${filePath}" -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" ` +
      `-c:v libx264 -preset fast -crf 28 -r 30 -c:a aac -b:a 128k -movflags +faststart ` +
      `-y "${tmpPath}" 2>&1`,
      { stdio: 'ignore', timeout: 60000 }
    );
    // 压缩后更小才替换，否则保留原文件
    const stNew = statSync(tmpPath);
    if (stNew.size < st.size) {
      require('fs').renameSync(tmpPath, filePath);
    } else {
      require('fs').unlinkSync(tmpPath); // 压缩无效果，删掉临时文件
    }
  } catch(e) { /* 压缩失败静默跳过，不影响上传 */ }
}

module.exports = { fmtPhone, maskPhone, maskPhoneList, genOrderNo, safeJSON, calcRiderLevel, normalizePagination, escHtml, parseImageUrls, validateUploadFile, compressImage, compressVideo, isValidPhone, sanitizeString, sanitizeNumber, isValidEmail, sanitizePath };
