// routes/notifications.js - 通知路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 通知列表 ─────────────────────────────────────────────
router.get('/:phone', requireAuth, (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM notifications WHERE phone = ? ORDER BY created_at DESC LIMIT 30').all(req.params.phone)
));

// ─── 标记已读 ─────────────────────────────────────────────
router.patch('/:phone/read', (req, res) => JSON_RES(res, () => {
  const { ids } = req.body;
  if (ids && ids.length) {
    db.prepare(`UPDATE notifications SET read=1 WHERE phone=? AND id IN (${ids.map(()=>'?').join(',')})`)
      .run(req.params.phone, ...ids);
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE phone = ?').run(req.params.phone);
  }
  return { ok: true };
}));

module.exports = router;
