// === 校花校草月度选举 - 前端模块 ===

// 状态
let _starMonth = '';
let _starCandidates = [];
let _starViewMode = 'candidates'; // candidates | rank | hall
let _starVotedToday = false;
let _starVotedFor = null;
let _starHasJoined = false;
let _starMyEntry = null;

// ─── 辅助：fetch封装 ─────────────────────────────────────────
async function starFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  if (API._token) options.headers['Authorization'] = 'Bearer ' + API._token;
  if (!options.headers['Content-Type'] && options.method !== 'GET') {
    options.headers['Content-Type'] = 'application/json';
  }
  // FormData不设Content-Type，让浏览器自动加boundary
  if (options.body instanceof FormData) {
    delete options.headers['Content-Type'];
  }
  const r = await fetch(url, options);
  return r.json();
}

// ─── 打开主页面 ───────────────────────────────────────────
function openCampusStar() {
  _starViewMode = 'candidates';
  openSubPage('campusStarPage_sub');
  refreshStarStatus();
  loadStarCandidates();
}

// ─── 刷新我的状态 ────────────────────────────────────────
async function refreshStarStatus() {
  try {
    const r = await starFetch('/api/campus-star/my-status');
    if (r.ok) {
      _starVotedToday = r.votedToday;
      _starVotedFor = r.votedFor;
      _starHasJoined = r.hasJoined;
      _starMyEntry = r.myEntry;
      updateStarActionBar();
    }
  } catch(e) { /* 未登录忽略 */ }
}

// ─── 加载候选人列表 ───────────────────────────────────────
async function loadStarCandidates(month) {
  try {
    const m = month || '';
    const r = await starFetch('/api/campus-star/candidates?month=' + m);
    if (r.ok) {
      _starMonth = r.month;
      _starCandidates = r.candidates || [];
      renderStarCandidates();
    }
  } catch(e) {
    console.error('加载候选人失败:', e);
    showToast('加载失败，请重试');
  }
}

// ─── 渲染候选人卡片 ───────────────────────────────────────
function renderStarCandidates() {
  const container = document.getElementById('starCandidatesList');
  if (!container) return;

  if (_starCandidates.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:12px">🌸</div><div style="font-size:15px;font-weight:600">本月还没有人报名</div><div style="font-size:13px;margin-top:4px">快来成为第一个参赛者吧！</div></div>';
    return;
  }

  let html = '';
  _starCandidates.forEach((c, idx) => {
    const photos = (c.photos || '').split(',').filter(Boolean);
    const coverImg = photos[0] || '';

    html += '<div class="star-card" onclick="showStarDetail(' + c.id + ')" style="background:var(--card-bg);border-radius:16px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,0.06);cursor:pointer;transition:all 0.2s">'
      + '<div style="position:relative;height:240px;overflow:hidden;background:linear-gradient(135deg,#fce4ec,#f3e5f5)">'
      + (coverImg ? '<img src="' + coverImg + '" alt="' + escHtml(c.name) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' : '')
      + '<div style="' + (coverImg ? 'display:none' : 'display:flex') + ';width:100%;height:100%;align-items:center;justify-content:center;font-size:64px">🌸</div>'
      + '<div style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.5);color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;backdrop-filter:blur(4px)">#' + (idx + 1) + '</div>'
      + '<div style="position:absolute;top:12px;right:12px;background:rgba(255,107,43,0.9);color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px">❤️ ' + (c.votes || 0) + '</div>'
      + '</div><div style="padding:14px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
      + '<span style="font-size:17px;font-weight:700;color:var(--text)">' + escHtml(c.name) + '</span>'
      + (_starVotedFor == c.id ? '<span style="font-size:11px;background:#FF6B2B10;color:#FF6B2B;padding:2px 8px;border-radius:10px">已投</span>' : '')
      + '</div>'
      + '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + escHtml(c.intro || '') + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">'
      + '<span style="font-size:12px;color:var(--text-muted)">今日获票 ' + (c.today_votes || 0) + '</span>'
      + '<button onclick="event.stopPropagation();starVote(' + c.id + ',\'' + escHtml(c.name).replace(/'/g, "\\'") + '\')" style="padding:8px 20px;border-radius:20px;background:' + (_starVotedToday ? 'var(--bg)' : 'linear-gradient(135deg,#FF6B2B,#ff9a56)') + ';color:' + (_starVotedToday ? 'var(--text-muted)' : '#fff') + ';border:' + (_starVotedToday ? '1px solid var(--border)' : 'none') + ';font-size:13px;font-weight:600;cursor:' + (_starVotedToday ? 'default' : 'pointer') + '"' + (_starVotedToday ? ' disabled' : '') + '>'
      + (_starVotedToday ? '今日已投' : '🗳 投一票')
      + '</button></div></div></div>';
  });

  container.innerHTML = html;
}

// ─── 查看候选人详情 ───────────────────────────────────────
async function showStarDetail(id) {
  try {
    const r = await starFetch('/api/campus-star/candidate/' + id);
    if (!r.ok) return showToast('候选人不存在');
    const c = r.candidate;
    const photos = (c.photos || '').split(',').filter(Boolean);

    let photosHtml = '';
    photos.forEach(function(p) {
      photosHtml += '<img src="' + p + '" alt="照片" style="width:100%;border-radius:12px;margin-bottom:8px" onerror="this.style.display=\'none\'" />';
    });

    var votedDisabled = _starVotedToday ? ' disabled' : '';
    var votedStyle = _starVotedToday
      ? 'background:var(--bg);color:var(--text-muted);border:1px solid var(--border);cursor:default'
      : 'background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;border:none;cursor:pointer';
    var votedText = _starVotedToday ? '今日已投票 ✅' : '🗳 给TA投票';

    var content = '<div style="padding:0 16px 100px">'
      + photosHtml
      + '<div style="font-size:20px;font-weight:700;margin:12px 0 4px">' + escHtml(c.name) + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
      + '<span style="font-size:14px;color:var(--text-secondary)">❤️ ' + (c.votes || 0) + ' 票</span>'
      + '<span style="font-size:12px;color:var(--text-muted)">' + escHtml(c.month) + '</span>'
      + '</div>'
      + '<div style="background:var(--card-bg);border-radius:12px;padding:14px;margin-bottom:12px">'
      + '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6">' + escHtml(c.intro || '这个人很神秘，没有写介绍~') + '</div>'
      + '</div>'
      + '<button onclick="starVote(' + c.id + ',\'' + escHtml(c.name).replace(/'/g, "\\'") + '\')" style="width:100%;padding:14px;border-radius:14px;' + votedStyle + ';font-size:16px;font-weight:700"' + votedDisabled + '>'
      + votedText + '</button>'
      + '</div>';

    document.getElementById('starDetailTitle').textContent = c.name;
    document.getElementById('starDetailBody').innerHTML = content;
    openSubPage('starDetailPage_sub');
  } catch(e) {
    showToast('加载失败');
  }
}

// ─── 投票 ─────────────────────────────────────────────────
async function starVote(candidateId, name) {
  if (_starVotedToday) {
    showToast('你今天已经投过票了，明天再来吧！');
    return;
  }

  try {
    const r = await starFetch('/api/campus-star/vote', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId })
    });
    if (r.error) return showToast(r.error);

    _starVotedToday = true;
    _starVotedFor = candidateId;
    showToast('🎉 投票成功！');

    await refreshStarStatus();
    loadStarCandidates();

    // 如果在详情页也刷新
    if (document.getElementById('starDetailBody').innerHTML) {
      showStarDetail(candidateId);
    }
  } catch(e) {
    showToast('投票失败，请重试');
  }
}

