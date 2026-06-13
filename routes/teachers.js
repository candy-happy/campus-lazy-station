// routes/teachers.js - 池州学院教师评价系统
const { Router } = require('express');
const { JSON_RES, makeError } = require('../utils/response');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const aiChecker = require('./ai');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 教师评价媒体上传
const REVIEW_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'teacher_reviews');
if (!fs.existsSync(REVIEW_UPLOAD_DIR)) fs.mkdirSync(REVIEW_UPLOAD_DIR, { recursive: true });
const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REVIEW_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype === 'video/mp4' ? '.mp4' : '.jpg');
    cb(null, 'review_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const reviewUpload = multer({
  storage: reviewStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/|video\//.test(file.mimetype);
    cb(null, ok);
  }
});

const router = Router();

// ── 从bio中提取结构化信息 ──────────────────────────
function enrichFromBio(teacher) {
  if (!teacher || !teacher.bio) return teacher;
  const bio = teacher.bio;
  
  // 提取研究方向（仅在research为空时）
  if (!teacher.research) {
    const m = bio.match(/研究方向[：:]\s*([^。；]+)/);
    if (m) teacher.research = m[1].trim().replace(/[。；]$/, '');
  }
  
  // 提取主讲课程（仅在courses为空时）
  if (!teacher.courses) {
    const m = bio.match(/主讲课程[：:]\s*([^。]+)/);
    if (m) teacher.courses = m[1].trim().replace(/[。；]$/, '');
  }
  
  // 提取毕业院校（仅在graduate为空时）
  if (!teacher.graduate) {
    const m = bio.match(/([\u4e00-\u9fff]+大学)/);
    if (m) teacher.graduate = m[1];
  }
  
  // 提取学历（仅在education为空时）
  if (!teacher.education) {
    const m = bio.match(/(博士研究生|硕士研究生|大学本科|[硕博本]士)/);
    if (m) teacher.education = m[1];
  }
  
  return teacher;
}

// ── 获取学院列表 ──────────────────────────────────────
router.get('/colleges', (req, res) => JSON_RES(res, () => {
  const rows = db.prepare('SELECT college, COUNT(*) as count FROM teachers GROUP BY college ORDER BY count DESC').all();
  return { colleges: rows };
}));

// ── 热门教师（点赞排行Top10） ────────────────────────────
router.get('/hot', (req, res) => JSON_RES(res, () => {
  const teachers = db.prepare('SELECT id, name, college, title, like_count, review_count, avg_rating FROM teachers ORDER BY like_count DESC, avg_rating DESC LIMIT 10').all();
  return { teachers };
}));

