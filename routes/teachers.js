// routes/teachers.js - 池州学院教师评价系统
const { Router } = require('express');
const { JSON_RES, makeError } = require('../utils/response');
const { withCompress } = require('../utils/upload');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
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
router.post('/upload-media', withCompress(reviewUpload.array('files', 6)), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '请选择文件' });
  const urls = req.files.map(f => '/uploads/teacher_reviews/' + f.filename);
  res.json({ urls });
});

// ─── 教师头像上传 ──────────────────────────────────
const AVATAR_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'teacher_avatars');
if (!fs.existsSync(AVATAR_UPLOAD_DIR)) fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'teacher_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

// ── 管理端：上传教师头像 ──────────────────────────
router.post('/upload-avatar', requireAdmin, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片文件' });
  res.json({ url: '/uploads/teacher_avatars/' + req.file.filename });
});

// ── 管理端：获取所有教师（分页+搜索）────────────
router.get('/admin/list', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { page = 1, limit = 30, search, college } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = '1=1'; const params = [];
  if (college && college !== '全部') { where += ' AND college = ?'; params.push(college); }
  if (search) {
    where += ' AND (name LIKE ? OR college LIKE ? OR graduate LIKE ? OR title LIKE ?)';
    const kw = '%' + search + '%'; params.push(kw, kw, kw, kw);
  }
  const total = db.prepare('SELECT COUNT(*) as c FROM teachers WHERE ' + where).get(...params).c;
  const teachers = db.prepare('SELECT * FROM teachers WHERE ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?').all(...params, parseInt(limit), offset);
  return { teachers, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
}));

// ── 管理端：创建教师 ──────────────────────────────
router.post('/', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { name, college, title, research, avatar, bio, education, undergraduate, graduate, courses, papers, projects, achievements, social_roles, like_count, review_count, avg_rating } = req.body;
  if (!name || !college) return { error: '姓名和学院为必填项', code: 'TEACHER_002', status: 400 };
  const r = db.prepare('INSERT INTO teachers (name,college,title,research,avatar,bio,education,undergraduate,graduate,courses,papers,projects,achievements,social_roles,like_count,review_count,avg_rating) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    name, college, title||'', research||'', avatar||'', bio||'', education||'', undergraduate||'', graduate||'', courses||'', papers||'', projects||'', achievements||'', social_roles||'', like_count||0, review_count||0, avg_rating||0);
  return { ok: true, id: r.lastInsertRowid };
}));

// ── 管理端：更新教师 ──────────────────────────────
router.put('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const t = db.prepare('SELECT id FROM teachers WHERE id = ?').get(req.params.id);
  if (!t) return { error: '教师不存在', code: 'TEACHER_001', status: 404 };
  const keys = ['name','college','title','research','avatar','bio','education','undergraduate','graduate','courses','papers','projects','achievements','social_roles','like_count','review_count','avg_rating'];
  const fields = []; const values = [];
  for (const k of keys) { if (req.body[k] !== undefined) { fields.push(k + ' = ?'); values.push(req.body[k]); } }
  if (fields.length === 0) return { error: '没有要更新的字段', code: 'TEACHER_003', status: 400 };
  fields.push("updated_at = datetime('now','localtime')");
  values.push(req.params.id);
  db.prepare('UPDATE teachers SET ' + fields.join(', ') + ' WHERE id = ?').run(...values);
  return { ok: true };
}));

// ── 管理端：删除教师（级联删评价/点赞/举报）──────
router.delete('/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const t = db.prepare('SELECT id, name FROM teachers WHERE id = ?').get(req.params.id);
  if (!t) return { error: '教师不存在', code: 'TEACHER_001', status: 404 };
  const tx = db.transaction((id) => {
    db.prepare('DELETE FROM teacher_likes WHERE teacher_id = ?').run(id);
    db.prepare('DELETE FROM teacher_reviews WHERE teacher_id = ?').run(id);
    db.prepare("DELETE FROM reports WHERE source='teacher' AND target_id = ?").run(id);
    db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
  });
  tx(req.params.id);
  return { ok: true, deleted: t.name };
}));

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

