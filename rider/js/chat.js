// chat.js - 骑手聊天/消息（优化版）

const riderAvatarColors = ['av-green','av-orange','av-blue','av-purple','av-pink'];

function avatarClass(phone) { return riderAvatarColors[Math.abs(hashCode(phone || '0')) % riderAvatarColors.length]; }
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h; }

async function loadChatList() {
  console.log('[loadChatList] called, currentRider:', !!currentRider, currentRider ? currentRider.phone : 'N/A');
  if (!currentRider) { console.warn('[loadChatList] no currentRider'); return; }
  try {
    // DEBUG: 直接fetch绕过API封装
    const rawRes = await fetch('/api/chat/conversations?phone=' + currentRider.phone, {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_rider_token') || 'NO_TOKEN') }
    });
    console.log('[loadChatList] RAW fetch status:', rawRes.status, 'ok:', rawRes.ok);
    const list = await rawRes.json();
    console.log('[loadChatList] raw type:', typeof list, Array.isArray(list), 'val:', JSON.stringify(list)?.slice(0,300));
    // const list = await API.chatConversations(currentRider.phone);
    const el = document.getElementById('chatListBody');
    const countEl = document.getElementById('msgCount');
    const arr = Array.isArray(list) ? list : [];
    window._riderAllChats = arr;
    if (!arr.length) {
      el.innerHTML = '<div class="msg-empty"><div class="msg-empty-icon">📭</div><div class="msg-empty-text">暂无消息</div><div class="msg-empty-sub">接单后可与用户实时沟通</div></div>';
      if (countEl) countEl.textContent = '暂无会话';
      return;
    }
    if (countEl) countEl.textContent = arr.length + ' 个会话';
    renderChatItems(arr, el);
  } catch(e) {
    console.error('[loadChatList]', e.message, e.stack);
    var cel = document.getElementById('chatListBody');
    if (cel) cel.innerHTML = '<div style="padding:20px;color:red;font-size:13px">加载失败: ' + (e.message||e) + '</div>';
  }
}

function renderChatItems(list, el) {
  if (!list || !list.length) return;
  try {
    el.innerHTML = list.map(c => {
    const isMe = c.last_sender === currentRider.phone;
    const t = c.last_message_at ? timeAgo(c.last_message_at) : '';
    const name = escHtml(c.other_name || c.other_phone);
    const initial = (c.other_name || c.other_phone || '?')[0];
    const ac = avatarClass(c.other_phone);
    // 订单标签
    let orderTag = '';
    if (c.order_status) {
      const st = c.order_status;
      const otClass = st === 'completed' ? 'ot-completed' : (st === 'running' || st === 'accepted') ? 'ot-running' : 'ot-pending';
      const otText = st === 'completed' ? '已完成' : (st === 'running' || st === 'accepted') ? '进行中' : '待处理';
      orderTag = '<span class="chat-item-order-tag '+otClass+'">'+otText+'</span>';
    }
    const preview = escHtml((isMe ? '我: ' : '') + (c.last_message || ''));
    const unreadBadge = c.unread ? '<span class="chat-item-badge">'+c.unread+'</span>' : '';
    return '<div class="chat-item" onclick="openRiderConv('+c.id+',\''+escAttr(c.other_phone)+'\',\''+escAttr(c.other_name||'')+'\')">' +
      '<div class="chat-item-avatar '+ac+'">'+(c.other_avatar ? '<img src="'+escAttr(c.other_avatar)+'" />' : initial)+'</div>' +
      '<div class="chat-item-info">' +
      '<div class="chat-item-top"><span class="chat-item-name">'+name+'</span><span class="chat-item-time">'+t+'</span></div>' +
      '<div class="chat-item-bottom">'+orderTag+'<span class="chat-item-msg">'+preview+'</span>'+unreadBadge+'</div>' +
      '</div></div>';
    }).join('');
  } catch(e) {
    console.error('[renderChatItems]', e.message, e.stack);
    el.innerHTML = '<div style="padding:20px;color:red;font-size:13px">消息渲染异常: ' + escHtml(e.message) + '</div>';
  }
}

