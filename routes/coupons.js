// routes/coupons.js - 优惠券路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 可用优惠券列表（公共） ─────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () =>
  db.prepare("SELECT * FROM coupons WHERE usable=1 AND expire_at > datetime('now','localtime')").all()
));

// ─── 领取优惠券 ───────────────────────────────────────────
router.post('/claim', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, coupon_id } = req.body;
  if (!phone || !coupon_id) return makeError('参数缺失', ErrorCode.PARAM_MISSING);
  // 安全校验：只能领取自己的优惠券
  if (req.user.phone !== phone) {
    return makeError('无权操作', ErrorCode.FORBIDDEN);
  }
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ? AND usable=1').get(coupon_id);
  if (!coupon) return makeError('优惠券不存在或已失效', ErrorCode.COUPON_NOT_FOUND);
  const claimed = db.prepare('SELECT * FROM coupons WHERE id = ? AND phone = ?').get(coupon_id, phone);
  if (claimed) return makeError('已领取该优惠券', ErrorCode.COUPON_CLAIMED);
  db.prepare('UPDATE coupons SET phone = ? WHERE id = ? AND phone IS NULL').run(phone, coupon_id);
  return { ok: true, msg: '领取成功' };
}));

// ─── 我的优惠券 ───────────────────────────────────────────
router.get('/mine', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) return makeError('缺少phone', ErrorCode.PARAM_MISSING);
  // 安全校验：只能查看自己的优惠券
  if (req.user.phone !== phone) {
    return makeError('无权查看他人优惠券', ErrorCode.FORBIDDEN);
  }
  return db.prepare("SELECT * FROM coupons WHERE phone = ? ORDER BY used ASC, expire_at ASC").all(phone);
}));

module.exports = router;
