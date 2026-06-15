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
  JSON_RES(res, () => {
    const { name, intro } = req.body;
    const { phone, student_id } = req.user;

    if (!name || !name.trim()) return makeError('请填写姓名', 'PARAM_MISSING');
    if (!intro || !intro.trim()) return makeError('请填写自我介绍', 'PARAM_MISSING');
    if (!req.files || req.files.length === 0) return makeError('请至少上传1张照片', 'PARAM_MISSING');

    const month = currentMonth();

    // 检查本月是否已报名
    const existing = db.prepare('SELECT id FROM campus_stars WHERE phone = ? AND month = ?').get(phone, month);
    if (existing) return makeError('你本月已经报名了，请下个月再来', 'DUPLICATE');

    const photos = req.files.map(f => '/uploads/stars/' + f.filename).join(',');

    const result = db.prepare(`
      INSERT INTO campus_stars (phone, student_id, name, photos, intro, month, votes)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(phone, student_id || '', name.trim(), photos, intro.trim(), month);

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

// ─── 投票 ────────────────────────────────────────────────
// POST /api/campus-star/vote
router.post('/vote', requireAuth, (req, res) => {
  JSON_RES(res, () => {
    const { candidate_id } = req.body;
    const { phone } = req.user;

    if (!candidate_id) return makeError('请选择候选人', 'PARAM_MISSING');

    const candidate = db.prepare('SELECT id, month FROM campus_stars WHERE id = ? AND status = ?')
      .get(candidate_id, 'active');
    if (!candidate) return makeError('候选人不存在或已下架', 'NOT_FOUND', 404);

    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    // 检查今天是否已投票（每人每天1票）
    const todayVote = db.prepare(
      'SELECT id FROM star_votes WHERE voter_phone = ? AND vote_date = ?'
    ).get(phone, today);

    if (todayVote) return makeError('你今天已经投过票了，明天再来吧！', 'DUPLICATE');

    // 写入投票记录 + 更新票数
    const insertVote = db.prepare(`
      INSERT INTO star_votes (candidate_id, voter_phone, month, vote_date)
      VALUES (?, ?, ?, ?)
    `);

    const updateVotes = db.prepare(`
      UPDATE campus_stars SET votes = votes + 1 WHERE id = ?
    `);

    const transaction = db.transaction(() => {
      insertVote.run(candidate_id, phone, candidate.month, today);
      updateVotes.run(candidate_id);
    });

    transaction();

    const updated = db.prepare('SELECT votes FROM campus_stars WHERE id = ?').get(candidate_id);
    return { ok: true, votes: updated.votes, message: '投票成功！' };
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

    // 今天是否已投票
    const today = new Date().toISOString().slice(0, 10);
    const todayVote = db.prepare(
      'SELECT candidate_id FROM star_votes WHERE voter_phone = ? AND vote_date = ?'
    ).get(phone, today);

    return {
      ok: true,
      hasJoined: !!myEntry,
      myEntry: myEntry || null,
      votedToday: !!todayVote,
      votedFor: todayVote ? todayVote.candidate_id : null
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

// ─── 确保上传目录存在 ────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads', 'stars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = router;
