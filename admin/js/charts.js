// === Chart.js 图表初始化 ===
 function initCharts() {
 const s = window._dashStats || {};
 const daily = s.daily_stats || [];
 const chartColors = ['#FF6B2B','#3498DB','#2ECC71','#9B59B6','#F39C12','#E74C3C','#1ABC9C','#95A5A6'];

 // ── 订单趋势 ──
 const ordersCtx = document.getElementById('ordersChart');
 if (ordersCtx) {
 if (ordersChart) ordersChart.destroy();
 const labels = daily.map(d => d.date.slice(5));
 ordersChart = new Chart(ordersCtx.getContext('2d'), {
 type: 'line', data: { labels, datasets: [{ label: '订单数', data: daily.map(d => d.orders), borderColor: '#FF6B2B', backgroundColor: 'rgba(255,107,43,0.1)', fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5 }] },
 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } } } }
 });
 }

 // ── 用户增长 ──
 const usersCtx = document.getElementById('usersChart');
 if (usersCtx) {
 if (window.usersChart) window.usersChart.destroy();
 const labels = daily.map(d => d.date.slice(5));
 let cumUsers = 0;
 const cumData = daily.map(d => { cumUsers += d.users; return cumUsers; });
 window.usersChart = new Chart(usersCtx.getContext('2d'), {
 type: 'line', data: { labels, datasets: [{ label: '累计用户', data: cumData, borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.1)', fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5 }] },
 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } } } }
 });
 }

 // ── 服务分布 ──
 const typeCounts = {};
 orders.forEach(o => { const t = o.type && o.type.trim() ? o.type : 'other'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
 const allTypes = Object.keys(typeCounts);
 const serviceLabels = allTypes.map(k => services[k] ? services[k].name : (k === 'other' ? '其他' : k));
 const serviceData = allTypes.map(k => typeCounts[k]);
 const servicesCtx = document.getElementById('servicesChart');
 if (servicesCtx) {
 if (servicesChart) servicesChart.destroy();
 if (orders.length === 0) {
 servicesChart = new Chart(servicesCtx.getContext('2d'), { type: 'doughnut', data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#E0E0E0'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
 } else {
 servicesChart = new Chart(servicesCtx.getContext('2d'), { type: 'doughnut', data: { labels: serviceLabels, datasets: [{ data: serviceData, backgroundColor: chartColors.slice(0, allTypes.length) }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
 }
 }

 // ── 校园墙活跃度(7天) ──
 const wallAct = s.wall_activity || [];
 const wallActCtx = document.getElementById('wallActivityChart');
 if (wallActCtx) {
 if (window.wallActivityChart) window.wallActivityChart.destroy();
 window.wallActivityChart = new Chart(wallActCtx.getContext('2d'), {
 type: 'bar',
 data: {
 labels: wallAct.map(d => d.date.slice(5)),
 datasets: [
 { label: '帖子', data: wallAct.map(d => d.posts), backgroundColor: '#FF6B2B', borderRadius: 4 },
 { label: '评论', data: wallAct.map(d => d.comments), backgroundColor: '#3498DB', borderRadius: 4 },
 { label: '点赞', data: wallAct.map(d => d.likes), backgroundColor: '#2ECC71', borderRadius: 4 }
 ]
 },
 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false } } } }
 });
 }

 // ── 二手市场分类占比 ──
 const mktCat = s.market_by_category || [];
 const catMap = { textbook:'📚 教材', digital:'💻 数码', daily:'🏠 日用', clothing:'👔 服饰', beauty:'💄 美妆', other:'📦 其他' };
 const mktCtx = document.getElementById('marketCategoryChart');
 if (mktCtx) {
 if (window.marketCategoryChart) window.marketCategoryChart.destroy();
 if (mktCat.length === 0) {
 window.marketCategoryChart = new Chart(mktCtx.getContext('2d'), { type: 'doughnut', data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#E0E0E0'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
 } else {
 window.marketCategoryChart = new Chart(mktCtx.getContext('2d'), {
 type: 'doughnut', data: { labels: mktCat.map(c => catMap[c.category] || c.category), datasets: [{ data: mktCat.map(c => c.count), backgroundColor: chartColors.slice(0, mktCat.length) }] },
 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
 });
 }
 }
 }

// window exports
window.initCharts = initCharts;
