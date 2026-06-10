// routes/clubs.js - 社团路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone, validateUploadFile } = require('../utils/helpers');
const aiChecker = require('./ai');

// ─── 社团logo上传配置 ──────────────────────────────────
const CLUB_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'clubs');
if (!fs.existsSync(CLUB_UPLOAD_DIR)) fs.mkdirSync(CLUB_UPLOAD_DIR, { recursive: true });

const clubStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CLUB_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'club-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const clubUpload = multer({ storage: clubStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── AI审核记录写入辅助 ────────────────────────────────
function logAiReview(source, sourceId, phone, content, aiResult, action) {
  try {
    db.prepare(`INSERT INTO ai_review_logs (source, source_id, phone, content_preview, violation, level, category, reason, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      source, sourceId, phone, content.slice(0, 200),
      aiResult.violation ? 1 : 0, aiResult.level, aiResult.category, aiResult.reason, action
    );
  } catch(e) { console.error('[AI审核] 写入审核记录失败:', e.message); }
}

// ─── 创建社团 ─────────────────────────────────────────────
router.post('/', requireAuth, clubUpload.single('logo'), async (req, res) => JSON_RES(res, async () => {
  const { name, category, description } = req.body;
  const phone = req.user.phone;
  if (!name) return makeError('社团名称不能为空', ErrorCode.PARAM_MISSING);

  // 文件魔数校验
  if (req.file) {
    const validation = validateUploadFile(req.file);
    if (!validation.valid) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return makeError(validation.error, ErrorCode.PARAM_INVALID);
    }
  }

  // AI审核社团名称和描述
  const reviewContent = `社团名称：${name}\n社团描述：${description || ''}`;
  let aiResult = { violation: false, level: 'none', category: '无', reason: '' };
  try {
    aiResult = await aiChecker.checkWallPost({
      title: name, content: description || '', topic: '',
      images: '[]'
    });
    if (aiResult.violation && aiResult.level === 'high') {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e) {} }
      console.log(`[AI审核] 社团创建被拦截: name=${name}, level=${aiResult.level}, reason=${aiResult.reason}`);
      logAiReview('club', 0, phone, reviewContent, aiResult, 'block');
      return makeError('社团信息不符合平台规范：' + (aiResult.reason || '请修改后重新提交'), 'AI_001');
    }
    if (aiResult.violation) console.log(`[AI审核] 社团创建提醒(未拦截): level=${aiResult.level}, reason=${aiResult.reason}`);
    else console.log(`[AI审核] 社团创建审核通过: name=${name}`);
  } catch (e) {
    console.error('[AI审核] 社团创建审核失败(放行):', e.message);
  }

  const logo = req.file ? '/uploads/clubs/' + req.file.filename : null;
  const info = db.prepare('INSERT INTO clubs (name, logo, category, description, president_phone) VALUES (?,?,?,?,?)')
    .run(name, logo, category || '其他', description || '', phone);

  // 创建者自动成为owner
  db.prepare('INSERT INTO club_members (club_id, phone, role) VALUES (?,?,?)')
    .run(info.lastInsertRowid, phone, 'owner');

  logAiReview('club', info.lastInsertRowid, phone, reviewContent, aiResult, 'pass');
  return { ok: true, club_id: info.lastInsertRowid };
}));

// ─── 社团列表（公开可访问） ─────────────────────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () => {
  const { category, search, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let sql = "SELECT * FROM clubs WHERE status = 'active'";
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt');
  const total = db.prepare(countSql).get(...params).cnt;

  sql += ' ORDER BY member_count DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const clubs = db.prepare(sql).all(...params);
  return { total, page: pageNum, limit: limitNum, list: clubs };
}));

// ─── 社团详情 ─────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
  if (!club) return makeError('社团不存在', ErrorCode.ORDER_NOT_FOUND, 404);

  // 获取成员列表
  const members = db.prepare(`
    SELECT cm.role, cm.joined_at, u.name, u.phone
    FROM club_members cm LEFT JOIN users u ON cm.phone = u.phone
    WHERE cm.club_id = ? ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
  `).all(req.params.id);

  // 获取该社团发布的活动
  const activities = db.prepare(
    "SELECT * FROM activities WHERE publisher_type = 'club' AND publisher_id = ? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 10"
  ).all(req.params.id);

  // 手机号脱敏：仅社长可见完整手机号，其他成员仅见脱敏版本
  const requesterPhone = req.user.phone;
  const isOwner = members.some(m => m.phone === requesterPhone && m.role === 'owner');
  const maskedMembers = members.map(m => ({
    role: m.role,
    joined_at: m.joined_at,
    name: m.name,
    phone: isOwner ? m.phone : fmtPhone(m.phone)
  }));

  return { ...club, members: maskedMembers, activities };
}));

// ─── 加入社团 ─────────────────────────────────────────────
router.post('/:id/join', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const club = db.prepare('SELECT * FROM clubs WHERE id = ? AND status = ?').get(req.params.id, 'active');
  if (!club) return makeError('社团不存在或已冻结');

  const existing = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, phone);
  if (existing) return makeError('已加入该社团');

  db.prepare('INSERT INTO club_members (club_id, phone, role) VALUES (?,?,?)').run(req.params.id, phone, 'member');
  db.prepare('UPDATE clubs SET member_count = member_count + 1 WHERE id = ?').run(req.params.id);

  return { ok: true };
}));

// ─── 退出社团 ─────────────────────────────────────────────
router.post('/:id/leave', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, phone);
  if (!member) return makeError('未加入该社团');
  if (member.role === 'owner') return makeError('社长不能退出，请先转让社长');

  db.prepare('DELETE FROM club_members WHERE club_id = ? AND phone = ?').run(req.params.id, phone);
  db.prepare('UPDATE clubs SET member_count = member_count - 1 WHERE id = ?').run(req.params.id);

  return { ok: true };
}));

// ─── 更新社团信息 ─────────────────────────────────────────
router.put('/:id', requireAuth, clubUpload.single('logo'), (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权修改社团信息', ErrorCode.FORBIDDEN);

  const { name, category, description } = req.body;
  const logo = req.file ? '/uploads/clubs/' + req.file.filename : null;

  let sql = 'UPDATE clubs SET ';
  const sets = [];
  const params = [];
  if (name) { sets.push('name = ?'); params.push(name); }
  if (category) { sets.push('category = ?'); params.push(category); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (logo) { sets.push('logo = ?'); params.push(logo); }
  if (!sets.length) return makeError('没有需要更新的内容');

  sql += sets.join(', ') + ' WHERE id = ?';
  params.push(req.params.id);
  db.prepare(sql).run(...params);

  return { ok: true };
}));

// ─── 社团分类列表 ─────────────────────────────────────────
router.get('/meta/categories', requireAuth, (req, res) => JSON_RES(res, () => {
  const categories = [
    { key: '文艺', emoji: '🎨' },
    { key: '体育', emoji: '⚽' },
    { key: '学术', emoji: '📚' },
    { key: '科技', emoji: '💻' },
    { key: '公益', emoji: '💛' },
    { key: '社交', emoji: '🤝' },
    { key: '音乐', emoji: '🎵' },
    { key: '其他', emoji: '🏷️' }
  ];
  return categories;
}));

module.exports = router;