// ── 管理端：导出教师数据(CSV) ─────────────────────
router.get('/admin/export', requireAdmin, (req, res) => {
  const teachers = db.prepare('SELECT * FROM teachers ORDER BY id').all();
  const cols = ['id','name','college','title','research','avatar','bio','education','undergraduate','graduate','courses','papers','projects','achievements','social_roles','like_count','review_count','avg_rating'];
  const csvEscape = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const rows = [cols.join(',')];
  for (const t of teachers) {
    rows.push(cols.map(c => csvEscape(t[c])).join(','));
  }
  const csv = '\uFEFF' + rows.join('\n'); // UTF-8 BOM for Excel
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="teachers_export.csv"');
  res.send(csv);
});

// ── 管理端：导入教师数据(CSV) ──────────────────────
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel')
});

router.post('/admin/import', requireAdmin, importUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择CSV文件' });
  
  try {
    // 解码 CSV（自动处理 BOM）
    let text = req.file.buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
    
    // 按行解析（处理引号内换行）
    const lines = []; let current = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"') { text[i+1] === '"' ? (current += '"', i++) : inQuote = false; }
        else current += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === '\n') { lines.push(current); current = ''; }
        else if (ch !== '\r') current += ch;
      }
    }
    if (current) lines.push(current);
    
    if (lines.length < 2) return res.json({ error: 'CSV文件为空或只有表头' });
    
    // CSV 行切分（处理引号内逗号）
    const splitCsvRow = (line) => {
      const vals = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"') { line[i+1] === '"' ? (cur += '"', i++) : inQ = false; }
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ',') { vals.push(cur.trim()); cur = ''; }
          else cur += c;
        }
      }
      vals.push(cur.trim());
      return vals;
    };
    
    const headers = splitCsvRow(lines[0]).map(h => h.trim());
    const nameIdx = headers.indexOf('name');
    const collegeIdx = headers.indexOf('college');
    if (nameIdx === -1 || collegeIdx === -1) return res.json({ error: 'CSV缺少必填列: name, college' });
    
    const idIdx = headers.indexOf('id');
    
    // 列映射
    const fieldMap = {};
    for (const h of headers) {
      const col = h.trim();
      if (['id','name','college','title','research','avatar','bio','education','undergraduate','graduate','courses','papers','projects','achievements','social_roles','like_count','review_count','avg_rating'].includes(col)) {
        fieldMap[col] = col;
      }
    }
    if (!fieldMap.name || !fieldMap.college) return res.json({ error: 'CSV缺少必填列: name, college' });
    
    let created = 0, updated = 0, skipped = 0, errors = [];
    
    const insertStmt = db.prepare('INSERT INTO teachers (name,college,title,research,avatar,bio,education,undergraduate,graduate,courses,papers,projects,achievements,social_roles,like_count,review_count,avg_rating) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const updateStmt = db.prepare('UPDATE teachers SET name=?,college=?,title=?,research=?,avatar=?,bio=?,education=?,undergraduate=?,graduate=?,courses=?,papers=?,projects=?,achievements=?,social_roles=?,like_count=?,review_count=?,avg_rating=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?');
    
    for (let i = 1; i < lines.length; i++) {
      const vals = splitCsvRow(lines[i]);
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j].trim();
        if (fieldMap[h]) row[fieldMap[h]] = vals[j] || '';
      }
      
      const name = (row.name || '').trim();
      const college = (row.college || '').trim();
      if (!name || !college) { skipped++; errors.push('第' + (i + 1) + '行: 姓名或学院为空'); continue; }
      
      const data = [
        name, college,
        row.title || '', row.research || '', row.avatar || '', row.bio || '',
        row.education || '', row.undergraduate || '', row.graduate || '',
        row.courses || '', row.papers || '', row.projects || '',
        row.achievements || '', row.social_roles || '',
        parseInt(row.like_count) || 0, parseInt(row.review_count) || 0, parseFloat(row.avg_rating) || 0
      ];
      
      if (row.id) {
        const existing = db.prepare('SELECT id FROM teachers WHERE id = ?').get(parseInt(row.id));
        if (existing) {
          updateStmt.run(...data, parseInt(row.id));
          updated++;
        } else {
          // id 存在但数据库中无此记录，按新增处理
          insertStmt.run(...data);
          created++;
        }
      } else {
        insertStmt.run(...data);
        created++;
      }
    }
    
    res.json({ ok: true, created, updated, skipped, errors: errors.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ error: '导入失败: ' + e.message });
  }
});
