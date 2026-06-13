// routes/wall.js - 校园墙路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { safeJSON, parseImageUrls, validateUploadFile } = require('../utils/helpers');
const aiChecker = require('./ai');

// ─── 批量头像加载（避免 N+1 查询） ──────────────────────
function batchLoadAvatars(phones) {
  const unique = [...new Set(phones)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const map = new Map();
  const placeholders = unique.map(() => '?').join(',');
  try {
    db.prepare(`SELECT phone, avatar FROM users WHERE phone IN (${placeholders})`).all(...unique)
      .forEach(r => { if (r.avatar) map.set(r.phone, r.avatar); });
  } catch(e) {}
  try {
    const remaining = unique.filter(p => !map.has(p));
    if (remaining.length > 0) {
      const ph2 = remaining.map(() => '?').join(',');
      db.prepare(`SELECT phone, avatar FROM riders WHERE phone IN (${ph2})`).all(...remaining)
        .forEach(r => { if (r.avatar && !map.has(r.phone)) map.set(r.phone, r.avatar); });
    }
  } catch(e) {}
  return map;
}
function resolveAvatar(postPhone, postAvatar, avatarMap) {
  if (postAvatar && (postAvatar.startsWith('/') || postAvatar.startsWith('http'))) return postAvatar;
  const fromMap = avatarMap.get(postPhone);
  if (fromMap && (fromMap.startsWith('/') || fromMap.startsWith('http'))) return fromMap;
  return postAvatar || '';
}

// ─── AI审核记录写入辅助 ────────────────────────────────
function logAiReview(source, sourceId, phone, contentPreview, check, action) {
  try {
    db.prepare(`INSERT INTO ai_review_logs (source, source_id, phone, content_preview, violation, level, category, reason, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(source, sourceId, phone, (contentPreview || '').slice(0, 100),
        check.violation ? 1 : 0, check.level || 'none', check.category || '无', check.reason || '', action || 'pass');
  } catch(e) { console.error('[AI审核] 写入审核记录失败:', e.message); }
}

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

// ─── 清理已上传文件（审核不通过时） ────────────────────
function cleanupUploadedFiles(files) {
  if (!files || !Array.isArray(files)) return;
  files.forEach(f => {
    try {
      const fullPath = path.join(WALL_UPLOAD_DIR, f.filename);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) { /* 清理失败不影响主流程 */ }
  });
}

// ─── 发帖（含AI自动审核） ────────────────────────────────
router.post('/posts', requireAuth, wallUpload.array('files', 9), async (req, res) => {
  try {
    const { phone, nickname, avatar, content, gif_urls, tags } = req.body;
    if (!phone || !content) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: '缺少手机号或内容', code: 'SYS_002' });
    }
    const files = req.files || [];

    // 文件魔数校验
    for (const f of files) {
      const validation = validateUploadFile(f);
      if (!validation.valid) {
        cleanupUploadedFiles(files);
        return res.status(400).json({ error: validation.error, code: 'PARAM_INVALID' });
      }
    }

    const imageUrls = files.filter(f => f.mimetype.startsWith('image/')).map(f => '/uploads/wall/' + f.filename);
    const videoUrls = files.filter(f => f.mimetype.startsWith('video/')).map(f => '/uploads/wall/' + f.filename);
    const images = [...imageUrls, ...videoUrls].join(',');

    // ── 标签提取：只使用前端传来的标签（前端已处理选择逻辑）──────
    const tagsList = Array.isArray(tags) ? tags : (tags ? tags.split(',').filter(Boolean) : []);
    const tagsStr = tagsList.join(',');

    // 清理内容中的#话题#标记（保留纯文本）
    const cleanContent = content.replace(/#([^#\s]{1,20})#/g, '$1');

    // ── AI自动审核（同步，写入前拦截） ──────────────────
    let aiResult = { violation: false, level: 'none', category: '无', reason: '' };
    try {
      aiResult = await aiChecker.checkWallPost({
        title: '', content, topic: '',
        images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : '[]'
      });
      if (aiResult.violation && aiResult.level === 'high') {
        cleanupUploadedFiles(files);
        console.log(`[AI审核] 校园墙帖子被拦截: phone=${phone}, level=${aiResult.level}, reason=${aiResult.reason}`);
        logAiReview('wall_post', 0, phone, content, aiResult, 'block');
        return res.status(403).json({
          error: '内容不符合平台规范：' + (aiResult.reason || '请修改后重新发布'),
          code: 'AI_001', detail: aiResult.category
        });
      }
      if (aiResult.violation) console.log(`[AI审核] 校园墙帖子提醒(未拦截): phone=${phone}, level=${aiResult.level}, reason=${aiResult.reason}`);
      else console.log(`[AI审核] 校园墙帖子审核通过: phone=${phone}`);
    } catch (e) {
      console.error('[AI审核] 校园墙帖子审核失败(放行):', e.message);
    }

    const r = db.prepare(`INSERT INTO wall_posts (phone, nickname, avatar, content, tags, ai_tags, images, gif_urls, like_count, comment_count, exposure_count, exposure_done, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', ?, ?, 0, 0, 0, 0, datetime('now','localtime'), datetime('now','localtime'))`)
      .run(phone, nickname || '匿名', avatar || '', cleanContent, tagsStr, images, gif_urls || '');
    logAiReview('wall_post', r.lastInsertRowid, phone, content, aiResult, 'pass');

    // ── AI异步分类归解标签（不阻塞发布） ──────────────
    const postId = r.lastInsertRowid;
    setImmediate(async () => {
      try {
        const aiTags = await classifyTags(cleanContent, allTags);
        if (aiTags && aiTags.length > 0) {
          db.prepare('UPDATE wall_posts SET ai_tags = ? WHERE id = ?').run(aiTags.join(','), postId);
          console.log(`[AI分类] 帖子${postId} 归纳标签: ${aiTags.join(',')}`);
        }
      } catch (e) {
        console.error('[AI分类] 失败(不影响发布):', e.message);
      }
    });

    res.json({ ok: true, id: postId });
  } catch (e) {
    console.error('[ERROR] 发帖失败:', e.message, e.stack);
    res.status(500).json({ error: '服务器内部错误', code: 'SYS_001' });
  }
});

// ─── 信息流 ──────────────────────────────────────────────
router.get('/feed', (req, res) => JSON_RES(res, () => {
  const { tab, phone, page, limit, tag, author_phone } = req.query;
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(50, parseInt(limit) || 20);
  const offset = (p - 1) * l;
  let posts;

  // 大分类→子标签映射（与前端 TAG_CATEGORIES 保持一致）
  const CATEGORY_MAP = getCategoryMap();

  // 标签筛选（支持大分类筛选）
  if (tag) {
    const subs = CATEGORY_MAP[tag]; // 如果是大分类，获取其子标签
    let tagWhere, tagParams;
    if (subs && subs.length > 0) {
      // 大分类筛选：匹配大分类本身或任一子标签
      const conditions = subs.map(() => 'tags LIKE ?').join(' OR ');
      tagWhere = `(${conditions} OR tags LIKE ?)`;
      tagParams = [...subs.map(s => '%' + s + '%'), '%' + tag + '%'];
    } else {
      tagWhere = 'tags LIKE ?';
      tagParams = ['%' + tag + '%'];
    }

    if (tab === 'following' && phone) {
      posts = db.prepare(`SELECT p.* FROM wall_posts p
        JOIN wall_follows f ON f.following_phone = p.phone AND f.follower_phone = ?
        WHERE p.${tagWhere.replace(/tags/g, 'p.tags')}
        ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?`).all(phone, ...tagParams, l, offset);
    } else if (tab === 'hot') {
      posts = db.prepare(`SELECT * FROM wall_posts WHERE exposure_done = 1 AND ${tagWhere} ORDER BY is_pinned DESC, like_count DESC, created_at DESC LIMIT ? OFFSET ?`).all(...tagParams, l, offset);
    } else {
      posts = db.prepare(`SELECT * FROM wall_posts WHERE ${tagWhere} ORDER BY is_pinned DESC, exposure_done ASC, created_at DESC LIMIT ? OFFSET ?`).all(...tagParams, l, offset);
    }
  } else if (tab === 'following' && phone) {
    posts = db.prepare(`SELECT p.* FROM wall_posts p
      JOIN wall_follows f ON f.following_phone = p.phone AND f.follower_phone = ?
      ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?`).all(phone, l, offset);
  } else if (tab === 'hot') {
    posts = db.prepare(`SELECT * FROM wall_posts WHERE exposure_done = 1 ORDER BY is_pinned DESC, like_count DESC, created_at DESC LIMIT ? OFFSET ?`).all(l, offset);
  } else {
    posts = db.prepare(`SELECT * FROM wall_posts ORDER BY is_pinned DESC, exposure_done ASC, created_at DESC LIMIT ? OFFSET ?`).all(l, offset);
  }
  // 屏蔽过滤：排除被当前用户屏蔽的用户的帖子
  if (phone) {
    const blockedPhones = new Set(
      db.prepare('SELECT blocked_phone FROM wall_blocks WHERE blocker_phone = ?').all(phone).map(r => r.blocked_phone)
    );
    if (blockedPhones.size > 0) {
      posts = posts.filter(p => !blockedPhones.has(p.phone));
    }
  }
  // 按作者筛选（用于卖家校园墙等场景）
  if (author_phone) {
    posts = posts.filter(p => p.phone === author_phone);
  }
  // 注意：浏览量只在点开帖子详情时计数（见 GET /posts/:id），feed列表不计数
  // 关注状态
  const followSet = new Set();
  if (phone) {
    db.prepare('SELECT following_phone FROM wall_follows WHERE follower_phone = ?').all(phone).forEach(f => followSet.add(f.following_phone));
  }
  // 批量加载所有帖子作者头像（避免 N+1）
  const avatarMap = batchLoadAvatars(posts.map(p => p.phone));
  const resultPosts = posts.map(p => {
    // 帖子头像从批量查询的结果中取
    let avatar = resolveAvatar(p.phone, p.avatar, avatarMap);
    return {
      ...p,
      avatar,
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      ai_tags: p.ai_tags ? p.ai_tags.split(',').filter(Boolean) : [],
      images: parseImageUrls(p.images),
      gif_urls: safeJSON(p.gif_urls),
      isFollowing: followSet.has(p.phone)
    };
  });
  return { posts: resultPosts, hasMore: resultPosts.length >= l };
}));

// ─── 帖子详情 ────────────────────────────────────────────
router.get('/posts/:id', (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id = ?').get(req.params.id);
  if (!post) return makeError('帖子不存在', ErrorCode.WALL_POST_NOT_FOUND, 404);
  // 记录浏览量（点开详情才算浏览）
  try {
    const viewerPhone = req.query.phone || '';
    if (viewerPhone) {
      db.prepare("INSERT OR IGNORE INTO wall_exposures (post_id, phone, created_at) VALUES (?, ?, datetime('now','localtime'))").run(req.params.id, viewerPhone);
      db.prepare('UPDATE wall_posts SET exposure_count = exposure_count + 1 WHERE id = ?').run(req.params.id);
    }
  } catch (e) {}
  const comments = db.prepare('SELECT * FROM wall_comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  // 批量加载帖主+所有评论者头像（避免 N+1）
  const allPhones = [post.phone, ...comments.map(c => c.phone)];
  const detailAvatarMap = batchLoadAvatars(allPhones);
  let postAvatar = resolveAvatar(post.phone, post.avatar, detailAvatarMap);
  const enrichedComments = comments.map(c => ({
    ...c,
    avatar: resolveAvatar(c.phone, c.avatar, detailAvatarMap)
  }));
  return {
    ...post,
    avatar: postAvatar,
    tags: post.tags ? post.tags.split(',').filter(Boolean) : [],
    ai_tags: post.ai_tags ? post.ai_tags.split(',').filter(Boolean) : [],
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

// ─── 评论（含AI自动审核） ───────────────────────────────
router.post('/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const { phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname } = req.body;
    if (!phone || !content) return res.status(400).json({ error: '缺少手机号或内容', code: 'SYS_002' });

    // ── AI自动审核评论内容 ──────────────────────────────
    let aiResult = { violation: false, level: 'none', category: '无', reason: '' };
    try {
      aiResult = await aiChecker.checkTextContent(content, '校园社交平台');
      if (aiResult.violation && aiResult.level === 'high') {
        console.log(`[AI审核] 校园墙评论被拦截: phone=${phone}, level=${aiResult.level}, reason=${aiResult.reason}`);
        logAiReview('wall_comment', 0, phone, content, aiResult, 'block');
        return res.status(403).json({
          error: '评论内容不符合平台规范：' + (aiResult.reason || '请修改后重新发布'),
          code: 'AI_001', detail: aiResult.category
        });
      }
      if (aiResult.violation) console.log(`[AI审核] 校园墙评论提醒(未拦截): phone=${phone}, level=${aiResult.level}, reason=${aiResult.reason}`);
      else console.log(`[AI审核] 校园墙评论审核通过: phone=${phone}`);
    } catch (e) {
      console.error('[AI审核] 校园墙评论审核失败(放行):', e.message);
    }

    const result = db.prepare(`INSERT INTO wall_comments (post_id, phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname, like_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now','localtime'))`)
      .run(req.params.id, phone, nickname || '匿名', avatar || '', content, parent_id || null, reply_to_phone || '', reply_to_nickname || '');
    logAiReview('wall_comment', result.lastInsertRowid, phone, content, aiResult, 'pass');
    db.prepare('UPDATE wall_posts SET comment_count = comment_count + 1 WHERE id = ?').run(req.params.id);
    // 通知
    const post = db.prepare('SELECT phone, nickname FROM wall_posts WHERE id = ?').get(req.params.id);
    const commenter = nickname || '有人';
    if (parent_id && reply_to_phone) {
      if (reply_to_phone !== phone) {
        db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_comment', ?, ?, 0, datetime('now','localtime'))")
          .run(reply_to_phone, '收到回复', `${commenter} 回复了你的评论: ${content.length > 30 ? content.slice(0,30) + '...' : content}`);
      }
      if (post && post.phone !== phone && post.phone !== reply_to_phone) {
        db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_comment', ?, ?, 0, datetime('now','localtime'))")
          .run(post.phone, '帖子新评论', `${commenter} 评论了你的帖子`);
      }
    } else if (post && post.phone !== phone) {
      db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'wall_comment', ?, ?, 0, datetime('now','localtime'))")
        .run(post.phone, '帖子新评论', `${commenter} 评论了你的帖子: ${content.length > 30 ? content.slice(0,30) + '...' : content}`);
    }
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    console.error('[ERROR] 评论失败:', e.message, e.stack);
    res.status(500).json({ error: '服务器内部错误', code: 'SYS_001' });
  }
});

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
router.get('/user/:phone', optionalAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const posts = db.prepare('SELECT * FROM wall_posts WHERE phone = ? ORDER BY created_at DESC LIMIT 20').all(phone);
  const followers = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE following_phone = ?').get(phone).n;
  const following = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE follower_phone = ?').get(phone).n;
  const user = db.prepare('SELECT name,phone,avatar,bio,bg_image,bg_color,wechat,qq,dormitory,room,nickname,wall_privacy FROM users WHERE phone = ?').get(phone)
    || db.prepare('SELECT name,phone,avatar FROM riders WHERE phone = ?').get(phone)
    || { name: '匿名', phone, avatar: '' };

  // 隐私检查：判断查看者与目标用户的关系
  const viewer = req.user ? req.user.phone : null;
  const isSelf = viewer === phone;
  let viewerFollowsTarget = false;
  let targetFollowsViewer = false;
  if (viewer && !isSelf) {
    viewerFollowsTarget = !!db.prepare('SELECT 1 FROM wall_follows WHERE follower_phone=? AND following_phone=?').get(viewer, phone);
    targetFollowsViewer = !!db.prepare('SELECT 1 FROM wall_follows WHERE follower_phone=? AND following_phone=?').get(phone, viewer);
  }
  // 关系级别: 0=无关系, 1=我关注了他(他是我的粉丝), 2=他关注了我(他是我关注的), 3=互关
  const relLevel = (viewerFollowsTarget ? 1 : 0) + (targetFollowsViewer ? 2 : 0);
  // 判断某个隐私等级是否对当前查看者放行
  function canSee(privacyLevel) {
    if (isSelf) return true;                    // 自己永远可见
    if (privacyLevel === 0) return true;         // 所有人可见
    if (privacyLevel === 4) return false;        // 禁止所有人
    if (privacyLevel === 1 && (relLevel & 1)) return true;  // 仅关注可见(他是我的粉丝)
    if (privacyLevel === 2 && (relLevel & 2)) return true;  // 关注我才可见(我关注了他)
    if (privacyLevel === 3 && relLevel === 3) return true;  // 互相关注
    return false;
  }

  // 解析用户隐私设置
  let wp = {};
  try { if (user.wall_privacy) wp = JSON.parse(user.wall_privacy); } catch(e) {}

  return {
    nickname: user.nickname || user.name,
    name: user.name || '',
    avatar: user.avatar || '',
    bio: user.bio || '',
    bg_image: user.bg_image || '',
    bg_color: user.bg_color || '',
    phone,
    phoneDisplay: canSee(wp.phone != null ? wp.phone : 0) ? phone : (phone ? phone.slice(0,3)+'****'+phone.slice(-4) : ''),
    showName: canSee(wp.name != null ? wp.name : 0),
    wechat: canSee(wp.wechat != null ? wp.wechat : 0) ? (user.wechat || '') : '',
    qq: canSee(wp.qq != null ? wp.qq : 0) ? (user.qq || '') : '',
    dormitory: canSee(wp.dorm != null ? wp.dorm : 0) ? (user.dormitory || '') : '',
    room: canSee(wp.dorm != null ? wp.dorm : 0) ? (user.room || '') : '',
    followers,
    following,
    postCount: posts.length,
    posts: posts.map(p => ({ ...p, images: parseImageUrls(p.images), gif_urls: safeJSON(p.gif_urls) }))
  };
}));

// ─── 关注列表 ────────────────────────────────────────────
router.get('/following/:phone', (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const list = db.prepare(`
    SELECT u.name as nickname, u.phone, u.avatar, 'following' as relation
    FROM wall_follows f
    LEFT JOIN users u ON u.phone = f.following_phone
    WHERE f.follower_phone = ?
    ORDER BY f.created_at DESC
  `).all(phone);
  return list.map(u => ({
    ...u,
    nickname: u.nickname || u.phone,
    avatar: u.avatar || ''
  }));
}));

