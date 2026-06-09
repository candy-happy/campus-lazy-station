// chat.js - 聊天/消息

 async function loadChatList() {
   if (!currentRider) return;
   const list = await API.chatConversations(currentRider.phone);
   const el = document.getElementById('chatListBody');
   const countEl = document.getElementById('msgCount');
   if (!list || !list.length) {
     el.innerHTML = '<div class="msg-empty"><div class="msg-empty-icon">📭</div><div class="msg-empty-text">暂无消息</div><div class="msg-empty-sub">有新消息时会在这里显示</div></div>';
     if (countEl) countEl.textContent = '暂无会话';
     return;
   }
   if (countEl) countEl.textContent = list.length + ' 个会话';
   el.innerHTML = list.map(c => {
     const isMe = c.last_sender === currentRider.phone;
     const t = c.last_message_at ? timeAgo(c.last_message_at) : '';
     return '<div class="chat-item" onclick="openRiderConv('+c.id+',\''+c.other_phone+'\',\''+escHtml(c.other_name||'')+'\')">' +
       '<div class="chat-item-avatar">'+(c.other_name||'?')[0]+'</div>' +
       '<div class="chat-item-info">' +
       '<div class="chat-item-top"><span class="chat-item-name">'+escHtml(c.other_name||c.other_phone)+'</span><span class="chat-item-time">'+t+'</span></div>' +
       '<div class="chat-item-bottom"><span class="chat-item-msg">'+escHtml((isMe?'我: ':'')+(c.last_message||''))+'</span>' +
       (c.unread?'<span class="chat-item-badge">'+c.unread+'</span>':'') +
       '</div></div></div>';
   }).join('');
 }

 async function openRiderChatList() { riderSwitchTab('msg'); }

 async function openRiderConv(convId, otherPhone, otherName) {
   riderConvId = convId;
   riderConvPhone = otherPhone;
   document.getElementById('chatConvTitle').textContent = otherName || otherPhone;
   openSubPage('chatConvPage_sub');
   await loadRiderChatMessages();
   if (riderChatTimer) clearInterval(riderChatTimer);
   riderChatTimer = setInterval(loadRiderChatMessages, 5000);
 }

 async function loadRiderChatMessages() {
   if (!riderConvId) return;
   const msgs = await API.chatMessages(riderConvId, currentRider.phone);
   if (!Array.isArray(msgs)) return;
   const el = document.getElementById('chatMessages');
   el.innerHTML = msgs.map(m => {
     const isMe = m.sender_phone === currentRider.phone;
     const bubbleStyle = 'max-width:72%;padding:10px 14px;border-radius:' + (isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px') + ';font-size:14px;line-height:1.6;background:'+(isMe?'linear-gradient(135deg,#2ECC71,#27AE60)':'var(--card-bg)')+';color:'+(isMe?'#fff':'var(--text)')+';border:1px solid '+(isMe?'transparent':'var(--border)')+';box-shadow:0 1px 4px rgba(0,0,0,.06)';
     let content;
     if (m.type === 'image') {
       content = '<img src="'+escHtml(m.content)+'" style="max-width:100%;border-radius:8px;display:block" onclick="window.open(this.src)" />';
     } else if (m.type === 'video') {
       content = '<video src="'+escHtml(m.content)+'" style="max-width:100%;border-radius:8px;display:block" controls preload="metadata"></video>';
     } else {
       content = escHtml(m.content);
     }
     return '<div style="display:flex;justify-content:'+(isMe?'flex-end':'flex-start')+';margin-bottom:12px">' +
       '<div style="'+bubbleStyle+'">'+content+'</div></div>';
   }).join('');
   el.scrollTop = el.scrollHeight;
 }

 async function sendChatMsg() {
   const input = document.getElementById('chatInput');
   const content = input.value.trim();
   if (!content || !riderConvId) return;
   const res = await API.chatSend({ conversation_id: riderConvId, sender_phone: currentRider.phone, content });
   if (res.error) return showToast(res.error);
   input.value = '';
   await loadRiderChatMessages();
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
   // 文件大小检查
   if (file.size > 20 * 1024 * 1024) return showToast('文件不能超过20MB');
   showToast('上传中...');
   try {
     const res = await API.chatUpload(file);
     if (res.error) return showToast(res.error);
     // 发送媒体消息
     const sendRes = await API.chatSend({
       conversation_id: riderConvId,
       sender_phone: currentRider.phone,
       content: res.url,
       type: res.type
     });
     if (sendRes.error) return showToast(sendRes.error);
     await loadRiderChatMessages();
   } catch(e) {
     showToast('上传失败: ' + (e.message||e));
   }
   input.value = '';
 }

 async function openChatFromOrder(orderNo) {
   if (!currentRider) return showToast('请先登录');
   // 从多个来源查找订单
   const allOrders = [...(myOrders||[]), ...(newOrders||[])];
   let o = allOrders.find(x => x.order_no === orderNo);
   // 如果内存中没找到，尝试从API获取
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

// Exports
window.loadChatList = loadChatList;
window.openRiderChatList = openRiderChatList;
window.openRiderConv = openRiderConv;
window.loadRiderChatMessages = loadRiderChatMessages;
window.sendChatMsg = sendChatMsg;
window.toggleRiderEmojiPicker = toggleRiderEmojiPicker;
window.insertRiderEmoji = insertRiderEmoji;
window.riderChatUpload = riderChatUpload;
window.openChatFromOrder = openChatFromOrder;
