// routes/wall.js - 校园墙路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { safeJSON, parseImageUrls } = require('../utils/helpers');

// ─── 文件上传配置 ──────────────────────────────────────
const WALL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'wall');
if (!fs.existsSync(WALL_UPLOAD_DIR)) fs.mkdirSync(WALL_UPLOAD_DIR, { recursive: true });

const wallStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, WALL_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith('video') ? '.mp4' : '.jpg');
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});

const wallUpload = multer({
  storage: wallStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('只支持图片和视频文件'));
  }
});

// ─── 发帖 ──────────────────────────────────────────────
router.post('/posts', requireAuth, wallUpload.array('files', 9), (req, res) => JSON_RES(res, () => {
  const { phone, nickname, avatar, content, gif_urls } = req.body;
  if (!phone || !content) return makeError('缺少手机号或内容', ErrorCode.PARAM_MISSING);
  const files = req.files || [];
  const imageUrls = files.filter(f => f.mimetype.startsWith('image/')).map(f => '/uploads/wall/' + f.filename);
  const videoUrls = files.filter(f => f.mimetype.startsWith('video/')).map(f => '/uploads/wall/' + f.filename);
  const images = [...imageUrls, ...videoUrls].join(',');
  const r = db.prepare(`INSERT INTO wall_posts (phone, nickname, avatar, content, images, gif_urls, like_count, comment_count, exposure_count, exposure_done, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, datetime('now','localtime'), datetime('now','localtime'))`)
    .run(phone, nickname || '匿名', avatar || '', content, images, gif_urls || '');
  return { ok: true, id: r.lastInsertRowid };
}));

