// routes/ai.js - AI 内容违规检测（DeepSeek API）
const express = require('express');
const router = express.Router();
const https = require('https');
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { JSON_RES, makeError } = require('../utils/response');
const path = require('path');
const fs = require('fs');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// ─── 数据库表初始化 ──────────────────────────────────────────
try {
  db.prepare(`CREATE TABLE IF NOT EXISTS ai_review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,           -- 来源: wall_post/wall_comment/market_item/market_comment/teacher_review
    source_id INTEGER NOT NULL,     -- 源数据ID
    phone TEXT NOT NULL,            -- 用户手机号
    content_preview TEXT DEFAULT '',-- 内容预览
    violation INTEGER DEFAULT 0,    -- 是否违规: 0/1
    level TEXT DEFAULT 'none',      -- 违规等级: high/medium/low/none
    category TEXT DEFAULT '',       -- 违规类别
    reason TEXT DEFAULT '',         -- 违规原因
    action TEXT DEFAULT 'pass',     -- 操作: pass/block/下架
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`).run();
} catch(e) { console.error('[AI审核] 创建表失败:', e.message); }

// ─── DeepSeek API 调用封装 ──────────────────────────────────
function callDeepSeek(messages, maxTokens = 1024) {
  return new Promise((resolve, reject) => {
    if (!DEEPSEEK_API_KEY) return reject(new Error('DEEPSEEK_API_KEY 未配置'));
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
    });
    const req = https.request(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message || JSON.stringify(json.error)));
          const content = json.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) {
          reject(new Error('DeepSeek API 响应解析失败: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('DeepSeek API 超时')); });
    req.write(body);
    req.end();
  });
}

// ─── 图片 base64 编码（异步） ────────────────────────────
async function imageToBase64(imgPath) {
  const full = path.join(__dirname, '..', imgPath);
  try { await fs.promises.access(full); } catch(e) { return null; }
  const buf = await fs.promises.readFile(full);
  const ext = path.extname(imgPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { mime, base64: buf.toString('base64') };
}

// ─── 检测单条商品 ──────────────────────────────────────────
async function checkMarketItem(item) {
  const parts = [];
  // 文字内容
  let textContent = `标题: ${item.title || ''}\n描述: ${item.description || ''}\n联系方式: ${item.contact || ''}`;
  parts.push(textContent);

  // 构建消息
  const messages = [
    {
      role: 'system',
      content: `你是一个校园二手交易平台的内容审核AI。请检查以下商品信息是否违规。

违规标准：
1. 违法信息：涉黄/赌/毒/枪/管制刀具/违禁品
2. 欺诈信息：虚假宣传、诈骗、传销
3. 不当内容：侮辱/歧视/人身攻击/低俗内容
4. 敏感信息：政治敏感、宗教极端
5. 不适合校园：烟草/酒精/成人用品/代写代考/答案出售
6. 价格异常：明显低于市场价的欺诈嫌疑

请严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因(无违规则为空)", "level": "high/medium/low/none", "category": "违法/欺诈/不当/敏感/校园不当/价格异常/无"}

只返回JSON，不要其他文字。`
    },
    { role: 'user', content: parts.join('\n') }
  ];

  // 如果有图片，添加图片检测
  let images = [];
  try { images = JSON.parse(item.images || '[]'); } catch(e) { images = []; }
  
  if (images.length > 0) {
    // 图片单独用一轮检测
    const imgResults = [];
    for (let i = 0; i < Math.min(images.length, 3); i++) {
      const imgData = await imageToBase64(images[i]);
      if (imgData) {
        try {
          const imgResult = await callDeepSeek([
            {
              role: 'system',
              content: `你是一个图片内容审核AI。请检查这张商品图片是否违规。
违规标准：涉黄/暴力/违法物品/虚假宣传/不当内容/不适合校园环境的内容
严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因", "level": "high/medium/low/none", "category": "色情/暴力/违法/欺诈/不当/无"}
只返回JSON。`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: '请检查这张二手交易商品图片是否有违规内容：' },
                { type: 'image_url', image_url: { url: `data:${imgData.mime};base64,${imgData.base64}` } }
              ]
            }
          ], 256);
          imgResults.push(imgResult);
        } catch(e) {
          imgResults.push(JSON.stringify({ violation: false, reason: '图片检测失败: ' + e.message, level: 'none', category: '无' }));
        }
      }
    }
    if (imgResults.length > 0) {
      parts.push('\n图片检测结果：' + imgResults.join('; '));
      messages[1].content = parts.join('\n');
      // 综合判定（文字+图片结果再过一遍）
      messages.push({ role: 'assistant', content: imgResults[0] });
      messages.push({ role: 'user', content: '综合文字和图片检测结果，给出最终判定。只返回JSON。' });
    }
  }

  try {
    const result = await callDeepSeek(messages, 512);
    // 解析JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { violation: false, reason: 'AI返回格式异常', level: 'none', category: '无', raw: result };
  } catch(e) {
    return { violation: false, reason: 'AI检测失败: ' + e.message, level: 'none', category: '无' };
  }
}