function filterChatList() {
  const q = (document.getElementById('msgSearchInput')?.value || '').trim().toLowerCase();
  const list = window._riderAllChats || [];
  const el = document.getElementById('chatListBody');
  if (!list.length) return;
  if (!q) { renderChatItems(list, el); return; }
  const filtered = list.filter(c => {
    const name = (c.other_name || c.other_phone || '').toLowerCase();
    const msg = (c.last_message || '').toLowerCase();
    const title = (c.order_title || '').toLowerCase();
    return name.includes(q) || msg.includes(q) || title.includes(q);
  });
  if (!filtered.length) {
    el.innerHTML = '<div class="msg-empty"><div class="msg-empty-icon">🔍</div><div class="msg-empty-text">未找到匹配的会话</div></div>';
    return;
  }
  renderChatItems(filtered, el);
}

async function openRiderChatList() { riderSwitchTab('msg'); await loadChatList(); }

async function openRiderConv(convId, otherPhone, otherName) {
  riderConvId = convId;
  riderConvPhone = otherPhone;
  document.getElementById('chatConvTitle').textContent = otherName || otherPhone;
  openSubPage('chatConvPage_sub');
  window._riderChatLastTimeDivider = null;
  await loadRiderChatMessages();
  scrollChatToBottom();
  if (riderChatTimer) clearInterval(riderChatTimer);
  riderChatTimer = setInterval(loadRiderChatMessages, 5000);
}

function closeChatConv() {
  if (riderChatTimer) { clearInterval(riderChatTimer); riderChatTimer = null; }
  riderConvId = null;
  riderConvPhone = null;
  closeSubPage('chatConvPage_sub');
  loadChatList();
}

function formatChatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return time;
  if (isYesterday) return '昨天 ' + time;
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' + time;
}

function chatTimeDividerLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (isToday) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  const y = d.getFullYear();
  return y === now.getFullYear() ? (d.getMonth()+1) + '月' + d.getDate() + '日' : y + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
}

// 是否需要显示时间分割线
function needTimeDivider(prevTime, currTime) {
  if (!prevTime || !currTime) return true;
  const p = new Date(prevTime);
  const c = new Date(currTime);
  return p.toDateString() !== c.toDateString() || (Math.abs(c - p) > 5 * 60 * 1000); // 超过5分钟
}

async function loadRiderChatMessages() {
  if (!riderConvId) return;
  const msgs = await API.chatMessages(riderConvId, currentRider.phone);
  if (!Array.isArray(msgs)) return;
  const el = document.getElementById('chatMessages');
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  let html = '';
  let lastTime = window._riderChatLastTimeDivider;
  let lastSender = null;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const isMe = m.sender_phone === currentRider.phone;
    const wrapClass = isMe ? 'me' : 'you';
    const showAvatar = lastSender !== m.sender_phone; // 连续同人只显示一次头像
    lastSender = m.sender_phone;

    // 时间分割线
    if (needTimeDivider(lastTime, m.created_at)) {
      html += '<div class="chat-time-divider"><span>'+chatTimeDividerLabel(m.created_at)+'</span></div>';
      lastTime = m.created_at;
    }

    html += '<div class="chat-msg-wrap '+wrapClass+'">';
    // 对方消息：头像在左
    if (!isMe && showAvatar) {
      const initial = (m.sender_name || m.sender_phone || '?')[0];
      html += '<div class="chat-msg-avatar you-av">'+(m.sender_avatar ? '<img src="'+escAttr(m.sender_avatar)+'" />' : initial)+'</div>';
    } else if (!isMe) {
      html += '<div class="chat-msg-avatar you-av" style="visibility:hidden"></div>';
    }

    // 消息气泡
    html += '<div class="chat-msg-bubble">';
    if (m.type === 'image') {
      html += '<img src="'+escAttr(m.content)+'" loading="lazy" onclick="window.open(this.src)" />';
    } else if (m.type === 'video') {
      html += '<video src="'+escAttr(m.content)+'" controls preload="metadata" style="max-width:200px"></video>';
    } else {
      html += escHtml(m.content);
    }
    html += '<div class="chat-msg-time">'+formatChatTime(m.created_at)+'</div>';
    html += '</div>';

    // 自己消息：头像在右
    if (isMe && showAvatar) {
      const myInitial = (currentRider.name || currentRider.phone || '?')[0];
      html += '<div class="chat-msg-avatar me-av">'+(currentRider.avatar ? '<img src="'+escAttr(currentRider.avatar)+'" />' : myInitial)+'</div>';
    } else if (isMe) {
      html += '<div class="chat-msg-avatar me-av" style="visibility:hidden"></div>';
    }

    html += '</div>';
  }

  window._riderChatLastTimeDivider = lastTime;
  el.innerHTML = html;
  if (wasAtBottom) scrollChatToBottom();
}

