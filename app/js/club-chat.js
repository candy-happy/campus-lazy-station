// club-chat.js - 社团群聊 v3.0.0

var currentClubChatId = null;
var _myClubs = [];

// ═══════════════════════════════════════════════════════
// 社团群聊条目渲染（供 loadChatList 调用）
// ═══════════════════════════════════════════════════════
function renderClubChatItems(clubs) {
  if (!clubs || !clubs.length) return '';
  _myClubs = clubs;
  var items = '';
  clubs.forEach(function(club) {
    if (!club.room_id) return;
    var avatarHtml = club.logo
      ? '<img src="' + club.logo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : '👥';
    items += '<div class="chat-item" onclick="openClubRoom(' + club.id + ')">' +
      '<div class="chat-item-avatar club-room-avatar">' + avatarHtml + '</div>' +
      '<div class="chat-item-info">' +
        '<div class="chat-item-top">' +
          '<span class="chat-item-name">' + escHtml(club.name) + '</span>' +
          '<span class="chat-item-time">' + (club.last_message_at ? timeAgo(club.last_message_at) : '') + '</span>' +
        '</div>' +
        '<div class="chat-item-bottom">' +
          '<span class="chat-item-msg">' + escHtml(club.last_message || '暂无消息') + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  return items;
}

// ═══════════════════════════════════════════════════════
// 打开社团群聊界面
// ═══════════════════════════════════════════════════════
function openClubRoom(clubId) {
  if (!currentUser) {
    if (typeof showLoginPage === 'function') showLoginPage();
    return;
  }
  currentClubChatId = clubId;

  // 查找社团名称
  var club = _myClubs.find(function(c) { return c.id === clubId; });
  var clubName = club ? club.name : '社团群聊';

  // 隐藏聊天列表和私信对话
  var chatListBody = document.getElementById('chatListBody');
  var chatConversation = document.getElementById('chatConversation');
  var notifConversation = document.getElementById('notifConversation');
  if (chatListBody) chatListBody.style.display = 'none';
  if (chatConversation) chatConversation.style.display = 'none';
  if (notifConversation) notifConversation.style.display = 'none';

  // 显示社团群聊对话区域
  var clubConv = document.getElementById('clubChatConversation');
  if (clubConv) clubConv.style.display = 'flex';

  // 设置标题
  var titleEl = document.getElementById('clubChatTitle');
  if (titleEl) titleEl.textContent = clubName;

  // 加载消息
  loadClubRoomMessages(clubId);
}

// ═══════════════════════════════════════════════════════
// 加载社团群聊消息
// ═══════════════════════════════════════════════════════
function loadClubRoomMessages(clubId) {
  if (!clubId) return;
  API.getClubRoomMessages(clubId).then(function(res) {
    var msgs = Array.isArray(res) ? res : (res && res.list ? res.list : []);
    var el = document.getElementById('clubChatMessages');
    if (!el) return;
    if (!msgs.length) {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">暂无消息</div>';
      return;
    }
    el.innerHTML = msgs.map(function(m) {
      var isMe = currentUser && m.sender_phone === currentUser.phone;
      var time = new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      var avatarInitial = (m.sender_name || '?')[0];
      // 发送者头像
      var avatarHtml = m.sender_avatar
        ? '<img src="' + escHtml(m.sender_avatar) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=&apos;none&apos;" />'
        : '<img src="/uploads/avatars/default-girl.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=&apos;none&apos;" />';

      var senderHtml = isMe ? '' :
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
          '<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#FF6B2B,#FF8F5E);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + avatarHtml + '</div>' +
          '<span style="font-size:12px;color:var(--text-secondary);font-weight:600">' + escHtml(m.sender_name || '匿名') + '</span>' +
        '</div>';

      var bubbleClass = isMe ? 'message-bubble me' : 'message-bubble other';
      var bubbleStyle = '';
      if (!isMe) {
        bubbleStyle = 'margin-left:32px';
      }

      return '<div class="' + bubbleClass + '" style="' + bubbleStyle + '">' +
        senderHtml +
        '<div class="message-content">' + escHtml(m.content) + '<div class="message-time">' + time + '</div></div>' +
      '</div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }).catch(function(e) {
    console.error('加载社团消息失败:', e);
  });
}

// ═══════════════════════════════════════════════════════
// 发送社团群聊消息
// ═══════════════════════════════════════════════════════
function sendClubRoomMsg(clubId) {
  if (!currentUser) {
    if (typeof showLoginPage === 'function') showLoginPage();
    return;
  }
  if (!clubId) return;
  var input = document.getElementById('clubChatInput');
  if (!input) return;
  var content = input.value.trim();
  if (!content) return;
  input.value = '';

  API.sendClubRoomMessage(clubId, content).then(function(res) {
    if (res && res.error) {
      if (typeof showToast === 'function') showToast(res.error);
      return;
    }
    // 重新加载消息
    loadClubRoomMessages(clubId);
  }).catch(function(e) {
    console.error('发送社团消息失败:', e);
  });
}

// ═══════════════════════════════════════════════════════
// 返回聊天列表
// ═══════════════════════════════════════════════════════
function backFromClubRoom() {
  currentClubChatId = null;
  var clubConv = document.getElementById('clubChatConversation');
  if (clubConv) clubConv.style.display = 'none';
  // 显示聊天列表
  var chatListBody = document.getElementById('chatListBody');
  if (chatListBody) chatListBody.style.display = '';
  // 重新加载聊天列表
  if (typeof loadChatList === 'function') loadChatList();
}

// ═══════════════════════════════════════════════════════
// 导出到 window
// ═══════════════════════════════════════════════════════
window.currentClubChatId = currentClubChatId;
window.openClubRoom = openClubRoom;
window.loadClubRoomMessages = loadClubRoomMessages;
window.sendClubRoomMsg = sendClubRoomMsg;
window.backFromClubRoom = backFromClubRoom;
window.renderClubChatItems = renderClubChatItems;
