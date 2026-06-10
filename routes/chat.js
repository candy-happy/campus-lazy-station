// routes/chat.js - 聊天路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── 辅助：获取当前登录用户手机号 ──────────────────────────
function getAuthPhone(req) {
  return req.user && req.user.phone;
}

// ─── 辅助：验证用户是否是会话参与者 ──────────────────────────
function isConversationParticipant(convId, phone) {
  if (!convId || !phone) return false;
  const conv = db.prepare('SELECT user1_phone, user2_phone FROM conversations WHERE id=?').get(convId);
  if (!conv) return false;
  return conv.user1_phone === phone || conv.user2_phone === phone;
}

// ─── 聊天文件上传配置 ──────────────────────────────────────
const CHAT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(CHAT_UPLOAD_DIR)) fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHAT_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith('video') ? '.mp4' : '.jpg');
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    cb(null, ok);
  }
});

// ─── 聊天文件上传 ──────────────────────────────────────────
router.post('/upload', requireAuth, chatUpload.single('file'), (req, res) => JSON_RES(res, () => {
  if (!req.file) return makeError('请选择文件', ErrorCode.PARAM_MISSING);
  const url = '/uploads/chat/' + req.file.filename;
  const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  return { ok: true, url, type, filename: req.file.filename };
}));

// ─── 获取或创建会话 ──────────────────────────────────────
router.post('/conversation', requireAuth, (req, res) => JSON_RES(res, () => {
  const { user_phone, rider_phone, order_id, order_title } = req.body;
  if (!user_phone || !rider_phone) return makeError('缺少手机号', ErrorCode.CHAT_PARAM_INCOMPLETE);
  // 安全校验：当前登录用户必须是会话参与者之一
  const authPhone = getAuthPhone(req);
  if (authPhone !== user_phone && authPhone !== rider_phone) {
    return makeError('无权创建此会话', ErrorCode.PARAM_INVALID);
  }
  // 查询已有会话：order_id有值时按item_id精确匹配，无值(null/0)时忽略item_id
  let conv;
  if (order_id) {
    conv = db.prepare(
      "SELECT * FROM conversations WHERE ((user1_phone=? AND user2_phone=?) OR (user1_phone=? AND user2_phone=?)) AND item_id=?"
    ).get(user_phone, rider_phone, rider_phone, user_phone, order_id);
  } else {
    conv = db.prepare(
      "SELECT * FROM conversations WHERE ((user1_phone=? AND user2_phone=?) OR (user1_phone=? AND user2_phone=?)) AND item_id IS NULL"
    ).get(user_phone, rider_phone, rider_phone, user_phone);
  }
  if (!conv) {
    const r = db.prepare(
      "INSERT INTO conversations (user1_phone,user2_phone,item_id,item_title,created_at) VALUES (?,?,?,?,datetime('now','localtime'))"
    ).run(user_phone, rider_phone, order_id || null, order_title || '');
    conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(r.lastInsertRowid);
  }
  return conv;
}));

// ─── 会话列表 ──────────────────────────────────────────────
router.get('/conversations', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = getAuthPhone(req);
  if (!phone) return [];
  const convs = db.prepare(
    "SELECT c.*, " +
    "(SELECT COUNT(*) FROM messages WHERE conversation_id=c.id AND sender_phone!=? AND is_read=0) as unread " +
    "FROM conversations c WHERE user1_phone=? OR user2_phone=? ORDER BY last_message_at DESC, created_at DESC"
  ).all(phone, phone, phone);
  return convs.map(c => {
    const otherPhone = c.user1_phone === phone ? c.user2_phone : c.user1_phone;
    const otherUser = db.prepare('SELECT name,phone FROM users WHERE phone=?').get(otherPhone)
      || db.prepare('SELECT name,phone FROM riders WHERE phone=?').get(otherPhone)
      || { name: '未知用户', phone: otherPhone };
    return { ...c, other_name: otherUser.name, other_phone: otherPhone };
  });
}));

// ─── 发送消息 ──────────────────────────────────────────────
router.post('/send', requireAuth, (req, res) => JSON_RES(res, () => {
  const { conversation_id, sender_phone, content, type } = req.body;
  if (!conversation_id || !sender_phone || !content) return makeError('参数不完整', ErrorCode.CHAT_PARAM_INCOMPLETE);
  // 安全校验：发送者必须是当前登录用户
  const authPhone = getAuthPhone(req);
  if (authPhone !== sender_phone) {
    return makeError('只能以本人身份发送消息', ErrorCode.PARAM_INVALID);
  }
  // 安全校验：发送者必须是会话参与者
  if (!isConversationParticipant(conversation_id, sender_phone)) {
    return makeError('你不是该会话的参与者', ErrorCode.PARAM_INVALID);
  }
  const r = db.prepare(
    "INSERT INTO messages (conversation_id,sender_phone,content,type,created_at) VALUES (?,?,?,?,datetime('now','localtime'))"
  ).run(conversation_id, sender_phone, content, type || 'text');
  db.prepare(
    "UPDATE conversations SET last_message=?, last_message_at=datetime('now','localtime'), last_sender=? WHERE id=?"
  ).run(content.slice(0, 100), sender_phone, conversation_id);
  return { ok: true, id: r.lastInsertRowid };
}));

