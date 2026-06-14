// routes/audit.js - 操作审计日志路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { JSON_RES } = require('../utils/response');

// 审计日志列表（分页 + 筛选）
router.get('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const offset = (page - 1) * limit;
  const { action, admin, target_type, keyword, start, end } = req.query;

  let where = [];
  let params = [];

  if (action) {
    where.push('action LIKE ?');
    params.push(`%${action}%`);
  }
  if (admin) {
    where.push('admin_username LIKE ?');
    params.push(`%${admin}%`);
  }
  if (target_type) {
    where.push('target_type = ?');
    params.push(target_type);
  }
  if (keyword) {
    where.push('detail LIKE ?');
    params.push(`%${keyword}%`);
  }
  if (start) {
    where.push('created_at >= ?');
    params.push(start);
  }
  if (end) {
    where.push('created_at <= ?');
    params.push(end + ' 23:59:59');
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM admin_audit_logs ${whereClause}`).get(...params);
  const total = countRow.total;

  const rows = db.prepare(`SELECT * FROM admin_audit_logs ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return {
    logs: rows,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}));

// 操作类型统计（饼图数据）
router.get('/stats', requireAdmin, (req, res) => JSON_RES(res, () => {
  const rows = db.prepare(`SELECT action, COUNT(*) as count FROM admin_audit_logs GROUP BY action ORDER BY count DESC`).all();
  return rows;
}));

// 管理员活跃度排行
router.get('/admin-stats', requireAdmin, (req, res) => JSON_RES(res, () => {
  const rows = db.prepare(`SELECT admin_username, COUNT(*) as count FROM admin_audit_logs GROUP BY admin_username ORDER BY count DESC`).all();
  return rows;
}));

module.exports = router;