// ─── 粉丝列表 ────────────────────────────────────────────
router.get('/followers/:phone', (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const myFollowing = new Set(
    db.prepare('SELECT following_phone FROM wall_follows WHERE follower_phone = ?').all(phone).map(f => f.following_phone)
  );
  const list = db.prepare(`
    SELECT u.name as nickname, u.phone, u.avatar
    FROM wall_follows f
    LEFT JOIN users u ON u.phone = f.follower_phone
    WHERE f.following_phone = ?
    ORDER BY f.created_at DESC
  `).all(phone);
  return list.map(u => ({
    ...u,
    nickname: u.nickname || u.phone,
    avatar: u.avatar || '',
    isFollowing: myFollowing.has(u.phone)
  }));
}));

// ─── 删除帖子 ────────────────────────────────────────────
router.delete('/posts/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT phone FROM wall_posts WHERE id = ?').get(req.params.id);
  if (!post) return makeError('帖子不存在', ErrorCode.NOT_FOUND);
  // 仅允许帖主删除（管理员可通过举报管理台处理）
  if (post.phone !== req.user.phone) return makeError('只能删除自己的帖子', ErrorCode.FORBIDDEN);
  db.prepare('DELETE FROM wall_posts WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_likes WHERE post_id = ?').run(req.params.id);
  return { ok: true };
}));

