// routes/pets.js - 猫狗日记路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { auditFromReq } = require('../utils/audit');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { safeJSON, parseImageUrls } = require('../utils/helpers');
const { withCompress } = require('../utils/upload');
const aiChecker = require('./ai');

// ─── AI审核记录写入辅助 ────────────────────────────────
function logAiReview(source, sourceId, phone, contentPreview, check, action) {
  try {
    db.prepare(`INSERT INTO ai_review_logs (source, source_id, phone, content_preview, violation, level, category, reason, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(source, sourceId, phone, (contentPreview || '').slice(0, 100),
        check.violation ? 1 : 0, check.level || 'none', check.category || '无', check.reason || '', action || 'pass');
  } catch(e) { console.error('[AI审核] 写入审核记录失败:', e.message); }
}

// ─── 创建表 ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_name TEXT UNIQUE NOT NULL,
    species TEXT NOT NULL DEFAULT 'cat' CHECK(species IN ('cat','dog')),
    breed TEXT DEFAULT '',
    gender TEXT DEFAULT 'unknown' CHECK(gender IN ('male','female','unknown')),
    age TEXT DEFAULT '',
    color TEXT DEFAULT '',
    location TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    images TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    last_seen_at TEXT DEFAULT '',
    alert_level TEXT DEFAULT 'none' CHECK(alert_level IN ('none','warning','urgent','critical')),
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','missing','adopted','graduated')),
    health_status TEXT DEFAULT 'healthy' CHECK(health_status IN ('healthy','sick','injured','pregnant','nursing','quarantine','other')),
    health_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS pet_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    content TEXT DEFAULT '',
    images TEXT DEFAULT '',
    gif_url TEXT DEFAULT '',
    like_count INTEGER DEFAULT 0,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS pet_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS pet_sightings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    location TEXT DEFAULT '',
    note TEXT DEFAULT '',
    photo TEXT DEFAULT '',
    health_status TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ─── 数据库迁移：添加新列 ────────────────────────────────────
try { db.prepare('ALTER TABLE pets ADD COLUMN health_status TEXT DEFAULT "healthy"').run(); } catch(e) {}
try { db.prepare('ALTER TABLE pets ADD COLUMN health_note TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE pet_sightings ADD COLUMN photo TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE pet_sightings ADD COLUMN health_status TEXT DEFAULT ""').run(); } catch(e) {}

// ─── 文件上传配置 ────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'pets');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|gif|webp|mp4|mov|avi)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('仅支持图片和视频文件'));
  }
});

// ─── 猫狗列表 ────────────────────────────────────────────
router.get('/list', (req, res) => JSON_RES(res, () => {
  const { species, status, search, limit } = req.query;
  let sql = 'SELECT * FROM pets WHERE 1=1';
  const params = [];
  if (species && species !== 'all') { sql += ' AND species = ?'; params.push(species); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND code_name LIKE ?'; const kw = '%' + search + '%'; params.push(kw); }
  sql += ` ORDER BY CASE WHEN alert_level = 'critical' THEN 0 WHEN alert_level = 'urgent' THEN 1 WHEN alert_level = 'warning' THEN 2 ELSE 3 END, updated_at DESC`;
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  const pets = db.prepare(sql).all(...params);
  const now = Date.now();
  return pets.map(p => {
    let daysSinceSeen = null;
    let displayAlert = p.alert_level;
    if (p.last_seen_at) {
      daysSinceSeen = Math.floor((now - new Date(p.last_seen_at).getTime()) / (1000*60*60*24));
      if (daysSinceSeen >= 30) displayAlert = 'critical';
      else if (daysSinceSeen >= 15) displayAlert = 'urgent';
      else if (daysSinceSeen >= 7) displayAlert = 'warning';
      else displayAlert = 'none';
    }
    return {
      ...p,
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      images: parseImageUrls(p.images),
      avatar: p.avatar || (p.species === 'cat' ? '🐱' : '🐶'),
      daysSinceSeen,
      alert_level: displayAlert
    };
  });
}));

// ─── 猫狗详情 ────────────────────────────────────────────
router.get('/detail/:id', (req, res) => JSON_RES(res, () => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  // 获取最新评论
  let comments = db.prepare(
    'SELECT * FROM pet_comments WHERE pet_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

  // 屏蔽过滤（双向）：排除双向屏蔽用户的评论
  let viewerPhoneForPets = '';
  const authHdr = req.headers.authorization;
  if (authHdr && authHdr.startsWith('Bearer ')) {
    try {
      const { verifyToken } = require('../utils/jwt');
      const decoded = verifyToken(authHdr.slice(7));
      if (decoded && decoded.phone) viewerPhoneForPets = decoded.phone;
    } catch (e) {}
  }
  if (viewerPhoneForPets) {
    const bp = new Set(db.prepare('SELECT blocked_phone FROM wall_blocks WHERE blocker_phone = ?').all(viewerPhoneForPets).map(r => r.blocked_phone));
    const bb = new Set(db.prepare('SELECT blocker_phone FROM wall_blocks WHERE blocked_phone = ?').all(viewerPhoneForPets).map(r => r.blocker_phone));
    if (bp.size > 0 || bb.size > 0) comments = comments.filter(c => !bp.has(c.phone) && !bb.has(c.phone));
  }

  // 评论头像同步
  const enrichedComments = comments.map(c => {
    let cAvatar = c.avatar;
    if (!cAvatar || (!cAvatar.startsWith('/') && !cAvatar.startsWith('http'))) {
      const cu = db.prepare('SELECT avatar FROM users WHERE phone = ?').get(c.phone)
        || db.prepare('SELECT avatar FROM riders WHERE phone = ?').get(c.phone);
      if (cu && cu.avatar && (cu.avatar.startsWith('/') || cu.avatar.startsWith('http'))) cAvatar = cu.avatar;
    }
    return { ...c, avatar: cAvatar, images: parseImageUrls(c.images) };
  });

  // 获取标签相关的校园墙帖子（最新5条）
  let relatedPosts = [];
  if (pet.tags) {
    const tags = pet.tags.split(',').filter(Boolean);
    if (tags.length > 0) {
      const conditions = tags.map(() => `(wp.tags LIKE ? OR wp.ai_tags LIKE ? OR wp.content LIKE ?)`).join(' OR ');
      const params = [];
      tags.forEach(t => { params.push(`%${t}%`, `%${t}%`, `%${t}%`); });
      try {
        relatedPosts = db.prepare(
          `SELECT wp.id, wp.phone, wp.nickname, wp.avatar, wp.content, wp.tags, wp.images, wp.like_count, wp.comment_count, wp.created_at
           FROM wall_posts wp
           WHERE (${conditions})
           ORDER BY wp.created_at DESC LIMIT 5`
        ).all(...params);
        relatedPosts = relatedPosts.map(p => ({
          ...p,
          tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
          images: parseImageUrls(p.images)
        }));
      } catch (e) { console.error('[pets] 相关帖子查询失败:', e.message); }
    }
  }

  // 检查今日是否已点赞
  let userLiked = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyToken } = require('../utils/jwt');
      const decoded = verifyToken(authHeader.slice(7));
      if (decoded && decoded.phone) {
        const likeRow = db.prepare(
          "SELECT id FROM pet_likes WHERE pet_id = ? AND phone = ? AND date(created_at) = date('now','localtime')"
        ).get(req.params.id, decoded.phone);
        userLiked = !!likeRow;
      }
    } catch (e) { /* token无效忽略 */ }
  }

  return {
    ...pet,
    tags: pet.tags ? pet.tags.split(',').filter(Boolean) : [],
    images: parseImageUrls(pet.images),
    avatar: pet.avatar || (pet.species === 'cat' ? '🐱' : '🐶'),
    daysSinceSeen: pet.last_seen_at ? Math.floor((Date.now() - new Date(pet.last_seen_at).getTime()) / (1000*60*60*24)) : null,
    alert_level: pet.alert_level || 'none',
    userLiked,
    comments: enrichedComments,
    relatedPosts
  };
}));

// ─── 点赞猫狗（当天可切换赞/取消） ─────────────────────
router.post('/like/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  if (!phone) return makeError('请先登录', ErrorCode.AUTH_001, 401);
  const pet = db.prepare('SELECT id FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  // 今天是否已点赞（当天内可切换）
  const todayLike = db.prepare(
    "SELECT id FROM pet_likes WHERE pet_id = ? AND phone = ? AND date(created_at) = date('now','localtime')"
  ).get(req.params.id, phone);
  if (todayLike) {
    // 当天已赞 → 取消
    db.prepare('DELETE FROM pet_likes WHERE id = ?').run(todayLike.id);
    db.prepare('UPDATE pets SET like_count = like_count - 1 WHERE id = ?').run(req.params.id);
    const cnt = db.prepare('SELECT like_count FROM pets WHERE id = ?').get(req.params.id).like_count;
    return { liked: false, like_count: cnt };
  }
  // 当天未赞 → 点赞
  db.prepare('INSERT INTO pet_likes (pet_id, phone) VALUES (?, ?)').run(req.params.id, phone);
  db.prepare("UPDATE pets SET like_count = like_count + 1, updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  const cnt = db.prepare('SELECT like_count FROM pets WHERE id = ?').get(req.params.id).like_count;
  return { liked: true, like_count: cnt };
}));

// ─── 留言 ────────────────────────────────────────────────
router.post('/comment/:id', requireAuth, upload.array('media', 6), (req, res) => JSON_RES(res, async () => {
  const { phone, nickname, content, parent_id } = req.body;
  if (!phone) return makeError('请先登录', ErrorCode.AUTH_001, 401);
  if (!content && (!req.files || req.files.length === 0)) return makeError('请输入内容或上传媒体', ErrorCode.PARAM_001, 400);

  const pet = db.prepare('SELECT id FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  // ── AI审核留言文字 ────────────────────────────
  if (content) {
    try {
      const aiResult = await aiChecker.checkTextContent(content, '猫狗日记');
      if (aiResult.violation && aiResult.level === 'high') {
        // 删除已上传的文件
        if (req.files && req.files.length > 0) {
          req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
        }
        console.log(`[AI审核] 猫狗留言被拦截: phone=${phone}, level=${aiResult.level}, reason=${aiResult.reason}`);
        logAiReview('pet_comment', 0, phone, content, aiResult, 'block');
        return makeError('留言内容不符合平台规范：' + (aiResult.reason || '请修改后重新发布'), 'AI_001');
      }
      if (aiResult.violation) console.log(`[AI审核] 猫狗留言提醒(未拦截): phone=${phone}, level=${aiResult.level}`);
    } catch (e) {
      console.error('[AI审核] 猫狗留言审核失败(放行):', e.message);
    }
  }

  // 获取用户头像
  let avatar = '';
  const user = db.prepare('SELECT avatar FROM users WHERE phone = ?').get(phone)
    || db.prepare('SELECT avatar FROM riders WHERE phone = ?').get(phone);
  if (user && user.avatar) avatar = user.avatar;

  // 处理上传文件
  const imagePaths = [];
  if (req.files && req.files.length > 0) {
    req.files.forEach(f => {
      imagePaths.push('/uploads/pets/' + f.filename);
    });
  }

  const images = imagePaths.length > 0 ? imagePaths.join(',') : '';
  const stmt = db.prepare(
    `INSERT INTO pet_comments (pet_id, phone, nickname, avatar, content, images, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(req.params.id, phone, nickname || '', avatar, content || '', images, parent_id || null);
  db.prepare(`UPDATE pets SET comment_count = comment_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);

  // 记录AI审核日志
  if (content) {
    logAiReview('pet_comment', result.lastInsertRowid, phone, content, { violation: false, level: 'none', category: '无', reason: '' }, 'pass');
  }

  return { id: result.lastInsertRowid, message: '留言成功' };
}));

// ─── 删除留言 ────────────────────────────────────────────
router.delete('/comment/:commentId', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  const comment = db.prepare('SELECT * FROM pet_comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return makeError('留言不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  if (comment.phone !== phone) return makeError('只能删除自己的留言', ErrorCode.AUTH_002, 403);
  db.prepare('DELETE FROM pet_comments WHERE id = ?').run(req.params.commentId);
  db.prepare('UPDATE pets SET comment_count = comment_count - 1 WHERE id = ?').run(comment.pet_id);
  return { message: '已删除' };
}));

// ─── 管理端：添加猫狗 ────────────────────────────────────
router.post('/admin/add', requireAdmin, upload.array('images', 6), (req, res) => JSON_RES(res, () => {
  const { code_name, species, breed, gender, age, color, location, personality, tags, bio, health_status, health_note } = req.body;
  if (!code_name) return makeError('代号必填', ErrorCode.PARAM_001, 400);

  const existing = db.prepare('SELECT id FROM pets WHERE code_name = ?').get(code_name);
  if (existing) return makeError('代号已存在', ErrorCode.PARAM_002, 400);

  let avatar = req.body.avatar || '';
  const imagePaths = [];
  if (req.files && req.files.length > 0) {
    req.files.forEach(f => imagePaths.push('/uploads/pets/' + f.filename));
    if (!avatar) avatar = imagePaths[0];
  }

  const stmt = db.prepare(
    `INSERT INTO pets (code_name, species, breed, gender, age, color, location, personality, tags, avatar, images, bio, health_status, health_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(code_name, species || 'cat', breed || '', gender || 'unknown', age || '', color || '', location || '', personality || '', tags || '', avatar, imagePaths.join(',') || '', bio || '', health_status || 'healthy', health_note || '');
  auditFromReq(req, 'pet.create', { type: 'pet', id: result.lastInsertRowid }, `添加猫狗: ${code_name}`);
  return { id: result.lastInsertRowid, message: '添加成功' };
}));

// ─── 管理端：更新猫狗 ────────────────────────────────────
router.put('/admin/update/:id', requireAdmin, upload.array('images', 6), (req, res) => JSON_RES(res, () => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  const { code_name, species, breed, gender, age, color, location, personality, tags, bio, status, health_status, health_note } = req.body;
  const imagePaths = [];
  if (req.files && req.files.length > 0) {
    req.files.forEach(f => imagePaths.push('/uploads/pets/' + f.filename));
  }
  const existingImages = pet.images || '';
  const newImages = imagePaths.length > 0 ? (existingImages ? existingImages + ',' + imagePaths.join(',') : imagePaths.join(',')) : existingImages;

  db.prepare(
    `UPDATE pets SET code_name=COALESCE(?,code_name), species=COALESCE(?,species), breed=COALESCE(?,breed),
     gender=COALESCE(?,gender), age=COALESCE(?,age), color=COALESCE(?,color), location=COALESCE(?,location),
     personality=COALESCE(?,personality), tags=COALESCE(?,tags), bio=COALESCE(?,bio), images=?, status=COALESCE(?,status),
     health_status=COALESCE(?,health_status), health_note=COALESCE(?,health_note),
     updated_at=datetime('now','localtime') WHERE id=?`
  ).run(
    code_name || null, species || null, breed || null, gender || null, age || null, color || null,
    location || null, personality || null, tags || null, bio || null, newImages, status || null,
    health_status || null, health_note || null, req.params.id
  );
  return { message: '更新成功' };
}));

  // ─── 管理端：删除猫狗 ────────────────────────────────────
router.delete('/admin/delete/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const pet = db.prepare('SELECT code_name FROM pets WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM pet_comments WHERE pet_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pet_likes WHERE pet_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pet_sightings WHERE pet_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pets WHERE id = ?').run(req.params.id);
  auditFromReq(req, 'pet.delete', { type: 'pet', id: req.params.id }, `删除猫狗: ${pet?.code_name || '#' + req.params.id}`);
  return { message: '已删除' };
}));

