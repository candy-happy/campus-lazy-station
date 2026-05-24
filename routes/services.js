// routes/services.js - 服务列表路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { JSON_RES } = require('../utils/response');

// ─── 服务列表（公共） ──────────────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () =>
  db.prepare('SELECT * FROM services').all()
));

module.exports = router;
