// === 统计数据、时间范围筛选、订单明细面板 ===
let _currentOrderRange = 'today';
let _orderDetailFilter = null;
let _orderDetailPage = 1;
const _orderDetailPageSize = 10;

const _services = {
  delivery: '🍱 代取外卖', express: '📦 代取快递', print: '🖨️ 打印复印',
  purchase: '🛒 代买东西', laundry: '👕 代取洗衣', errand: '🏃 跑腿办事', other: '💡 其他'
};
const _statusMap = {
  pending: '待接单', accepted: '已接单', running: '配送中',
  completed: '已完成', cancelled: '已取消'
};
const _statusColor = {
  pending: '#F39C12', accepted: '#3498DB', running: '#E67E22',
  completed: '#27AE60', cancelled: '#E74C3C'
};

async function updateStats() {
  try {
    const s = await API.getStats();
    if (!s || s.error) throw new Error(s?.error || '统计数据获取失败');

    // 快捷指标
    document.getElementById('statRiders').textContent = s.total_riders || 0;
    document.getElementById('statRating').textContent = s.avg_rating || '0.0';
    document.getElementById('statTotalUsers').textContent = s.total_users || 0;
    document.getElementById('statActiveOrders').textContent = s.active_orders || 0;
    // 校园墙
    document.getElementById('statWallPosts').textContent = s.wall_posts || 0;
    document.getElementById('statWallComments').textContent = s.wall_comments || 0;
    document.getElementById('statWallLikes').textContent = s.wall_likes || 0;
    document.getElementById('statWallFollows').textContent = s.wall_follows || 0;
    document.getElementById('wallTodayBadge').textContent = '今日 +' + (s.today_wall_posts || 0);
    // 二手市场
    document.getElementById('statMarketItems').textContent = s.market_items || 0;
    document.getElementById('statMarketActive').textContent = s.market_active || 0;
    document.getElementById('statMarketRevenue').textContent = '¥' + (s.market_revenue || 0);
    document.getElementById('statMarketOrders').textContent = s.market_orders || 0;
    document.getElementById('marketTodayBadge').textContent = '今日 +' + (s.today_market_items || 0);
    // AI审核
    document.getElementById('statAiTotal').textContent = s.ai_total || 0;
    document.getElementById('statAiViolations').textContent = s.ai_violations || 0;
    document.getElementById('statAiBlocked').textContent = s.ai_blocked || 0;
    document.getElementById('statAiRate').textContent = (s.ai_violation_rate || 0) + '%';
    document.getElementById('ai24hBadge').textContent = '近24h ' + (s.ai_24h || 0);
    // AI审核导航badge
    const aiBadgeEl = document.getElementById('aiBadge');
    if (aiBadgeEl) {
      const aiCount = (s.ai_24h || 0);
      if (aiCount > 0) { aiBadgeEl.textContent = aiCount; aiBadgeEl.style.display = 'inline'; }
      else { aiBadgeEl.style.display = 'none'; }
    }
    // AI进度条（如果存在）
    const passPct = s.ai_total > 0 ? Math.round((s.ai_total - s.ai_violations) / s.ai_total * 100) : 100;
    const violationPct = 100 - passPct;
    const aiBarPass = document.getElementById('aiBarPass');
    const aiBarViolation = document.getElementById('aiBarViolation');
    if (aiBarPass && aiBarViolation) {
      aiBarPass.style.width = passPct + '%';
      aiBarViolation.style.width = violationPct + '%';
      const pctPass = document.getElementById('aiBarPassPct');
      const pctViol = document.getElementById('aiBarViolationPct');
      if (pctPass) pctPass.textContent = passPct + '%';
      if (pctViol) pctViol.textContent = violationPct + '%';
    }
    // 缓存统计数据供图表使用
    window._dashStats = s;
    console.log('[stats] _dashStats set, daily_stats length:', s.daily_stats ? s.daily_stats.length : 0);
    // 默认加载今日订单数据
    switchOrderRange('today');
    // 数据就绪后初始化图表
    if (typeof initCharts === 'function') {
      initCharts();
      console.log('[stats] initCharts called successfully');
    } else {
      console.error('[stats] initCharts is not a function! typeof:', typeof initCharts);
    }
  } catch(e) {
    console.error('[stats] updateStats error:', e);
  }
}

