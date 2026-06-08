// pets.js - 猫狗追踪
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码


// 教师评价子页面打开时加载学院
window._teacherCollegesLoaded = false;
const _origOpenSubPage = window.openSubPage;
if (!_origOpenSubPage.name || _origOpenSubPage.name !== 'teacherOpenSubPage') {
  window.openSubPage = function(id) {
    _origOpenSubPage(id);
    if (id === 'teacherListPage_sub') {
      if (!window._teacherCollegesLoaded) {
        loadTeacherColleges();
        window._teacherCollegesLoaded = true;
      }
      loadTeachers(true);
    }
  };
  Object.defineProperty(window.openSubPage, 'name', { value: 'teacherOpenSubPage' });
}

// ═══════════════════════════════════════════════════════════
// 🐱 猫狗日记
// ═══════════════════════════════════════════════════════════
let _currentPetId = null;
let _petCommentMedia = [];
const _petEmojis = ['😊','😂','🥰','😍','😘','🤗','😎','🤩','😜','😝','🥳','😇','🤭','😻','🐱','🐶','🐾','❤️','💕','💖','✨','🌟','🎀','🎈','🎉','🌸','🌺','🍀','🌈','⭐','🔥','💪','👏','🙌','👍','🤝','💪','😋','🤤','😸','😹','😺','🎀','🏡','🍖','🐟','🥛','🎾','🦴','🐱','🐶'];


async function loadPets(species = 'all') {
  const data = await API.getPets(species);
  if (data.error) return showToast(data.error);
  const container = document.getElementById('petListContainer');
  if (!data.length) {
    container.innerHTML = '<div class="sub-empty" style="padding:40px 0;text-align:center;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:12px">🐾</div><div>还没有猫狗入驻~</div></div>';
    return;
  }
  container.innerHTML = data.map(p => {
    const speciesEmoji = p.species === 'cat' ? '🐱' : '🐶';
    const speciesName = p.species === 'cat' ? '猫咪' : '狗狗';
    const statusMap = { active: '在校', missing: '走失', adopted: '已领养', graduated: '已毕业' };
    const statusColor = { active: '#2ECC71', missing: '#E74C3C', adopted: '#3498DB', graduated: '#9B59B6' };
    const alertConfig = { warning: { emoji: '⚠️', label: '7天未见', bg: '#FFF3E0', color: '#E65100', border: '#FFE0B2' }, urgent: { emoji: '🟠', label: '15天未现', bg: '#FBE9E7', color: '#BF360C', border: '#FFAB91' }, critical: { emoji: '🔴', label: '30天失联', bg: '#FFEBEE', color: '#B71C1C', border: '#EF9A9A' } };
    const alert = alertConfig[p.alert_level];
    const alertBadge = alert ? '<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:' + alert.bg + ';color:' + alert.color + ';border:1px solid ' + alert.border + ';font-weight:600;animation:pulse 2s infinite">' + alert.emoji + ' ' + alert.label + '</span>' : '';
    const seenInfo = p.daysSinceSeen !== null && p.daysSinceSeen > 0 ? '<span style="font-size:11px;color:#999">已' + p.daysSinceSeen + '天未见</span>' : (p.daysSinceSeen === 0 ? '<span style="font-size:11px;color:#4CAF50">今日已见</span>' : '');
    const tags = (p.tags || []).map(t => '<span class="pet-card-tag">' + escHtml(t) + '</span>').join('');
    const avatar = p.avatar && (p.avatar.startsWith('/') || p.avatar.startsWith('http'))
      ? '<img class="pet-card-avatar" src="' + escHtml(p.avatar) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' + '<div class="pet-card-avatar-placeholder" style="display:none">' + speciesEmoji + '</div>'
      : '<div class="pet-card-avatar-placeholder">' + speciesEmoji + '</div>';
    return '<div class="pet-card' + (p.alert_level === 'critical' ? ' pet-card-critical' : p.alert_level === 'urgent' ? ' pet-card-urgent' : '') + '" onclick="showPetDetail(' + p.id + ')">' +
      avatar +
      '<div class="pet-card-info">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<span class="pet-card-name">' + escHtml(p.code_name) + '</span>' +
          '<span style="font-size:11px;padding:1px 6px;border-radius:8px;color:#fff;background:' + (statusColor[p.status]||'#999') + '">' + (statusMap[p.status]||'在校') + '</span>' +
          (p.health_status && p.health_status !== 'healthy' ? '<span style="font-size:11px;padding:1px 6px;border-radius:8px;color:#fff;background:' + ({sick:'#FF9800',injured:'#F44336',pregnant:'#E91E63',nursing:'#9C27B0',quarantine:'#795548',other:'#607D8B'}[p.health_status]||'#999') + '">' + ({sick:'🤒 生病',injured:'🩹 受伤',pregnant:'🤰 怀孕',nursing:'🍼 哺乳',quarantine:'🏥 隔离',other:'⚠️ 异常'}[p.health_status]||'') + '</span>' : '') +
          alertBadge +
        '</div>' +
        '<div class="pet-card-species">' + speciesEmoji + ' ' + speciesName + (p.breed ? ' · ' + escHtml(p.breed) : '') + '</div>' +
        (tags ? '<div class="pet-card-tags">' + tags + '</div>' : '') +
        '<div class="pet-card-stats">' +
          '<span>❤️ ' + (p.like_count||0) + '</span>' +
          '<span>💬 ' + (p.comment_count||0) + '</span>' +
          seenInfo +
        '</div>' +
      '</div></div>';
  }).join('');
}



