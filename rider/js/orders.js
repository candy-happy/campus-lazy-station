// orders.js - 订单管理

 function showOrderDetail(orderNo, mode) {
   const o = (myOrders || []).find(x => x.order_no === orderNo);
   if (!o) return showToast('订单不存在');
   const content = $('detailContent');
   if (!content) return;
   let userInfo = '';
   if (o.phone && o.user_name) {
     userInfo = '<div class="rd-card"><div class="rd-card-title">👤 用户信息</div><div class="rd-card-body"><div style="font-size:14px;font-weight:600">'+escHtml(o.user_name)+'</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">'+escHtml(o.phone)+'</div></div></div>';
   }
   let actionBtn = '';
   if (mode === 'accept') {
     actionBtn = '<button data-order="'+o.order_no+'" onclick="acceptOrder(this.dataset.order)" class="rd-btn rd-btn-success">接单 🛵</button>';
   } else if (o.status === 'accepted') {
     actionBtn = '<button data-order="'+o.order_no+'" onclick="startDelivery(this.dataset.order)" class="rd-btn rd-btn-blue">开始配送 🚀</button>';
   } else if (o.status === 'running') {
     actionBtn = '<button data-order="'+o.order_no+'" onclick="completeOrder(this.dataset.order)" class="rd-btn rd-btn-success">确认送达 ✅</button>';
   } else {
     actionBtn = '<div class="rd-status-end">订单已结束</div>';
   }
   // 骑手审核取消申请
   let cancelReviewBtn = '';
   if (o.cancel_request_status === 'pending') {
     cancelReviewBtn = '<div style="padding:12px;background:#FFF8E1;border-radius:10px;margin:8px 0"><div style="font-size:13px;color:#F39C12;margin-bottom:8px">⚠️ 用户申请取消此订单</div><div style="font-size:12px;color:#666;margin-bottom:8px">原因: '+escHtml(o.cancel_request_reason||'')+'</div><button onclick="riderReviewCancel(\''+o.order_no+'\',\'approve\')" class="rd-btn rd-btn-success" style="margin-right:8px">✅ 同意取消</button><button onclick="riderReviewCancel(\''+o.order_no+'\',\'reject\')" class="rd-btn" style="background:#E74C3C;color:#fff">❌ 拒绝</button></div>';
   }
   const chatBtn = (mode !== 'accept' && o.phone) ? '<button data-order="'+o.order_no+'" onclick="openChatFromOrder(this.dataset.order)" class="rd-btn rd-btn-chat">💬 联系用户</button>' : '';
   content.innerHTML = `
   <div class="rd-status-hero" style="background:${statusColor[o.status]||'#95A5A6'}">
     <div class="rd-status-icon">${statusIcon[o.status]||'📋'}</div>
     <div class="rd-status-text">${statusLabel[o.status]||o.status}</div>
     <div class="rd-status-sub">${typeEmoji[o.type]||'📦'} ${serviceNames[o.type]||'服务'}</div>
   </div>
   <div class="rd-fee-row">
     <span class="rd-fee-label">订单金额</span>
     <span class="rd-fee-amount">¥${(o.price||0).toFixed(2)}</span>
   </div>
   <div class="rd-card">
     <div class="rd-card-title">📍 配送信息</div>
     <div class="rd-card-body">
       <div class="rd-addr-row">
         <div class="rd-addr-dot" style="background:#2ECC71"></div>
         <div class="rd-addr-info"><span class="rd-addr-tag">取货</span>${escHtml(o.pickup_location)}</div>
       </div>
       <div class="rd-addr-line"></div>
       <div class="rd-addr-row">
         <div class="rd-addr-dot" style="background:var(--orange)"></div>
         <div class="rd-addr-info"><span class="rd-addr-tag">送达</span>${escHtml(o.delivery_location)}</div>
       </div>
     </div>
   </div>
   <div class="rd-card">
     <div class="rd-card-title">📝 备注</div>
     <div class="rd-card-body">
       <div class="rd-note">${escHtml(o.details||'无备注')}</div>
     </div>
   </div>
   ${userInfo}
   <div class="rd-card">
     <div class="rd-card-title">🕐 时间</div>
     <div class="rd-card-body">
       <div class="rd-time">订单号: ${o.order_no}</div>
       <div class="rd-time">下单: ${fmtTime(o.created_at)}</div>
       ${o.accepted_at ? '<div class="rd-time">接单: '+fmtTime(o.accepted_at)+'</div>' : ''}
       ${o.completed_at ? '<div class="rd-time">完成: '+fmtTime(o.completed_at)+'</div>' : ''}
     </div>
   </div>
   <div class="rd-actions">
     ${cancelReviewBtn}
     ${actionBtn}
     ${chatBtn}
   </div>
   `;
   openSubPage('detailPage_sub');
 }

 function riderSwitchFilter(status) {
   riderStatusFilter = status;
   document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
   const labelMap = { all:'全部', pending:'待接单', running:'进行中', completed:'已完成', cancelled:'已取消' };
   const targetText = labelMap[status] || '';
   document.querySelectorAll('.order-tab').forEach(t => {
     if (t.textContent.includes(targetText)) t.classList.add('active');
   });
   renderRiderOrders();
 }

 function riderSwitchTime(period) {
   riderTimeFilter = period;
   document.querySelectorAll('.time-filter-chip').forEach(c => c.classList.remove('active'));
   if (event && event.target) event.target.classList.add('active');
   const rangeEl = document.getElementById('riderCustomTimeRange');
   if (period === 'custom') {
     rangeEl.style.display = 'flex';
   } else {
     rangeEl.style.display = 'none';
     riderDateFrom = null;
     riderDateTo = null;
   }
   renderRiderOrders();
 }

 function riderApplyCustomTime() {
   const from = document.getElementById('riderDateFrom').value;
   const to = document.getElementById('riderDateTo').value;
   riderDateFrom = from ? new Date(from) : null;
   riderDateTo = to ? new Date(to + 'T23:59:59') : null;
   renderRiderOrders();
 }

 function riderFilterByTime(orders) {
   if (riderTimeFilter === 'all') return orders;
   const now = new Date();
   let start = null, end = null;
   if (riderTimeFilter === 'today') {
     start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
     end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
   } else if (riderTimeFilter === 'week') {
     start = new Date(now.getTime() - 7 * 86400000); end = now;
   } else if (riderTimeFilter === 'month') {
     start = new Date(now.getTime() - 30 * 86400000); end = now;
   } else if (riderTimeFilter === 'custom') {
     start = riderDateFrom; end = riderDateTo;
   }
   if (!start && !end) return orders;
   return orders.filter(o => {
     const d = new Date(o.created_at);
     if (start && d < start) return false;
     if (end && d > end) return false;
     return true;
   });
 }

 function renderRiderOrders() {
   const container = document.getElementById('allRiderOrders');
   const statsEl = document.getElementById('riderOrderStats');
   if (!container) return;

   // 1. 按状态筛选
   let filtered = riderAllOrders;
   if (riderStatusFilter === 'pending') filtered = filtered.filter(o => o.status === 'pending');
   else if (riderStatusFilter === 'running') filtered = filtered.filter(o => o.status === 'accepted' || o.status === 'running');
   else if (riderStatusFilter === 'completed') filtered = filtered.filter(o => o.status === 'completed');
   else if (riderStatusFilter === 'cancelled') filtered = filtered.filter(o => o.status === 'cancelled');

   // 2. 按时间筛选
   filtered = riderFilterByTime(filtered);

   // 3. 统计
   if (statsEl) {
     const total = filtered.length;
     const totalAmount = filtered.reduce((s, o) => s + (o.price || 0), 0);
     const myEarnings = filtered.filter(o => o.status === 'completed').reduce((s, o) => s + (o.price || 0) * 0.8, 0);
     const pending = filtered.filter(o => o.status === 'pending').length;
     const running = filtered.filter(o => o.status === 'accepted' || o.status === 'running').length;
     const done = filtered.filter(o => o.status === 'completed').length;
     statsEl.innerHTML =
       '<div class="order-stat-pill"><div class="stat-num" style="color:var(--orange)">' + total + '</div><div class="stat-label">总计</div></div>' +
       '<div class="order-stat-pill"><div class="stat-num" style="color:#F39C12">' + pending + '</div><div class="stat-label">待接</div></div>' +
       '<div class="order-stat-pill"><div class="stat-num" style="color:#2ECC71">' + running + '</div><div class="stat-label">进行中</div></div>' +
       '<div class="order-stat-pill"><div class="stat-num" style="color:#95A5A6">' + done + '</div><div class="stat-label">已完成</div></div>' +
       '<div class="order-stat-pill"><div class="stat-num" style="color:var(--orange)">¥' + myEarnings.toFixed(1) + '</div><div class="stat-label">我的收入</div></div>';
   }

   // 4. 渲染列表
   if (!filtered.length) {
     container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无订单</p></div>';
     return;
   }
   container.innerHTML = filtered.map(o => {
     const isNew = o.status === 'pending';
     const isMy = o.status === 'accepted' || o.status === 'running';
     const cardClass = isNew ? 'new' : (isMy ? 'my-order' : '');
     const action = isNew ? 'accept' : 'view';
     return '<div class="order-card ' + cardClass + '" onclick="showOrderDetail(\''+o.order_no+'\',\''+action+'\')">' +
       '<div class="order-top"><div class="order-type"><div class="order-type-icon">'+(typeEmoji[o.type]||'📦')+'</div><span>'+(serviceNames[o.type]||'服务')+'</span></div>' +
       '<span class="order-status status-'+o.status+'">'+(statusLabel[o.status]||o.status)+'</span></div>' +
       '<div class="order-info">'+escHtml(o.pickup_location)+' → '+escHtml(o.delivery_location)+'</div>' +
       '<div class="order-meta"><span>'+fmtTime(o.created_at)+'</span><span class="order-price">¥'+(o.price||0).toFixed(2)+'</span></div></div>';
   }).join('');
 }

 async function acceptOrder(orderNo) {
 try {
 await API.acceptOrder(orderNo, currentRider.phone, currentRider.name);
 showToast('接单成功！');
 closeSubPage('detailPage_sub');
 await refreshOrders();
 await updateProfile();
 } catch (e) { showToast(e.message || '接单失败'); }
 }

 async function startDelivery(orderNo) {
 try {
 await API.startDelivery(orderNo);
 showToast('已开始配送');
 closeSubPage('detailPage_sub');
 await refreshOrders();
 } catch (e) { showToast(e.message || '操作失败'); }
 }

 async function completeOrder(orderNo) {
 try {
 await API.completeOrder(orderNo);
 showToast('订单已完成！🎉');
 closeSubPage('detailPage_sub');
 await refreshOrders();
 await updateProfile();
 } catch (e) { showToast(e.message || '操作失败'); }
 }

 async function riderReviewCancel(orderNo, action) {
   const label = action === 'approve' ? '同意取消' : '拒绝取消';
   if (!confirm('确定' + label + '？')) return;
   try {
     const r = JSON.parse(localStorage.getItem('lazyRider') || '{}');
     const res = await API.riderReviewCancel(orderNo, action, r.name || '');
     if (res.ok) {
       showToast(label + '成功');
       closeSubPage('detailPage_sub');
       await refreshOrders();
     } else { showToast(res.error || '操作失败'); }
   } catch(e) { showToast(e.message || '操作失败'); }
 }

 async function refreshOrders() {
   if (!currentRider) return;
   try {
     // 获取待接单 + 我的订单
     const [pending, mine] = await Promise.all([
       API.getOrders({ status: 'pending' }),
       API.getOrders({ rider_phone: currentRider.phone, status: 'my' })
     ]);
     // 合并去重
     const map = new Map();
     [...(pending||[]), ...(mine||[])].forEach(o => map.set(o.order_no || o.id, o));
     riderAllOrders = Array.from(map.values());
     newOrders = pending || [];
     myOrders = mine || [];
     renderRiderOrders();
   } catch(e) {
     console.error('refreshOrders error:', e);
   }
 }

 function showOrderHistory() { riderSwitchTab('home'); riderSwitchFilter('completed'); }

// Exports
window.showOrderDetail = showOrderDetail;
window.riderSwitchFilter = riderSwitchFilter;
window.riderSwitchTime = riderSwitchTime;
window.riderApplyCustomTime = riderApplyCustomTime;
window.riderFilterByTime = riderFilterByTime;
window.renderRiderOrders = renderRiderOrders;
window.acceptOrder = acceptOrder;
window.startDelivery = startDelivery;
window.completeOrder = completeOrder;
window.riderReviewCancel = riderReviewCancel;
window.refreshOrders = refreshOrders;
window.showOrderHistory = showOrderHistory;
