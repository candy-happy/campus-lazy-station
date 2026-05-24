// routes/chat.js - 聊天路由
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { JSON_RES, ErrorCode, makeError } = require('../utils/response');

// ─── 获取或创建会话 ──────────────────────────────────────
router.post('/conversation', requireAuth, (req, res) => JSON_RES(res, () => {
  const { user_phone, rider_phone, order_id, order_title } = req.body;
  if (!user_phone || !rider_phone) return makeError('缺少手机号', ErrorCode.CHAT_PARAM_INCOMPLETE);
  let conv = db.prepare(
    "SELECT * FROM conversations WHERE ((user1_phone=? AND user2_phone=?) OR (user1_phone=? AND user2_phone=?)) AND (item_id=? OR 0=?)"
  ).get(user_phone, rider_phone, rider_phone, user_phone, order_id || 0, order_id ? 0 : 1);
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
  const phone = req.query.phone;
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
  const phone = req.query.phone;
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
  const phone = req.query.phone;
  if (!phone) return { count: 0 };
  const count = db.prepare(
    'SELECT COUNT(*) as n FROM messages WHERE sender_phone!=? AND is_read=0 AND conversation_id IN (SELECT id FROM conversations WHERE user1_phone=? OR user2_phone=?)'
  ).get(phone, phone, phone).n;
  return { count };
}));

module.exports = router;
