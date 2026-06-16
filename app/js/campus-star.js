// === 校花校草月度选举 - 前端模块 ===

// 状态
let _starMonth = '';
let _starCandidates = [];
let _starViewMode = 'candidates'; // candidates | rank | hall
let _starVoteCountToday = 0; // 今日已投人数
let _starVotedFor = []; // 今日已投候选人ID列表
let _starHasJoined = false;
let _starMyEntry = null;
let _starCommentImage = null; // 待上传的评论图片路径
let _starCarouselTimers = []; // 轮播定时器，用于清理

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
  const text = await r.text();
  console.log('[starFetch]', url, r.status, text.slice(0, 200));
  try { return JSON.parse(text); } catch(e) { throw new Error('服务器返回了非JSON响应(status=' + r.status + '): ' + text.slice(0, 100)); }
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
      _starVoteCountToday = r.voteCountToday || 0;
      _starVotedFor = r.votedFor || [];
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

// ─── 渲染候选人卡片（2列网格布局）───────────────────────
function renderStarCandidates() {
  const container = document.getElementById('starCandidatesList');
  if (!container) return;

  if (_starCandidates.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:12px">🌸</div><div style="font-size:15px;font-weight:600">本月还没有人报名</div><div style="font-size:13px;margin-top:4px">快来成为第一个参赛者吧！</div></div>';
    return;
  }

  var remaining = 3 - _starVoteCountToday;
  // 投票状态仅在点击投票按钮时以 Toast 提示，不在页面加载时弹

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  _starCandidates.forEach(function(c, idx) {
    var photos = (c.photos || '').split(',').filter(Boolean);
    var coverImg = photos[0] || '';
    var thumbnails = photos.slice(0, 4);
    var isVoted = _starVotedFor.indexOf(c.id) !== -1;
    var canVote = _starVoteCountToday < 3 && !isVoted;

    // 照片区 - 多图淡入淡出轮播
    var photoArea = '';
    if (thumbnails.length >= 2) {
      var slides = thumbnails.map(function(p, pi) {
        return '<img src="' + p + '" loading="lazy" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:' + (pi===0?1:0) + ';transition:opacity 0.7s ease" />';
      }).join('');
      var dots = thumbnails.map(function(_, pi) {
        return '<span class="sc-dot" style="display:inline-block;width:5px;height:5px;border-radius:50%;margin:0 2px;background:' + (pi===0?'#fff':'rgba(255,255,255,0.4)') + ';transition:background 0.3s"></span>';
      }).join('');
      photoArea = '<div class="star-carousel" data-total="' + thumbnails.length + '" style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#fce4ec,#f3e5f5)">'
        + '<div style="position:relative;width:100%;height:100%">' + slides + '</div>'
        + '<div class="sc-dots" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:3px">' + dots + '</div>'
        + '<button class="sc-prev" onclick="event.stopPropagation();starCarouselStep(this.parentElement,-1)" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,0.35);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s" title="上一张">◀</button>'
        + '<button class="sc-next" onclick="event.stopPropagation();starCarouselStep(this.parentElement,1)" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,0.35);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s" title="下一张">▶</button>'
        + '</div>';
    } else if (coverImg) {
      photoArea = '<div style="aspect-ratio:1;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#fce4ec,#f3e5f5)"><img src="' + coverImg + '" style="width:100%;height:100%;object-fit:cover" /></div>';
    } else {
      photoArea = '<div style="aspect-ratio:1;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#fce4ec,#f3e5f5);display:flex;align-items:center;justify-content:center;font-size:36px">🌸</div>';
    }

    html += '<div class="star-compact-card" onclick="event.stopPropagation();event.stopImmediatePropagation();showStarDetail(' + c.id + ')" style="background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);cursor:pointer;transition:all 0.2s">'
      + '<div style="position:relative">'
      + photoArea
      + '<div style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.45);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px">#' + (idx + 1) + '</div>'
      + '<div style="position:absolute;top:4px;right:4px;background:rgba(255,107,43,0.85);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px">❤️' + (c.votes || 0) + '</div>'
      + '</div>'
      + '<div style="padding:8px 10px 10px">'
      + '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">'
      + '<span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0">' + escHtml(c.name) + '</span>'
      + (isVoted ? '<span style="font-size:9px;background:#FF6B2B12;color:#FF6B2B;padding:1px 5px;border-radius:6px;flex-shrink:0">已投</span>' : '')
      + '</div>'
      + '<div style="font-size:11px;color:var(--text-secondary);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:30px">' + escHtml(c.intro || '') + '</div>'
      + (canVote
        ? '<button onclick="event.stopPropagation();starVote(' + c.id + ',\'' + escHtml(c.name).replace(/'/g, "\\'") + '\')" style="width:100%;margin-top:6px;padding:5px 0;border-radius:10px;background:linear-gradient(135deg,#FF6B2B,#ff9a56);color:#fff;border:none;font-size:11px;font-weight:600;cursor:pointer">🗳 投一票</button>'
        : '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);text-align:center;padding:5px 0;border-radius:10px;background:var(--bg)">' + (isVoted ? '✅ 已投票' : '今日已满') + '</div>')
      + '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
  initStarCarousels();
}

// ─── 初始化照片轮播 ─────────────────────────────────────
function initStarCarousels() {
  // 先清理旧定时器
  _starCarouselTimers.forEach(function(t) { clearInterval(t); });
  _starCarouselTimers = [];

  document.querySelectorAll('.star-carousel').forEach(function(el) {
    if (el._carouselInit) return;
    el._carouselInit = true;

    var total = parseInt(el.getAttribute('data-total')) || 0;
    if (total < 2) return;

    var imgs = el.querySelectorAll('img');
    var dots = el.querySelectorAll('.sc-dot');
    var prevBtn = el.querySelector('.sc-prev');
    var nextBtn = el.querySelector('.sc-next');
    var current = 0;

    // 把状态存到元素上，供 starCarouselStep 使用
    el._scImgs = imgs;
    el._scDots = dots;
    el._scIdx = current;
    el._scTotal = total;

    function goTo(idx) {
      imgs[current].style.opacity = '0';
      if (dots[current]) dots[current].style.background = 'rgba(255,255,255,0.4)';
      current = idx;
      el._scIdx = idx;
      imgs[current].style.opacity = '1';
      if (dots[current]) dots[current].style.background = '#fff';
    }

    function next() {
      goTo((current + 1) % total);
    }

    // 滑入显示按钮
    el.addEventListener('mouseenter', function() {
      if (prevBtn) prevBtn.style.opacity = '1';
      if (nextBtn) nextBtn.style.opacity = '1';
    });
    el.addEventListener('mouseleave', function() {
      if (prevBtn) prevBtn.style.opacity = '0';
      if (nextBtn) nextBtn.style.opacity = '0';
    });

    var timer = setInterval(next, 3000);
    _starCarouselTimers.push(timer);
  });
}

// ─── 轮播手动切图（按钮调用） ─────────────────────────────
function starCarouselStep(el, dir) {
  if (!el || !el._scImgs) return;
  var imgs = el._scImgs;
  var dots = el._scDots;
  var total = el._scTotal;
  var current = el._scIdx;

  // 淡出当前
  imgs[current].style.opacity = '0';
  if (dots[current]) dots[current].style.background = 'rgba(255,255,255,0.4)';

  // 计算新索引
  var newIdx = ((current + dir) % total + total) % total;
  el._scIdx = newIdx;

  // 淡入新图
  imgs[newIdx].style.opacity = '1';
  if (dots[newIdx]) dots[newIdx].style.background = '#fff';

  // 重置自动播放定时器
  if (el._scTimer) clearInterval(el._scTimer);
  var timer = setInterval(function() {
    starCarouselStep(el, 1);
  }, 3000);
  el._scTimer = timer;

  // 清理旧定时器引用
  var oldIdx = _starCarouselTimers.indexOf(el._scTimer);
  if (oldIdx !== -1) _starCarouselTimers.splice(oldIdx, 1);
  _starCarouselTimers.push(timer);
}
window.starCarouselStep = starCarouselStep;

// ─── 查看候选人详情 ───────────────────────────────────────
// ─── 当前正在打开的详情，防止双击并发 ──────────────────
let _showStarDetailLock = null;

async function showStarDetail(id) {
  // 防止双击/重复调用
  if (_showStarDetailLock === id) return;
  _showStarDetailLock = id;
  try {
    const r = await starFetch('/api/campus-star/candidate/' + id);
    if (!r.ok) return showToast('候选人不存在');
    const c = r.candidate;
    const photos = (c.photos || '').split(',').filter(Boolean);

    // 获取用户个人资料头像和封面
    let userProfile = {};
    try {
      const uRes = await starFetch('/api/users/' + c.phone);
      if (uRes && !uRes.error) userProfile = uRes;
    } catch(e) {}

    const isMine = _starMyEntry && _starMyEntry.id === c.id;
    const isVoted = _starVotedFor.indexOf(c.id) !== -1;
    const canVote = _starVoteCountToday < 3 && !isVoted;

    // 存储照片数组供查看器使用
    _starDetailPhotos = photos;

    // 照片画廊 - 横向滚动
    var photosHtml = '<div class="star-gallery-scroll" style="display:flex;gap:8px;overflow-x:auto;padding:0 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
    photos.forEach(function(p, pi) {
      photosHtml += '<div style="flex-shrink:0;width:160px;height:160px;border-radius:12px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1)" onclick="event.stopPropagation();openStarPhotoViewerDet(' + pi + ')">'
        + '<img src="' + p + '" alt="照片' + (pi+1) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy" />'
        + '</div>';
    });
    if (photos.length === 0) {
      photosHtml += '<div style="width:100%;height:160px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fce4ec,#f3e5f5);border-radius:12px;color:var(--text-muted);font-size:14px">暂无照片</div>';
    }
    photosHtml += '</div>';

    // 封面背景 - 优先使用个人资料封面
    var coverStyle = '';
    var userCover = userProfile.bg_image || userProfile.bgImage || '';
    if (userCover) {
      coverStyle = 'background:url(' + userCover + ');background-size:cover;background-position:center';
    } else if (photos[0]) {
      coverStyle = 'background:url(' + photos[0] + ');background-size:cover;background-position:center';
    } else {
      coverStyle = 'background:linear-gradient(145deg,#e91e63,#ff6f91,#ec407a)';
    }

    // 投票按钮
    var voteBtnHtml = '';
    var btnBase = 'display:block;width:100%;padding:14px 20px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;border:none;text-align:center;transition:all 0.2s;white-space:nowrap;letter-spacing:0.5px';
    if (isVoted) {
      voteBtnHtml = '<button style="' + btnBase + ';background:#f5f5f5;color:#aaa;box-shadow:inset 0 1px 3px rgba(0,0,0,0.04);cursor:default" disabled>✅ 已投票</button>';
    } else if (!canVote) {
      voteBtnHtml = '<button style="' + btnBase + ';background:#f5f5f5;color:#bbb;box-shadow:inset 0 1px 3px rgba(0,0,0,0.04);cursor:default" disabled>📭 今日3票已满</button>';
    } else {
      voteBtnHtml = '<button onclick="starVote(' + c.id + ',\'' + escHtml(c.name).replace(/'/g, "\\'") + '\')" style="' + btnBase + ';background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;box-shadow:0 4px 18px rgba(233,30,99,0.35)" onmouseover="this.style.transform=&apos;translateY(-1px)&apos;;this.style.boxShadow=&apos;0 6px 22px rgba(233,30,99,0.45)&apos;" onmouseout="this.style.transform=&apos;translateY(0)&apos;;this.style.boxShadow=&apos;0 4px 18px rgba(233,30,99,0.35)&apos;">❤️ 给TA投票</button>';
    }

    var content = ''
      // ═══ 封面区 - 与校园墙 showWallUser 完全一致的封面风格 ═══
      + '<div style="border-radius:16px;margin-bottom:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">'
      // 封面banner - 使用照片作背景
      + '<div style="position:relative;text-align:center;padding:28px 16px 20px;' + coverStyle + '">'
      // 头像 - 优先使用个人资料头像
      + '<div style="position:relative;z-index:1;width:64px;height:64px;border-radius:50%;overflow:hidden;margin:0 auto 10px;border:3px solid rgba(255,255,255,0.6);box-shadow:0 2px 8px rgba(0,0,0,0.2)">'
      + (userProfile.avatar ? '<img src="' + userProfile.avatar + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />' : (photos[0] ? '<img src="' + photos[0] + '" style="width:100%;height:100%;object-fit:cover" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;font-weight:700">' + (c.name||'🌸')[0] + '</div>'))
      + '</div>'
      // 名字
      + '<div style="position:relative;z-index:1;font-size:18px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.3)">' + escHtml(c.name) + '</div>'
      // 标签行：票数 + 今日投票
      + '<div style="position:relative;z-index:1;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap">'
      + '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.2);padding:3px 10px;border-radius:12px;font-size:12px;color:rgba(255,255,255,0.95);font-weight:600">❤️ ' + (c.votes || 0) + ' 票</span>'
      + '</div>'
      + '</div>'
      + '</div>'
      // 内容区
      + '<div style="padding:16px">'
      // ═══ 照片画廊 ═══
      + '<div style="margin-bottom:18px">'
      + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:6px">📷 <span>照片</span><span style="background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;font-size:11px;padding:1px 8px;border-radius:10px;font-weight:600">' + photos.length + '张</span></div>'
      + photosHtml
      + '</div>'
      // ═══ 介绍区 - 卡片增强 ═══
      + '<div style="background:var(--card);border-radius:16px;padding:16px 18px;margin-bottom:18px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-left:3px solid #e91e63">'
      + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;gap:6px">💬 <span>自我介绍</span></div>'
      + '<div style="font-size:14px;color:var(--text-secondary);line-height:1.7">' + escHtml(c.intro || '这个人很神秘，没有写介绍~') + '</div>'
      + '</div>'
      // ═══ 操作栏：主按钮 + 辅助操作 ═══
      + '<div style="background:var(--card);border-radius:16px;padding:14px 16px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04)">'
      // 主投票按钮 - 全宽突出
      + '<div style="margin-bottom:12px">' + voteBtnHtml + '</div>'
      // 辅助操作行 - 票数 + 分享/删除/举报
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      // 左侧：票数
      + '<div style="display:flex;align-items:center;gap:5px">'
      + '<span style="font-size:20px">❤️</span>'
      + '<span style="font-size:16px;font-weight:800;color:#e91e63">' + (c.votes || 0) + '</span>'
      + '<span style="font-size:12px;color:var(--text-muted);font-weight:500">票</span>'
      + '</div>'
      // 右侧：操作按钮组
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<button onclick="shareStarCandidate(' + c.id + ')" style="display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:20px;border:1.5px solid #e0e0e0;background:#fff;color:#666;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;white-space:nowrap" onmouseover="this.style.background=&apos;#f8f8f8&apos;;this.style.borderColor=&apos;#bbb&apos;" onmouseout="this.style.background=&apos;#fff&apos;;this.style.borderColor=&apos;#e0e0e0&apos;">📤 分享</button>'
      + (isMine ? '<button onclick="deleteStarEntry(' + c.id + ')" style="display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:20px;border:1.5px solid #fcc;background:#fff;color:#E74C3C;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;white-space:nowrap" onmouseover="this.style.background=&apos;#fef0f0&apos;;this.style.borderColor=&apos;#E74C3C&apos;" onmouseout="this.style.background=&apos;#fff&apos;;this.style.borderColor=&apos;#fcc&apos;">🗑 删除</button>' : '')
      + '<button onclick="reportStarCandidate(' + c.id + ')" style="display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:20px;border:1.5px solid #e0e0e0;background:#fff;color:#999;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;white-space:nowrap" onmouseover="this.style.background=&apos;#f8f8f8&apos;;this.style.borderColor=&apos;#bbb&apos;" onmouseout="this.style.background=&apos;#fff&apos;;this.style.borderColor=&apos;#e0e0e0&apos;">🚫 举报</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      // ═══ 评论区域 - 大幅增强显示 ═══
      + '<div style="margin-top:8px">'
      // 评论标题栏
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 14px;background:linear-gradient(135deg,rgba(233,30,99,0.06),rgba(255,111,145,0.06));border-radius:12px;border:1px solid rgba(233,30,99,0.1)">'
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:17px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px">💬 <span>评论</span></span>'
      + (c.comment_count ? '<span id="starCommentBadge" style="background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;min-width:22px;text-align:center">' + c.comment_count + '</span>' : '')
      + '</div>'
      + '<span style="font-size:12px;color:var(--text-muted);cursor:pointer" onclick="loadStarComments(' + c.id + ')">🔄 刷新</span>'
      + '</div>'
      + '<div id="starCommentsList" style="margin-bottom:12px"><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">加载中...</div></div>'
            // ═══ 评论输入区 - 固定底部工具栏 ═══
      + '<div style="display:flex;align-items:center;gap:8px;padding:12px 4px;margin-top:10px;background:var(--card);border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid var(--border)">'
      + '<button onclick="toggleStarEmoji()" style="width:38px;height:38px;border-radius:12px;border:1.5px solid var(--border);background:linear-gradient(135deg,#fff5f7,#fce4ec);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s" title="表情" onmouseover="this.borderColor=&apos;#e91e63&apos;;this.style.transform=&apos;scale(1.06)&apos;" onmouseout="this.borderColor=&apos;var(--border)&apos;;this.style.transform=&apos;scale(1)&apos;">😀</button>'
      + '<label for="starCommentImageInput" style="width:38px;height:38px;border-radius:12px;border:1.5px solid var(--border);background:linear-gradient(135deg,#fff5f7,#fce4ec);font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s" title="上传图片" onmouseover="this.borderColor=&apos;#e91e63&apos;;this.style.transform=&apos;scale(1.06)&apos;" onmouseout="this.borderColor=&apos;var(--border)&apos;;this.style.transform=&apos;scale(1)&apos;">📷</label>'
      + '<input type="file" id="starCommentImageInput" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="uploadStarCommentImage(this)" />'
      + '<input id="starCommentInput" type="text" placeholder="写下你的评论..." style="flex:1;padding:10px 16px;border-radius:14px;border:1.5px solid var(--border);background:var(--bg);font-size:14px;color:var(--text);outline:none;min-width:0;transition:all 0.2s" maxlength="500" onfocus="this.borderColor=&apos;#e91e63&apos;;this.style.boxShadow=&apos;0 0 0 3px rgba(233,30,99,0.1)&apos;" onblur="this.borderColor=&apos;var(--border)&apos;;this.style.boxShadow=&apos;none&apos;" />'
      + '<button onclick="submitStarComment(' + c.id + ')" style="padding:9px 20px;border-radius:14px;background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;box-shadow:0 3px 12px rgba(233,30,99,0.3);transition:all 0.2s" onmouseover="this.style.transform=&apos;scale(1.04)&apos;;this.style.boxShadow=&apos;0 5px 18px rgba(233,30,99,0.45)&apos;" onmouseout="this.style.transform=&apos;scale(1)&apos;;this.style.boxShadow=&apos;0 3px 12px rgba(233,30,99,0.3)&apos;">发送 ✨</button>'
      + '</div>' + '</div>'
      // 表情面板
      + '<div id="starEmojiPanel" style="display:none;flex-wrap:wrap;gap:6px;padding:8px 0 4px"></div>'
      // 图片预览
      + '<div id="starCommentImagePreview" style="display:none;position:relative;margin-bottom:4px"></div>'
      + '</div>'
      + '</div>'
      // 照片查看器
      + '<div id="starPhotoViewer" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:10000;flex-direction:column;align-items:center;justify-content:center" onclick="closeStarPhotoViewer()">'
      + '<img id="starPhotoViewerImg" src="" style="max-width:95%;max-height:70vh;border-radius:8px;object-fit:contain" onclick="event.stopPropagation()" />'
      + '<div style="display:flex;gap:16px;margin-top:20px">'
      + '<button onclick="event.stopPropagation();starPhotoViewerNav(-1)" style="padding:10px 24px;border-radius:20px;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:20px;cursor:pointer">◀</button>'
      + '<button onclick="event.stopPropagation();starPhotoViewerNav(1)" style="padding:10px 24px;border-radius:20px;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:20px;cursor:pointer">▶</button>'
      + '</div>'
      + '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:12px" id="starPhotoViewerCounter"></div>'
      + '<button onclick="closeStarPhotoViewer()" style="position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>'
      + '</div>'
      + '';

    document.getElementById('starDetailTitle').innerHTML = '<img src="/uploads/icons/star-icon.png" style="width:22px;height:22px;object-fit:contain;border-radius:4px;vertical-align:middle;margin-right:6px">' + escHtml(c.name);
    document.getElementById('starDetailBody').innerHTML = content;

    // 加载评论
    loadStarComments(c.id);

    // 双重 rAF 确保 DOM 完全渲染后再打开，避免闪退
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (document.getElementById('starDetailBody').innerHTML) {
          openSubPage('starDetailPage_sub');
        }
      });
    });
    _showStarDetailLock = null;
  } catch(e) {
    _showStarDetailLock = null;
    console.error('[showStarDetail]', e);
    showToast('加载失败: ' + (e.message || '未知错误'));
  }
}

// ─── 投票 ─────────────────────────────────────────────────
async function starVote(candidateId, name) {
  if (_starVoteCountToday >= 3) {
    showToast('你今天已经投满3票了，明天再来吧！');
    return;
  }

  try {
    const r = await starFetch('/api/campus-star/vote', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId })
    });
    if (r.error) return showToast(r.error);

    _starVoteCountToday = r.votesToday || (_starVoteCountToday + 1);
    if (r.votesToday) _starVoteCountToday = r.votesToday;
    _starVotedFor.push(candidateId);
    if (_starVoteCountToday >= 3) { document.getElementById('starJoinBtn') && updateStarActionBar(); }

    showToast('🎉 投票成功！（今日已投 ' + _starVoteCountToday + '/3 票）');

    await refreshStarStatus();
    loadStarCandidates();

    // 刷新详情页
    if (document.getElementById('starDetailBody').innerHTML) {
      showStarDetail(candidateId);
    }
  } catch(e) {
    showToast('投票失败，请重试');
  }
}