// ─── 信息流 ──────────────────────────────────────────────
router.get('/feed', (req, res) => JSON_RES(res, () => {
  const { tab, phone, page, limit } = req.query;
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(50, parseInt(limit) || 20);
  const offset = (p - 1) * l;
  let posts;
  if (tab === 'following' && phone) {
    posts = db.prepare(`SELECT p.* FROM wall_posts p
      JOIN wall_follows f ON f.following_phone = p.phone AND f.follower_phone = ?
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(phone, l, offset);
  } else if (tab === 'hot') {
    posts = db.prepare(`SELECT * FROM wall_posts WHERE exposure_done = 1 ORDER BY like_count DESC, created_at DESC LIMIT ? OFFSET ?`).all(l, offset);
  } else {
    posts = db.prepare(`SELECT * FROM wall_posts ORDER BY exposure_done ASC, created_at DESC LIMIT ? OFFSET ?`).all(l, offset);
  }
  // 更新曝光
  if (phone) {
    const insExp = db.prepare("INSERT OR IGNORE INTO wall_exposures (post_id, phone, created_at) VALUES (?, ?, datetime('now','localtime'))");
    const updExp = db.prepare('UPDATE wall_posts SET exposure_count = exposure_count + 1, exposure_done = CASE WHEN exposure_count >= 2 THEN 1 ELSE 0 END WHERE id = ?');
    posts.forEach(post => {
      try { insExp.run(post.id, phone); updExp.run(post.id); } catch (e) {}
    });
  }
  // 关注状态
  const followSet = new Set();
  if (phone) {
    db.prepare('SELECT following_phone FROM wall_follows WHERE follower_phone = ?').all(phone).forEach(f => followSet.add(f.following_phone));
  }
  return posts.map(p => {
    // 如果帖子头像是旧emoji/空，尝试从用户表同步最新头像
    let avatar = p.avatar;
    if (!avatar || (!avatar.startsWith('/') && !avatar.startsWith('http'))) {
      const user = db.prepare('SELECT avatar FROM users WHERE phone = ?').get(p.phone)
        || db.prepare('SELECT avatar FROM riders WHERE phone = ?').get(p.phone);
      if (user && user.avatar && (user.avatar.startsWith('/') || user.avatar.startsWith('http'))) avatar = user.avatar;
    }
    return {
      ...p,
      avatar,
      images: parseImageUrls(p.images),
      gif_urls: safeJSON(p.gif_urls),
      isFollowing: followSet.has(p.phone)
    };
  });
}));

// ─── 帖子详情 ────────────────────────────────────────────
router.get('/posts/:id', (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id = ?').get(req.params.id);
  if (!post) return makeError('帖子不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  // 同步最新头像
  let postAvatar = post.avatar;
  if (!postAvatar || (!postAvatar.startsWith('/') && !postAvatar.startsWith('http'))) {
    const user = db.prepare('SELECT avatar FROM users WHERE phone = ?').get(post.phone)
      || db.prepare('SELECT avatar FROM riders WHERE phone = ?').get(post.phone);
    if (user && user.avatar && (user.avatar.startsWith('/') || user.avatar.startsWith('http'))) postAvatar = user.avatar;
  }
  const comments = db.prepare('SELECT * FROM wall_comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  // 评论头像同步
  const enrichedComments = comments.map(c => {
    let cAvatar = c.avatar;
    if (!cAvatar || (!cAvatar.startsWith('/') && !cAvatar.startsWith('http'))) {
      const cu = db.prepare('SELECT avatar FROM users WHERE phone = ?').get(c.phone)
        || db.prepare('SELECT avatar FROM riders WHERE phone = ?').get(c.phone);
      if (cu && cu.avatar && (cu.avatar.startsWith('/') || cu.avatar.startsWith('http'))) cAvatar = cu.avatar;
    }
    return { ...c, avatar: cAvatar };
  });
  return {
    ...post,
    avatar: postAvatar,
    images: parseImageUrls(post.images),
    gif_urls: safeJSON(post.gif_urls),
    comments: enrichedComments
  };
}));

// ─── 点赞 ──────────────────────────────────────────────
router.post('/posts/:id/like', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  if (!phone) return makeError('缺少手机号', ErrorCode.PARAM_MISSING);
  const post = db.prepare('SELECT phone, nickname FROM wall_posts WHERE id = ?').get(req.params.id);
  const existing = db.prepare('SELECT id FROM wall_likes WHERE post_id = ? AND phone = ?').get(req.params.id, phone);
  if (existing) {
    db.prepare('DELETE FROM wall_likes WHERE id = ?').run(existing.id);
    db.prepare('UPDATE wall_posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(req.params.id);
    return { ok: true, liked: false };
  } else {
    db.prepare("INSERT INTO wall_likes (post_id, phone, created_at) VALUES (?, ?, datetime('now','localtime'))").run(req.params.id, phone);
    db.prepare('UPDATE wall_posts SET like_count = like_count + 1 WHERE id = ?').run(req.params.id);
    // 通知帖子作者
    if (post && post.phone !== phone) {
      const liker = db.prepare('SELECT name FROM users WHERE phone = ?').get(phone) || db.prepare('SELECT name FROM riders WHERE phone = ?').get(phone);
      db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_like', ?, ?, 0, datetime('now','localtime'))")
        .run(post.phone, '收到点赞', `${liker?.name || '有人'} 赞了你的帖子`);
    }
    return { ok: true, liked: true };
  }
}));

// ─── 评论 ──────────────────────────────────────────────
router.post('/posts/:id/comments', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname } = req.body;
  if (!phone || !content) return makeError('缺少手机号或内容', ErrorCode.PARAM_MISSING);
  const result = db.prepare(`INSERT INTO wall_comments (post_id, phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname, like_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now','localtime'))`)
    .run(req.params.id, phone, nickname || '匿名', avatar || '', content, parent_id || null, reply_to_phone || '', reply_to_nickname || '');
  db.prepare('UPDATE wall_posts SET comment_count = comment_count + 1 WHERE id = ?').run(req.params.id);
  // 通知
  const post = db.prepare('SELECT phone, nickname FROM wall_posts WHERE id = ?').get(req.params.id);
  const commenter = nickname || '有人';
  if (parent_id && reply_to_phone) {
    // 回复评论 → 通知被回复者
    if (reply_to_phone !== phone) {
      db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_comment', ?, ?, 0, datetime('now','localtime'))")
        .run(reply_to_phone, '收到回复', `${commenter} 回复了你的评论: ${content.length > 30 ? content.slice(0,30) + '...' : content}`);
    }
    // 同时通知帖子作者（如果不是自己评论自己的帖子且不是回复帖子作者）
    if (post && post.phone !== phone && post.phone !== reply_to_phone) {
      db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_comment', ?, ?, 0, datetime('now','localtime'))")
        .run(post.phone, '帖子新评论', `${commenter} 评论了你的帖子`);
    }
  } else if (post && post.phone !== phone) {
    // 普通评论 → 通知帖子作者
    db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_comment', ?, ?, 0, datetime('now','localtime'))")
      .run(post.phone, '帖子新评论', `${commenter} 评论了你的帖子: ${content.length > 30 ? content.slice(0,30) + '...' : content}`);
  }
  return { ok: true, id: result.lastInsertRowid };
}));

// ─── 评论点赞 ──────────────────────────────────────────
router.post('/comments/:commentId/like', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone } = req.body;
  if (!phone) return makeError('缺少手机号', ErrorCode.PARAM_MISSING);
  const existing = db.prepare('SELECT id FROM wall_comment_likes WHERE comment_id = ? AND phone = ?').get(req.params.commentId, phone);
  if (existing) {
    db.prepare('DELETE FROM wall_comment_likes WHERE id = ?').run(existing.id);
    db.prepare('UPDATE wall_comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(req.params.commentId);
    return { ok: true, liked: false };
  } else {
    db.prepare("INSERT INTO wall_comment_likes (comment_id, phone, created_at) VALUES (?, ?, datetime('now','localtime'))").run(req.params.commentId, phone);
    db.prepare('UPDATE wall_comments SET like_count = like_count + 1 WHERE id = ?').run(req.params.commentId);
    // 通知评论作者
    const comment = db.prepare('SELECT phone, nickname FROM wall_comments WHERE id = ?').get(req.params.commentId);
    if (comment && comment.phone !== phone) {
      const liker = db.prepare('SELECT name FROM users WHERE phone = ?').get(phone) || db.prepare('SELECT name FROM riders WHERE phone = ?').get(phone);
      db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_like', ?, ?, 0, datetime('now','localtime'))")
        .run(comment.phone, '评论获赞', `${liker?.name || '有人'} 赞了你的评论`);
    }
    return { ok: true, liked: true };
  }
}));

// ─── 关注 ──────────────────────────────────────────────
router.post('/follow', requireAuth, (req, res) => JSON_RES(res, () => {
  const { follower_phone, following_phone } = req.body;
  if (!follower_phone || !following_phone) return makeError('缺少手机号', ErrorCode.PARAM_MISSING);
  if (follower_phone === following_phone) return makeError('不能关注自己', ErrorCode.WALL_CANNOT_FOLLOW_SELF);
  const existing = db.prepare('SELECT id FROM wall_follows WHERE follower_phone = ? AND following_phone = ?').get(follower_phone, following_phone);
  if (existing) {
    db.prepare('DELETE FROM wall_follows WHERE id = ?').run(existing.id);
    return { ok: true, following: false };
  } else {
    db.prepare("INSERT INTO wall_follows (follower_phone, following_phone, created_at) VALUES (?, ?, datetime('now','localtime'))").run(follower_phone, following_phone);
    return { ok: true, following: true };
  }
}));

// ─── 用户主页 ────────────────────────────────────────────
router.get('/user/:phone', (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const posts = db.prepare('SELECT * FROM wall_posts WHERE phone = ? ORDER BY created_at DESC LIMIT 20').all(phone);
  const followers = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE following_phone = ?').get(phone).n;
  const following = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE follower_phone = ?').get(phone).n;
  const user = db.prepare('SELECT name,phone,avatar FROM users WHERE phone = ?').get(phone)
    || db.prepare('SELECT name,phone,avatar FROM riders WHERE phone = ?').get(phone)
    || { name: '匿名', phone, avatar: '' };
  return {
    nickname: user.name,
    avatar: user.avatar || '',
    phone,
    followers,
    following,
    postCount: posts.length,
    posts: posts.map(p => ({ ...p, images: parseImageUrls(p.images), gif_urls: safeJSON(p.gif_urls) }))
  };
}));

// ─── 删除帖子 ────────────────────────────────────────────
router.delete('/posts/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  db.prepare('DELETE FROM wall_posts WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_likes WHERE post_id = ?').run(req.params.id);
  return { ok: true };
}));

module.exports = router;
