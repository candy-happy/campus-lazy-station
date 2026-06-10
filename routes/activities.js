// routes/activities.js - 活动路由
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

// ─── 活动封面图上传配置 ──────────────────────────────────
const ACT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'activities');
if (!fs.existsSync(ACT_UPLOAD_DIR)) fs.mkdirSync(ACT_UPLOAD_DIR, { recursive: true });

const actStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ACT_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const actUpload = multer({ storage: actStorage, limits: { fileSize: 5 * 1024 * 1024 } });

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

// ─── 创建活动 ─────────────────────────────────────────────
router.post('/', requireAuth, actUpload.single('cover'), async (req, res) => JSON_RES(res, async () => {
  const { title, description, location, start_time, end_time, signup_deadline, max_participants, category, publisher_type, publisher_id, publisher_name } = req.body;
  const phone = req.user.phone;

  if (!title) return makeError('活动标题不能为空', ErrorCode.PARAM_MISSING);
  if (!start_time) return makeError('请设置活动开始时间', ErrorCode.PARAM_MISSING);

  // 文件魔数校验
  if (req.file) {
    const validation = validateUploadFile(req.file);
    if (!validation.valid) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return makeError(validation.error, ErrorCode.PARAM_INVALID);
    }
  }

  // AI审核活动标题和描述
  const reviewContent = `活动标题：${title}\n活动描述：${description || ''}\n活动地点：${location || ''}`;
  let aiResult = { violation: false, level: 'none', category: '无', reason: '' };
  try {
    aiResult = await aiChecker.checkWallPost({
      title, content: description || '', topic: '',
      images: '[]'
    });
    if (aiResult.violation && aiResult.level === 'high') {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e) {} }
      console.log(`[AI审核] 活动创建被拦截: title=${title}, level=${aiResult.level}, reason=${aiResult.reason}`);
      logAiReview('activity', 0, phone, reviewContent, aiResult, 'block');
      return makeError('活动信息不符合平台规范：' + (aiResult.reason || '请修改后重新提交'), 'AI_001');
    }
    if (aiResult.violation) console.log(`[AI审核] 活动创建提醒(未拦截): level=${aiResult.level}, reason=${aiResult.reason}`);
    else console.log(`[AI审核] 活动创建审核通过: title=${title}`);
  } catch (e) {
    console.error('[AI审核] 活动创建审核失败(放行):', e.message);
  }

  const cover = req.file ? '/uploads/activities/' + req.file.filename : null;
  const pType = publisher_type || 'user';
  const pId = publisher_id || null;
  const pName = publisher_name || '';

  // 如果是社团活动，验证权限
  if (pType === 'club' && pId) {
    const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)')
      .get(pId, phone, 'owner', 'admin');
    if (!member) return makeError('无权以该社团名义发布活动', ErrorCode.FORBIDDEN);
  }

  const info = db.prepare(`INSERT INTO activities
    (title, cover, description, location, start_time, end_time, signup_deadline, max_participants, category, publisher_type, publisher_id, publisher_name, phone)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(title, cover, description || '', location || '', start_time, end_time || null, signup_deadline || null,
      max_participants || 0, category || '其他', pType, pId, pName, phone);

  logAiReview('activity', info.lastInsertRowid, phone, reviewContent, aiResult, 'pass');

  // 社团活动：更新社团 activity_count
  if (pType === 'club' && pId) {
    db.prepare('UPDATE clubs SET activity_count = (SELECT COUNT(*) FROM activities WHERE publisher_type=? AND publisher_id=? AND status!=?) WHERE id = ?')
      .run('club', pId, 'cancelled', pId);
  }

  return { ok: true, activity_id: info.lastInsertRowid };
}));

// ─── 活动列表（公开可访问） ─────────────────────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () => {
  const { category, publisher_type, publisher_id, status, search, start_date, end_date, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let sql = 'SELECT * FROM activities WHERE 1=1';
  const params = [];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (publisher_type) { sql += ' AND publisher_type = ?'; params.push(publisher_type); }
  if (publisher_id) { sql += ' AND publisher_id = ?'; params.push(publisher_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  else { sql += " AND status != 'cancelled'"; }
  if (search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  if (start_date) { sql += " AND start_time >= ?"; params.push(start_date); }
  if (end_date) { sql += " AND start_time <= ?"; params.push(end_date + ' 23:59:59'); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt');
  const total = db.prepare(countSql).get(...params).cnt;

  // 排序逻辑：未开始的活动优先，按开始时间升序；已结束的排在后面
  sql += " ORDER BY CASE WHEN start_time > datetime('now','localtime') THEN 0 ELSE 1 END, start_time ASC LIMIT ? OFFSET ?";
  params.push(limitNum, offset);

  const activities = db.prepare(sql).all(...params);
  return { total, page: pageNum, limit: limitNum, list: activities };
}));

// ─── 活动详情 ─────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return makeError('活动不存在', ErrorCode.ORDER_NOT_FOUND, 404);

  const phone = req.user.phone;

  // 优化：使用单次查询同时获取报名人数和当前用户报名状态
  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'signed' THEN 1 END) as signup_count,
      MAX(CASE WHEN phone = ? THEN status END) as my_status
    FROM activity_signups
    WHERE activity_id = ?
  `).get(phone, req.params.id);

  return {
    ...activity,
    signup_count: stats.signup_count || 0,
    my_status: stats.my_status || null
  };
}));