// ─── 搜索帖子 ──────────────────────────────────────────
router.get('/search', (req, res) => JSON_RES(res, () => {
  const { q, phone, page, limit } = req.query;
  if (!q || !q.trim()) return makeError('缺少搜索关键词', ErrorCode.PARAM_MISSING);
  const keyword = '%' + q.trim() + '%';
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(50, parseInt(limit) || 20);
  const offset = (p - 1) * l;

  // 搜索内容 + tags + ai_tags
  const posts = db.prepare(
    "SELECT * FROM wall_posts WHERE content LIKE ? OR tags LIKE ? OR ai_tags LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(keyword, keyword, keyword, l, offset);

  // 关注状态
  const followSet = new Set();
  if (phone) {
    db.prepare('SELECT following_phone FROM wall_follows WHERE follower_phone = ?').all(phone).forEach(f => followSet.add(f.following_phone));
  }

  // 批量头像（避免 N+1）
  const avatarMap = batchLoadAvatars(posts.map(p => p.phone));
  return posts.map(p => {
    let avatar = resolveAvatar(p.phone, p.avatar, avatarMap);
    return {
      ...p,
      avatar,
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      ai_tags: p.ai_tags ? p.ai_tags.split(',').filter(Boolean) : [],
      images: parseImageUrls(p.images),
      gif_urls: safeJSON(p.gif_urls),
      isFollowing: followSet.has(p.phone)
    };
  });
}));

// ─── 搜索用户（按昵称）─────────────────────────────────
router.get('/users', (req, res) => JSON_RES(res, () => {
  const { q } = req.query;
  if (!q || !q.trim()) return makeError('缺少搜索关键词', ErrorCode.PARAM_MISSING);
  const keyword = '%' + q.trim() + '%';
  // 从 wall_posts 中按手机号去重搜索发帖过的人，同时查 users 表的 name
  const users = db.prepare(
    `SELECT DISTINCT wp.phone, wp.nickname, wp.avatar, COUNT(wp.id) as post_count
     FROM wall_posts wp
     WHERE wp.nickname LIKE ?
     GROUP BY wp.phone
     ORDER BY post_count DESC
     LIMIT 20`
  ).all(keyword);
  // 也查 users 表
  const usersFromUsers = db.prepare(
    `SELECT phone, name as nickname, avatar, 0 as post_count
     FROM users WHERE name LIKE ?
     LIMIT 10`
  ).all(keyword);
  // 合并去重（按phone）
  const seen = new Set();
  const merged = [];
  for (const u of [...users, ...usersFromUsers]) {
    if (!seen.has(u.phone) && u.nickname) {
      seen.add(u.phone);
      merged.push(u);
    }
  }
  return merged.slice(0, 20);
}));

// ─── 屏蔽用户 ──────────────────────────────────────────
router.post('/users/block', requireAuth, (req, res) => JSON_RES(res, () => {
  const { blockedPhone } = req.body;
  const blockerPhone = req.user.phone;
  if (!blockedPhone) return makeError('缺少被屏蔽用户手机号', ErrorCode.PARAM_MISSING);
  if (blockerPhone === blockedPhone) return makeError('不能屏蔽自己', ErrorCode.PARAM_INVALID);
  const existing = db.prepare('SELECT id FROM wall_blocks WHERE blocker_phone = ? AND blocked_phone = ?').get(blockerPhone, blockedPhone);
  if (!existing) {
    db.prepare('INSERT INTO wall_blocks (blocker_phone, blocked_phone) VALUES (?, ?)').run(blockerPhone, blockedPhone);
  }
  return { ok: true, blocked: true };
}));

router.delete('/users/block/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const blockerPhone = req.user.phone;
  const blockedPhone = req.params.phone;
  db.prepare('DELETE FROM wall_blocks WHERE blocker_phone = ? AND blocked_phone = ?').run(blockerPhone, blockedPhone);
  return { ok: true, blocked: false };
}));

