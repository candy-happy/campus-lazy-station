// routes/campus-star.js - 校花校草月度选举
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 上传配置 ────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads', 'stars'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'star_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('只允许上传 jpg/png/webp/gif 格式的图片'));
    }
    cb(null, true);
  }
});

// ─── 获取当前月份标识（yyyy-mm）──────────────────────────
function currentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// ─── 报名参加 ────────────────────────────────────────────
// POST /api/campus-star/join
router.post('/join', requireAuth, upload.array('photos', 3), (req, res) => {
    console.log('[CampusStar] 开始报名', { body: req.body, filesCount: req.files ? req.files.length : 0 });
    JSON_RES(res, () => {
      const { name, intro } = req.body;
      const { phone, student_id } = req.user;
      console.log('[CampusStar] 用户信息', { phone, student_id, name, intro });

      if (!name || !name.trim()) return makeError('请填写姓名', 'PARAM_MISSING');
      if (!intro || !intro.trim()) return makeError('请填写自我介绍', 'PARAM_MISSING');
      if (!req.files || req.files.length === 0) return makeError('请至少上传1张照片', 'PARAM_MISSING');

      const month = currentMonth();
      console.log('[CampusStar] 当前月份', month);

      // 检查本月是否已报名
      const existing = db.prepare('SELECT id FROM campus_stars WHERE phone = ? AND month = ?').get(phone, month);
      if (existing) return makeError('你本月已经报名了，请下个月再来', 'DUPLICATE');

      const photos = req.files.map(f => '/uploads/stars/' + f.filename).join(',');
      console.log('[CampusStar] 准备插入', { phone, name, photos, month });

      const result = db.prepare(`
        INSERT INTO campus_stars (phone, student_id, name, photos, intro, month, votes)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(phone, student_id || '', name.trim(), photos, intro.trim(), month);
      console.log('[CampusStar] 插入结果', { lastInsertRowid: result.lastInsertRowid, changes: result.changes });

      return { ok: true, id: result.lastInsertRowid, message: '报名成功！' };
    });
  });

// ─── 候选人列表 ──────────────────────────────────────────
// GET /api/campus-star/candidates?month=&sort=votes
router.get('/candidates', (req, res) => {
  JSON_RES(res, () => {
    const month = req.query.month || currentMonth();
    const sort = req.query.sort === 'random' ? 'RANDOM()' : 'votes DESC, id ASC';

    const candidates = db.prepare(`
      SELECT cs.*, u.nickname, u.avatar,
        (SELECT COUNT(*) FROM star_votes WHERE candidate_id = cs.id AND month = cs.month AND vote_date = date('now','localtime')) as today_votes
      FROM campus_stars cs
      LEFT JOIN users u ON cs.phone = u.phone
      WHERE cs.month = ? AND cs.status = 'active'
      ORDER BY ${sort}
    `).all(month);

    return { ok: true, month, candidates, total: candidates.length };
  });
});

// ─── 候选人详情 ──────────────────────────────────────────
// GET /api/campus-star/candidate/:id
router.get('/candidate/:id', (req, res) => {
  JSON_RES(res, () => {
    const candidate = db.prepare(`
      SELECT cs.*, u.nickname, u.avatar
      FROM campus_stars cs
      LEFT JOIN users u ON cs.phone = u.phone
      WHERE cs.id = ?
    `).get(req.params.id);

    if (!candidate) return makeError('候选人不存在', 'NOT_FOUND', 404);

    return { ok: true, candidate };
  });
});

// ─── 投票（每人每天限投3人，每人只能被同一人投一次）───
// POST /api/campus-star/vote
router.post('/vote', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const { candidate_id } = req.body;
    const { phone } = req.user;

    if (!candidate_id) return makeError('请选择候选人', 'PARAM_MISSING');

    const candidate = db.prepare('SELECT id, month FROM campus_stars WHERE id = ? AND status = ?')
      .get(candidate_id, 'active');
    if (!candidate) return makeError('候选人不存在或已下架', 'NOT_FOUND', 404);

    const today = new Date().toISOString().slice(0, 10);

    // 是否已经给该候选人投过票
    const dupVote = db.prepare(
      'SELECT id FROM star_votes WHERE voter_phone = ? AND candidate_id = ?'
    ).get(phone, candidate_id);
    if (dupVote) return makeError('你已经给TA投过票了', 'DUPLICATE');

    // 今日已投人数
    const todayCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM star_votes WHERE voter_phone = ? AND vote_date = ?'
    ).get(phone, today);
    if (todayCount.cnt >= 3) return makeError('你今天已经投满3票了，明天再来吧！', 'LIMIT_EXCEEDED');

    const insertVote = db.prepare('INSERT INTO star_votes (candidate_id, voter_phone, month, vote_date) VALUES (?, ?, ?, ?)');
    const updateVotes = db.prepare('UPDATE campus_stars SET votes = votes + 1 WHERE id = ?');

    const transaction = db.transaction(() => {
      insertVote.run(candidate_id, phone, candidate.month, today);
      updateVotes.run(candidate_id);
    });
    transaction();

    const updated = db.prepare('SELECT votes FROM campus_stars WHERE id = ?').get(candidate_id);
    return { ok: true, votes: updated.votes, votesToday: todayCount.cnt + 1, message: '投票成功！' };
  });
});

// ─── 排行榜 ──────────────────────────────────────────────
// GET /api/campus-star/rank?month=
router.get('/rank', (req, res) => {
  JSON_RES(res, () => {
    const month = req.query.month || currentMonth();
    const top = parseInt(req.query.top) || 10;

    const rank = db.prepare(`
      SELECT cs.id, cs.name, cs.photos, cs.votes, cs.intro,
        u.nickname, u.avatar,
        RANK() OVER (ORDER BY cs.votes DESC) as rank
      FROM campus_stars cs
      LEFT JOIN users u ON cs.phone = u.phone
      WHERE cs.month = ? AND cs.status = 'active'
      ORDER BY cs.votes DESC
      LIMIT ?
    `).all(month, top);

    // 如果本月还没结束且当前日期不是最后一天，标注"进行中"
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastDay = now.getDate() === lastDay;

    return { ok: true, month, rank, isLastDay, total: rank.length };
  });
});

// ─── 荣誉墙（往期冠军）───────────────────────────────────
// GET /api/campus-star/hall?limit=
router.get('/hall', (req, res) => {
  JSON_RES(res, () => {
    const limit = parseInt(req.query.limit) || 12;

    const hall = db.prepare(`
      SELECT cs.*, u.nickname, u.avatar
      FROM campus_stars cs
      LEFT JOIN users u ON cs.phone = u.phone
      WHERE cs.status = 'champion'
      ORDER BY cs.month DESC
      LIMIT ?
    `).all(limit);

    return { ok: true, hall };
  });
});

// ─── 我的报名状态 ────────────────────────────────────────
// GET /api/campus-star/my-status
router.get('/my-status', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const { phone } = req.user;
    const month = currentMonth();

    const myEntry = db.prepare(
      'SELECT * FROM campus_stars WHERE phone = ? AND month = ?'
    ).get(phone, month);

    // 今日投票情况
    const today = new Date().toISOString().slice(0, 10);
    const todayVotes = db.prepare(
      'SELECT candidate_id FROM star_votes WHERE voter_phone = ? AND vote_date = ?'
    ).all(phone, today);

    return {
      ok: true,
      hasJoined: !!myEntry,
      myEntry: myEntry || null,
      voteCountToday: todayVotes.length,
      votedToday: todayVotes.length >= 3,
      votedFor: todayVotes.map(v => v.candidate_id)
    };
  });
});

// ─── 月度结算（内部调用 / 定时任务）─────────────────────
// POST /api/campus-star/settle
router.post('/settle', (req, res) => {
  JSON_RES(res, () => {
    const lastMonth = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();

    // 上个月前三名设为冠军
    const top3 = db.prepare(`
      SELECT id, name, votes FROM campus_stars
      WHERE month = ? AND status = 'active'
      ORDER BY votes DESC LIMIT 3
    `).all(lastMonth);

    if (top3.length === 0) return { ok: true, message: '上月无参赛者，无需结算', settled: false };

    const updateStatus = db.prepare('UPDATE campus_stars SET status = ? WHERE id = ?');
    const transaction = db.transaction(() => {
      // Top 1 -> champion, Top 2/3 -> runner_up
      updateStatus.run('champion', top3[0].id);
      if (top3[1]) updateStatus.run('runner_up', top3[1].id);
      if (top3[2]) updateStatus.run('runner_up', top3[2].id);
      // 其余全部归档
      db.prepare(`UPDATE campus_stars SET status = 'archived' WHERE month = ? AND status = 'active'`).run(lastMonth);
    });
    transaction();

    return {
      ok: true,
      message: `上月结算完成，冠军：${top3[0].name}(${top3[0].votes}票)`,
      champions: top3,
      settled: true
    };
  });
});

// ─── 删除自己的参赛记录 ────────────────────────────────
// DELETE /api/campus-star/candidate/:id
router.delete('/candidate/:id', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const { phone } = req.user;
    const entry = db.prepare('SELECT * FROM campus_stars WHERE id = ? AND phone = ?').get(req.params.id, phone);
    if (!entry) return makeError('参赛记录不存在或无权删除', 'NOT_FOUND', 404);

    // 删除相关数据（评论+投票+参赛记录）
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM star_comments WHERE candidate_id = ?').run(entry.id);
      db.prepare('DELETE FROM star_votes WHERE candidate_id = ?').run(entry.id);
      db.prepare('DELETE FROM campus_stars WHERE id = ?').run(entry.id);
    });
    transaction();

    return { ok: true, message: '已删除参赛记录' };
  });
});

// ─── 分享（增加分享计数）────────────────────────────────
// POST /api/campus-star/share/:id
router.post('/share/:id', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const entry = db.prepare('SELECT id FROM campus_stars WHERE id = ?').get(req.params.id);
    if (!entry) return makeError('参赛记录不存在', 'NOT_FOUND', 404);
    db.prepare('UPDATE campus_stars SET share_count = share_count + 1 WHERE id = ?').run(entry.id);
    return { ok: true };
  });
});

// ─── 评论图片上传 ──────────────────────────────────────
const commentImageUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads', 'stars'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'comment_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('只允许上传 jpg/png/webp/gif 格式的图片'));
    }
    cb(null, true);
  }
});

// POST /api/campus-star/comment-image
router.post('/comment-image', requireAuth, commentImageUpload.single('image'), (req, res) => {
  JSON_RES(res, () => {
    if (!req.file) return makeError('请上传图片', 'PARAM_MISSING');
    return { ok: true, url: '/uploads/stars/' + req.file.filename };
  });
});

// ─── 评论列表 ──────────────────────────────────────────
// GET /api/campus-star/comments/:candidateId
router.get('/comments/:candidateId', (req, res) => {
  JSON_RES(res, () => {
    const candidateId = req.params.candidateId;
    const comments = db.prepare(`
      SELECT sc.*, u.nickname, u.avatar, u.phone
      FROM star_comments sc
      LEFT JOIN users u ON sc.phone = u.phone
      WHERE sc.candidate_id = ?
      ORDER BY sc.created_at DESC
    `).all(candidateId);

    return { ok: true, comments };
  });
});

// ─── 发表评论 ──────────────────────────────────────────
// POST /api/campus-star/comments
router.post('/comments', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const { candidate_id, content, image } = req.body;
    const { phone } = req.user;

    if (!candidate_id) return makeError('参数缺失', 'PARAM_MISSING');
    if (!content || !content.trim()) return makeError('请输入评论内容', 'PARAM_MISSING');
    if (content.trim().length > 500) return makeError('评论内容过长（最多500字）', 'PARAM_INVALID');

    // 检查候选人是否存在
    const candidate = db.prepare('SELECT id FROM campus_stars WHERE id = ?').get(candidate_id);
    if (!candidate) return makeError('候选人不存在', 'NOT_FOUND', 404);

    const result = db.prepare(
      'INSERT INTO star_comments (candidate_id, phone, content, image) VALUES (?, ?, ?, ?)'
    ).run(candidate_id, phone, content.trim(), image || null);

    return { ok: true, id: result.lastInsertRowid, message: '评论成功' };
  });
});

// ─── 删除评论 ──────────────────────────────────────────
// DELETE /api/campus-star/comments/:id
router.delete('/comments/:id', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const { phone } = req.user;
    const comment = db.prepare('SELECT * FROM star_comments WHERE id = ? AND phone = ?').get(req.params.id, phone);
    if (!comment) return makeError('评论不存在或无权删除', 'NOT_FOUND', 404);

    db.prepare('DELETE FROM star_comments WHERE id = ?').run(req.params.id);

    return { ok: true, message: '已删除评论' };
  });

  // ─── 举报候选人 ─────────────────────────────────────────
  router.post('/report/:id', requireUser, async (req, res) => {
    const { reason } = req.body || {};
    const phone = req.user.phone;
    const entry = db.prepare('SELECT * FROM campus_stars WHERE id = ?').get(req.params.id);
    if (!entry) return makeError('候选人不存在', 'NOT_FOUND', 404);
    if (entry.phone === phone) return makeError('不能举报自己', 'SELF_REPORT', 400);
    // 检查是否已举报
    const existing = db.prepare('SELECT id FROM ai_review_logs WHERE source = ? AND source_id = ? AND phone = ?').get('campus_star', req.params.id, phone);
    if (existing) return makeError('已举报过该候选人', 'ALREADY_REPORTED', 400);
    // 记录举报到审核日志
    db.prepare('INSERT INTO ai_review_logs (source, source_id, phone, reason, action, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('campus_star', req.params.id, phone, reason || '', 'report', 'pending', new Date().toISOString().replace('T',' ').substring(0,19));
    return { ok: true, message: '举报已提交' };
  });
});

// ─── 确保上传目录存在 ────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads', 'stars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = router;
