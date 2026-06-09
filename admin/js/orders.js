// === 订单管理 ===

let orderTimeRange = 'all';
let orderFilter = 'all';

 function toggleOrderDatePick() {
   const dp = document.getElementById('orderDatePick');
   if (!dp) return;
   const show = dp.style.display === 'none';
   dp.style.display = show ? 'flex' : 'none';
   if (show) {
     document.querySelectorAll('#orderTimeBtns .pill-btn').forEach(b => b.classList.toggle('active', b.dataset.range === 'custom'));
     orderTimeRange = 'custom';
   }
 }

 function filterOrdersByTime(range, btn) {
   orderTimeRange = range;
   document.querySelectorAll('#orderTimeBtns .pill-btn').forEach(b => b.classList.toggle('active', b === btn));
   if (range !== 'custom') {
     const dp = document.getElementById('orderDatePick');
     if (dp) dp.style.display = 'none';
   }
   renderOrdersTable();
 }

 function filterOrders(filter, btn) {
   orderFilter = filter;
   document.querySelectorAll('#orderStatusBtns .pill-btn').forEach(b => b.classList.toggle('active', b === btn));
   renderOrdersTable();
 }

 async function loadOrdersPage() {
 try {
 const res = await API.getOrders();
 const rawOrders = Array.isArray(res) ? res : (res.list || []);
 orders = rawOrders.map(o => ({ ...o, id: o.order_no, pickupLocation: o.pickup_location, deliveryLocation: o.delivery_location, riderName: o.rider_name, createdAt: o.created_at }));
 renderOrdersTable();
 } catch(e) { console.error('订单数据加载失败:', e); }
 }

 function renderOrdersTable() {
 const q = (document.getElementById('orderSearchInput')?.value||'').toLowerCase();
 // 时间范围筛选
 const now = new Date();
 let dateFrom = null, dateTo = null;
 if (orderTimeRange === 'today') {
   dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 } else if (orderTimeRange === '7d') {
   dateFrom = new Date(now.getTime() - 7*24*60*60*1000);
 } else if (orderTimeRange === '30d') {
   dateFrom = new Date(now.getTime() - 30*24*60*60*1000);
 } else if (orderTimeRange === 'custom') {
   const fromVal = document.getElementById('orderDateFrom2')?.value;
   const toVal = document.getElementById('orderDateTo2')?.value;
   if (fromVal) dateFrom = new Date(fromVal + 'T00:00:00');
   if (toVal) dateTo = new Date(toVal + 'T23:59:59');
 }
 const filtered = orders.filter(o => {
   // 时间筛选
   if (dateFrom || dateTo) {
     const createdAt = o.createdAt || o.created_at;
     if (!createdAt) return false;
     const d = new Date(createdAt.replace(' ', 'T'));
     if (dateFrom && d < dateFrom) return false;
     if (dateTo && d > dateTo) return false;
   }
   // 状态筛选
   if (orderFilter !== 'all' && o.status !== orderFilter) return false;
   // 搜索筛选
   if (q && !(o.id||o.order_no||'').toLowerCase().includes(q) && !(o.pickupLocation||o.pickup_location||'').toLowerCase().includes(q) && !(o.phone||'').includes(q)) return false;
   return true;
 });
 // 更新统计（基于当前所有筛选条件的数据）
 document.getElementById('statOrdersTotal').textContent = filtered.length;
 document.getElementById('statOrdersPending').textContent = filtered.filter(o=>o.status==='pending').length;
 document.getElementById('statOrdersDone').textContent = filtered.filter(o=>o.status==='completed').length;
 document.getElementById('statOrdersRevenue').textContent = '¥' + filtered.reduce((s,o)=>s+(o.price||0),0).toFixed(0);
 document.getElementById('ordersTable').innerHTML = filtered.length ? filtered.map(o => {
   const t = o.createdAt || o.created_at || '';
   const shortTime = t ? t.replace(/^\d{4}-/, '').replace(/:\d{2}$/, '') : '-';
   // 状态附加标签
   let statusExtra = '';
   if (o.cancel_request_status === 'pending') statusExtra = ' <span class="badge badge-yellow" style="font-size:10px">待审核取消</span>';
   if (o.refund_status === 'pending') statusExtra = ' <span class="badge badge-purple" style="font-size:10px">待审核退款</span>';
   if (o.refund_status === 'approved_full') statusExtra = ' <span class="badge badge-green" style="font-size:10px">已全额退款</span>';
   if (o.refund_status === 'approved_partial') statusExtra = ' <span class="badge badge-blue" style="font-size:10px">已部分退款</span>';
   // 操作按钮
   let actions = '';
   if (o.status === 'pending') actions += `<button class="btn btn-secondary btn-sm" onclick="cancelOrder('${o.id||o.order_no}')">取消</button>`;
   if (o.cancel_request_status === 'pending') actions += `<button class="btn btn-sm" style="background:#27AE60;color:#fff" onclick="reviewCancel('${o.id||o.order_no}','approve')">✅ 同意取消</button><button class="btn btn-sm" style="background:#E74C3C;color:#fff" onclick="reviewCancel('${o.id||o.order_no}','reject')">❌ 拒绝</button>`;
   if (o.refund_status === 'pending') actions += `<button class="btn btn-sm" style="background:#8E44AD;color:#fff" onclick="reviewRefund('${o.id||o.order_no}','approve_full')">全额退款</button><button class="btn btn-sm" style="background:#2980B9;color:#fff" onclick="reviewRefund('${o.id||o.order_no}','approve_partial')">部分退款</button><button class="btn btn-sm" style="background:#E74C3C;color:#fff" onclick="reviewRefund('${o.id||o.order_no}','reject')">打回</button>`;
   return `<tr><td><span style="font-weight:600">${o.id||o.order_no}</span></td><td>${services[o.type]?.icon||'📦'} ${services[o.type]?.name||o.type}</td><td>${escHtml(o.pickupLocation||o.pickup_location)}</td><td>${escHtml(o.deliveryLocation||o.delivery_location)}</td><td>${escHtml(o.phone)}</td><td><span style="font-weight:600">¥${(o.price||0).toFixed(2)}</span></td><td><span class="badge ${o.status==='completed'?'badge-green':o.status==='cancelled'?'badge-red':o.status==='pending'?'badge-yellow':o.status==='running'?'badge-orange':'badge-blue'}">${statusMap[o.status]?.label||o.status}</span>${statusExtra}</td><td>${escHtml(o.riderName||o.rider_name||'-')}</td><td style="white-space:nowrap;color:#888;font-size:12px">${shortTime}</td><td><div class="table-actions">${actions}</div></td></tr>`;
 }).join('') : '<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">暂无订单数据</div></div></td></tr>';;
 }

 async function cancelOrder(id) {
 if (confirm('确定取消该订单？')) {
 try {
 await API.cancelOrder(id, '管理员取消');
 showToast('订单已取消');
 const res = await API.getOrders();
 const rawOrders = Array.isArray(res) ? res : (res.list || []);
 orders = rawOrders.map(o => ({ ...o, id: o.order_no, pickupLocation: o.pickup_location, deliveryLocation: o.delivery_location, riderName: o.rider_name, createdAt: o.created_at }));
 renderOrdersTable(); renderRecentOrders(); updateStats();
 } catch(e) { showToast(e.message); }
 }
 }

 async function reviewCancel(id, action) {
   const label = action === 'approve' ? '同意取消' : '拒绝取消';
   if (!confirm('确定' + label + '？')) return;
   try {
     const res2 = await API.reviewCancel(id, action, '管理员');
     if (res2.ok) {
       showToast(label + '成功');
       const res = await API.getOrders();
       const rawOrders = Array.isArray(res) ? res : (res.list || []);
       orders = rawOrders.map(o => ({ ...o, id: o.order_no, pickupLocation: o.pickup_location, deliveryLocation: o.delivery_location, riderName: o.rider_name, createdAt: o.created_at }));
       renderOrdersTable(); updateStats();
     } else { showToast(res2.error || '操作失败'); }
   } catch(e) { showToast(e.message || '操作失败'); }
 }

 async function reviewRefund(id, action) {
   let refundAmount = 0;
   if (action === 'approve_partial') {
     const input = prompt('请输入部分退款金额：');
     refundAmount = parseFloat(input);
     if (!refundAmount || refundAmount <= 0) { showToast('请输入有效金额'); return; }
   }
   const labelMap = { approve_full: '全额退款', approve_partial: '部分退款¥' + refundAmount, reject: '打回退款申请' };
   if (!confirm('确定' + labelMap[action] + '？')) return;
   try {
     const res2 = await API.reviewRefund(id, action, refundAmount, '管理员');
     if (res2.ok) {
       showToast(labelMap[action] + '成功');
       const res = await API.getOrders();
       const rawOrders = Array.isArray(res) ? res : (res.list || []);
       orders = rawOrders.map(o => ({ ...o, id: o.order_no, pickupLocation: o.pickup_location, deliveryLocation: o.delivery_location, riderName: o.rider_name, createdAt: o.created_at }));
       renderOrdersTable(); updateStats();
     } else { showToast(res2.error || '操作失败'); }
   } catch(e) { showToast(e.message || '操作失败'); }
 }

// window exports
window.toggleOrderDatePick = toggleOrderDatePick;
window.filterOrdersByTime = filterOrdersByTime;
window.filterOrders = filterOrders;
window.loadOrdersPage = loadOrdersPage;
window.renderOrdersTable = renderOrdersTable;
window.cancelOrder = cancelOrder;
window.reviewCancel = reviewCancel;
window.reviewRefund = reviewRefund;
