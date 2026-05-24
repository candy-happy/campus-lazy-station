// routes/points.js - 积分路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 积分查询 ─────────────────────────────────────────────
router.get('/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const pts = db.prepare('SELECT * FROM points WHERE phone = ?').get(req.params.phone);
  const logs = db.prepare('SELECT * FROM point_logs WHERE phone = ? ORDER BY created_at DESC LIMIT 20').all(req.params.phone);
  return { total: pts?.total || 0, history: logs };
}));

module.exports = router;