async function switchOrderRange(range, btn) {
  // 更新按钮状态 - 只操作订单时间筛选区域的按钮
  const timeBtns = document.getElementById('orderTimeBtns');
  if (btn) {
    if (timeBtns) timeBtns.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else if (range !== 'custom') {
    const targetBtn = timeBtns ? timeBtns.querySelector('.pill-btn[data-range="' + range + '"]') : null;
    if (targetBtn) {
      timeBtns.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
    }
  }
  _currentOrderRange = range;
  let from, to;
  const today = new Date().toISOString().slice(0,10);
  if (range === 'today') { from = today; to = today; }
  else if (range === '7d') { from = new Date(Date.now()-6*86400000).toISOString().slice(0,10); to = today; }
  else if (range === '30d') { from = new Date(Date.now()-29*86400000).toISOString().slice(0,10); to = today; }
  else if (range === 'all') { from = ''; to = ''; }
  else { // custom
    const fromEl = document.getElementById('orderDateFrom');
    const toEl = document.getElementById('orderDateTo');
    from = fromEl ? fromEl.value : '';
    to = toEl ? toEl.value : '';
    if (!from || !to) { if (typeof showToast === 'function') showToast('请选择起止日期','error'); return; }
  }
  try {
    const params = new URLSearchParams(); if (from) params.set('from', from); if (to) params.set('to', to);
    const res = await fetch('/api/stats/orders?' + params, { headers: API._headers() });
    if (!res.ok) throw new Error('请求失败');
    const d = await res.json();
    document.getElementById('statRangeOrders').textContent = d.orders || 0;
    document.getElementById('statRangeRevenue').textContent = '¥' + (d.revenue || 0);
    document.getElementById('statRangeCompleted').textContent = d.completed || 0;
    document.getElementById('statRangePending').textContent = d.pending || 0;
    document.getElementById('statRangeAvg').textContent = '¥' + (d.avg_price || 0);
  } catch(e) {
    console.error('订单统计查询失败', e);
    if (typeof showToast === 'function') showToast('查询失败','error');
  }
}

function showOrderDetail(filter) {
  _orderDetailFilter = filter;
  _orderDetailPage = 1;
  document.querySelectorAll('.order-stat-block').forEach(b => b.classList.remove('active-filter'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active-filter');
  const panel = document.getElementById('orderDetailPanel');
  panel.classList.add('show');
  const titles = { all:'📋 全部订单', revenue:'💰 收入明细（已完成订单）', completed:'✅ 已完成订单', pending:'⏳ 进行中订单' };
  document.getElementById('orderDetailTitle').textContent = titles[filter] || '📋 订单详情';
  loadOrderDetailPage();
}

function closeOrderDetail() {
  document.getElementById('orderDetailPanel').classList.remove('show');
  document.querySelectorAll('.order-stat-block').forEach(b => b.classList.remove('active-filter'));
  _orderDetailFilter = null;
}

async function loadOrderDetailPage() {
  if (!_orderDetailFilter) return;
  let from = '', to = '';
  const range = _currentOrderRange;
  const today = new Date().toISOString().slice(0,10);
  if (range === 'today') { from = today; to = today; }
  else if (range === '7d') { from = new Date(Date.now()-6*86400000).toISOString().slice(0,10); to = today; }
  else if (range === '30d') { from = new Date(Date.now()-29*86400000).toISOString().slice(0,10); to = today; }
  else if (range === 'custom') {
    const fromEl = document.getElementById('orderDateFrom');
    const toEl = document.getElementById('orderDateTo');
    from = fromEl ? fromEl.value : '';
    to = toEl ? toEl.value : '';
  }
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('filter', _orderDetailFilter);
  params.set('page', _orderDetailPage);
  params.set('size', _orderDetailPageSize);
  try {
    const res = await fetch('/api/stats/orders/list?' + params, { headers: API._headers() });
    if (!res.ok) throw new Error('请求失败');
    const d = await res.json();
    const tbody = document.getElementById('orderDetailBody');
    if (!d.list || d.list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">暂无数据</td></tr>';
    } else {
      tbody.innerHTML = d.list.map(o => `<tr>
        <td style="font-weight:600;font-size:0.82rem">#${o.id}</td>
        <td>${_services[o.type] || o.type || '-'}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.pickup_location||''}">${o.pickup_location || '-'}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.delivery_location||''}">${o.delivery_location || '-'}</td>
        <td style="font-weight:700;color:var(--orange)">¥${o.price||0}</td>
        <td><span class="status-badge" style="background:${_statusColor[o.status]||'#999'}20;color:${_statusColor[o.status]||'#999'}">${_statusMap[o.status]||o.status}</span></td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${o.created_at ? o.created_at.slice(0,16).replace('T',' ') : '-'}</td>
      </tr>`).join('');
    }
    const pager = document.getElementById('orderDetailPager');
    const total = d.total || 0;
    const totalPages = Math.ceil(total / _orderDetailPageSize);
    if (totalPages <= 1) { pager.innerHTML = `<span>共 ${total} 条</span>`; }
    else {
      pager.innerHTML = `<button onclick="_orderDetailPage=1;loadOrderDetailPage()" ${_orderDetailPage<=1?'disabled':''}>首页</button>
        <button onclick="_orderDetailPage--;loadOrderDetailPage()" ${_orderDetailPage<=1?'disabled':''}>上一页</button>
        <span>${_orderDetailPage} / ${totalPages} 页，共 ${total} 条</span>
        <button onclick="_orderDetailPage++;loadOrderDetailPage()" ${_orderDetailPage>=totalPages?'disabled':''}>下一页</button>
        <button onclick="_orderDetailPage=${totalPages};loadOrderDetailPage()" ${_orderDetailPage>=totalPages?'disabled':''}>末页</button>`;
    }
  } catch(e) {
    console.error('订单详情加载失败', e);
    document.getElementById('orderDetailBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:#E74C3C;padding:24px">加载失败</td></tr>';
  }
}

function renderRecentOrders() {
  const el = document.getElementById('recentOrdersTable');
  if (!el) return;
  el.innerHTML = orders.slice(0,5).map(o => `
    <tr><td><span style="font-weight:600">${o.id||o.order_no}</span></td><td>${services[o.type]?.icon||'📦'} ${services[o.type]?.name||o.type}</td><td>${escHtml(o.pickupLocation||o.pickup_location)}</td><td><span style="font-weight:600">¥${(o.price||0).toFixed(2)}</span></td><td><span class="badge ${o.status==='completed'?'badge-green':o.status==='cancelled'?'badge-red':o.status==='pending'?'badge-yellow':o.status==='running'?'badge-orange':'badge-blue'}">${statusMap[o.status]?.label||o.status}</span></td></tr>`).join('');
}

// window exports
window.updateStats = updateStats;
window.switchOrderRange = switchOrderRange;
window.showOrderDetail = showOrderDetail;
window.closeOrderDetail = closeOrderDetail;
window.loadOrderDetailPage = loadOrderDetailPage;
window.renderRecentOrders = renderRecentOrders;