router.get('/users/blocks', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const blocks = db.prepare(
    `SELECT wb.id, wb.blocked_phone, wb.created_at,
            COALESCE(u.nickname, u.name, wp.nickname, '未知用户') as nickname,
            u.avatar
     FROM wall_blocks wb
     LEFT JOIN users u ON wb.blocked_phone = u.phone
     LEFT JOIN (SELECT DISTINCT phone, nickname FROM wall_posts) wp ON wb.blocked_phone = wp.phone
     WHERE wb.blocker_phone = ?
     ORDER BY wb.created_at DESC`
  ).all(phone);
  return blocks;
}));

// ─── 热门标签 ──────────────────────────────────────────
router.get('/tags/hot', (req, res) => JSON_RES(res, () => {
  const { limit } = req.query;
  const l = Math.min(50, parseInt(limit) || 20);
  // 统计所有标签出现频次(tags + ai_tags)
  const posts = db.prepare('SELECT tags, ai_tags FROM wall_posts ORDER BY created_at DESC LIMIT 500').all();
  const tagCount = {};
  posts.forEach(p => {
    const allTagStr = [p.tags, p.ai_tags].filter(Boolean).join(',');
    allTagStr.split(',').filter(Boolean).forEach(t => {
      t = t.trim();
      if (t) tagCount[t] = (tagCount[t] || 0) + 1;
    });
  });
  const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, l);
  return sorted.map(([name, count]) => ({ name, count }));
}));

