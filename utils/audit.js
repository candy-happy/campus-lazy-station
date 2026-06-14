// utils/audit.js - 管理员操作审计日志
const db = require('../config/database');

// 记录操作日志
// admin: { id, username } 或 req.user
// action: 'admin.create' | 'admin.delete' | 'admin.disable' | 'post.delete' | ...
// target: { type, id } 或直接字符串
// detail: 额外描述（可选对象，会转为JSON）
function auditLog(admin, action, target = {}, detail = '') {
  try {
    const adminId = admin?.id || admin?.adminId || 0;
    const adminUsername = admin?.username || admin?.adminUsername || 'unknown';
    const targetType = typeof target === 'string' ? target : (target?.type || '');
    const targetId = target?.id !== undefined ? String(target.id) : '';
    const detailStr = typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
    const ip = ''; // 由调用者传入更准

    db.prepare(`INSERT INTO admin_audit_logs (admin_id, admin_username, action, target_type, target_id, detail, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(adminId, adminUsername, action, targetType, targetId, detailStr, ip);
  } catch (e) {
    console.error('[Audit] 记录审计日志失败:', e.message);
  }
}

// 从 req 中提取管理员信息并记录
function auditFromReq(req, action, target = {}, detail = '') {
  const admin = req.user || {};
  const ip = req.ip || req.headers?.['x-forwarded-for'] || '';
  try {
    db.prepare(`INSERT INTO admin_audit_logs (admin_id, admin_username, action, target_type, target_id, detail, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(
        admin.id || 0,
        admin.username || 'api-key',
        action,
        typeof target === 'string' ? target : (target?.type || ''),
        target?.id !== undefined ? String(target.id) : '',
        typeof detail === 'object' ? JSON.stringify(detail) : String(detail),
        ip
      );
  } catch (e) {
    console.error('[Audit] 记录审计日志失败:', e.message);
  }
}

module.exports = { auditLog, auditFromReq };
