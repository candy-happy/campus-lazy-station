// utils/jwt.js - Token 生成与验证
const { JWT_SECRET, JWT_EXPIRES_MS } = require('../config');

function generateToken(payload) {
  return Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + JWT_EXPIRES_MS
  })).toString('base64url');
}

function verifyToken(token) {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = { generateToken, verifyToken };
