// routes/stats.js - 统计路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { JSON_RES } = require('../utils/response');

router.get('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // ── 核心业务 ──
  const totalOrders = db.prepare("SELECT COUNT(*) as n FROM orders").get().n;
  const todayOrders = db.prepare("SELECT COUNT(*) as n FROM orders WHERE date(created_at) = ?").get(today).n;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(price),0) as n FROM orders WHERE status='completed'").get().n;
  const todayRevenue = db.prepare("SELECT COALESCE(SUM(price),0) as n FROM orders WHERE status='completed' AND date(completed_at) = ?").get(today).n;
  const totalRiders = db.prepare("SELECT COUNT(*) as n FROM riders").get().n;
  const totalUsers = db.prepare("SELECT COUNT(*) as n FROM users").get().n;
  const activeOrders = db.prepare("SELECT COUNT(*) as n FROM orders WHERE status IN ('pending','accepted','running')").get().n;
  const avgRating = db.prepare("SELECT ROUND(AVG(rating),1) as n FROM riders WHERE rating > 0").get().n || 0;
  const ordersByStatus = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all();

  // ── 校园墙 ──
  const wallPosts = db.prepare("SELECT COUNT(*) as n FROM wall_posts").get().n;
  const wallComments = db.prepare("SELECT COUNT(*) as n FROM wall_comments").get().n;
  const wallLikes = db.prepare("SELECT COUNT(*) as n FROM wall_likes").get().n;
  const wallFollows = db.prepare("SELECT COUNT(*) as n FROM wall_follows").get().n;
  const todayWallPosts = db.prepare("SELECT COUNT(*) as n FROM wall_posts WHERE date(created_at) = ?").get(today).n;

  // ── 二手市场 ──
  const marketItems = db.prepare("SELECT COUNT(*) as n FROM market_items").get().n;
  const marketActive = db.prepare("SELECT COUNT(*) as n FROM market_items WHERE status='active'").get().n;
  const marketRevenue = db.prepare("SELECT COALESCE(SUM(price),0) as n FROM market_orders").get().n;
  const marketComments = db.prepare("SELECT COUNT(*) as n FROM market_comments").get().n;
  const marketOrders = db.prepare("SELECT COUNT(*) as n FROM market_orders").get().n;
  const todayMarketItems = db.prepare("SELECT COUNT(*) as n FROM market_items WHERE date(created_at) = ?").get(today).n;
  const marketByCategory = db.prepare("SELECT category, COUNT(*) as count FROM market_items WHERE status='active' GROUP BY category").all();

  // ── AI审核 ──
  const aiTotal = db.prepare("SELECT COUNT(*) as n FROM ai_review_logs").get().n;
  const aiViolations = db.prepare("SELECT COUNT(*) as n FROM ai_review_logs WHERE violation = 1").get().n;
  const aiBlocked = db.prepare("SELECT COUNT(*) as n FROM ai_review_logs WHERE action IN ('block','下架')").get().n;
  const ai24h = db.prepare("SELECT COUNT(*) as n FROM ai_review_logs WHERE created_at >= datetime('now','-1 day')").get().n;
  const aiViolationRate = aiTotal > 0 ? Math.round(aiViolations / aiTotal * 1000) / 10 : 0;

  // ── 趋势数据（近30天每日统计）──
  const dailyStats = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dailyStats.push({
      date: d,
      orders: db.prepare("SELECT COUNT(*) as n FROM orders WHERE date(created_at)=?").get(d).n,
      users: db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at)=?").get(d).n,
      wall_posts: db.prepare("SELECT COUNT(*) as n FROM wall_posts WHERE date(created_at)=?").get(d).n,
      wall_comments: db.prepare("SELECT COUNT(*) as n FROM wall_comments WHERE date(created_at)=?").get(d).n,
      wall_likes: db.prepare("SELECT COUNT(*) as n FROM wall_likes WHERE date(created_at)=?").get(d).n,
    });
  }

  // ── 校园墙近7天活跃度 ──
  const wallActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    wallActivity.push({
      date: d,
      posts: db.prepare("SELECT COUNT(*) as n FROM wall_posts WHERE date(created_at)=?").get(d).n,
      comments: db.prepare("SELECT COUNT(*) as n FROM wall_comments WHERE date(created_at)=?").get(d).n,
      likes: db.prepare("SELECT COUNT(*) as n FROM wall_likes WHERE date(created_at)=?").get(d).n,
    });
  }

  // ── 最近动态 ──
  const recentUsers = db.prepare("SELECT name,phone,created_at FROM users ORDER BY created_at DESC LIMIT 5").all();
  const recentWallPosts = db.prepare("SELECT nickname,content,created_at FROM wall_posts ORDER BY created_at DESC LIMIT 3").all();
  const recentMarketItems = db.prepare("SELECT title,price,category,created_at FROM market_items ORDER BY created_at DESC LIMIT 3").all();

  return {
    // 核心
    total_orders: totalOrders, today_orders: todayOrders,
    total_revenue: totalRevenue, today_revenue: todayRevenue,
    total_riders: totalRiders, total_users: totalUsers,
    active_orders: activeOrders, avg_rating: avgRating,
    orders_by_status: ordersByStatus,
    // 校园墙
    wall_posts: wallPosts, wall_comments: wallComments,
    wall_likes: wallLikes, wall_follows: wallFollows,
    today_wall_posts: todayWallPosts,
    // 二手市场
    market_items: marketItems, market_active: marketActive,
    market_revenue: marketRevenue, market_comments: marketComments,
    market_orders: marketOrders, today_market_items: todayMarketItems,
    market_by_category: marketByCategory,
    // AI审核
    ai_total: aiTotal, ai_violations: aiViolations,
    ai_blocked: aiBlocked, ai_24h: ai24h,
    ai_violation_rate: aiViolationRate,
    // 趋势
    daily_stats: dailyStats,
    wall_activity: wallActivity,
    // 最近动态
    recent_users: recentUsers,
    recent_wall_posts: recentWallPosts,
    recent_market_items: recentMarketItems,
  };
}));

