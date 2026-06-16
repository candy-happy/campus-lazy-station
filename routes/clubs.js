// routes/clubs.js - 社团路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const { fmtPhone, validateUploadFile } = require('../utils/helpers');
const { withCompress } = require('../utils/upload');
const aiChecker = require('./ai');

// ─── 社团logo上传配置 ──────────────────────────────────
const CLUB_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'clubs');
if (!fs.existsSync(CLUB_UPLOAD_DIR)) fs.mkdirSync(CLUB_UPLOAD_DIR, { recursive: true });

const clubStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CLUB_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'club-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const clubUpload = multer({ storage: clubStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── AI审核记录写入辅助 ────────────────────────────────
function logAiReview(source, sourceId, phone, content, aiResult, action) {
  try {
    db.prepare(`INSERT INTO ai_review_logs (source, source_id, phone, content_preview, violation, level, category, reason, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      source, sourceId, phone, content.slice(0, 200),
      aiResult.violation ? 1 : 0, aiResult.level, aiResult.category, aiResult.reason, action
    );
  } catch(e) { console.error('[AI审核] 写入审核记录失败:', e.message); }
}

// ─── 创建社团 ─────────────────────────────────────────────
router.post('/', requireAuth, withCompress(clubUpload.single('logo')), async (req, res) => JSON_RES(res, async () => {
  const { name, category, description } = req.body;
  const phone = req.user.phone;
  if (!name) return makeError('社团名称不能为空', ErrorCode.PARAM_MISSING);

  // 文件魔数校验
  if (req.file) {
    const validation = validateUploadFile(req.file);
    if (!validation.valid) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return makeError(validation.error, ErrorCode.PARAM_INVALID);
    }
  }

  // AI审核社团名称和描述
  const reviewContent = `社团名称：${name}\n社团描述：${description || ''}`;
  let aiResult = { violation: false, level: 'none', category: '无', reason: '' };
  try {
    const logoUrl = req.file ? '/uploads/clubs/' + req.file.filename : null;
    aiResult = await aiChecker.checkWallPost({
      title: name, content: description || '', topic: '',
      images: logoUrl ? JSON.stringify([logoUrl]) : '[]'
    });
    if (aiResult.violation && aiResult.level === 'high') {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e) {} }
      console.log(`[AI审核] 社团创建被拦截: name=${name}, level=${aiResult.level}, reason=${aiResult.reason}`);
      logAiReview('club', 0, phone, reviewContent, aiResult, 'block');
      return makeError('社团信息不符合平台规范：' + (aiResult.reason || '请修改后重新提交'), 'AI_001');
    }
    if (aiResult.violation) console.log(`[AI审核] 社团创建提醒(未拦截): level=${aiResult.level}, reason=${aiResult.reason}`);
    else console.log(`[AI审核] 社团创建审核通过: name=${name}`);
  } catch (e) {
    console.error('[AI审核] 社团创建审核失败(放行):', e.message);
  }

  const logo = req.file ? '/uploads/clubs/' + req.file.filename : null;
  const info = db.prepare('INSERT INTO clubs (name, logo, category, description, president_phone) VALUES (?,?,?,?,?)')
    .run(name, logo, category || '其他', description || '', phone);

  const clubId = info.lastInsertRowid;
  // 创建者自动成为owner
  db.prepare('INSERT INTO club_members (club_id, phone, role) VALUES (?,?,?)')
    .run(clubId, phone, 'owner');

  // 自动创建社团群聊
  const roomInfo = db.prepare('INSERT INTO club_rooms (club_id, name) VALUES (?,?)')
    .run(clubId, name + '群聊');

  logAiReview('club', clubId, phone, reviewContent, aiResult, 'pass');
  return { ok: true, club_id: clubId };
}));

// ─── 社团列表（公开可访问） ─────────────────────────────────────────────
router.get('/', (req, res) => JSON_RES(res, () => {
  const { category, search, sort = 'hot', page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let sql = "SELECT * FROM clubs WHERE status = 'active'";
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt');
  const total = db.prepare(countSql).get(...params).cnt;

  const orderMap = { hot: 'member_count DESC, created_at DESC', new: 'created_at DESC', active: 'activity_count DESC, member_count DESC' };
  sql += ' ORDER BY ' + (orderMap[sort] || orderMap.hot) + ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const clubs = db.prepare(sql).all(...params);
  return { total, page: pageNum, limit: limitNum, list: clubs };
}));

// ─── 社团排行 ─────────────────────────────────────────────
router.get('/ranking', (req, res) => JSON_RES(res, () => {
  const { top = 10 } = req.query;
  const limitNum = Math.min(50, Math.max(1, parseInt(top) || 10));
  const clubs = db.prepare("SELECT id, name, logo, category, member_count, activity_count FROM clubs WHERE status='active' ORDER BY member_count DESC LIMIT ?").all(limitNum);
  return { list: clubs };
}));

// ─── 我的社团列表（必须在 /:id 之前注册！）────────────────
router.get('/my', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const clubs = db.prepare(`
    SELECT c.*, cm.role, cm.joined_at as my_joined_at,
      cr.id as room_id
    FROM clubs c
    JOIN club_members cm ON cm.club_id = c.id AND cm.phone = ?
    LEFT JOIN club_rooms cr ON cr.club_id = c.id
    WHERE c.status = 'active'
    ORDER BY cm.role = 'owner' DESC, cm.joined_at DESC
  `).all(phone);
  return { list: clubs };
}));

// ─── 社团详情 ─────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
  if (!club) return makeError('社团不存在', ErrorCode.ORDER_NOT_FOUND, 404);

  // 获取成员列表
  const members = db.prepare(`
    SELECT cm.role, cm.joined_at, u.name, u.phone
    FROM club_members cm LEFT JOIN users u ON cm.phone = u.phone
    WHERE cm.club_id = ? ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
  `).all(req.params.id);

  // 获取该社团发布的活动
  const activities = db.prepare(
    "SELECT * FROM activities WHERE publisher_type = 'club' AND publisher_id = ? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 10"
  ).all(req.params.id);

  // 获取社团公告（最新5条）
  const posts = db.prepare('SELECT * FROM club_posts WHERE club_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 5').all(req.params.id);
  const postsWithAuthors = posts.map(p => {
    const author = db.prepare('SELECT name FROM users WHERE phone = ?').get(p.phone);
    return Object.assign({}, p, { images: JSON.parse(p.images || '[]'), author_name: author ? author.name : '' });
  });

  // 手机号脱敏：仅社长可见完整手机号，其他成员仅见脱敏版本
  const requesterPhone = req.user.phone;
  const isOwner = members.some(m => m.phone === requesterPhone && m.role === 'owner');
  const maskedMembers = members.map(m => ({
    role: m.role,
    joined_at: m.joined_at,
    name: m.name,
    phone: isOwner ? m.phone : fmtPhone(m.phone)
  }));

  // 当前用户在该社团的角色
  const myMember = members.find(m => m.phone === requesterPhone);
  const myRole = myMember ? myMember.role : null;

  // 当前用户的申请状态
  const myApp = db.prepare('SELECT status FROM club_applications WHERE club_id = ? AND phone = ?').get(req.params.id, requesterPhone);
  const myAppStatus = myApp ? myApp.status : null;

  return { ...club, members: maskedMembers, activities, posts: postsWithAuthors, my_role: myRole, my_app_status: myAppStatus };
}));

// ─── 申请加入社团 ─────────────────────────────────────────────
router.post('/:id/join', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const reason = req.body.reason || '';
  const club = db.prepare('SELECT * FROM clubs WHERE id = ? AND status = ?').get(req.params.id, 'active');
  if (!club) return makeError('社团不存在或已冻结');

  const existingMember = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, phone);
  if (existingMember) return makeError('已加入该社团');

  const existingApp = db.prepare('SELECT * FROM club_applications WHERE club_id = ? AND phone = ?').get(req.params.id, phone);
  if (existingApp) {
    if (existingApp.status === 'pending') return makeError('已提交申请，等待审批中');
    if (existingApp.status === 'approved') return makeError('申请已通过，请刷新页面');
    // 之前被拒绝，允许重新申请
    db.prepare("UPDATE club_applications SET reason = ?, status = 'pending', reviewed_by = NULL, reviewed_at = NULL, created_at = datetime('now','localtime') WHERE id = ?").run(reason, existingApp.id);
    return { ok: true, status: 'pending', message: '申请已重新提交' };
  }

  db.prepare('INSERT INTO club_applications (club_id, phone, reason) VALUES (?,?,?)').run(req.params.id, phone, reason);

  // 通知社长有新申请（追加到notifications表）
  try {
    const owner = db.prepare('SELECT phone FROM club_members WHERE club_id = ? AND role = ?').get(req.params.id, 'owner');
    if (owner) {
      db.prepare('INSERT INTO notifications (phone, title, content, type, related_id) VALUES (?,?,?,?,?)')
        .run(owner.phone, '新入社申请', `有人申请加入「${club.name}」`, 'club_apply', req.params.id);
    }
  } catch(e) { console.error('[社团] 通知社长失败:', e.message); }

  return { ok: true, status: 'pending', message: '申请已提交，等待社长审批' };
}));

// ─── 获取入社申请列表（社长/管理员） ──────────────────────────
router.get('/:id/applications', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { status } = req.query;

  // 权限检查
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权查看申请列表', ErrorCode.FORBIDDEN);

  let sql = `SELECT ca.*, u.name, u.avatar FROM club_applications ca LEFT JOIN users u ON ca.phone = u.phone WHERE ca.club_id = ?`;
  const params = [req.params.id];
  if (status) { sql += ' AND ca.status = ?'; params.push(status); }
  sql += ' ORDER BY ca.created_at DESC';

  return db.prepare(sql).all(...params);
}));

// ─── 审批入社申请 ─────────────────────────────────────────────
router.post('/:id/applications/:appId/approve', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;

  // 权限检查
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权审批', ErrorCode.FORBIDDEN);

  const app = db.prepare('SELECT * FROM club_applications WHERE id = ? AND club_id = ?').get(req.params.appId, req.params.id);
  if (!app) return makeError('申请不存在');
  if (app.status !== 'pending') return makeError('该申请已被处理');

  // 检查是否已经是成员（防止重复）
  const existing = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, app.phone);
  if (existing) {
    // 已经是成员了，直接标记申请为approved
    db.prepare("UPDATE club_applications SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?").run(phone, req.params.appId);
    return { ok: true, message: '该用户已是社团成员' };
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE club_applications SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?").run(phone, req.params.appId);
    db.prepare('INSERT INTO club_members (club_id, phone, role) VALUES (?,?,?)').run(req.params.id, app.phone, 'member');
    db.prepare('UPDATE clubs SET member_count = member_count + 1 WHERE id = ?').run(req.params.id);
  });
  tx();

  // 通知申请人
  try {
    const club = db.prepare('SELECT name FROM clubs WHERE id = ?').get(req.params.id);
    db.prepare('INSERT INTO notifications (phone, title, content, type, related_id) VALUES (?,?,?,?,?)')
      .run(app.phone, '入社申请已通过', `你已成功加入「${club.name}」`, 'club_approved', req.params.id);
  } catch(e) { console.error('[社团] 通知申请人失败:', e.message); }

  return { ok: true };
}));

// ─── 拒绝入社申请 ─────────────────────────────────────────────
router.post('/:id/applications/:appId/reject', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;

  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权审批', ErrorCode.FORBIDDEN);

  const app = db.prepare('SELECT * FROM club_applications WHERE id = ? AND club_id = ?').get(req.params.appId, req.params.id);
  if (!app) return makeError('申请不存在');
  if (app.status !== 'pending') return makeError('该申请已被处理');

  db.prepare("UPDATE club_applications SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?").run(phone, req.params.appId);

  // 通知申请人
  try {
    const club = db.prepare('SELECT name FROM clubs WHERE id = ?').get(req.params.id);
    db.prepare('INSERT INTO notifications (phone, title, content, type, related_id) VALUES (?,?,?,?,?)')
      .run(app.phone, '入社申请未通过', `你申请加入「${club.name}」未通过审批`, 'club_rejected', req.params.id);
  } catch(e) { console.error('[社团] 通知申请人失败:', e.message); }

  return { ok: true };
}));

// ─── 退出社团 ─────────────────────────────────────────────
router.post('/:id/leave', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, phone);
  if (!member) return makeError('未加入该社团');
  if (member.role === 'owner') return makeError('社长不能退出，请先转让社长');

  db.prepare('DELETE FROM club_members WHERE club_id = ? AND phone = ?').run(req.params.id, phone);
  db.prepare('UPDATE clubs SET member_count = member_count - 1 WHERE id = ?').run(req.params.id);

  return { ok: true };
}));

// ─── 更新社团信息 ─────────────────────────────────────────
router.put('/:id', requireAuth, withCompress(clubUpload.single('logo')), (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权修改社团信息', ErrorCode.FORBIDDEN);

  const { name, category, description } = req.body;
  const logo = req.file ? '/uploads/clubs/' + req.file.filename : null;

  let sql = 'UPDATE clubs SET ';
  const sets = [];
  const params = [];
  if (name) { sets.push('name = ?'); params.push(name); }
  if (category) { sets.push('category = ?'); params.push(category); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (logo) { sets.push('logo = ?'); params.push(logo); }
  if (!sets.length) return makeError('没有需要更新的内容');

  sql += sets.join(', ') + ' WHERE id = ?';
  params.push(req.params.id);
  db.prepare(sql).run(...params);

  return { ok: true };
}));

// ─── 踢出社团成员（社长/admin） ──────────────────────────
router.delete('/:id/members/:phone', requireAuth, (req, res) => JSON_RES(res, () => {
  const myPhone = req.user.phone;
  const targetPhone = req.params.phone;

  const me = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, myPhone, 'owner', 'admin');
  if (!me) return makeError('无权管理成员', ErrorCode.FORBIDDEN);

  const target = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, targetPhone);
  if (!target) return makeError('该成员不在社团中');
  if (target.role === 'owner') return makeError('不能踢出社长');

  // admin不能踢admin
  if (me.role === 'admin' && target.role === 'admin') return makeError('管理员不能踢出其他管理员');

  db.prepare('DELETE FROM club_members WHERE club_id = ? AND phone = ?').run(req.params.id, targetPhone);
  db.prepare('UPDATE clubs SET member_count = MAX(0, member_count - 1) WHERE id = ?').run(req.params.id);

  return { ok: true };
}));

// ─── 修改成员角色 ─────────────────────────────────────────
router.put('/:id/members/:phone/role', requireAuth, (req, res) => JSON_RES(res, () => {
  const myPhone = req.user.phone;
  const targetPhone = req.params.phone;
  const { role } = req.body;

  if (!role || !['admin', 'member'].includes(role)) return makeError('无效的角色', ErrorCode.PARAM_INVALID);

  // 只能社长改角色
  const me = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role = ?').get(req.params.id, myPhone, 'owner');
  if (!me) return makeError('只有社长可以修改成员角色', ErrorCode.FORBIDDEN);

  const target = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, targetPhone);
  if (!target) return makeError('该成员不在社团中');
  if (target.role === 'owner') return makeError('不能修改社长的角色');

  db.prepare('UPDATE club_members SET role = ? WHERE club_id = ? AND phone = ?').run(role, req.params.id, targetPhone);
  return { ok: true };
}));

// ─── 社团公告/动态 ──────────────────────────────────────
const MAX_POST_PHOTOS = 4;

// 发帖（所有成员可发帖，owner/admin可置顶）
router.post('/:id/posts', requireAuth, withCompress(clubUpload.array('photos', MAX_POST_PHOTOS)), (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, phone);
  if (!member) return makeError('请先加入社团再发帖', ErrorCode.FORBIDDEN);

  const { content } = req.body;
  if (!content || !content.trim()) return makeError('公告内容不能为空', ErrorCode.PARAM_INVALID);

  const images = (req.files || []).map(f => '/uploads/clubs/' + f.filename);
  db.prepare('INSERT INTO club_posts (club_id, phone, content, images) VALUES (?,?,?,?)').run(
    req.params.id, phone, content.trim(), JSON.stringify(images)
  );

  return { ok: true };
}));

// 获取公告列表（批量加载作者名，避免N+1）
router.get('/:id/posts', requireAuth, (req, res) => JSON_RES(res, () => {
  const posts = db.prepare('SELECT * FROM club_posts WHERE club_id = ? ORDER BY pinned DESC, created_at DESC').all(req.params.id);
  const authorPhones = [...new Set(posts.map(p => p.phone).filter(Boolean))];
  const authorMap = {};
  if (authorPhones.length > 0) {
    const ph = authorPhones.map(() => '?').join(',');
    db.prepare(`SELECT phone, name FROM users WHERE phone IN (${ph})`).all(...authorPhones).forEach(a => { authorMap[a.phone] = a.name; });
  }
  return posts.map(p => ({ ...p, images: JSON.parse(p.images || '[]'), author_name: authorMap[p.phone] || '' }));
}));

// 删除公告（owner/admin 或本人）
router.delete('/:id/posts/:postId', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const post = db.prepare('SELECT * FROM club_posts WHERE id = ? AND club_id = ?').get(req.params.postId, req.params.id);
  if (!post) return makeError('公告不存在');

  if (post.phone !== phone) {
    const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
    if (!member) return makeError('无权删除', ErrorCode.FORBIDDEN);
  }

  db.prepare('DELETE FROM club_posts WHERE id = ?').run(req.params.postId);
  return { ok: true };
}));

// 置顶/取消置顶公告
router.put('/:id/posts/:postId/pin', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('只有社长或管理员可以置顶', ErrorCode.FORBIDDEN);

  const post = db.prepare('SELECT * FROM club_posts WHERE id = ? AND club_id = ?').get(req.params.postId, req.params.id);
  if (!post) return makeError('公告不存在');

  db.prepare('UPDATE club_posts SET pinned = ? WHERE id = ?').run(post.pinned ? 0 : 1, req.params.postId);
  return { ok: true, pinned: post.pinned ? 0 : 1 };
}));

// ─── 社团统计 ─────────────────────────────────────────
router.get('/:id/stats', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权查看统计', ErrorCode.FORBIDDEN);

  const memberCount = db.prepare('SELECT COUNT(*) as cnt FROM club_members WHERE club_id = ?').get(req.params.id).cnt;
  const postCount = db.prepare('SELECT COUNT(*) as cnt FROM club_posts WHERE club_id = ?').get(req.params.id).cnt;
  const activityCount = db.prepare("SELECT COUNT(*) as cnt FROM activities WHERE publisher_type='club' AND publisher_id=? AND status!='cancelled'").get(req.params.id).cnt;
  const pendingApps = db.prepare("SELECT COUNT(*) as cnt FROM club_applications WHERE club_id=? AND status='pending'").get(req.params.id).cnt;
  const todayNew = db.prepare("SELECT COUNT(*) as cnt FROM club_members WHERE club_id=? AND date(joined_at)=date('now','localtime')").get(req.params.id).cnt;
  const weekNew = db.prepare("SELECT COUNT(*) as cnt FROM club_members WHERE club_id=? AND joined_at >= datetime('now','-7 days','localtime')").get(req.params.id).cnt;

  return { member_count: memberCount, post_count: postCount, activity_count: activityCount, pending_apps: pendingApps, today_new: todayNew, week_new: weekNew };
}));

// ─── 转让社长 ─────────────────────────────────────────
router.post('/:id/transfer', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { target_phone } = req.body;
  if (!target_phone) return makeError('请指定转让对象', ErrorCode.PARAM_INVALID);

  const me = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role = ?').get(req.params.id, phone, 'owner');
  if (!me) return makeError('只有社长可以转让', ErrorCode.FORBIDDEN);

  const target = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(req.params.id, target_phone);
  if (!target) return makeError('该用户不是社团成员');
  if (target.phone === phone) return makeError('不能转让给自己');

  const tx = db.transaction(() => {
    db.prepare('UPDATE club_members SET role = ? WHERE club_id = ? AND phone = ?').run('member', req.params.id, phone);
    db.prepare('UPDATE club_members SET role = ? WHERE club_id = ? AND phone = ?').run('owner', req.params.id, target_phone);
    db.prepare('UPDATE clubs SET president_phone = ? WHERE id = ?').run(target_phone, req.params.id);
  });
  tx();

  return { ok: true };
}));

// ─── 解散社团 ─────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role = ?').get(req.params.id, phone, 'owner');
  if (!member) return makeError('只有社长可以解散社团', ErrorCode.FORBIDDEN);

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM club_members WHERE club_id = ?').run(req.params.id);
    db.prepare('DELETE FROM club_applications WHERE club_id = ?').run(req.params.id);
    db.prepare('DELETE FROM club_posts WHERE club_id = ?').run(req.params.id);
    db.prepare('UPDATE activities SET status = ? WHERE publisher_type = ? AND publisher_id = ?').run('cancelled', 'club', req.params.id);
    db.prepare('DELETE FROM clubs WHERE id = ?').run(req.params.id);
  });
  tx();

  return { ok: true };
}));

// ─── 社团分类列表 ─────────────────────────────────────────
router.get('/meta/categories', requireAuth, (req, res) => JSON_RES(res, () => {
  const categories = [
    { key: '文艺', emoji: '🎨' },
    { key: '体育', emoji: '⚽' },
    { key: '学术', emoji: '📚' },
    { key: '科技', emoji: '💻' },
    { key: '公益', emoji: '💛' },
    { key: '社交', emoji: '🤝' },
    { key: '音乐', emoji: '🎵' },
    { key: '其他', emoji: '🏷️' }
  ];
  return categories;
}));

// ─── 举报社团帖子/公告 ───────────────────────────────────
router.post('/report', requireAuth, (req, res) => JSON_RES(res, () => {
  const { target_type, target_id, target_content, reason, detail } = req.body;
  const phone = req.user.phone;
  if (!target_type || !target_id || !reason) return makeError('参数不完整');
  if (!['post', 'announcement'].includes(target_type)) return makeError('举报类型无效');
  const existing = db.prepare('SELECT id FROM reports WHERE source=? AND target_type=? AND target_id=? AND reporter_phone=?').get('club', target_type, target_id, phone);
  if (existing) return makeError('您已举报过该内容');
  db.prepare(`INSERT INTO reports (source,target_type,target_id,target_content,reporter_phone,reason,detail,status,created_at) VALUES ('club',?,?,?,?,?,?,'pending',datetime('now','localtime'))`)
    .run(target_type, target_id, (target_content||'').slice(0,200), phone, reason, detail||'');
  return { ok: true };
}));

// ─── 社团帖子点赞/取消点赞（toggle） ───────────────
router.post('/posts/:postId/like', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const post = db.prepare('SELECT * FROM club_posts WHERE id = ?').get(req.params.postId);
  if (!post) return makeError('帖子不存在');
  const existing = db.prepare('SELECT * FROM club_post_likes WHERE post_id = ? AND phone = ?').get(req.params.postId, phone);
  if (existing) {
    db.prepare('DELETE FROM club_post_likes WHERE post_id = ? AND phone = ?').run(req.params.postId, phone);
    return { ok: true, liked: false, count: db.prepare('SELECT COUNT(*) as cnt FROM club_post_likes WHERE post_id = ?').get(req.params.postId).cnt };
  }
  db.prepare('INSERT INTO club_post_likes (post_id, phone) VALUES (?,?)').run(req.params.postId, phone);
  return { ok: true, liked: true, count: db.prepare('SELECT COUNT(*) as cnt FROM club_post_likes WHERE post_id = ?').get(req.params.postId).cnt };
}));

// ─── 社团帖子评论列表 ───────────────────────────────
router.get('/posts/:postId/comments', requireAuth, (req, res) => JSON_RES(res, () => {
  const comments = db.prepare(`
    SELECT c.*, u.name, u.avatar FROM club_post_comments c
    LEFT JOIN users u ON c.phone = u.phone
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).all(req.params.postId);
  return comments.map(c => ({
    ...c,
    reply_to_name: c.reply_to_phone ? (db.prepare('SELECT name FROM users WHERE phone = ?').get(c.reply_to_phone)?.name || '') : ''
  }));
}));

