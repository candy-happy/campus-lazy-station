// discover.js - 发现页（社团+活动）
// 依赖: core.js, api.js
// 使用 IIFE 防止全局变量污染，仅暴露必要的函数到 window

(function() {
  'use strict';

  // ─── 私有状态 ──────────────────────────────────────────────
  let discoverTab = 'activities'; // 'activities' | 'clubs'
  let discoverActCategory = '';
  let discoverClubCategory = '';
  let discoverSearch = '';

// ─── 切换发现页Tab ──────────────────────────────────────
function switchDiscoverTab(tab) {
  discoverTab = tab;
  document.querySelectorAll('.discover-main-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.discover-main-tab').forEach(t => {
    if (t.dataset.tab === tab) t.classList.add('active');
  });
  document.getElementById('discoverActivitiesSection').style.display = tab === 'activities' ? '' : 'none';
  document.getElementById('discoverClubsSection').style.display = tab === 'clubs' ? '' : 'none';
  if (tab === 'activities') loadDiscoverActivities();
  else loadDiscoverClubs();
}

// ─── 活动模块 ──────────────────────────────────────────
async function loadDiscoverActivities() {
  // 未登录用户也能查看公开活动
  const container = document.getElementById('discoverActivityList');
  if (!container) return;
  container.innerHTML = '<div class="discover-loading">加载中...</div>';

  try {
    const params = { status: 'open', page: 1, limit: 20 };
    if (discoverActCategory) params.category = discoverActCategory;
    const res = await API.getActivities(params);
    const list = Array.isArray(res) ? res : (res && res.list || []);

    // 热门活动横向滚动
    renderHotActivities(list.slice(0, 5));

    if (!list.length) {
      container.innerHTML = '<div class="discover-empty"><div class="discover-empty-icon">🎪</div><p>暂无活动</p></div>';
      return;
    }
    container.innerHTML = list.map(a => renderActivityCard(a)).join('');
  } catch(e) {
    container.innerHTML = '<div class="discover-empty"><p>加载失败</p></div>';
    console.error('loadDiscoverActivities error:', e);
  }
}

function renderHotActivities(list) {
  const el = document.getElementById('discoverHotActivities');
  if (!el || !list.length) return;
  el.innerHTML = list.map(a => `
    <div class="discover-hot-card" onclick="showActivityDetail(${a.id})">
      <div class="discover-hot-cover">${a.cover ? '<img src="' + a.cover + '" />' : '<div class="discover-hot-placeholder">' + (a.category === '讲座' ? '🎤' : a.category === '比赛' ? '🏆' : '🎉') + '</div>'}</div>
      <div class="discover-hot-info">
        <div class="discover-hot-title">${escHtml(a.title)}</div>
        <div class="discover-hot-meta">${fmtTime(a.start_time)} · ${a.current_participants || 0}人报名</div>
      </div>
    </div>
  `).join('');
}

function renderActivityCard(a) {
  const statusMap = { open: '报名中', closed: '已截止', cancelled: '已取消', ended: '已结束' };
  const statusColor = { open: '#2ECC71', closed: '#95A5A6', cancelled: '#E74C3C', ended: '#95A5A6' };
  const publisher = a.publisher_type === 'club' ? '🎭 ' + escHtml(a.publisher_name || '社团') : '👤 个人';
  return `<div class="discover-card" onclick="showActivityDetail(${a.id})">
    <div class="discover-card-header">
      <span class="discover-card-category">${escHtml(a.category || '其他')}</span>
      <span class="discover-card-status" style="color:${statusColor[a.status] || '#95A5A6'}">${statusMap[a.status] || a.status}</span>
    </div>
    <div class="discover-card-title">${escHtml(a.title)}</div>
    <div class="discover-card-meta">
      <span>🕐 ${fmtTime(a.start_time)}</span>
      <span>📍 ${escHtml(a.location || '线上')}</span>
    </div>
    <div class="discover-card-footer">
      <span class="discover-card-publisher">${publisher}</span>
      <span class="discover-card-count">${a.current_participants || 0}/${a.max_participants || '∞'}</span>
    </div>
  </div>`;
}

async function showActivityDetail(id) {
  try {
    const a = await API.getActivity(id);
    if (a.error) return showToast(a.error);
    const statusMap = { open: '报名中', closed: '已截止', cancelled: '已取消', ended: '已结束' };
    const statusColor = { open: '#2ECC71', closed: '#95A5A6', cancelled: '#E74C3C', ended: '#95A5A6' };
    const publisher = a.publisher_type === 'club' ? '🎭 ' + escHtml(a.publisher_name || '社团') : '👤 个人';

    let actionBtn = '';
    if (a.status === 'open') {
      if (a.my_status === 'signed') {
        actionBtn = '<button onclick="cancelActivitySignup(' + a.id + ')" class="discover-btn discover-btn-cancel">取消报名</button>';
      } else {
        actionBtn = '<button onclick="signupActivity(' + a.id + ')" class="discover-btn discover-btn-primary">立即报名</button>';
      }
    } else if (a.my_status === 'signed' && a.status !== 'cancelled') {
      actionBtn = '<button onclick="checkinActivity(' + a.id + ')" class="discover-btn discover-btn-success">签到</button>';
    }

    const content = document.getElementById('discoverDetailContent');
    if (!content) return;
    content.innerHTML = `
      <div class="discover-detail-hero" style="background:${statusColor[a.status] || '#95A5A6'}">
        <div class="discover-detail-status">${statusMap[a.status] || a.status}</div>
        <div class="discover-detail-title">${escHtml(a.title)}</div>
      </div>
      <div class="discover-detail-body">
        <div class="discover-detail-info">
          <div class="discover-detail-row"><span>🕐 开始时间</span><span>${fmtTime(a.start_time)}</span></div>
          <div class="discover-detail-row"><span>🕐 结束时间</span><span>${fmtTime(a.end_time) || '未定'}</span></div>
          ${a.signup_deadline ? '<div class="discover-detail-row"><span>⏰ 报名截止</span><span>' + fmtTime(a.signup_deadline) + '</span></div>' : ''}
          <div class="discover-detail-row"><span>📍 地点</span><span>${escHtml(a.location || '线上')}</span></div>
          <div class="discover-detail-row"><span>👥 报名人数</span><span>${a.signup_count || a.current_participants || 0} / ${a.max_participants || '不限'}</span></div>
          <div class="discover-detail-row"><span>🏷️ 分类</span><span>${escHtml(a.category || '其他')}</span></div>
          <div class="discover-detail-row"><span>📢 发布者</span><span>${publisher}</span></div>
        </div>
        ${a.description ? '<div class="discover-detail-desc"><div class="discover-detail-section-title">活动详情</div><div class="discover-detail-text">' + escHtml(a.description).replace(/\\n/g, '<br>') + '</div></div>' : ''}
        <div class="discover-detail-actions">${actionBtn}</div>
      </div>
    `;
    openSubPage('discoverDetail_sub');
  } catch(e) { showToast('加载失败'); }
}

async function signupActivity(id) {
  try {
    const res = await API.signupActivity(id);
    if (res.error) return showToast(res.error);
    showToast('报名成功！');
    closeSubPage('discoverDetail_sub');
    loadDiscoverActivities();
  } catch(e) { showToast(e.message || '报名失败'); }
}

async function cancelActivitySignup(id) {
  if (!confirm('确定取消报名？')) return;
  try {
    const res = await API.cancelActivitySignup(id);
    if (res.error) return showToast(res.error);
    showToast('已取消报名');
    closeSubPage('discoverDetail_sub');
    loadDiscoverActivities();
  } catch(e) { showToast(e.message || '操作失败'); }
}

async function checkinActivity(id) {
  try {
    const res = await API.checkinActivity(id);
    if (res.error) return showToast(res.error);
    showToast('签到成功！');
    closeSubPage('discoverDetail_sub');
    loadDiscoverActivities();
  } catch(e) { showToast(e.message || '签到失败'); }
}

function filterActCategory(cat) {
  discoverActCategory = discoverActCategory === cat ? '' : cat;
  document.querySelectorAll('.discover-act-cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === discoverActCategory);
  });
  loadDiscoverActivities();
}

// ─── 社团模块 ──────────────────────────────────────────
async function loadDiscoverClubs() {
  // 未登录用户也能查看公开社团
  const container = document.getElementById('discoverClubList');
  if (!container) return;
  container.innerHTML = '<div class="discover-loading">加载中...</div>';

  try {
    const params = { page: 1, limit: 20 };
    if (discoverClubCategory) params.category = discoverClubCategory;
    const res = await API.getClubs(params);
    const list = Array.isArray(res) ? res : (res && res.list || []);

    // 推荐社团横向滚动
    renderHotClubs(list.slice(0, 5));

    if (!list.length) {
      container.innerHTML = '<div class="discover-empty"><div class="discover-empty-icon">🎭</div><p>暂无社团</p></div>';
      return;
    }
    container.innerHTML = list.map(c => renderClubCard(c)).join('');
  } catch(e) {
    container.innerHTML = '<div class="discover-empty"><p>加载失败</p></div>';
    console.error('loadDiscoverClubs error:', e);
  }
}

function renderHotClubs(list) {
  const el = document.getElementById('discoverHotClubs');
  if (!el || !list.length) return;
  el.innerHTML = list.map(c => `
    <div class="discover-hot-club" onclick="showClubDetail(${c.id})">
      <div class="discover-club-avatar">${c.logo ? '<img src="' + c.logo + '" />' : '🎭'}</div>
      <div class="discover-club-name">${escHtml(c.name)}</div>
      <div class="discover-club-count">${c.member_count || 0}人</div>
    </div>
  `).join('');
}

function renderClubCard(c) {
  return `<div class="discover-card discover-club-card" onclick="showClubDetail(${c.id})">
    <div class="discover-club-card-left">
      <div class="discover-club-avatar-lg">${c.logo ? '<img src="' + c.logo + '" />' : '🎭'}</div>
    </div>
    <div class="discover-club-card-right">
      <div class="discover-card-title">${escHtml(c.name)}</div>
      <div class="discover-club-category">${escHtml(c.category || '其他')}</div>
      <div class="discover-club-desc">${escHtml((c.description || '').slice(0, 50))}</div>
      <div class="discover-card-footer">
        <span>${c.member_count || 0}人</span>
      </div>
    </div>
  </div>`;
}

async function showClubDetail(id) {
  try {
    const c = await API.getClub(id);
    if (c.error) return showToast(c.error);
    const phone = currentUser.phone;
    const isMember = c.members && c.members.some(m => m.phone === phone);
    const myRole = isMember ? c.members.find(m => m.phone === phone).role : null;

    let actionBtn = '';
    if (isMember) {
      if (myRole === 'owner') {
        actionBtn = '<div class="discover-detail-badge">社长</div>';
      } else {
        actionBtn = '<button onclick="leaveClub(' + c.id + ')" class="discover-btn discover-btn-cancel">退出社团</button>';
      }
    } else {
      actionBtn = '<button onclick="joinClub(' + c.id + ')" class="discover-btn discover-btn-primary">加入社团</button>';
    }

    const membersHtml = (c.members || []).slice(0, 20).map(m => {
      const roleLabel = m.role === 'owner' ? '👑' : m.role === 'admin' ? '⭐' : '';
      return `<div class="discover-member-item"><span>${roleLabel} ${escHtml(m.name || m.phone)}</span><span class="discover-member-role">${m.role === 'owner' ? '社长' : m.role === 'admin' ? '管理员' : '成员'}</span></div>`;
    }).join('');

    const activitiesHtml = (c.activities || []).map(a => {
      const statusMap = { open: '报名中', closed: '已截止', cancelled: '已取消', ended: '已结束' };
      return `<div class="discover-club-activity" onclick="event.stopPropagation();showActivityDetail(${a.id})">
        <span>${escHtml(a.title)}</span><span style="color:#2ECC71;font-size:12px">${statusMap[a.status] || a.status}</span>
      </div>`;
    }).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">暂无活动</div>';

    const content = document.getElementById('discoverDetailContent');
    if (!content) return;
    content.innerHTML = `
      <div class="discover-detail-hero" style="background:var(--gradient)">
        <div class="discover-club-avatar-xl">${c.logo ? '<img src="' + c.logo + '" />' : '🎭'}</div>
        <div class="discover-detail-title">${escHtml(c.name)}</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px">${escHtml(c.category || '其他')} · ${c.member_count || 0}人</div>
      </div>
      <div class="discover-detail-body">
        ${c.description ? '<div class="discover-detail-desc"><div class="discover-detail-section-title">社团简介</div><div class="discover-detail-text">' + escHtml(c.description).replace(/\\n/g, '<br>') + '</div></div>' : ''}
        <div class="discover-detail-section-title">社团活动</div>
        <div class="discover-club-activities">${activitiesHtml}</div>
        <div class="discover-detail-section-title">社团成员 (${c.members ? c.members.length : 0})</div>
        <div class="discover-members-list">${membersHtml}</div>
        <div class="discover-detail-actions">${actionBtn}</div>
      </div>
    `;
    openSubPage('discoverDetail_sub');
  } catch(e) { showToast('加载失败'); }
}

async function joinClub(id) {
  try {
    const res = await API.joinClub(id);
    if (res.error) return showToast(res.error);
    showToast('加入成功！');
    closeSubPage('discoverDetail_sub');
    loadDiscoverClubs();
  } catch(e) { showToast(e.message || '加入失败'); }
}

async function leaveClub(id) {
  if (!confirm('确定退出该社团？')) return;
  try {
    const res = await API.leaveClub(id);
    if (res.error) return showToast(res.error);
    showToast('已退出社团');
    closeSubPage('discoverDetail_sub');
    loadDiscoverClubs();
  } catch(e) { showToast(e.message || '操作失败'); }
}

function filterClubCategory(cat) {
  discoverClubCategory = discoverClubCategory === cat ? '' : cat;
  document.querySelectorAll('.discover-club-cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === discoverClubCategory);
  });
  loadDiscoverClubs();
}

