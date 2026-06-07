// routes/pets.js - 猫狗日记路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { safeJSON, parseImageUrls } = require('../utils/helpers');

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
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(pet_id, phone)
  );
`);

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
  const { species, status } = req.query;
  let sql = 'SELECT * FROM pets WHERE 1=1';
  const params = [];
  if (species && species !== 'all') { sql += ' AND species = ?'; params.push(species); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ` ORDER BY CASE WHEN alert_level = 'critical' THEN 0 WHEN alert_level = 'urgent' THEN 1 WHEN alert_level = 'warning' THEN 2 ELSE 3 END, updated_at DESC`;
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
  const comments = db.prepare(
    'SELECT * FROM pet_comments WHERE pet_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

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

  return {
    ...pet,
    tags: pet.tags ? pet.tags.split(',').filter(Boolean) : [],
    images: parseImageUrls(pet.images),
    avatar: pet.avatar || (pet.species === 'cat' ? '🐱' : '🐶'),
    daysSinceSeen: pet.last_seen_at ? Math.floor((Date.now() - new Date(pet.last_seen_at).getTime()) / (1000*60*60*24)) : null,
    alert_level: pet.alert_level || 'none',
    comments: enrichedComments,
    relatedPosts
  };
}));

// ─── 点赞猫狗 ────────────────────────────────────────────
router.post('/like/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  if (!phone) return makeError('请先登录', ErrorCode.AUTH_001, 401);
  const pet = db.prepare('SELECT id FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  const existing = db.prepare('SELECT id FROM pet_likes WHERE pet_id = ? AND phone = ?').get(req.params.id, phone);
  if (existing) {
    db.prepare('DELETE FROM pet_likes WHERE id = ?').run(existing.id);
    db.prepare('UPDATE pets SET like_count = like_count - 1 WHERE id = ?').run(req.params.id);
    return { liked: false, like_count: db.prepare('SELECT like_count FROM pets WHERE id = ?').get(req.params.id).like_count };
  } else {
    db.prepare("INSERT INTO pet_likes (pet_id, phone) VALUES (?, ?)").run(req.params.id, phone);
    db.prepare('UPDATE pets SET like_count = like_count + 1, updated_at = datetime("now","localtime") WHERE id = ?').run(req.params.id);
    return { liked: true, like_count: db.prepare('SELECT like_count FROM pets WHERE id = ?').get(req.params.id).like_count };
  }
}));

// ─── 留言 ────────────────────────────────────────────────
router.post('/comment/:id', requireAuth, upload.array('media', 6), (req, res) => JSON_RES(res, () => {
  const { phone, nickname, content, parent_id } = req.body;
  if (!phone) return makeError('请先登录', ErrorCode.AUTH_001, 401);
  if (!content && (!req.files || req.files.length === 0)) return makeError('请输入内容或上传媒体', ErrorCode.PARAM_001, 400);

  const pet = db.prepare('SELECT id FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

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
  db.prepare('UPDATE pets SET comment_count = comment_count + 1, updated_at = datetime("now","localtime") WHERE id = ?').run(req.params.id);

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
  const { code_name, species, breed, gender, age, color, location, personality, tags, bio } = req.body;
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
    `INSERT INTO pets (code_name, species, breed, gender, age, color, location, personality, tags, avatar, images, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(code_name, species || 'cat', breed || '', gender || 'unknown', age || '', color || '', location || '', personality || '', tags || '', avatar, imagePaths.join(',') || '', bio || '');
  return { id: result.lastInsertRowid, message: '添加成功' };
}));

// ─── 管理端：更新猫狗 ────────────────────────────────────
router.put('/admin/update/:id', requireAdmin, upload.array('images', 6), (req, res) => JSON_RES(res, () => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  const { code_name, species, breed, gender, age, color, location, personality, tags, bio, status } = req.body;
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
     updated_at=datetime('now','localtime') WHERE id=?`
  ).run(
    code_name || null, species || null, breed || null, gender || null, age || null, color || null,
    location || null, personality || null, tags || null, bio || null, newImages, status || null, req.params.id
  );
  return { message: '更新成功' };
}));

// ─── 管理端：删除猫狗 ────────────────────────────────────
router.delete('/admin/delete/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM pet_comments WHERE pet_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pet_likes WHERE pet_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pets WHERE id = ?').run(req.params.id);
  return { message: '已删除' };
}));

// ─── 目击打卡：用户看到猫狗时记录 ──────────────────────
router.post('/sight/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  if (!phone) return makeError('请先登录', ErrorCode.AUTH_001, 401);
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return makeError('猫狗不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);

  // 更新最后目击时间 + 重置告警等级
  db.prepare(`UPDATE pets SET last_seen_at = datetime('now','localtime'), alert_level = 'none', updated_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);

  return { message: '打卡成功，已记录目击时间', last_seen_at: new Date().toLocaleString('zh-CN') };
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

module.exports = router;