function scrollChatToBottom() {
  const el = document.getElementById('chatMessages');
  if (el) { el.scrollTop = el.scrollHeight; }
  const btn = document.getElementById('chatScrollBottom');
  if (btn) btn.classList.remove('show');
}

function onChatScroll() {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const btn = document.getElementById('chatScrollBottom');
  if (!btn) return;
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (distFromBottom > 200) { btn.classList.add('show'); }
  else { btn.classList.remove('show'); }
}

async function sendChatMsg() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !riderConvId) return;
  const res = await API.chatSend({ conversation_id: riderConvId, sender_phone: currentRider.phone, content });
  if (res.error) return showToast(res.error);
  input.value = '';
  await loadRiderChatMessages();
  scrollChatToBottom();
}

function toggleRiderEmojiPicker() {
  const picker = document.getElementById('riderEmojiPicker');
  if (!picker) return;
  if (!riderEmojiInited) {
    const grid = document.getElementById('riderEmojiGrid');
    if (grid) grid.innerHTML = riderEmojiList.map(e => '<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;display:inline-block;transition:background .15s" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'" onclick="insertRiderEmoji(\''+e+'\')">' + e + '</span>').join('');
    riderEmojiInited = true;
  }
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

function insertRiderEmoji(emoji) {
  const input = document.getElementById('chatInput');
  if (input) { input.value += emoji; input.focus(); }
  const picker = document.getElementById('riderEmojiPicker');
  if (picker) picker.style.display = 'none';
}

async function riderChatUpload(input) {
  const file = input.files && input.files[0];
  if (!file || !riderConvId) return;
  if (file.size > 20 * 1024 * 1024) return showToast('文件不能超过20MB');
  showToast('上传中...');
  try {
    const res = await API.chatUpload(file);
    if (res.error) return showToast(res.error);
    const sendRes = await API.chatSend({
      conversation_id: riderConvId,
      sender_phone: currentRider.phone,
      content: res.url,
      type: res.type
    });
    if (sendRes.error) return showToast(sendRes.error);
    await loadRiderChatMessages();
    scrollChatToBottom();
  } catch(e) {
    showToast('上传失败: ' + (e.message||e));
  }
  input.value = '';
}

async function openChatFromOrder(orderNo) {
  if (!currentRider) return showToast('请先登录');
  const allOrders = [...(myOrders||[]), ...(newOrders||[])];
  let o = allOrders.find(x => x.order_no === orderNo);
  if (!o) {
    try {
      const res = await API.getOrders({ rider_phone: currentRider.phone, status: 'my' });
      const list = Array.isArray(res) ? res : (res && res.list || []);
      o = list.find(x => x.order_no === orderNo);
      if (o) myOrders = list;
    } catch(e2) { console.error('fetch order error:', e2); }
  }
  if (!o || !o.phone) return showToast('无法获取用户信息');
  try {
    const conv = await API.chatGetOrCreateConversation({
      user_phone: o.phone,
      rider_phone: currentRider.phone,
      order_id: o.id || o.order_no,
      order_title: (serviceNames[o.type]||'服务') + ' - ' + (o.pickup_location||'')
    });
    closeSubPage('detailPage_sub');
    await openRiderConv(conv.id, o.phone, o.user_name || '用户');
  } catch(e) {
    showToast('打开聊天失败: ' + (e.message||e));
    console.error('openChatFromOrder error:', e);
  }
}

// 辅助：转义HTML属性
function escAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Exports
window.loadChatList = loadChatList;
window.openRiderChatList = openRiderChatList;
window.openRiderConv = openRiderConv;
window.closeChatConv = closeChatConv;
window.loadRiderChatMessages = loadRiderChatMessages;
window.sendChatMsg = sendChatMsg;
window.toggleRiderEmojiPicker = toggleRiderEmojiPicker;
window.insertRiderEmoji = insertRiderEmoji;
window.riderChatUpload = riderChatUpload;
window.openChatFromOrder = openChatFromOrder;
window.filterChatList = filterChatList;
window.scrollChatToBottom = scrollChatToBottom;
window.onChatScroll = onChatScroll;