// ─── 管理端：更新状态 ────────────────────────────────────
router.put('/admin/status/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { status } = req.body;
  const pet = db.prepare('SELECT id FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  const validStatus = ['active', 'missing', 'adopted', 'graduated'];
  if (!status || !validStatus.includes(status)) return makeError('无效状态', ErrorCode.PARAM_001, 400);
  db.prepare(`UPDATE pets SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(status, req.params.id);
  return { message: '状态已更新', status };
}));

// ─── 管理端：更新健康状态 ────────────────────────────────────
router.put('/admin/health-status/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { health_status, health_note } = req.body;
  const pet = db.prepare('SELECT id FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  const validStatus = ['healthy', 'sick', 'injured', 'pregnant', 'nursing', 'quarantine', 'other'];
  if (!health_status || !validStatus.includes(health_status)) return makeError('无效健康状态', ErrorCode.PARAM_001, 400);
  db.prepare(`UPDATE pets SET health_status = ?, health_note = COALESCE(?,health_note), updated_at = datetime('now','localtime') WHERE id = ?`).run(health_status, health_note !== undefined ? health_note : null, req.params.id);
  return { message: '健康状态已更新', health_status };
}));

// ─── 管理端：目击记录查询 ────────────────────────────────────
router.get('/admin/sightings/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const sightings = db.prepare(
    `SELECT ps.*, u.nickname as user_nickname, u.avatar as user_avatar
     FROM pet_sightings ps
     LEFT JOIN users u ON ps.phone = u.phone
     WHERE ps.pet_id = ? ORDER BY ps.created_at DESC LIMIT 50`
  ).all(req.params.id);
  return sightings;
}));

// ─── 用户端：目击记录 ────────────────────────────────
router.get('/sightings/:id', (req, res) => JSON_RES(res, () => {
  const sightings = db.prepare(
    `SELECT ps.*, u.nickname as user_nickname, u.avatar as user_avatar
     FROM pet_sightings ps
     LEFT JOIN users u ON ps.phone = u.phone
     WHERE ps.pet_id = ? AND ps.status = 'approved' ORDER BY ps.created_at DESC LIMIT 20`
  ).all(req.params.id);
  return sightings;
}));

// ─── 目击打卡：用户看到猫狗时记录 ──────────────────────
router.post('/sight/:id', requireAuth, upload.single('photo'), (req, res) => JSON_RES(res, () => {
  const { phone, location, note, health_status } = req.body;
  if (!phone) return makeError('请先登录', ErrorCode.AUTH_001, 401);
  if (!location || !location.trim()) return makeError('请填写目击地点', ErrorCode.PARAM_INVALID, 400);
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  // 照片是必须的
  let photo = '';
  if (req.file) {
    photo = '/uploads/pets/' + req.file.filename;
  } else {
    return makeError('请上传照片', ErrorCode.PARAM_INVALID, 400);
  }

  // 获取用户昵称
  let nickname = '';
  const user = db.prepare('SELECT nickname FROM users WHERE phone = ?').get(phone);
  if (user && user.nickname) nickname = user.nickname;
  else {
    const rider = db.prepare('SELECT name FROM riders WHERE phone = ?').get(phone);
    if (rider && rider.name) nickname = rider.name;
  }

  // 写入目击记录（待审核），不立即更新last_seen_at
  const validHealth = ['healthy', 'sick', 'injured', 'pregnant', 'nursing', 'quarantine', 'other'];
  const hs = (health_status && validHealth.includes(health_status)) ? health_status : '';
  const result = db.prepare(`INSERT INTO pet_sightings (pet_id, phone, nickname, location, note, photo, health_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`)
    .run(req.params.id, phone, nickname, location.trim(), note || '', photo, hs);

  return { message: '上报成功，等待管理端审核确认', sighting_id: result.lastInsertRowid };
}));

// ─── 告警检测：检查所有猫狗的失联状态 ────────────────────
router.get('/alert-check', (req, res) => JSON_RES(res, () => {
  const pets = db.prepare(`SELECT id, code_name, species, last_seen_at, alert_level, status FROM pets WHERE status = 'active'`).all();
  const now = Date.now();
  const alerts = { warning: [], urgent: [], critical: [] };

  pets.forEach(p => {
    if (!p.last_seen_at) return;
    const lastSeen = new Date(p.last_seen_at).getTime();
    const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24);

    let newLevel = 'none';
    if (daysSince >= 30) newLevel = 'critical';
    else if (daysSince >= 15) newLevel = 'urgent';
    else if (daysSince >= 7) newLevel = 'warning';

    // 更新告警等级（只升不降，打卡时重置）
    if (newLevel !== 'none') {
      if (newLevel === 'critical' || p.alert_level !== 'critical') {
        db.prepare('UPDATE pets SET alert_level = ? WHERE id = ?').run(newLevel, p.id);
      }
      const speciesEmoji = p.species === 'cat' ? '🐱' : '🐶';
      const info = { id: p.id, code_name: p.code_name, species: p.species, speciesEmoji, last_seen_at: p.last_seen_at, daysSince: Math.round(daysSince), alert_level: newLevel };
      alerts[newLevel].push(info);
    }
  });

  return {
    total: pets.length,
    warning: alerts.warning,    // 7-14天
    urgent: alerts.urgent,      // 15-29天
    critical: alerts.critical,  // 30天+
    summary: {
      warning: alerts.warning.length,
      urgent: alerts.urgent.length,
      critical: alerts.critical.length
    }
  };
}));

// ─── 管理端审核目击记录 ──────────────────────────────
router.put('/admin/review-sighting/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { action } = req.body; // 'approve' | 'reject'
  if (!action || !['approve', 'reject'].includes(action)) return makeError('无效操作', ErrorCode.PARAM_INVALID, 400);

  const sighting = db.prepare('SELECT * FROM pet_sightings WHERE id = ?').get(req.params.id);
  if (!sighting) return makeError('目击记录不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  if (sighting.status !== 'pending') return makeError('该记录已审核', ErrorCode.PARAM_INVALID, 400);

  if (action === 'approve') {
    // 更新目击记录状态
    db.prepare(`UPDATE pet_sightings SET status = 'approved', reviewed_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);
    // 更新猫狗最后目击时间 + 重置告警
    db.prepare(`UPDATE pets SET last_seen_at = datetime('now','localtime'), alert_level = 'none', updated_at = datetime('now','localtime') WHERE id = ?`).run(sighting.pet_id);
    // 如果上报了健康状态，同步更新宠物健康状态
    if (sighting.health_status) {
      db.prepare(`UPDATE pets SET health_status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(sighting.health_status, sighting.pet_id);
    }
    return { message: '审核通过，已更新目击时间' };
  } else {
    db.prepare(`UPDATE pet_sightings SET status = 'rejected', reviewed_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);
    return { message: '已驳回' };
  }
}));