// ─── 报名活动 ─────────────────────────────────────────────
router.post('/:id/signup', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;

  // 使用事务防止竞态条件
  const signupTx = db.transaction(() => {
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    if (!activity) return makeError('活动不存在', ErrorCode.ORDER_NOT_FOUND, 404);
    if (activity.status !== 'open') return makeError('活动不在报名状态');

    // 检查报名截止时间
    if (activity.signup_deadline && new Date(activity.signup_deadline) < new Date()) {
      return makeError('报名已截止');
    }

    // 检查是否已报名
    const existing = db.prepare('SELECT * FROM activity_signups WHERE activity_id = ? AND phone = ?').get(req.params.id, phone);
    if (existing) {
      if (existing.status === 'signed') return makeError('已报名该活动');
      // 之前取消过，重新报名
      db.prepare("UPDATE activity_signups SET status = 'signed', signed_up_at = datetime('now','localtime') WHERE id = ?")
        .run(existing.id);
    } else {
      // 检查人数限制
      if (activity.max_participants > 0) {
        const count = db.prepare("SELECT COUNT(*) as cnt FROM activity_signups WHERE activity_id = ? AND status = 'signed'")
          .get(req.params.id).cnt;
        if (count >= activity.max_participants) return makeError('活动名额已满');
      }

      db.prepare('INSERT INTO activity_signups (activity_id, phone) VALUES (?,?)').run(req.params.id, phone);
    }

    db.prepare('UPDATE activities SET current_participants = current_participants + 1 WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  return signupTx();
}));

// ─── 取消报名 ─────────────────────────────────────────────
router.post('/:id/cancel-signup', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;

  // 使用事务防止竞态条件
  const cancelTx = db.transaction(() => {
    const signup = db.prepare("SELECT * FROM activity_signups WHERE activity_id = ? AND phone = ? AND status = 'signed'")
      .get(req.params.id, phone);
    if (!signup) return makeError('未报名该活动');

    db.prepare("UPDATE activity_signups SET status = 'cancelled' WHERE id = ?").run(signup.id);
    db.prepare('UPDATE activities SET current_participants = MAX(0, current_participants - 1) WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  return cancelTx();
}));

// ─── 活动签到 ─────────────────────────────────────────────
router.post('/:id/checkin', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const signup = db.prepare("SELECT * FROM activity_signups WHERE activity_id = ? AND phone = ? AND status = 'signed'")
    .get(req.params.id, phone);
  if (!signup) return makeError('未报名该活动，无法签到');

  db.prepare("UPDATE activity_signups SET status = 'attended' WHERE id = ?").run(signup.id);
  return { ok: true };
}));

