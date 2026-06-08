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
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signature] = parts;
    
    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) return null;
    
    const data = JSON.parse(base64urlDecode(payloadB64));
    
    // 验证过期时间
    if (data.exp < Date.now()) return null;
    
    return data;
  } catch {
    return null;
  }
}

module.exports = { generateToken, verifyToken };