// ─── 打开报名弹窗 ─────────────────────────────────────────
function openStarJoin() {
  if (_starHasJoined) {
    showToast('你本月已经报名过了~');
    return;
  }
  document.getElementById('starJoinModal').style.display = 'flex';
}

function closeStarJoin() {
  document.getElementById('starJoinModal').style.display = 'none';
  document.getElementById('starJoinName').value = '';
  document.getElementById('starJoinIntro').value = '';
  document.getElementById('starJoinPhotos').value = '';
  var preview = document.getElementById('starJoinPreview');
  if (preview) preview.innerHTML = '';
}

// ─── 照片预览 ────────────────────────────────────────────
function previewStarPhotos(input) {
  var preview = document.getElementById('starJoinPreview');
  if (!preview || !input.files) return;

  var html = '';
  for (var i = 0; i < Math.min(input.files.length, 3); i++) {
    var url = URL.createObjectURL(input.files[i]);
    html += '<img src="' + url + '" style="width:72px;height:72px;border-radius:10px;object-fit:cover" />';
  }
  preview.innerHTML = html;
}

// ─── 提交报名 ────────────────────────────────────────────
async function submitStarJoin() {
  var name = document.getElementById('starJoinName').value.trim();
  var intro = document.getElementById('starJoinIntro').value.trim();
  var photoInput = document.getElementById('starJoinPhotos');
  var files = photoInput.files;

  if (!name) return showToast('请填写你的名字');
  if (!intro) return showToast('请填写自我介绍');
  if (!files || files.length === 0) return showToast('请至少上传1张照片');

  var formData = new FormData();
  formData.append('name', name);
  formData.append('intro', intro);
  for (var i = 0; i < Math.min(files.length, 3); i++) {
    formData.append('photos', files[i]);
  }

  try {
    var r = await starFetch('/api/campus-star/join', {
      method: 'POST',
      body: formData
    });
    if (r.error) return showToast(r.error);

    _starHasJoined = true;
    closeStarJoin();
    showToast('🌸 报名成功！');
    loadStarCandidates();
  } catch(e) {
    showToast('报名失败，请重试');
  }
}

