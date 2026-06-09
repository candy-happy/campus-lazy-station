// === Chart.js 图表初始化 ===
let _trendDays = { order: 7, user: 7, wall: 7, market: 7, ai: 7 };

function initCharts() {
  const s = window._dashStats || {};
  const daily = s.daily_stats || [];

  // ── 订单趋势 ──
  try { renderOrderTrend(daily, _trendDays.order); } catch(e) { console.error('[charts] renderOrderTrend:', e); }

  // ── 用户增长 ──
  try { renderUserTrend(daily, _trendDays.user); } catch(e) { console.error('[charts] renderUserTrend:', e); }

  // ── 服务分布 ──
  try { renderServicesChart(daily); } catch(e) { console.error('[charts] renderServicesChart:', e); }

  // ── 校园墙趋势 ──
  try { renderWallTrend(daily, _trendDays.wall); } catch(e) { console.error('[charts] renderWallTrend:', e); }

  // ── 二手市场趋势 ──
  try { renderMarketTrend(daily, _trendDays.market); } catch(e) { console.error('[charts] renderMarketTrend:', e); }

  // ── AI审核趋势 ──
  try { renderAiTrend(daily, _trendDays.ai); } catch(e) { console.error('[charts] renderAiTrend:', e); }
}

// ── 通用折线图选项 ──
function lineOpts(legendPos) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: legendPos || 'bottom', labels: { boxWidth: 12 } } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
      x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } }
    }
  };
}

function sliceTrend(daily, days) {
  return daily.slice(-days);
}

// ── 安全获取canvas上下文 ──
function _getCtx(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error('canvas #' + id + ' 不存在');
  return el.getContext('2d');
}

// ── 订单趋势 ──
function renderOrderTrend(daily, days) {
  const data = sliceTrend(daily, days);
  const ctx = _getCtx('ordersChart');
  if (typeof ordersChart !== 'undefined' && ordersChart && typeof ordersChart.destroy === 'function') {
    try { ordersChart.destroy(); } catch(e) { console.warn('[charts] ordersChart.destroy error:', e); }
  }
  ordersChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date ? d.date.slice(5) : ''),
      datasets: [{ label: '订单数', data: data.map(d => d.orders || 0), borderColor: '#FF6B2B', backgroundColor: 'rgba(255,107,43,0.1)', fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5 }]
    },
    options: lineOpts(false)
  });
}

// ── 用户增长 ──
function renderUserTrend(daily, days) {
  const data = sliceTrend(daily, days);
  const ctx = _getCtx('usersChart');
  if (window.usersChart && typeof window.usersChart.destroy === 'function') {
    try { window.usersChart.destroy(); } catch(e) { console.warn('[charts] usersChart.destroy error:', e); }
  }
  let cumUsers = 0;
  const cumData = data.map(d => { cumUsers += (d.users || 0); return cumUsers; });
  window.usersChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date ? d.date.slice(5) : ''),
      datasets: [{ label: '累计用户', data: cumData, borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.1)', fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5 }]
    },
    options: lineOpts(false)
  });
}