// ─── 社团帖子发表评论 ─────────────────────────────────
router.post('/posts/:postId/comments', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const { content, parent_id, reply_to_phone } = req.body;
  if (!content || !content.trim()) return makeError('评论内容不能为空');
  const post = db.prepare('SELECT * FROM club_posts WHERE id = ?').get(req.params.postId);
  if (!post) return makeError('帖子不存在');
  const info = db.prepare('INSERT INTO club_post_comments (post_id, phone, parent_id, reply_to_phone, content) VALUES (?,?,?,?,?)').run(
    req.params.postId, phone, parent_id || null, reply_to_phone || null, content.trim()
  );
  const user = db.prepare('SELECT name, avatar FROM users WHERE phone = ?').get(phone);
  return { ok: true, id: info.lastInsertRowid, name: user?.name || '', avatar: user?.avatar || '' };
}));

// ─── 删除评论 ─────────────────────────────────────────
router.delete('/posts/comments/:commentId', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const comment = db.prepare('SELECT * FROM club_post_comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return makeError('评论不存在');
  if (comment.phone !== phone) {
    // 检查是否是社团管理
    const post = db.prepare('SELECT club_id FROM club_posts WHERE id = ?').get(comment.post_id);
    if (post) {
      const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(post.club_id, phone, 'owner', 'admin');
      if (!member) return makeError('无权删除', ErrorCode.FORBIDDEN);
    }
  }
  db.prepare('DELETE FROM club_post_comments WHERE id = ?').run(req.params.commentId);
  // 级联删除子回复
  db.prepare('DELETE FROM club_post_comments WHERE parent_id = ?').run(req.params.commentId);
  return { ok: true };
}));

