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

module.exports = router;
