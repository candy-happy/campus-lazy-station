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
  let _actViewMode = 'list'; // 'list' | 'calendar'
  let _calendarYear = new Date().getFullYear();
  let _calendarMonth = new Date().getMonth() + 1;
  let _calendarActivities = [];
  let _calendarSelectedDate = null;

// ─── 切换发现页Tab ──────────────────────────────────────
function switchDiscoverTab(tab) {
  if (tab === 'clubs') { openClubPage(); return; }
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
    _currentActivityDetail = a;
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
        ${a.cover ? '<div style="margin-bottom:12px;border-radius:12px;overflow:hidden"><img src="' + escHtml(a.cover) + '" style="width:100%;max-height:240px;object-fit:cover;display:block" alt="封面图" onerror="this.style.display=\'none\'"></div>' : ''}
        ${a.promo_photo ? '<div style="margin-bottom:12px;border-radius:12px;overflow:hidden"><div style="font-size:13px;color:var(--sub);margin-bottom:4px">📸 宣传照片</div><img src="' + escHtml(a.promo_photo) + '" style="width:100%;max-height:300px;object-fit:cover;display:block;border-radius:10px" alt="宣传照" onerror="this.style.display=\'none\'"></div>' : ''}
        ${a.qr_code ? '<div style="margin-bottom:12px;border-radius:12px;overflow:hidden"><div style="font-size:13px;color:var(--sub);margin-bottom:4px">📱 群二维码</div><img src="' + escHtml(a.qr_code) + '" style="width:200px;height:200px;object-fit:contain;display:block;border-radius:10px;border:1px solid var(--border)" alt="群二维码" onerror="this.style.display=\'none\'"></div>' : ''}
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
  if (_actViewMode === 'calendar') {
    loadCalendarActivities();
  } else {
    loadDiscoverActivities();
  }
}

// ─── 日历视图 ──────────────────────────────────────────
function toggleActView() {
  _actViewMode = _actViewMode === 'list' ? 'calendar' : 'list';
  const toggle = document.getElementById('discoverActViewToggle');
  const calView = document.getElementById('discoverCalendarView');
  const listView = document.getElementById('discoverActivityList');
  const pubBtn = document.querySelector('#discoverActivitiesSection > button');

  if (_actViewMode === 'calendar') {
    if (toggle) toggle.textContent = '📋 列表';
    if (calView) calView.style.display = 'block';
    if (listView) listView.style.display = 'none';
    if (pubBtn) pubBtn.style.display = 'none';
    const now = new Date();
    _calendarYear = now.getFullYear();
    _calendarMonth = now.getMonth() + 1;
    loadCalendarActivities();
  } else {
    if (toggle) toggle.textContent = '📅 日历';
    if (calView) calView.style.display = 'none';
    if (listView) listView.style.display = 'block';
    if (pubBtn) pubBtn.style.display = 'block';
    loadDiscoverActivities();
  }
}

async function loadCalendarActivities() {
  const y = _calendarYear, m = _calendarMonth;
  const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
  const endDate = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`;
  try {
    const params = { start_date: startDate, end_date: endDate, limit: 100 };
    if (discoverActCategory) params.category = discoverActCategory;
    if (discoverSearch) params.search = discoverSearch;
    const res = await API.getActivities(params);
    _calendarActivities = res.list || [];
  } catch(e) { _calendarActivities = []; }
  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById('calendarMonthLabel');
  if (label) label.textContent = `${_calendarYear}年${_calendarMonth}月`;

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const days = ['日','一','二','三','四','五','六'];
  let html = days.map(d => `<div style="font-size:11px;color:var(--text-muted);padding:4px 0">${d}</div>`).join('');

  const firstDay = new Date(_calendarYear, _calendarMonth - 1, 1).getDay();
  const daysInMonth = new Date(_calendarYear, _calendarMonth, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // 活动按日期分组
  const dateMap = {};
  _calendarActivities.forEach(a => {
    const d = a.start_time ? a.start_time.substring(0, 10) : '';
    if (!dateMap[d]) dateMap[d] = [];
    dateMap[d].push(a);
  });

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${_calendarYear}-${String(_calendarMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const acts = dateMap[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === _calendarSelectedDate;
    const hasActs = acts.length > 0;

    let bg = 'var(--bg)';
    if (isSelected) bg = 'var(--gradient-start)';
    else if (isToday) bg = 'rgba(52,152,219,0.15)';

    html += `<div onclick="calendarSelectDate('${dateStr}')" style="padding:6px 2px;border-radius:8px;cursor:pointer;background:${bg};${isSelected ? 'color:#fff' : ''};min-height:36px">
      <div style="font-size:13px;${isToday && !isSelected ? 'font-weight:700;color:#3498DB' : ''}">${d}</div>
      ${hasActs ? `<div style="display:flex;gap:1px;justify-content:center;margin-top:2px">${acts.slice(0,3).map(() => '<span style="width:4px;height:4px;border-radius:50%;background:' + (isSelected ? '#fff' : 'var(--gradient-start)') + ';display:inline-block"></span>').join('')}</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;

  // 如果已选日期，显示该日活动
  if (_calendarSelectedDate) {
    showCalendarDateActivities(_calendarSelectedDate);
  }
}

function calendarSelectDate(dateStr) {
  _calendarSelectedDate = _calendarSelectedDate === dateStr ? null : dateStr;
  renderCalendar();
  if (_calendarSelectedDate) {
    showCalendarDateActivities(_calendarSelectedDate);
  } else {
    const container = document.getElementById('calendarDateActivities');
    if (container) container.innerHTML = '';
  }
}

function showCalendarDateActivities(dateStr) {
  const container = document.getElementById('calendarDateActivities');
  if (!container) return;
  const acts = _calendarActivities.filter(a => a.start_time && a.start_time.substring(0, 10) === dateStr);
  if (acts.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">这天没有活动</div>`;
    return;
  }
  container.innerHTML = `<div style="font-size:14px;font-weight:600;margin-bottom:8px">📅 ${escHtml(dateStr)} 的活动 (${acts.length})</div>` +
    acts.map(a => {
      const timeStr = a.start_time ? a.start_time.substring(11, 16) : '';
      const catColors = { '讲座':'#3498DB','比赛':'#E74C3C','聚会':'#F39C12','志愿':'#2ECC71','演出':'#9B59B6','运动':'#1ABC9C' };
      const catColor = catColors[a.category] || '#95A5A6';
      return `<div onclick="showActivityDetail(${a.id})" style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:10px">
        <div style="background:${catColor};color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;white-space:nowrap">${escHtml(a.category || '活动')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.title)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(timeStr)} · ${escHtml(a.location || '待定')}</div>
        </div>
        <span style="font-size:12px;color:var(--text-muted)">${a.current_count || 0}/${a.max_participants || '∞'}</span>
      </div>`;
    }).join('');
}

