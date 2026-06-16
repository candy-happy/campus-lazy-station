// teachers.js - 教师留言
// 依赖: core.js (需先加载)

// escHtml 由 core.js 的 function escHtml(){} 声明提供（全局函数，所有脚本共用）

// ═══ 教师留言系统 ═══
let _teacherPage = 1;
let _teacherCollege = '全部';
let _teacherSearch = '';
let _selectedTeacherRating = 5;

async function loadTeacherColleges() {
  try {
    const res = await API.getTeacherColleges();
    if (res.colleges) {
      const bar = document.getElementById('teacherCollegeBar');
      let html = '<div class="teacher-college-tag active" data-college="全部" onclick="filterTeacherCollege(\'全部\')">全部</div>';
      res.colleges.forEach(c => {
        html += '<div class="teacher-college-tag" data-college="' + escHtml(c.college) + '" onclick="filterTeacherCollege(\'' + escHtml(c.college) + '\')">' + escHtml(c.college) + '(' + escHtml(String(c.count)) + ')</div>';
      });
      bar.innerHTML = html;
      setTimeout(updateTeacherCollegeArrows, 50);
      bar.onscroll = updateTeacherCollegeArrows;
    }
  } catch(e) { console.error('loadTeacherColleges:', e); }
}

function updateTeacherCollegeArrows() {
  const el = document.getElementById('teacherCollegeBar');
  const leftBtn = document.getElementById('teacherCollegeLeft');
  const rightBtn = document.getElementById('teacherCollegeRight');
  if (!el || !leftBtn || !rightBtn) return;
  const hasOverflow = el.scrollWidth > el.clientWidth + 2;
  const canScrollLeft = el.scrollLeft > 2;
  const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
  leftBtn.style.opacity = (hasOverflow && canScrollLeft) ? '1' : '0';
  leftBtn.style.pointerEvents = (hasOverflow && canScrollLeft) ? 'auto' : 'none';
  rightBtn.style.opacity = (hasOverflow && canScrollRight) ? '1' : '0';
  rightBtn.style.pointerEvents = (hasOverflow && canScrollRight) ? 'auto' : 'none';
}

function scrollTeacherCollege(dir) {
  const el = document.getElementById('teacherCollegeBar');
  if (!el) return;
  el.scrollBy({ left: dir * 200, behavior: 'smooth' });
}

function filterTeacherCollege(college) {
  _teacherCollege = college;
  _teacherPage = 1;
  document.querySelectorAll('.teacher-college-tag').forEach(t => t.classList.toggle('active', t.dataset.college === college));
  loadTeachers(true);
}

function searchTeachers() {
  _teacherSearch = document.getElementById('teacherSearchInput').value.trim();
  _teacherPage = 1;
  loadTeachers(true);
}

// ── 辅助：提取学位标签 ──
function getDegreeLabel(t) {
  const parts = [];
  if (t.graduate && t.graduate.includes('博士')) parts.push('博士');
  else if (t.education && t.education.includes('博士')) parts.push('博士');
  if (t.graduate && t.graduate.includes('硕士')) parts.push('硕士');
  else if (t.education && t.education.includes('硕士')) parts.push('硕士');
  return parts.length > 0 ? parts[0] : ''; // 只显示最高学位
}