function filterPets(species, btn) {
  document.querySelectorAll('.pet-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPets(species);
}



async function showPetDetail(id) {
  _currentPetId = id;
  _petCommentMedia = [];
  const data = await API.getPetDetail(id);
  if (data.error) return showToast(data.error);
  window._currentPet = data;

  const speciesEmoji = data.species === 'cat' ? '🐱' : '🐶';
  document.getElementById('petDetailTitle').textContent = speciesEmoji + ' ' + data.code_name;

  // 身份卡
  const avatar = data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http'))
    ? '<img class="pet-profile-avatar" src="' + escHtml(data.avatar) + '">'
    : '<div class="pet-profile-avatar-ph">' + speciesEmoji + '</div>';
  const statusMap = { active: '🟢 在校', missing: '🔴 走失', adopted: '🔵 已领养', graduated: '🟣 已毕业' };
  const genderMap = { male: '♂️ 公', female: '♀️ 母', unknown: '❓ 未知' };

  let infoHtml = '<div class="pet-profile-header">' +
    avatar +
    '<div class="pet-profile-name">' + escHtml(data.code_name) + '</div>' +
    (data.bio ? '<div class="pet-profile-bio">' + escHtml(data.bio) + '</div>' : '');

  // 告警横幅
  const alertConf = { warning: { emoji: '⚠️', label: '7天未见', bg: 'linear-gradient(135deg,#FFF3E0,#FFE0B2)', color: '#E65100' }, urgent: { emoji: '🟠', label: '15天未现', bg: 'linear-gradient(135deg,#FBE9E7,#FFCCBC)', color: '#BF360C' }, critical: { emoji: '🔴', label: '30天失联', bg: 'linear-gradient(135deg,#FFEBEE,#FFCDD2)', color: '#B71C1C' } };
  const ac = alertConf[data.alert_level];
  if (ac) {
    infoHtml += '<div style="margin:8px 0;padding:10px 14px;border-radius:12px;background:' + ac.bg + ';color:' + ac.color + ';font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">' + ac.emoji + ' ' + escHtml(data.code_name) + '已' + (data.daysSinceSeen || '?') + '天未被目击，如看到请点击下方「📋 上报状况」</div>';
  }

  // 健康状态横幅
  const healthConf = { sick: { emoji: '🤒', label: '生病中', bg: 'linear-gradient(135deg,#FFF3E0,#FFE0B2)', color: '#E65100' }, injured: { emoji: '🩹', label: '受伤中', bg: 'linear-gradient(135deg,#FFEBEE,#FFCDD2)', color: '#C62828' }, pregnant: { emoji: '🤰', label: '怀孕中', bg: 'linear-gradient(135deg,#FCE4EC,#F8BBD0)', color: '#AD1457' }, nursing: { emoji: '🍼', label: '哺乳期', bg: 'linear-gradient(135deg,#F3E5F5,#E1BEE7)', color: '#6A1B9A' }, quarantine: { emoji: '🏥', label: '隔离中', bg: 'linear-gradient(135deg,#EFEBE9,#D7CCC8)', color: '#4E342E' }, other: { emoji: '⚠️', label: '异常状态', bg: 'linear-gradient(135deg,#ECEFF1,#CFD8DC)', color: '#37474F' } };
  const hc = healthConf[data.health_status];
  if (hc) {
    infoHtml += '<div style="margin:8px 0;padding:10px 14px;border-radius:12px;background:' + hc.bg + ';color:' + hc.color + ';font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">' + hc.emoji + ' ' + escHtml(data.code_name) + '当前' + hc.label + (data.health_note ? '（' + escHtml(data.health_note) + '）' : '') + '，请小心对待</div>';
  }

  infoHtml += '<div class="pet-profile-stats">' +
      '<span>❤️ ' + (data.like_count||0) + '</span>' +
      '<span>💬 ' + (data.comment_count||0) + '</span>' +
      '<span>' + (statusMap[data.status]||'🟢 在校') + '</span>' +
      (data.daysSinceSeen !== null ? '<span>🕐 ' + (data.daysSinceSeen === 0 ? '今日已见' : data.daysSinceSeen + '天未见') + '</span>' : '') +
    '</div>' +
  '</div>';

  infoHtml += '<div class="pet-info-grid">' +
    '<div class="pet-info-item"><div class="pet-info-label">物种</div><div class="pet-info-value">' + speciesEmoji + ' ' + (data.species === 'cat' ? '猫咪' : '狗狗') + '</div></div>' +
    '<div class="pet-info-item"><div class="pet-info-label">品种</div><div class="pet-info-value">' + (data.breed || '未知') + '</div></div>' +
    '<div class="pet-info-item"><div class="pet-info-label">性别</div><div class="pet-info-value">' + (genderMap[data.gender]||'未知') + '</div></div>' +
    '<div class="pet-info-item"><div class="pet-info-label">年龄</div><div class="pet-info-value">' + (data.age || '未知') + '</div></div>' +
    '<div class="pet-info-item"><div class="pet-info-label">毛色</div><div class="pet-info-value">' + (data.color || '未知') + '</div></div>' +
    '<div class="pet-info-item"><div class="pet-info-label">健康</div><div class="pet-info-value">' + ({healthy:'💚 健康',sick:'🤒 生病',injured:'🩹 受伤',pregnant:'🤰 怀孕',nursing:'🍼 哺乳',quarantine:'🏥 隔离',other:'⚠️ 异常'}[data.health_status]||'💚 健康') + (data.health_note ? ' · ' + escHtml(data.health_note) : '') + '</div></div>' +
    '<div class="pet-info-item"><div class="pet-info-label">出没地</div><div class="pet-info-value">' + (data.location || '未知') + '</div></div>' +
    (data.personality ? '<div class="pet-info-item" style="grid-column:span 2"><div class="pet-info-label">性格</div><div class="pet-info-value">' + escHtml(data.personality) + '</div></div>' : '') +
  '</div>';

  // 标签
  if (data.tags && data.tags.length) {
    infoHtml += '<div style="padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:4px">';
    data.tags.forEach(t => { infoHtml += '<span class="pet-card-tag" style="font-size:12px;padding:3px 10px">' + escHtml(t) + '</span>'; });
    infoHtml += '</div>';
  }

  // 照片
  if (data.images && data.images.length) {
    infoHtml += '<div style="padding:0 16px 12px;display:flex;gap:4px;overflow-x:auto">';
    data.images.forEach(img => { infoHtml += '<img src="' + escHtml(img) + '" style="width:120px;height:90px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="previewImage(\'' + escHtml(img) + '\')">'; });
    infoHtml += '</div>';
  }

  // 点赞按钮 + 目击打卡
  const liked = data.userLiked;
  infoHtml += '<div style="padding:0 16px 12px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button id="petLikeBtn" onclick="doPetLike(' + id + ')" style="background:' + (liked ? 'linear-gradient(135deg,#ff6a88,#ff4466)' : 'linear-gradient(135deg,#ff9a56,#ff6a88)') + ';color:#fff;border:none;border-radius:20px;padding:8px 24px;font-size:14px;font-weight:600;cursor:pointer">' + (liked ? '❤️ 已赞 (' + (data.like_count||0) + ')' : '❤️ 点赞 (' + (data.like_count||0) + ')') + '</button>' +
    '<button id="sightBtn" onclick="openSightPage(' + id + ')" style="background:linear-gradient(135deg,#4CAF50,#66BB6A);color:#fff;border:none;border-radius:20px;padding:8px 24px;font-size:14px;font-weight:600;cursor:pointer;transition:transform 0.15s" ontouchstart="this.style.transform=\'scale(0.95)\'" ontouchend="this.style.transform=\'scale(1)\'">📋 上报状况</button>' +
  '</div>';

  document.getElementById('petProfileCard').innerHTML = infoHtml;

  // 目击记录
  try {
    const sightings = await API.getPetSightings(id);
    if (sightings && sightings.length > 0) {
      var sightHtml = '<div style="padding:0 16px 12px"><div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:8px">\u{1F4CD} 最近目击 (' + sightings.length + ')</div>';
      sightings.slice(0, 10).forEach(function(s) {
        var sAvatar = (s.user_avatar && s.user_avatar.startsWith('/')) ? '<img src="' + escHtml(s.user_avatar) + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover">' : '<span style="font-size:1rem">\u{1F464}</span>';
        var sName = escHtml(s.user_nickname || s.nickname || '匿名');
        var sLoc = s.location ? ' \u{1F4CD}' + escHtml(s.location) : '';
        var sNote = s.note ? '<span style="color:#666;font-size:12px"> - ' + escHtml(s.note) + '</span>' : '';
        var sPhoto = s.photo ? '<div style="margin-top:4px"><img src="' + escHtml(s.photo) + '" style="max-width:80px;max-height:60px;border-radius:6px;object-fit:cover" onclick="previewImage(this.src)"></div>' : '';
        sightHtml += '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5">' +
          sAvatar +
          '<div style="flex:1;font-size:13px"><div><strong>' + sName + '</strong>' + sLoc + sNote + '</div>' + sPhoto + '</div>' +
          '<span style="font-size:11px;color:#aaa;white-space:nowrap">' + fmtTime(s.created_at) + '</span></div>';
      });
      sightHtml += '</div>';
      document.getElementById('petProfileCard').innerHTML += sightHtml;
    }
  } catch(e) {}

  // 相关校园墙
  const relatedDiv = document.getElementById('petRelatedPosts');
  if (data.relatedPosts && data.relatedPosts.length) {
    relatedDiv.style.display = 'block';
    document.getElementById('petRelatedPostList').innerHTML = data.relatedPosts.map(p => {
      const imgs = (p.images || []).slice(0, 3).map(img => '<img src="' + escHtml(img) + '">').join('');
      return '<div class="pet-related-post" onclick="closeSubPage(\'petDetailPage_sub\');setTimeout(()=>showWallDetail(' + p.id + '),100)">' +
        '<div class="author">' + escHtml(p.nickname || '匿名') + ' · ' + fmtTime(p.created_at) + '</div>' +
        '<div class="content">' + escHtml(p.content) + '</div>' +
        (imgs ? '<div class="images">' + imgs + '</div>' : '') +
      '</div>';
    }).join('');
  } else {
    relatedDiv.style.display = 'none';
  }

  // 留言列表
  renderPetComments(data.comments || []);

  // emoji面板
  const emojiPanel = document.getElementById('petEmojiPanel');
  emojiPanel.innerHTML = _petEmojis.map(e => '<span style="font-size:22px;cursor:pointer;padding:2px" onclick="insertPetEmoji(this.dataset.e)" data-e="' + e + '">' + e + '</span>').join('');

  openSubPage('petDetailPage_sub');
}



function renderPetComments(comments) {
  const container = document.getElementById('petCommentList');
  if (!comments.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary)">还没有留言，来说点什么吧~</div>';
    return;
  }
  const myPhone = _phone() || '';
  container.innerHTML = comments.map(c => {
    const avatar = c.avatar && (c.avatar.startsWith('/') || c.avatar.startsWith('http'))
      ? '<img class="pet-comment-avatar" src="' + escHtml(c.avatar) + '" onclick="showWallUser(\'' + c.phone + '\')">'
      : '<div class="pet-comment-avatar-ph" onclick="showWallUser(\'' + c.phone + '\')">👤</div>';
    const images = (c.images || []).map(img => '<img src="' + escHtml(img) + '" onclick="previewImage(\'' + escHtml(img) + '\')">').join('');
    const deleteBtn = c.phone === myPhone ? '<span style="color:var(--danger);font-size:11px;cursor:pointer;margin-left:8px" onclick="event.stopPropagation();deletePetComment(' + c.id + ')">删除</span>' : '';
    return '<div class="pet-comment-item">' +
      '<div class="pet-comment-header">' +
        avatar +
        '<div style="flex:1">' +
          '<span class="pet-comment-name" onclick="showWallUser(\'' + c.phone + '\')">' + escHtml(c.nickname || '匿名') + '</span>' +
          '<span class="pet-comment-time"> · ' + fmtTime(c.created_at) + '</span>' + deleteBtn +
        '</div>' +
      '</div>' +
      '<div class="pet-comment-content">' + escHtml(c.content) + '</div>' +
      (images ? '<div class="pet-comment-media">' + images + '</div>' : '') +
    '</div>';
  }).join('');
}