// ─── 分享 ─────────────────────────────────────────────────
async function shareStarCandidate(id) {
  var phone = currentUser && currentUser.phone;
  if (!phone) { showToast('请先登录'); return; }

  // 获取候选人最新信息（不依赖缓存，确保照片与详情页一致）
  var candidate = null;
  try {
    var r = await starFetch('/api/campus-star/candidate/' + id);
    candidate = r.candidate || r;
  } catch(e) {}
  if (!candidate) {
    var url = window.location.origin + '/app.html?page=campus-star&candidate=' + id;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function() { showToast('📋 链接已复制到剪贴板'); });
    } else { showToast('📋 链接已复制到剪贴板'); }
    return;
  }

  // 关闭可能已打开的子页面
  var sp = document.getElementById('starDetailPage_sub');
  if (sp) sp.style.display = 'none';

  // 加载中遮罩
  var overlay = document.createElement('div');
  overlay.id = 'starShareOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = '<div style="background:var(--card);border-radius:16px 16px 0 0;width:100%;max-width:420px;padding:20px 16px 32px;animation:slideUp 0.3s"><div style="text-align:center;padding:40px 0;color:var(--text-secondary)"><div style="font-size:32px;margin-bottom:12px">⏳</div><div>加载好友列表...</div></div></div>';
  document.body.appendChild(overlay);

  // 拉取关注和粉丝
  var followers = [];
  var following = [];
  try {
    [followers, following] = await Promise.all([
      API.wallFollowers(phone),
      API.wallFollowing(phone)
    ]);
  } catch(e) {
    overlay.remove();
    showToast('加载好友失败，请重试');
    return;
  }

  // 合并去重，按关系分组
  var fSet = new Set(followers.map(function(u) { return u.phone; }));
  var gSet = new Set(following.map(function(u) { return u.phone; }));
  var allPhones = new Set(followers.concat(following).map(function(u) { return u.phone; }));

  var users = [];
  allPhones.forEach(function(p) {
    var isF = fSet.has(p);
    var isG = gSet.has(p);
    var rel = (isF && isG) ? '互相关注' : (isF ? '关注我' : '已关注');
    var u = followers.find(function(x) { return x.phone === p; }) || following.find(function(x) { return x.phone === p; });
    users.push({ phone: p, nickname: u.nickname || p, avatar: u.avatar || '', relation: rel });
  });

  var relOrder = { '互相关注': 0, '关注我': 1, '已关注': 2 };
  users.sort(function(a, b) { return relOrder[a.relation] - relOrder[b.relation] || a.nickname.localeCompare(b.nickname); });

  var selected = new Set();
  var selectAll = false;

  var avatarColors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];

  function avatarHTML(u) {
    var initial = u.nickname.charAt(0).toUpperCase();
    var color = avatarColors[u.phone.split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0) % avatarColors.length];
    var style = 'width:44px;height:44px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;background:' + color + ';';
    return u.avatar
      ? '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;overflow:hidden;background:' + color + '"><img src="' + escHtml(u.avatar) + '" style="width:100%;height:100%;object-fit:cover" /><span style="width:100%;height:100%;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;display:none">' + initial + '</span></div>'
      : '<span style="' + style + '">' + initial + '</span>';
  }

  var groups = [
    { label: '🤝 互相关注', relation: '互相关注', users: [] },
    { label: '💚 关注我的人', relation: '关注我', users: [] },
    { label: '👀 我关注的人', relation: '已关注', users: [] }
  ];
  users.forEach(function(u) {
    var g = groups.find(function(g) { return g.relation === u.relation; });
    if (g) g.users.push(u);
  });
  groups = groups.filter(function(g) { return g.users.length > 0; });

  function renderUserItem(u) {
    var checked = selected.has(u.phone);
    var color = avatarColors[u.phone.split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0) % avatarColors.length];
    var checkBg = checked ? 'background:' + color + ';border-color:' + color : 'border-color:var(--border)';
    var checkScale = checked ? 'transform:scale(1)' : 'transform:scale(0.9)';
    var itemBg = checked ? 'background:var(--primary)08;border:1.5px solid var(--primary)20' : 'border:1.5px solid transparent';
    return '<div class="star-share-user-item" data-phone="' + escHtml(u.phone) + '" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;cursor:pointer;transition:all 0.2s;' + itemBg + '">'
      + '<div style="width:22px;height:22px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.25s;' + checkBg + ';' + checkScale + '">'
      + (checked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '')
      + '</div>'
      + avatarHTML(u)
      + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(u.nickname) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + escHtml(u.phone) + '</div></div>'
      + '</div>';
  }

  function renderUserList(filtered) {
    var list = filtered || users;
    if (filtered) {
      return '<div style="display:flex;flex-direction:column;gap:2px">' + list.map(renderUserItem).join('') + '</div>';
    }
    return groups.map(function(g) {
      if (g.users.length === 0) return '';
      return '<div style="margin-bottom:8px">'
        + '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);padding:6px 4px 2px;letter-spacing:0.5px">' + g.label + ' <span style="font-weight:400;opacity:0.7">' + g.users.length + '</span></div>'
        + '<div style="display:flex;flex-direction:column;gap:2px">' + g.users.map(renderUserItem).join('') + '</div>'
        + '</div>';
    }).join('');
  }

  function buildStarShare(c) {
    var photos = (c.photos || '').split(',').filter(Boolean);
    return '[SHARE_STAR]' + JSON.stringify({
      id: c.id,
      name: c.name,
      intro: (c.intro || '').substring(0, 80),
      photo: photos[0] || '',
      votes: c.votes || 0
    });
  }

  function renderModal() {
    overlay.innerHTML = '';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--card);border-radius:20px 20px 0 0;width:100%;max-width:440px;animation:slideUp 0.35s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;max-height:88vh;box-shadow:0 -8px 32px rgba(0,0,0,0.12)';
    overlay.appendChild(sheet);

    var dragBar = document.createElement('div');
    dragBar.style.cssText = 'width:36px;height:4px;background:var(--border);border-radius:2px;margin:10px auto 8px;flex-shrink:0';
    sheet.appendChild(dragBar);

    var titleBar = document.createElement('div');
    titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 20px 12px;flex-shrink:0';
    titleBar.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#EC4899,#F472B6);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(236,72,153,0.25)">🌸</div><div><div style="font-size:17px;font-weight:700;color:var(--text);line-height:1.2">分享校花校草</div><div style="font-size:12px;color:var(--text-secondary)">选择好友，分享给TA</div></div></div><button id="starShareCloseBtn" style="width:32px;height:32px;border-radius:50%;background:var(--bg);border:none;font-size:16px;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>';
    sheet.appendChild(titleBar);

    var divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:var(--border);margin:0 20px;flex-shrink:0;opacity:0.5';
    sheet.appendChild(divider);

    // 搜索框
    var searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:12px 20px 8px;flex-shrink:0;position:relative';
    searchWrap.innerHTML = '<div style="position:relative;display:flex;align-items:center"><svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-secondary);pointer-events:none;opacity:0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input id="starShareSearch" type="text" placeholder="搜索好友..." style="width:100%;padding:12px 40px 12px 40px;border:2px solid var(--border);border-radius:14px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;transition:border-color 0.2s" /><button id="starShareSearchClear" style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:14px;align-items:center;justify-content:center">✕</button></div>';
    sheet.appendChild(searchWrap);

    // 操作栏
    var actionBar = document.createElement('div');
    actionBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 20px 8px;flex-shrink:0';
    actionBar.innerHTML = '<button id="starShareSelectAll" style="display:flex;align-items:center;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:12px;color:var(--text);cursor:pointer;font-weight:500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 全选</button><span id="starShareSelCount" style="font-size:12px;font-weight:600;color:var(--primary);background:var(--primary)10;padding:4px 12px;border-radius:20px;display:none">0</span>';
    sheet.appendChild(actionBar);

    // 用户列表
    var listContainer = document.createElement('div');
    listContainer.id = 'starShareUserList';
    listContainer.style.cssText = 'overflow-y:auto;flex:1;min-height:0;padding:0 12px 8px;';
    listContainer.innerHTML = '<div style="padding:0 8px">' + renderUserList() + '</div>';
    sheet.appendChild(listContainer);

    // 底部发送栏
    var bottomBar = document.createElement('div');
    bottomBar.style.cssText = 'flex-shrink:0;padding:12px 20px 20px;display:flex;gap:10px;align-items:center;background:linear-gradient(180deg,transparent 0%,var(--card) 20%);border-top:1px solid var(--border)';
    bottomBar.innerHTML = '<button id="starShareSendBtn" style="flex:1;padding:15px;background:linear-gradient(135deg,#E0E0E0,#D0D0D0);color:#999;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:default;transition:all 0.3s;letter-spacing:0.5px" disabled><span id="starShareSendText">选择好友发送</span></button>';
    sheet.appendChild(bottomBar);

    // 空状态
    if (users.length === 0) {
      overlay.innerHTML = '';
      var emptySheet = document.createElement('div');
      emptySheet.style.cssText = 'background:var(--card);border-radius:20px 20px 0 0;width:100%;max-width:440px;padding:32px 20px 40px;animation:slideUp 0.35s;display:flex;flex-direction:column;align-items:center;text-align:center';
      emptySheet.innerHTML = '<div style="width:72px;height:72px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:16px">👥</div><div style="font-size:16px;font-weight:700;margin-bottom:6px;color:var(--text)">还没有好友</div><div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.5">关注别人或被关注后<br/>即可分享给好友</div><button onclick="document.getElementById(\'starShareOverlay\').remove()" style="padding:12px 36px;background:var(--primary);color:white;border:none;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer">知道了</button>';
      overlay.appendChild(emptySheet);
      return;
    }

    // 事件绑定
    document.getElementById('starShareCloseBtn').onclick = function() { overlay.remove(); };

    var searchInput = document.getElementById('starShareSearch');
    var searchClear = document.getElementById('starShareSearchClear');
    searchInput.oninput = function() {
      var q = this.value.toLowerCase().trim();
      searchClear.style.display = q ? 'flex' : 'none';
      var filtered = q ? users.filter(function(u) {
        return u.nickname.toLowerCase().indexOf(q) !== -1 || u.phone.indexOf(q) !== -1;
      }) : null;
      document.getElementById('starShareUserList').innerHTML = '<div style="padding:0 8px">' + renderUserList(filtered) + '</div>';
      bindStarShareClicks();
    };
    searchClear.onclick = function() { searchInput.value = ''; searchInput.oninput(); searchInput.focus(); };

    function updateUI() {
      var selCount = selected.size;
      var badge = document.getElementById('starShareSelCount');
      badge.textContent = '已选 ' + selCount + '/' + users.length;
      badge.style.display = selCount > 0 ? 'inline' : 'none';

      var allBtn = document.getElementById('starShareSelectAll');
      allBtn.innerHTML = selectAll
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> 取消'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 全选';

      document.querySelectorAll('#starShareUserList .star-share-user-item').forEach(function(item) {
        var p = item.dataset.phone;
        var checked = selected.has(p);
        item.style.background = checked ? 'var(--primary)08' : '';
        item.style.borderColor = checked ? 'var(--primary)20' : 'transparent';
        var circle = item.querySelector('div:first-child');
        if (circle) {
          var c = avatarColors[p.split('').reduce(function(a, ch) { return a + ch.charCodeAt(0); }, 0) % avatarColors.length];
          circle.style.background = checked ? c : '';
          circle.style.borderColor = checked ? c : 'var(--border)';
          circle.style.transform = checked ? 'scale(1)' : 'scale(0.9)';
          circle.innerHTML = checked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
        }
      });

      var btn = document.getElementById('starShareSendBtn');
      var btnText = document.getElementById('starShareSendText');
      if (selCount > 0) {
        btn.style.background = 'linear-gradient(135deg,#EC4899,#F472B6)';
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 4px 16px rgba(236,72,153,0.35)';
        btn.disabled = false;
        btnText.textContent = '📤 发送给 ' + selCount + ' 人';
      } else {
        btn.style.background = 'linear-gradient(135deg,#E0E0E0,#D0D0D0)';
        btn.style.color = '#999';
        btn.style.cursor = 'default';
        btn.style.boxShadow = 'none';
        btn.disabled = true;
        btnText.textContent = '选择好友发送';
      }
    }

    function bindStarShareClicks() {
      document.querySelectorAll('#starShareUserList .star-share-user-item').forEach(function(item) {
        item.onclick = function() {
          var p = this.dataset.phone;
          if (selected.has(p)) { selected.delete(p); }
          else { selected.add(p); }
          selectAll = (selected.size === users.length);
          updateUI();
        };
      });
    }
    bindStarShareClicks();

    document.getElementById('starShareSelectAll').onclick = function() {
      selectAll = !selectAll;
      if (selectAll) { users.forEach(function(u) { selected.add(u.phone); }); }
      else { selected.clear(); }
      updateUI();
    };

    // 发送
    document.getElementById('starShareSendBtn').onclick = async function() {
      if (selected.size === 0) return;
      var btn = this;
      var btnText = document.getElementById('starShareSendText');
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'default';

      var shareContent = buildStarShare(candidate);
      var targets = Array.from(selected);
      var success = 0;
      var fail = 0;
      for (var i = 0; i < targets.length; i++) {
        btnText.textContent = '发送中 ' + (i + 1) + '/' + targets.length + '...';
        try {
          var convRes = await API.chatGetOrCreateConversation({
            user_phone: phone,
            rider_phone: targets[i]
          });
          if (convRes.id) {
            await API.chatSend({
              conversation_id: convRes.id,
              sender_phone: phone,
              content: shareContent,
              type: 'share_star'
            });
            success++;
          } else { fail++; }
        } catch(e) { fail++; }
      }
      if (success > 0) { API.campusStarShare(id).catch(function() {}); }
      overlay.remove();
      showToast(success > 0 ? '✅ 已分享给 ' + success + ' 人' + (fail > 0 ? '（' + fail + ' 人失败）' : '') : '❌ 发送失败');
    };
  }

  renderModal();
}