// ── 获取教师列表（支持学院筛选和搜索） ──────────────
router.get('/', (req, res) => JSON_RES(res, () => {
  const { college, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let where = '1=1';
  const params = [];
  
  if (college && college !== '全部') {
    where += ' AND college = ?';
    params.push(college);
  }
  if (search) {
    where += ' AND (name LIKE ? OR college LIKE ? OR graduate LIKE ?)';
    const kw = `%${search}%`;
    params.push(kw, kw, kw);
  }
  
  const total = db.prepare(`SELECT COUNT(*) as c FROM teachers WHERE ${where}`).get(...params).c;
  const teachers = db.prepare(
    `SELECT id, name, college, title, research, avatar, education, graduate, courses, bio, like_count, review_count, avg_rating FROM teachers WHERE ${where} ORDER BY like_count DESC, review_count DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);
  
  return { teachers: teachers.map(enrichFromBio), total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
}));

// ── 获取教师详情 ──────────────────────────────────────
router.get('/:id', (req, res) => JSON_RES(res, () => {
  const teacherRaw = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!teacherRaw) return { error: '教师不存在', code: 'TEACHER_001', status: 404 };
  const teacher = enrichFromBio(teacherRaw);
  
  // 获取最新评价（匿名评价隐藏nickname/avatar/phone）
  let reviews = db.prepare(
    `SELECT r.id, CASE WHEN r.is_anonymous = 1 THEN '' ELSE r.phone END as phone, CASE WHEN r.is_anonymous = 1 THEN '匿名' ELSE r.nickname END as nickname, CASE WHEN r.is_anonymous = 1 THEN '' ELSE r.avatar END as avatar, r.rating, r.content, r.created_at, r.is_anonymous, r.media_url 
     FROM teacher_reviews r WHERE r.teacher_id = ? ORDER BY r.created_at DESC LIMIT 20`
  ).all(req.params.id);

  // 屏蔽过滤（双向）：排除双向屏蔽用户的评价
  if (req.user && req.user.phone) {
    const bp = new Set(db.prepare('SELECT blocked_phone FROM wall_blocks WHERE blocker_phone = ?').all(req.user.phone).map(r => r.blocked_phone));
    const bb = new Set(db.prepare('SELECT blocker_phone FROM wall_blocks WHERE blocked_phone = ?').all(req.user.phone).map(r => r.blocker_phone));
    if (bp.size > 0 || bb.size > 0) reviews = reviews.filter(r => !bp.has(r.phone) && !bb.has(r.phone));
  }
  
  // 获取今日是否已点赞/已评论
  const today = new Date().toISOString().slice(0, 10);
  let todayLiked = false, todayReviewed = false;
  if (req.user) {
    const liked = db.prepare('SELECT id FROM teacher_likes WHERE teacher_id = ? AND phone = ? AND like_date = ?').get(req.params.id, req.user.phone, today);
    todayLiked = !!liked;
    const reviewed = db.prepare("SELECT id FROM teacher_reviews WHERE teacher_id = ? AND phone = ? AND date(created_at) = ?").get(req.params.id, req.user.phone, today);
    todayReviewed = !!reviewed;
  }
  
  return { teacher, reviews, todayLiked, todayReviewed };
}));

// ── 点赞教师（每天限一位老师一次） ────────────────────
router.post('/:id/like', (req, res) => JSON_RES(res, () => {
  if (!req.user) return { error: '请先登录', code: 'AUTH_001', status: 401 };
  
  const teacher = db.prepare('SELECT id FROM teachers WHERE id = ?').get(req.params.id);
  if (!teacher) return { error: '教师不存在', code: 'TEACHER_001', status: 404 };
  
  const phone = req.user.phone;
  const today = new Date().toISOString().slice(0, 10);
  
  // 检查今日是否已点赞此教师（每位老师每天限一次）
  const existing = db.prepare('SELECT id FROM teacher_likes WHERE teacher_id = ? AND phone = ? AND like_date = ?').get(req.params.id, phone, today);
  if (existing) return { error: '今天已经给这位老师点过赞了', code: 'LIKE_001' };
  
  const insertLike = db.prepare('INSERT INTO teacher_likes (teacher_id, phone, like_date) VALUES (?, ?, ?)');
  const updateLikeCount = db.prepare(`UPDATE teachers SET like_count = like_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`);
  const transaction = db.transaction((id, phone, today) => {
    insertLike.run(id, phone, today);
    updateLikeCount.run(id);
    return db.prepare('SELECT like_count FROM teachers WHERE id = ?').get(id).like_count;
  });
  const likeCount = transaction(req.params.id, phone, today);
  return { liked: true, like_count: likeCount };
}));

// ── 评论教师（每天每位教师限一次，需AI审核） ──────
router.post('/:id/review', async (req, res) => JSON_RES(res, async () => {
  if (!req.user) return { error: '请先登录', code: 'AUTH_001', status: 401 };
  
  const teacher = db.prepare('SELECT id, name FROM teachers WHERE id = ?').get(req.params.id);
  if (!teacher) return { error: '教师不存在', code: 'TEACHER_001', status: 404 };
  
  const { rating = 5, content = '', is_anonymous = 0, media_url = '' } = req.body;
  if (!content || content.trim().length === 0) return { error: '请输入评价内容', code: 'REVIEW_001' };
  if (content.length > 500) return { error: '评价内容不能超过500字', code: 'REVIEW_002' };
  if (rating < 1 || rating > 5) return { error: '评分必须在1-5之间', code: 'REVIEW_003' };
  
  const phone = req.user.phone;
  const today = new Date().toISOString().slice(0, 10);
  
  // 检查今日是否已评论此教师
  const existing = db.prepare("SELECT id FROM teacher_reviews WHERE teacher_id = ? AND phone = ? AND date(created_at) = ?").get(req.params.id, phone, today);
  if (existing) return { error: '今天已经评价过这位老师了', code: 'REVIEW_004' };
  
  // AI审核评论
  let aiResult = { violation: false, level: 'none', category: '无', reason: '' };
  try {
    aiResult = await aiChecker.checkTextContent(content, 'teacher_review');
    if (aiResult.violation && aiResult.level === 'high') {
      console.log(`[AI审核] 教师评价被拦截: teacher=${teacher.name}, phone=${phone}, level=${aiResult.level}, reason=${aiResult.reason}`);
      return { error: '评价内容不符合规范：' + (aiResult.reason || '请修改后重新提交'), code: 'AI_001', status: 403 };
    }
  } catch (e) {
    console.error('[AI审核] 教师评价审核失败(放行):', e.message);
  }
  
  // 插入评论 + 更新教师评分 (事务)
  // JWT只有phone，需从数据库获取用户昵称和头像
  const userInfo = db.prepare('SELECT nickname, name, avatar FROM users WHERE phone = ?').get(phone);
  const nickname = (userInfo && (userInfo.nickname || userInfo.name)) || '匿名';
  const avatar = (userInfo && userInfo.avatar) || '';
  const isAnonymous = is_anonymous ? 1 : 0;
  const insertReview = db.prepare('INSERT INTO teacher_reviews (teacher_id, phone, nickname, avatar, rating, content, ai_reviewed, ai_level, is_anonymous, media_url) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)');
  const updateTeacherStats = db.prepare(`UPDATE teachers SET review_count = ?, avg_rating = ?, updated_at = datetime('now','localtime') WHERE id = ?`);
  const reviewTransaction = db.transaction((teacherId, phone, nickname, avatar, rating, content, aiLevel, isAnon, mediaUrl) => {
    insertReview.run(teacherId, phone, nickname, avatar, rating, content, aiLevel, isAnon, mediaUrl);
    const stats = db.prepare('SELECT COUNT(*) as cnt, AVG(rating) as avg FROM teacher_reviews WHERE teacher_id = ?').get(teacherId);
    const avgRating = stats.cnt > 0 ? Math.round(stats.avg * 10) / 10 : 0;
    updateTeacherStats.run(stats.cnt, avgRating, teacherId);
    return { review_count: stats.cnt, avg_rating: avgRating };
  });
  const result = reviewTransaction(req.params.id, phone, nickname, avatar, rating, content.trim(), aiResult.level || 'none', isAnonymous, media_url);
  
  return { reviewed: true, ...result };
}));

// ── 管理端：获取评价列表 ──────────────────────────────
router.get('/admin/reviews', (req, res) => JSON_RES(res, () => {
  const { page = 1, limit = 20, teacher_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let where = '1=1';
  const params = [];
  if (teacher_id) { where += ' AND r.teacher_id = ?'; params.push(teacher_id); }
  
  const total = db.prepare(`SELECT COUNT(*) as c FROM teacher_reviews r WHERE ${where}`).get(...params).c;
  const reviews = db.prepare(
    `SELECT r.*, t.name as teacher_name, t.college FROM teacher_reviews r JOIN teachers t ON r.teacher_id = t.id WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);
  
  return { reviews, total, page: parseInt(page) };
}));

// ── 管理端：删除评价 ──────────────────────────────────
router.delete('/admin/reviews/:id', (req, res) => JSON_RES(res, () => {
  const review = db.prepare('SELECT * FROM teacher_reviews WHERE id = ?').get(req.params.id);
  if (!review) return { error: '评价不存在', code: 'REVIEW_005', status: 404 };
  
  // 删除评价 + 重新计算教师评分 (事务)
  const deleteReview = db.prepare('DELETE FROM teacher_reviews WHERE id = ?');
  const recalcStats = db.prepare(`UPDATE teachers SET review_count = ?, avg_rating = ?, updated_at = datetime('now','localtime') WHERE id = ?`);
  const deleteTransaction = db.transaction((reviewId, teacherId) => {
    deleteReview.run(reviewId);
    const stats = db.prepare('SELECT COUNT(*) as cnt, AVG(rating) as avg FROM teacher_reviews WHERE teacher_id = ?').get(teacherId);
    const avgRating = stats.cnt > 0 ? Math.round(stats.avg * 10) / 10 : 0;
    recalcStats.run(stats.cnt, avgRating, teacherId);
  });
  deleteTransaction(req.params.id, review.teacher_id);
  
  return { deleted: true };
}));

// ── 评价媒体上传 ──────────────────────────────────
router.post('/upload-media', reviewUpload.array('files', 6), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '请选择文件' });
  const urls = req.files.map(f => '/uploads/teacher_reviews/' + f.filename);
  res.json({ urls });
});

// ─── 举报教师评价 ───────────────────────────────────────
router.post('/report', requireAuth, (req, res) => JSON_RES(res, () => {
  const { target_type, target_id, target_content, reason, detail } = req.body;
  const phone = req.user.phone;
  if (!target_type || !target_id || !reason) return makeError('参数不完整');
  if (target_type !== 'review') return makeError('举报类型无效');
  const existing = db.prepare('SELECT id FROM reports WHERE source=? AND target_type=? AND target_id=? AND reporter_phone=?').get('teacher', target_type, target_id, phone);
  if (existing) return makeError('您已举报过该内容');
  db.prepare(`INSERT INTO reports (source,target_type,target_id,target_content,reporter_phone,reason,detail,status,created_at) VALUES ('teacher',?,?,?,?,?,?,'pending',datetime('now','localtime'))`)
    .run(target_type, target_id, (target_content||'').slice(0,200), phone, reason, detail||'');
  return { ok: true };
}));

module.exports = router;