function _phone(){try{const s=JSON.parse(localStorage.getItem('lazy_session')||'{}');return s.phone||''}catch(e){return''}}

async function doPetLike(id) {
  if (!API._token) { showToast('⚠️ 请先登录'); return; }
  const phone = _phone();
  if (!phone) { showToast('⚠️ 请重新登录'); return; }
  const btn = document.getElementById('petLikeBtn');
  btn.textContent = '⏳...';
  const data = await API.likePet(id, phone);
  if (data.error) return showToast(data.error);
  btn.textContent = data.liked ? '❤️ 已赞 (' + data.like_count + ')' : '🤍 点赞 (' + data.like_count + ')';
  btn.style.background = data.liked ? 'linear-gradient(135deg,#ff6a88,#ff4466)' : 'linear-gradient(135deg,#ff9a56,#ff6a88)';
}



async function openSightPage(id) {
  console.log('[DEBUG] openSightPage called, id=', id, 'token=', !!API._token, '_currentPet=', !!window._currentPet);
  var old = document.getElementById('sightPage_sub');
  if (old) { old.remove(); }
  if (!API._token) { showToast('⚠️ 请先登录'); return; }
  showToast('📋 正在打开上报页面...');
  const petData = await API.getPet(id);
  if (!petData || petData.error) { showToast('获取宠物信息失败'); return; }
  const petName = petData.name || '未知小动物';
  
  var wrap = document.createElement('div');
  wrap.id = 'sightPage_sub';
  wrap.className = 'sub-page';

  // 头部
  var header = document.createElement('div');
  header.className = 'sub-page-header';
  var backBtn = document.createElement('button');
  backBtn.className = 'sub-page-back';
  backBtn.innerHTML = '←';
  backBtn.onclick = closeSightPage;
  var title = document.createElement('span');
  title.className = 'sub-page-title';
  title.innerHTML = '📋 上报状况';
  header.appendChild(backBtn);
  header.appendChild(title);
  wrap.appendChild(header);

  // 内容区
  var body = document.createElement('div');
  body.className = 'sub-page-body';

  // 宠物信息卡片
  body.appendChild(makeCard(
    '<div style="font-size:16px;font-weight:600;margin-bottom:12px">🐾 ' + escHtml(petName) + '</div>' +
    '<div style="color:#999;font-size:13px">上传照片，上报TA的最新位置和健康状况</div>'
  ));

  // 照片区域
  var photoCard = document.createElement('div');
  photoCard.style.cssText = 'background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)';
  photoCard.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:8px">📷 照片 <span style="color:#f44336">*</span></div>';
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'sightPhoto';
  fileInput.accept = 'image/*';
  fileInput.capture = 'environment';
  fileInput.style.display = 'none';
  fileInput.onchange = function() { previewSightPhoto(this); };
  photoCard.appendChild(fileInput);
  var previewArea = document.createElement('div');
  previewArea.id = 'sightPhotoPreview';
  previewArea.style.cssText = 'border:2px dashed #ccc;border-radius:12px;padding:32px;text-align:center;cursor:pointer';
  previewArea.innerHTML = '<div style="font-size:36px;margin-bottom:8px">📸</div><div style="color:#999;font-size:13px">点击上传照片（必填）</div><div style="color:#bbb;font-size:11px;margin-top:4px">记录TA的当前状态</div>';
  previewArea.onclick = function() { document.getElementById('sightPhoto').click(); };
  photoCard.appendChild(previewArea);
  var thumbArea = document.createElement('div');
  thumbArea.id = 'sightPhotoThumb';
  thumbArea.style.cssText = 'display:none;margin-top:8px;position:relative';
  thumbArea.innerHTML = '<img id="sightPhotoImg" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px"><button type="button" onclick="clearSightPhoto()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px">✕</button>';
  photoCard.appendChild(thumbArea);
  body.appendChild(photoCard);

  // 地点
  var locCard = document.createElement('div');
  locCard.style.cssText = 'background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)';
  locCard.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:8px">📍 发现地点 <span style="color:#f44336">*</span></div>' +
    '<input type="text" id="sightLocation" placeholder="例如：一食堂门口、图书馆台阶..." style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none">';
  body.appendChild(locCard);

  // 健康状况选择
  var healthCard = document.createElement('div');
  healthCard.style.cssText = 'background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)';
  healthCard.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:10px">💊 健康状况 <span style="color:#999;font-weight:400">（选填）</span></div>' +
    '<div id="sightHealthOptions" style="display:flex;flex-wrap:wrap;gap:8px">' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="healthy" style="display:none"><span>😊 健康</span></label>' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="sick" style="display:none"><span>🤒 生病</span></label>' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="injured" style="display:none"><span>🤕 受伤</span></label>' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="pregnant" style="display:none"><span>🤰 怀孕</span></label>' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="nursing" style="display:none"><span>🐾 哺乳</span></label>' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="quarantine" style="display:none"><span>🏥 隔离</span></label>' +
    '<label style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:2px solid #e0e0e0;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s"><input type="radio" name="sightHealth" value="other" style="display:none"><span>❓ 其他</span></label>' +
    '</div>';
  body.appendChild(healthCard);
  // 健康状况单选按钮交互
  setTimeout(function() {
    var labels = document.querySelectorAll('#sightHealthOptions label');
    labels.forEach(function(lbl) {
      lbl.addEventListener('click', function() {
        labels.forEach(function(l) { l.style.borderColor = '#e0e0e0'; l.style.background = '#fff'; });
        lbl.style.borderColor = '#4CAF50';
        lbl.style.background = '#E8F5E9';
      });
    });
  }, 100);

  // 备注
  var noteCard = document.createElement('div');
  noteCard.style.cssText = 'background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)';
  noteCard.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:8px">📝 补充说明 <span style="color:#999;font-weight:400">（选填）</span></div>' +
    '<textarea id="sightNote" placeholder="描述TA的状态或你想说的..." rows="3" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;box-sizing:border-box;resize:none;outline:none"></textarea>';
  body.appendChild(noteCard);

  // 提交按钮
  var submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.id = 'sightSubmitBtn';
  submitBtn.innerHTML = '📋 提交上报';
  submitBtn.style.cssText = 'width:100%;padding:14px;background:linear-gradient(135deg,#4CAF50,#66BB6A);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(76,175,80,0.3)';
  submitBtn.onclick = function() { submitSight(id); };
  body.appendChild(submitBtn);

  wrap.appendChild(body);
  document.body.appendChild(wrap);
  openSubPage('sightPage_sub');
  console.log('[DEBUG] sightPage_sub created, childCount:', wrap.childNodes.length, 'body childCount:', wrap.lastChild.childNodes.length);
}