// ── 订单统计(按时间段) ──
// GET /api/stats/orders?from=2026-06-01&to=2026-06-04
router.get('/orders', requireAdmin, (req, res) => {
  try {
    const { from, to } = req.query;
    let dateWhere = '';
    const params = [];
    if (from && to) {
      dateWhere = "date(created_at) >= ? AND date(created_at) <= ?";
      params.push(from, to);
    } else if (from) {
      dateWhere = "date(created_at) >= ?";
      params.push(from);
    } else if (to) {
      dateWhere = "date(created_at) <= ?";
      params.push(to);
    }
    const w = dateWhere ? ' WHERE ' + dateWhere : '';
    const orders = db.prepare(`SELECT COUNT(*) as n FROM orders${w}`).get(...params).n;
    // 收入/已完成：按completed_at统计
    const cParams = [...params];
    const cw = dateWhere ? ' WHERE status=\'completed\' AND ' + dateWhere.replace(/created_at/g, 'completed_at') : " WHERE status='completed'";
    const revenue = db.prepare(`SELECT COALESCE(SUM(price),0) as n FROM orders${cw}`).get(...cParams).n;
    const completed = db.prepare(`SELECT COUNT(*) as n FROM orders${cw}`).get(...cParams).n;
    // 进行中：按created_at
    const pw = dateWhere ? " WHERE status IN ('pending','accepted','running') AND " + dateWhere : " WHERE status IN ('pending','accepted','running')";
    const pending = db.prepare(`SELECT COUNT(*) as n FROM orders${pw}`).get(...params).n;
    const avgPrice = orders > 0 ? Math.round(revenue / orders * 100) / 100 : 0;
    return res.json({ orders, revenue, completed, pending, avg_price: avgPrice });
  } catch(e) {
    console.error('订单统计查询失败:', e);
    return res.status(500).json({ error: '查询失败' });
  }
});

// ── 订单明细列表(按时间段+状态筛选，分页) ──
// GET /api/stats/orders/list?from=&to=&filter=all|completed|pending|revenue&page=1&size=10
router.get('/orders/list', requireAdmin, (req, res) => {
  try {
    const { from, to, filter = 'all', page = 1, size = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const sizeNum = Math.min(100, Math.max(1, parseInt(size) || 10));
    const offset = (pageNum - 1) * sizeNum;

    let statusClause = '';
    if (filter === 'completed' || filter === 'revenue') statusClause = " AND status='completed'";
    else if (filter === 'pending') statusClause = " AND status IN ('pending','accepted','running')";

    let dateClause = '';
    const params = [];
    if (from && to) {
      dateClause = ' AND date(created_at) >= ? AND date(created_at) <= ?';
      params.push(from, to);
    } else if (from) {
      dateClause = ' AND date(created_at) >= ?';
      params.push(from);
    } else if (to) {
      dateClause = ' AND date(created_at) <= ?';
      params.push(to);
    }

    const where = 'WHERE 1=1' + statusClause + dateClause;
    const total = db.prepare(`SELECT COUNT(*) as n FROM orders ${where}`).get(...params).n;
    const list = db.prepare(
      `SELECT id, type, pickup_location, delivery_location, price, status, created_at FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, sizeNum, offset);

    return res.json({ total, page: pageNum, size: sizeNum, list });
  } catch(e) {
    console.error('订单明细查询失败:', e);
    return res.status(500).json({ error: '查询失败' });
  }
});

module.exports = router;
