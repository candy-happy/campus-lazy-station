// teachers.js - 教师留言
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码


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
      bar.innerHTML = '<div class="teacher-college-tag active" data-college="全部" onclick="filterTeacherCollege(\'全部\')">全部</div>';
      res.colleges.forEach(c => {
        bar.innerHTML += '<div class="teacher-college-tag" data-college="' + escHtml(c.college) + '" onclick="filterTeacherCollege(\'' + escHtml(c.college) + '\')">' + escHtml(c.college) + '(' + escHtml(String(c.count)) + ')</div>';
      });
      // 设置滚动监听更新箭头
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
      res.teachers.forEach(t => {
        const ratingClass = t.avg_rating >= 4 ? 'teacher-rating-high' : t.avg_rating >= 3 ? 'teacher-rating-mid' : 'teacher-rating-low';
        const titleTag = t.title ? '<span style="font-size:11px;color:#FF6B35;background:#FFF3E0;padding:1px 6px;border-radius:4px;margin-left:6px">' + escHtml(t.title) + '</span>' : '';
        const gradTag = t.graduate ? '<span style="font-size:10px;color:#7B1FA2;background:#F3E5F5;padding:1px 6px;border-radius:4px;margin-left:4px">' + (t.graduate.includes('博士') ? '博士' : '硕士') + '</span>' : (t.education && t.education.includes('博士') ? '<span style="font-size:10px;color:#7B1FA2;background:#F3E5F5;padding:1px 6px;border-radius:4px;margin-left:4px">博士</span>' : '');
        // 课程标签（最多3个）
        let courseTags = '';
        if (t.courses) {
          const cList = t.courses.split(/[，,、；;]/).filter(c => c.trim()).slice(0, 3);
          courseTags = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' +
            cList.map(c => '<span style="font-size:10px;color:#FF6B35;background:#FFF3E0;padding:1px 6px;border-radius:4px">' + escHtml(c.trim()) + '</span>').join('') + '</div>';
        }
        container.innerHTML += '<div class="teacher-card" onclick="openTeacherDetail(' + t.id + ')">' +
          '<div class="teacher-avatar-lg">' + t.name.charAt(0) + '</div>' +
          '<div class="teacher-info">' +
            '<div class="teacher-name">' + escHtml(t.name) + titleTag + gradTag + '</div>' +
            '<div class="teacher-meta">' + escHtml(t.college) + '</div>' +
            (t.research ? '<div class="teacher-meta" style="font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🔬 ' + escHtml(t.research.substring(0, 28)) + (t.research.length > 28 ? '...' : '') + '</div>' : '') +
            courseTags +
            '<div class="teacher-stats">' +
              '<span class="teacher-stat">👍 ' + (t.like_count||0) + '</span>' +
              '<span class="teacher-stat">💬 ' + (t.review_count||0) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
      // 显示/隐藏加载更多
      document.getElementById('teacherLoadMore').style.display = res.page < res.totalPages ? 'block' : 'none';
      // 不再在此处重新加载学院标签，避免覆盖用户选中的学院
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

    // ── 教师信息头部卡片（渐变背景） ──
    const researchTags = t.research
      ? t.research.split(/[，,、；;]/).filter(r => r.trim()).map(r =>
          '<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:rgba(255,255,255,.2);font-size:11px;margin:2px">' + escHtml(r.trim()) + '</span>'
        ).join('')
      : '';

    document.getElementById('teacherInfoHeader').innerHTML =
      '<div style="background:linear-gradient(135deg,#FF6B35,#FF8C5A);padding:28px 16px 22px;color:#fff;text-align:center">' +
        '<div style="width:76px;height:76px;font-size:32px;margin:0 auto 12px;background:rgba(255,255,255,.2);color:#fff;border:3px solid rgba(255,255,255,.4);border-radius:50%;display:flex;align-items:center;justify-content:center">' + t.name.charAt(0) + '</div>' +
        '<div style="font-size:22px;font-weight:700">' + escHtml(t.name) + '</div>' +
        '<div style="font-size:13px;opacity:.85;margin-top:6px">' + escHtml(t.college) + (t.title ? ' · ' + escHtml(t.title) : '') + '</div>' +
        (researchTags ? '<div style="margin-top:10px">' + researchTags + '</div>' : '') +
        '<div style="display:flex;gap:24px;justify-content:center;margin-top:16px">' +
          '<div style="text-align:center"><div style="font-size:22px;font-weight:700">' + (t.like_count||0) + '</div><div style="font-size:10px;opacity:.7">点赞</div></div>' +
          '<div style="width:1px;height:30px;background:rgba(255,255,255,.3)"></div>' +
          '<div style="text-align:center"><div style="font-size:22px;font-weight:700">' + (t.review_count||0) + '</div><div style="font-size:10px;opacity:.7">留言</div></div>' +
        '</div>' +
      '</div>';

    // ── 结构化信息区块 ──
    const infoParts = [];

    // 个人简介（放在最前面）
    if (t.bio) {
      let cleanBio = t.bio;
      cleanBio = cleanBio.replace(/^(教授|副教授|讲师|助教|高级工程师)[。，;]/, '');
      cleanBio = cleanBio.replace(/研究方向[：:][^。]+。?/, '');
      cleanBio = cleanBio.replace(/主讲课程[：:][^]+$/, '');
      cleanBio = cleanBio.replace(/(\d{4}年|年)(博士|硕士)毕业于[^。]+。?/g, '');
      cleanBio = cleanBio.replace(/(本科|硕士|博士|硕士研究生|博士研究生|大学本科)[。，;]*/g, '');
      cleanBio = cleanBio.replace(/邮箱[：:]?\s*[^\s，。;]+/g, '');
      cleanBio = cleanBio.replace(/\S+@\S+\.\S+/g, '');
      cleanBio = cleanBio.trim();
      if (cleanBio.length > 5) {
        infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">📝 个人简介</div>' +
          '<div class="teacher-info-item" style="color:#555;line-height:1.7">' + escHtml(cleanBio) + '</div></div>');
      }
    }

    // 毕业院校
    const eduParts = [];
    if (t.undergraduate) eduParts.push('<div class="teacher-info-item">🎓 本科：' + escHtml(t.undergraduate) + '</div>');
    if (t.graduate) eduParts.push('<div class="teacher-info-item">🎓 研究生：' + escHtml(t.graduate) + '</div>');
    if (t.education && eduParts.length === 0) eduParts.push('<div class="teacher-info-item">🏫 ' + escHtml(t.education) + '</div>');
    if (eduParts.length > 0) {
      infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">🎓 毕业院校</div>' +
        eduParts.join('') + '</div>');
    }

    // 主讲课程
    if (t.courses) {
      const courseList = t.courses.split(/[，,、；;]/).filter(c => c.trim()).map(c => c.replace(/《/g,'').replace(/》/g,'').trim());
      infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">📖 主讲课程</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
          courseList.map(c => '<span class="teacher-course-tag">' + escHtml(c) + '</span>').join('') +
        '</div></div>');
    }

    // 学术论文
    if (t.papers) {
      const paperLines = t.papers.split(/[；;]/).filter(l => l.trim());
      infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">📄 学术论文</div>' +
        paperLines.map(p => '<div class="teacher-info-item" style="padding:6px 0;border-bottom:1px solid #f0f0f0">• ' + escHtml(p.trim()) + '</div>').join('') +
      '</div>');
    }

    // 科研项目
    if (t.projects) {
      const projLines = t.projects.split(/[；;]/).filter(l => l.trim());
      infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">🔬 科研项目</div>' +
        projLines.map(p => '<div class="teacher-info-item" style="padding:6px 0;border-bottom:1px solid #f0f0f0">• ' + escHtml(p.trim()) + '</div>').join('') +
      '</div>');
    }

    // 主要成果
    if (t.achievements) {
      const achLines = t.achievements.split('\n').filter(l => l.trim());
      infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">🏆 主要成果</div>' +
        achLines.map(a => '<div class="teacher-info-item" style="padding:6px 0;border-bottom:1px solid #f0f0f0">🏅 ' + escHtml(a) + '</div>').join('') +
      '</div>');
    }

    // 社会兼职
    if (t.social_roles) {
      const roleLines = t.social_roles.split(/[；;]/).filter(l => l.trim());
      infoParts.push('<div class="teacher-info-section"><div class="teacher-info-title">🌐 社会兼职</div>' +
        roleLines.map(r => '<div class="teacher-info-item">• ' + escHtml(r.trim()) + '</div>').join('') +
      '</div>');
    }
    
    document.getElementById('teacherDetailInfo').innerHTML = infoParts.length > 0
      ? infoParts.join('')
      : '<div style="text-align:center;padding:12px;color:#999;font-size:13px">暂无详细信息</div>';
    
    // 操作区
    const likeDisabled = res.todayLiked ? 'opacity:.5;pointer-events:none' : '';
    const likeText = res.todayLiked ? _t('teacherLiked') : _t('teacherLike');
    const reviewDisabled = res.todayReviewed ? 'opacity:.5;pointer-events:none' : '';
    document.getElementById('teacherActionArea').innerHTML =
      '<div style="display:flex;gap:12px;justify-content:center">' +
        '<button onclick="likeTeacher(' + t.id + ')" style="flex:1;padding:10px;border-radius:12px;border:none;background:#FFF3E0;color:#FF6B35;font-size:14px;font-weight:600;cursor:pointer;' + likeDisabled + '">👍 ' + likeText + '</button>' +
        '<button onclick="showTeacherReviewForm(' + t.id + ')" style="flex:1;padding:10px;border-radius:12px;border:none;background:#FFF8E1;color:#F57F17;font-size:14px;font-weight:600;cursor:pointer;' + reviewDisabled + '">✍️ ' + (res.todayReviewed ? '已留言' : '写留言') + '</button>' +
      '</div>' +
      (res.todayLiked ? '<div style="text-align:center;font-size:11px;color:#999;margin-top:6px">✅ 今天已给这位老师点赞</div>' : '<div style="text-align:center;font-size:11px;color:#999;margin-top:6px">💡 每位老师每天可点赞一次</div>') +
      (res.todayReviewed ? '<div style="text-align:center;font-size:11px;color:#999;margin-top:6px">✅ 今天已给这位老师留言</div>' : '');
    
    // 留言列表
    const reviewList = document.getElementById('teacherReviewList');
    if (res.reviews && res.reviews.length > 0) {
      reviewList.innerHTML = res.reviews.map(r => {
        const displayName = r.is_anonymous ? '匿名' : escHtml(r.nickname || '匿名');
        const avatarHtml = r.is_anonymous
          ? '<div style="width:28px;height:28px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999">🕵</div>'
          : (r.avatar ? '<img src="' + r.avatar + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="showWallUser(\'' + r.phone + '\')">' : '<div style="width:28px;height:28px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;cursor:pointer" onclick="showWallUser(\'' + r.phone + '\')">' + (r.nickname||'匿').charAt(0) + '</div>');
        // 媒体展示
        let mediaHtml = '';
        if (r.media_url) {
          try {
            const media = JSON.parse(r.media_url);
            if (Array.isArray(media) && media.length > 0) {
              mediaHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
                media.map(m => {
                  const isVideo = /\.mp4|\.mov|\.webm/i.test(m);
                  return isVideo
                    ? '<video src="' + m + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px" muted preload="metadata" onclick="this.paused?this.play():this.pause()"></video>'
                    : '<img src="' + m + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="previewImage(this.src)">';
                }).join('') + '</div>';
            }
          } catch(e) {
            // 单个URL
            const isVideo = /\.mp4|\.mov|\.webm/i.test(r.media_url);
            mediaHtml = isVideo
              ? '<div style="margin-top:8px"><video src="' + r.media_url + '" style="max-width:200px;border-radius:8px" muted controls></video></div>'
              : '<div style="margin-top:8px"><img src="' + r.media_url + '" style="max-width:200px;border-radius:8px;cursor:pointer" onclick="previewImage(this.src)"></div>';
          }
        }
        return '<div class="teacher-review-card">' +
          '<div class="teacher-review-header">' + avatarHtml + '<span class="teacher-review-user">' + displayName + '</span><span class="teacher-review-date">' + (r.created_at||'').slice(0,10) + '</span></div>' +
          '<div class="teacher-review-content">' + escHtml(r.content) + '</div>' +
          mediaHtml +
          '<div style="margin-top:6px;display:flex;gap:6px">' +
            '<button onclick="shareComment(\'teacher\',\'师说\',\'' + escHtml((r.content||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')) + '\',\'' + escHtml((r.nickname||'用户').replace(/'/g,"\\'")) + '\')" style="background:none;border:none;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:3px 8px;border-radius:10px;opacity:0.45;transition:opacity 0.15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.45\'">📤</button>' +
            '<button onclick="showReportMenu(\'comment\',' + r.id + ',\'teacher\')" style="background:none;border:none;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:3px 8px;border-radius:10px;opacity:0.45;transition:opacity 0.15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.45\'">🚫</button>' +
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
      openTeacherDetail(id); // 刷新详情
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
  // emoji面板
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
    // 匿名/公开切换
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
    // Emoji面板
    '<div style="margin-bottom:10px">' +
      '<button onclick="document.getElementById(\'reviewEmojiPanel\').style.display=document.getElementById(\'reviewEmojiPanel\').style.display===\'none\'?\'block\':\'none\'" style="background:none;border:1px solid #ddd;border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer">' + _t('teacherReviewEmoji') + '</button>' +
      '<div id="reviewEmojiPanel" style="display:none;margin-top:8px;padding:8px;background:#f9f9f9;border-radius:10px;display:none;flex-wrap:wrap;gap:2px">' + emojiGrid + '</div>' +
    '</div>' +
    // 媒体上传
    '<div style="margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<label style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;border:1px solid #ddd;cursor:pointer;font-size:13px;color:#666">' +
          '<input type="file" id="reviewMediaInput" accept="image/*,video/*" multiple style="display:none" onchange="handleReviewMedia(this)"> ' + _t('teacherReviewMedia') + '</label>' +
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
  // 修复emoji面板display
  document.getElementById('reviewEmojiPanel').style.display = 'none';
}



function selectTeacherRating(n) {
  _selectedTeacherRating = n;
  const stars = document.querySelectorAll('#teacherStarSelect span');
  stars.forEach((s, i) => { s.style.color = i < n ? '#FFC107' : '#ddd'; });
}


// 插入emoji到评价输入框

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


// 处理评价媒体文件

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
      openTeacherDetail(teacherId); // 刷新详情
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