function makeCard(html) {
  var d = document.createElement('div');
  d.style.cssText = 'background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)';
  d.innerHTML = html;
  return d;
}



function closeSightPage() {
  closeSubPage('sightPage_sub');
}



function previewSightPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('sightPhotoImg').src = e.target.result;
    document.getElementById('sightPhotoPreview').style.display = 'none';
    document.getElementById('sightPhotoThumb').style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}



function clearSightPhoto() {
  document.getElementById('sightPhoto').value = '';
  document.getElementById('sightPhotoPreview').style.display = 'block';
  document.getElementById('sightPhotoThumb').style.display = 'none';
}



async function submitSight(id) {
  const phone = _phone();
  const location = (document.getElementById('sightLocation').value || '').trim();
  const note = (document.getElementById('sightNote').value || '').trim();
  const photoInput = document.getElementById('sightPhoto');
  const healthRadio = document.querySelector('input[name="sightHealth"]:checked');
  const health_status = healthRadio ? healthRadio.value : '';

  if (!photoInput.files || !photoInput.files[0]) {
    showToast('请上传照片'); return;
  }
  if (!location) {
    showToast('请填写发现地点'); return;
  }

  const btn = document.getElementById('sightSubmitBtn');
  btn.disabled = true; btn.textContent = '提交中...';

  const fd = new FormData();
  fd.append('phone', phone);
  fd.append('location', location);
  fd.append('note', note);
  fd.append('photo', photoInput.files[0]);
  if (health_status) fd.append('health_status', health_status);

  try {
    const res = await fetch('/api/pets/sight/' + id, {
      method: 'POST',
      body: fd,
      headers: API._authHeaders()
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error);
    } else {
      showToast('📋 上报成功！等待管理端审核确认');
      closeSightPage();
      await showPetDetail(id);
    }
  } catch(e) {
    showToast('提交失败，请重试');
  }
  btn.disabled = false; btn.textContent = '📋 提交上报';
}