// ─── 检测单条校园墙帖子 ────────────────────────────────────
async function checkWallPost(post) {
  const messages = [
    {
      role: 'system',
      content: `你是一个校园社交平台的内容审核AI。请检查以下校园墙帖子是否含有**严重违规**内容。

**只拦截以下严重违规（level=high）：**
1. 违法信息：涉黄/赌/毒/枪/违禁品交易
2. 严重欺诈：诈骗、传销、校园贷
3. 严重人身攻击：明确的辱骂、恐吓、威胁
4. 色情内容：色情图片/文字/暗示

**以下情况不算违规（允许发布）：**
- 轻微吐槽、玩笑、日常抱怨
- 普通广告（非诈骗）
- 情感表达、争议性观点（无攻击性）
- 正常校园生活内容

请严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因(无违规则为空)", "level": "high/medium/low/none", "category": "违法/欺诈/不当/色情/无"}

只返回JSON，不要其他文字。`
    },
    {
      role: 'user',
      content: `内容: ${post.content || ''}\n话题: ${post.tags || ''}`
    }
  ];

  // 图片检测
  let images = [];
  try { images = JSON.parse(post.images || post.media || '[]'); } catch(e) { images = []; }
  
  if (images.length > 0) {
    const imgResults = [];
    for (let i = 0; i < Math.min(images.length, 3); i++) {
      const imgData = await imageToBase64(images[i]);
      if (imgData) {
        try {
          const imgResult = await callDeepSeek([
            {
              role: 'system',
              content: `你是一个图片内容审核AI。请检查这张校园墙帖子图片是否违规。
违规标准：涉黄/暴力/违法物品/低俗/不适合校园环境
严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因", "level": "high/medium/low/none", "category": "色情/暴力/违法/低俗/不当/无"}
只返回JSON。`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: '请检查这张校园墙帖子图片是否有违规内容：' },
                { type: 'image_url', image_url: { url: `data:${imgData.mime};base64,${imgData.base64}` } }
              ]
            }
          ], 256);
          imgResults.push(imgResult);
        } catch(e) {
          imgResults.push(JSON.stringify({ violation: false, reason: '图片检测失败', level: 'none', category: '无' }));
        }
      }
    }
    if (imgResults.length > 0) {
      messages.push({ role: 'assistant', content: imgResults[0] });
      messages.push({ role: 'user', content: '综合文字和图片检测结果，给出最终判定。只返回JSON。' });
    }
  }

  try {
    const result = await callDeepSeek(messages, 512);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { violation: false, reason: 'AI返回格式异常', level: 'none', category: '无', raw: result };
  } catch(e) {
    return { violation: false, reason: 'AI检测失败: ' + e.message, level: 'none', category: '无' };
  }
}

// ─── API 路由 ────────────────────────────────────────────

