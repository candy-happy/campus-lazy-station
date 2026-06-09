// === 管理端核心模块 ===
// 全局变量、工具函数、导航、登录、仪表盘、刷新

const services = {
  delivery: { name: '代取外卖', icon: '🍱' },
  express: { name: '代取快递', icon: '📦' },
  print: { name: '打印复印', icon: '🖨️' },
  purchase: { name: '代买东西', icon: '🛒' },
  laundry: { name: '代取洗衣', icon: '👕' },
  errand: { name: '跑腿办事', icon: '🏃' },
  other: { name: '其他服务', icon: '💡' }
};
const statusMap = {
  pending: { label: '待接单', class: 'status-pending' },
  accepted: { label: '已接单', class: 'status-accepted' },
  running: { label: '配送中', class: 'status-running' },
  completed: { label: '已完成', class: 'status-completed' },
  cancelled: { label: '已取消', class: 'status-cancelled' }
};
const phoneRegex = /^1[3-9]\d{9}$/;

let currentAdmin = null;
let orders = [];
let riders = [];
let admins = [];
let ordersChart, servicesChart;

// ─── 工具函数 ───
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function safeObj(o) {
  return Object.fromEntries(Object.entries(o).map(([k,v]) => [k, typeof v === 'string' ? escHtml(v) : v]));
}
function TK() { return localStorage.getItem('lazy_admin_token') || ''; }
function AUTH() { return { 'Authorization': 'Bearer ' + TK() }; }

function switchPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  if (page === 'ads') loadAds();
  if (page === 'market') { loadMarketItems(); }
  if (page === 'orders') { loadOrdersPage(); }
  if (page === 'riders') { loadRidersPage(); }
  if (page === 'pets') { loadPetsAdmin(); }
  if (page === 'reports') { loadReports(); }
}

function showModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function toggleDark(isDark) {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('lazyTheme', isDark ? 'dark' : 'light');
}

// ─── 登录 ───
async function login(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const admin = await API.adminLogin(username, password);
    currentAdmin = admin;
    await showDashboard();
  } catch (err) {
    document.getElementById('loginError').textContent = err.message || '用户名或密码错误';
    document.getElementById('loginError').style.display = 'block';
  }
}

// ─── 仪表盘 ───
async function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  document.getElementById('adminName').textContent = currentAdmin.username || '管理员';
  document.getElementById('adminRole').textContent = currentAdmin.role === 'super' ? '总管理员' : '管理员';

  if (currentAdmin.role !== 'super') {
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('addAdminBtn').style.display = 'none';
  } else {
    document.getElementById('addAdminBtn').style.display = 'block';
    admins = await API.getAdmins();
    updatePendingBadge();
  }
  try {
    const ordersRes = await API.getOrders();
    const rawOrders = Array.isArray(ordersRes) ? ordersRes : (ordersRes.list || []);
    orders = rawOrders.map(o => ({ ...o, id: o.order_no, pickupLocation: o.pickup_location, deliveryLocation: o.delivery_location, riderName: o.rider_name, createdAt: o.created_at }));
    const ridersRes = await API.getRiders();
    const rawRiders = Array.isArray(ridersRes) ? ridersRes : (ridersRes.list || ridersRes.riders || []);
    riders = rawRiders.map(r => ({ ...r, createdAt: r.created_at }));
  } catch(e) { console.error(e); }

  updateStats();
  renderRecentOrders();
  renderOrdersTable();
  renderRidersTable();
  renderAdminsTable();
  renderWithdrawTable();
  updateNavBadges();
}

// ─── 导航徽章 ───
async function updateNavBadges() {
  try {
    const [alertRes, pendingRes] = await Promise.all([
      fetch('/api/pets/alert-check', { headers: AUTH() }).then(r => r.json()).catch(() => ({ summary: { warning:0, urgent:0, critical:0 } })),
      fetch('/api/pets/admin/pending-sightings', { headers: AUTH() }).then(r => r.json()).catch(() => [])
    ]);
    var as = alertRes.summary || { warning:0, urgent:0, critical:0 };
    var pl = Array.isArray(pendingRes) ? pendingRes : [];
    var petNavCount = (as.warning||0) + (as.urgent||0) + (as.critical||0) + pl.length;
    var petBadgeEl = document.getElementById('petBadge');
    if (petBadgeEl) {
      if (petNavCount > 0) { petBadgeEl.textContent = petNavCount; petBadgeEl.style.display = 'inline'; }
      else { petBadgeEl.style.display = 'none'; }
    }
  } catch(e) { console.error('updateNavBadges pets error:', e); }
  try {
    const aiRes = await fetch('/api/ai/stats', { headers: { 'Authorization': 'Bearer ' + TK() } });
    const aiStats = await aiRes.json();
    var aiBadgeEl = document.getElementById('aiBadge');
    if (aiBadgeEl) {
      var aiCount = aiStats.recent24h || 0;
      if (aiCount > 0) { aiBadgeEl.textContent = aiCount; aiBadgeEl.style.display = 'inline'; }
      else { aiBadgeEl.style.display = 'none'; }
    }
  } catch(e) { console.error('updateNavBadges ai error:', e); }
}

// ─── 刷新数据 ───
async function refreshData() {
  const ordersRes = await API.getOrders();
  const rawOrders = Array.isArray(ordersRes) ? ordersRes : (ordersRes.list || []);
  orders = rawOrders.map(o => ({ ...o, id: o.order_no, pickupLocation: o.pickup_location, deliveryLocation: o.delivery_location, riderName: o.rider_name, createdAt: o.created_at }));
  const ridersRes = await API.getRiders();
  const rawRiders = Array.isArray(ridersRes) ? ridersRes : (ridersRes.list || ridersRes.riders || []);
  riders = rawRiders.map(r => ({ ...r, createdAt: r.created_at }));
  if (currentAdmin?.role === 'super') admins = await API.getAdmins();
  await updateStats();
  try{renderRecentOrders()}catch(e){}
  try{renderOrdersTable()}catch(e){}
  try{renderRidersTable()}catch(e){}
  try{renderAdminsTable()}catch(e){}
  try{await renderWithdrawTable()}catch(e){}
  try{loadAds()}catch(e){}
  try{await updateNavBadges()}catch(e){}
  showToast('数据已刷新');
}

function exportData() {
  const data = { orders, riders, admins, exportTime: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `懒人效率站数据_${new Date().toISOString().slice(0,10)}.json`; a.click();
  showToast('数据导出成功');
}

// ─── 初始化 ───
document.addEventListener('DOMContentLoaded', async () => {
  const saved = API.restoreSession();
  if (saved && saved.role === 'admin') {
    currentAdmin = { username: saved.username, role: saved.role };
    await showDashboard();
  }
  const dt = document.getElementById('darkToggle');
  if (dt) dt.checked = document.body.classList.contains('dark');
});

// Init dark mode from localStorage
(function() {
  const saved = localStorage.getItem('lazyTheme');
  if (saved === 'dark') document.body.classList.add('dark');
})();

// Modal overlay click-to-close
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('active'); }));

// ─── 全局导出（供 HTML onclick 调用） ───
window.login = login;
window.switchPage = switchPage;
window.refreshData = refreshData;
window.exportData = exportData;
window.showModal = showModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.toggleDark = toggleDark;
window.showAddAdminModal = () => showModal('addAdminModal');