// ── 服务分布 ──
function renderServicesChart() {
  const chartColors = ['#FF6B2B','#3498DB','#2ECC71','#9B59B6','#F39C12','#E74C3C','#1ABC9C','#95A5A6'];
  const typeCounts = {};
  (typeof orders !== 'undefined' ? orders : []).forEach(o => { const t = o.type && o.type.trim() ? o.type : 'other'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
  const allTypes = Object.keys(typeCounts);
  const serviceLabels = allTypes.map(k => (typeof services !== 'undefined' && services[k]) ? services[k].name : (k === 'other' ? '其他' : k));
  const serviceData = allTypes.map(k => typeCounts[k]);
  const ctx = _getCtx('servicesChart');
  if (typeof servicesChart !== 'undefined' && servicesChart && typeof servicesChart.destroy === 'function') {
    try { servicesChart.destroy(); } catch(e) { console.warn('[charts] servicesChart.destroy error:', e); }
  }
  if ((typeof orders !== 'undefined' ? orders : []).length === 0) {
    servicesChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#E0E0E0'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  } else {
    servicesChart = new Chart(ctx, { type: 'doughnut', data: { labels: serviceLabels, datasets: [{ data: serviceData, backgroundColor: chartColors.slice(0, allTypes.length) }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  }
}

// ── 校园墙趋势 ──
function renderWallTrend(daily, days) {
  const data = sliceTrend(daily, days);
  const ctx = _getCtx('wallActivityChart');
  if (window.wallActivityChart && typeof window.wallActivityChart.destroy === 'function') {
    try { window.wallActivityChart.destroy(); } catch(e) { console.warn('[charts] wallActivityChart.destroy error:', e); }
  }
  window.wallActivityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date ? d.date.slice(5) : ''),
      datasets: [
        { label: '帖子', data: data.map(d => d.wall_posts || 0), borderColor: '#FF6B2B', backgroundColor: 'rgba(255,107,43,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: '评论', data: data.map(d => d.wall_comments || 0), borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: '点赞', data: data.map(d => d.wall_likes || 0), borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.1)', fill: true, tension: 0.4, pointRadius: 2 }
      ]
    },
    options: lineOpts()
  });
}

// ── 二手市场趋势 ──
function renderMarketTrend(daily, days) {
  const data = sliceTrend(daily, days);
  const ctx = _getCtx('marketTrendOverviewChart');
  if (window.marketTrendOverviewChart && typeof window.marketTrendOverviewChart.destroy === 'function') {
    try { window.marketTrendOverviewChart.destroy(); } catch(e) { console.warn('[charts] marketTrendOverviewChart.destroy error:', e); }
  }
  window.marketTrendOverviewChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date ? d.date.slice(5) : ''),
      datasets: [
        { label: '新商品', data: data.map(d => d.market_items || 0), borderColor: '#FF6B2B', backgroundColor: 'rgba(255,107,43,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: '成交量', data: data.map(d => d.market_orders || 0), borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.1)', fill: true, tension: 0.4, pointRadius: 2 }
      ]
    },
    options: lineOpts()
  });
}

// ── AI审核趋势 ──
function renderAiTrend(daily, days) {
  const data = sliceTrend(daily, days);
  const ctx = _getCtx('aiTrendChart');
  if (window.aiTrendChart && typeof window.aiTrendChart.destroy === 'function') {
    try { window.aiTrendChart.destroy(); } catch(e) { console.warn('[charts] aiTrendChart.destroy error:', e); }
  }
  window.aiTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date ? d.date.slice(5) : ''),
      datasets: [
        { label: '审核数', data: data.map(d => d.ai_reviews || 0), borderColor: '#9B59B6', backgroundColor: 'rgba(155,89,182,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: '违规数', data: data.map(d => d.ai_violations || 0), borderColor: '#E74C3C', backgroundColor: 'rgba(231,76,60,0.1)', fill: true, tension: 0.4, pointRadius: 2 }
      ]
    },
    options: lineOpts()
  });
}

// ── 时间范围切换函数 ──
function _switchTrend(type, days, btn, renderFn) {
  _trendDays[type] = days;
  if (btn) {
    document.querySelectorAll('.' + type + '-range').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const daily = (window._dashStats || {}).daily_stats || [];
  try { renderFn(daily, days); } catch(e) { console.error('[charts] switchTrend error:', e); }
}

function switchOrderTrend(days, btn) { _switchTrend('order', days, btn, renderOrderTrend); }
function switchUserTrend(days, btn) { _switchTrend('user', days, btn, renderUserTrend); }
function switchWallTrend(days, btn) { _switchTrend('wall', days, btn, renderWallTrend); }
function switchMarketTrend(days, btn) { _switchTrend('market', days, btn, renderMarketTrend); }
function switchAiTrend(days, btn) { _switchTrend('ai', days, btn, renderAiTrend); }

// window exports
window.initCharts = initCharts;
window.switchOrderTrend = switchOrderTrend;
window.switchUserTrend = switchUserTrend;
window.switchWallTrend = switchWallTrend;
window.switchMarketTrend = switchMarketTrend;
window.switchAiTrend = switchAiTrend;

// 安全兜底：页面加载后延迟检查，如果_dashStats已有数据但图表未初始化则自动初始化
window.addEventListener('load', function() {
  setTimeout(function() {
    if (window._dashStats && window._dashStats.daily_stats && window._dashStats.daily_stats.length > 0) {
      // 检查是否已有图表实例，如果没有则初始化
      const hasAnyChart = (typeof ordersChart !== 'undefined' && ordersChart) ||
        window.usersChart || window.wallActivityChart || window.marketTrendOverviewChart || window.aiTrendChart;
      if (!hasAnyChart) {
        console.log('[charts] 兜底初始化：_dashStats已有数据但图表未渲染，重新调用initCharts');
        initCharts();
      }
    }
  }, 2000);
});