// ─── 社团动态时间线（公告+帖子+新成员+活动） ───────
router.get('/:id/timeline', requireAuth, (req, res) => JSON_RES(res, () => {
  const clubId = req.params.id;
  const limit = Math.min(30, parseInt(req.query.limit) || 20);
  
  const posts = db.prepare(`
    SELECT id, phone, content, images, pinned, created_at, 'post' as type FROM club_posts WHERE club_id = ?
  `).all(clubId);
  
  const members = db.prepare(`
    SELECT cm.phone, cm.joined_at as created_at, u.name, 'join' as type 
    FROM club_members cm LEFT JOIN users u ON cm.phone = u.phone 
    WHERE cm.club_id = ? ORDER BY cm.joined_at DESC LIMIT 10
  `).all(clubId);
  
  const activities = db.prepare(`
    SELECT id, title, start_time as created_at, 'activity' as type 
    FROM activities WHERE publisher_type='club' AND publisher_id=? AND status!='cancelled' 
    ORDER BY created_at DESC LIMIT 10
  `).all(clubId);
  
  // 合并排序
  const timeline = [...posts, ...members, ...activities]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
  
  // 批量获取作者名和点赞数
  const authorPhones = [...new Set(timeline.filter(t => t.phone).map(t => t.phone))];
  const authorMap = {};
  if (authorPhones.length > 0) {
    db.prepare(`SELECT phone, name, avatar FROM users WHERE phone IN (${authorPhones.map(() => '?').join(',')})`).all(...authorPhones).forEach(a => { authorMap[a.phone] = a; });
  }
  
  return timeline.map(t => {
    const item = { ...t };
    if (authorMap[t.phone]) {
      item.author_name = authorMap[t.phone].name || '';
      item.author_avatar = authorMap[t.phone].avatar || '';
    }
    if (t.type === 'post') {
      item.images = JSON.parse(t.images || '[]');
      item.like_count = db.prepare('SELECT COUNT(*) as cnt FROM club_post_likes WHERE post_id = ?').get(t.id).cnt;
      item.comment_count = db.prepare('SELECT COUNT(*) as cnt FROM club_post_comments WHERE post_id = ?').get(t.id).cnt;
    }
    return item;
  });
}));