// ─── 活动报名人员列表 ─────────────────────────────────────
router.get('/:id/participants', requireAuth, (req, res) => JSON_RES(res, () => {
  const { status, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT s.*, u.name FROM activity_signups s LEFT JOIN users u ON s.phone = u.phone WHERE s.activity_id = ?';
  const params = [req.params.id];
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  sql += ' ORDER BY s.signed_up_at ASC';
  const list = db.prepare(sql).all(...params);
  // 手机号脱敏：活动发布者可见完整手机号，其他人仅见脱敏版本
  const activity = db.prepare('SELECT phone FROM activities WHERE id = ?').get(req.params.id);
  const isPublisher = activity && activity.phone === req.user.phone;
  return { list: list.map(s => ({ ...s, phone: isPublisher ? s.phone : fmtPhone(s.phone) })) };
}));

// ─── 更新活动 ─────────────────────────────────────────────
router.put('/:id', requireAuth, actUpload.single('cover'), (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return makeError('活动不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  if (activity.phone !== phone) return makeError('无权修改该活动', ErrorCode.FORBIDDEN);

  const { title, description, location, start_time, end_time, signup_deadline, max_participants, category, status } = req.body;
  const cover = req.file ? '/uploads/activities/' + req.file.filename : null;

  const sets = [];
  const params = [];
  if (title) { sets.push('title = ?'); params.push(title); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (location) { sets.push('location = ?'); params.push(location); }
  if (start_time) { sets.push('start_time = ?'); params.push(start_time); }
  if (end_time) { sets.push('end_time = ?'); params.push(end_time); }
  if (signup_deadline) { sets.push('signup_deadline = ?'); params.push(signup_deadline); }
  if (max_participants !== undefined) { sets.push('max_participants = ?'); params.push(parseInt(max_participants) || 0); }
  if (category) { sets.push('category = ?'); params.push(category); }
  if (status) { sets.push('status = ?'); params.push(status); }
  if (cover) { sets.push('cover = ?'); params.push(cover); }
  if (!sets.length) return makeError('没有需要更新的内容');

  db.prepare('UPDATE activities SET ' + sets.join(', ') + ' WHERE id = ?').run(...params, req.params.id);
  return { ok: true };
}));

// ─── 删除/取消活动 ─────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return makeError('活动不存在', ErrorCode.ORDER_NOT_FOUND, 404);
  if (activity.phone !== phone && req.user.type !== 'admin') return makeError('无权操作', ErrorCode.FORBIDDEN);

  db.prepare("UPDATE activities SET status = 'cancelled' WHERE id = ?").run(req.params.id);

  // 社团活动：更新社团 activity_count
  if (activity.publisher_type === 'club' && activity.publisher_id) {
    db.prepare('UPDATE clubs SET activity_count = (SELECT COUNT(*) FROM activities WHERE publisher_type=? AND publisher_id=? AND status!=?) WHERE id = ?')
      .run('club', activity.publisher_id, 'cancelled', activity.publisher_id);
  }

  return { ok: true };
}));

// ─── 活动分类列表 ─────────────────────────────────────────
router.get('/meta/categories', requireAuth, (req, res) => JSON_RES(res, () => {
  const categories = [
    { key: '讲座', emoji: '🎤' },
    { key: '比赛', emoji: '🏆' },
    { key: '聚会', emoji: '🎉' },
    { key: '志愿', emoji: '💛' },
    { key: '演出', emoji: '🎭' },
    { key: '展览', emoji: '🖼️' },
    { key: '运动', emoji: '⚽' },
    { key: '招聘', emoji: '💼' },
    { key: '其他', emoji: '📌' }
  ];
  return categories;
}));

module.exports = router;