// ═══════════════════════════════════════════════════════
// ─── 创建活动弹窗 ──────────────────────────────────────
function openCreateActivityModal() {
  if (!currentUser) return showToast('请先登录');
  const modal = document.getElementById('createActivityModal');
  if (!modal) return;
  modal.style.display = 'flex';
  // 加载用户管理的社团列表供选择
  loadMyClubsForSelect();
}

function closeCreateActivityModal() {
  const modal = document.getElementById('createActivityModal');
  if (modal) modal.style.display = 'none';
}

async function loadMyClubsForSelect() {
  const select = document.getElementById('actPublisherClub');
  if (!select) return;
  try {
    const res = await API.getClubs({ page: 1, limit: 100 });
    const list = Array.isArray(res) ? res : (res && res.list || []);
    const phone = currentUser.phone;
    // 只显示用户是owner/admin的社团
    const myClubs = [];
    for (const club of list) {
      const detail = await API.getClub(club.id);
      if (detail.members && detail.members.some(m => m.phone === phone && (m.role === 'owner' || m.role === 'admin'))) {
        myClubs.push(club);
      }
    }
    select.innerHTML = '<option value="">个人发布</option>' + myClubs.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  } catch(e) { console.error(e); }
}

async function submitCreateActivity() {
  const form = document.getElementById('createActivityForm');
  if (!form) return;

  const title = form.actTitle.value.trim();
  const category = form.actCategory.value;
  const location = form.actLocation.value.trim();
  const start_time = form.actStartTime.value;
  const end_time = form.actEndTime.value;
  const signup_deadline = form.actSignupDeadline.value;
  const max_participants = form.actMaxParticipants.value;
  const description = form.actDescription.value.trim();
  const clubSelect = form.actPublisherClub;
  const coverFile = form.actCover.files[0];

  if (!title) return showToast('请填写活动标题');
  if (!start_time) return showToast('请设置开始时间');

  const data = { title, category, location, start_time, description };
  if (end_time) data.end_time = end_time;
  if (signup_deadline) data.signup_deadline = signup_deadline;
  if (max_participants) data.max_participants = max_participants;

  // 社团发布
  if (clubSelect && clubSelect.value) {
    data.publisher_type = 'club';
    data.publisher_id = clubSelect.value;
    const selectedOption = clubSelect.options[clubSelect.selectedIndex];
    data.publisher_name = selectedOption.text;
  }

  try {
    const res = await API.createActivity(data, coverFile || null);
    if (res.error) return showToast(res.error);
    showToast('活动发布成功！');
    closeCreateActivityModal();
    form.reset();
    loadDiscoverActivities();
  } catch(e) { showToast(e.message || '发布失败'); }
}

