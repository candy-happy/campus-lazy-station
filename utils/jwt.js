// utils/jwt.js - Token 生成与验证（HMAC-SHA256 签名）
const crypto = require('crypto');
const { JWT_SECRET, JWT_EXPIRES_MS } = require('../config');

function base64urlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function generateToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payloadWithExp = {
    ...payload,
    exp: Date.now() + JWT_EXPIRES_MS
  };
  
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payloadWithExp));
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');

    // 旧格式Token（只有2部分）不再接受，强制要求签名验证
    if (parts.length === 2) {
      console.warn('[JWT] 拒绝旧格式无签名Token');
      return null;
    }

    // 新格式Token：3部分，有签名
    if (parts.length === 3) {
      const [headerB64, payloadB64, signature] = parts;

      // 验证签名（恒定时间比较，防止时序攻击）
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (signature.length !== expectedSignature.length) return null;
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;

      // 验证header算法
      const header = JSON.parse(base64urlDecode(headerB64));
      if (header.alg !== 'HS256') return null;

      const data = JSON.parse(base64urlDecode(payloadB64));

      // 验证过期时间
      if (data.exp && data.exp < Date.now()) return null;

      // 验证必要字段（管理员token没有phone字段）
      if (!data.type) return null;
      if (data.type !== 'admin' && !data.phone) return null;

      return data;
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = { generateToken, verifyToken };