// ─── 删除自己的参赛记录 ──────────────────────────────────
async function deleteStarEntry(id) {
  if (!confirm('确定要删除你的参赛记录吗？投票和评论数据也会一起删除，此操作不可恢复！')) return;

  try {
    var r = await starFetch('/api/campus-star/candidate/' + id, { method: 'DELETE' });
    if (r.error) return showToast(r.error);

    _starHasJoined = false;
    _starMyEntry = null;
    updateStarActionBar();
    showToast('已删除参赛记录');
    closeSubPage('starDetailPage_sub');
    loadStarCandidates();
  } catch(e) {
    showToast('删除失败，请重试');
  }
}

// ─── 举报候选人 ──────────────────────────────────────────
async function reportStarCandidate(id) {
  var phone = currentUser && currentUser.phone;
  if (!phone) { showToast('请先登录'); return; }
  var reason = prompt('请输入举报原因：');
  if (!reason || !reason.trim()) return;
  try {
    var r = await API.campusStarReport(id, reason.trim());
    if (r.error) return showToast(r.error);
    showToast('举报已提交，我们会尽快处理');
  } catch(e) {
    showToast('举报失败，请重试');
  }
}

// ─── 表情面板 ────────────────────────────────────────────
var _starEmojis = ['😂', '🤣', '❤️', '🔥', '👍', '🎉', '💪', '✨', '🌸', '💕', '🌟', '😍', '🤔', '🙏', '👏', '😘', '💗', '😊', '🥰', '😭'];

