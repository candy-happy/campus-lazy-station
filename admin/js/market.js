// === 二手市场管理 ===

 async function fetchMarketAPI(path) {
   const res = await fetch('/api/market/admin/' + path, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_admin_token')||'') } });
   const data = await res.json();
   if (!res.ok) { showToast(data.error || '请求失败(' + res.status + ')'); return {}; }
   return data;
 }

 function switchMarketTab(tab, btn) {
   document.querySelectorAll('#page-market .market-tab').forEach(t => t.classList.remove('active'));
   document.querySelectorAll('#page-market .market-admin-panel').forEach(p => p.classList.remove('active'));
   if (btn) btn.classList.add('active');
   const panel = document.getElementById('marketPanel-' + tab);
   if (panel) panel.classList.add('active');
   if (tab === 'items') loadMarketItems();
   if (tab === 'orders') loadMarketOrders();
   if (tab === 'comments') loadMarketComments();
   if (tab === 'stats') loadMarketStats();
 }

 async function loadMarketItems() {
   const search = document.getElementById('marketItemSearch')?.value || '';
   const status = marketItemFilter === 'all' ? '' : '&status=' + marketItemFilter;
   const data = await fetchMarketAPI('items?limit=100' + status + (search ? '&search=' + encodeURIComponent(search) : ''));
   marketItemsList = data.items || [];
   const countEl = document.getElementById('marketItemCount');
   if (countEl) countEl.textContent = marketItemsList.length + ' 条';
   renderMarketItemsTable();
 }

 function filterMarketItems(filter, btn) {
   marketItemFilter = filter;
   document.querySelectorAll('#marketPanel-items .ads-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
   loadMarketItems();
 }

 function renderMarketItemsTable() {
   const tb = document.getElementById('marketItemsTable'); if (!tb) return;
   tb.innerHTML = marketItemsList.map(item => {
     const img = (item.images && item.images.length) ? '<img src="' + item.images[0] + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.style.display=\'none\'">' : '🛒';
     const status = marketItemStatusMap[item.status] || {label:item.status,cls:''};
     return '<tr><td><input type="checkbox" class="market-item-check" data-id="' + item.id + '"></td>' +
       '<td>' + img + '</td>' +
       '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(item.title) + '</td>' +
       '<td>' + escHtml(item.seller_name || item.seller_phone) + '</td>' +
       '<td>¥' + (item.price||0).toFixed(2) + '</td>' +
       '<td>' + (marketCategoryMap[item.category]||item.category) + '</td>' +
       '<td>' + (marketCondMap[item.condition_level]||item.condition_level||'-') + '</td>' +
       '<td style="text-align:center">' + (item.views||0) + '</td>' +
       '<td><span class="badge ' + status.cls + '">' + status.label + '</span></td>' +
       '<td style="font-size:12px">' + (item.created_at||'').slice(0,16) + '</td>' +
       '<td><button class="btn btn-sm" onclick="offlineMarketItem(' + item.id + ')">下架</button> <button class="btn btn-sm btn-danger" onclick="deleteMarketItem(' + item.id + ')">删除</button></td></tr>';
   }).join('') || '<tr><td colspan="12"><div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-text">暂无商品数据</div></div></td></tr>';
 }

 function toggleAllMarketItems(el) {
   document.querySelectorAll('.market-item-check').forEach(c => c.checked = el.checked);
   updateMarketBatchBar();
 }

 function updateMarketBatchBar() {
   const checked = document.querySelectorAll('.market-item-check:checked').length;
   const bar = document.getElementById('marketBatchBar');
   if (bar) bar.style.display = checked > 0 ? 'flex' : 'none';
 }

 async function offlineMarketItem(id) {
   const reason = prompt('请输入下架原因（可选）') || '';
   const res = await fetch('/api/market/admin/items/' + id + '/offline', { method:'PUT', headers:{'Authorization':'Bearer '+(localStorage.getItem('lazy_admin_token')||''),'Content-Type':'application/json'}, body:JSON.stringify({reason}) }).then(r=>r.json());
   if (res.ok) { showToast('已下架'); loadMarketItems(); } else showToast(res.error||'操作失败');
 }

 async function deleteMarketItem(id) {
   if (!confirm('确定删除此商品？')) return;
   const res = await fetch('/api/market/admin/items/' + id, { method:'DELETE', headers:{'Authorization':'Bearer '+(localStorage.getItem('lazy_admin_token')||'')} }).then(r=>r.json());
   if (res.ok) { showToast('已删除'); loadMarketItems(); } else showToast(res.error||'操作失败');
 }

 async function batchOfflineMarketItems() {
   const ids = [...document.querySelectorAll('.market-item-check:checked')].map(c => c.dataset.id);
   if (!ids.length) return;
   if (!confirm('确定批量下架 ' + ids.length + ' 个商品？')) return;
   const reason = prompt('请输入下架原因（可选）') || '';
   let ok = 0;
   for (const id of ids) {
     const res = await fetch('/api/market/admin/items/' + id + '/offline', { method:'PUT', headers:{'Authorization':'Bearer '+(localStorage.getItem('lazy_admin_token')||''),'Content-Type':'application/json'}, body:JSON.stringify({reason}) }).then(r=>r.json());
     if (res.ok) ok++;
   }
   showToast('已下架 ' + ok + ' 个商品'); loadMarketItems();
 }

 async function loadMarketOrders() {
   const search = document.getElementById('marketOrderSearch')?.value || '';
   const status = marketOrderFilter === 'all' ? '' : '&status=' + marketOrderFilter;
   const data = await fetchMarketAPI('orders?limit=100' + status + (search ? '&search=' + encodeURIComponent(search) : ''));
   marketOrdersList = data.orders || [];
   renderMarketOrdersTable();
 }

 function filterMarketOrders(filter, btn) {
   marketOrderFilter = filter;
   document.querySelectorAll('#marketPanel-orders .ads-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
   loadMarketOrders();
 }

 function renderMarketOrdersTable() {
   const tb = document.getElementById('marketOrdersTable'); if (!tb) return;
   tb.innerHTML = marketOrdersList.map(o => {
     const status = marketOrderStatusMap[o.status] || {label:o.status,cls:''};
     const canResolve = ['pending','confirmed'].includes(o.status);
     return '<tr><td>' + o.id + '</td>' +
       '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(o.title) + '</td>' +
       '<td>' + escHtml(o.buyer_name || o.buyer_phone) + '</td>' +
       '<td>' + escHtml(o.seller_name || o.seller_phone) + '</td>' +
       '<td>¥' + (o.price||0).toFixed(2) + '</td>' +
       '<td><span class="badge ' + status.cls + '">' + status.label + '</span></td>' +
       '<td style="font-size:12px">' + (o.created_at||'').slice(0,16) + '</td>' +
       '<td>' + (canResolve ? '<button class="btn btn-sm" onclick="resolveMarketOrder(' + o.id + ',\'complete\')">确认完成</button> <button class="btn btn-sm btn-danger" onclick="resolveMarketOrder(' + o.id + ',\'cancel\')">取消</button>' : '-') + '</td></tr>';
   }).join('') || '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-text">暂无订单数据</div></div></td></tr>';
 }

 async function resolveMarketOrder(id, action) {
   const label = action === 'complete' ? '确认完成' : '取消';
   if (!confirm('确定' + label + '此订单？')) return;
   const reason = prompt('请输入原因（可选）') || '';
   const res = await fetch('/api/market/admin/orders/' + id + '/resolve', { method:'PUT', headers:{'Authorization':'Bearer '+(localStorage.getItem('lazy_admin_token')||''),'Content-Type':'application/json'}, body:JSON.stringify({action,reason}) }).then(r=>r.json());
   if (res.ok) { showToast('已' + label); loadMarketOrders(); } else showToast(res.error||'操作失败');
 }

 async function loadMarketComments() {
   const search = document.getElementById('marketCommentSearch')?.value || '';
   const data = await fetchMarketAPI('comments?limit=100' + (search ? '&search=' + encodeURIComponent(search) : ''));
   marketCommentsList = data.comments || [];
   const countEl = document.getElementById('marketCommentCount');
   if (countEl) countEl.textContent = (data.total||0) + ' 条';
   renderMarketCommentsTable();
 }

 function renderMarketCommentsTable() {
   const tb = document.getElementById('marketCommentsTable'); if (!tb) return;
   tb.innerHTML = marketCommentsList.map(c => {
     const media = c.media_url ? (c.media_type==='video' ? '<video src="'+c.media_url+'" style="width:48px;height:36px;border-radius:4px" muted></video>' : '<img src="'+c.media_url+'" style="width:48px;height:36px;object-fit:cover;border-radius:4px">') : '-';
     return '<tr><td><input type="checkbox" class="market-comment-check" data-id="' + c.id + '"></td>' +
       '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(c.item_title||'商品#'+c.item_id) + '</td>' +
       '<td>' + escHtml(c.user_name || c.user_phone) + '</td>' +
       '<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(c.content||'') + '</td>' +
       '<td>' + media + '</td>' +
       '<td style="font-size:12px">' + (c.created_at||'').slice(0,16) + '</td>' +
       '<td><button class="btn btn-sm btn-danger" onclick="deleteMarketComment(' + c.id + ')">删除</button></td></tr>';
   }).join('') || '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">暂无留言数据</div></div></td></tr>';
 }

 function toggleAllMarketComments(el) {
   document.querySelectorAll('.market-comment-check').forEach(c => c.checked = el.checked);
   updateMarketCommentBatchBar();
 }

 function updateMarketCommentBatchBar() {
   const checked = document.querySelectorAll('.market-comment-check:checked').length;
   const bar = document.getElementById('marketCommentBatchBar');
   if (bar) bar.style.display = checked > 0 ? 'flex' : 'none';
 }

 async function deleteMarketComment(id) {
   if (!confirm('确定删除此留言？')) return;
   const res = await fetch('/api/market/admin/comments/' + id, { method:'DELETE', headers:{'Authorization':'Bearer '+(localStorage.getItem('lazy_admin_token')||'')} }).then(r=>r.json());
   if (res.ok) { showToast('已删除'); loadMarketComments(); } else showToast(res.error||'操作失败');
 }

 async function batchDeleteMarketComments() {
   const ids = [...document.querySelectorAll('.market-comment-check:checked')].map(c => c.dataset.id);
   if (!ids.length) return;
   if (!confirm('确定批量删除 ' + ids.length + ' 条留言？')) return;
   let ok = 0;
   for (const id of ids) {
     const res = await fetch('/api/market/admin/comments/' + id, { method:'DELETE', headers:{'Authorization':'Bearer '+(localStorage.getItem('lazy_admin_token')||'')} }).then(r=>r.json());
     if (res.ok) ok++;
   }
   showToast('已删除 ' + ok + ' 条留言'); loadMarketComments();
 }

 async function loadMarketStats() {
   const data = await fetchMarketAPI('stats');
   document.getElementById('mktTotalItems').textContent = data.totalItems||0;
   document.getElementById('mktActiveItems').textContent = data.activeItems||0;
   document.getElementById('mktTodayItems').textContent = data.todayItems||0;
   document.getElementById('mktTotalRevenue').textContent = '¥' + (data.totalRevenue||0).toFixed(2);
   document.getElementById('mktTotalComments').textContent = data.totalComments||0;
   document.getElementById('mktTotalOrders').textContent = data.totalOrders||0;
   // 趋势图
   if (data.trend) {
     const ctx = document.getElementById('marketTrendChart');
     if (marketTrendChart) marketTrendChart.destroy();
     marketTrendChart = new Chart(ctx, {
       type: 'bar',
       data: { labels: data.trend.map(t=>t.date), datasets: [
         { label: '新商品', data: data.trend.map(t=>t.items), backgroundColor: 'rgba(255,107,43,0.7)' },
         { label: '交易量', data: data.trend.map(t=>t.orders), backgroundColor: 'rgba(52,152,219,0.7)' }
       ]},
       options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,grid:{color:'#EDEAE4'}},x:{grid:{display:false}}} }
     });
   }
   // 分类图
   if (data.categories) {
     const ctx2 = document.getElementById('marketCategoryChart');
     if (marketCatAdminChart) marketCatAdminChart.destroy();
     marketCatAdminChart = new Chart(ctx2, {
       type: 'doughnut',
       data: { labels: data.categories.map(c=>marketCategoryMap[c.category]||c.category), datasets: [{ data: data.categories.map(c=>c.cnt), backgroundColor: ['#FF6B35','#3498DB','#2ECC71','#9B59B6','#F39C12','#E74C3C','#1ABC9C'] }] },
       options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
     });
   }
   // 诚信度表
   if (data.trustDist) {
     const t = data.trustDist;
     const total = t.newcomer + t.bronze + t.silver + t.gold;
     const rows = [
       {label:'⭐ 新人', cnt:t.newcomer},
       {label:'🥉 铜牌', cnt:t.bronze},
       {label:'🥈 银牌', cnt:t.silver},
       {label:'🥇 金牌', cnt:t.gold}
     ];
     document.getElementById('marketTrustTable').innerHTML = rows.map(r =>
       '<tr><td>'+r.label+'</td><td>'+r.cnt+'</td><td>'+((total?r.cnt/total*100:0).toFixed(1))+'%</td></tr>'
     ).join('');
   }
 }

// window exports
window.fetchMarketAPI = fetchMarketAPI;
window.switchMarketTab = switchMarketTab;
window.loadMarketItems = loadMarketItems;
window.filterMarketItems = filterMarketItems;
window.renderMarketItemsTable = renderMarketItemsTable;
window.toggleAllMarketItems = toggleAllMarketItems;
window.updateMarketBatchBar = updateMarketBatchBar;
window.offlineMarketItem = offlineMarketItem;
window.deleteMarketItem = deleteMarketItem;
window.batchOfflineMarketItems = batchOfflineMarketItems;
window.loadMarketOrders = loadMarketOrders;
window.filterMarketOrders = filterMarketOrders;
window.renderMarketOrdersTable = renderMarketOrdersTable;
window.resolveMarketOrder = resolveMarketOrder;
window.loadMarketComments = loadMarketComments;
window.renderMarketCommentsTable = renderMarketCommentsTable;
window.toggleAllMarketComments = toggleAllMarketComments;
window.updateMarketCommentBatchBar = updateMarketCommentBatchBar;
window.deleteMarketComment = deleteMarketComment;
window.batchDeleteMarketComments = batchDeleteMarketComments;
window.loadMarketStats = loadMarketStats;