// ─── 管理端获取待审核目击列表 ──────────────────────────
router.get('/admin/pending-sightings', requireAdmin, (req, res) => JSON_RES(res, () => {
  const sightings = db.prepare(`
    SELECT ps.*, p.code_name, p.species, u.nickname as user_nickname, u.avatar as user_avatar
    FROM pet_sightings ps
    LEFT JOIN pets p ON ps.pet_id = p.id
    LEFT JOIN users u ON ps.phone = u.phone
    WHERE ps.status = 'pending'
    ORDER BY ps.created_at DESC
  `).all();
  return sightings;
}));

// ─── 举报猫狗帖子/留言 ───────────────────────────────────
router.post('/report', requireAuth, (req, res) => JSON_RES(res, () => {
  const { target_type, target_id, target_content, reason, detail } = req.body;
  const phone = req.user.phone;
  if (!target_type || !target_id || !reason) return makeError('参数不完整');
  if (!['post', 'comment'].includes(target_type)) return makeError('举报类型无效');
  const existing = db.prepare('SELECT id FROM reports WHERE source=? AND target_type=? AND target_id=? AND reporter_phone=?').get('pet', target_type, target_id, phone);
  if (existing) return makeError('您已举报过该内容');
  db.prepare(`INSERT INTO reports (source,target_type,target_id,target_content,reporter_phone,reason,detail,status,created_at) VALUES ('pet',?,?,?,?,?,?,'pending',datetime('now','localtime'))`)
    .run(target_type, target_id, (target_content||'').slice(0,200), phone, reason, detail||'');
  return { ok: true };
}));

module.exports = router;