// 批量检测二手市场商品（必须在 /:id 之前注册）
router.post('/market/batch', requireAdmin, async (req, res) => {
  try {
    const { status = 'active', limit = 50, skip_reviewed = true } = req.body;
    // 排除已审核的商品
    let items;
    if (skip_reviewed) {
      items = db.prepare(
        "SELECT * FROM market_items WHERE status = ? AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'market_item') ORDER BY created_at DESC LIMIT ?"
      ).all(status, +limit);
    } else {
      items = db.prepare(
        "SELECT * FROM market_items WHERE status = ? ORDER BY created_at DESC LIMIT ?"
      ).all(status, +limit);
    }
    
    const results = [];
    for (const item of items) {
      try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
      const result = await checkMarketItem(item);
      results.push({ itemId: item.id, title: item.title, seller: item.seller_phone, ...result });
      // 限速：每条间隔0.5秒
      await new Promise(r => setTimeout(r, 500));
    }
    
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// 检测单个二手市场商品（放在 /batch 之后，避免路由冲突）
router.post('/market/:id', requireAdmin, async (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: '商品不存在', code: 'SYS_004' });
    try { item.images = JSON.parse(item.images || '[]'); } catch(e) { item.images = []; }
    const result = await checkMarketItem(item);
    res.json({ itemId: item.id, title: item.title, ...result });
  } catch(e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// 批量检测校园墙帖子（必须在 /:id 之前注册）
router.post('/wall/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    // 排除已审核的帖子
    let posts;
    if (skip_reviewed) {
      posts = db.prepare(
        "SELECT * FROM wall_posts WHERE id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'wall_post') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      posts = db.prepare(
        "SELECT * FROM wall_posts ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    }
    
    const results = [];
    for (const post of posts) {
      const result = await checkWallPost(post);
      results.push({ postId: post.id, title: (post.content || '').slice(0, 30), author: post.phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// 检测单个校园墙帖子（放在 /batch 之后）
router.post('/wall/:id', requireAdmin, async (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM wall_posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: '帖子不存在', code: 'SYS_004' });
    const result = await checkWallPost(post);
    res.json({ postId: post.id, title: (post.content || '').slice(0, 30), ...result });
  } catch(e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// 检测校园墙评论
router.post('/wall/comments/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    // 排除已审核的评论
    let comments;
    if (skip_reviewed) {
      comments = db.prepare(
        "SELECT c.*, p.content as post_content FROM wall_comments c LEFT JOIN wall_posts p ON c.post_id = p.id WHERE c.id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'wall_comment') ORDER BY c.created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      comments = db.prepare(
        "SELECT c.*, p.content as post_content FROM wall_comments c LEFT JOIN wall_posts p ON c.post_id = p.id ORDER BY c.created_at DESC LIMIT ?"
      ).all(+limit);
    }
    
    const results = [];
    for (const comment of comments) {
      const messages = [
        {
          role: 'system',
          content: `你是一个校园社交平台的内容审核AI。检查这条评论是否违规。
违规标准：侮辱/歧视/人身攻击/低俗/色情/违法/骚扰/广告灌水
严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因", "level": "high/medium/low/none", "category": "不当/违法/骚扰/广告/无"}
只返回JSON。`
        },
        { role: 'user', content: `帖子内容: ${(comment.post_content || '').slice(0, 100)}\n评论内容: ${comment.content || ''}` }
      ];
      
      try {
        const result = await callDeepSeek(messages, 256);
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { violation: false, reason: '格式异常', level: 'none', category: '无' };
        results.push({ commentId: comment.id, content: (comment.content || '').slice(0, 50), author: comment.phone, ...parsed });
      } catch(e) {
        results.push({ commentId: comment.id, content: (comment.content || '').slice(0, 50), author: comment.phone, violation: false, reason: '检测失败', level: 'none', category: '无' });
      }
      await new Promise(r => setTimeout(r, 500));
    }
    
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) {
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// ─── 批量检测猫狗留言 ─────────────────────────────────
router.post('/pets/comments/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let comments;
    if (skip_reviewed) {
      comments = db.prepare(
        "SELECT * FROM pet_comments WHERE content IS NOT NULL AND content != '' AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'pet_comment') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      comments = db.prepare("SELECT * FROM pet_comments WHERE content IS NOT NULL AND content != '' ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const c of comments) {
      let imgUrls = [];
      try { imgUrls = JSON.parse(c.images || '[]'); } catch(e) {}
      const result = await checkTextWithImages(c.content || '', imgUrls, '猫狗日记');
      results.push({ commentId: c.id, content: (c.content || '').slice(0, 40), author: c.phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 批量检测教师评价 ─────────────────────────────────
router.post('/teachers/reviews/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let reviews;
    if (skip_reviewed) {
      reviews = db.prepare(
        "SELECT * FROM teacher_reviews WHERE content IS NOT NULL AND content != '' AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'teacher_review') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      reviews = db.prepare("SELECT * FROM teacher_reviews WHERE content IS NOT NULL AND content != '' ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const r of reviews) {
      const result = await checkTextContent(r.content, '教师评价');
      results.push({ reviewId: r.id, content: (r.content || '').slice(0, 40), author: r.phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 批量检测校花校草报名 ─────────────────────────────
router.post('/campus-star/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let stars;
    if (skip_reviewed) {
      stars = db.prepare(
        "SELECT * FROM campus_stars WHERE status = 'active' AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'campus_star') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      stars = db.prepare("SELECT * FROM campus_stars WHERE status = 'active' ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const s of stars) {
      const photoUrls = (s.photos || '').split(',').filter(Boolean);
      const text = `姓名：${s.name}\n自我介绍：${s.intro || ''}`;
      const result = await checkTextWithImages(text, photoUrls, '校花校草');
      results.push({ starId: s.id, name: s.name, intro: (s.intro || '').slice(0, 30), phone: s.phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 批量检测校花校草评论 ─────────────────────────────
router.post('/campus-star/comments/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let comments;
    if (skip_reviewed) {
      comments = db.prepare(
        "SELECT * FROM star_comments WHERE id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'campus_star_comment') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      comments = db.prepare("SELECT * FROM star_comments ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const c of comments) {
      const result = await checkTextContent(c.content, '校花校草评论');
      results.push({ commentId: c.id, content: (c.content || '').slice(0, 40), author: c.phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 批量检测社团 ────────────────────────────────────
router.post('/clubs/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let clubs;
    if (skip_reviewed) {
      clubs = db.prepare(
        "SELECT * FROM clubs WHERE status = 'active' AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'club') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      clubs = db.prepare("SELECT * FROM clubs WHERE status = 'active' ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const c of clubs) {
      const images = c.logo ? JSON.stringify([c.logo]) : '[]';
      const result = await checkWallPost({ title: c.name, content: c.description || '', topic: '', images });
      results.push({ clubId: c.id, name: c.name, phone: c.president_phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 批量检测活动 ────────────────────────────────────
router.post('/activities/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let activities;
    if (skip_reviewed) {
      activities = db.prepare(
        "SELECT * FROM activities WHERE status = 'open' AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'activity') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      activities = db.prepare("SELECT * FROM activities WHERE status = 'open' ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const a of activities) {
      const imgUrls = [a.cover, a.promo_photo, a.qr_code].filter(Boolean);
      const result = await checkTextWithImages(
        `活动标题：${a.title}\n活动描述：${a.description || ''}`,
        imgUrls,
        '校园活动'
      );
      results.push({ activityId: a.id, title: a.title, phone: a.phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 批量检测复习资料 ─────────────────────────────────
router.post('/review-materials/batch', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip_reviewed = true } = req.body;
    let materials;
    if (skip_reviewed) {
      materials = db.prepare(
        "SELECT * FROM review_materials WHERE status = 'approved' AND id NOT IN (SELECT source_id FROM ai_review_logs WHERE source = 'review_material') ORDER BY created_at DESC LIMIT ?"
      ).all(+limit);
    } else {
      materials = db.prepare("SELECT * FROM review_materials WHERE status = 'approved' ORDER BY created_at DESC LIMIT ?").all(+limit);
    }
    const results = [];
    for (const m of materials) {
      const text = `资料标题：${m.title}\n科目：${m.subject}\n描述：${m.description || ''}`;
      const result = await checkTextContent(text, '校园复习资料');
      results.push({ materialId: m.id, title: m.title, uploader: m.uploader_phone, ...result });
      await new Promise(r => setTimeout(r, 500));
    }
    const violations = results.filter(r => r.violation);
    res.json({ total: results.length, violations: violations.length, results });
  } catch(e) { res.status(500).json({ error: e.message, code: 'SYS_001' }); }
});

// ─── 审核记录查询API ─────────────────────────────────
// 查询审核记录（必须在 /:id 路由之前）
router.get('/logs', requireAdmin, (req, res) => {
  console.log('[AI审核] /api/ai/logs 请求收到', req.user);
  try {
    const { source, level, action, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, parseInt(limit) || 20);
    const offset = (p - 1) * l;
    let where = [];
    const params = [];
    if (source) { where.push('source = ?'); params.push(source); }
    if (level && level !== 'all') { where.push('level = ?'); params.push(level); }
    if (action && action !== 'all') { where.push('action = ?'); params.push(action); }
    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.prepare(`SELECT count(*) as cnt FROM ai_review_logs ${whereClause}`).get(...params).cnt;
    const rows = db.prepare(`SELECT * FROM ai_review_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, l, offset);
    res.json({ total, page: p, limit: l, rows });
  } catch(e) {
    console.error('[AI审核] /api/ai/logs 错误:', e.message);
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// 审核统计
router.get('/stats', requireAdmin, (req, res) => {
  console.log('[AI审核] /api/ai/stats 请求收到', req.user);
  try {
    const total = db.prepare('SELECT count(*) as cnt FROM ai_review_logs').get().cnt;
    const violations = db.prepare("SELECT count(*) as cnt FROM ai_review_logs WHERE violation = 1").get().cnt;
    const blocked = db.prepare("SELECT count(*) as cnt FROM ai_review_logs WHERE action = 'block'").get().cnt;
    const byLevel = db.prepare("SELECT level, count(*) as cnt FROM ai_review_logs GROUP BY level").all();
    const bySource = db.prepare("SELECT source, count(*) as cnt, sum(violation) as violations FROM ai_review_logs GROUP BY source").all();
    const recent24h = db.prepare("SELECT count(*) as cnt FROM ai_review_logs WHERE created_at > datetime('now','localtime','-1 day')").get().cnt;
    res.json({ total, violations, blocked, byLevel, bySource, recent24h });
  } catch(e) {
    console.error('[AI审核] /api/ai/stats 错误:', e.message);
    res.status(500).json({ error: e.message, code: 'SYS_001' });
  }
});

// ─── 导出检测函数供其他路由使用 ──────────────────────────
module.exports = router;
module.exports.checkMarketItem = checkMarketItem;
module.exports.checkWallPost = checkWallPost;
module.exports.callDeepSeek = callDeepSeek;
module.exports.imageToBase64 = imageToBase64;

// ─── 文字+图片综合审核（用于评论等带图短文本） ────────────
async function checkTextWithImages(text, imageUrls = [], context = '校园平台') {
  if (!text && imageUrls.length === 0) return { violation: false, level: 'none', category: '无', reason: '' };

  // 先检查图片（最多3张）
  const imgViolations = [];
  for (let i = 0; i < Math.min(imageUrls.length, 3); i++) {
    const imgData = await imageToBase64(imageUrls[i]);
    if (!imgData) continue;
    try {
      const imgResult = await callDeepSeek([
        {
          role: 'system',
          content: `你是一个${context}的图片内容审核AI。检查这张图片是否违规。
违规标准：涉黄/暴力/违法/低俗/不当/不适合校园环境
严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因", "level": "high/medium/low/none", "category": "色情/暴力/违法/不当/无"}
只返回JSON。`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `请检查这张${context}图片是否有违规内容：` },
            { type: 'image_url', image_url: { url: `data:${imgData.mime};base64,${imgData.base64}` } }
          ]
        }
      ], 256);
      const jsonMatch = imgResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.violation) {
          if (parsed.level === 'high') return parsed; // 严重违规直接返回
          imgViolations.push(parsed);
        }
      }
    } catch(e) { /* 单张图片检测失败跳过 */ }
  }

  // 再检查文字
  if (text) {
    const textResult = await checkTextContent(text, context);
    if (textResult.violation && textResult.level === 'high') return textResult;
    // 图片有中/低违规，合并返回
    if (imgViolations.length > 0 && !textResult.violation) return imgViolations[0];
    return textResult;
  }

  // 只有图片、无文字
  if (imgViolations.length > 0) return imgViolations[0];
  return { violation: false, level: 'none', category: '无', reason: '' };
}
module.exports.checkTextWithImages = checkTextWithImages;

// ─── 纯文字快速审核（用于评论等短文本） ────────────────────
async function checkTextContent(text, context = '校园平台') {
  const messages = [
    {
      role: 'system',
      content: `你是一个${context}的内容审核AI。检查以下内容是否含有**严重违规**。

**只拦截严重违规（level=high）：**
- 违法信息：涉黄/赌/毒/枪/违禁品
- 严重人身攻击：明确辱骂/恐吓/威胁
- 色情内容
- 诈骗/传销

**以下不算违规：**
- 轻微吐槽、玩笑、日常抱怨
- 情感表达、争议观点（无攻击性）
- 普通广告

严格以JSON格式回复：
{"violation": true/false, "reason": "违规原因", "level": "high/medium/low/none", "category": "不当/违法/色情/欺诈/无"}
只返回JSON。`
    },
    { role: 'user', content: text }
  ];
  try {
    const result = await callDeepSeek(messages, 256);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { violation: false, reason: 'AI返回格式异常', level: 'none', category: '无' };
  } catch (e) {
    return { violation: false, reason: 'AI检测失败: ' + e.message, level: 'none', category: '无' };
  }
}
module.exports.checkTextContent = checkTextContent;