// ─── 开启/关闭招新季 ──────────────────────────────────
router.put('/:id/recruitment', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ? AND role IN (?,?)').get(req.params.id, phone, 'owner', 'admin');
  if (!member) return makeError('无权操作', ErrorCode.FORBIDDEN);
  const current = db.prepare('SELECT recruitment_open FROM clubs WHERE id = ?').get(req.params.id);
  const newVal = current.recruitment_open ? 0 : 1;
  db.prepare('UPDATE clubs SET recruitment_open = ? WHERE id = ?').run(newVal, req.params.id);
  return { ok: true, recruitment_open: newVal };
}));

// ─── 推荐社团（同分类 + 热门） ──────────────────────
router.get('/meta/recommendations', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const myClubs = db.prepare('SELECT club_id FROM club_members WHERE phone = ?').all(phone).map(c => c.club_id);
  const excludeIds = myClubs.length ? myClubs : [-1];
  const placeholders = excludeIds.map(() => '?').join(',');
  
  // 获取用户所在社团的分类
  let myCats = [];
  if (myClubs.length) {
    myCats = db.prepare(`SELECT DISTINCT category FROM clubs WHERE id IN (${placeholders})`).all(...excludeIds).map(c => c.category);
  }
  
  let recs = [];
  if (myCats.length) {
    const catPlaceholders = myCats.map(() => '?').join(',');
    recs = db.prepare(`SELECT * FROM clubs WHERE status='active' AND id NOT IN (${placeholders}) AND category IN (${catPlaceholders}) ORDER BY recruitment_open DESC, member_count DESC LIMIT 10`).all(...excludeIds, ...myCats);
  } else {
    recs = db.prepare(`SELECT * FROM clubs WHERE status='active' AND id NOT IN (${placeholders}) ORDER BY recruitment_open DESC, member_count DESC LIMIT 10`).all(...excludeIds);
  }
  return { list: recs, total: recs.length };
}));