function calendarPrevMonth() {
  if (_calendarMonth === 1) { _calendarMonth = 12; _calendarYear--; }
  else _calendarMonth--;
  _calendarSelectedDate = null;
  loadCalendarActivities();
}
function calendarNextMonth() {
  if (_calendarMonth === 12) { _calendarMonth = 1; _calendarYear++; }
  else _calendarMonth++;
  _calendarSelectedDate = null;
  loadCalendarActivities();
}

// ─── 社团模块 ──────────────────────────────────────────
async function loadDiscoverClubs() {
  // 未登录用户也能查看公开社团
  const container = document.getElementById('discoverClubList');
  if (!container) return;
  container.innerHTML = '<div class="discover-loading">加载中...</div>';

  try {
    const sortEl = document.getElementById('discoverClubSort');
    const sort = sortEl ? sortEl.value : 'hot';
    const params = { page: 1, limit: 20, sort };
    if (discoverClubCategory) params.category = discoverClubCategory;
    const res = await API.getClubs(params);
    const list = Array.isArray(res) ? res : (res && res.list || []);

    // 推荐社团横向滚动
    renderHotClubs(list.slice(0, 5));

    // 加载我的社团
    loadMyClubs();

    if (!list.length) {
      container.innerHTML = '<div class="discover-empty"><div class="discover-empty-icon">🎭</div><p>暂无社团</p></div>';
      return;
    }
    container.innerHTML = list.map(c => renderClubCard(c)).join(''); loadClubRecommendations();
  } catch(e) {
    container.innerHTML = '<div class="discover-empty"><p>加载失败</p></div>';
    console.error('loadDiscoverClubs error:', e);
  }
}

