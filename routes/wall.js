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
    if (!phone || !content) return res.status(400).json({ error: '缺少手机号或内容', code: 'SYS_002' });
    const files = req.files || [];
    const imageUrls = files.filter(f => f.mimetype.startsWith('image/')).map(f => '/uploads/wall/' + f.filename);
    const videoUrls = files.filter(f => f.mimetype.startsWith('video/')).map(f => '/uploads/wall/' + f.filename);
    const images = [...imageUrls, ...videoUrls].join(',');

    // ── 标签提取：从前端传来的tags + 从内容中自动提取 #话题# ──────
    const userTags = Array.isArray(tags) ? tags : (tags ? tags.split(',').filter(Boolean) : []);
    const hashTags = [];
    const hashRegex = /#([^#\s]{1,20})#/g;
    let m;
    while ((m = hashRegex.exec(content)) !== null) {
      const t = m[1].trim();
      if (t && !hashTags.includes(t)) hashTags.push(t);
    }
    // 合并去重，用户选的标签 + #话题#提取
    const allTags = [...new Set([...userTags, ...hashTags])];
    const tagsStr = allTags.join(',');

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
  const { tab, phone, page, limit, tag } = req.query;
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(50, parseInt(limit) || 20);
  const offset = (p - 1) * l;
  let posts;
  // 标签筛选
  if (tag) {
    if (tab === 'following' && phone) {
      posts = db.prepare(`SELECT p.* FROM wall_posts p
        JOIN wall_follows f ON f.following_phone = p.phone AND f.follower_phone = ?
        WHERE p.tags LIKE ?
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(phone, '%' + tag + '%', l, offset);
    } else if (tab === 'hot') {
      posts = db.prepare(`SELECT * FROM wall_posts WHERE exposure_done = 1 AND tags LIKE ? ORDER BY like_count DESC, created_at DESC LIMIT ? OFFSET ?`).all('%' + tag + '%', l, offset);
    } else {
      posts = db.prepare(`SELECT * FROM wall_posts WHERE tags LIKE ? ORDER BY exposure_done ASC, created_at DESC LIMIT ? OFFSET ?`).all('%' + tag + '%', l, offset);
    }
  } else if (tab === 'following' && phone) {
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
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      ai_tags: p.ai_tags ? p.ai_tags.split(',').filter(Boolean) : [],
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

  return posts.map(p => {
    let avatar = p.avatar;
    if (!avatar || (!avatar.startsWith('/') && !avatar.startsWith('http'))) {
      const user = db.prepare('SELECT avatar FROM users WHERE phone = ?').get(p.phone)
        || db.prepare('SELECT avatar FROM riders WHERE phone = ?').get(p.phone);
      if (user && user.avatar && (user.avatar.startsWith('/') || user.avatar.startsWith('http'))) avatar = user.avatar;
    }
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

module.exports = router;
module.exports.classifyTags = classifyTags;
