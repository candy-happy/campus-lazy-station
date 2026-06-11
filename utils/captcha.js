// utils/captcha.js - 服务端 SVG 验证码（无依赖库）
const crypto = require('crypto');

// 内存存储，TTL 5分钟
const store = new Map();
const CAPTCHA_TTL = 5 * 60 * 1000;
const CAPTCHA_LENGTH = 4;

// 定期清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) { if (now > v.expires) store.delete(k); }
}, 60 * 1000);

// 生成4位数字验证码
function generate() {
  let code = '';
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

// 生成 SVG 图片（带干扰线和噪点）
function renderSVG(code) {
  const w = 120, h = 44;
  const chars = code.split('');
  const x0 = 16, step = 24;
  
  // 干扰线
  let lines = '';
  for (let i = 0; i < 3; i++) {
    const y1 = 8 + Math.random() * 28;
    const y2 = 8 + Math.random() * 28;
    const x1 = Math.random() * 20;
    const x2 = 80 + Math.random() * 40;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(${150+Math.random()*105},${100+Math.random()*155},${100+Math.random()*155},0.5)" stroke-width="1.5"/>`;
  }
  
  // 噪点
  let dots = '';
  for (let i = 0; i < 20; i++) {
    dots += `<circle cx="${Math.random()*w}" cy="${Math.random()*h}" r="${0.5+Math.random()*0.8}" fill="rgba(0,0,0,0.15)"/>`;
  }
  
  // 字符（旋转+颜色变化）
  let text = '';
  for (let i = 0; i < chars.length; i++) {
    const x = x0 + i * step + (Math.random() - 0.5) * 6;
    const y = 26 + (Math.random() - 0.5) * 10;
    const rot = (Math.random() - 0.5) * 30;
    const hue = 15 + i * 30 + Math.random() * 20;
    text += `<text x="${x}" y="${y}" transform="rotate(${rot},${x},${y})" font-size="${20+Math.random()*6}" font-family="Arial,Helvetica,sans-serif" font-weight="bold" fill="hsl(${hue},70%,40%)">${chars[i]}</text>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" fill="#f8f9fa" rx="6"/>
    ${lines}
    ${dots}
    ${text}
  </svg>`;
}

// 为某个 key 创建验证码，返回 SVG
function create(key) {
  const code = generate();
  store.set(key, { code, expires: Date.now() + CAPTCHA_TTL });
  return { svg: renderSVG(code), code };
}

// 验证
function verify(key, input) {
  const entry = store.get(key);
  if (!entry) return false;
  store.delete(key); // 一次性，用完即删
  if (Date.now() > entry.expires) return false;
  return entry.code === String(input).trim();
}

module.exports = { create, verify };