function toggleStarEmoji() {
  var panel = document.getElementById('starEmojiPanel');
  if (!panel) return;

  if (panel.style.display === 'flex') {
    panel.style.display = 'none';
    return;
  }

  var html = '';
  _starEmojis.forEach(function(e) {
    html += '<button onclick="insertStarEmoji(\'' + e + '\')" style="width:38px;height:38px;border-radius:10px;border:1px solid var(--border);background:var(--card);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s">' + e + '</button>';
  });
  panel.innerHTML = html;
  panel.style.display = 'flex';
}

function insertStarEmoji(emoji) {
  var input = document.getElementById('starCommentInput');
  if (!input) return;
  input.value += emoji;
  input.focus();
  document.getElementById('starEmojiPanel').style.display = 'none';
}

// ─── 回复提示（@某人）────────────────────────────────────
function _starReplyHint(nickname) {
  var input = document.getElementById('starCommentInput');
  if (!input) return;
  input.value = '@' + nickname + ' ' + input.value;
  input.focus();
  // 滚动到底部让输入框可见
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window._starReplyHint = _starReplyHint;

// ─── 评论图片上传 ────────────────────────────────────────
async function uploadStarCommentImage(input) {
  if (!input.files || input.files.length === 0) return;

  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过5MB');
    input.value = '';
    return;
  }

  var formData = new FormData();
  formData.append('image', file);

  try {
    var r = await starFetch('/api/campus-star/comment-image', {
      method: 'POST',
      body: formData
    });

    if (r.error) return showToast(r.error);

    _starCommentImage = r.url;
    // 显示预览
    var preview = document.getElementById('starCommentImagePreview');
    if (preview) {
      preview.style.display = 'block';
      preview.innerHTML = '<div style="display:inline-block;position:relative;margin-bottom:4px">'
        + '<img src="' + r.url + '" style="width:72px;height:72px;border-radius:10px;object-fit:cover" />'
        + '<button onclick="removeStarCommentImage()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>'
        + '</div>';
    }
  } catch(e) {
    showToast('图片上传失败');
  }

  input.value = '';
}

