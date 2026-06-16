// routes/badges.js - 勋章系统
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// ─── 勋章定义 ────────────────────────────────────────
const BADGE_DEFS = [
  { id: 'first_post',    name: '初来乍到',   icon: '🌱', desc: '发布第一篇帖子',        color: '#4CAF50' },
  { id: 'post_master',   name: '发帖达人',   icon: '✍️', desc: '发布10篇以上帖子',       color: '#2196F3' },
  { id: 'post_king',     name: '帖子之王',   icon: '👑', desc: '发布50篇以上帖子',       color: '#FF9800' },
  { id: 'comment_lover', name: '评论达人',   icon: '💬', desc: '发表20条以上评论',       color: '#9C27B0' },
  { id: 'popular',       name: '人气之星',   icon: '⭐', desc: '累计获得50个赞',         color: '#FF5722' },
  { id: 'hot_post',      name: '热门帖子',   icon: '🔥', desc: '单篇帖子获得20个赞',     color: '#E91E63' },
  { id: 'photo_master',  name: '摄影达人',   icon: '📸', desc: '发布5篇带图帖子',       color: '#00BCD4' },
  { id: 'early_bird',    name: '早期用户',   icon: '🐣', desc: '注册超过30天',           color: '#8BC34A' },
  { id: 'honest_user',   name: '诚信用户',   icon: '🛡️', desc: '完成3笔以上二手交易',   color: '#607D8B' },
  { id: 'pet_guardian',  name: '猫狗守护者', icon: '🐾', desc: '发布3条以上猫狗目击',   color: '#FF6F00' },
  { id: 'knowledge_sharer', name: '知识分享者', icon: '📚', desc: '上传3份以上复习资料', color: '#3F51B5', hidden: true },
  { id: 'club_active',   name: '社团活跃',   icon: '🎭', desc: '加入社团并参与活动',     color: '#009688', hidden: true },
  { id: 'judge_l1',      name: '一级判官',   icon: '/images/badges/judge-l1.png', desc: '成功提交问题反馈', color: '#D32F2F', hidden: true, isImage: true },
  { id: 'judge_l2',      name: '二级判官',   icon: '/images/badges/judge-l2.png', desc: '反馈通过10次以上', color: '#B71C1C', hidden: true, isImage: true },
  { id: 'judge_l3',      name: '三级判官',   icon: '/images/badges/judge-l3.png', desc: '反馈通过30次以上', color: '#880E4F', hidden: true, isImage: true },
];

// ─── 检查并颁发勋章 ──────────────────────────────────
function checkBadges(phone) {
  const earned = [];
  const now = new Date();

  // 1. 初来乍到：发布过帖子
  const postCount = db.prepare('SELECT COUNT(*) as c FROM wall_posts WHERE phone = ?').get(phone)?.c || 0;
  if (postCount >= 1) earned.push('first_post');
  if (postCount >= 10) earned.push('post_master');
  if (postCount >= 50) earned.push('post_king');

  // 2. 评论达人
  const commentCount = db.prepare('SELECT COUNT(*) as c FROM wall_comments WHERE phone = ?').get(phone)?.c || 0;
  if (commentCount >= 20) earned.push('comment_lover');

  // 3. 人气之星：收到的赞
  const likeCount = db.prepare(`
    SELECT COUNT(*) as c FROM wall_likes 
    WHERE post_id IN (SELECT id FROM wall_posts WHERE phone = ?)
  `).get(phone)?.c || 0;
  if (likeCount >= 50) earned.push('popular');

  // 4. 热门帖子：单篇>=20赞
  const hotPost = db.prepare(`
    SELECT COUNT(*) as c FROM wall_likes 
    WHERE post_id IN (SELECT id FROM wall_posts WHERE phone = ?)
    GROUP BY post_id HAVING COUNT(*) >= 20
  `).get(phone);
  if (hotPost) earned.push('hot_post');

  // 5. 摄影达人：>=5篇带图帖子
  const photoCount = db.prepare(
    "SELECT COUNT(*) as c FROM wall_posts WHERE phone = ? AND images IS NOT NULL AND images != ''"
  ).get(phone)?.c || 0;
  if (photoCount >= 5) earned.push('photo_master');

  // 6. 早期用户：注册超过30天
  const user = db.prepare('SELECT created_at FROM users WHERE phone = ?').get(phone);
  if (user && user.created_at) {
    const created = new Date(user.created_at);
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 30) earned.push('early_bird');
  }

  // 7. 诚信用户：完成>=3笔二手交易
  const tradeCount = db.prepare(
    "SELECT COUNT(*) as c FROM market_orders WHERE (buyer_phone = ? OR seller_phone = ?) AND status = 'completed'"
  ).get(phone, phone)?.c || 0;
  if (tradeCount >= 3) earned.push('honest_user');

  // 8. 猫狗守护者：>=3条目击
  const sightingCount = db.prepare('SELECT COUNT(*) as c FROM pet_sightings WHERE phone = ?').get(phone)?.c || 0;
  if (sightingCount >= 3) earned.push('pet_guardian');

  // 9. 知识分享者：>=3份复习资料
  const materialCount = db.prepare('SELECT COUNT(*) as c FROM review_materials WHERE uploader_phone = ?').get(phone)?.c || 0;
  if (materialCount >= 3) earned.push('knowledge_sharer');

  // 10. 社团活跃：加入社团且有活动报名
  const clubActive = db.prepare(`
    SELECT COUNT(*) as c FROM club_members cm
    JOIN activity_signups acts ON acts.phone = cm.phone
    WHERE cm.phone = ? AND cm.role IS NOT NULL
  `).get(phone)?.c || 0;
  if (clubActive >= 1) earned.push('club_active');

  // 11. 一级判官：提交过问题反馈
  const feedbackCount = db.prepare('SELECT COUNT(*) as c FROM feedback WHERE phone = ?').get(phone)?.c || 0;
  if (feedbackCount >= 1) earned.push('judge_l1');
  if (feedbackCount >= 10) earned.push('judge_l2');
  if (feedbackCount >= 30) earned.push('judge_l3');

  // 写入 user_badges 表，并检测新获得的勋章用于生成通知
  const existingBadges = new Set(
    db.prepare('SELECT badge_id FROM user_badges WHERE phone = ?').all(phone).map(r => r.badge_id)
  );
  const insert = db.prepare('INSERT OR IGNORE INTO user_badges (phone, badge_id, earned_at, seen) VALUES (?, ?, ?, 0)');
  const insertNotif = db.prepare(
    "INSERT INTO notifications (phone, type, title, content, created_at) VALUES (?, 'system', ?, ?, ?)"
  );
  const newBadgeIds = [];
  const insertMany = db.transaction((badges) => {
    for (const bid of badges) {
      const result = insert.run(phone, bid, now.toISOString());
      if (result.changes > 0 && !existingBadges.has(bid)) {
        newBadgeIds.push(bid);
      }
    }
    // 为新获得的勋章生成通知
    for (const bid of newBadgeIds) {
      const def = BADGE_DEFS.find(b => b.id === bid);
      if (def) {
        insertNotif.run(phone, `🎖️ 获得勋章：${def.icon} ${def.name}`, def.desc, now.toISOString());
      }
    }
  });
  insertMany(earned);

  return earned;
}

