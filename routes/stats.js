// routes/stats.js - 统计路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { JSON_RES } = require('../utils/response');

router.get('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total_orders: db.prepare("SELECT COUNT(*) as n FROM orders").get().n,
    today_orders: db.prepare("SELECT COUNT(*) as n FROM orders WHERE date(created_at) = ?").get(today).n,
    total_revenue: db.prepare("SELECT COALESCE(SUM(price),0) as n FROM orders WHERE status='completed'").get().n,
    today_revenue: db.prepare("SELECT COALESCE(SUM(price),0) as n FROM orders WHERE status='completed' AND date(completed_at) = ?").get(today).n,
    total_riders: db.prepare("SELECT COUNT(*) as n FROM riders").get().n,
    total_users: db.prepare("SELECT COUNT(*) as n FROM users").get().n,
    active_orders: db.prepare("SELECT COUNT(*) as n FROM orders WHERE status IN ('pending','accepted','running')").get().n,
    orders_by_status: db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all()
  };
}));

module.exports = router;