// ─── 创建社团弹窗 ──────────────────────────────────────
function openCreateClubModal() {
  if (!currentUser) return showToast('请先登录');
  const modal = document.getElementById('createClubModal');
  if (modal) modal.style.display = 'flex';
}

function closeCreateClubModal() {
  const modal = document.getElementById('createClubModal');
  if (modal) modal.style.display = 'none';
}

async function submitCreateClub() {
  const form = document.getElementById('createClubForm');
  if (!form) return;

  const name = form.clubName.value.trim();
  const category = form.clubCategory.value;
  const description = form.clubDescription.value.trim();
  const logoFile = form.clubLogo.files[0];

  if (!name) return showToast('请填写社团名称');

  try {
    const res = await API.createClub({ name, category, description }, logoFile || null);
    if (res.error) return showToast(res.error);
    showToast('社团创建成功！');
    closeCreateClubModal();
    form.reset();
    loadDiscoverClubs();
  } catch(e) { showToast(e.message || '创建失败'); }
}

// ─── 初始化发现页 ──────────────────────────────────────
function initDiscoverPage() {
  loadDiscoverActivities();
}

  // Exports - 仅暴露必要的函数到全局
  window.switchDiscoverTab = switchDiscoverTab;
  window.loadDiscoverActivities = loadDiscoverActivities;
  window.loadDiscoverClubs = loadDiscoverClubs;
  window.showActivityDetail = showActivityDetail;
  window.showClubDetail = showClubDetail;
  window.signupActivity = signupActivity;
  window.cancelActivitySignup = cancelActivitySignup;
  window.checkinActivity = checkinActivity;
  window.joinClub = joinClub;
  window.leaveClub = leaveClub;
  window.filterActCategory = filterActCategory;
  window.filterClubCategory = filterClubCategory;
  window.openCreateActivityModal = openCreateActivityModal;
  window.closeCreateActivityModal = closeCreateActivityModal;
  window.submitCreateActivity = submitCreateActivity;
  window.openCreateClubModal = openCreateClubModal;
  window.closeCreateClubModal = closeCreateClubModal;
  window.submitCreateClub = submitCreateClub;
  window.initDiscoverPage = initDiscoverPage;
})();