// 加载我的社团（横向滚动）
async function loadMyClubs() {
  const section = document.getElementById('discoverMyClubsSection');
  const container = document.getElementById('discoverMyClubs');
  if (!section || !container) return;
  if (!currentUser || !currentUser.phone) { section.style.display = 'none'; return; }

  try {
    const res = await API.getMyClubs();
    const list = res && res.list ? res.list : (Array.isArray(res) ? res : []);
    if (!list.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    container.innerHTML = list.map(c => `
      <div class="discover-hot-club" onclick="showClubDetail(${c.id})">
        <div class="discover-club-avatar">${c.logo ? '<img src="' + c.logo + '" />' : '🎭'}</div>
        <div class="discover-club-name">${escHtml(c.name)}</div>
        <div class="discover-club-count">${c.role === 'owner' ? '👑 ' : ''}${c.member_count || 0}人</div>
      </div>
    `).join('');
  } catch(e) {
    section.style.display = 'none';
    console.error('loadMyClubs error:', e);
  }
}

function onClubSortChange() {
  loadDiscoverClubs();
}

// ─── 推荐社团 ──────────────────────────────────────────
async function loadClubRecommendations() {
  const el = document.getElementById('clubRecommendations');
  if (!el) return;
  try {
    const list = await API.getClubRecommendations(3);
    if (!list || !list.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div style="font-size:13px;font-weight:600;margin:12px 0 8px;color:var(--text)">💡 推荐社团</div>' +
      list.map(c => {
        const recruitBadge = c.recruitment_open ? '<span style="background:#E74C3C;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:4px">🔥招新</span>' : '';
        return renderClubCard(c);
      }).join('');
  } catch(e) { /* ignore */ }
}

async function toggleClubRanking() {
  const el = document.getElementById('discoverClubRanking');
  const toggle = document.getElementById('clubRankingToggle');
  if (!el || !toggle) return;

  if (el.style.display === 'block') {
    el.style.display = 'none';
    toggle.textContent = '展开 ▼';
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px">加载中...</div>';
  el.style.display = 'block';
  toggle.textContent = '收起 ▲';

  try {
    const res = await API.getClubRanking(10);
    const list = res.list || [];
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px">暂无社团</div>';
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = list.map((c, i) => {
      const medal = i < 3 ? medals[i] : `<span style="color:var(--text-muted);font-size:12px">${i+1}</span>`;
      return `<div onclick="showClubDetail(${c.id})" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;${i%2===0?'background:var(--bg)':''}">
        <span style="font-size:18px;width:24px;text-align:center">${medal}</span>
        <div style="width:36px;height:36px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${c.logo ? '<img src="'+c.logo+'" style="width:100%;height:100%;object-fit:cover" />' : '🎭'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.name)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${c.category || ''} · ${c.activity_count || 0}活动</div>
        </div>
        <span style="font-size:13px;font-weight:600;color:var(--gradient-start)">${c.member_count || 0}人</span>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px">加载失败</div>';
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
  const recruitBadge = c.recruitment_open ? '<span style="background:#E74C3C;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:4px">🔥招新</span>' : '';
  return `<div class="discover-card discover-club-card" onclick="showClubDetail(${c.id})">
    <div class="discover-club-card-left">
      <div class="discover-club-avatar-lg">${c.logo ? '<img src="' + c.logo + '" />' : '🎭'}</div>
    </div>
    <div class="discover-club-card-right">
      <div class="discover-card-title">${escHtml(c.name)}${recruitBadge}</div>
      <div class="discover-club-category">${escHtml(c.category || '其他')}</div>
      <div class="discover-club-desc">${escHtml((c.description || '').slice(0, 50))}</div>
      <div class="discover-card-footer">
        <span>${c.member_count || 0}人</span>
      </div>
    </div>
  </div>`;
}


let _currentClubId = null;
let _currentClubDetail = null; // 用于海报生成
let _currentActivityDetail = null; // 用于活动海报
let _clubReplyTo = {}; // { postId: { commentId, name } }

async function showClubDetail(id) {
  try {
    const c = await API.getClub(id);
    if (c.error) return showToast(c.error);
    _currentClubId = id;
    _currentClubDetail = c;
    const phone = currentUser.phone;
    const myRole = c.my_role;
    const myAppStatus = c.my_app_status;

    let actionBtn = '';
    if (myRole) {
      if (myRole === 'owner') {
        actionBtn = '<div class="discover-detail-badge">👑 社长</div>';
        actionBtn += '<button onclick="showClubManagePanel()" class="discover-btn" style="background:var(--gradient);color:#fff">⚙️ 社团管理</button>';
      } else if (myRole === 'admin') {
        actionBtn = '<div class="discover-detail-badge">⭐ 管理员</div>';
        actionBtn += '<button onclick="showClubManagePanel()" class="discover-btn" style="background:var(--gradient);color:#fff">⚙️ 社团管理</button>';
      } else {
        actionBtn = '<button onclick="leaveClub(' + c.id + ')" class="discover-btn discover-btn-cancel">退出社团</button>';
      }
    } else if (myAppStatus === 'pending') {
      actionBtn = '<button class="discover-btn" style="background:#95A5A6;color:#fff;cursor:default" disabled>⏳ 审批中...</button>';
    } else if (myAppStatus === 'rejected') {
      actionBtn = '<button onclick="applyJoinClub(' + c.id + ')" class="discover-btn discover-btn-primary">📝 重新申请</button>';
    } else {
      actionBtn = '<button onclick="applyJoinClub(' + c.id + ')" class="discover-btn discover-btn-primary">📝 申请加入</button>';
    }

    const membersHtml = (c.members || []).slice(0, 20).map(m => {
      const roleLabel = m.role === 'owner' ? '👑' : m.role === 'admin' ? '⭐' : '';
      return `<div class="discover-member-item"><span>${roleLabel} ${escHtml(m.name || m.phone)}</span><span class="discover-member-role">${m.role === 'owner' ? '社长' : m.role === 'admin' ? '管理员' : '成员'}</span></div>`;
    }).join('');

    const postAreaHtml = myRole
      ? `<div style="margin-bottom:12px"><button onclick="openClubPostModal()" style="width:100%;padding:10px;border-radius:10px;background:var(--card);border:1px dashed var(--border);color:var(--text-muted);font-size:14px;cursor:pointer;text-align:left">✏️ 分享社团动态...</button></div>`
      : '';

    const recruitBadge = c.recruitment_open ? '<span style="background:#E74C3C;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px">🔥招新中</span>' : '';

    const content = document.getElementById('discoverDetailContent');
    if (!content) return;
    content.innerHTML = `
      <div class="discover-detail-hero" style="background:var(--gradient)">
        <div class="discover-club-avatar-xl">${c.logo ? '<img src="' + c.logo + '" />' : '🎭'}</div>
        <div class="discover-detail-title">${escHtml(c.name)}${recruitBadge}</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px">${escHtml(c.category || '其他')} · ${c.member_count || 0}人 · ${c.activity_count || 0}活动</div>
      </div>
      <div class="discover-detail-body">
        ${c.description ? '<div class="discover-detail-desc"><div class="discover-detail-section-title">社团简介</div><div class="discover-detail-text">' + escHtml(c.description).replace(/\\n/g, '<br>') + '</div></div>' : ''}
        <div class="discover-detail-section-title">📣 最新动态</div>
        ${postAreaHtml}
        <div id="clubTimeline" style="min-height:60px"><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">加载中...</div></div>
        <div class="discover-detail-section-title" style="margin-top:16px">👥 社团成员 (${c.members ? c.members.length : 0})</div>
        <div class="discover-members-list">${membersHtml}</div>
        <div class="discover-detail-actions">${actionBtn}</div>
      </div>
    `;
    openSubPage('discoverDetail_sub');
    loadClubTimeline(id);
  } catch(e) { showToast('加载失败'); }
}

// ══════ 社团时间线 ══════
async function loadClubTimeline(clubId) {
  const el = document.getElementById('clubTimeline');
  if (!el) return;
  try {
    const timeline = await API.getClubTimeline(clubId, 20);
    const items = Array.isArray(timeline) ? timeline : (timeline.list || []);
    if (!items.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">暂无动态，快来发第一条吧~</div>';
      return;
    }
    const phone = currentUser?.phone;
    el.innerHTML = items.map(item => {
      if (item.type === 'post') return renderTimelinePost(item, phone);
      if (item.type === 'join') return renderTimelineJoin(item);
      if (item.type === 'activity') return renderTimelineActivity(item);
      return '';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">加载失败</div>';
  }
}

function renderTimelinePost(p, phone) {
  const pinnedBadge = p.pinned ? '<span style="color:#F39C12;font-size:11px">📌置顶</span> ' : '';
  const imgsHtml = (p.images && p.images.length > 0)
    ? '<div style="display:flex;gap:4px;margin-top:8px;overflow-x:auto">' + p.images.map(img => '<img src="' + img + '" style="width:80px;height:80px;border-radius:8px;object-fit:cover;flex-shrink:0"  />').join('') + '</div>'
    : '';
  const canDelete = (p.phone === phone) || (_currentClubDetail?.my_role === 'owner' || _currentClubDetail?.my_role === 'admin');
  const deleteBtn = canDelete ? '<button onclick="event.stopPropagation();deleteClubPost(' + _currentClubId + ',' + p.id + ')" style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;padding:2px 4px">🗑️</button>' : '';
  return '<div class="timeline-post" style="background:var(--bg);border-radius:12px;padding:12px;margin-bottom:10px" data-pid="' + p.id + '">\n    <div style="display:flex;align-items:center;margin-bottom:8px">\n      <div style="width:32px;height:32px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;margin-right:8px">' + (p.author_avatar ? '<img src="' + p.author_avatar + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />' : '<img src="/uploads/avatars/default-girl.png" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />') + '</div>\n      <div style="flex:1;min-width:0">\n        <div style="font-size:13px;font-weight:600">' + escHtml(p.author_name || p.phone) + '</div>\n        <div style="font-size:11px;color:var(--text-muted)">' + fmtTime(p.created_at) + '</div>\n      </div>\n      ' + pinnedBadge + deleteBtn + '\n    </div>\n    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">' + escHtml(p.content) + '</div>\n    ' + imgsHtml + '\n    <div style="display:flex;gap:16px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">\n      <button onclick="toggleClubPostLike(' + p.id + ', this)" class="timeline-action-btn" style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:4px">\n        ' + (p.liked ? '❤️' : '🤍') + ' <span class="like-count">' + (p.like_count || 0) + '</span>\n      </button>\n      <button onclick="toggleClubPostComments(' + p.id + ', this)" class="timeline-action-btn" style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:4px">\n        💬 <span class="comment-count">' + (p.comment_count || 0) + '</span>\n      </button>\n    </div>\n    <div class="club-post-comments" id="clubComments_' + p.id + '" style="display:none;margin-top:8px"></div>\n  </div>';
}

function renderTimelineJoin(item) {
  return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:8px;background:var(--card);border-radius:10px;font-size:13px">\n    <span>🆕</span><span style="font-weight:500">' + escHtml(item.name || item.phone) + '</span><span style="color:var(--text-muted)">加入了社团</span>\n    <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">' + fmtTime(item.created_at) + '</span>\n  </div>';
}

function renderTimelineActivity(item) {
  return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:8px;background:var(--card);border-radius:10px;font-size:13px;cursor:pointer" onclick="showActivityDetail(' + item.id + ')">\n    <span>📅</span><span style="font-weight:500">' + escHtml(item.title) + '</span><span style="color:#2ECC71">即将开始</span>\n    <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">' + fmtTime(item.created_at) + '</span>\n  </div>';
}

// ══════ 帖子点赞 ══════
async function toggleClubPostLike(postId, btn) {
  if (!currentUser) return showToast('请先登录');
  try {
    const res = await API.likeClubPost(postId);
    if (res.ok) {
      const likeSpan = btn.querySelector('.like-count');
      if (likeSpan) likeSpan.textContent = res.count || 0;
      btn.innerHTML = (res.liked ? '❤️' : '🤍') + ' <span class="like-count">' + (res.count || 0) + '</span>';
    } else if (res.error) showToast(res.error);
  } catch(e) { /* ignore */ }
}

// ══════ 评论展开 ══════
async function toggleClubPostComments(postId, btn) {
  const container = document.getElementById('clubComments_' + postId);
  if (!container) return;
  if (container.style.display === 'block') { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px">加载中...</div>';
  try {
    const comments = await API.getClubPostComments(postId);
    renderClubComments(postId, Array.isArray(comments) ? comments : [], container);
  } catch(e) { container.innerHTML = '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:12px">加载失败</div>'; }
}

function renderClubComments(postId, comments, container) {
  const phone = currentUser?.phone;
  if (!comments.length) {
    container.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted);font-size:12px">暂无评论</div>' + renderClubCommentInput(postId);
    return;
  }
  const commentMap = {};
  const roots = [];
  comments.forEach(c => { c.children = []; commentMap[c.id] = c; });
  comments.forEach(c => {
    if (c.parent_id && commentMap[c.parent_id]) { commentMap[c.parent_id].children.push(c); }
    else if (!c.parent_id) { roots.push(c); }
    else { roots.push(c); }
  });
  let html = '';
  function render(c, depth) {
    const canDel = (c.phone === phone) || (_currentClubDetail?.my_role === 'owner' || _currentClubDetail?.my_role === 'admin');
    const pad = depth * 16;
    html += '<div style="margin-left:' + pad + 'px;padding:6px 0;border-bottom:1px solid var(--border)">\n      <div style="display:flex;align-items:flex-start;gap:6px">\n        <div style="width:24px;height:24px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;overflow:hidden">' + (c.avatar ? '<img src="' + c.avatar + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />' : '<img src="/uploads/avatars/default-girl.png" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />') + '</div>\n        <div style="flex:1;min-width:0">\n          <div style="font-size:12px"><span style="font-weight:600">' + escHtml(c.name || c.phone) + '</span>' + (c.reply_to_name ? '<span style="color:var(--text-muted)"> 回复 </span><span style="color:var(--gradient-start)">@' + escHtml(c.reply_to_name) + '</span>' : '') + '</div>\n          <div style="font-size:13px;margin:2px 0;word-break:break-word">' + escHtml(c.content) + '</div>\n          <div style="font-size:10px;color:var(--text-muted)">' + fmtTime(c.created_at) + '\n            <span style="margin-left:6px;cursor:pointer;color:var(--gradient-start)" onclick="_clubReplySet(' + postId + ',' + c.id + ',\'' + escHtml(c.name || c.phone) + '\')">回复</span>\n            ' + (canDel ? '<span style="margin-left:6px;cursor:pointer;color:#E74C3C" onclick="deleteClubComment(' + postId + ',' + c.id + ',this)">删除</span>' : '') + '\n          </div>\n        </div>\n      </div>\n    </div>';
    if (c.children.length) c.children.forEach(ch => render(ch, depth + 1));
  }
  roots.forEach(c => render(c, 0));
  container.innerHTML = html + renderClubCommentInput(postId);
}

function renderClubCommentInput(postId) {
  return '<div style="display:flex;gap:6px;align-items:center;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">\n    <input type="text" id="clubCommentText_' + postId + '" placeholder="写评论..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);font-size:13px;color:var(--text);outline:none" maxlength="500" />\n    <button onclick="submitClubComment(' + postId + ')" style="padding:8px 14px;border-radius:8px;background:var(--gradient);color:#fff;border:none;font-size:13px;cursor:pointer;flex-shrink:0">发送</button>\n  </div>\n  <span id="clubReplyHint_' + postId + '" style="font-size:11px;color:var(--text-muted);margin-top:4px;display:none;cursor:pointer"></span>';
}

function _clubReplySet(postId, commentId, name) {
  _clubReplyTo[postId] = { commentId, name };
  const hint = document.getElementById('clubReplyHint_' + postId);
  const input = document.getElementById('clubCommentText_' + postId);
  if (hint) { hint.style.display = 'block'; hint.textContent = '回复 ' + name + ' (点击取消)'; hint.onclick = function() { _clubReplyClear(postId); }; }
  if (input) { input.placeholder = '回复 ' + name + '...'; input.focus(); }
}

function _clubReplyClear(postId) {
  delete _clubReplyTo[postId];
  const hint = document.getElementById('clubReplyHint_' + postId);
  const input = document.getElementById('clubCommentText_' + postId);
  if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
  if (input) { input.placeholder = '写评论...'; }
}

async function submitClubComment(postId) {
  if (!currentUser) return showToast('请先登录');
  const input = document.getElementById('clubCommentText_' + postId);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  const reply = _clubReplyTo[postId];
  try {
    const res = await API.commentClubPost(postId, content, reply?.commentId || null, null);
    if (res.ok) {
      input.value = '';
      _clubReplyClear(postId);
      const container = document.getElementById('clubComments_' + postId);
      if (container) {
        const comments = await API.getClubPostComments(postId);
        renderClubComments(postId, Array.isArray(comments) ? comments : [], container);
      }
      const countBtn = document.querySelector('.timeline-post[data-pid="' + postId + '"] .comment-count');
      if (countBtn) countBtn.textContent = (parseInt(countBtn.textContent) || 0) + 1;
    } else if (res.error) showToast(res.error);
  } catch(e) { showToast('评论失败'); }
}

async function deleteClubComment(postId, commentId, el) {
  if (!confirm('确定删除这条评论？')) return;
  try {
    const res = await API.deleteClubComment(commentId);
    if (res.ok) {
      const container = document.getElementById('clubComments_' + postId);
      if (container) {
        const comments = await API.getClubPostComments(postId);
        renderClubComments(postId, Array.isArray(comments) ? comments : [], container);
      }
    } else if (res.error) showToast(res.error);
  } catch(e) { showToast('删除失败'); }
}
// ─── 申请加入弹窗 ──────────────────────────────────────
function applyJoinClub(id) {
  if (!currentUser) return showToast('请先登录');
  _currentClubId = id;
  const input = document.getElementById('clubApplyReason');
  if (input) input.value = '';
  openSubPage('clubApplyPage_sub');
}

function closeClubApplyModal() {
  closeSubPage('clubApplyPage_sub');
}

async function submitClubApply() {
  const input = document.getElementById('clubApplyReason');
  const reason = input ? input.value.trim() : '';
  try {
    const res = await API.joinClub(_currentClubId, reason);
    if (res.error) return showToast(res.error);
    showToast(res.message || '申请已提交');
    closeClubApplyModal();
    // 重新加载社团详情和列表
    showClubDetail(_currentClubId);
    loadDiscoverClubs();
  } catch(e) { showToast(e.message || '申请失败'); }
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

// ─── 社团公告发布 ──────────────────────────────────────
function openClubPostModal() {
  const input = document.getElementById('clubPostContent');
  if (input) input.value = '';
  const fileInput = document.getElementById('clubPostPhotos');
  if (fileInput) fileInput.value = '';
  openSubPage('clubPostPage_sub');
}
function closeClubPostModal() {
  closeSubPage('clubPostPage_sub');
}
async function submitClubPost() {
  const input = document.getElementById('clubPostContent');
  const content = input ? input.value.trim() : '';
  if (!content) return showToast('请输入公告内容');
  const fileInput = document.getElementById('clubPostPhotos');
  const files = fileInput ? fileInput.files : null;
  try {
    const res = await API.createClubPost(_currentClubId, content, files);
    if (res.error) return showToast(res.error);
    showToast('发布成功');
    closeClubPostModal();
    showClubDetail(_currentClubId);
  } catch(e) { showToast(e.message || '发布失败'); }
}
async function deleteClubPost(clubId, postId) {
  if (!confirm('确定删除这条公告？')) return;
  try {
    const res = await API.deleteClubPost(clubId, postId);
    if (res.error) return showToast(res.error);
    showToast('已删除');
    showClubDetail(clubId);
  } catch(e) { showToast(e.message || '删除失败'); }
}

function filterClubCategory(cat) {
  discoverClubCategory = discoverClubCategory === cat ? '' : cat;
  document.querySelectorAll('.discover-club-cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === discoverClubCategory);
  });
  loadDiscoverClubs();
}

// ─── 推荐社团 ──────────────────────────────────────────
async function loadClubRecommendations() {
  const el = document.getElementById('clubRecommendations');
  if (!el) return;
  try {
    const list = await API.getClubRecommendations(3);
    if (!list || !list.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div style="font-size:13px;font-weight:600;margin:12px 0 8px;color:var(--text)">💡 推荐社团</div>' +
      list.map(c => {
        const recruitBadge = c.recruitment_open ? '<span style="background:#E74C3C;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:4px">🔥招新</span>' : '';
        return renderClubCard(c);
      }).join('');
  } catch(e) { /* ignore */ }
}

// ─── 社团管理面板 ──────────────────────────────────────
let _clubManageTab = 'applications'; // applications | members | settings
let _clubManageApps = [];
let _clubManageMembers = [];
let _clubManageStats = null;

async function showClubManagePanel() {
  if (!_currentClubId || !currentUser) return;
  const panel = document.getElementById('clubManageSub');
  if (!panel) return;

  try {
    const c = await API.getClub(_currentClubId);
    if (c.error) return showToast(c.error);

    _clubManageTab = 'applications';
    _clubManageMembers = c.members || [];
    _clubManageStats = null;

    try {
      _clubManageApps = await API.getClubApplications(_currentClubId, 'pending');
      if (!Array.isArray(_clubManageApps)) _clubManageApps = [];
    } catch(e) { _clubManageApps = []; }

    renderClubManagePanel(c);
    openSubPage('clubManageSub');
  } catch(e) { showToast('加载失败'); }
}

function renderClubManagePanel(c) {
  const content = document.getElementById('clubManageContent');
  if (!content) return;

  const isOwner = currentUser && c.members && c.members.some(m => m.phone === currentUser.phone && m.role === 'owner');

  const tabHtml = `
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--bg);border-radius:10px;padding:4px;overflow-x:auto">
      <div class="club-mgmt-tab ${_clubManageTab === 'applications' ? 'active' : ''}" onclick="switchClubManageTab('applications')" style="flex:1;text-align:center;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;${_clubManageTab === 'applications' ? 'background:var(--card);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.1)' : 'color:var(--text-secondary)'}">
        📋 入社申请${_clubManageApps.length > 0 ? '<span style="background:#E74C3C;color:#fff;border-radius:50%;padding:1px 6px;font-size:11px;margin-left:4px">' + _clubManageApps.length + '</span>' : ''}
      </div>
      <div class="club-mgmt-tab ${_clubManageTab === 'members' ? 'active' : ''}" onclick="switchClubManageTab('members')" style="flex:1;text-align:center;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;${_clubManageTab === 'members' ? 'background:var(--card);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.1)' : 'color:var(--text-secondary)'}">
        👥 成员管理
      </div>
      ${isOwner ? `<div class="club-mgmt-tab ${_clubManageTab === 'settings' ? 'active' : ''}" onclick="switchClubManageTab('settings')" style="flex:1;text-align:center;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;${_clubManageTab === 'settings' ? 'background:var(--card);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.1)' : 'color:var(--text-secondary)'}">
        ⚙️ 社团设置
      </div>` : ''}
    </div>
  `;

  let bodyHtml = '';
  if (_clubManageTab === 'applications') {
    bodyHtml = renderClubApplications();
  } else if (_clubManageTab === 'members') {
    bodyHtml = renderClubMembersManage(c);
  } else if (_clubManageTab === 'settings') {
    bodyHtml = renderClubSettings(c);
  }

  content.innerHTML = tabHtml + bodyHtml;
}

function switchClubManageTab(tab) {
  _clubManageTab = tab;
  if (tab === 'settings' && !_clubManageStats) {
    loadClubStats();
  }
  showClubManagePanel();
}

function renderClubApplications() {
  if (_clubManageApps.length === 0) {
    return '<div style="text-align:center;padding:32px;color:var(--text-muted)">📭 暂无待审批的申请</div>';
  }
  return _clubManageApps.map(app => `
    <div style="background:var(--card);border-radius:12px;padding:14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${escHtml(app.name || app.phone)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${fmtPhone(app.phone)} · ${fmtTime(app.created_at)}</div>
        ${app.reason ? '<div style="font-size:13px;color:var(--text);margin-top:6px;background:var(--bg);padding:8px;border-radius:8px">💬 ' + escHtml(app.reason) + '</div>' : ''}
      </div>
      <div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0">
        <button onclick="approveClubApp(${app.id}, ${_currentClubId})" style="padding:6px 14px;border-radius:8px;background:#2ECC71;color:#fff;border:none;font-size:13px;cursor:pointer;white-space:nowrap">✓ 通过</button>
        <button onclick="rejectClubApp(${app.id}, ${_currentClubId})" style="padding:6px 14px;border-radius:8px;background:#E74C3C;color:#fff;border:none;font-size:13px;cursor:pointer;white-space:nowrap">✕ 拒绝</button>
      </div>
    </div>
  `).join('');
}

function renderClubMembersManage(c) {
  return _clubManageMembers.map(m => {
    const phone = (currentUser && currentUser.phone) || '';
    const isMe = m.phone === phone;
    let actions = '';
    if (m.role !== 'owner' && !isMe) {
      actions = `
        <button onclick="kickClubMember(${_currentClubId}, '${m.phone}')" style="padding:4px 10px;border-radius:6px;background:#E74C3C;color:#fff;border:none;font-size:12px;cursor:pointer">踢出</button>
      `;
      // 社长可以升降管理员
      if (currentUser && c.members.some(x => x.phone === phone && x.role === 'owner')) {
        if (m.role === 'admin') {
          actions += `<button onclick="setMemberRole(${_currentClubId}, '${m.phone}', 'member')" style="padding:4px 10px;border-radius:6px;background:#F39C12;color:#fff;border:none;font-size:12px;cursor:pointer;margin-left:4px">降级</button>`;
        } else {
          actions += `<button onclick="setMemberRole(${_currentClubId}, '${m.phone}', 'admin')" style="padding:4px 10px;border-radius:6px;background:#3498DB;color:#fff;border:none;font-size:12px;cursor:pointer;margin-left:4px">设为管理</button>`;
        }
      }
    }
    const roleLabel = m.role === 'owner' ? '👑 社长' : m.role === 'admin' ? '⭐ 管理员' : '成员';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div>
        <span style="font-size:14px;font-weight:500">${escHtml(m.name || m.phone)}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${roleLabel}</span>
        ${isMe ? '<span style="font-size:11px;color:var(--text-muted);margin-left:4px">(我)</span>' : ''}
      </div>
      <div>${actions}</div>
    </div>`;
  }).join('');
}

async function approveClubApp(appId, clubId) {
  try {
    const res = await API.approveClubApplication(clubId, appId);
    if (res.error) return showToast(res.error);
    showToast('已通过申请');
    showClubManagePanel();
  } catch(e) { showToast(e.message || '操作失败'); }
}

async function rejectClubApp(appId, clubId) {
  if (!confirm('确定拒绝该申请？')) return;
  try {
    const res = await API.rejectClubApplication(clubId, appId);
    if (res.error) return showToast(res.error);
    showToast('已拒绝');
    showClubManagePanel();
  } catch(e) { showToast(e.message || '操作失败'); }
}

async function kickClubMember(clubId, phone) {
  if (!confirm('确定踢出该成员？')) return;
  try {
    const res = await API.kickClubMember(clubId, phone);
    if (res.error) return showToast(res.error);
    showToast('已踢出');
    showClubManagePanel();
  } catch(e) { showToast(e.message || '操作失败'); }
}

async function setMemberRole(clubId, phone, role) {
  const label = role === 'admin' ? '设为管理员' : '降为普通成员';
  if (!confirm(`确定${label}？`)) return;
  try {
    const res = await API.updateMemberRole(clubId, phone, role);
    if (res.error) return showToast(res.error);
    showToast('已更新');
    showClubManagePanel();
  } catch(e) { showToast(e.message || '操作失败'); }
}

// ─── 社团设置面板 ──────────────────────────────────────
async function loadClubStats() {
  try {
    _clubManageStats = await API.getClubStats(_currentClubId);
  } catch(e) { _clubManageStats = { member_count: 0, post_count: 0, activity_count: 0, pending_apps: 0, today_new: 0, week_new: 0 }; }
}

function renderClubSettings(c) {
  const stats = _clubManageStats || {};
  const statsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--gradient-start)">${stats.member_count || 0}</div>
        <div style="font-size:11px;color:var(--text-muted)">成员总数</div>
      </div>
      <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#2ECC71">${stats.post_count || 0}</div>
        <div style="font-size:11px;color:var(--text-muted)">公告数</div>
      </div>
      <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#3498DB">${stats.activity_count || 0}</div>
        <div style="font-size:11px;color:var(--text-muted)">活动数</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <div style="flex:1;background:var(--bg);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:600;color:#F39C12">${stats.pending_apps || 0}</div>
        <div style="font-size:11px;color:var(--text-muted)">待审批</div>
      </div>
      <div style="flex:1;background:var(--bg);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:600">+${stats.today_new || 0}</div>
        <div style="font-size:11px;color:var(--text-muted)">今日新增</div>
      </div>
      <div style="flex:1;background:var(--bg);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:600">+${stats.week_new || 0}</div>
        <div style="font-size:11px;color:var(--text-muted)">本周新增</div>
      </div>
    </div>
  `;

  const actionsHtml = `
    <div class="discover-detail-section-title">社团信息</div>
    <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:12px">
      <div class="discover-detail-row"><span>社团名称</span><span>${escHtml(c.name)}</span></div>
      <div class="discover-detail-row"><span>分类</span><span>${escHtml(c.category || '未设置')}</span></div>
      <div class="discover-detail-row"><span>创建时间</span><span>${fmtTime(c.created_at)}</span></div>
    </div>
    <button onclick="openEditClubModal()" style="width:100%;padding:12px;border-radius:10px;background:var(--gradient);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px">✏️ 编辑社团信息</button>
    <button onclick="toggleClubRecruitment()" style="width:100%;padding:12px;border-radius:10px;background:${c.recruitment_open ? '#2ECC71' : '#E74C3C'};color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px">${c.recruitment_open ? '🔒 关闭招新' : '🔓 开启招新'}</button>
    <div class="discover-detail-section-title" style="margin-top:16px">危险操作</div>
    <button onclick="transferClubOwner()" style="width:100%;padding:12px;border-radius:10px;background:#F39C12;color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px">🔄 转让社长</button>
    <button onclick="dissolveClub()" style="width:100%;padding:12px;border-radius:10px;background:#E74C3C;color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer">💀 解散社团</button>
  `;

  return statsHtml + actionsHtml;
}

// ─── 编辑社团信息弹窗 ──────────────────────────────────
function openEditClubModal() {
  openSubPage('clubEditPage_sub');
}
function closeEditClubModal() {
  closeSubPage('clubEditPage_sub');
}
async function submitEditClub() {
  const nameEl = document.getElementById('clubEditName');
  const catEl = document.getElementById('clubEditCategory');
  const descEl = document.getElementById('clubEditDesc');
  const logoEl = document.getElementById('clubEditLogo');
  const data = {};
  if (nameEl && nameEl.value.trim()) data.name = nameEl.value.trim();
  if (catEl && catEl.value) data.category = catEl.value;
  if (descEl) data.description = descEl.value;
  const file = logoEl && logoEl.files.length > 0 ? logoEl.files[0] : null;
  if (!data.name && !data.category && data.description === undefined && !file) return showToast('没有需要更新的内容');
  try {
    const res = await API.updateClub(_currentClubId, data, file);
    if (res.error) return showToast(res.error);
    showToast('更新成功');
    closeEditClubModal();
    showClubManagePanel();
  } catch(e) { showToast(e.message || '更新失败'); }
}

// ─── 转让社长 ─────────────────────────────────────────
function transferClubOwner() {
  if (!_clubManageMembers || _clubManageMembers.length < 2) return showToast('没有其他成员可转让');
  const others = _clubManageMembers.filter(m => m.phone !== (currentUser && currentUser.phone));
  if (others.length === 0) return showToast('没有其他成员可转让');
  // 弹窗选择转让对象
  const modal = document.getElementById('clubTransferModal');
  if (!modal) return;
  const list = document.getElementById('clubTransferList');
  if (list) {
    list.innerHTML = others.map(m => `
      <div onclick="confirmTransferClub('${m.phone}')" style="padding:12px;border-radius:10px;background:var(--bg);margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:8px">
        <span style="font-size:15px;font-weight:500">${escHtml(m.name || m.phone)}</span>
        <span style="font-size:12px;color:var(--text-muted)">${m.role === 'admin' ? '⭐ 管理员' : '成员'}</span>
      </div>
    `).join('');
  }
  openSubPage('clubTransferPage_sub');
}
function closeClubTransferModal() {
  closeSubPage('clubTransferPage_sub');
}
async function confirmTransferClub(targetPhone) {
  if (!confirm('转让后你将变为普通成员，确定继续？')) return;
  try {
    const res = await API.transferClub(_currentClubId, targetPhone);
    if (res.error) return showToast(res.error);
    showToast('转让成功');
    closeClubTransferModal();
    closeSubPage('clubManageSub');
    showClubDetail(_currentClubId);
    loadDiscoverClubs();
  } catch(e) { showToast(e.message || '转让失败'); }
}

// ─── 解散社团 ─────────────────────────────────────────
async function dissolveClub() {
  const clubName = document.querySelector('#clubManageContent .discover-detail-row span:last-child');
  if (!confirm('确定解散该社团？此操作不可恢复！\n\n所有成员、公告、活动将被清除。')) return;
  if (!confirm('再次确认：真的要解散吗？')) return;
  try {
    const res = await API.dissolveClub(_currentClubId);
    if (res.error) return showToast(res.error);
    showToast('社团已解散');
    closeSubPage('clubManageSub');
    closeSubPage('discoverDetail_sub');
    loadDiscoverClubs();
  } catch(e) { showToast(e.message || '操作失败'); }
}

// ══════ 招新开关 ══════
async function toggleClubRecruitment() {
  try {
    const c = _currentClubDetail;
    if (!c) return;
    const newState = c.recruitment_open ? 0 : 1;
    const label = c.recruitment_open ? '关闭招新' : '开启招新';
    if (!confirm('确定' + label + '？')) return;
    const res = await API.toggleClubRecruitment(_currentClubId, newState);
    if (res.error) return showToast(res.error);
    showToast(res.message || (label + '成功'));
    // 刷新本地数据
    c.recruitment_open = newState;
    showClubManagePanel();
  } catch(e) { showToast(e.message || '操作失败'); }
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
  const promoFile = form.actPromoPhoto.files[0];
  const qrFile = form.actQrCode.files[0];

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
    const res = await API.createActivity(data, coverFile || null, promoFile || null, qrFile || null);
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
  openSubPage('createClubPage_sub');
}

function closeCreateClubModal() {
  closeSubPage('createClubPage_sub');
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
  window.applyJoinClub = applyJoinClub;
  window.closeClubApplyModal = closeClubApplyModal;
  window.submitClubApply = submitClubApply;
  window.leaveClub = leaveClub;
  window.openClubPostModal = openClubPostModal;
  window.closeClubPostModal = closeClubPostModal;
  window.submitClubPost = submitClubPost;
  window.deleteClubPost = deleteClubPost;
  window.filterActCategory = filterActCategory;
  window.filterClubCategory = filterClubCategory;
  window.openCreateActivityModal = openCreateActivityModal;
  window.closeCreateActivityModal = closeCreateActivityModal;
  window.submitCreateActivity = submitCreateActivity;
  window.openCreateClubModal = openCreateClubModal;
  window.closeCreateClubModal = closeCreateClubModal;
  window.submitCreateClub = submitCreateClub;
  window.showClubManagePanel = showClubManagePanel;
  window.switchClubManageTab = switchClubManageTab;
  window.approveClubApp = approveClubApp;
  window.rejectClubApp = rejectClubApp;
  window.kickClubMember = kickClubMember;
  window.setMemberRole = setMemberRole;
  window.openEditClubModal = openEditClubModal;
  window.closeEditClubModal = closeEditClubModal;
  window.submitEditClub = submitEditClub;
  window.transferClubOwner = transferClubOwner;
  window.closeClubTransferModal = closeClubTransferModal;
  window.confirmTransferClub = confirmTransferClub;
  window.dissolveClub = dissolveClub;
  window.toggleActView = toggleActView;
  window.calendarPrevMonth = calendarPrevMonth;
  window.calendarNextMonth = calendarNextMonth;
  window.calendarSelectDate = calendarSelectDate;
  window.onClubSortChange = onClubSortChange;
  window.toggleClubRanking = toggleClubRanking;
  window.initDiscoverPage = initDiscoverPage;
  // 社团时间线+社交
  window.toggleClubPostLike = toggleClubPostLike;
  window.toggleClubPostComments = toggleClubPostComments;
  window.submitClubComment = submitClubComment;
  window.deleteClubComment = deleteClubComment;
  window.toggleClubRecruitment = toggleClubRecruitment;
  window._clubReplySet = _clubReplySet;
  window._clubReplyClear = _clubReplyClear;
window.loadMyClubs = loadMyClubs;

  

  // ═══ 社团子页面（融合版） ═══
// 打开社团子页面
  function openClubPage() {
    document.getElementById('clubPage_sub').classList.add('active');
    loadClubPage();
    switchClubTab('my');
  }
  window.openClubPage = openClubPage;

  var _clubPageCategory = '';
  var _clubPageRankingOpen = false;

  // Tab切换
  function switchClubTab(tab) {
    // 更新tab样式
    document.querySelectorAll('#clubPage_sub .club-tab').forEach(function(t) {
      if (t.dataset.tab === tab) {
        t.style.background = 'var(--card)';
        t.style.color = '#e91e63';
        t.style.fontWeight = '600';
        t.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      } else {
        t.style.background = 'transparent';
        t.style.color = 'var(--text-muted)';
        t.style.fontWeight = '500';
        t.style.boxShadow = 'none';
      }
    });
    // 切换面板
    document.querySelectorAll('#clubPage_sub .club-tab-panel').forEach(function(p) {
      p.style.display = 'none';
    });
    var panelMap = { my: 'clubTabMy', activities: 'clubTabActivities', all: 'clubTabAll' };
    var panel = document.getElementById(panelMap[tab]);
    if (panel) panel.style.display = 'block';
    // 触发加载
    if (tab === 'my') loadClubPageMy();
    if (tab === 'activities') loadClubPageActivities();
    if (tab === 'all') loadClubPageList();
  }
  window.switchClubTab = switchClubTab;

  // 加载社团子页面所有内容
  function loadClubPage() {
    // 预加载所有tab内容
    loadClubPageMy();
    loadClubPageActivities();
    loadClubPageList();
  }
  window.loadClubPage = loadClubPage;

  // 我的社团
  function loadClubPageMy() {
    var section = document.getElementById('clubPageMyClubs');
    var list = document.getElementById('clubPageMyList');
    var countEl = document.getElementById('clubPageMyCount');
    var emptyEl = document.getElementById('clubTabMyEmpty');
    if (!section || !list || !currentUser) { if (section) section.style.display = 'none'; if (emptyEl) emptyEl.style.display = 'block'; return; }
    API.getMyClubs().then(function(res) {
      var clubs = (res && res.list) ? res.list : (Array.isArray(res) ? res : []);
      if (!clubs.length) { section.style.display = 'none'; if (emptyEl) emptyEl.style.display = 'block'; return; }
      if (emptyEl) emptyEl.style.display = 'none';
      section.style.display = '';
      if (countEl) countEl.textContent = clubs.length;
      list.innerHTML = clubs.map(function(c) {
        var avatar = c.logo ? '<img src="' + c.logo + '" />' : '🎭';
        var name = escHtml(c.name || '');
        if (name.length > 6) name = name.substring(0, 6) + '…';
        return '<div onclick="showClubDetail(' + c.id + ')" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 12px;border-radius:14px;background:var(--card);cursor:pointer;flex-shrink:0;min-width:72px;border:1px solid var(--border);transition:all 0.15s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(145deg,#fce4ec,#f8bbd0);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:20px">' + avatar + '</div>' +
          '<div style="font-size:12px;font-weight:500;color:var(--text);text-align:center;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted)">' + (c.role === 'owner' ? '👑' : '') + '</div>' +
          '</div>';
      }).join('');
    }).catch(function() { section.style.display = 'none'; });
  }

  // 社团活动横向滚动
  function loadClubPageActivities() {
    var el = document.getElementById('clubPageActivities');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;width:100%">加载中...</div>';
    API.getActivities({ publisher_type: 'club', status: 'open', page: 1, limit: 10 }).then(function(res) {
      var list = Array.isArray(res) ? res : (res && res.list || []);
      if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;width:100%">暂无社团活动</div>'; return; }
      el.innerHTML = list.map(function(a) {
        var title = escHtml(a.title || '');
        if (title.length > 12) title = title.substring(0, 12) + '…';
        var dateStr = a.start_time ? a.start_time.replace('T', ' ').substring(0, 16) : '';
        var coverIcon = a.category === '讲座' ? '🎤' : a.category === '比赛' ? '🏆' : a.category === '演出' ? '🎭' : a.category === '运动' ? '⚽' : a.category === '志愿' ? '🤝' : '📅';
        var coverStyle = a.cover
          ? 'background:url(' + a.cover + ') center/cover'
          : 'background:linear-gradient(135deg,' + (['#667eea,#764ba2','#f12711,#f5af19','#11998e,#38ef7d','#fc4a1a,#f7b733','#4facfe,#00f2fe','#43e97b,#38f9d7'])[a.id % 6] + ');display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff';
        return '<div onclick="showActivityDetail(' + a.id + ')" style="display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:14px;background:var(--card);cursor:pointer;border:1px solid var(--border);transition:all 0.15s" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'translateY(0)\'">' +
          '<div style="height:80px;border-radius:10px;overflow:hidden;' + coverStyle + '">' + (a.cover ? '' : coverIcon) + '</div>' +
          '<div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.3">' + title + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between">' +
            '<span>' + (a.publisher_name ? escHtml(a.publisher_name).substring(0,6) : '社团') + '</span>' +
            '<span>' + (a.current_participants || 0) + '人</span>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--text-muted)">🕐 ' + fmtTime(dateStr) + '</div>' +
        '</div>';
      }).join('');
    }).catch(function() { el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;width:100%">加载失败</div>'; });
  }

  // 推荐社团
  function loadClubPageHot() {
    var el = document.getElementById('clubPageHotList');
    if (!el) return;
    API.getClubs({ page: 1, limit: 6, sort: 'hot' }).then(function(res) {
      var list = Array.isArray(res) ? res : (res && res.list || []);
      if (!list.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">暂无推荐社团</div>'; return; }
      el.innerHTML = list.map(function(c) {
        var avatar = c.logo ? '<img src="' + c.logo + '" />' : '🎭';
        var name = escHtml(c.name || '');
        if (name.length > 5) name = name.substring(0, 5) + '…';
        return '<div onclick="showClubDetail(' + c.id + ')" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 12px;border-radius:14px;background:var(--card);cursor:pointer;flex-shrink:0;min-width:72px;border:1px solid var(--border);transition:all 0.15s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(145deg,#e8eaf6,#c5cae9);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:20px">' + avatar + '</div>' +
          '<div style="font-size:12px;font-weight:500;color:var(--text);text-align:center;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted)">' + (c.member_count || 0) + '人</div>' +
          '</div>';
      }).join('');
    }).catch(function() {});
  }

  // 分类筛选
  function filterClubPageCategory(cat) {
    _clubPageCategory = cat;
    document.querySelectorAll('.club-page-cat').forEach(function(el) {
      el.classList.toggle('active', el.dataset.cat === cat);
    });
    loadClubPageList();
  }
  window.filterClubPageCategory = filterClubPageCategory;

  // 加载社团列表
  function loadClubPageList() {
    var container = document.getElementById('clubPageList');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">加载中...</div>';

    var sortEl = document.getElementById('clubPageSort');
    var params = { page: 1, limit: 20, sort: sortEl ? sortEl.value : 'hot' };
    if (_clubPageCategory) params.category = _clubPageCategory;

    API.getClubs(params).then(function(res) {
      var list = Array.isArray(res) ? res : (res && res.list || []);
      if (!list.length) { container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:14px">🎭 暂无社团</div>'; return; }
      container.innerHTML = list.map(function(c) {
        var badge = c.recruitment_open ? '<span style="background:#E74C3C;color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:4px">🔥招新</span>' : '';
        return '<div class="club-page-club-card" onclick="showClubDetail(' + c.id + ')">' +
          '<div class="club-page-avatar">' + (c.logo ? '<img src="' + c.logo + '" />' : '🎭') + '</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px">' + escHtml(c.name) + badge + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + escHtml(c.category||'其他') + ' · ' + (c.description||'').slice(0, 36) + '</div>' +
          '<div style="font-size:11px;color:var(--text-secondary)">👥 ' + (c.member_count||0) + '人' + (c.activity_count ? ' · 📅 ' + c.activity_count + '活动' : '') + '</div>' +
          '</div></div>';
      }).join('');
    }).catch(function() {
      container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">加载失败</div>';
    });
  }
})();