// ─── AI标签分类归纳 ────────────────────────────────────
async function classifyTags(content, userTags) {
  const tagList = userTags.length > 0 ? userTags.join('\u3001') : '\u65E0';
  const messages = [
    {
      role: 'system',
      content: `你是一个校园社交平台的内容分类AI。根据用户发布的内容，提取并归纳最相关的分类标签。

规则：
1. 从内容中识别出关键话题、场景、情感等
2. 将用户自带的标签做语义归化（如"期末考"→"考试"，"四六级"→"考试"，"外卖"→"美食"，"失恋"→"情感"，"实习"→"就业"，"考研"→"升学"，"快递"→"生活"）
3. 标签应当是概括性的类别词，不是具体事件名
4. 返回3-5个标签，按相关性排序
5. 标签池参考（可扩展）：日常|考试|学习|情感|美食|求助|吐槽|活动|闲置|就业|升学|生活|运动|旅行|音乐|游戏|考研|实习|兼职|租房|快递|社交|兴趣

严格以JSON格式回复：
{"tags": ["标签1", "标签2", "标签3"]}
只返回JSON。`
    },
    { role: 'user', content: '内容: ' + content + '\n用户标签: ' + tagList }
  ];
  try {
    const result = await aiChecker.callDeepSeek(messages, 256);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [];
    }
    return [];
  } catch (e) {
    console.error('[AI分类] 调用失败:', e.message);
    return [];
  }
}