// ─── 消息列表 ──────────────────────────────────────────────
router.get('/messages/:conversation_id', requireAuth, (req, res) => JSON_RES(res, () => {
  const cid = req.params.conversation_id;
  const phone = getAuthPhone(req);
  // 安全校验：只有会话参与者才能查看消息
  if (!isConversationParticipant(cid, phone)) {
    return makeError('无权查看此会话', ErrorCode.PARAM_INVALID);
  }
  const before = req.query.before;
  let msgs;
  if (before) {
    msgs = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND id<? ORDER BY id DESC LIMIT 30').all(cid, before);
  } else {
    msgs = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 30').all(cid);
  }
  // 标记已读
  if (phone) {
    db.prepare('UPDATE messages SET is_read=1 WHERE conversation_id=? AND sender_phone!=? AND is_read=0').run(cid, phone);
  }
  return msgs.reverse();
}));

// ─── 未读消息数 ────────────────────────────────────────────
router.get('/unread', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = getAuthPhone(req);
  if (!phone) return { count: 0 };
  const count = db.prepare(
    'SELECT COUNT(*) as n FROM messages WHERE sender_phone!=? AND is_read=0 AND conversation_id IN (SELECT id FROM conversations WHERE user1_phone=? OR user2_phone=?)'
  ).get(phone, phone, phone).n;
  return { count };
}));

// ─── 校园墙私聊：获取或创建会话（带隐私校验）───────────
router.post('/wall-chat', requireAuth, (req, res) => JSON_RES(res, () => {
  const { from_phone, to_phone } = req.body;
  if (!from_phone || !to_phone) return makeError('缺少手机号', ErrorCode.CHAT_PARAM_INCOMPLETE);
  if (from_phone === to_phone) return makeError('不能给自己发私信', ErrorCode.PARAM_INVALID);
  // 安全校验：发送者必须是当前登录用户
  const authPhone = getAuthPhone(req);
  if (authPhone !== from_phone) {
    return makeError('只能以本人身份发起私聊', ErrorCode.PARAM_INVALID);
  }

  // 检查对方的私聊隐私设置
  const targetUser = db.prepare('SELECT phone, chat_privacy FROM users WHERE phone=?').get(to_phone);
  if (!targetUser) return makeError('用户不存在', ErrorCode.USER_NOT_FOUND);

  const privacy = targetUser.chat_privacy || 'all';
  if (privacy !== 'all') {
    // 检查关注关系
    // iFollow: 我(from)是否关注了对方(to) → from_phone 关注 to_phone
    const iFollow = db.prepare('SELECT id FROM wall_follows WHERE follower_phone=? AND following_phone=?').get(from_phone, to_phone);
    // theyFollowMe: 对方(to)是否关注了我(from) → to_phone 关注 from_phone
    const theyFollowMe = db.prepare('SELECT id FROM wall_follows WHERE follower_phone=? AND following_phone=?').get(to_phone, from_phone);
    if (privacy === 'followers') {
      // "关注我的人才能私聊" → 只有关注了对方的人(from关注to)才能私聊对方
      if (!iFollow) return makeError('对方仅允许关注者私聊，请先关注TA', ErrorCode.CHAT_PRIVACY_BLOCKED);
    } else if (privacy === 'mutual') {
      // 互相关注才能私聊
      if (!iFollow || !theyFollowMe) {
        const reason = !iFollow ? '你需要先关注对方' : '对方还没有关注你';
        return makeError('对方仅允许互关私聊，' + reason, ErrorCode.CHAT_PRIVACY_BLOCKED);
      }
    }
  }

  // 获取或创建会话（item_id 为 NULL 表示校园墙私聊）
  let conv = db.prepare(
    "SELECT * FROM conversations WHERE ((user1_phone=? AND user2_phone=?) OR (user1_phone=? AND user2_phone=?)) AND item_id IS NULL"
  ).get(from_phone, to_phone, to_phone, from_phone);
  if (!conv) {
    const r = db.prepare(
      "INSERT INTO conversations (user1_phone, user2_phone, item_id, item_title, created_at) VALUES (?,?,NULL,'校园墙私信',datetime('now','localtime'))"
    ).run(from_phone, to_phone);
    conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(r.lastInsertRowid);
  }
  return conv;
}));

// ─── 获取用户私聊隐私设置 ────────────────────────────────
router.get('/chat-privacy', requireAuth, (req, res) => JSON_RES(res, () => {
  const phone = req.query.phone;
  if (!phone) return makeError('缺少手机号', ErrorCode.PARAM_MISSING);
  // 安全校验：只能查看自己的隐私设置
  const authPhone = getAuthPhone(req);
  if (authPhone !== phone) {
    return makeError('无权查看他人的隐私设置', ErrorCode.PARAM_INVALID);
  }
  const user = db.prepare('SELECT chat_privacy FROM users WHERE phone=?').get(phone);
  return { privacy: (user && user.chat_privacy) || 'all' };
}));

// ─── 更新用户私聊隐私设置 ────────────────────────────────
router.put('/chat-privacy', requireAuth, (req, res) => JSON_RES(res, () => {
  const { phone, privacy } = req.body;
  if (!phone) return makeError('缺少手机号', ErrorCode.PARAM_MISSING);
  // 安全校验：只能修改自己的隐私设置
  const authPhone = getAuthPhone(req);
  if (authPhone !== phone) {
    return makeError('无权修改他人的隐私设置', ErrorCode.PARAM_INVALID);
  }
  if (!['all', 'mutual', 'followers'].includes(privacy)) return makeError('无效的隐私设置', ErrorCode.PARAM_INVALID);
  db.prepare('UPDATE users SET chat_privacy=? WHERE phone=?').run(privacy, phone);
  return { ok: true, privacy };
}));

module.exports = router;