function petToggleEmoji() {
  const panel = document.getElementById('petEmojiPanel');
  panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'flex' : 'none';
}



function insertPetEmoji(emoji) {
  const input = document.getElementById('petCommentText');
  const pos = input.selectionStart;
  input.value = input.value.slice(0, pos) + emoji + input.value.slice(pos);
  input.focus();
  input.setSelectionRange(pos + emoji.length, pos + emoji.length);
}



function petToggleMediaUpload() {
  document.getElementById('petMediaInput').click();
}



function petPreviewMedia(files) {
  _petCommentMedia = Array.from(files);
  const preview = document.getElementById('petMediaPreview');
  if (!_petCommentMedia.length) { preview.style.display = 'none'; return; }
  preview.style.display = 'flex';
  preview.style.gap = '4px';
  preview.style.flexWrap = 'wrap';
  preview.innerHTML = _petCommentMedia.map((f, i) => {
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      return '<div style="position:relative"><img src="' + url + '" style="width:60px;height:60px;object-fit:cover;border-radius:6px"><span onclick="_petCommentMedia.splice(' + i + ',1);petPreviewMedia(_petCommentMedia)" style="position:absolute;top:-4px;right:-4px;background:var(--danger);color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer">✕</span></div>';
    }
    return '<div style="position:relative;width:60px;height:60px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px">视频<span onclick="_petCommentMedia.splice(' + i + ',1);petPreviewMedia(_petCommentMedia)" style="position:absolute;top:-4px;right:-4px;background:var(--danger);color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer">✕</span></div>';
  }).join('');
}