// ── 辅助：截断文本 ──
function truncateText(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

async function loadTeachers(reset = true) {
  try {
    if (reset) _teacherPage = 1;
    const params = { page: _teacherPage, limit: 20 };
    if (_teacherCollege !== '全部') params.college = _teacherCollege;
    if (_teacherSearch) params.search = _teacherSearch;
    const res = await API.getTeachers(params);
    const container = document.getElementById('teacherListContainer');
    if (!container) return;
    if (reset) container.innerHTML = '';
    if (res.teachers && res.teachers.length > 0) {
      let html = '';
      res.teachers.forEach(t => {
        const degree = getDegreeLabel(t);
        const title = t.title || '';

        // 学位徽章
        const degreeBadge = degree
          ? '<span class="t-degree-badge">🎓 ' + escHtml(degree) + '</span>'
          : '';

        // 职称标签
        const titleTag = title
          ? '<span class="t-title-tag">' + escHtml(title) + '</span>'
          : '';

        // 研究方向标签（最多2个）
        let researchTags = '';
        if (t.research) {
          const items = t.research.split(/[，,、；;]/).filter(c => c.trim()).slice(0, 2);
          if (items.length > 0) {
            researchTags = '<div class="t-tags-row">' +
              items.map(c => '<span class="t-research-tag">' + escHtml(c.trim().substring(0, 12)) + '</span>').join('') +
              '</div>';
          }
        }

        // 课程标签（最多3个）
        let courseTags = '';
        if (t.courses) {
          const cList = t.courses.split(/[，,、；;]/).filter(c => c.trim()).slice(0, 3);
          if (cList.length > 0) {
            courseTags = '<div class="t-tags-row">' +
              cList.map(c => '<span class="t-course-tag">📖 ' + escHtml(c.trim().substring(0, 10)) + '</span>').join('') +
              '</div>';
          }
        }

        // 评分星星
        const stars = t.avg_rating ? '⭐'.repeat(Math.round(t.avg_rating)) : '';

        const avatarUrl = t.avatar ? '/uploads/teacher_avatars/' + t.avatar : '';
          const avatarHtml = avatarUrl
          ? '<img src="' + escHtml(avatarUrl) + '" class="teacher-avatar-img" alt="' + escHtml(t.name) + '" onerror="this.replaceWith(avatarFallback(this,\'' + escHtml(t.name.charAt(0)) + '\',\'teacher-avatar-lg\'))">'
          : '<div class="teacher-avatar-lg">' + escHtml(t.name.charAt(0)) + '</div>';
        html += '<div class="teacher-card" onclick="openTeacherDetail(' + t.id + ')">' +
          avatarHtml +
          '<div class="teacher-info">' +
            '<div class="teacher-name-row">' +
              '<span class="teacher-name">' + escHtml(t.name) + '</span>' +
              degreeBadge +
              titleTag +
            '</div>' +
            '<div class="teacher-meta">' + escHtml(t.college) + '</div>' +
            researchTags +
            courseTags +
            '<div class="teacher-stats">' +
              '<span class="teacher-stat">' + stars + '</span>' +
              '<span class="teacher-stat">👍 ' + (t.like_count||0) + '</span>' +
              '<span class="teacher-stat">💬 ' + (t.review_count||0) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
      container.innerHTML += html;
      document.getElementById('teacherLoadMore').style.display = res.page < res.totalPages ? 'block' : 'none';
    } else {
      if (reset) container.innerHTML = '<div style="text-align:center;padding:40px 0;color:#999"><div style="font-size:48px;margin-bottom:12px">👨‍🏫</div>暂无教师数据</div>';
      document.getElementById('teacherLoadMore').style.display = 'none';
    }
    _teacherPage++;
  } catch(e) { console.error('loadTeachers:', e); }
}

async function openTeacherDetail(id) {
  try {
    const res = await API.getTeacherDetail(id);
    const t = res.teacher;
    if (!t) return showToast('教师不存在');

    // ── 头部卡片 ──
    const detailAvatarUrl = t.avatar ? '/uploads/teacher_avatars/' + t.avatar : '';
      const detailAvatar = detailAvatarUrl
        ? '<img src="' + escHtml(detailAvatarUrl) + '" class="t-detail-avatar" style="object-fit:cover" onerror="this.replaceWith(avatarFallback(this,\'' + escHtml(t.name.charAt(0)) + '\',\'t-detail-avatar\'))">'
        : '<div class="t-detail-avatar">' + escHtml(t.name.charAt(0)) + '</div>';
    document.getElementById('teacherInfoHeader').innerHTML =
      '<div class="t-detail-header">' +
        detailAvatar +
        '<div class="t-detail-name">' + escHtml(t.name) + '</div>' +
        '<div class="t-detail-sub">' + escHtml(t.college) + (t.title ? ' · ' + escHtml(t.title) : '') + '</div>' +
        '<div class="t-detail-stats">' +
          '<div class="t-detail-stat"><div class="t-ds-num">' + (t.like_count||0) + '</div><div class="t-ds-label">点赞</div></div>' +
          '<div class="t-ds-divider"></div>' +
          '<div class="t-detail-stat"><div class="t-ds-num">' + (t.review_count||0) + '</div><div class="t-ds-label">留言</div></div>' +
          (t.avg_rating ? '<div class="t-ds-divider"></div><div class="t-detail-stat"><div class="t-ds-num">' + Number(t.avg_rating).toFixed(1) + '</div><div class="t-ds-label">评分</div></div>' : '') +
        '</div>' +
      '</div>';

    // ── 结构化信息 ──
    const sections = [];

    // 学位信息
    const degree = getDegreeLabel(t);
    const gradSchool = t.graduate ? t.graduate.replace(/^(教授|副教授|讲师|助教)[。，;]*/g, '').trim() : '';
    if (degree || gradSchool) {
      let eduHtml = '<div class="t-info-section"><div class="t-info-title">🎓 学历背景</div><div class="t-info-tags">';
      if (degree) eduHtml += '<span class="t-info-badge degree">' + escHtml(degree) + '</span>';
      if (gradSchool && gradSchool.length > 2 && gradSchool.length < 50) eduHtml += '<span class="t-info-badge school">' + escHtml(gradSchool) + '</span>';
      eduHtml += '</div></div>';
      sections.push(eduHtml);
    }

    // 研究方向
    if (t.research) {
      const items = t.research.split(/[，,、；;]/).filter(c => c.trim());
      sections.push('<div class="t-info-section"><div class="t-info-title">🔬 研究方向</div><div class="t-info-tags">' +
        items.map(c => '<span class="t-info-badge research">' + escHtml(c.trim()) + '</span>').join('') +
        '</div></div>');
    }

    // 主讲课程
    if (t.courses) {
      const items = t.courses.split(/[，,、；;]/).filter(c => c.trim()).map(c => c.replace(/《/g,'').replace(/》/g,'').trim());
      sections.push('<div class="t-info-section"><div class="t-info-title">📖 主讲课程</div><div class="t-info-tags">' +
        items.map(c => '<span class="t-info-badge course">' + escHtml(c) + '</span>').join('') +
        '</div></div>');
    }

    // 个人简介（精简版，只保留核心描述）
    if (t.bio) {
      let cleanBio = t.bio;
      // 去掉导航文本
      if (/学校首页|网站首页|学院概况|师资结构|教师简介|教师风采|党建工作|团学工作|辅导员队伍|招生就业|下载专区/.test(cleanBio)) {
        cleanBio = '';
      } else {
        // 提取第一段有意义的话（跳过姓名+职称开头）
        cleanBio = cleanBio.replace(/^[^。]{1,8}[。，;]/, '');
        cleanBio = cleanBio.replace(/研究方向[：:][^。；;]+[。；;]?/g, '');
        cleanBio = cleanBio.replace(/主讲课程[：:][^。；;]+[。；;]?/g, '');
        cleanBio = cleanBio.replace(/邮箱[：:]?\s*\S+@\S+\.\S+/g, '');
        cleanBio = cleanBio.replace(/\S+@\S+\.\S+/g, '');
        cleanBio = cleanBio.replace(/^[,，。；;、\s]+/, '');
        cleanBio = cleanBio.trim();
      }
      if (cleanBio.length > 10) {
        // 智能摘要：提取完整句子，去重，最多保留前3句
        const sentences = cleanBio.split(/(?<=[。；?!；])/).map(s => s.trim()).filter(s => s.length > 4);
        // 去重（保留首次出现）
        const seen = new Set();
        const unique = sentences.filter(s => {
          const key = s.substring(0, 10); // 按前10字去重
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        // 最多取前3句，超长内容截断到最后一句末（不在中间断句）
        let displayBio = unique.slice(0, 3).join(' ');
        if (displayBio.length > 300) {
          // 找最后一句的结尾位置，在300字以内尽量保持完整句
          const lastFullStop = displayBio.lastIndexOf('。', 300);
          displayBio = lastFullStop > 50 ? displayBio.substring(0, lastFullStop + 1) : displayBio.substring(0, 300);
        }
        sections.push('<div class="t-info-section"><div class="t-info-title">📝 简介</div>' +
          '<div class="t-bio-text">' + escHtml(displayBio) + '</div></div>');
      }
    }

    document.getElementById('teacherDetailInfo').innerHTML = sections.length > 0
      ? sections.join('')
      : '<div style="text-align:center;padding:20px;color:#999;font-size:13px">暂无详细信息</div>';

    // 操作区
    const likeDisabled = res.todayLiked ? 'opacity:.5;pointer-events:none' : '';
    const likeText = res.todayLiked ? _t('teacherLiked') : _t('teacherLike');
    const reviewDisabled = res.todayReviewed ? 'opacity:.5;pointer-events:none' : '';
    document.getElementById('teacherActionArea').innerHTML =
      '<div class="t-action-row">' +
        '<button onclick="likeTeacher(' + t.id + ')" class="t-action-btn like" style="' + likeDisabled + '">👍 ' + likeText + '</button>' +
        '<button onclick="showTeacherReviewForm(' + t.id + ')" class="t-action-btn review" style="' + reviewDisabled + '">✍️ ' + (res.todayReviewed ? '已留言' : '写留言') + '</button>' +
      '</div>' +
      (res.todayLiked ? '<div class="t-action-hint">✅ 今天已给这位老师点赞</div>' : '<div class="t-action-hint">💡 每位老师每天可点赞一次</div>') +
      (res.todayReviewed ? '<div class="t-action-hint">✅ 今天已给这位老师留言</div>' : '');

    // 留言列表
    const reviewList = document.getElementById('teacherReviewList');
    if (res.reviews && res.reviews.length > 0) {
      reviewList.innerHTML = res.reviews.map(r => {
        const displayName = r.is_anonymous ? '匿名' : escHtml(r.nickname || '匿名');
        const avatarHtml = r.is_anonymous
          ? '<div class="t-review-avatar anon">🕵</div>'
          : (r.avatar ? '<img src="' + r.avatar + '" class="t-review-avatar" onclick="showWallUser(\'' + r.phone + '\')">' : '<div class="t-review-avatar" onclick="showWallUser(\'' + r.phone + '\')">' + (r.nickname||'匿').charAt(0) + '</div>');
        let mediaHtml = '';
        if (r.media_url) {
          try {
            const media = JSON.parse(r.media_url);
            if (Array.isArray(media) && media.length > 0) {
              mediaHtml = '<div class="t-review-media">' +
                media.map(m => {
                  const isVideo = /\.mp4|\.mov|\.webm/i.test(m);
                  return isVideo
                    ? '<video src="' + m + '" muted preload="metadata" onclick="this.paused?this.play():this.pause()"></video>'
                    : '<img src="' + m + '" onclick="previewImage(this.src)">';
                }).join('') + '</div>';
            }
          } catch(e) {
            const isVideo = /\.mp4|\.mov|\.webm/i.test(r.media_url);
            mediaHtml = isVideo
              ? '<div class="t-review-media"><video src="' + r.media_url + '" muted controls></video></div>'
              : '<div class="t-review-media"><img src="' + r.media_url + '" onclick="previewImage(this.src)"></div>';
          }
        }
        return '<div class="teacher-review-card">' +
          '<div class="teacher-review-header">' + avatarHtml + '<span class="teacher-review-user">' + displayName + '</span><span class="teacher-review-date">' + (r.created_at||'').slice(0,10) + '</span></div>' +
          '<div class="teacher-review-content">' + escHtml(r.content) + '</div>' +
          mediaHtml +
          '<div class="t-review-actions">' +
            '<button onclick="shareComment(\'teacher\',\'师说\',\'' + escHtml((r.content||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')) + '\',\'' + escHtml((r.nickname||'用户').replace(/'/g,"\\'")) + '\')" class="t-review-btn">📤</button>' +
            '<button onclick="showReportMenu(\'comment\',' + r.id + ',\'teacher\')" class="t-review-btn">🚫</button>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      reviewList.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:13px">暂无留言，来做第一个留言者吧！</div>';
    }

    openSubPage('teacherDetailPage_sub');
  } catch(e) { console.error('openTeacherDetail:', e); showToast(_t('loadFailed')); }
}

async function likeTeacher(id) {
  if (!API._token) return showToast('请先登录');
  try {
    const res = await API.likeTeacher(id);
    if (res.liked) {
      showToast('👍 点赞成功！');
      openTeacherDetail(id);
    } else {
      showToast(res.error || '点赞失败');
    }
  } catch(e) { showToast(e.message || '点赞失败'); }
}

function showTeacherReviewForm(teacherId) {
  _selectedTeacherRating = 5;
  _reviewAnonymous = false;
  _reviewMediaUrls = [];
  const form = document.createElement('div');
  form.id = 'teacherReviewOverlay';
  form.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center';
  const emojis = ['😊','😂','🤣','😍','🥰','😘','😜','🤔','😮','😢','😡','👍','👎','❤️','🔥','💯','✨','🎉','👏','🙏','💪','😎','🥳','😴','🤯','🤩','💕','👋','✅','⭐'];
  const emojiGrid = emojis.map(e => '<span style="font-size:22px;padding:4px;cursor:pointer" onclick="insertReviewEmoji(\''+e+'\')">'+e+'</span>').join('');
  form.innerHTML = '<div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:500px;padding:20px;max-height:75vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<span style="font-weight:700;font-size:16px">' + _t('teacherWriteReview') + '</span>' +
      '<button onclick="document.getElementById(\'teacherReviewOverlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer">✕</button>' +
    '</div>' +
    '<div style="margin-bottom:12px"><div style="font-size:13px;color:#666;margin-bottom:6px">评分</div>' +
      '<div class="teacher-star-select" id="teacherStarSelect">' +
        '<span onclick="selectTeacherRating(1)" style="color:#FFC107">★</span>' +
        '<span onclick="selectTeacherRating(2)" style="color:#FFC107">★</span>' +
        '<span onclick="selectTeacherRating(3)" style="color:#FFC107">★</span>' +
        '<span onclick="selectTeacherRating(4)" style="color:#FFC107">★</span>' +
        '<span onclick="selectTeacherRating(5)" style="color:#FFC107">★</span>' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:12px;display:flex;align-items:center;gap:12px">' +
      '<span style="font-size:13px;color:#666">显示方式：</span>' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px"><input type="radio" name="reviewAnon" value="0" checked onchange="_reviewAnonymous=false;document.getElementById(\'anonHint\').style.display=\'none\'"> ' + _t('teacherReviewPublic') + '</label>' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px"><input type="radio" name="reviewAnon" value="1" onchange="_reviewAnonymous=true;document.getElementById(\'anonHint\').style.display=\'block\'"> 🕵 ' + _t('teacherReviewAnonymous') + '</label>' +
      '<span id="anonHint" style="font-size:11px;color:#F57F17;display:none;margin-left:4px">匿名后他人无法查看你的主页</span>' +
    '</div>' +
    '<div style="margin-bottom:8px"><div style="font-size:13px;color:#666;margin-bottom:6px">评价内容</div>' +
      '<textarea id="teacherReviewContent" rows="4" maxlength="500" placeholder="分享你对这位老师的真实感受..." style="width:100%;padding:10px;border-radius:10px;border:1px solid #ddd;font-size:14px;resize:none;outline:none"></textarea>' +
      '<div style="text-align:right;font-size:11px;color:#999"><span id="teacherReviewCharCount">0</span>/500</div>' +
    '</div>' +
    '<div style="margin-bottom:10px">' +
      '<button onclick="document.getElementById(\'reviewEmojiPanel\').style.display=document.getElementById(\'reviewEmojiPanel\').style.display===\'none\'?\'block\':\'none\'" style="background:none;border:1px solid #ddd;border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer">' + _t('teacherReviewEmoji') + '</button>' +
      '<div id="reviewEmojiPanel" style="display:none;margin-top:8px;padding:8px;background:#f9f9f9;border-radius:10px;display:none;flex-wrap:wrap;gap:2px">' + emojiGrid + '</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<label style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;border:1px solid #ddd;cursor:pointer;font-size:13px;color:#666">' +
          '<input type="file" id="reviewMediaInput" multiple style="display:none" onchange="handleReviewMedia(this)"> ' + _t('teacherReviewMedia') + '</label>' +
        '<span id="reviewMediaCount" style="font-size:11px;color:#999"></span>' +
      '</div>' +
      '<div id="reviewMediaPreview" style="display:flex;flex-wrap:wrap;gap:6px"></div>' +
    '</div>' +
    '<button onclick="submitTeacherReview(' + teacherId + ')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#1565C0,#1976D2);color:#fff;font-size:15px;font-weight:600;cursor:pointer">提交评价</button>' +
  '</div>';
  document.body.appendChild(form);
  form.addEventListener('click', e => { if (e.target === form) form.remove(); });
  document.getElementById('teacherReviewContent').addEventListener('input', function() {
    document.getElementById('teacherReviewCharCount').textContent = this.value.length;
  });
  document.getElementById('reviewEmojiPanel').style.display = 'none';
}

function selectTeacherRating(n) {
  _selectedTeacherRating = n;
  const stars = document.querySelectorAll('#teacherStarSelect span');
  stars.forEach((s, i) => { s.style.color = i < n ? '#FFC107' : '#ddd'; });
}

function insertReviewEmoji(emoji) {
  const ta = document.getElementById('teacherReviewContent');
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + emoji + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + emoji.length;
  ta.focus();
  document.getElementById('teacherReviewCharCount').textContent = ta.value.length;
}

async function handleReviewMedia(input) {
  const files = Array.from(input.files).slice(0, 6 - _reviewMediaUrls.length);
  if (files.length === 0) return;
  const preview = document.getElementById('reviewMediaPreview');
  const countEl = document.getElementById('reviewMediaCount');

  for (const file of files) {
    const fd = new FormData();
    fd.append('files', file);
    try {
      const res = await fetch('/api/teachers/upload-media', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.urls && data.urls.length > 0) {
        data.urls.forEach(url => {
          _reviewMediaUrls.push(url);
          const isVideo = /\.mp4|\.mov|\.webm/i.test(url);
          const div = document.createElement('div');
          div.style.cssText = 'position:relative;width:72px;height:72px';
          div.innerHTML = (isVideo
            ? '<video src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px" muted></video>'
            : '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px">') +
            '<span onclick="removeReviewMedia(' + (_reviewMediaUrls.length-1) + ',this)" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#f44336;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>';
          preview.appendChild(div);
        });
      }
    } catch(e) { showToast('上传失败: ' + e.message); }
  }
  countEl.textContent = _reviewMediaUrls.length + '/6';
  input.value = '';
}

function removeReviewMedia(index, el) {
  _reviewMediaUrls.splice(index, 1);
  el.parentElement.remove();
  document.getElementById('reviewMediaCount').textContent = _reviewMediaUrls.length + '/6';
}

async function submitTeacherReview(teacherId) {
  if (!API._token) return showToast('请先登录');
  const content = document.getElementById('teacherReviewContent').value.trim();
  if (!content) return showToast('请输入评价内容');
  const mediaUrl = _reviewMediaUrls.length > 0 ? JSON.stringify(_reviewMediaUrls) : '';
  try {
    const res = await API.reviewTeacher(teacherId, _selectedTeacherRating, content, _reviewAnonymous ? 1 : 0, mediaUrl);
    if (res.reviewed) {
      showToast('✅ 评价提交成功！');
      const overlay = document.getElementById('teacherReviewOverlay');
      if (overlay) overlay.remove();
      openTeacherDetail(teacherId);
    } else {
      showToast(res.error || '评价失败');
    }
  } catch(e) { showToast(e.message || '评价失败'); }
}

// ── Window exports ──
window.loadTeacherColleges = loadTeacherColleges;
window.filterTeacherCollege = filterTeacherCollege;
window.searchTeachers = searchTeachers;
window.loadTeachers = loadTeachers;
window.openTeacherDetail = openTeacherDetail;
window.likeTeacher = likeTeacher;
window.showTeacherReviewForm = showTeacherReviewForm;
window.selectTeacherRating = selectTeacherRating;
window.insertReviewEmoji = insertReviewEmoji;
window.handleReviewMedia = handleReviewMedia;
window.removeReviewMedia = removeReviewMedia;
window.submitTeacherReview = submitTeacherReview;

// ── 头像加载失败回退（避免 onerror 中 outerHTML 引号嵌套导致 HTML 标签泄露为文本）──
window.avatarFallback = function(img, char, cls) {
  var d = document.createElement('div');
  d.className = cls;
  d.textContent = char;
  return d;
};