// ─── 我的校园墙统计 ──────────────────────────────────
router.get('/my-stats/:phone', (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  const followers = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE following_phone = ?').get(phone).n;
  const following = db.prepare('SELECT COUNT(*) as n FROM wall_follows WHERE follower_phone = ?').get(phone).n;
  // 获赞总数：我的帖子被点赞的总数
  const totalLikes = db.prepare(`
    SELECT COALESCE(SUM(wp.like_count), 0) as n FROM wall_posts wp WHERE wp.phone = ?
  `).get(phone).n;
  // 浏览量：我的帖子的曝光总数
  const totalViews = db.prepare(`
    SELECT COALESCE(SUM(wp.exposure_count), 0) as n FROM wall_posts wp WHERE wp.phone = ?
  `).get(phone).n;
  // 帖子数
  const postCount = db.prepare('SELECT COUNT(*) as n FROM wall_posts WHERE phone = ?').get(phone).n;
  return { followers, following, totalLikes, totalViews, postCount };
}));

// ─── 我的浏览者列表 ──────────────────────────────────
router.get('/my-viewers/:phone', (req, res) => JSON_RES(res, () => {
  const phone = req.params.phone;
  // 查看谁浏览过我的帖子
  const viewers = db.prepare(`
    SELECT u.name as nickname, u.phone, u.avatar, COUNT(DISTINCT we.post_id) as view_count,
      MAX(we.created_at) as last_view_at
    FROM wall_exposures we
    JOIN wall_posts wp ON wp.id = we.post_id AND wp.phone = ?
    LEFT JOIN users u ON u.phone = we.phone
    WHERE we.phone != ?
    GROUP BY we.phone
    ORDER BY view_count DESC, last_view_at DESC
    LIMIT 50
  `).all(phone, phone);
  // 获取我关注的人
  const myFollowing = new Set(
    db.prepare('SELECT following_phone FROM wall_follows WHERE follower_phone = ?').all(phone)
      .map(f => f.following_phone)
  );
  return viewers.map(v => ({
    ...v,
    nickname: v.nickname || v.phone,
    avatar: v.avatar || '',
    isFollowing: myFollowing.has(v.phone),
    viewCount: v.view_count
  }));
}));

// ─── 举报帖子/评论 ──────────────────────────────────────
router.post('/report', requireAuth, (req, res) => JSON_RES(res, () => {
  const { target_type, target_id, reason, detail } = req.body;
  const phone = req.user.phone;
  if (!target_type || !target_id || !reason) return makeError('参数不完整');
  if (!['post', 'comment'].includes(target_type)) return makeError('举报类型无效');
  const validReasons = ['广告推广', '色情低俗', '诈骗信息', '人身攻击', '虚假信息', '侵权内容', '其他'];
  if (!validReasons.includes(reason)) return makeError('举报原因无效');

  // 防止重复举报
  const existing = db.prepare('SELECT id FROM wall_reports WHERE target_type = ? AND target_id = ? AND reporter_phone = ?').get(target_type, target_id, phone);
  if (existing) return makeError('您已举报过该内容');

  db.prepare("INSERT INTO wall_reports (target_type, target_id, reporter_phone, reason, detail, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now','localtime'))")
    .run(target_type, target_id, phone, reason, detail || '');

  // 同步到统一举报表
  try {
    const contentCache = target_type === 'post'
      ? (db.prepare('SELECT content FROM wall_posts WHERE id=?').get(target_id) || {}).content || ''
      : (db.prepare('SELECT content FROM wall_comments WHERE id=?').get(target_id) || {}).content || '';
    db.prepare(`INSERT INTO reports (source,target_type,target_id,target_content,reporter_phone,reason,detail,status,created_at) VALUES ('wall',?,?,?,?,?,?,'pending',datetime('now','localtime'))`)
      .run(target_type, target_id, contentCache.slice(0,200), phone, reason, detail || '');
  } catch(e) { console.error('[举报] 同步到统一表失败:', e.message); }

  // 同一内容被3人以上举报时自动隐藏
  const reportCount = db.prepare('SELECT COUNT(*) as c FROM wall_reports WHERE target_type = ? AND target_id = ?').get(target_type, target_id).c;
  if (reportCount >= 3) {
    if (target_type === 'post') {
      db.prepare('UPDATE wall_posts SET exposure_done = 1 WHERE id = ?').run(target_id);
    }
    // 通知管理员
    try {
      db.prepare("INSERT INTO notifications (phone, type, title, content, read, created_at) VALUES (?, 'system', ?, ?, 0, datetime('now','localtime'))")
        .run('admin', '内容被多人举报', `一个${target_type === 'post' ? '帖子' : '评论'}被${reportCount}人举报，已自动隐藏，请及时处理`);
    } catch(e) {}
  }

  return { ok: true };
}));