// ─── 社团群聊房间（获取或创建） ───────────────────────────────
router.get('/:id/room', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const clubId = parseInt(req.params.id);
  // 验证是社团成员
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(clubId, phone);
  if (!member) return makeError('你不是该社团成员', ErrorCode.PERMISSION_DENIED);

  let room = db.prepare('SELECT * FROM club_rooms WHERE club_id = ?').get(clubId);
  if (!room) {
    const club = db.prepare('SELECT name FROM clubs WHERE id = ?').get(clubId);
    if (!club) return makeError('社团不存在', ErrorCode.NOT_FOUND);
    const info = db.prepare('INSERT INTO club_rooms (club_id, name) VALUES (?,?)').run(clubId, club.name + '群聊');
    room = db.prepare('SELECT * FROM club_rooms WHERE id = ?').get(info.lastInsertRowid);
  }

  // 获取群成员角色
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId);
  room.club_name = club.name;
  room.my_role = member.role;
  room.owner_phone = club.president_phone;
  return room;
}));

// ─── 群聊消息列表 ─────────────────────────────────────────────
router.get('/:id/room/messages', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.user.phone;
  const clubId = parseInt(req.params.id);
  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(clubId, phone);
  if (!member) return makeError('你不是该社团成员', ErrorCode.PERMISSION_DENIED);

  const room = db.prepare('SELECT id FROM club_rooms WHERE club_id = ?').get(clubId);
  if (!room) return makeError('群聊不存在', ErrorCode.NOT_FOUND);

  const limit = parseInt(req.query.limit) || 50;
  const before = parseInt(req.query.before) || 0;
  let sql = 'SELECT * FROM club_room_messages WHERE room_id = ?';
  const params = [room.id];
  if (before) { sql += ' AND id < ?'; params.push(before); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);
  const messages = db.prepare(sql).all(...params).reverse();

  // 获取发送者信息
  const phones = [...new Set(messages.map(m => m.sender_phone))];
  const userMap = {};
  if (phones.length) {
    const ph = phones.map(() => '?').join(',');
    db.prepare(`SELECT phone, name, avatar FROM users WHERE phone IN (${ph})`).all(...phones).forEach(u => {
      userMap[u.phone] = u;
    });
  }
  const list = messages.map(m => ({
    ...m,
    sender_name: userMap[m.sender_phone]?.name || '',
    sender_avatar: userMap[m.sender_phone]?.avatar || ''
  }));
  return { list };
}));