// ─── GET /api/badges/count - 仅获取未查看计数 ────────
router.get('/count', requireAuth, (req, res) => {
  try {
    const phone = req.user.phone;
    // 先触发检测（会发通知）
    checkBadges(phone);
    const unseen = db.prepare(
      'SELECT COUNT(*) as c FROM user_badges WHERE phone = ? AND seen = 0'
    ).get(phone)?.c || 0;
    const total = db.prepare(
      'SELECT COUNT(*) as c FROM user_badges WHERE phone = ?'
    ).get(phone)?.c || 0;
    res.json({ code: 'OK', data: { unseen, total } });
  } catch (e) {
    res.status(500).json({ code: 'SERVER_ERROR', error: e.message });
  }
});

// ─── PUT /api/badges/seen - 标记所有勋章已查看 ────────
router.put('/seen', requireAuth, (req, res) => {
  try {
    const phone = req.user.phone;
    db.prepare('UPDATE user_badges SET seen = 1 WHERE phone = ? AND seen = 0').run(phone);
    res.json({ code: 'OK' });
  } catch (e) {
    res.status(500).json({ code: 'SERVER_ERROR', error: e.message });
  }
});

// ─── GET /api/badges - 获取当前用户勋章列表 ──────────
router.get('/', requireAuth, (req, res) => {
  try {
    const phone = req.user.phone;
    // 先触发检查
    const earnedIds = checkBadges(phone);

    // 获取已获得的勋章详情
    const earnedRows = db.prepare(
      'SELECT badge_id, earned_at FROM user_badges WHERE phone = ?'
    ).all(phone);
    const earnedMap = {};
    for (const r of earnedRows) earnedMap[r.badge_id] = r.earned_at;

    // 构建列表：隐藏款只在获得后才显示
    const badges = BADGE_DEFS
      .map(b => ({
        ...b,
        earned: !!earnedMap[b.id],
        earned_at: earnedMap[b.id] || null,
      }))
      .filter(b => !b.hidden || b.earned);

    const earnedCount = badges.filter(b => b.earned).length;

    res.json({
      code: 'OK',
      data: {
        badges,
        earnedCount,
        totalCount: BADGE_DEFS.length,
      }
    });
  } catch (e) {
    console.error('[badges] 获取勋章失败:', e.message);
    res.status(500).json({ code: 'SERVER_ERROR', error: '获取勋章失败' });
  }
});

// ─── GET /api/badges/:phone - 查看他人勋章（公开） ──
router.get('/:phone', (req, res) => {
  try {
    const phone = req.params.phone;
    const earnedRows = db.prepare(
      'SELECT badge_id, earned_at FROM user_badges WHERE phone = ?'
    ).all(phone);
    const earnedMap = {};
    for (const r of earnedRows) earnedMap[r.badge_id] = r.earned_at;

    const badges = BADGE_DEFS
      .map(b => ({
        ...b,
        earned: !!earnedMap[b.id],
        earned_at: earnedMap[b.id] || null,
      }))
      .filter(b => !b.hidden || b.earned);

    res.json({
      code: 'OK',
      data: {
        badges,
        earnedCount: badges.filter(b => b.earned).length,
        totalCount: BADGE_DEFS.length,
      }
    });
  } catch (e) {
    console.error('[badges] 获取他人勋章失败:', e.message);
    res.status(500).json({ code: 'SERVER_ERROR', error: '获取勋章失败' });
  }
});

module.exports = router;