function removeStarCommentImage() {
  _starCommentImage = null;
  var preview = document.getElementById('starCommentImagePreview');
  if (preview) {
    preview.style.display = 'none';
    preview.innerHTML = '';
  }
}

// ─── 加载评论 ────────────────────────────────────────────
async function loadStarComments(candidateId) {
  var container = document.getElementById('starCommentsList');
  if (!container) return;

  try {
    var r = await starFetch('/api/campus-star/comments/' + candidateId);
    if (!r.ok) return;

    var comments = r.comments || [];
    if (comments.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">还没有评论，来说两句吧~</div>';
      return;
    }

    var myPhone = (currentUser && currentUser.phone) || '';
    var html = '';
    comments.forEach(function(cm, ci) {
      var isMine = myPhone && cm.phone === myPhone;
      var avatar = cm.avatar || '';
      var nickname = cm.nickname || '匿名';
      var time = (cm.created_at || '').slice(0, 16);
      var cmPhone = cm.phone || '';

      // 气泡式评论卡片
      html += '<div style="display:flex;gap:10px;padding:14px 0;' + (ci > 0 ? 'border-top:1px solid rgba(0,0,0,0.05)' : '') + '">'
        // 头像 - 更大更醒目
        + '<div onclick="' + (cmPhone ? 'showWallUser(\'' + cmPhone + '\')' : '') + '" style="width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;background:linear-gradient(145deg,#fce4ec,#f8bbd0);' + (cmPhone ? 'cursor:pointer' : '') + ';box-shadow:0 2px 8px rgba(233,30,99,0.15);border:2px solid rgba(255,255,255,0.8);transition:all 0.2s" title="' + (cmPhone ? '查看TA的主页' : '') + '">'
        + (avatar ? '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px">🌸</div>')
        + '</div>'
        + '<div style="flex:1;min-width:0">'
        // 头部行：昵称 + 时间标签
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
        + '<span onclick="' + (cmPhone ? 'showWallUser(\'' + cmPhone + '\')' : '') + '" style="font-size:14px;font-weight:700;color:#e91e63;' + (cmPhone ? 'cursor:pointer' : '') + ';transition:color 0.15s">' + escHtml(nickname) + '</span>'
        + (isMine ? '<span style="font-size:10px;background:linear-gradient(135deg,#e91e63,#ff6f91);color:#fff;padding:1px 7px;border-radius:8px;font-weight:600">我</span>' : '')
        + '<span style="font-size:11px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:8px">' + escHtml(time) + '</span>'
        + '</div>'
        // 内容气泡
        + '<div style="font-size:14px;color:var(--text);line-height:1.65;word-break:break-word;padding:10px 14px;background:var(--card);border-radius:12px;border:1px solid var(--border);box-shadow:0 1px 4px rgba(0,0,0,0.03)">' + escHtml(cm.content) + '</div>'
        // 图片
        + (cm.image ? '<div style="margin-top:8px"><img src="' + cm.image + '" style="max-width:160px;max-height:160px;border-radius:12px;object-fit:cover;cursor:pointer;border:2px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:all 0.2s" onclick="event.stopPropagation();openStarPhotoViewer(\'' + cm.image + '\', [\'' + cm.image + '\'], 0)" /></div>' : '')
        // 操作栏 - 更醒目
        + '<div style="display:flex;align-items:center;gap:14px;margin-top:8px;padding-left:4px">'
        + '<span style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--text-muted);padding:4px 10px;border-radius:14px;transition:all 0.15s;background:var(--bg)" onmouseover="this.style.color=&apos;#e91e63&apos;;this.style.background=&apos;rgba(233,30,99,0.06)&apos;" onmouseout="this.style.color=&apos;var(--text-muted)&apos;;this.style.background=&apos;var(--bg)&apos;" onclick="_starReplyHint(\'' + escHtml(nickname).replace(/'/g, "\\'") + '\')">💬 回复</span>'
        + (isMine ? '<span style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--text-muted);padding:4px 10px;border-radius:14px;transition:all 0.15s;background:var(--bg)" onmouseover="this.style.color=&apos;#e53935&apos;;this.style.background=&apos;rgba(229,57,53,0.06)&apos;" onmouseout="this.style.color=&apos;var(--text-muted)&apos;;this.style.background=&apos;var(--bg)&apos;" onclick="deleteStarComment(' + cm.id + ',' + candidateId + ')">🗑 删除</span>' : '')
        + '</div></div></div>';
    });
 
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">加载评论失败</div>';
  }
}

// ─── 发表评论 ────────────────────────────────────────────
async function submitStarComment(candidateId) {
  var input = document.getElementById('starCommentInput');
  if (!input) return;
  var content = input.value.trim();
  if (!content && !_starCommentImage) return showToast('请输入评论内容');

  try {
    var body = { candidate_id: candidateId, content: content || '📷' };
    if (_starCommentImage) {
      body.image = _starCommentImage;
    }

    var r = await starFetch('/api/campus-star/comments', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (r.error) return showToast(r.error);

    input.value = '';
    _starCommentImage = null;
    removeStarCommentImage();
    document.getElementById('starEmojiPanel').style.display = 'none';
    showToast('评论成功');
    loadStarComments(candidateId);
  } catch(e) {
    showToast('评论失败，请重试');
  }
}

// ─── 删除评论 ────────────────────────────────────────────
async function deleteStarComment(commentId, candidateId) {
  if (!confirm('确定要删除这条评论吗？')) return;

  try {
    var r = await starFetch('/api/campus-star/comments/' + commentId, { method: 'DELETE' });
    if (r.error) return showToast(r.error);

    showToast('已删除评论');
    loadStarComments(candidateId);
  } catch(e) {
    showToast('删除失败，请重试');
  }
}

// ─── 照片查看器 ──────────────────────────────────────────
var _starPhotoViewerPhotos = [];
var _starPhotoViewerIndex = 0;
var _starDetailPhotos = [];

// 从详情照片中打开
function openStarPhotoViewerDet(index) {
  openStarPhotoViewer(null, _starDetailPhotos, index);
}

function openStarPhotoViewer(url, photos, index) {
  _starPhotoViewerPhotos = Array.isArray(photos) && photos.length > 0 ? photos : (url ? [url] : []);
  _starPhotoViewerIndex = typeof index === 'number' && index >= 0 && index < _starPhotoViewerPhotos.length ? index : 0;
  var viewer = document.getElementById('starPhotoViewer');
  var img = document.getElementById('starPhotoViewerImg');
  var counter = document.getElementById('starPhotoViewerCounter');
  if (!viewer || !img) return;

  if (_starPhotoViewerPhotos.length === 0) return;
  img.src = _starPhotoViewerPhotos[_starPhotoViewerIndex];
  if (counter && _starPhotoViewerPhotos.length > 1) {
    counter.textContent = (_starPhotoViewerIndex + 1) + ' / ' + _starPhotoViewerPhotos.length;
  } else if (counter) {
    counter.textContent = '';
  }
  viewer.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeStarPhotoViewer() {
  var viewer = document.getElementById('starPhotoViewer');
  if (viewer) viewer.style.display = 'none';
  document.body.style.overflow = '';
}

function starPhotoViewerNav(dir) {
  var newIdx = _starPhotoViewerIndex + dir;
  if (newIdx < 0) newIdx = _starPhotoViewerPhotos.length - 1;
  if (newIdx >= _starPhotoViewerPhotos.length) newIdx = 0;
  _starPhotoViewerIndex = newIdx;

  var img = document.getElementById('starPhotoViewerImg');
  var counter = document.getElementById('starPhotoViewerCounter');
  if (img) img.src = _starPhotoViewerPhotos[_starPhotoViewerIndex];
  if (counter && _starPhotoViewerPhotos.length > 1) {
    counter.textContent = (_starPhotoViewerIndex + 1) + ' / ' + _starPhotoViewerPhotos.length;
  }
}

// ─── 打开报名弹窗 ─────────────────────────────────────────
function openStarJoin() {
  if (_starHasJoined) {
    showToast('你本月已经报名过了~');
    return;
  }
  // 自动填入用户昵称
  var nick = (currentUser && (currentUser.nickname || currentUser.name)) || '';
  document.getElementById('starJoinName').value = nick;
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
    console.log('[submitStarJoin] response:', r);
    if (r.error) return showToast('报名失败：' + r.error);

    _starHasJoined = true;
    closeStarJoin();
    showToast('🌸 报名成功！');
    loadStarCandidates();
  } catch(e) {
    console.error('[submitStarJoin] error:', e);
    showToast('报名失败：' + (e.message || '请重试'));
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

      html += '<div class="star-card" onclick="event.stopPropagation();event.stopImmediatePropagation();showStarDetail(' + item.id + ')" style="display:flex;align-items:center;gap:12px;background:var(--card);border-radius:14px;padding:12px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer">'
        + '<div style="flex-shrink:0">' + rankIcon + '</div>'
        + '<div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#fce4ec,#f3e5f5)">'
        + (coverImg ? '<img src="' + coverImg + '" style="width:100%;height:100%;object-fit:cover" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">🌸</div>')
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

      html += '<div style="background:var(--card);border-radius:16px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">'
        + '<div style="position:relative;height:200px;overflow:hidden;background:linear-gradient(135deg,#fff3e0,#fce4ec)">'
        + (coverImg ? '<img src="' + coverImg + '" style="width:100%;height:100%;object-fit:cover" />' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px">🏆</div>')
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

// 从分享卡片跳转：先打开校花校草页面，再展示详情
window.openStarFromShare = function(id) {
  openCampusStar();
  setTimeout(function() { showStarDetail(id); }, 400);
};
window.previewStarPhotos = previewStarPhotos;
window.submitStarJoin = submitStarJoin;
window.switchToRank = switchToRank;
window.switchToHall = switchToHall;
window.switchToCandidates = switchToCandidates;
window.shareStarCandidate = shareStarCandidate;
window.deleteStarEntry = deleteStarEntry;
window.loadStarComments = loadStarComments;
window.submitStarComment = submitStarComment;
window.deleteStarComment = deleteStarComment;
window.toggleStarEmoji = toggleStarEmoji;
window.insertStarEmoji = insertStarEmoji;
window.uploadStarCommentImage = uploadStarCommentImage;
window.removeStarCommentImage = removeStarCommentImage;
window.openStarPhotoViewer = openStarPhotoViewer;
window.openStarPhotoViewerDet = openStarPhotoViewerDet;
window.closeStarPhotoViewer = closeStarPhotoViewer;
window.starPhotoViewerNav = starPhotoViewerNav;
window.escHtml = escHtml;