// ─── 管理端：举报列表 ──────────────────────────────────
router.get('/reports', requireAdmin, (req, res) => JSON_RES(res, () => {
  const status = req.query.status || 'pending';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const where = status === 'all' ? '1=1' : "status = ?";
  const params = status === 'all' ? [] : [status];
  const total = db.prepare(`SELECT COUNT(*) as c FROM wall_reports WHERE ${where}`).get(...params).c;
  const reports = db.prepare(`SELECT r.*,
    CASE WHEN r.target_type = 'post' THEN p.content WHEN r.target_type = 'comment' THEN c.content ELSE '' END as target_content
    FROM wall_reports r
    LEFT JOIN wall_posts p ON r.target_type = 'post' AND p.id = r.target_id
    LEFT JOIN wall_comments c ON r.target_type = 'comment' AND c.id = r.target_id
    WHERE ${where}
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  return { reports, total, page, totalPages: Math.ceil(total / limit) };
}));

// ─── 管理端：处理举报 ──────────────────────────────────
router.post('/reports/:id/handle', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { action, admin_note } = req.body; // action: 'dismiss' | 'remove'
  const report = db.prepare('SELECT * FROM wall_reports WHERE id = ?').get(req.params.id);
  if (!report) return makeError('举报不存在');
  if (action === 'remove') {
    // 删除目标内容
    if (report.target_type === 'post') {
      db.prepare('DELETE FROM wall_posts WHERE id = ?').run(report.target_id);
    } else if (report.target_type === 'comment') {
      db.prepare('DELETE FROM wall_comments WHERE id = ?').run(report.target_id);
    }
    db.prepare("UPDATE wall_reports SET status = 'resolved', admin_note = ?, handled_at = datetime('now','localtime') WHERE id = ?").run(admin_note || '已删除内容', req.params.id);
  } else {
    db.prepare("UPDATE wall_reports SET status = 'dismissed', admin_note = ?, handled_at = datetime('now','localtime') WHERE id = ?").run(admin_note || '举报不成立', req.params.id);
  }
  return { ok: true };
}));

// ─── 置顶/取消置顶帖子 ─────────────────────────────────
router.post('/pin/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id=?').get(req.params.id);
  if (!post) return makeError('帖子不存在', ErrorCode.PARAM_INVALID);
  const newPin = post.is_pinned ? 0 : 1;
  db.prepare('UPDATE wall_posts SET is_pinned=? WHERE id=?').run(newPin, req.params.id);
  return { ok: true, is_pinned: newPin };
}));

// ─── 精华/取消精华帖子 ─────────────────────────────────
router.post('/feature/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id=?').get(req.params.id);
  if (!post) return makeError('帖子不存在', ErrorCode.PARAM_INVALID);
  const newFeature = post.is_featured ? 0 : 1;
  db.prepare('UPDATE wall_posts SET is_featured=? WHERE id=?').run(newFeature, req.params.id);
  return { ok: true, is_featured: newFeature };
}));

// ─── 同步前端自定义标签映射 ─────────────────────────────
let _clientCategoryMap = null;
router.post('/category-map', requireAuth, (req, res) => JSON_RES(res, () => {
  _clientCategoryMap = req.body;
  return { ok: true };
}));

// 获取合并后的 CATEGORY_MAP
function getCategoryMap() {
  if (_clientCategoryMap) return _clientCategoryMap;
  return {
    '生活': ['日常','美食','情感','树洞','打卡','穿搭','追剧'],
    '学习': ['考试','考研','竞赛','读书'],
    '求职': ['就业','实习','兼职'],
    '交易': ['二手','闲置','拼单'],
    '出行': ['拼车','快递','租房'],
    '兴趣': ['运动','音乐','摄影','数码','健身','社团'],
    '游戏': ['手游','端游','主机','电竞','开黑','攻略','Steam'],
    '社交': ['表白','活动','社交','志愿'],
    '互助': ['求助','吐槽','失物','招领'],
  };
}

// ─── 获取可分享的用户列表（关注+粉丝） ─────────────────
router.get('/shareable-users', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const mode = req.query.mode || 'shareable'; // shareable | all
  if (mode !== 'shareable') {
    // 返回所有用户（用于搜索等）
    const q = req.query.q || '';
    const users = db.prepare(`SELECT phone, nickname, avatar FROM users WHERE phone != ? AND (nickname LIKE ? OR phone LIKE ?) LIMIT 20`)
      .all(phone, `%${q}%`, `%${q}%`);
    return users;
  }
  // shareable 模式：返回关注我的人 + 我关注的人
  const followers = db.prepare('SELECT follower_phone as phone FROM wall_follows WHERE following_phone = ?').all(phone).map(r => r.phone);
  const following = db.prepare('SELECT following_phone as phone FROM wall_follows WHERE follower_phone = ?').all(phone).map(r => r.phone);
  const allPhones = [...new Set([...followers, ...following])];
  if (allPhones.length === 0) return [];
  const placeholders = allPhones.map(() => '?').join(',');
  const users = db.prepare(`SELECT phone, nickname, avatar FROM users WHERE phone IN (${placeholders})`).all(...allPhones);
  // 添加关系标签
  return users.map(u => {
    const isFollower = followers.includes(u.phone);
    const isFollowing = following.includes(u.phone);
    let relation = '';
    if (isFollower && isFollowing) relation = '互相关注';
    else if (isFollower) relation = '关注你';
    else if (isFollowing) relation = '已关注';
    return { ...u, relation };
  });
}));

// ══════════════════════════════════════════════════════
// 管理端校园墙接口（requireAdmin）
// ══════════════════════════════════════════════════════

// ─── 管理端帖子列表 ───────────────────────────────────
router.get('/admin/posts', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { page = 1, limit = 20, keyword = '', status = '' } = req.query;
  const l = Math.min(parseInt(limit) || 20, 100);
  const offset = (Math.max(1, parseInt(page) || 1) - 1) * l;

  let needsJoin = false;
  let where = [];
  let params = [];
  if (keyword) {
    where.push('(p.content LIKE ? OR p.phone LIKE ? OR u.nickname LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    needsJoin = true;
  }
  if (status === 'pinned') where.push('p.is_pinned = 1');
  if (status === 'featured') where.push('p.is_featured = 1');
  if (status === 'reported') where.push('p.id IN (SELECT target_id FROM wall_reports WHERE target_type = ? AND status = ?)'), params.push('post', 'pending');

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const countFrom = needsJoin ? 'wall_posts p LEFT JOIN users u ON p.phone = u.phone' : 'wall_posts p';

  const total = db.prepare(`SELECT COUNT(*) as c FROM ${countFrom} ${whereClause}`).get(...params).c;
  const posts = db.prepare(`
    SELECT p.*, u.nickname, u.avatar
    FROM wall_posts p
    LEFT JOIN users u ON p.phone = u.phone
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, l, offset);

  // 附加举报数
  const postIds = posts.map(p => p.id);
  let reportMap = new Map();
  if (postIds.length > 0) {
    const ph = postIds.map(() => '?').join(',');
    db.prepare(`SELECT target_id, COUNT(*) as c FROM wall_reports WHERE target_type='post' AND target_id IN (${ph}) AND status='pending' GROUP BY target_id`)
      .all(...postIds).forEach(r => reportMap.set(r.target_id, r.c));
  }

  return { posts: posts.map(p => ({ ...p, pendingReports: reportMap.get(p.id) || 0 })), total, page: parseInt(page) };
}));

