// wall.js - 校园墙
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码



    function replyToComment(commentId, name) {
      _replyToCommentId = commentId;
      _replyToCommentName = name;
      const hintEl = document.getElementById('replyHint');
      const nameEl = document.getElementById('replyName');
      const inputEl = document.getElementById('commentInput');
      if (hintEl) hintEl.style.display = 'flex';
      if (nameEl) nameEl.textContent = name;
      if (inputEl) { inputEl.placeholder = '回复 ' + name + '...'; inputEl.focus(); }
    }



    function toggleCommentEmoji() {
      const panel = document.getElementById('commentEmojiPanel');
      if (!panel) return;
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        if (!panel.innerHTML) {
          const emojis = ['😀','😂','🤣','😊','😍','🥰','😘','😜','🤔','😎','🥺','😢','😤','👍','👏','🙏','💪','🎉','❤️','🔥','💯','✨','👀','🤝','💰','🎁','📦','🛒','📱','💻','📚','🎮','🎵','🍕','🍔','☕','🍦','⚽','🏠','🚀','⭐','🌈','💡','🔔','💬','🤗','😌','🤩','😇','🥳'];
          panel.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:8px;background:var(--bg);border-radius:10px;max-height:160px;overflow-y:auto">' +
            emojis.map(e => '<span style="font-size:22px;cursor:pointer;padding:4px;border-radius:6px;transition:background 0.15s" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'" onclick="insertCommentEmoji(\'' + e + '\')">' + e + '</span>').join('') +
          '</div>';
        }
      } else {
        panel.style.display = 'none';
      }
    }



    function insertCommentEmoji(emoji) {
      const input = document.getElementById('commentInput');
      if (input) {
        const start = input.selectionStart;
        input.value = input.value.substring(0, start) + emoji + input.value.substring(input.selectionEnd);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
      }
    }


    // ═══════════════════════════════════════════════════════
    // 🧱 校园墙
    // ═══════════════════════════════════════════════════════
    let wallTab = 'latest';
    let wallPosts = [];
    let wallTagFilter = ''; // 当前标签筛选


    function switchWallTab(tab) {
      wallTab = tab;
      wallTagFilter = ''; // 切换tab时清空标签筛选
      document.querySelectorAll('.wall-tab').forEach(t => t.classList.remove('active'));
      const labels = { latest: '最新', hot: '热门', following: '关注', mine: '我的' };
      document.querySelectorAll('.wall-tab').forEach(t => {
        if (t.textContent === labels[tab]) t.classList.add('active');
      });
      loadWallFeed();
      loadHotTags();
    }


    // 标签筛选

    function filterByTag(tag) {
      if (wallTagFilter === tag) {
        wallTagFilter = ''; // 再次点击取消筛选
      } else {
        wallTagFilter = tag;
      }
      loadWallFeed();
    }



    async function loadWallFeed() {
      if (!currentUser) return;
      const params = { tab: wallTab === 'mine' ? 'latest' : wallTab, phone: currentUser.phone };
      if (wallTagFilter) params.tag = wallTagFilter;
      let data = await API.wallFeed(params);
      wallPosts = Array.isArray(data) ? data : [];
      if (wallTab === 'mine') wallPosts = wallPosts.filter(p => p.phone === currentUser.phone);
      renderWallFeed();
    }



    async function loadHotTags() {
      try {
        const tags = await API.wallTagsHot(15);
        const el = document.getElementById('wallHotTags');
        if (!el || !Array.isArray(tags)) return;
        let pillHtml = '<span class="wall-tag-pill ' + (!wallTagFilter ? 'active' : '') + '" onclick="filterByTag(\'\')" data-tag="">🔥 全部</span>';
        tags.forEach(t => {
          const cfg = TAG_CONFIG[t.name];
          pillHtml += '<span class="wall-tag-pill ' + (wallTagFilter === t.name ? 'active' : '') + '" onclick="filterByTag(\''+escHtml(t.name)+'\')" data-tag="'+escHtml(t.name)+'">' + (cfg ? cfg.emoji : '🏷️') + ' ' + escHtml(t.name) + ' <small style="opacity:0.6">' + t.count + '</small></span>';
        });
        el.innerHTML = pillHtml;
      } catch(e) { console.error('热门标签加载失败:', e); }
    }


    let _wallSearchMode = false;

    async function doWallSearch() {
      const q = document.getElementById('wallSearchInput').value.trim();
      if (!q) return loadWallFeed();
      _wallSearchMode = true;
      document.getElementById('wallSearchClear').style.display = '';
      try {
        const data = await API.wallSearch(q, currentUser.phone);
        wallPosts = Array.isArray(data) ? data : [];
      } catch(e) { wallPosts = []; }
      renderWallFeed();
    }



    function clearWallSearch() {
      document.getElementById('wallSearchInput').value = '';
      document.getElementById('wallSearchClear').style.display = 'none';
      _wallSearchMode = false;
      loadWallFeed();
    }


    // ─── 发帖页面相关函数 ──────────────────────────────
    let wallSelectedFiles = [];
    let _selectedTags = [];

    // 标签配置：emoji + 名称 + 颜色
        const TAG_CONFIG = {
      '日常': { emoji: '💬', color: '#3498DB' },
      '求助': { emoji: '🙏', color: '#E67E22' },
      '吐槽': { emoji: '😤', color: '#E74C3C' },
      '美食': { emoji: '🍜', color: '#F39C12' },
      '情感': { emoji: '💕', color: '#E91E63' },
      '学习': { emoji: '📚', color: '#9B59B6' },
      '考试': { emoji: '📝', color: '#C0392B' },
      '闲置': { emoji: '🎁', color: '#1ABC9C' },
      '活动': { emoji: '🎉', color: '#27AE60' },
      '就业': { emoji: '💼', color: '#2C3E50' },
      '升学': { emoji: '🎓', color: '#8E44AD' },
      '生活': { emoji: '🏠', color: '#16A085' },
      '运动': { emoji: '⚽', color: '#27AE60' },
      '旅行': { emoji: '✈️', color: '#2980B9' },
      '音乐': { emoji: '🎵', color: '#9B59B6' },
      '游戏': { emoji: '🎮', color: '#E74C3C' },
      '兼职': { emoji: '💰', color: '#F39C12' },
      '租房': { emoji: '🏠', color: '#1ABC9C' },
      '快递': { emoji: '📦', color: '#E67E22' },
      '社交': { emoji: '🤝', color: '#3498DB' },
      '兴趣': { emoji: '🎯', color: '#E91E63' }
    };


    function extractHashTags(text) {
      const matches = text.match(/#([^#\s]+)#/g);
      if (!matches) return [];
      return [...new Set(matches.map(m => m.slice(1, -1)))];
    }



    function toggleTopicTag(el) {
      const topic = el.dataset.topic;
      const wasSelected = el.classList.contains('selected');
      if (wasSelected) {
        el.classList.remove('selected');
        _selectedTags = _selectedTags.filter(t => t !== topic);
      } else {
        if (_selectedTags.length >= 3) return showToast('最多选择3个标签');
        el.classList.add('selected');
        _selectedTags.push(topic);
      }
    }



    function onPostContentInput(textarea) {
      const len = textarea.value.length;
      const counter = document.getElementById('postCharCount');
      if (!counter) return;
      counter.textContent = len + ' / 500';
      counter.className = 'post-char-count';
      if (len > 450) counter.classList.add('warn');
      if (len > 500) counter.classList.add('danger');
      // 截断超长内容
      if (len > 500) textarea.value = textarea.value.slice(0, 500);
      // 提取 #话题# 实时预览
      const hashTags = extractHashTags(textarea.value);
      const preview = document.getElementById('hashTagPreview');
      if (preview) {
        preview.innerHTML = hashTags.map(t => '<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:10px;font-size:11px;background:#3498DB18;color:#3498DB">#' + escHtml(t) + '</span>').join('');
      }
    }



    function previewWallFiles(input) {
      const files = Array.from(input.files || []);
      files.forEach(file => {
        if (wallSelectedFiles.length >= 9) return showToast('最多上传9个文件');
        wallSelectedFiles.push(file);
      });
      renderWallFilePreview();
      input.value = '';
    }



    function renderWallFilePreview() {
      const container = document.getElementById('wallFilePreview');
      if (!container) return;
      let html = '';
      wallSelectedFiles.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video');
        html += '<div class="post-media-item">';
        if (isVideo) {
          html += '<video src="' + url + '" muted></video>';
        } else {
          html += '<img src="' + url + '" alt="预览" />';
        }
        html += '<button class="media-remove" onclick="removeWallFile(' + i + ')">×</button>';
        html += '</div>';
      });
      // 添加按钮（不满9个时）
      if (wallSelectedFiles.length < 9) {
        html += '<div class="post-media-add" onclick="document.getElementById(\'wallFileInput\').click()">';
        html += '<span class="add-icon">+</span>';
        html += '<span class="add-text">添加</span>';
        html += '</div>';
      }
      container.innerHTML = html;
    }



    function removeWallFile(index) {
      wallSelectedFiles.splice(index, 1);
      renderWallFilePreview();
    }



    function openWallPostModal() {
      if (!currentUser) return showLoginPage();
      document.getElementById('wallPostContent').value = '';
      wallSelectedFiles = [];
      _selectedTags = [];
      document.getElementById('wallFilePreview').innerHTML = '';
      if (document.getElementById('wallFileInput')) document.getElementById('wallFileInput').value = '';
      // 清除话题选中状态
      document.querySelectorAll('.post-topic-tag').forEach(t => t.classList.remove('selected'));
      // 重置字数
      const counter = document.getElementById('postCharCount');
      if (counter) { counter.textContent = '0 / 500'; counter.className = 'post-char-count'; }
      openSubPage('wallPostPage_sub');
    }



    async function submitWallPost() {
      const content = document.getElementById('wallPostContent').value.trim();
      if (!content) return showToast('请输入内容');
      if (content.length > 500) return showToast('内容不能超过500字');
      // 从内容提取 #话题# 标签
      const hashTags = extractHashTags(content);
      const res = await API.wallPost({ phone: currentUser.phone, nickname: currentUser.name, avatar: currentUser.avatar || '', content: content, tags: hashTags.join(',') });
      if (res.error) return showToast(res.error);
      closeSubPage('wallPostPage_sub');
      showToast('发布成功！🎉');
      loadWallFeed();
    }



    async function doWallLike(postId, btn) {
      if (!currentUser) return showLoginPage();
      const res = await API.wallLike(postId, currentUser.phone);
      if (res.ok) {
        const span = btn.querySelector('span');
        const count = parseInt(span.textContent) + (res.liked ? 1 : -1);
        span.textContent = count;
        btn.classList.toggle('liked', res.liked);
      }
    }



    async function showWallDetail(postId) {
      const data = await API.wallPostDetail(postId);
      if (data.error) return showToast(data.error);
      _currentWallPostId = postId;
      const comments = data.comments || [];
      // 构建评论树：顶级评论 + 回复
      const topLevel = comments.filter(c => !c.parent_id);
      const replies = comments.filter(c => c.parent_id);
      const replyMap = {};
      replies.forEach(r => { if (!replyMap[r.parent_id]) replyMap[r.parent_id] = []; replyMap[r.parent_id].push(r); });
      const el = document.getElementById('wallDetailContent');
      el.innerHTML = `
        <div class="wall-card" style="box-shadow:none;padding:0">
          <div class="wall-card-header">
            <div class="wall-avatar" style="${data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http')) ? 'overflow:hidden' : ''}">${data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http')) ? '<img src="'+escHtml(data.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />' : (data.avatar && /\p{Emoji}/u.test(data.avatar) && data.avatar.length<=2 ? data.avatar : (data.nickname||'匿')[0])}</div>
            <div><div class="wall-nickname">${escHtml(data.nickname||'匿名')}</div><div class="wall-time">${timeAgo(data.created_at)}</div></div>
          </div>
          <div class="wall-content">${escHtml(data.content)}</div>
          ${(data.tags && data.tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + data.tags.map(t => {
            const cfg = TAG_CONFIG[t] || { emoji: '🏷️', color: '#95A5A6' };
            return '<span onclick="filterByTag(\''+t+'\');closeSubPage(\'wallDetailPage_sub\')" style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:12px;font-size:12px;background:'+cfg.color+'18;color:'+cfg.color+';cursor:pointer">'+cfg.emoji+' '+t+'</span>';
          }).join('') + '</div>' : ''}
        ${(data.ai_tags && data.ai_tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + data.ai_tags.map(at => '<span onclick="filterByTag(\''+at+'\');closeSubPage(\'wallDetailPage_sub\')" style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:10px;font-size:11px;background:#8E44AD12;color:#8E44AD;cursor:pointer">🤖 '+escHtml(at)+'</span>').join('') + '</div>' : ''}
        ${data.images && data.images.length ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">' + (Array.isArray(data.images) ? data.images : data.images.split(',').filter(Boolean)).map(img => {
          const url = typeof img === 'object' ? img.url : img;
          const isVid = typeof img === 'object' ? img.isVideo : /\.mp4|\.mov|\.webm/i.test(url);
          return isVid ? '<video src="' + url + '" controls style="width:100%;max-width:320px;border-radius:12px"></video>' : '<img src="' + url + '" style="width:100%;max-width:320px;border-radius:12px" loading="lazy" onclick="window.open(this.src)" />';
        }).join('') + '</div>' : ''}
          <div class="wall-actions"><button class="wall-action" onclick="event.stopPropagation();doWallLike(${data.id},this)">❤️ <span>${data.like_count||0}</span></button></div>
        </div>
        <div style="margin-top:16px">
          <div style="font-weight:700;margin-bottom:8px">评论 (${comments.length})</div>
          ${topLevel.length ? topLevel.map(c => `
            <div class="comment-item">
              <div style="display:flex;align-items:flex-start;gap:8px">
                <div class="wall-avatar" style="width:28px;height:28px;font-size:12px;flex-shrink:0;${c.avatar && (c.avatar.startsWith('/') || c.avatar.startsWith('http')) ? 'overflow:hidden' : ''}">${c.avatar && (c.avatar.startsWith('/') || c.avatar.startsWith('http')) ? '<img src="'+escHtml(c.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />' : (c.avatar && /\p{Emoji}/u.test(c.avatar) && c.avatar.length<=2 ? c.avatar : (c.nickname||'匿')[0])}</div>
                <div style="flex:1;min-width:0">
                  <span class="comment-nickname">${escHtml(c.nickname||'匿名')}</span>
              <div class="comment-text">${escHtml(c.content)}</div>
              <div class="comment-actions">
                <span class="comment-time">${timeAgo(c.created_at)}</span>
                <button class="comment-action-btn" onclick="doCommentLike(${c.id},this)">❤️ <span>${c.like_count||0}</span></button>
                <button class="comment-action-btn" onclick="replyToComment(${c.id},'${escHtml(c.nickname||'匿名')}','${c.phone}')" style="color:var(--text-secondary,#999)">💬 回复</button>
              </div>
              ${(replyMap[c.id]||[]).map(r => `
                <div class="comment-reply-item">
                  <span class="reply-tag">回复</span>
                  <span class="comment-nickname">${escHtml(r.nickname||'匿名')}</span>
                  ${r.reply_to_nickname ? '<span style="font-size:12px;color:var(--text-secondary)"> 回复 </span><span class="comment-nickname">' + escHtml(r.reply_to_nickname) + '</span>' : ''}
                  <div class="comment-text">${escHtml(r.content)}</div>
                  <div class="comment-actions">
                    <span class="comment-time">${timeAgo(r.created_at)}</span>
                    <button class="comment-action-btn" onclick="doCommentLike(${r.id},this)">❤️ <span>${r.like_count||0}</span></button>
                    <button class="comment-action-btn" onclick="replyToComment(${c.id},'${escHtml(r.nickname||'匿名')}','${r.phone}')" style="color:var(--text-secondary,#999)">💬 回复</button>
                  </div>
                </div>
              `).join('')}
                </div><!-- /flex:1 -->
              </div><!-- /flex row -->
            </div>
          `).join('') : '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">暂无评论</div>'}
        </div>
        <div class="comment-input-bar">
          <input id="wallCommentInput" placeholder="写评论..." />
          <button id="wallCommentSendBtn" onclick="submitWallComment(${data.id})">发送</button>
        </div>
      `;
      openSubPage('wallDetailPage_sub');
      /* overflow managed by sub-page */
    }


    let _replyContext = null; // { parentId, replyToNickname, replyToPhone }
    let _currentWallPostId = null;


    async function submitWallComment(postId) {
      const input = document.getElementById('wallCommentInput');
      const content = input.value.trim();
      if (!content) return;
      const data = { phone: currentUser.phone, nickname: currentUser.name, avatar: currentUser.avatar || '', content };
      if (_replyContext) {
        data.parent_id = _replyContext.parentId;
        data.reply_to_nickname = _replyContext.replyToNickname;
        data.reply_to_phone = _replyContext.replyToPhone;
      }
      const res = await API.wallComment(postId, data);
      if (res.error) return showToast(res.error);
      _replyContext = null;
      const sendBtn = document.getElementById('wallCommentSendBtn');
      if (sendBtn) sendBtn.textContent = '发送';
      const cancelHint = document.getElementById('cancelReplyHint');
      if (cancelHint) cancelHint.style.display = 'none';
      const input2 = document.getElementById('wallCommentInput');
      if (input2) input2.placeholder = '写评论...';
      showToast('评论成功');
      showWallDetail(postId);
      loadWallFeed();
    }



    function replyToComment(parentId, nickname, phone) {
      if (!currentUser) return showLoginPage();
      _replyContext = { parentId, replyToNickname: nickname, replyToPhone: phone };
      const input = document.getElementById('wallCommentInput');
      if (input) { input.placeholder = `回复 ${nickname}...`; input.focus(); }
      const sendBtn = document.getElementById('wallCommentSendBtn');
      if (sendBtn) sendBtn.textContent = '回复';
      // 显示取消回复提示
      let cancelHint = document.getElementById('cancelReplyHint');
      if (!cancelHint) {
        cancelHint = document.createElement('div');
        cancelHint.id = 'cancelReplyHint';
        cancelHint.style.cssText = 'font-size:12px;color:var(--primary);cursor:pointer;padding:4px 0;margin-bottom:4px';
        cancelHint.textContent = '✕ 取消回复';
        cancelHint.onclick = cancelReply;
        const bar = document.querySelector('.comment-input-bar');
        if (bar) bar.parentNode.insertBefore(cancelHint, bar);
      }
      cancelHint.style.display = 'block';
    }



    function cancelReply() {
      _replyContext = null;
      const input = document.getElementById('wallCommentInput');
      if (input) input.placeholder = '写评论...';
      const sendBtn = document.getElementById('wallCommentSendBtn');
      if (sendBtn) sendBtn.textContent = '发送';
      const cancelHint = document.getElementById('cancelReplyHint');
      if (cancelHint) cancelHint.style.display = 'none';
    }



    async function doCommentLike(commentId, btn) {
      if (!currentUser) return showLoginPage();
      const res = await API.wallCommentLike(commentId, currentUser.phone);
      if (res.ok) {
        const span = btn.querySelector('span');
        const count = parseInt(span.textContent) + (res.liked ? 1 : -1);
        span.textContent = count;
        btn.classList.toggle('liked', res.liked);
      }
    }



    async function showWallUser(phone) {
      const data = await API.wallUserProfile(phone);
      if (data.error) return showToast(data.error);
      const posts = data.posts || [];
      const isMe = phone === currentUser.phone;
      const el = document.getElementById('wallDetailContent');
      el.innerHTML = `
        <div style="text-align:center;padding:20px 0;border-bottom:1px solid var(--border,#eee);margin-bottom:16px">
          <div class="wall-avatar" style="width:64px;height:64px;${data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http')) ? 'overflow:hidden' : 'font-size:28px'};margin:0 auto 12px">${data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http')) ? '<img src="'+escHtml(data.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />' : (data.avatar && /\p{Emoji}/u.test(data.avatar) && data.avatar.length<=2 ? data.avatar : (data.nickname||'匿')[0])}</div>
          <div style="font-size:18px;font-weight:700">${escHtml(data.nickname)}</div>
          <div style="display:flex;justify-content:center;gap:24px;margin-top:12px">
            <div style="cursor:pointer" onclick="showFollowList('${phone}','followers')" title="查看粉丝列表"><div style="font-size:18px;font-weight:900">${data.followers}</div><div style="font-size:12px;color:var(--text-secondary,#888)">粉丝</div></div>
            <div style="cursor:pointer" onclick="showFollowList('${phone}','following')" title="查看关注列表"><div style="font-size:18px;font-weight:900">${data.following}</div><div style="font-size:12px;color:var(--text-secondary,#888)">关注</div></div>
            <div><div style="font-size:18px;font-weight:900">${data.postCount}</div><div style="font-size:12px;color:var(--text-secondary,#888)">帖子</div></div>
          </div>
          ${!isMe ? '<div style="display:flex;gap:10px;margin-top:16px;justify-content:center"><button onclick="doWallFollow(\''+phone+'\')" class="submit-btn" style="padding:10px 24px">' + (data.isFollowing ? '已关注' : '+ 关注') + '</button><button onclick="tryWallChat(\''+phone+'\')" class="submit-btn" style="padding:10px 24px;background:linear-gradient(135deg,#45B7D1,#6DD5ED);color:#fff">💬 私信</button></div>' : ''}
        </div>
        <div style="font-weight:700;margin-bottom:12px">📝 ${isMe ? '我的' : 'TA的'}帖子</div>
        ${posts.length ? posts.map(p => `
          <div class="wall-card" style="margin-bottom:12px">
            <div class="wall-content" onclick="closeSubPage('wallDetailPage_sub');showWallDetail(${p.id})">${escHtml(p.content)}</div>
            ${p.images && p.images.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + (Array.isArray(p.images) ? p.images : []).map(img => {
              const url = typeof img === 'object' ? img.url : img;
              const isVid = typeof img === 'object' ? img.isVideo : false;
              return isVid ? '<video src="' + url + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px" muted></video>' : '<img src="' + url + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px" loading="lazy" />';
            }).join('') + '</div>' : ''}
            <div class="wall-actions"><button class="wall-action" onclick="event.stopPropagation();doWallLike(${p.id},this)">❤️ <span>${p.like_count||0}</span></button><button class="wall-action" onclick="closeSubPage('wallDetailPage_sub');showWallDetail(${p.id})">💬 <span>${p.comment_count||0}</span></button></div>
          </div>
        `).join('') : '<div style="text-align:center;color:var(--text-secondary,#888);padding:20px">暂无帖子</div>'}
      `;
      openSubPage('wallDetailPage_sub');
    }


    // 关注/取消关注（用户主页按钮）

    async function doWallFollow(phone) {
      if (!currentUser) return showLoginPage();
      const res = await API.wallFollow(currentUser.phone, phone);
      if (res.error) return showToast(res.error);
      showToast(res.following ? '已关注' : '已取消关注');
      showWallUser(phone);
    }


    // 关注/取消关注（feed卡片内按钮）

    async function doWallFollowFeed(postId, phone, btn) {
      if (!currentUser) return showLoginPage();
      const res = await API.wallFollow(currentUser.phone, phone);
      if (res.error) return showToast(res.error);
      btn.textContent = res.following ? '已关注' : '+ 关注';
      btn.classList.toggle('followed', res.following);
      showToast(res.following ? '已关注' : '已取消关注');
      const post = wallPosts.find(p => p.id === postId);
      if (post) post.isFollowing = res.following;
 }

    // 校园墙私信（带隐私检查+友好提示）
    async function tryWallChat(otherPhone) {
      if (!currentUser) return showLoginPage();
      if (otherPhone === currentUser.phone) return showToast('不能给自己发私信');
      showToast('正在连接...');
      const res = await API.wallChat(currentUser.phone, otherPhone);
      if (res.error) {
        // 隐私限制 - 显示原因弹窗
        if (res.code === 'CHAT_002' || res.code === 'CHAT_PRIVACY_BLOCKED') {
          showChatBlockedDialog(otherPhone, res.error);
        } else {
          showToast(res.error);
        }
        return;
      }
      closeSubPage('wallDetailPage_sub');
      currentConvId = res.id;
      currentConvPhone = otherPhone;
      const profile = await API.wallUserProfile(otherPhone);
      const otherName = profile.nickname || profile.name || otherPhone;
      document.getElementById('chatConvTitle').textContent = otherName;
      openSubPage('chatConvPage_sub');
      await loadChatMessages();
      if (chatRefreshTimer) clearInterval(chatRefreshTimer);
      chatRefreshTimer = setInterval(loadChatMessages, 5000);
    }

    async function tryWallChat(otherPhone) {
      if (!currentUser) return showLoginPage();
      if (otherPhone === currentUser.phone) return showToast('不能给自己发私信');
      showToast('正在连接...');
      const res = await API.wallChat(currentUser.phone, otherPhone);
      if (res.error) {
        // 隐私限制 - 显示原因弹窗
        if (res.code === 'CHAT_002' || res.code === 'CHAT_PRIVACY_BLOCKED') {
          showChatBlockedDialog(otherPhone, res.error);
        } else {
          showToast(res.error);
        }
        return;
      }
      closeSubPage('wallDetailPage_sub');
      currentConvId = res.id;
      currentConvPhone = otherPhone;
      const profile = await API.wallUserProfile(otherPhone);
      const otherName = profile.nickname || profile.name || otherPhone;
      document.getElementById('chatConvTitle').textContent = otherName;
      openSubPage('chatConvPage_sub');
      await loadChatMessages();
      if (chatRefreshTimer) clearInterval(chatRefreshTimer);
      chatRefreshTimer = setInterval(loadChatMessages, 5000);
    }


    // 私聊被拒弹窗

    function showChatBlockedDialog(otherPhone, reason) {
      let el = document.getElementById('chatBlockedPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'chatBlockedPage_sub';
        el.className = 'sub-page';
        document.body.appendChild(el);
      }
      el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'chatBlockedPage_sub\')">←</button><span class="sub-page-title">💬 无法私聊</span></div>' +
        '<div class="sub-page-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center">' +
        '<div style="font-size:64px;margin-bottom:16px">🔒</div>' +
        '<div style="font-size:18px;font-weight:700;margin-bottom:8px">对方设置了私聊权限</div>' +
        '<div style="font-size:14px;color:var(--text-secondary,#888);margin-bottom:24px;line-height:1.6">' + escHtml(reason) + '</div>' +
        '<button class="submit-btn" style="padding:12px 32px;font-size:15px" onclick="closeSubPage(\'chatBlockedPage_sub\');doWallFollow(\''+otherPhone+'\')">❤️ 关注对方</button>' +
        '<button style="margin-top:12px;padding:10px 24px;border:1px solid var(--border,#ddd);border-radius:8px;background:transparent;color:var(--text-secondary,#888);font-size:14px" onclick="closeSubPage(\'chatBlockedPage_sub\')">返回</button>' +
        '</div>';
      openSubPage('chatBlockedPage_sub');
    }


    // 查看关注/粉丝列表

    async function showFollowList(phone, type) {
      const isMe = phone === currentUser.phone;
      const title = type === 'followers' ? (isMe ? '我的粉丝' : 'TA的粉丝') : (isMe ? '我的关注' : 'TA的关注');
      const heroIcon = type === 'followers' ? '👥' : '👁';
      let el = document.getElementById('followListPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'followListPage_sub';
        el.className = 'sub-page';
        document.body.appendChild(el);
      }
      el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'followListPage_sub\')">←</button><span class="sub-page-title">' + title + '</span></div>' +
        '<div class="sub-page-body" style="padding:0">' +
        '<div class="follow-list-hero"><span class="follow-list-hero-icon">' + heroIcon + '</span><div class="follow-list-hero-title">' + title + '</div></div>' +
        '<div id="followListContent" style="padding:8px 12px"><div style="text-align:center;padding:24px;color:var(--text-secondary)"><div class="follow-list-spinner"></div><div style="margin-top:8px;font-size:13px">加载中...</div></div></div></div>';
      openSubPage('followListPage_sub');

      const list = type === 'followers' ? await API.wallFollowers(phone) : await API.wallFollowing(phone);
      const container = document.getElementById('followListContent');
      if (list.error) {
        container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">😕</div><div class="sub-empty-text">' + escHtml(list.error) + '</div></div>';
        return;
      }
      if (!list.length) {
        container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">📭</div><div class="sub-empty-text">暂无' + (type === 'followers' ? '粉丝' : '关注') + '</div></div>';
        return;
      }
      container.innerHTML = list.map((u, i) => {
        const avatarHtml = u.avatar && (u.avatar.startsWith('/') || u.avatar.startsWith('http'))
          ? '<img src="'+escHtml(u.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />'
          : '<span style="font-size:16px;color:#fff">'+((u.nickname||'匿')[0])+'</span>';
        const isSelf = u.phone === currentUser.phone;
        const iFollowThem = type === 'followers' ? u.isFollowing : true;
        const followBtn = isSelf ? '<span class="follow-list-badge follow-list-badge-self">自己</span>' : (iFollowThem
          ? '<button onclick="toggleFollowFromList(\''+u.phone+'\',this)" class="follow-list-btn follow-list-btn-followed">已关注</button>'
          : '<button onclick="toggleFollowFromList(\''+u.phone+'\',this)" class="follow-list-btn follow-list-btn-follow">+ 关注</button>'
        );
        return '<div class="follow-list-item" style="animation-delay:' + (i*0.04) + 's" onclick="closeSubPage(\'followListPage_sub\');closeSubPage(\'wallDetailPage_sub\');setTimeout(()=>showWallUser(\''+u.phone+'\'),100)">' +
          '<div class="follow-list-avatar" style="background:linear-gradient(135deg,' + _avatarColor(i) + ')">' + avatarHtml + '</div>' +
          '<div class="follow-list-info"><div class="follow-list-name">' + escHtml(u.nickname) + '</div>' +
          (type === 'followers' && u.isFollowing ? '<span class="follow-list-mutual">互相关注</span>' : '') +
          '</div>' + followBtn +
          '</div>';
      }).join('');
    }


    // 从粉丝列表关注/取消关注

    async function toggleFollowFromList(phone, btn) {
      if (!currentUser) return showLoginPage();
      const res = await API.wallFollow(currentUser.phone, phone);
      if (res.error) return showToast(res.error);
      if (res.following) {
        btn.textContent = '已关注';
        btn.className = 'follow-list-btn follow-list-btn-followed';
      } else {
        btn.textContent = '+ 关注';
        btn.className = 'follow-list-btn follow-list-btn-follow';
      }
      showToast(res.following ? '已关注' : '已取消关注');
    }


    // ─── 我的浏览者列表 ────

    async function showMyViewers() {
      if (!currentUser) return showLoginPage();
      let el = document.getElementById('viewerListPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'viewerListPage_sub';
        el.className = 'sub-page';
        document.body.appendChild(el);
      }
      el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'viewerListPage_sub\')">←</button><span class="sub-page-title" data-i18n="myViewers">浏览者</span></div>' +
        '<div class="sub-page-body" style="padding:0">' +
        '<div class="follow-list-hero"><span class="follow-list-hero-icon">👁</span><div class="follow-list-hero-title" data-i18n="myViewers">浏览者</div></div>' +
        '<div id="viewerListContent" style="padding:8px 12px"><div style="text-align:center;padding:24px;color:var(--text-secondary)"><div class="follow-list-spinner"></div><div style="margin-top:8px;font-size:13px">加载中...</div></div></div></div>';
      openSubPage('viewerListPage_sub');
      try {
        const list = await API.wallMyViewers(currentUser.phone);
        const container = document.getElementById('viewerListContent');
        if (list.error) {
          container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">😕</div><div class="sub-empty-text">' + escHtml(list.error) + '</div></div>';
          return;
        }
        if (!list.length) {
          container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">📭</div><div class="sub-empty-text" data-i18n="noViewers">暂无浏览者</div></div>';
          return;
        }
        container.innerHTML = list.map((u, i) => {
          const avatarHtml = u.avatar && (u.avatar.startsWith('/') || u.avatar.startsWith('http'))
            ? '<img src="'+escHtml(u.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />'
            : '<span style="font-size:16px;color:#fff">'+((u.nickname||'匿')[0])+'</span>';
          const isSelf = u.phone === currentUser.phone;
          const followBtn = isSelf ? '<span class="follow-list-badge follow-list-badge-self">自己</span>' : (u.isFollowing
            ? '<button onclick="event.stopPropagation();toggleFollowFromList(\''+u.phone+'\',this)" class="follow-list-btn follow-list-btn-followed">已关注</button>'
            : '<button onclick="event.stopPropagation();toggleFollowFromList(\''+u.phone+'\',this)" class="follow-list-btn follow-list-btn-follow">+ 关注</button>'
          );
          const viewTag = '<span style="font-size:11px;color:var(--text-secondary);background:var(--bg);padding:2px 6px;border-radius:10px">浏览' + u.viewCount + '篇</span>';
          return '<div class="follow-list-item" style="animation-delay:' + (i*0.04) + 's" onclick="closeSubPage(\'viewerListPage_sub\');setTimeout(()=>showWallUser(\''+u.phone+'\'),100)">' +
            '<div class="follow-list-avatar" style="background:linear-gradient(135deg,' + _avatarColor(i) + ')">' + avatarHtml + '</div>' +
            '<div class="follow-list-info"><div class="follow-list-name">' + escHtml(u.nickname) + '</div>' + viewTag + '</div>' + followBtn +
            '</div>';
        }).join('');
      } catch(e) {
        const container = document.getElementById('viewerListContent');
        if (container) container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">😕</div><div class="sub-empty-text">加载失败</div></div>';
      }
    }


    // ─── 我的获赞详情 ────

    async function showMyWallLikes() {
      if (!currentUser) return showLoginPage();
      let el = document.getElementById('myLikesPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'myLikesPage_sub';
        el.className = 'sub-page';
        document.body.appendChild(el);
      }
      el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'myLikesPage_sub\')">←</button><span class="sub-page-title" data-i18n="myLikes">获赞详情</span></div>' +
        '<div class="sub-page-body" style="padding:0">' +
        '<div class="follow-list-hero"><span class="follow-list-hero-icon">❤️</span><div class="follow-list-hero-title" data-i18n="myLikes">获赞详情</div></div>' +
        '<div id="myLikesContent" style="padding:8px 12px"><div style="text-align:center;padding:24px;color:var(--text-secondary)"><div class="follow-list-spinner"></div><div style="margin-top:8px;font-size:13px">加载中...</div></div></div></div>';
      openSubPage('myLikesPage_sub');
      try {
        // 获取我的帖子和每篇的赞数
        const res = await fetch('/api/wall/user/' + currentUser.phone, { headers: API._headers() }).then(r => r.json());
        const posts = res.posts || [];
        const container = document.getElementById('myLikesContent');
        if (!posts.length) {
          container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">📝</div><div class="sub-empty-text" data-i18n="noPosts">暂无帖子</div></div>';
          return;
        }
        // 按点赞数排序
        posts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        container.innerHTML = posts.map((p, i) => {
          const preview = (p.content || '').slice(0, 40);
          const imgHtml = p.images && p.images.length ? '<img src="' + escHtml(p.images[0]) + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0" />' : '';
          const likeNum = p.like_count || 0;
          const commentNum = p.comment_count || 0;
          return '<div class="follow-list-item" style="animation-delay:' + (i*0.04) + 's;align-items:flex-start;gap:10px" onclick="closeSubPage(\'myLikesPage_sub\');setTimeout(()=>showWallDetail(\''+p.id+'\'),100)">' +
            (imgHtml || '<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">📄</div>') +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(preview || '(无内容)') + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;display:flex;gap:12px">' +
            '<span>❤️ ' + likeNum + '</span><span>💬 ' + commentNum + '</span><span>' + fmtTime(p.created_at) + '</span>' +
            '</div></div>' +
            (likeNum > 0 ? '<div style="font-size:18px;font-weight:900;color:var(--primary)">' + likeNum + '</div>' : '') +
            '</div>';
        }).join('');
      } catch(e) {
        const container = document.getElementById('myLikesContent');
        if (container) container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">😕</div><div class="sub-empty-text">加载失败</div></div>';
      }
    }


    
    // ═══════════════════════════════════════════════════════
    // 💬 聊天
    // ═══════════════════════════════════════════════════════
    let currentConvId = null;
    let currentConvPhone = null;
    let chatRefreshTimer = null;


    async function openChatList() {
      if (!currentUser) return showLoginPage();
      openSubPage('chatListPage_sub');
      /* overflow managed by sub-page */
      await loadChatList();
    }



    async function loadChatList() {
      const list = await API.chatConversations(currentUser.phone);
      const el = document.getElementById('chatListBody');
      if (!list || !list.length) {
        el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">暂无消息</div>';
        return;
      }
      el.innerHTML = list.map(c => `
        <div class="chat-item" onclick="openChatConv(${c.id},'${escHtml(c.other_phone)}','${escHtml(c.other_name)}')">
          <div class="chat-item-avatar">${(c.other_name||'?')[0]}</div>
          <div class="chat-item-info">
            <div class="chat-item-top">
              <span class="chat-item-name">${escHtml(c.other_name||c.other_phone)}</span>
              <span class="chat-item-time">${timeAgo(c.last_message_at)}</span>
            </div>
            <div class="chat-item-bottom">
              <span class="chat-item-msg">${escHtml((c.last_sender===currentUser.phone?'我:':'')+ (c.last_message||''))}</span>
              ${c.unread? '<span class="chat-item-badge">' + c.unread + '</span>':''}
            </div>
          </div>
        </div>
      `).join('');
    }



    async function openChatConv(convId, otherPhone, otherName) {
      currentConvId = convId;
      currentConvPhone = otherPhone;
      document.getElementById('chatConvTitle').textContent = otherName || otherPhone;
      closeSubPage('chatListPage_sub');
      openSubPage('chatConvPage_sub');
      /* overflow managed by sub-page */
      await loadChatMessages();
      // 自动刷新
      if (chatRefreshTimer) clearInterval(chatRefreshTimer);
      chatRefreshTimer = setInterval(loadChatMessages, 5000);
    }



    async function loadChatMessages() {
      if (!currentConvId) return;
      const msgs = await API.chatMessages(currentConvId, currentUser.phone);
      const el = document.getElementById('chatMessages');
      el.innerHTML = msgs.map(m => {
        const isMe = m.sender_phone === currentUser.phone;
        let content;
        const c = m.content;
        if (m.type === 'image') {
          content = '<img src="'+escHtml(c)+'" style="max-width:100%;border-radius:8px;display:block;cursor:pointer" onclick="window.open(this.src)" />';
        } else if (m.type === 'video') {
          content = '<video src="'+escHtml(c)+'" style="max-width:100%;border-radius:8px;display:block" controls preload="metadata"></video>';
        } else if (c.startsWith('[ANIM:')) {
          const p=c.slice(6,c.length-1).split(':');
          content = '<span class="anim-'+p[1]+'" style="font-size:36px;display:inline-block">'+p[0]+'</span>';
        } else if (c.startsWith('[GIF]')) {
          content = '<img src="'+escHtml(c.slice(5))+'" style="max-width:160px;border-radius:12px;display:block" />';
        } else {
          content = escHtml(c);
        }
        return `
          <div style="display:flex;justify-content:${isMe?'flex-end':'flex-start'};margin-bottom:10px">
            <div style="max-width:70%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;
              background:${isMe?'var(--primary)':'var(--card)'};color:${isMe?'#fff':'var(--text)'};border:1px solid ${isMe?'transparent':'var(--border)'}">
              ${content}
            </div>
          </div>
        `;
      }).join('');
      el.scrollTop = el.scrollHeight;
    }



    async function sendChatMsg() {
      const input = document.getElementById('chatInput');
      const content = input.value.trim();
      if (!content || !currentConvId) return;
      const res = await API.chatSend({ conversation_id: currentConvId, sender_phone: currentUser.phone, content });
      if (res.error) return showToast(res.error);
      input.value = '';
      await loadChatMessages();
    }


    // ═══════════════════════════════════════════════════════
    // 📎 用户端图片/视频上传
    // ═══════════════════════════════════════════════════════

    async function userChatUpload(input) {
      const file = input.files && input.files[0];
      if (!file || !currentConvId) return;
      if (file.size > 20 * 1024 * 1024) return showToast('文件不能超过20MB');
      showToast('上传中...');
      try {
        const res = await API.chatUpload(file);
        if (res.error) return showToast(res.error);
        const sendRes = await API.chatSend({
          conversation_id: currentConvId,
          sender_phone: currentUser.phone,
          content: res.url,
          type: res.type
        });
        if (sendRes.error) return showToast(sendRes.error);
        await loadChatMessages();
      } catch(e) {
        showToast('上传失败: ' + (e.message||e));
      }
      input.value = '';
    }


    // 从订单卡片打开聊天（供订单列表调用）

    async function openChatFromOrder(orderId, riderPhone, riderName) {
      if (!currentUser) return showLoginPage();
      const conv = await API.chatGetOrCreateConversation({
        user_phone: currentUser.phone,
        rider_phone: riderPhone,
        order_id: orderId,
        order_title: '订单 ' + orderId
      });
      if (conv.error) return showToast(conv.error);
      openChatConv(conv.id, riderPhone, riderName || riderPhone);
    }


    // 私聊隐私选择

    async function showChatPrivacyOptions() {
      const pr = await API.getChatPrivacy(currentUser.phone);
      const cur = pr.privacy || 'all';
      let el = document.getElementById('chatPrivacyPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'chatPrivacyPage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'chatPrivacyPage_sub\')">←</button><span class="sub-page-title">💬 谁可以私聊我</span></div><div class="sub-page-body"></div>';
        document.body.appendChild(el);
      }
      const options = [
        { value: 'all', icon: '🌐', name: '所有人', desc: '任何用户都可以给你发私信' },
        { value: 'followers', icon: '👥', name: '关注我的人', desc: '只有关注了你的人才能私聊' },
        { value: 'mutual', icon: '🤝', name: '互相关注', desc: '只有互相关注的好友才能私聊' }
      ];
      el.querySelector('.sub-page-body').innerHTML = '<div style="padding:12px">' + options.map(o =>
        '<div class="settings-item" style="cursor:pointer;padding:16px;border-radius:12px;margin-bottom:10px;background:var(--card);box-shadow:var(--shadow);border:2px solid ' + (cur === o.value ? 'var(--primary)' : 'transparent') + '" onclick="setChatPrivacy(\'' + o.value + '\')">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="font-size:28px;width:40px;text-align:center">' + o.icon + '</div>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:15px">' + o.name + '</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + o.desc + '</div></div>' +
        (cur === o.value ? '<div style="color:var(--primary);font-size:20px">✓</div>' : '') +
        '</div></div>'
      ).join('') + '</div>';
      openSubPage('chatPrivacyPage_sub');
    }



    async function setChatPrivacy(privacy) {
      const res = await API.setChatPrivacy(currentUser.phone, privacy);
      if (res.error) return showToast(res.error);
      const labels = { all: '所有人', mutual: '互相关注', followers: '关注我的人' };
      showToast('已设为：' + labels[privacy]);
      closeSubPage('chatPrivacyPage_sub');
      closeSubPage('settingsPage_sub');
      setTimeout(() => showSettings(), 200);
    }

// ── Window exports ──
window.replyToComment = replyToComment;
window.toggleCommentEmoji = toggleCommentEmoji;
window.insertCommentEmoji = insertCommentEmoji;
window.switchWallTab = switchWallTab;
window.filterByTag = filterByTag;
window.loadWallFeed = loadWallFeed;
window.loadHotTags = loadHotTags;
window.doWallSearch = doWallSearch;
window.clearWallSearch = clearWallSearch;
window.extractHashTags = extractHashTags;
window.toggleTopicTag = toggleTopicTag;
window.onPostContentInput = onPostContentInput;
window.previewWallFiles = previewWallFiles;
window.renderWallFilePreview = renderWallFilePreview;
window.removeWallFile = removeWallFile;
window.openWallPostModal = openWallPostModal;
window.submitWallPost = submitWallPost;
window.doWallLike = doWallLike;
window.showWallDetail = showWallDetail;
window.submitWallComment = submitWallComment;
window.replyToComment = replyToComment;
window.cancelReply = cancelReply;
window.doCommentLike = doCommentLike;
window.showWallUser = showWallUser;
window.doWallFollow = doWallFollow;
window.doWallFollowFeed = doWallFollowFeed;
window.tryWallChat = tryWallChat;
window.showChatBlockedDialog = showChatBlockedDialog;
window.showFollowList = showFollowList;
window.toggleFollowFromList = toggleFollowFromList;
window.showMyViewers = showMyViewers;
window.showMyWallLikes = showMyWallLikes;
window.openChatList = openChatList;
window.loadChatList = loadChatList;
window.openChatConv = openChatConv;
window.loadChatMessages = loadChatMessages;
window.sendChatMsg = sendChatMsg;
window.userChatUpload = userChatUpload;
window.openChatFromOrder = openChatFromOrder;
window.showChatPrivacyOptions = showChatPrivacyOptions;
window.setChatPrivacy = setChatPrivacy;