// ─── 发送群聊消息 ─────────────────────────────────────────────
router.post('/:id/room/messages', requireAuth, (req, res) => JSON_RES(res, async () => {
  const phone = req.user.phone;
  const clubId = parseInt(req.params.id);
  const { content } = req.body;
  if (!content || !content.trim()) return makeError('消息不能为空', ErrorCode.PARAM_INVALID);

  const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND phone = ?').get(clubId, phone);
  if (!member) return makeError('你不是该社团成员', ErrorCode.PERMISSION_DENIED);

  let room = db.prepare('SELECT * FROM club_rooms WHERE club_id = ?').get(clubId);
  if (!room) {
    const club = db.prepare('SELECT name FROM clubs WHERE id = ?').get(clubId);
    if (!club) return makeError('社团不存在', ErrorCode.NOT_FOUND);
    const info = db.prepare('INSERT INTO club_rooms (club_id, name) VALUES (?,?)').run(clubId, club.name + '群聊');
    room = db.prepare('SELECT * FROM club_rooms WHERE id = ?').get(info.lastInsertRowid);
  }

  // AI审核
  let aiCheck = { violation: false, level: 'none', category: '无', reason: '' };
  try {
    aiCheck = await aiChecker.checkWallPost({ title: '', content: content, topic: '', images: '[]' });
    if (aiCheck.violation && aiCheck.level === 'high') {
      logAiReview('club_room_message', 0, phone, content, aiCheck, 'block');
      return makeError('消息不符合平台规范：' + (aiCheck.reason || ''), 'AI_001');
    }
  } catch(e) { /* 审核失败放行 */ }

  const info = db.prepare('INSERT INTO club_room_messages (room_id, sender_phone, content) VALUES (?,?,?)')
    .run(room.id, phone, content.trim());

  // 记录审核日志
  logAiReview('club_room_message', info.lastInsertRowid, phone, content, aiCheck, 'pass');

  // 更新最后消息
  db.prepare('UPDATE club_rooms SET last_message = ?, last_message_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(content.trim().slice(0, 100), room.id);

  const user = db.prepare('SELECT name, avatar FROM users WHERE phone = ?').get(phone);
  return {
    ok: true,
    message: {
      id: info.lastInsertRowid,
      room_id: room.id,
      sender_phone: phone,
      sender_name: user?.name || '',
      sender_avatar: user?.avatar || '',
      content: content.trim(),
      type: 'text',
      created_at: new Date().toISOString()
    }
  };
}));

module.exports = router;