// ─── 切换到排行榜 ─────────────────────────────────────────
async function switchToRank() {
  _starViewMode = 'rank';
  updateStarTabs();

  try {
    var r = await starFetch('/api/campus-star/rank?top=20');
    var container = document.getElementById('starCandidatesList');
    if (!container) return;

    if (!r.rank || r.rank.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:12px">🏆</div><div style="font-size:15px">暂无排行数据</div></div>';
      return;
    }

    var medals = ['🥇', '🥈', '🥉'];
    var html = '<div style="padding:0 0 20px">';
    r.rank.forEach(function(item, idx) {
      var rankIcon;
      if (idx < 3) {
        rankIcon = '<span style="font-size:28px">' + medals[idx] + '</span>';
      } else {
        rankIcon = '<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--bg);color:var(--text-secondary);font-weight:700;font-size:14px">' + (idx + 1) + '</span>';
      }
      var photos = (item.photos || '').split(',').filter(Boolean);
      var coverImg = photos[0] || '';

      html += '<div class="star-card" onclick="showStarDetail(' + item.id + ')" style="display:flex;align-items:center;gap:12px;background:var(--card-bg);border-radius:14px;padding:12px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer">'
        + '<div style="flex-shrink:0">' + rankIcon + '</div>'
        + '<div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#fce4ec,#f3e5f5)">'
        + (coverImg ? '<img src="' + coverImg + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">🌸</div>')
        + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(item.name) + '</div>'
        + '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(item.intro || '') + '</div>'
        + '</div>'
        + '<div style="flex-shrink:0;text-align:center">'
        + '<div style="font-size:18px;font-weight:700;color:#FF6B2B">' + item.votes + '</div>'
        + '<div style="font-size:11px;color:var(--text-muted)">票</div>'
        + '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  } catch(e) {
    showToast('加载排行榜失败');
  }
}

// ─── 切换到荣誉墙 ─────────────────────────────────────────
async function switchToHall() {
  _starViewMode = 'hall';
  updateStarTabs();

  try {
    var r = await starFetch('/api/campus-star/hall?limit=20');
    var container = document.getElementById('starCandidatesList');
    if (!container) return;

    if (!r.hall || r.hall.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:12px">🏅</div><div style="font-size:15px">还没有产生过冠军</div><div style="font-size:13px;margin-top:4px">快来参加成为第一个冠军！</div></div>';
      return;
    }

    var html = '<div style="padding:0 0 20px">';
    r.hall.forEach(function(item) {
      var photos = (item.photos || '').split(',').filter(Boolean);
      var coverImg = photos[0] || '';
      var typeLabel = item.status === 'champion' ? '🏆 月冠军' : '🥈 亚军/季军';

      html += '<div style="background:var(--card-bg);border-radius:16px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">'
        + '<div style="position:relative;height:200px;overflow:hidden;background:linear-gradient(135deg,#fff3e0,#fce4ec)">'
        + (coverImg ? '<img src="' + coverImg + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px">🏆</div>')
        + '<div style="position:absolute;top:12px;left:12px;background:rgba(255,107,43,0.9);color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:10px">' + typeLabel + '</div>'
        + '</div>'
        + '<div style="padding:14px">'
        + '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' + escHtml(item.name) + '</div>'
        + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">' + escHtml(item.month) + ' · ❤️ ' + item.votes + ' 票</div>'
        + '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5">' + escHtml(item.intro || '') + '</div>'
        + '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  } catch(e) {
    showToast('加载荣誉墙失败');
  }
}

// ─── 切回候选人列表 ───────────────────────────────────────
function switchToCandidates() {
  _starViewMode = 'candidates';
  updateStarTabs();
  loadStarCandidates();
}

// ─── 更新Tab样式 ─────────────────────────────────────────
function updateStarTabs() {
  document.querySelectorAll('.star-tab').forEach(function(t) {
    if (t.dataset.tab === _starViewMode) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
}

// ─── 更新操作栏（报名/投票按钮）─────────────────────────
function updateStarActionBar() {
  var joinBtn = document.getElementById('starJoinBtn');
  if (!joinBtn) return;

  if (_starHasJoined) {
    joinBtn.textContent = '✅ 已报名';
    joinBtn.style.opacity = '0.6';
    joinBtn.onclick = function() { showToast('你本月已经报名了~'); };
  } else {
    joinBtn.textContent = '📸 报名参加';
    joinBtn.style.opacity = '1';
    joinBtn.onclick = openStarJoin;
  }
}

// ─── 辅助：HTML转义 ───────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 导出到全局 ──────────────────────────────────────────
window.openCampusStar = openCampusStar;
window.loadStarCandidates = loadStarCandidates;
window.showStarDetail = showStarDetail;
window.starVote = starVote;
window.openStarJoin = openStarJoin;
window.closeStarJoin = closeStarJoin;
window.previewStarPhotos = previewStarPhotos;
window.submitStarJoin = submitStarJoin;
window.switchToRank = switchToRank;
window.switchToHall = switchToHall;
window.switchToCandidates = switchToCandidates;