async function submitPetComment() {
  if (!API._token) return showToast('请先登录');
  const text = document.getElementById('petCommentText').value.trim();
  if (!text && !_petCommentMedia.length) return showToast('请输入内容或上传媒体');

  const fd = new FormData();
  fd.append('phone', _phone());
  fd.append('nickname', localStorage.getItem('lazy_nickname') || '');
  fd.append('content', text);
  _petCommentMedia.forEach(f => fd.append('media', f));

  const data = await API.commentPet(_currentPetId, fd);
  if (data.error) return showToast(data.error);

  document.getElementById('petCommentText').value = '';
  _petCommentMedia = [];
  document.getElementById('petMediaPreview').style.display = 'none';
  document.getElementById('petMediaPreview').innerHTML = '';
  showToast('留言成功 ✨');
  showPetDetail(_currentPetId);
}



async function deletePetComment(commentId) {
  if (!confirm('确定删除这条留言？')) return;
  const phone = _phone();
  const data = await API.deletePetComment(commentId, phone);
  if (data.error) return showToast(data.error);
  showToast('已删除');
  showPetDetail(_currentPetId);
}

// ── Window exports ──
window.loadPets = loadPets;
window.filterPets = filterPets;
window.showPetDetail = showPetDetail;
window.renderPetComments = renderPetComments;
window._phone = _phone;
window.doPetLike = doPetLike;
window.openSightPage = openSightPage;
window.makeCard = makeCard;
window.closeSightPage = closeSightPage;
window.previewSightPhoto = previewSightPhoto;
window.clearSightPhoto = clearSightPhoto;
window.submitSight = submitSight;
window.petToggleEmoji = petToggleEmoji;
window.insertPetEmoji = insertPetEmoji;
window.petToggleMediaUpload = petToggleMediaUpload;
window.petPreviewMedia = petPreviewMedia;
window.submitPetComment = submitPetComment;
window.deletePetComment = deletePetComment;