// ─── 管理端删除帖子（级联删评论、点赞、举报） ──────────
router.delete('/admin/posts/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id = ?').get(req.params.id);
  if (!post) return makeError('帖子不存在', ErrorCode.PARAM_INVALID);

  db.prepare('DELETE FROM wall_comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_likes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_reports WHERE target_type = ? AND target_id = ?').run('post', req.params.id);
  db.prepare('DELETE FROM wall_posts WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

// ─── 管理端删除评论 ────────────────────────────────────
router.get('/admin/comments', requireAdmin, (req, res) => JSON_RES(res, () => {
  const { page = 1, limit = 20, keyword = '' } = req.query;
  const l = Math.min(parseInt(limit) || 20, 100);
  const offset = (Math.max(1, parseInt(page) || 1) - 1) * l;

  let where = [];
  let params = [];
  if (keyword) {
    where.push('(c.content LIKE ? OR c.phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM wall_comments c ${whereClause}`).get(...params).c;
  const comments = db.prepare(`
    SELECT c.*, u.nickname, u.avatar
    FROM wall_comments c
    LEFT JOIN users u ON c.phone = u.phone
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, l, offset);

  return { comments, total, page: parseInt(page) };
}));

// ─── 管理端删除评论 ────────────────────────────────────
router.delete('/admin/comments/:id', requireAdmin, (req, res) => JSON_RES(res, () => {
  const comment = db.prepare('SELECT * FROM wall_comments WHERE id = ?').get(req.params.id);
  if (!comment) return makeError('评论不存在', ErrorCode.PARAM_INVALID);
  db.prepare('DELETE FROM wall_comment_likes WHERE comment_id = ?').run(req.params.id);
  db.prepare('DELETE FROM wall_reports WHERE target_type = ? AND target_id = ?').run('comment', req.params.id);
  db.prepare('DELETE FROM wall_comments WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

module.exports = router;
module.exports.classifyTags = classifyTags;
