// wall.js - 校园墙 v3.0.35
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
    var wallTab = 'latest';
    var wallPosts = [];
    var wallTagFilter = ''; // 当前标签筛选


    function switchWallTab(tab) {
      wallTab = tab;
      wallTagFilter = ''; // 切换tab时清空标签筛选
      _wallPage = 1;
      _wallHasMore = true;
      document.querySelectorAll('.wall-tab').forEach(t => t.classList.remove('active'));
      const labels = { latest: '最新', hot: '热门', following: '关注', mine: '我的' };
      document.querySelectorAll('.wall-tab').forEach(t => {
        if (t.textContent === labels[tab]) t.classList.add('active');
      });

      // 显示帖子流
      const wallFeed = document.getElementById('wallFeed');
      const discoverPage = document.getElementById('discoverPage');
      const wallFab = document.getElementById('wallFab');
      if (wallFeed) wallFeed.style.display = '';
      if (discoverPage) discoverPage.style.display = 'none';
      if (wallFab) wallFab.style.display = '';
      loadWallFeed();
      renderWallChannels();
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
      _wallPage = 1;
      _wallHasMore = true;
      const params = { tab: wallTab === 'mine' ? 'latest' : wallTab, phone: currentUser.phone };
      if (wallTagFilter) params.tag = wallTagFilter;
      const res = await API.wallFeed(params);
      wallPosts = Array.isArray(res.posts) ? res.posts : [];
      _wallHasMore = res.hasMore !== false;
      if (wallTab === 'mine') wallPosts = wallPosts.filter(p => p.phone === currentUser.phone);
      renderWallFeed();
      renderWallChannels();
    }



    async function loadHotTags() {
      try {
        const tags = await API.wallTagsHot(15);
        const el = document.getElementById('wallHotTags');
        if (!el || !Array.isArray(tags)) return;
        let pillHtml = '<span class="wall-tag-pill ' + (!wallTagFilter ? 'active' : '') + '" onclick="filterByTag(\'\')" data-tag="">全部</span>';
        tags.forEach(t => {
          const cfg = TAG_CONFIG[t.name];
          pillHtml += '<span class="wall-tag-pill ' + (wallTagFilter === t.name ? 'active' : '') + '" onclick="filterByTag(\''+escHtml(t.name)+'\')" data-tag="'+escHtml(t.name)+'">' + escHtml(t.name) + ' <small style="opacity:0.6">' + t.count + '</small></span>';
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
        const res = await API.wallSearch(q, currentUser.phone);
        wallPosts = Array.isArray(res.value) ? res.value : (Array.isArray(res) ? res : []);
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
        // ══════ 层级标签系统：大分类 + 子标签 ══════
        const _BASE_CATEGORIES = [
          { key: '生活', emoji: '🏠', color: '#16A085', children: ['日常','美食','情感','树洞','打卡','穿搭','追剧'] },
          { key: '学习', emoji: '📚', color: '#9B59B6', children: ['考试','考研','竞赛','读书'] },
          { key: '求职', emoji: '💼', color: '#2C3E50', children: ['就业','实习','兼职'] },
          { key: '交易', emoji: '♻️', color: '#1ABC9C', children: ['二手','闲置','拼单'] },
          { key: '出行', emoji: '🚗', color: '#3498DB', children: ['拼车','快递','租房'] },
          { key: '兴趣', emoji: '🎯', color: '#E91E63', children: ['运动','音乐','摄影','数码','健身','社团'] },
          { key: '游戏', emoji: '🎮', color: '#E74C3C', children: ['手游','端游','主机','电竞','开黑','攻略','Steam'] },
          { key: '社交', emoji: '🤝', color: '#E67E22', children: ['表白','活动','社交','志愿'] },
          { key: '互助', emoji: '🔔', color: '#E74C3C', children: ['求助','吐槽','失物','招领'] },
        ];

        // 加载用户自定义子标签
        function getCustomSubTags() {
          try { return JSON.parse(localStorage.getItem('wallCustomSubTags') || '{}'); } catch(e) { return {}; }
        }
        function saveCustomSubTags(data) {
          try { localStorage.setItem('wallCustomSubTags', JSON.stringify(data)); } catch(e) {}
        }

        // 合并默认+自定义，生成最终 TAG_CATEGORIES
        function buildTagCategories() {
          const custom = getCustomSubTags();
          return _BASE_CATEGORIES.map(cat => {
            const extra = custom[cat.key] || [];
            return { ...cat, children: [...cat.children, ...extra] };
          });
        }
        let TAG_CATEGORIES = buildTagCategories();

        // 构建子标签→大分类的反向映射
        const _subToCategory = {};
        TAG_CATEGORIES.forEach(cat => cat.children.forEach(sub => { _subToCategory[sub] = cat.key; }));

        // 兼容旧代码：TAG_CONFIG 仍提供每个标签的 emoji/color
        const TAG_CONFIG = {};
        TAG_CATEGORIES.forEach(cat => {
          TAG_CONFIG[cat.key] = { emoji: cat.emoji, color: cat.color };
          cat.children.forEach(sub => {
            TAG_CONFIG[sub] = { emoji: _subEmoji(sub), color: cat.color };
          });
        });
        function _subEmoji(name) {
          const map = {'日常':'💬','求助':'🙏','吐槽':'😤','美食':'🍜','情感':'💕','考试':'📝','闲置':'🎁','活动':'🎉','就业':'💼','考研':'🎓','运动':'⚽','音乐':'🎵','游戏':'🎮','兼职':'💰','租房':'🏠','快递':'📦','社交':'🤝','失物':'🔍','招领':'🔔','二手':'♻️','拼车':'🚗','拼单':'🛍️','表白':'💌','树洞':'🌳','打卡':'📍','摄影':'📸','数码':'💻','穿搭':'👗','追剧':'📺','读书':'📖','实习':'🏢','社团':'🎭','志愿':'💛','竞赛':'🏆','健身':'💪','手游':'📱','端游':'🖥️','主机':'🕹️','电竞':'🏅','开黑':'👥','攻略':'📋','Steam':'🎮'};
          return map[name] || '🏷️';
        }


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
      counter.textContent = len + '/500';
      counter.className = 'post-char-count';
      if (len > 450) counter.classList.add('warn');
      if (len > 500) counter.classList.add('danger');
      // 截断超长内容
      if (len > 500) textarea.value = textarea.value.slice(0, 500);
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
        html += '<label class="post-media-add">';
        html += '<span class="add-icon">+</span>';
        html += '<span class="add-text">添加</span>';
        html += '<input type="file" multiple style="display:none" onchange="previewWallFiles(this)" />';
        html += '</label>';
      }
      container.innerHTML = html;
      // 更新媒体计数提示
      const hint = document.getElementById('mediaCountHint');
      if (hint) hint.textContent = wallSelectedFiles.length > 0 ? wallSelectedFiles.length + '/9' : '最多9张';
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
      // 渲染标签选择按钮
      renderPostTagGrid();
      // 重置字数
      const counter = document.getElementById('postCharCount');
      if (counter) { counter.textContent = '0/500'; counter.className = 'post-char-count'; }
      // 重置媒体区
      renderWallFilePreview();
      // 展开标签区
      const wrap = document.getElementById('postTagGridWrap');
      const arrow = document.getElementById('tagSectionArrow');
      if (wrap) wrap.classList.remove('collapsed');
      if (arrow) arrow.classList.remove('collapsed');
      openSubPage('wallPostPage_sub');
    }

    function renderPostTagGrid() {
      const grid = document.getElementById('postTagGrid');
      if (!grid) return;
      // 同步个人标签配置：只显示启用的分类和子标签
      TAG_CATEGORIES = buildTagCategories();
      Object.keys(_subToCategory).forEach(k => delete _subToCategory[k]);
      TAG_CATEGORIES.forEach(c => c.children.forEach(sub => { _subToCategory[sub] = c.key; }));

      const config = getUserTagConfig();
      const disabledSet = new Set(config ? (config.disabled || []) : []);
      const activeCats = config ? config.active : TAG_CATEGORIES.map(c => c.key);

      let html = '';
      TAG_CATEGORIES.forEach(cat => {
        if (!activeCats.includes(cat.key) || disabledSet.has(cat.key)) return;
        const visibleSubs = cat.children.filter(sub => !disabledSet.has(sub));
        if (visibleSubs.length === 0) return;

        html += `<div class="post-tag-category">`;
        html += `<span class="post-tag-category-label" style="color:${cat.color}">${cat.key}</span>`;
        html += `<div class="post-tag-category-tags">`;
        visibleSubs.forEach(tag => {
          const isSelected = _selectedTags.includes(tag);
          const cfg = TAG_CONFIG[tag] || { emoji: '🏷️' };
          html += '<span class="post-topic-tag' + (isSelected ? ' selected' : '') + '" data-topic="' + tag + '" onclick="togglePostTag(this)">' + cfg.emoji + ' ' + tag + '</span>';
        });
        html += `</div></div>`;
      });
      grid.innerHTML = html;
      updateSelectedTagPreview();
    }

    // 更新已选标签预览
    function updateSelectedTagPreview() {
      const el = document.getElementById('selectedTagPreview');
      if (!el) return;
      if (_selectedTags.length === 0) {
        el.textContent = '最多5个';
        el.style.color = 'var(--text-light)';
      } else {
        el.textContent = _selectedTags.map(t => '#' + t).join(' ');
        el.style.color = 'var(--primary)';
      }
    }

    // 折叠/展开标签区
    function togglePostTagSection() {
      const wrap = document.getElementById('postTagGridWrap');
      const arrow = document.getElementById('tagSectionArrow');
      if (!wrap) return;
      wrap.classList.toggle('collapsed');
      if (arrow) arrow.classList.toggle('collapsed');
    }

    function togglePostTag(el) {
      const topic = el.dataset.topic;
      const wasSelected = el.classList.contains('selected');
      if (wasSelected) {
        el.classList.remove('selected');
        _selectedTags = _selectedTags.filter(t => t !== topic);
      } else {
        if (_selectedTags.length >= 5) return showToast('最多选择5个标签');
        el.classList.add('selected');
        _selectedTags.push(topic);
      }
      updateSelectedTagPreview();
    }



    function addCustomTag() {
      const input = document.getElementById('customTagInput');
      if (!input) return;
      const tag = input.value.trim();
      if (!tag || tag.length > 6) return showToast('标签名1-6个字');
      if (_selectedTags.includes(tag)) return showToast('标签已选择');
      if (_selectedTags.length >= 5) return showToast('最多选择5个标签');
      _selectedTags.push(tag);
      input.value = '';
      renderPostTagGrid();
      updateSelectedTagPreview();
    }



    async function submitWallPost() {
      const content = document.getElementById('wallPostContent').value.trim();
      if (!content) return showToast('请输入内容');
      if (content.length > 500) return showToast('内容不能超过500字');
      const hashTags = [..._selectedTags];
      
      const data = { 
        phone: currentUser.phone, 
        nickname: currentUser.name, 
        avatar: currentUser.avatar || '', 
        content: content, 
        tags: hashTags.join(',')
      };
      const files = (wallSelectedFiles && wallSelectedFiles.length > 0) ? wallSelectedFiles : null;
      const res = await API.wallPost(data, files);
      
      if (res.error) return showToast(res.error);
      // 清空已选文件
      wallSelectedFiles = [];
      renderWallFilePreview();
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

      // 渲染头像
      function avatarHtml(avatar, nickname, size) {
        const s = size || 36;
        const fs = Math.round(s * 0.4);
        if (avatar && (avatar.startsWith('/') || avatar.startsWith('http'))) {
          return `<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden;flex-shrink:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);border:2px solid rgba(255,255,255,0.8)" onclick="showWallUser('${data.phone}')"><img src="${escHtml(avatar)}" style="width:100%;height:100%;object-fit:cover" /></div>`;
        }
        const letter = (avatar && /\p{Emoji}/u.test(avatar) && avatar.length<=2) ? avatar : (nickname||'匿')[0];
        return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:linear-gradient(135deg,#FF6B2B,#FF8F5E);color:#fff;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:700;flex-shrink:0;cursor:pointer;box-shadow:0 2px 8px rgba(255,107,43,0.2)" onclick="showWallUser('${data.phone}')">${letter}</div>`;
      }

      // 渲染单条回复（楼中楼）
      function renderReply(r, parentCommentId) {
        return `
          <div style="padding:12px 0 10px 14px;border-left:3px solid rgba(255,107,43,0.25);margin-left:8px;border-radius:0 8px 8px 0;transition:all 0.2s" onmouseover="this.style.background='rgba(255,107,43,0.03)';this.style.borderLeftColor='rgba(255,107,43,0.5)'" onmouseout="this.style.background='transparent';this.style.borderLeftColor='rgba(255,107,43,0.25)'">
            <div style="display:flex;align-items:center;gap:6px">
              ${avatarHtml(r.avatar, r.nickname, 24)}
              <span style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(r.nickname||'匿名')}</span>
              ${r.reply_to_nickname ? `<span style="font-size:11px;color:var(--text-secondary)">回复</span><span style="font-size:13px;font-weight:700;color:#FF6B2B">${escHtml(r.reply_to_nickname)}</span>` : ''}
            </div>
            <div style="font-size:14px;line-height:1.7;margin:6px 0 6px 32px;color:var(--text)">${escHtml(r.content)}</div>
            <div style="display:flex;align-items:center;gap:12px;margin-left:32px">
              <span style="font-size:11px;color:var(--text-secondary)">${timeAgo(r.created_at)}</span>
              <button onclick="doCommentLike(${r.id},this)" style="background:none;border:none;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:3px 6px;border-radius:10px;transition:all 0.15s" onmouseover="this.style.color='#E74C3C';this.style.background='rgba(231,76,60,0.08)'" onmouseout="this.style.color='var(--text-secondary)';this.style.background='transparent'">❤️ ${r.like_count||0}</button>
              <button onclick="replyToComment(${parentCommentId},'${escHtml(r.nickname||'匿名')}','${r.phone}')" style="background:none;border:none;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:3px 6px;border-radius:10px;transition:all 0.15s" onmouseover="this.style.color='#FF6B2B';this.style.background='rgba(255,107,43,0.08)'" onmouseout="this.style.color='var(--text-secondary)';this.style.background='transparent'">💬 回复</button>
              <button onclick="showReportMenu('comment',${r.id})" style="background:none;border:none;font-size:11px;color:var(--text-secondary);cursor:pointer;padding:3px 6px;border-radius:10px;margin-left:auto;opacity:0.5;transition:opacity 0.15s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">🚫</button>
            </div>
          </div>`;
      }

      // 渲染顶级评论
      function renderTopComment(c, idx) {
        const replyList = replyMap[c.id] || [];
        const replyCount = replyList.length;
        return `
          <div style="padding:16px 0;${idx < topLevel.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}animation:fadeIn 0.35s ease ${idx*0.06}s both">
            <div style="display:flex;align-items:flex-start;gap:10px">
              <div style="position:relative;flex-shrink:0">
                ${avatarHtml(c.avatar, c.nickname, 38)}
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-size:14px;font-weight:800;color:var(--text)">${escHtml(c.nickname||'匿名')}</span>
                  <span style="font-size:11px;color:var(--text-secondary);opacity:0.7">${timeAgo(c.created_at)}</span>
                </div>
                <div style="font-size:15px;line-height:1.75;margin:8px 0;color:var(--text)">${escHtml(c.content)}</div>
                <div style="display:flex;align-items:center;gap:10px">
                  <button onclick="doCommentLike(${c.id},this)" style="background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:5px 10px;border-radius:14px;transition:all 0.15s;display:flex;align-items:center;gap:4px" onmouseover="this.style.color='#E74C3C';this.style.background='rgba(231,76,60,0.08)'" onmouseout="this.style.color='var(--text-secondary)';this.style.background='transparent'">❤️ <span>${c.like_count||0}</span></button>
                  <button onclick="replyToComment(${c.id},'${escHtml(c.nickname||'匿名')}','${c.phone}')" style="background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:5px 10px;border-radius:14px;transition:all 0.15s;display:flex;align-items:center;gap:4px" onmouseover="this.style.color='#FF6B2B';this.style.background='rgba(255,107,43,0.08)'" onmouseout="this.style.color='var(--text-secondary)';this.style.background='transparent'">💬 回复</button>
                  <button onclick="showReportMenu('comment',${c.id})" style="background:none;border:none;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:5px 10px;border-radius:14px;margin-left:auto;opacity:0.45;transition:opacity 0.15s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.45'">🚫</button>
                </div>
                ${replyCount > 0 ? `
                  <div style="margin-top:10px;background:linear-gradient(135deg,rgba(255,107,43,0.03),rgba(255,107,43,0.06));border-radius:14px;padding:4px 12px 8px;border:1px solid rgba(255,107,43,0.08)">
                    ${replyList.map(r => renderReply(r, c.id)).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>`;
      }

      // 图片渲染
      let imagesHtml = '';
      if (data.images && data.images.length) {
        const imgs = Array.isArray(data.images) ? data.images : data.images.split(',').filter(Boolean);
        const imgCount = imgs.length;
        if (imgCount === 1) {
          const url = typeof imgs[0] === 'object' ? imgs[0].url : imgs[0];
          const isVid = typeof imgs[0] === 'object' ? imgs[0].isVideo : /\.mp4|\.mov|\.webm/i.test(url);
          imagesHtml = isVid
            ? `<video src="${url}" controls style="width:100%;border-radius:16px;margin-top:14px;box-shadow:0 2px 12px rgba(0,0,0,0.08)" muted></video>`
            : `<img src="${url}" style="width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin-top:14px;cursor:zoom-in;box-shadow:0 2px 12px rgba(0,0,0,0.08)" loading="lazy" onclick="window.open(this.src)" />`;
        } else if (imgCount === 2) {
          imagesHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">${imgs.map(img => {
            const url = typeof img === 'object' ? img.url : img;
            const isVid = typeof img === 'object' ? img.isVideo : /\.mp4|\.mov|\.webm/i.test(url);
            return isVid ? `<video src="${url}" style="width:100%;height:220px;object-fit:cover;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,0.06)" muted></video>` : `<img src="${url}" style="width:100%;height:220px;object-fit:cover;border-radius:14px;cursor:zoom-in;box-shadow:0 2px 8px rgba(0,0,0,0.06)" loading="lazy" onclick="window.open(this.src)" />`;
          }).join('')}</div>`;
        } else {
          imagesHtml = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px">${imgs.slice(0,9).map(img => {
            const url = typeof img === 'object' ? img.url : img;
            const isVid = typeof img === 'object' ? img.isVideo : /\.mp4|\.mov|\.webm/i.test(url);
            return isVid ? `<video src="${url}" style="width:100%;height:130px;object-fit:cover;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.05)" muted></video>` : `<img src="${url}" style="width:100%;height:130px;object-fit:cover;border-radius:12px;cursor:zoom-in;box-shadow:0 1px 6px rgba(0,0,0,0.05)" loading="lazy" onclick="window.open(this.src)" />`;
          }).join('')}${imgCount > 9 ? `<div style="width:100%;height:130px;background:var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--text-secondary)">+${imgCount-9}</div>` : ''}</div>`;
        }
      }

      // 标签渲染
      const tagsHtml = (data.tags && data.tags.length) ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${data.tags.map(t => {
        const cfg = TAG_CONFIG[t] || { emoji: '🏷️', color: '#95A5A6' };
        return `<span onclick="filterByTag('${t}');closeSubPage('wallDetailPage_sub')" style="display:inline-flex;align-items:center;gap:3px;padding:5px 14px;border-radius:16px;font-size:12px;font-weight:600;background:linear-gradient(135deg,${cfg.color}10,${cfg.color}20);color:${cfg.color};cursor:pointer;transition:all 0.2s;border:1px solid ${cfg.color}20" onmouseover="this.style.background='linear-gradient(135deg,${cfg.color}25,${cfg.color}35)';this.style.transform='translateY(-1px)'" onmouseout="this.style.background='linear-gradient(135deg,${cfg.color}10,${cfg.color}20)';this.style.transform='translateY(0)'">${t}</span>`;
      }).join('')}</div>` : '';

      const aiTagsHtml = (data.ai_tags && data.ai_tags.length) ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${data.ai_tags.map(at => `<span onclick="filterByTag('${at}');closeSubPage('wallDetailPage_sub')" style="display:inline-flex;align-items:center;gap:3px;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:600;background:linear-gradient(135deg,#8E44AD0A,#8E44AD18);color:#8E44AD;cursor:pointer;transition:all 0.2s;border:1px solid #8E44AD18" onmouseover="this.style.background='linear-gradient(135deg,#8E44AD18,#8E44AD2A)';this.style.transform='translateY(-1px)'" onmouseout="this.style.background='linear-gradient(135deg,#8E44AD0A,#8E44AD18)';this.style.transform='translateY(0)'">🤖 ${escHtml(at)}</span>`).join('')}</div>` : '';

      // 内联操作按钮（编辑/举报/拉黑/删除）
      var detailEditBtn = (currentUser && data.phone === currentUser.phone) ? '<button onclick="event.stopPropagation();doEditWallPost('+data.id+')" style="background:none;border:none;font-size:13px;cursor:pointer;padding:9px 16px;border-radius:10px;transition:all 0.15s;display:flex;align-items:center;gap:8px;white-space:nowrap;color:var(--text);width:100%" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'">✏️ 编辑</button>' : '';
      var detailReportBtn = '<button onclick="event.stopPropagation();showReportMenu(\''+('post')+'\','+data.id+')" style="background:none;border:none;font-size:13px;cursor:pointer;padding:9px 16px;border-radius:10px;transition:all 0.15s;display:flex;align-items:center;gap:8px;white-space:nowrap;color:var(--text);width:100%" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'">🚫 举报</button>';
      var detailBlockBtn = (currentUser && data.phone !== currentUser.phone) ? '<button onclick="event.stopPropagation();doBlockUser(\''+escHtml(data.phone)+'\')" style="background:none;border:none;font-size:13px;cursor:pointer;padding:9px 16px;border-radius:10px;transition:all 0.15s;color:#E74C3C;display:flex;align-items:center;gap:8px;white-space:nowrap;width:100%" onmouseover="this.style.background=\'rgba(231,76,60,0.08)\'" onmouseout="this.style.background=\'transparent\'">🚷 拉黑</button>' : '';
      var detailDeleteBtn = ((currentUser && data.phone === currentUser.phone) || (currentUser && (currentUser.role==='admin'||currentUser.role==='super'))) ? '<button onclick="event.stopPropagation();doDeletePost('+data.id+')" style="background:none;border:none;font-size:13px;cursor:pointer;padding:9px 16px;border-radius:10px;transition:all 0.15s;color:#E74C3C;display:flex;align-items:center;gap:8px;white-space:nowrap;width:100%" onmouseover="this.style.background=\'rgba(231,76,60,0.08)\'" onmouseout="this.style.background=\'transparent\'">🗑️ 删除</button>' : '';
      var detailInlineActions = detailEditBtn + detailReportBtn + detailBlockBtn + detailDeleteBtn;

      const el = document.getElementById('wallDetailContent');
      el.innerHTML = `
        <!-- 帖子主体 -->
        <div style="background:var(--card);border-radius:16px;margin-bottom:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
          <div style="padding:18px 16px 16px">
          <!-- 作者信息 -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div style="position:relative;flex-shrink:0;cursor:pointer" onclick="event.stopPropagation();showWallUser('${escHtml(data.phone)}')">
              ${avatarHtml(data.avatar, data.nickname, 56)}
            </div>
            <div style="flex:1;min-width:0" onclick="event.stopPropagation();showWallUser('${escHtml(data.phone)}')" title="查看个人主页">
              <div style="font-size:16px;font-weight:800;color:var(--primary);line-height:1.3;cursor:pointer">${escHtml(data.nickname)}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:3px">${timeAgo(data.created_at)}</div>
            </div>
            <span style="position:relative;flex-shrink:0"><button onclick="event.stopPropagation();toggleInlineActions(this,${data.id},'${escHtml(data.phone)}',event)" style="background:none;border:none;font-size:20px;color:var(--text-secondary);cursor:pointer;padding:8px 10px;border-radius:50%;transition:all 0.2s" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">⋯</button><span class="wall-inline-actions" style="display:none;position:absolute;right:0;top:100%;background:var(--card);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:6px;z-index:50;min-width:120px;margin-top:4px" onmouseleave="this.classList.remove('open')">${detailInlineActions}</span></span>
          </div>

          <!-- 帖子内容 -->
          <div style="font-size:16px;line-height:1.9;color:var(--text);word-break:break-word;white-space:pre-wrap;padding-left:4px">${escHtml(data.content)}</div>

          <!-- 标签 -->
          ${tagsHtml}${aiTagsHtml}

          <!-- 图片 -->
          ${imagesHtml}

          <!-- 互动栏 -->
          <div style="display:flex;align-items:center;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
            <button onclick="event.stopPropagation();doWallLike(${data.id},this)" style="display:flex;align-items:center;gap:6px;padding:9px 18px;border-radius:24px;border:1px solid rgba(231,76,60,0.2);background:rgba(231,76,60,0.04);color:#E74C3C;font-size:14px;cursor:pointer;transition:all 0.2s;font-weight:600" onmouseover="this.style.background='rgba(231,76,60,0.12)';this.style.transform='scale(1.03)'" onmouseout="this.style.background='rgba(231,76,60,0.04)';this.style.transform='scale(1)'">❤️ <span>${data.like_count||0}</span></button>
            <button style="display:flex;align-items:center;gap:6px;padding:9px 18px;border-radius:24px;border:1px solid rgba(69,183,209,0.2);background:rgba(69,183,209,0.04);color:#45B7D1;font-size:14px;cursor:default;font-weight:600">💬 <span>${comments.length}</span></button>
            <button onclick="event.stopPropagation();doSharePost(${data.id})" style="display:flex;align-items:center;gap:6px;padding:9px 18px;border-radius:24px;border:1px solid rgba(255,107,43,0.2);background:rgba(255,107,43,0.04);color:#FF6B2B;font-size:14px;cursor:pointer;transition:all 0.2s;font-weight:600" onmouseover="this.style.background='rgba(255,107,43,0.12)';this.style.transform='scale(1.03)'" onmouseout="this.style.background='rgba(255,107,43,0.04)';this.style.transform='scale(1)'">📤 <span>${data.share_count||0}</span></button>
            <div style="flex:1"></div>
            <button onclick="showReportMenu('post',${data.id})" style="display:flex;align-items:center;gap:4px;padding:8px 14px;border-radius:24px;border:1px solid var(--border);background:var(--bg);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:all 0.2s;opacity:0.5" onmouseover="this.style.opacity='1';this.style.borderColor='#d0d0d0';this.style.color='#666'" onmouseout="this.style.opacity='0.5';this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">🚫 举报</button>
          </div>
          </div>
        </div>

        <!-- 评论区 -->
        <div style="background:var(--card);border-radius:16px;padding:16px;margin-bottom:10px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:12px;border-bottom:1px solid var(--border)">
            <span style="font-size:17px;font-weight:800;color:var(--text)">💬 评论</span>
            <span style="font-size:13px;color:#FF6B2B;background:rgba(255,107,43,0.1);padding:2px 10px;border-radius:12px;font-weight:700">${comments.length}</span>
          </div>
          ${topLevel.length ? topLevel.map((c, i) => renderTopComment(c, i)).join('') : '<div style="text-align:center;padding:40px 0;color:var(--text-secondary)"><div style="font-size:44px;margin-bottom:10px;opacity:0.6">💭</div><div style="font-size:14px">暂无评论，来说两句吧~</div></div>'}
        </div>

        <!-- 评论输入框 -->
        <div style="position:sticky;bottom:0;background:var(--card);padding:10px 16px;border-radius:16px 16px 0 0;box-shadow:0 -2px 12px rgba(0,0,0,0.06)">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#FF6B2B,#FF8F5E,#FFB088)"></div>
          <div id="cancelReplyHint" style="display:none;font-size:11px;color:#FF6B2B;background:rgba(255,107,43,0.1);padding:3px 10px;border-radius:10px;white-space:nowrap;cursor:pointer;margin-bottom:6px" onclick="cancelReply()">✕ 取消回复</div>
          <div id="wallCommentEmojiPanel" style="display:none;margin-bottom:8px"></div>
          <div id="wallCommentMediaPreview" style="display:none;margin-bottom:8px"></div>
          <div style="display:flex;gap:8px;align-items:center">
            <button onclick="toggleWallCommentEmoji()" style="font-size:22px;background:none;border:none;cursor:pointer;padding:4px;border-radius:8px;transition:background 0.15s;flex-shrink:0" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'" title="表情">😊</button>
            <label style="font-size:22px;cursor:pointer;padding:4px;border-radius:8px;transition:background 0.15s;flex-shrink:0;display:flex;align-items:center" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'" title="上传图片/视频">
              📷<input type="file" style="display:none" onchange="uploadWallCommentMedia(this)">
            </label>
            <input id="wallCommentInput" placeholder="写评论..." style="flex:1;border:1.5px solid var(--border);border-radius:24px;padding:10px 18px;font-size:14px;outline:none;background:var(--bg);color:var(--text);transition:all 0.2s" onfocus="this.style.borderColor='#FF6B2B';this.style.boxShadow='0 0 0 3px rgba(255,107,43,0.08)'" onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'" />
            <button id="wallCommentSendBtn" onclick="submitWallComment(${data.id})" style="background:linear-gradient(135deg,#FF6B2B,#FF8F5E);color:#fff;border:none;border-radius:24px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.2s;box-shadow:0 3px 12px rgba(255,107,43,0.35);letter-spacing:0.5px" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 16px rgba(255,107,43,0.45)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 3px 12px rgba(255,107,43,0.35)'">发送</button>
          </div>
        </div>
      `;
      openSubPage('wallDetailPage_sub');
    }


    let _replyContext = null; // { parentId, replyToNickname, replyToPhone }
    let _currentWallPostId = null;
    let _wallCommentMediaFile = null;


    async function submitWallComment(postId) {
      const input = document.getElementById('wallCommentInput');
      const content = input.value.trim();
      if (!content && !_wallCommentMediaFile) return showToast('请输入内容或上传图片/视频');
      const sendBtn = document.getElementById('wallCommentSendBtn');
      if (sendBtn) sendBtn.disabled = true;
      try {
        let mediaUrl = '';
        let mediaType = '';
        if (_wallCommentMediaFile) {
          showToast('上传中...');
          const uploadRes = await API.chatUpload(_wallCommentMediaFile);
          if (uploadRes.error) { showToast(uploadRes.error); if (sendBtn) sendBtn.disabled = false; return; }
          mediaUrl = uploadRes.url;
          mediaType = uploadRes.type || (_wallCommentMediaFile.type.startsWith('video/') ? 'video' : 'image');
        }
        let finalContent = content;
        if (mediaUrl) {
          finalContent = content ? content + '\n' + mediaUrl : mediaUrl;
        }
        const data = { phone: currentUser.phone, nickname: currentUser.name, avatar: currentUser.avatar || '', content: finalContent };
        if (_replyContext) {
          data.parent_id = _replyContext.parentId;
          data.reply_to_nickname = _replyContext.replyToNickname;
          data.reply_to_phone = _replyContext.replyToPhone;
        }
        const res = await API.wallComment(postId, data);
        if (res.error) { showToast(res.error); if (sendBtn) sendBtn.disabled = false; return; }
        _replyContext = null;
        if (sendBtn) sendBtn.textContent = '发送';
        const cancelHint = document.getElementById('cancelReplyHint');
        if (cancelHint) cancelHint.style.display = 'none';
        const input2 = document.getElementById('wallCommentInput');
        if (input2) input2.placeholder = '写评论...';
        clearWallCommentMedia();
        showToast('评论成功');
        showWallDetail(postId);
        loadWallFeed();
      } finally {
        if (sendBtn) sendBtn.disabled = false;
      }
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



    // 😊 帖子详情评论表情面板
    function toggleWallCommentEmoji() {
      const panel = document.getElementById('wallCommentEmojiPanel');
      if (!panel) return;
      if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        if (!panel.innerHTML) {
          const emojis = ['😀','😂','🤣','😊','😍','🥰','😘','😜','🤔','😎','🥺','😢','😤','👍','👏','🙏','💪','🎉','❤️','🔥','💯','✨','👀','🤝','💰','🎁','📦','📱','💻','📚','🎮','🎵','🍕','🍔','☕','🍦','⚽','🏠','🚀','⭐','🌈','💡','🔔','💬','🤗','😌','🤩','😇','🥳'];
          panel.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:8px;background:var(--bg);border-radius:10px;max-height:160px;overflow-y:auto">' +
            emojis.map(e => '<span style="font-size:22px;cursor:pointer;padding:4px;border-radius:6px;transition:background 0.15s" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'" onclick="insertWallCommentEmoji(\'' + e + '\')">' + e + '</span>').join('') +
          '</div>';
        }
      } else {
        panel.style.display = 'none';
      }
    }



    function insertWallCommentEmoji(emoji) {
      const input = document.getElementById('wallCommentInput');
      if (input) {
        const start = input.selectionStart;
        input.value = input.value.substring(0, start) + emoji + input.value.substring(input.selectionEnd);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
      }
    }



    // 📷 帖子详情评论图片/视频上传
    function uploadWallCommentMedia(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('文件不能超过5MB'); input.value = ''; return; }
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { showToast('仅支持图片/视频'); input.value = ''; return; }
      _wallCommentMediaFile = file;
      const preview = document.getElementById('wallCommentMediaPreview');
      if (!preview) return;
      preview.style.display = 'block';
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        preview.innerHTML = '<div style="position:relative;display:inline-block">' +
          '<video src="' + url + '" style="max-height:80px;border-radius:6px" muted></video>' +
          '<span onclick="clearWallCommentMedia()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>' +
        '</div>';
      } else {
        preview.innerHTML = '<div style="position:relative;display:inline-block">' +
          '<img src="' + url + '" style="max-height:80px;border-radius:6px" />' +
          '<span onclick="clearWallCommentMedia()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>' +
        '</div>';
      }
    }



    function clearWallCommentMedia() {
      _wallCommentMediaFile = null;
      const preview = document.getElementById('wallCommentMediaPreview');
      if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
      const fileInput = document.querySelector('#wallCommentMediaPreview + div label input[type=file]');
      if (fileInput) fileInput.value = '';
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
      var bgStyle = '';
      if (data.bg_image) {
        bgStyle = 'background-image:url(' + escHtml(data.bg_image) + ');background-size:cover;background-position:center';
      } else {
        bgStyle = 'background:' + (data.bg_color || '#FF6B2B');
      }
      var contactHtml = '';
      if (data.name && data.showName) {
        contactHtml += '<div style="display:inline-flex;align-items:center;gap:4px;margin:6px 6px 0;font-size:12px;color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,0.2)">👤 ' + escHtml(data.name) + '</div>';
      }
      if (data.dormitory) {
        var dormInfo = data.dormitory + (data.room ? ' ' + data.room : '');
        contactHtml += '<div style="display:inline-flex;align-items:center;gap:4px;margin:6px 6px 0;font-size:12px;color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,0.2)">🏠 ' + escHtml(dormInfo) + '</div>';
      }
      if (data.wechat) {
        contactHtml += '<div style="display:inline-flex;align-items:center;gap:4px;margin:6px 6px 0;font-size:12px;color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,0.2)">💬 微信: ' + escHtml(data.wechat) + '</div>';
      }
      if (data.qq) {
        contactHtml += '<div style="display:inline-flex;align-items:center;gap:4px;margin:6px 6px 0;font-size:12px;color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,0.2)">🐧 QQ: ' + escHtml(data.qq) + '</div>';
      }
      if (data.phoneDisplay && data.phoneDisplay !== phone && data.phoneDisplay.indexOf('****') === -1) {
        contactHtml += '<div style="display:inline-flex;align-items:center;gap:4px;margin:6px 6px 0;font-size:12px;color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,0.2)">📱 ' + escHtml(data.phoneDisplay) + '</div>';
      }
      if (data.bio && data.bio !== 'null') {
        contactHtml = '<div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:8px;padding:0 20px;text-shadow:0 1px 2px rgba(0,0,0,0.2)">' + escHtml(data.bio) + '</div>' + contactHtml;
      }
      const el = document.getElementById('wallProfileContent');
      el.innerHTML = `
        <div style="text-align:center;padding:32px 0 20px;position:relative;overflow:hidden;border-radius:16px 16px 0 0;margin-bottom:16px;${bgStyle}">
          <div style="position:relative;z-index:1">
            <div class="wall-avatar" style="width:64px;height:64px;${data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http')) ? 'overflow:hidden' : 'font-size:28px'};margin:0 auto 12px;border:3px solid rgba(255,255,255,0.6);box-shadow:0 2px 8px rgba(0,0,0,0.2)">${data.avatar && (data.avatar.startsWith('/') || data.avatar.startsWith('http')) ? '<img src="'+escHtml(data.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />' : (data.avatar && /\p{Emoji}/u.test(data.avatar) && data.avatar.length<=2 ? data.avatar : (data.nickname||'匿')[0])}</div>
            <div style="font-size:18px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.3)">${escHtml(data.nickname)}</div>
            ${contactHtml}
          </div>
        </div>
        <div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px">
          <div style="cursor:pointer" onclick="showFollowList('${phone}','followers')" title="查看粉丝列表"><div style="font-size:18px;font-weight:900">${data.followers}</div><div style="font-size:12px;color:var(--text-secondary,#888)">粉丝</div></div>
          <div style="cursor:pointer" onclick="showFollowList('${phone}','following')" title="查看关注列表"><div style="font-size:18px;font-weight:900">${data.following}</div><div style="font-size:12px;color:var(--text-secondary,#888)">关注</div></div>
          <div><div style="font-size:18px;font-weight:900">${data.postCount}</div><div style="font-size:12px;color:var(--text-secondary,#888)">帖子</div></div>
        </div>
        ${!isMe ? '<div style="display:flex;gap:10px;margin-bottom:16px;justify-content:center"><button onclick="doWallFollow(\''+phone+'\')" class="submit-btn" style="padding:10px 24px">' + (data.isFollowing ? '已关注' : '+ 关注') + '</button><button onclick="tryWallChat(\''+phone+'\')" class="submit-btn" style="padding:10px 24px;background:linear-gradient(135deg,#45B7D1,#6DD5ED);color:#fff">💬 私信</button></div>' : ''}
        <div style="font-weight:700;margin-bottom:12px">📝 ${isMe ? '我的' : 'TA的'}帖子</div>
        ${posts.length ? posts.map(p => `
          <div class="wall-card" style="margin-bottom:12px">
            <div class="wall-content" onclick="closeSubPage('wallProfilePage_sub');showWallDetail(${p.id})">${escHtml(p.content)}</div>
            ${p.images && p.images.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + (Array.isArray(p.images) ? p.images : []).map(img => {
              const url = typeof img === 'object' ? img.url : img;
              const isVid = typeof img === 'object' ? img.isVideo : false;
              return isVid ? '<video src="' + url + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px" muted></video>' : '<img src="' + url + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px" loading="lazy" />';
            }).join('') + '</div>' : ''}
            <div class="wall-actions"><button class="wall-action" onclick="event.stopPropagation();doWallLike(${p.id},this)">❤️ <span>${p.like_count||0}</span></button><button class="wall-action" onclick="closeSubPage('wallProfilePage_sub');showWallDetail(${p.id})">💬 <span>${p.comment_count||0}</span></button></div>
          </div>
        `).join('') : '<div style="text-align:center;color:var(--text-secondary,#888);padding:20px">暂无帖子</div>'}
      `;
      openSubPage('wallProfilePage_sub');
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
      closeSubPage('wallProfilePage_sub');
      currentConvId = res.id;
      currentConvPhone = otherPhone;
      const profile = await API.wallUserProfile(otherPhone);
      const otherName = profile.nickname || profile.name || otherPhone;
      document.getElementById('chatConvTitle').textContent = otherName;
      // 切换到消息页面并显示聊天对话
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('messagePage').classList.add('active');
      document.getElementById('chatConversation').style.display = 'flex';
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
        return '<div class="follow-list-item" style="animation-delay:' + (i*0.04) + 's" onclick="closeSubPage(\'followListPage_sub\');closeSubPage(\'wallProfilePage_sub\');setTimeout(()=>showWallUser(\''+u.phone+'\'),100)">' +
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
      // 切换到消息页面时加载消息列表
      if (!currentUser) return showLoginPage();
      await loadChatList();
    }

    // 初始化消息页面
    async function initMessagePage() {
      if (!currentUser) {
        document.getElementById('chatListBody').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:16px">💬</div><div>请先登录</div></div>';
        return;
      }
      await loadChatList();
    }



    async function loadChatList() {
      const el = document.getElementById('chatListBody');
      // 并行拉取私信 + 通知 + 我的社团群聊
      const [list, notifs, clubs] = await Promise.all([
        API.chatConversations(currentUser.phone).catch(() => []),
        API.getNotifications(currentUser.phone).catch(() => []),
        API.getMyClubs().catch(() => [])
      ]);
      const notifArr = Array.isArray(notifs) ? notifs : [];
      const clubsArr = (clubs && clubs.list) ? clubs.list : (Array.isArray(clubs) ? clubs : []);
      // 同步到 core.js 闭包，确保徽章准确
      if (typeof setNotifications === 'function') setNotifications(notifArr);
      // 分享横幅（内嵌在列表顶部，不是弹窗）
      var shareBanner = '';
      if (window._pendingSharePostId) {
        shareBanner = '<div id="shareHint" style="background:linear-gradient(135deg,#FF6B2B,#FF8F5E);color:white;padding:10px 16px;margin-bottom:8px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-size:14px"><span>📤 点击下方好友分享帖子</span><button onclick="window._pendingSharePostId=null;loadChatList()" style="background:rgba(255,255,255,0.25);border:none;color:white;padding:3px 10px;border-radius:10px;cursor:pointer;font-size:12px">取消</button></div>';
      }
      // 社团群聊条目（由 club-chat.js 渲染）
      var clubChatItems = typeof renderClubChatItems === 'function' ? renderClubChatItems(clubsArr) : '';
      if ((!list || !list.length) && !notifArr.length && !clubChatItems) {
        el.innerHTML = shareBanner + '<div style="padding:40px;text-align:center;color:var(--text-secondary)">暂无消息</div>';
        return;
      }
      // 通知汇总条目（合并为一个对话）
      const unreadNotifCount = notifArr.filter(n => !n.read).length;
      const latestNotif = notifArr.length > 0 ? notifArr[0] : null;
      const notifPreview = latestNotif ? escHtml(latestNotif.title) : '暂无通知';
      const notifTime = latestNotif ? timeAgo(latestNotif.created_at) : '';
      const notifBadge = unreadNotifCount > 0 ? '<span class="chat-item-badge">' + (unreadNotifCount > 99 ? '99+' : unreadNotifCount) + '</span>' : '';

      const notifItem = `<div class="chat-item" onclick="openNotifConv()">
        <div class="chat-item-avatar notif-avatar system">🔔</div>
        <div class="chat-item-info">
          <div class="chat-item-top">
            <span class="chat-item-name">通知</span>
            <span class="chat-item-time">${notifTime}</span>
          </div>
          <div class="chat-item-bottom">
            <span class="chat-item-msg">${notifPreview}</span>
            ${notifBadge}
          </div>
        </div>
      </div>`;
      // 私信条目渲染
      function _shareFriendlyPreview(msg) {
        if (!msg) return '';
        var prefix = '';
        if (msg.startsWith('[SHARE_STAR]')) {
          try { var d = JSON.parse(msg.substring(12)); prefix = '🌸 分享了 ' + (d.name || '一位校花校草'); }
          catch(e) { prefix = '🌸 分享了一位校花校草'; }
          return prefix;
        }
        if (msg.startsWith('[SHARE_POST]')) return '📣 分享了一条校园墙';
        return msg;
      }
      const chatItems = (list || []).map(c => `
        <div class="chat-item" onclick="${window._pendingSharePostId ? 'window.shareAndOpenConv' : 'openChatConv'}(${c.id},'${escHtml(c.other_phone)}','${escHtml(c.other_name)}')">
          <div class="chat-item-avatar">${(c.other_name||'?')[0]}</div>
          <div class="chat-item-info">
            <div class="chat-item-top">
              <span class="chat-item-name">${escHtml(c.other_name||c.other_phone)}</span>
              <span class="chat-item-time">${timeAgo(c.last_message_at)}</span>
            </div>
            <div class="chat-item-bottom">
              <span class="chat-item-msg">${escHtml((c.last_sender===currentUser.phone?'我:':'') + _shareFriendlyPreview(c.last_message||''))}</span>
              ${c.unread? '<span class="chat-item-badge">' + c.unread + '</span>':''}
            </div>
          </div>
        </div>
      `);
      // 通知在前，社团群聊在中间，私信在后
      el.innerHTML = shareBanner + notifItem + clubChatItems + chatItems.join('');
      // 导出分享+打开会话的组合函数
      window.shareAndOpenConv = function(convId, otherPhone, otherName) {
        if (window._pendingSharePostId) {
          var postId = window._pendingSharePostId;
          window._pendingSharePostId = null;
          openChatConv(convId, otherPhone, otherName);
          sendShareMessageToConv(convId, postId);
        }
      };
    }

    // 点击通知标记已读
    async function markNotifRead(id) {
      try { await API.markRead(currentUser.phone); } catch(e) {}
      loadChatList();
      if (typeof updateMsgBadge === 'function') updateMsgBadge();
    }

    // 打开通知对话
    async function openNotifConv() {
      try { await API.markRead(currentUser.phone); } catch(e) {}
      if (typeof updateMsgBadge === 'function') updateMsgBadge();
      document.getElementById('chatConversation').style.display = 'none';
      document.getElementById('notifConversation').style.display = 'flex';
      await loadNotifMessages();
    }

    // 关闭通知对话，回到消息列表
    function backFromNotifConv() {
      document.getElementById('notifConversation').style.display = 'none';
      loadChatList();
    }

    // 加载通知对话内容
    let _notifFingerprint = '';
    async function loadNotifMessages() {
      const notifs = await API.getNotifications(currentUser.phone).catch(() => []);
      const arr = Array.isArray(notifs) ? notifs : [];
      const fp = arr.length + ':' + (arr.length > 0 ? arr[arr.length-1].id : '');
      if (fp === _notifFingerprint) return;
      _notifFingerprint = fp;
      const el = document.getElementById('notifMessages');
      const iconMap = {order:'📦',wall_like:'❤️',wall_comment:'💬',rating:'⭐',promo:'🎉'};
      el.innerHTML = arr.map(n => {
        const icon = iconMap[n.type] || '🔔';
        const time = new Date(n.created_at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
        return `<div style="display:flex;justify-content:center;margin:8px 0;font-size:12px;color:var(--text-secondary)">${time}</div>
          <div style="display:flex;justify-content:flex-start;padding:4px 12px">
            <div style="background:var(--card);border-radius:16px 16px 16px 4px;padding:10px 14px;max-width:85%;box-shadow:0 1px 4px rgba(0,0,0,0.06);line-height:1.6;font-size:14px">
              <div style="margin-bottom:4px;font-size:15px">${icon} ${escHtml(n.title)}</div>
              <div style="color:var(--text-secondary)">${escHtml(n.content)}</div>
            </div>
          </div>`;
      }).join('');
      if (arr.length === 0) el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">暂无通知</div>';
      el.scrollTop = el.scrollHeight;
    }



    async function openChatConv(convId, otherPhone, otherName) {
      currentConvId = convId;
      currentConvPhone = otherPhone;
      // 加载已保存的备注和背景
      var settings = loadChatSettings();
      document.getElementById('chatConvTitle').textContent = settings.nickname || otherName || otherPhone;
      document.getElementById('chatConversation').style.display = 'flex';
      await loadChatMessages();
      applyChatBg(settings.bg);
      if (chatRefreshTimer) clearInterval(chatRefreshTimer);
      chatRefreshTimer = setInterval(loadChatMessages, 5000);
    }

    // ─── 聊天设置 ────────────────────────────────────────
    function getChatSettingsKey() {
      return 'chat_settings_' + (currentConvPhone || '');
    }

    function loadChatSettings() {
      try {
        return JSON.parse(localStorage.getItem(getChatSettingsKey()) || '{}');
      } catch (e) { return {}; }
    }

    function saveChatSettings(settings) {
      localStorage.setItem(getChatSettingsKey(), JSON.stringify(settings));
      applyChatBg(settings.bg);
      if (settings.nickname) {
        document.getElementById('chatConvTitle').textContent = settings.nickname;
      }
    }

    function applyChatBg(bgVal) {
      var el = document.getElementById('chatMessages');
      if (!el) return;
      if (!bgVal) {
        el.style.background = '';
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
        el.style.color = '';
        return;
      }
      if (bgVal.indexOf('url(') === 0 || bgVal.match(/^(https?:\/\/|data:image)/)) {
        el.style.background = '';
        el.style.backgroundImage = 'url(' + bgVal.replace(/^url\(["']?|["']?\)$/g, '') + ')';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
      } else if (bgVal.indexOf('linear') === 0) {
        el.style.background = bgVal;
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
      } else {
        el.style.background = bgVal;
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
      }
      if (bgVal && bgVal.indexOf('#2A') >= 0) {
        el.style.color = '#eee';
      } else {
        el.style.color = '';
      }
    }

    function openChatSettings() {
      var settings = loadChatSettings();
      var otherName = document.getElementById('chatConvTitle').textContent;
      var origName = currentConvPhone || otherName;

      var nickInput = document.getElementById('chatNicknameInput');
      nickInput.value = settings.nickname || '';
      nickInput.placeholder = origName || '输入备注';

      document.getElementById('chatMessages').style.display = 'none';
      document.querySelector('#chatConversation .chat-input-bar').style.display = 'none';
      document.getElementById('chatSettingsPage').style.display = 'flex';

      var searchInput = document.getElementById('chatSearchInput');
      if (searchInput) searchInput.value = '';
      var searchRes = document.getElementById('chatSearchResults');
      if (searchRes) searchRes.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:13px;text-align:center">输入关键词开始搜索</div>';
    }

    function closeChatSettings() {
      document.getElementById('chatSettingsPage').style.display = 'none';
      document.getElementById('chatMessages').style.display = '';
      var inputBar = document.querySelector('#chatConversation .chat-input-bar');
      if (inputBar) inputBar.style.display = '';
      var settings = loadChatSettings();
      applyChatBg(settings.bg);
    }

    window.handleChatBgUpload = function(input) {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var dataUrl = e.target.result;
        var settings = loadChatSettings();
        settings.bg = dataUrl;
        saveChatSettings(settings);
        if (typeof showToast === 'function') showToast('背景已更新');
      };
      reader.readAsDataURL(file);
      input.value = '';
    };

    window.saveChatNickname = function() {
      var input = document.getElementById('chatNicknameInput');
      if (!input) return;
      var nickname = input.value.trim();
      var settings = loadChatSettings();
      settings.nickname = nickname;
      saveChatSettings(settings);
      if (nickname) {
        document.getElementById('chatConvTitle').textContent = nickname;
      } else {
        document.getElementById('chatConvTitle').textContent = currentConvPhone || '对话';
      }
      closeChatSettings();
      loadChatList();
    };

    window.resetChatNickname = function() {
      var input = document.getElementById('chatNicknameInput');
      if (input) input.value = '';
      window.saveChatNickname();
    };

    window.searchChatMessages = function(query) {
      var resultDiv = document.getElementById('chatSearchResults');
      if (!resultDiv) return;
      if (!query || query.trim().length < 1) {
        resultDiv.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:13px;text-align:center">输入关键词开始搜索</div>';
        return;
      }
      var bubbles = document.querySelectorAll('#chatMessages .message-bubble');
      var q = query.toLowerCase();
      var qEscaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regex = new RegExp('(' + qEscaped + ')', 'gi');
      var found = [];
      bubbles.forEach(function(b) {
        var text = (b.getAttribute('data-content') || b.textContent || '').toLowerCase();
        if (text.indexOf(q) >= 0) {
          found.push({
            text: b.getAttribute('data-content') || (b.textContent || '').substring(0, 60),
            time: b.getAttribute('data-time') || '',
            el: b
          });
        }
      });
      if (found.length === 0) {
        resultDiv.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:13px;text-align:center">未找到相关内容</div>';
        return;
      }
      resultDiv.innerHTML = found.map(function(item, i) {
        var preview = item.text.substring(0, 60) + (item.text.length > 60 ? '...' : '');
        var highlight = preview.replace(regex, '<span class="chat-search-highlight">$1</span>');
        var msgIdx = Array.from(document.querySelectorAll('#chatMessages .message-bubble')).indexOf(item.el);
        return '<div class="chat-search-result" onclick="closeChatSettings();setTimeout(function(){var b=document.querySelectorAll(\'#chatMessages .message-bubble\')[' + msgIdx + '];if(b){b.scrollIntoView({behavior:\'smooth\',block:\'center\'});b.style.boxShadow=\'0 0 0 3px var(--primary, #FF6B2B)\';setTimeout(function(){b.style.boxShadow=\'\'},2500)}},100)">' +
          '<div>' + highlight + '</div>' +
          (item.time ? '<div class="chat-search-result-time">' + item.time + '</div>' : '') +
        '</div>';
      }).join('');
    };

    // 发送分享消息到指定会话
    async function sendShareMessageToConv(convId, postId) {
      try {
        // 获取帖子详情构建分享内容
        let shareContent;
        try {
          const post = await API.wallPostDetail(postId);
          if (post && !post.error) {
            shareContent = buildShareContent(post);
          }
        } catch(e) {}
        if (!shareContent) shareContent = '[SHARE_POST]{"id":' + postId + ',"content":"","author":"","images":[],"time":""}';

        const res = await API.chatSend({
          conversation_id: convId,
          sender_phone: currentUser.phone,
          content: shareContent,
          type: 'share_post'
        });
        if (res.error) {
          showToast(res.error);
        } else {
          showToast('📤 已分享');
          await loadChatMessages();
        }
      } catch(e) {
        showToast('分享失败，请重试');
      }
    }

    // 构建分享消息内容
    function buildShareContent(post) {
      const data = {
        id: post.id,
        content: (post.content || '').replace(/\s+/g, ' ').trim().substring(0, 80),
        author: post.nickname || '',
        images: (post.images || []).slice(0, 3).map(function(img) {
          return typeof img === 'string' ? img : (img.url || '');
        }),
        time: post.created_at || ''
      };
      return '[SHARE_POST]' + JSON.stringify(data);
    }

    function backToChatList() {
      // 隐藏聊天对话，回到消息列表
      document.getElementById('chatConversation').style.display = 'none';
      // 停止刷新
      if (chatRefreshTimer) {
        clearInterval(chatRefreshTimer);
        chatRefreshTimer = null;
      }
      _chatMessagesFingerprint = '';
    }


    let _chatMessagesFingerprint = '';

    async function loadChatMessages() {
      if (!currentConvId) return;
      const msgs = await API.chatMessages(currentConvId, currentUser.phone);
      // 指纹比较：只在消息内容变化时才重渲染，避免闪烁
      const fp = msgs.length + ':' + (msgs.length > 0 ? msgs[msgs.length-1].id + ':' + msgs[msgs.length-1].content : '');
      if (fp === _chatMessagesFingerprint) return;
      _chatMessagesFingerprint = fp;

      const el = document.getElementById('chatMessages');
      el.innerHTML = msgs.map(m => {
        const isMe = m.sender_phone === currentUser.phone;
        let content;
        const c = m.content;
        const time = new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        if (m.type === 'image') {
          content = '<img src="'+escHtml(c)+'" style="max-width:100%;border-radius:8px;display:block;cursor:pointer" onclick="window.open(this.src)" />';
        } else if (m.type === 'video') {
          content = '<video src="'+escHtml(c)+'" style="max-width:100%;border-radius:8px;display:block" controls preload="metadata"></video>';
        } else if (m.type === 'share_post') {
          content = renderSharePostCard(c);
        } else if (m.type === 'share_star' || (c && c.indexOf('[SHARE_STAR]') === 0)) {
          content = renderShareStarCard(c);
        } else if (c.startsWith('[ANIM:')) {
          const p=c.slice(6,c.length-1).split(':');
          content = '<span class="anim-'+p[1]+'" style="font-size:36px;display:inline-block">'+p[0]+'</span>';
        } else if (c.startsWith('[GIF]')) {
          content = '<img src="'+escHtml(c.slice(5))+'" style="max-width:160px;border-radius:12px;display:block" />';
        } else {
          content = escHtml(c);
        }
        var dataContent = (c||'').replace(/(\[SHARE_POST\]|\[SHARE_STAR\]|\[GIF\]|\[ANIM:[^\]]*\])/g,'[分享]');
        return `
          <div class="message-bubble ${isMe?'me':'other'}" data-time="${time}" data-content="${escHtml(dataContent)}">
            <div class="message-content">${content}<div class="message-time">${time}</div></div>
          </div>
        `;
      }).join('');
      el.scrollTop = el.scrollHeight;
    }

    // 渲染分享帖子卡片
    function renderSharePostCard(content) {
      // 兼容旧的分享格式 [分享了一条帖子] #44
      if (content.indexOf('[SHARE_POST]') !== 0) {
        var oldMatch = content.match(/#(\d+)/);
        if (oldMatch) {
          return '<div style="background:#fff;border-radius:12px;padding:12px;border:1px solid #e0e0e0"><div style="font-size:13px;color:#999;margin-bottom:6px">📤 分享了一条帖子</div><div style="font-size:14px;color:#333">' + escHtml(content) + '</div><button onclick="showWallDetail(' + oldMatch[1] + ')" style="margin-top:8px;padding:6px 14px;border-radius:8px;background:var(--primary);color:#fff;border:none;font-size:13px;cursor:pointer">查看帖子</button></div>';
        }
        return escHtml(content);
      }
      try {
        var data = JSON.parse(content.substring(12));
        var preview = data.content || '';
        var author = data.author || '';
        var time = data.time ? data.time.substring(0, 16) : '';
        var images = (data.images || []).filter(function(u) { return u; });
        var imgsHtml = images.length > 0
          ? '<div style="display:flex;gap:4px;margin-top:8px">' + images.map(function(u) {
              return '<img src="' + u + '" style="width:56px;height:56px;border-radius:8px;object-fit:cover" />';
            }).join('') + '</div>'
          : '';
        return '<div style="background:#fff;border-radius:12px;padding:12px;border:1px solid #e0e0e0;max-width:280px">' +
          '<div style="font-size:12px;color:#999;margin-bottom:6px">📤 分享了一条校园墙帖子</div>' +
          (preview ? '<div style="font-size:14px;line-height:1.5;margin-bottom:4px;color:#333">' + escHtml(preview) + '</div>' : '') +
          (author ? '<div style="font-size:12px;color:#999;margin-bottom:4px">——' + escHtml(author) + (time ? ' · ' + time : '') + '</div>' : '') +
          imgsHtml +
          '<button onclick="showWallDetail(' + data.id + ')" style="margin-top:8px;padding:6px 14px;border-radius:8px;background:var(--primary);color:#fff;border:none;font-size:13px;cursor:pointer">查看帖子</button>' +
          '</div>';
      } catch(e) {
        return escHtml(content);
      }
    }

    // 渲染分享校花校草卡片
    function renderShareStarCard(content) {
      if (content.indexOf('[SHARE_STAR]') !== 0) {
        return escHtml(content);
      }
      try {
        var data = JSON.parse(content.substring(12));
        var photo = data.photo || '';
        var imgHtml = photo
          ? '<img src="' + escHtml(photo) + '" style="width:100%;max-height:180px;border-radius:10px;object-fit:cover;margin-top:8px" />'
          : '';
        return '<div style="background:#fff;border-radius:12px;padding:12px;border:1px solid #e0e0e0;max-width:280px;cursor:pointer" onclick="openStarFromShare(' + data.id + ')">'
          + '<div style="font-size:12px;color:#999;margin-bottom:6px">🌸 分享了一位校花校草</div>'
          + (data.intro ? '<div style="font-size:14px;line-height:1.5;margin-bottom:4px;color:#333">' + escHtml(data.intro) + '</div>' : '')
          + '<div style="font-size:12px;color:#999;margin-bottom:4px">——' + escHtml(data.name || '') + (data.votes ? ' · 🗳 ' + data.votes + ' 票' : '') + '</div>'
          + imgHtml
          + '<button onclick="event.stopPropagation();openStarFromShare(' + data.id + ')" style="margin-top:8px;padding:6px 14px;border-radius:8px;background:var(--primary);color:#fff;border:none;font-size:13px;cursor:pointer;width:100%">查看详情</button>'
          + '</div>';
      } catch(e) {
        return escHtml(content);
      }
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
    // 📷 用户端图片/视频上传
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

    // ══════ 更多菜单（分享/举报/拉黑/删除） ══════
    function showPostMoreMenu(postId, postPhone, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      const isOwn = currentUser && currentUser.phone === postPhone;
      const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super');
      const ov = document.createElement('div');
      ov.id = 'postMoreOverlay';
      ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10001;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s';
      ov.onclick = function(ev) { if (ev.target === ov) ov.remove(); };
      // 删除按钮：自己或管理员可见
      const deleteBtn = (isOwn || isAdmin) ? `<button onclick="doDeletePost(${postId})" style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:var(--bg);border:none;border-top:1px solid var(--border);cursor:pointer;font-size:15px;color:#E74C3C;text-align:left;width:100%">🗑️ 删除帖子</button>` : '';
      // 拉黑按钮：非自己可见
      const blockBtn = (!isOwn) ? `<button onclick="doBlockUser('${postPhone}')" style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:var(--bg);border:none;border-top:1px solid var(--border);cursor:pointer;font-size:15px;color:#E74C3C;text-align:left;width:100%">🚷 拉黑该用户</button>` : '';
      ov.innerHTML = `
        <div style="background:var(--card);border-radius:16px 16px 0 0;width:100%;max-width:420px;animation:slideUp 0.25s;padding-bottom:env(safe-area-inset-bottom)">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 8px">
            <div style="font-size:17px;font-weight:700">更多操作</div>
            <button onclick="document.getElementById('postMoreOverlay').remove()" style="background:none;border:none;font-size:22px;color:var(--text-secondary);cursor:pointer">✕</button>
          </div>
          ${isOwn ? `<button onclick="document.getElementById('postMoreOverlay').remove();doEditWallPost(${postId})" style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:var(--bg);border:none;cursor:pointer;font-size:15px;color:var(--text);text-align:left;width:100%" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--bg)'">✏️ 编辑</button>` : ''}
          <button onclick="document.getElementById('postMoreOverlay').remove();showReportMenu('post',${postId})" style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:var(--bg);border:none;cursor:pointer;font-size:15px;color:var(--text);text-align:left;width:100%" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--bg)'">🚫 举报</button>
          ${blockBtn}
          ${deleteBtn}
          <button onclick="document.getElementById('postMoreOverlay').remove()" style="display:block;width:100%;padding:16px;background:var(--bg);border:none;border-top:1px solid var(--border);margin-top:8px;cursor:pointer;font-size:15px;color:var(--text-secondary);text-align:center;border-radius:0">取消</button>
        </div>
      `;
      document.body.appendChild(ov);
    }

    // ══════ 分享帖子（跳转到消息页面） ══════
    async function doSharePost(postId) {
      const ov = document.getElementById('postMoreOverlay');
      if (ov) ov.remove();
      // 关闭内联操作
      document.querySelectorAll('.wall-inline-actions.open').forEach(el => el.classList.remove('open'));

      var phone = currentUser && currentUser.phone;
      if (!phone) { showToast('请先登录'); return; }

      // 加载中遮罩
      var overlay = document.createElement('div');
      overlay.id = 'shareOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s';
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = '<div style="background:var(--card);border-radius:16px 16px 0 0;width:100%;max-width:420px;padding:20px 16px 32px;animation:slideUp 0.3s"><div style="text-align:center;padding:40px 0;color:var(--text-secondary)"><div style="font-size:32px;margin-bottom:12px">⏳</div><div>加载好友列表...</div></div></div>';
      document.body.appendChild(overlay);

      // 并行拉取关注列表和粉丝列表
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
      var fSet = new Set(followers.map(u => u.phone));
      var gSet = new Set(following.map(u => u.phone));
      var allPhones = new Set([...fSet, ...gSet]);

      var users = []; // {phone, nickname, avatar, relation}
      allPhones.forEach(function(p) {
        var isF = fSet.has(p);
        var isG = gSet.has(p);
        var rel = (isF && isG) ? '互相关注' : (isF ? '关注我' : '已关注');
        var u = followers.find(function(x){return x.phone===p;}) || following.find(function(x){return x.phone===p;});
        users.push({ phone: p, nickname: u.nickname || p, avatar: u.avatar || '', relation: rel });
      });

      // 按关系排序：互相关注 > 关注我 > 已关注
      var relOrder = { '互相关注':0, '关注我':1, '已关注':2 };
      users.sort(function(a,b){ return relOrder[a.relation] - relOrder[b.relation] || a.nickname.localeCompare(b.nickname); });

      // 选中的集合
      var selected = new Set();
      var selectAll = false;

      // 头像颜色池
      var avatarColors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];

      function avatarHTML(u) {
        var initial = u.nickname.charAt(0).toUpperCase();
        var color = avatarColors[u.phone.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0) % avatarColors.length];
        var style = 'width:44px;height:44px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;background:' + color + ';';
        return u.avatar
          ? '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;overflow:hidden;background:' + color + '"><img src="' + escHtml(u.avatar) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff">' + initial + '</span></div>'
          : '<span style="' + style + '">' + initial + '</span>';
      }

      // 按关系分组
      var groups = [
        { label: '🤝 互相关注', relation: '互相关注', users: [] },
        { label: '💚 关注我的人', relation: '关注我', users: [] },
        { label: '👀 我关注的人', relation: '已关注', users: [] }
      ];
      users.forEach(function(u) {
        var g = groups.find(function(g){return g.relation===u.relation;});
        if (g) g.users.push(u);
      });
      groups = groups.filter(function(g){return g.users.length > 0;});

      function renderUserList(filteredUsers) {
        var list = filteredUsers || users;
        // 如果用搜索过滤，不分段
        if (filteredUsers) {
          return '<div style="display:flex;flex-direction:column;gap:2px">' + list.map(renderUserItem).join('') + '</div>';
        }
        // 分组渲染
        return groups.map(function(g) {
          if (g.users.length === 0) return '';
          return '<div style="margin-bottom:8px">'
            + '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);padding:6px 4px 2px;text-transform:uppercase;letter-spacing:0.5px">' + g.label + ' <span style="font-weight:400;opacity:0.7">' + g.users.length + '</span></div>'
            + '<div style="display:flex;flex-direction:column;gap:2px">' + g.users.map(renderUserItem).join('') + '</div>'
            + '</div>';
        }).join('');
      }

      function renderUserItem(u) {
        var checked = selected.has(u.phone);
        var initials = u.nickname.charAt(0).toUpperCase();
        var color = avatarColors[u.phone.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0) % avatarColors.length];
        var checkStyle = checked
          ? 'background:' + color + ';border-color:' + color + ';transform:scale(1)'
          : 'border-color:var(--border);transform:scale(0.9)';
        return '<div class="share-user-item" data-phone="' + escHtml(u.phone) + '" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);background:' + (checked?'var(--primary)08':'transparent') + ';border:1.5px solid ' + (checked?'var(--primary)20':'transparent') + '" onmouseenter="this.style.background=\'var(--bg)\'" onmouseleave="if(!' + checked + ')this.style.background=\'transparent\';this.style.borderColor=\'' + (checked?'var(--primary)20':'transparent') + '\'">'
          // 圆形checkbox
          + '<div style="width:22px;height:22px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);' + checkStyle + '">'
          + (checked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '')
          + '</div>'
          // 头像
          + avatarHTML(u)
          // 信息
          + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3">' + escHtml(u.nickname) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + escHtml(u.phone) + '</div></div>'
          + '</div>';
      }

      function renderModal() {
        overlay.innerHTML = '';
        var sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--card);border-radius:20px 20px 0 0;width:100%;max-width:440px;animation:slideUp 0.35s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;max-height:88vh;box-shadow:0 -8px 32px rgba(0,0,0,0.12)';
        overlay.appendChild(sheet);

        // === 顶部拖拽条 ===
        var dragBar = document.createElement('div');
        dragBar.style.cssText = 'width:36px;height:4px;background:var(--border);border-radius:2px;margin:10px auto 8px;flex-shrink:0';
        sheet.appendChild(dragBar);

        // === 标题栏 ===
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 20px 12px;flex-shrink:0';
        titleBar.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#FF6B2B,#FF8F5E);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(255,107,43,0.25)">📤</div><div><div style="font-size:17px;font-weight:700;color:var(--text);line-height:1.2">分享帖子</div><div style="font-size:12px;color:var(--text-secondary)">选择好友，一键群发</div></div></div><button id="shareCloseBtn" style="width:32px;height:32px;border-radius:50%;background:var(--bg);border:none;font-size:16px;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0" onmouseenter="this.style.background=\'var(--border)\'" onmouseleave="this.style.background=\'var(--bg)\'">✕</button>';
        sheet.appendChild(titleBar);

        // === 分隔线 ===
        var divider = document.createElement('div');
        divider.style.cssText = 'height:1px;background:var(--border);margin:0 20px;flex-shrink:0;opacity:0.5';
        sheet.appendChild(divider);

        // === 搜索框 ===
        var searchWrap = document.createElement('div');
        searchWrap.style.cssText = 'padding:12px 20px 8px;flex-shrink:0;position:relative';
        searchWrap.innerHTML = '<div style="position:relative;display:flex;align-items:center"><svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-secondary);pointer-events:none;opacity:0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input id="shareSearchInput" type="text" placeholder="搜索好友..." style="width:100%;padding:12px 40px 12px 40px;border:2px solid var(--border);border-radius:14px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;transition:border-color 0.2s" onfocus="this.style.borderColor=\'var(--primary)\'" onblur="this.style.borderColor=\'var(--border)\'" /><button id="shareSearchClear" style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:14px;display:none;align-items:center;justify-content:center" onmouseenter="this.style.background=\'var(--border)\'" onmouseleave="this.style.background=\'transparent\'">✕</button></div>';
        sheet.appendChild(searchWrap);

        // === 操作栏 ===
        var actionBar = document.createElement('div');
        actionBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 20px 8px;flex-shrink:0';
        actionBar.innerHTML = '<button id="shareSelectAllBtn" style="display:flex;align-items:center;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:12px;color:var(--text);cursor:pointer;font-weight:500;transition:all 0.15s" onmouseenter="this.style.borderColor=\'var(--primary)\';this.style.color=\'var(--primary)\'" onmouseleave="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text)\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 全选</button><span id="shareSelectedCount" style="font-size:12px;font-weight:600;color:var(--primary);background:var(--primary)10;padding:4px 12px;border-radius:20px;display:none">0</span>';
        sheet.appendChild(actionBar);

        // === 用户列表 ===
        var listContainer = document.createElement('div');
        listContainer.id = 'shareUserList';
        listContainer.style.cssText = 'overflow-y:auto;flex:1;min-height:0;padding:0 12px 8px;';
        listContainer.innerHTML = '<div style="padding:0 8px">' + renderUserList() + '</div>';
        sheet.appendChild(listContainer);

        // === 底部发送栏 ===
        var bottomBar = document.createElement('div');
        bottomBar.style.cssText = 'flex-shrink:0;padding:12px 20px 20px;display:flex;gap:10px;align-items:center;background:linear-gradient(180deg,transparent 0%,var(--card) 20%);border-top:1px solid var(--border)';
        bottomBar.innerHTML = '<button id="shareSendBtn" style="flex:1;padding:15px;background:linear-gradient(135deg,#E0E0E0,#D0D0D0);color:#999;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:default;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);letter-spacing:0.5px" disabled><span id="shareSendText">选择好友发送</span></button>';
        sheet.appendChild(bottomBar);

        // === 空状态 ===
        if (users.length === 0) {
          overlay.innerHTML = '';
          var emptySheet = document.createElement('div');
          emptySheet.style.cssText = 'background:var(--card);border-radius:20px 20px 0 0;width:100%;max-width:440px;padding:32px 20px 40px;animation:slideUp 0.35s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;align-items:center;text-align:center';
          emptySheet.innerHTML = '<div style="width:72px;height:72px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:16px">👥</div><div style="font-size:16px;font-weight:700;margin-bottom:6px;color:var(--text)">还没有好友</div><div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.5">关注别人或被关注后<br/>即可分享帖子给好友</div><button onclick="document.getElementById(\'shareOverlay\').remove()" style="padding:12px 36px;background:var(--primary);color:white;border:none;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer">知道了</button>';
          overlay.appendChild(emptySheet);
          return;
        }

        // 事件绑定
        document.getElementById('shareCloseBtn').onclick = function() { overlay.remove(); };

        var searchInput = document.getElementById('shareSearchInput');
        var searchClear = document.getElementById('shareSearchClear');
        searchInput.oninput = function() {
          var q = this.value.toLowerCase().trim();
          searchClear.style.display = q ? 'flex' : 'none';
          var filtered = q ? users.filter(function(u) {
            return u.nickname.toLowerCase().includes(q) || u.phone.includes(q);
          }) : null;
          document.getElementById('shareUserList').innerHTML = '<div style="padding:0 8px">' + renderUserList(filtered) + '</div>';
          // 重新绑定用户点击
          bindUserClicks();
        };
        searchClear.onclick = function() { searchInput.value = ''; searchInput.oninput(); searchInput.focus(); };

        function updateUI() {
          var selCount = selected.size;
          var badge = document.getElementById('shareSelectedCount');
          badge.textContent = '已选 ' + selCount + '/' + users.length;
          badge.style.display = selCount > 0 ? 'inline' : 'none';

          var allBtn = document.getElementById('shareSelectAllBtn');
          allBtn.innerHTML = selectAll
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> 取消'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 全选';

          // 更新列表中的 checkbox
          document.querySelectorAll('#shareUserList .share-user-item').forEach(function(item) {
            var phone = item.dataset.phone;
            var checked = selected.has(phone);
            item.style.background = checked ? 'var(--primary)08' : '';
            item.style.borderColor = checked ? 'var(--primary)20' : 'transparent';
            var circle = item.querySelector('div:first-child');
            if (circle) {
              var color = avatarColors[phone.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0) % avatarColors.length];
              circle.style.background = checked ? color : '';
              circle.style.borderColor = checked ? color : 'var(--border)';
              circle.style.transform = checked ? 'scale(1)' : 'scale(0.9)';
              circle.innerHTML = checked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
            }
          });

          // 更新发送按钮
          var btn = document.getElementById('shareSendBtn');
          var btnText = document.getElementById('shareSendText');
          if (selCount > 0) {
            btn.style.background = 'linear-gradient(135deg,#FF6B2B,#FF8F5E)';
            btn.style.color = '#fff';
            btn.style.cursor = 'pointer';
            btn.style.boxShadow = '0 4px 16px rgba(255,107,43,0.3)';
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

        async function bindUserClicks() {
          document.querySelectorAll('#shareUserList .share-user-item').forEach(function(item) {
            item.onclick = function() {
              var phone = this.dataset.phone;
              if (selected.has(phone)) { selected.delete(phone); }
              else { selected.add(phone); }
              selectAll = (selected.size === users.length);
              updateUI();
            };
          });
        }
        bindUserClicks();

        // 全选/取消
        document.getElementById('shareSelectAllBtn').onclick = function() {
          selectAll = !selectAll;
          if (selectAll) { users.forEach(function(u){ selected.add(u.phone); }); }
          else { selected.clear(); }
          updateUI();
        };

        // 发送
        document.getElementById('shareSendBtn').onclick = async function() {
          if (selected.size === 0) return;
          var btn = this;
          var btnText = document.getElementById('shareSendText');
          btn.disabled = true;
          btn.style.background = 'linear-gradient(135deg,#FF6B2B,#FF8F5E)';
          btn.style.opacity = '0.7';
          btn.style.cursor = 'default';

          // 先获取帖子详情
          var shareContent;
          try {
            var post = await API.wallPostDetail(postId);
            if (post && !post.error) shareContent = buildShareContent(post);
          } catch(e) {}
          if (!shareContent) shareContent = '[SHARE_POST]{"id":' + postId + ',"content":"","author":"","images":[],"time":""}';

          var targets = Array.from(selected);
          var success = 0;
          var fail = 0;
          for (var i = 0; i < targets.length; i++) {
            btnText.textContent = '发送中 ' + (i + 1) + '/' + targets.length + '...';
            try {
              var convRes = await API.chatGetOrCreateConversation({
                user_phone: currentUser.phone,
                rider_phone: targets[i]
              });
              if (convRes.id) {
                await API.chatSend({
                  conversation_id: convRes.id,
                  sender_phone: currentUser.phone,
                  content: shareContent,
                  type: 'share_post'
                });
                success++;
              } else { fail++; }
            } catch(e) { fail++; }
          }
          // 增加分享计数
          if (success > 0) { API.wallSharePost(postId).catch(() => {}); }
          overlay.remove();
          showToast(success > 0 ? '✅ 已分享给 ' + success + ' 人' + (fail > 0 ? '（' + fail + ' 人失败）' : '') : '❌ 发送失败');
        };
      }

      if (users.length === 0) {
        overlay.innerHTML = '<div style="background:var(--card);border-radius:16px 16px 0 0;width:100%;max-width:420px;padding:20px 16px 32px;animation:slideUp 0.3s"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div style="font-size:17px;font-weight:700">📤 分享帖子给好友</div><button onclick="document.getElementById(\'shareOverlay\').remove()" style="background:none;border:none;font-size:20px;color:var(--text-secondary);cursor:pointer">✕</button></div><div style="text-align:center;padding:40px 0;color:var(--text-secondary)"><div style="font-size:32px;margin-bottom:12px">😢</div><div>还没有好友</div><div style="font-size:12px;margin-top:4px">关注别人或被关注后即可分享</div></div></div>';
        return;
      }

      renderModal();
    }

    async function doDeletePost(postId) {
      const ov = document.getElementById('postMoreOverlay');
      if (ov) ov.remove();
      if (!confirm('确定要删除这条帖子吗？删除后不可恢复。')) return;
      try {
        const res = await fetch('/api/wall/posts/' + postId, { method: 'DELETE', headers: API._headers() });
        const data = await res.json();
        if (data.ok) { showToast('已删除'); loadWallFeed(); }
        else { showToast(data.error || '删除失败'); }
      } catch(e) { showToast('删除失败，请重试'); }
    }

    // ══════ 编辑帖子 ══════
    async function doEditWallPost(postId) {
      const ov = document.getElementById('postMoreOverlay');
      if (ov) ov.remove();
      document.querySelectorAll('.wall-inline-actions.open').forEach(el => el.classList.remove('open'));
      if (!currentUser) { showToast('请先登录'); return; }

      // 获取当前帖子内容
      var post;
      try { post = await API.wallPostDetail(postId); } catch(e) { showToast('加载失败'); return; }
      if (!post || post.error) { showToast('帖子不存在'); return; }

      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s';
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

      overlay.innerHTML = '<div style="background:var(--card);border-radius:20px;width:90%;max-width:420px;padding:24px;animation:slideUp 0.3s">' +
        '<div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px">✏️ 编辑帖子</div>' +
        '<textarea id="editPostTextarea" style="width:100%;min-height:120px;padding:12px;border:1px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);resize:vertical;outline:none;font-family:inherit;box-sizing:border-box" onfocus="this.style.borderColor=\'var(--primary)\'" onblur="this.style.borderColor=\'var(--border)\'" placeholder="编辑内容...">' + escHtml(post.content || '') + '</textarea>' +
        '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">' +
        '<button id="editCancelBtn" style="padding:10px 20px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;cursor:pointer;font-weight:500">取消</button>' +
        '<button id="editSaveBtn" style="padding:10px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;font-size:14px;cursor:pointer;font-weight:600">保存</button>' +
        '</div></div>';
      document.body.appendChild(overlay);

      var textarea = document.getElementById('editPostTextarea');
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      document.getElementById('editCancelBtn').onclick = function() { overlay.remove(); };
      document.getElementById('editSaveBtn').onclick = async function() {
        var content = textarea.value.trim();
        if (!content) { showToast('内容不能为空'); return; }
        var btn = document.getElementById('editSaveBtn');
        btn.disabled = true;
        btn.textContent = '保存中...';
        try {
          var res = await API.wallEditPost(postId, content);
          if (res.ok) {
            overlay.remove();
            showToast('✅ 已更新');
            loadWallFeed();
          } else {
            showToast(res.error || '保存失败');
          }
        } catch(e) { showToast('保存失败，请重试'); }
        btn.disabled = false;
        btn.textContent = '保存';
      };
    }

    // ══════ P0-1: 举报功能（支持 wall/market/pets/teachers） ══════
    var _reportSource = 'wall';
    function showReportMenu(targetType, targetId, source) {
      _reportSource = source || 'wall';
      const reasons = ['广告推广', '色情低俗', '诈骗信息', '人身攻击', '虚假信息', '侵权内容', '其他'];
      const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super');
      const overlay = document.createElement('div');
      overlay.id = 'reportOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s';
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
      const adminActions = (isAdmin && targetType === 'post') ? `
        <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">管理操作</div>
          <div style="display:flex;gap:8px">
            <button onclick="togglePinPost(${targetId})" style="flex:1;padding:10px;background:#E74C3C12;border:1px solid #E74C3C30;border-radius:12px;cursor:pointer;font-size:13px;color:#E74C3C;font-weight:600">📌 置顶/取消</button>
            <button onclick="toggleFeaturePost(${targetId})" style="flex:1;padding:10px;background:#F39C1212;border:1px solid #F39C1230;border-radius:12px;cursor:pointer;font-size:13px;color:#F39C12;font-weight:600">⭐ 精华/取消</button>
          </div>
        </div>` : '';
      overlay.innerHTML = `
        <div style="background:var(--card);border-radius:16px 16px 0 0;width:100%;max-width:420px;padding:20px 16px 32px;animation:slideUp 0.3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <div style="font-size:17px;font-weight:700">🚫 举报</div>
            <button onclick="document.getElementById('reportOverlay').remove()" style="background:none;border:none;font-size:20px;color:var(--text-secondary);cursor:pointer">✕</button>
          </div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">请选择举报原因</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${reasons.map(r => `
              <button onclick="doReport('${targetType}',${targetId},'${r}')" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;cursor:pointer;text-align:left;font-size:14px;color:var(--text);transition:all 0.15s" onmouseover="this.style.borderColor='#E74C3C';this.style.background='#E74C3C08'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg)'">
                <span style="font-size:16px">${{ '广告推广': '📢', '色情低俗': '🔞', '诈骗信息': '🎣', '人身攻击': '👊', '虚假信息': '❌', '侵权内容': '⚖️', '其他': '📝' }[r]}</span>
                ${r}
              </button>
            `).join('')}
          </div>
          ${adminActions}
        </div>
      `;
      document.body.appendChild(overlay);
    }

    async function togglePinPost(postId) {
      const overlay = document.getElementById('reportOverlay');
      if (overlay) overlay.remove();
      try {
        const res = await fetch('/api/wall/pin/' + postId, { method: 'POST', headers: API._headers() });
        const data = await res.json();
        showToast(data.is_pinned ? '已置顶' : '已取消置顶');
        loadWallFeed();
      } catch(e) { showToast('操作失败'); }
    }

    async function toggleFeaturePost(postId) {
      const overlay = document.getElementById('reportOverlay');
      if (overlay) overlay.remove();
      try {
        const res = await fetch('/api/wall/feature/' + postId, { method: 'POST', headers: API._headers() });
        const data = await res.json();
        showToast(data.is_featured ? '已标记精华' : '已取消精华');
        loadWallFeed();
      } catch(e) { showToast('操作失败'); }
    }

    async function doReport(targetType, targetId, reason) {
      const overlay = document.getElementById('reportOverlay');
      if (overlay) overlay.remove();
      try {
        var apiMap = {
          wall: API.wallReport, market: API.marketReport,
          pet: API.petReport, teacher: API.teacherReport
        };
        var fn = apiMap[_reportSource] || API.wallReport;
        const res = await fn(targetType, targetId, reason);
        if (res.ok) showToast('举报成功，我们会尽快处理');
        else showToast(res.error || '举报失败');
      } catch(e) { showToast('举报失败，请稍后重试'); }
    }

    // ══════ 分享评论（复制到剪贴板） ══════
    function shareComment(source, itemName, commentText, author) {
      var sourceLabel = { market: '二手市场', pet: '猫狗日记', teacher: '师说' }[source] || '校园圈';
      var text = '📤 [' + sourceLabel + '] ' + (author || '用户') + '：' + commentText + '\n——来自校园圈';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() {
            showToast('📤 已复制分享内容');
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
          showToast('📤 已复制分享内容');
        }
      } catch(e) { showToast('分享失败'); }
    }

    // ══════ 拉黑用户 ══════
    async function doBlockUser(targetPhone) {
      const ov = document.getElementById('postMoreOverlay');
      if (ov) ov.remove();
      if (!currentUser || currentUser.phone === targetPhone) {
        showToast('不能拉黑自己');
        return;
      }
      if (!confirm('确定要拉黑该用户吗？拉黑后你将看不到TA的帖子。')) return;
      try {
        const res = await fetch('/api/wall/block', {
          method: 'POST',
          headers: API._headers(),
          body: JSON.stringify({ target_phone: targetPhone })
        });
        const data = await res.json();
        if (data.ok) {
          showToast('已拉黑');
          // 刷新Feed，过滤掉被拉黑用户的帖子
          loadWallFeed();
        } else {
          showToast(data.error || '拉黑失败');
        }
      } catch(e) { showToast('拉黑失败，请稍后重试'); }
    }

    // ══════ P0-2: 无限滚动 ══════
    let _wallPage = 1;
    let _wallLoading = false;
    let _wallHasMore = true;

    function setupWallInfiniteScroll() {
      const feedEl = document.getElementById('wallFeed');
      if (!feedEl) return;
      // 使用 IntersectionObserver 监听最后一个卡片
      const lastCard = feedEl.querySelector('.wall-card:last-child');
      if (!lastCard) return;
      if (window._wallScrollObs) window._wallScrollObs.disconnect();
      window._wallScrollObs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !_wallLoading && _wallHasMore) {
          loadMoreWallPosts();
        }
      }, { rootMargin: '200px' });
      window._wallScrollObs.observe(lastCard);
    }

    async function loadMoreWallPosts() {
      if (_wallLoading || !_wallHasMore || !currentUser) return;
      _wallLoading = true;
      _wallPage++;
      try {
        const params = { tab: wallTab === 'mine' ? 'latest' : wallTab, phone: currentUser.phone, page: _wallPage };
        if (wallTagFilter) params.tag = wallTagFilter;
        const res = await API.wallFeed(params);
        const newPosts = Array.isArray(res.posts) ? res.posts : [];
        if (newPosts.length === 0) {
          _wallHasMore = false;
        } else {
          wallPosts = wallPosts.concat(newPosts);
          if (wallTab === 'mine') wallPosts = wallPosts.filter(p => p.phone === currentUser.phone);
          renderWallFeed();
        }
      } catch(e) { console.error('加载更多失败:', e); _wallPage--; }
      _wallLoading = false;
    }

    // ══════ P0-4: 话题频道系统 ══════
    const ALL_TAG_KEYS = Object.keys(TAG_CONFIG);

    // 获取用户自定义的标签配置（从 localStorage）
    function getUserTagConfig() {
      try {
        const saved = localStorage.getItem('wallTagConfig');
        if (saved) return JSON.parse(saved);
      } catch(e) {}
      return null;
    }

    function saveUserTagConfig(config) {
      try { localStorage.setItem('wallTagConfig', JSON.stringify(config)); } catch(e) {}
    }

    // 获取活跃标签列表（用于频道栏渲染）
    function getActiveTags() {
      const config = getUserTagConfig();
      if (!config) return [...ALL_TAG_KEYS];
      // active 中是用户启用的标签（有序），补充新增标签
      const disabled = config.disabled || [];
      const newTags = ALL_TAG_KEYS.filter(k => !config.active.includes(k) && !disabled.includes(k));
      return [...config.active, ...newTags];
    }

    // 获取最终渲染顺序的频道列表
    function getOrderedChannels() {
      const orderedKeys = getActiveTags();
      return [
        { key: 'all', name: '全部', emoji: '🔥' },
        ...orderedKeys.map(k => ({ key: k, name: k, emoji: TAG_CONFIG[k].emoji }))
      ];
    }

    let _expandedCategory = null; // 当前展开的大分类

    function renderWallChannels() {
      const el = document.getElementById('wallChannels');
      if (!el) return;
      const config = getUserTagConfig();
      const activeCategories = config ? config.active : TAG_CATEGORIES.map(c => c.key);
      const disabledSet = new Set(config ? (config.disabled || []) : []);

      let html = `<button onclick="filterByTag('')" style="display:inline-flex;align-items:center;gap:3px;padding:6px 12px;border-radius:20px;border:none;font-size:12px;font-weight:${!wallTagFilter?'700':'500'};cursor:pointer;transition:all 0.2s;flex-shrink:0;white-space:nowrap;background:${!wallTagFilter?'var(--gradient)':'var(--card)'};color:${!wallTagFilter?'#fff':'var(--text)'};box-shadow:${!wallTagFilter?'0 2px 8px #FF6B2B30':'0 1px 3px rgba(0,0,0,0.06)'}">全部</button>`;

      activeCategories.forEach(catKey => {
        if (disabledSet.has(catKey)) return;
        const cat = TAG_CATEGORIES.find(c => c.key === catKey);
        if (!cat) return;
        const isExpanded = _expandedCategory === catKey;
        const isCatActive = wallTagFilter === catKey;
        const isSubActive = cat.children.some(sub => wallTagFilter === sub);

        // 大分类按钮
        html += `<button id="catBtn_${catKey}" onclick="toggleCategoryExpand('${catKey}')" style="display:inline-flex;align-items:center;gap:3px;padding:6px 12px;border-radius:20px;border:none;font-size:12px;font-weight:${isCatActive||isSubActive?'700':'500'};cursor:pointer;transition:all 0.2s;flex-shrink:0;white-space:nowrap;background:${isCatActive?'var(--gradient)':isSubActive?cat.color+'18':'var(--card)'};color:${isCatActive?'#fff':isSubActive?cat.color:'var(--text)'};box-shadow:${isCatActive?'0 2px 8px #FF6B2B30':'0 1px 3px rgba(0,0,0,0.06)'}">${cat.key} <span style="font-size:9px;transition:transform 0.2s;transform:rotate(${isExpanded?'180':'0'}deg);display:inline-block">▼</span></button>`;
      });

      el.innerHTML = html;
      setTimeout(updateChannelArrows, 50);
      el.onscroll = updateChannelArrows;
    }

    function toggleCategoryExpand(catKey) {
      if (_expandedCategory === catKey) {
        _expandedCategory = null;
        hideSubTagDropdown();
        // 取消筛选
        wallTagFilter = '';
        _wallPage = 1; _wallHasMore = true; wallPosts = [];
        loadWallFeed();
        renderWallChannels();
        return;
      }
      _expandedCategory = catKey;
      wallTagFilter = catKey;
      _wallPage = 1; _wallHasMore = true; wallPosts = [];
      loadWallFeed();
      renderWallChannels();
      // 延迟显示下拉面板（等按钮渲染完）
      requestAnimationFrame(() => showSubTagDropdown(catKey));
    }

    function showSubTagDropdown(catKey) {
      const btn = document.getElementById('catBtn_' + catKey);
      if (!btn) return;
      const cat = TAG_CATEGORIES.find(c => c.key === catKey);
      if (!cat) return;
      const config = getUserTagConfig();
      const disabledSet = new Set(config ? (config.disabled || []) : []);

      // 移除旧面板
      hideSubTagDropdown();

      const rect = btn.getBoundingClientRect();
      const panel = document.createElement('div');
      panel.id = 'subTagDropdownPanel';
      panel.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:10px;display:flex;flex-wrap:wrap;gap:6px;min-width:160px;max-width:300px;animation:subTagFadeIn 0.15s ease`;

      cat.children.filter(sub => !disabledSet.has(sub)).forEach(sub => {
        const isSubSel = wallTagFilter === sub;
        const btnEl = document.createElement('button');
        btnEl.textContent = sub;
        btnEl.style.cssText = `display:inline-flex;align-items:center;gap:2px;padding:5px 12px;border-radius:14px;border:1px solid ${isSubSel?cat.color:'var(--border)'};font-size:12px;font-weight:${isSubSel?'600':'400'};cursor:pointer;transition:all 0.2s;white-space:nowrap;background:${isSubSel?cat.color+'18':'var(--card)'};color:${isSubSel?cat.color:'var(--text-secondary)'}`;
        btnEl.onclick = function(e) {
          e.stopPropagation();
          wallTagFilter = sub;
          _expandedCategory = null;
          hideSubTagDropdown();
          _wallPage = 1; _wallHasMore = true; wallPosts = [];
          loadWallFeed();
          renderWallChannels();
        };
        panel.appendChild(btnEl);
      });

      document.body.appendChild(panel);

      // 如果面板超出右侧屏幕，调整位置
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.right > window.innerWidth - 8) {
        panel.style.left = (window.innerWidth - panelRect.width - 8) + 'px';
      }
    }

    function hideSubTagDropdown() {
      const old = document.getElementById('subTagDropdownPanel');
      if (old) old.remove();
    }

    // 点击其他区域关闭下拉
    document.addEventListener('click', function(e) {
      if (_expandedCategory && !e.target.closest('#subTagDropdownPanel') && !e.target.closest('#wallChannels')) {
        _expandedCategory = null;
        hideSubTagDropdown();
        renderWallChannels();
      }
    });

    function updateChannelArrows() {
      const el = document.getElementById('wallChannels');
      const leftBtn = document.getElementById('wallChannelLeft');
      const rightBtn = document.getElementById('wallChannelRight');
      if (!el || !leftBtn || !rightBtn) return;
      const hasOverflow = el.scrollWidth > el.clientWidth + 2;
      const canScrollLeft = el.scrollLeft > 2;
      const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
      leftBtn.style.opacity = (hasOverflow && canScrollLeft) ? '1' : '0';
      leftBtn.style.pointerEvents = (hasOverflow && canScrollLeft) ? 'auto' : 'none';
      rightBtn.style.opacity = (hasOverflow && canScrollRight) ? '1' : '0';
      rightBtn.style.pointerEvents = (hasOverflow && canScrollRight) ? 'auto' : 'none';
    }

    function scrollWallChannels(dir) {
      const el = document.getElementById('wallChannels');
      if (!el) return;
      el.scrollBy({ left: dir * 200, behavior: 'smooth' });
    }

    // ══════ 标签管理器（层级版） ══════
    function openTagManager() {
      // 重新构建标签（可能有自定义变更）
      TAG_CATEGORIES = buildTagCategories();
      // 重建反向映射
      Object.keys(_subToCategory).forEach(k => delete _subToCategory[k]);
      TAG_CATEGORIES.forEach(cat => cat.children.forEach(sub => { _subToCategory[sub] = cat.key; }));

      let el = document.getElementById('tagManagerPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'tagManagerPage_sub';
        el.className = 'sub-page';
        document.querySelector('.app').appendChild(el);
      }
      const config = getUserTagConfig();
      const activeCats = config ? config.active : TAG_CATEGORIES.map(c => c.key);
      const disabledSet = new Set(config ? (config.disabled || []) : []);
      const customSubs = getCustomSubTags();
      const baseSubs = {};
      _BASE_CATEGORIES.forEach(c => baseSubs[c.key] = new Set(c.children));

      // 按大分类渲染
      let bodyHtml = '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">点击切换启用/禁用，可添加或删除自定义子标签</div>';

      TAG_CATEGORIES.forEach(cat => {
        const isCatActive = activeCats.includes(cat.key) && !disabledSet.has(cat.key);
        const activeSubs = cat.children.filter(sub => !disabledSet.has(sub));

        bodyHtml += `<div style="margin-bottom:16px;padding:12px;background:var(--card);border-radius:12px;border:1px solid var(--border)">`;
        // 大分类头
        bodyHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span onclick="toggleCategoryInManager('${cat.key}')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 14px;border-radius:20px;cursor:pointer;font-size:13px;font-weight:600;border:1.5px solid ${isCatActive?cat.color:'var(--border)'};background:${isCatActive?cat.color+'18':'var(--bg)'};color:${isCatActive?cat.color:'var(--text-light)'};transition:all 0.2s">${cat.key}</span>
          <span style="font-size:11px;color:var(--text-light)">${activeSubs.length}/${cat.children.length}</span>
        </div>`;
        // 子标签
        bodyHtml += `<div style="display:flex;flex-wrap:wrap;gap:5px;padding-left:4px;align-items:center">`;
        cat.children.forEach(sub => {
          const isSubActive = !disabledSet.has(sub);
          const isCustom = !baseSubs[cat.key]?.has(sub);
          bodyHtml += `<span style="display:inline-flex;align-items:center;gap:2px;padding:3px 10px;border-radius:14px;font-size:11px;cursor:pointer;transition:all 0.2s;border:1px solid ${isSubActive?cat.color+'60':'var(--border)'};background:${isSubActive?cat.color+'10':'var(--bg)'};color:${isSubActive?cat.color:'var(--text-light)'};opacity:${isSubActive?'1':'0.5'}" onclick="toggleSubTagInManager('${sub}')">${sub}<span onclick="event.stopPropagation();deleteSubTag('${cat.key}','${sub}',${isCustom})" style="margin-left:3px;font-size:10px;color:${isCustom?'#E74C3C':'var(--text-light)'};font-weight:700;cursor:pointer;opacity:0.6" title="${isCustom?'删除自定义标签':'禁用标签'}" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">✕</span></span>`;
        });
        // 添加子标签按钮
        bodyHtml += `<button onclick="promptAddSubTag('${cat.key}')" style="display:inline-flex;align-items:center;gap:2px;padding:3px 10px;border-radius:14px;font-size:11px;cursor:pointer;transition:all 0.2s;border:1px dashed var(--border);background:var(--bg);color:var(--text-light)">+ 添加</button>`;
        bodyHtml += `</div></div>`;
      });

      el.innerHTML = `
        <div class="sub-page-header">
          <button class="sub-page-back" onclick="closeSubPage('tagManagerPage_sub')">←</button>
          <span class="sub-page-title">管理标签</span>
          <button onclick="resetTagOrder()" style="margin-left:auto;padding:4px 10px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--text-secondary);font-size:11px;cursor:pointer">恢复默认</button>
        </div>
        <div class="sub-page-body" style="padding:16px">${bodyHtml}</div>
      `;
      openSubPage('tagManagerPage_sub');
    }

    // 添加自定义子标签
    function promptAddSubTag(catKey) {
      const cat = TAG_CATEGORIES.find(c => c.key === catKey);
      if (!cat) return;
      // 弹窗形式
      const overlay = document.createElement('div');
      overlay.id = 'addSubTagModal';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.15s ease';
      const dialog = document.createElement('div');
      dialog.style.cssText = `width:300px;background:var(--card);border-radius:16px;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:subTagFadeIn 0.2s ease`;
      dialog.innerHTML = `
        <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:12px">添加子标签到「${cat.key}」</div>
        <input id="addSubTagInput" type="text" maxlength="6" placeholder="输入标签名（1-6个字）" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;outline:none;transition:border 0.2s;box-sizing:border-box" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'" />
        <div id="addSubTagError" style="font-size:11px;color:#E74C3C;margin-top:6px;display:none"></div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
          <button id="addSubTagCancel" style="padding:8px 18px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:all 0.2s">取消</button>
          <button id="addSubTagConfirm" style="padding:8px 18px;border-radius:10px;border:none;background:var(--gradient);color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s">添加</button>
        </div>
      `;
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = document.getElementById('addSubTagInput');
      const errEl = document.getElementById('addSubTagError');
      input.focus();

      function close() { document.getElementById('addSubTagModal')?.remove(); }

      function confirm() {
        const val = input.value.trim();
        if (!val || val.length < 1 || val.length > 6) {
          errEl.textContent = '标签名需1-6个字';
          errEl.style.display = 'block';
          return;
        }
        if (cat.children.includes(val)) {
          errEl.textContent = '该标签已存在';
          errEl.style.display = 'block';
          return;
        }
        close();
        // 执行添加
        const custom = getCustomSubTags();
        if (!custom[catKey]) custom[catKey] = [];
        custom[catKey].push(val);
        saveCustomSubTags(custom);
        TAG_CATEGORIES = buildTagCategories();
        Object.keys(_subToCategory).forEach(k => delete _subToCategory[k]);
        TAG_CATEGORIES.forEach(c => c.children.forEach(sub => { _subToCategory[sub] = c.key; }));
        const config = getUserTagConfig() || { active: TAG_CATEGORIES.map(c => c.key), disabled: [] };
        config.disabled = config.disabled.filter(k => k !== val);
        saveUserTagConfig(config);
        syncCategoryMap();
        openTagManager();
        renderWallChannels();
      }

      document.getElementById('addSubTagCancel').onclick = close;
      document.getElementById('addSubTagConfirm').onclick = confirm;
      input.onkeydown = function(e) { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') close(); };
      overlay.onclick = function(e) { if (e.target === overlay) close(); };
    }

    // 删除子标签（自定义标签彻底删除，默认标签禁用）
    function deleteSubTag(catKey, sub, isCustom) {
      if (isCustom) {
        // 自定义标签：彻底删除
        const custom = getCustomSubTags();
        if (!custom[catKey]) return;
        custom[catKey] = custom[catKey].filter(s => s !== sub);
        if (custom[catKey].length === 0) delete custom[catKey];
        saveCustomSubTags(custom);
      }
      // 无论是自定义还是默认标签，都从启用列表移除
      const config = getUserTagConfig() || { active: TAG_CATEGORIES.map(c => c.key), disabled: [] };
      if (!config.disabled.includes(sub)) config.disabled.push(sub);
      saveUserTagConfig(config);
      // 重建
      TAG_CATEGORIES = buildTagCategories();
      Object.keys(_subToCategory).forEach(k => delete _subToCategory[k]);
      TAG_CATEGORIES.forEach(c => c.children.forEach(s => { _subToCategory[s] = c.key; }));
      syncCategoryMap();
      openTagManager();
      renderWallChannels();
    }

    // 删除自定义子标签（旧接口，保留兼容）
    function removeCustomSubTag(catKey, sub) {
      const custom = getCustomSubTags();
      if (!custom[catKey]) return;
      custom[catKey] = custom[catKey].filter(s => s !== sub);
      if (custom[catKey].length === 0) delete custom[catKey];
      saveCustomSubTags(custom);
      // 从 disabled 中也移除
      const config = getUserTagConfig() || { active: TAG_CATEGORIES.map(c => c.key), disabled: [] };
      config.disabled = config.disabled.filter(k => k !== sub);
      saveUserTagConfig(config);
      // 重建
      TAG_CATEGORIES = buildTagCategories();
      Object.keys(_subToCategory).forEach(k => delete _subToCategory[k]);
      TAG_CATEGORIES.forEach(c => c.children.forEach(s => { _subToCategory[s] = c.key; }));
      syncCategoryMap();
      openTagManager();
      renderWallChannels();
    }

    // 同步后端 CATEGORY_MAP
    function syncCategoryMap() {
      // 将自定义标签同步到后端
      const map = {};
      TAG_CATEGORIES.forEach(cat => { map[cat.key] = cat.children; });
      try { fetch('/api/wall/category-map', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(map) }); } catch(e) {}
    }

    // 切换大分类启用/禁用（影响其所有子标签）
    function toggleCategoryInManager(catKey) {
      const config = getUserTagConfig() || { active: TAG_CATEGORIES.map(c => c.key), disabled: [] };
      const cat = TAG_CATEGORIES.find(c => c.key === catKey);
      if (!cat) return;
      const isCatActive = config.active.includes(catKey) && !config.disabled.includes(catKey);
      if (isCatActive) {
        // 禁用整个分类
        config.active = config.active.filter(k => k !== catKey);
        if (!config.disabled.includes(catKey)) config.disabled.push(catKey);
        cat.children.forEach(sub => { if (!config.disabled.includes(sub)) config.disabled.push(sub); });
      } else {
        // 启用整个分类
        config.disabled = config.disabled.filter(k => k !== catKey && !cat.children.includes(k));
        if (!config.active.includes(catKey)) config.active.push(catKey);
      }
      saveUserTagConfig(config);
      openTagManager();
      renderWallChannels();
    }

    // 切换子标签启用/禁用
    function toggleSubTagInManager(sub) {
      const config = getUserTagConfig() || { active: TAG_CATEGORIES.map(c => c.key), disabled: [] };
      const catKey = _subToCategory[sub];
      const cat = TAG_CATEGORIES.find(c => c.key === catKey);
      if (!cat) return;
      if (config.disabled.includes(sub)) {
        // 启用子标签
        config.disabled = config.disabled.filter(k => k !== sub);
        // 确保大分类也启用
        if (!config.active.includes(catKey)) config.active.push(catKey);
        if (config.disabled.includes(catKey)) config.disabled = config.disabled.filter(k => k !== catKey);
      } else {
        // 禁用子标签
        config.disabled.push(sub);
        // 如果所有子标签都禁用了，大分类也禁用
        const allSubsDisabled = cat.children.every(c => config.disabled.includes(c));
        if (allSubsDisabled) {
          config.active = config.active.filter(k => k !== catKey);
          if (!config.disabled.includes(catKey)) config.disabled.push(catKey);
        }
      }
      saveUserTagConfig(config);
      openTagManager();
      renderWallChannels();
    }

    function renderTagPill(tag, active, index) {
      const cfg = TAG_CONFIG[tag];
      return `<span class="tag-pill" draggable="true" data-tag="${tag}" data-active="${active}"
        onclick="toggleTagPill('${tag}')"
        ondragstart="onTagPillDragStart(event)"
        ondragend="onTagPillDragEnd(event)"
        style="display:inline-flex;align-items:center;gap:3px;padding:5px 12px;border-radius:16px;font-size:12px;cursor:pointer;transition:all 0.2s;user-select:none;
        border:1.5px solid ${active ? cfg.color : 'var(--border)'};
        background:${active ? cfg.color + '18' : 'var(--bg)'};
        color:${active ? cfg.color : 'var(--text-light)'};
        font-weight:${active ? '600' : '400'};
        opacity:${active ? '1' : '0.7'}">${tag}</span>`;
    }

    // 点击切换标签使用状态
    function toggleTagPill(tag) {
      const config = getUserTagConfig() || { active: [...ALL_TAG_KEYS], disabled: [] };
      const activeIdx = config.active.indexOf(tag);
      const disabledIdx = config.disabled.indexOf(tag);

      if (activeIdx >= 0) {
        // 从使用中移除到未使用
        config.active.splice(activeIdx, 1);
        if (disabledIdx < 0) config.disabled.push(tag);
      } else if (disabledIdx >= 0) {
        // 从未使用移到使用中
        config.disabled.splice(disabledIdx, 1);
        config.active.push(tag);
      }
      saveUserTagConfig(config);
      openTagManager();
      renderWallChannels();
    }

    // 小按钮拖拽
    let _dragPillTag = null;
    let _dragPillFrom = null;
    function onTagPillDragStart(e) {
      _dragPillTag = e.currentTarget.dataset.tag;
      _dragPillFrom = e.currentTarget.dataset.active === 'true' ? 'active' : 'inactive';
      e.currentTarget.style.opacity = '0.3';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _dragPillTag);
    }
    function onTagPillDragEnd(e) {
      e.currentTarget.style.opacity = '';
      document.querySelectorAll('#tagActiveZone,#tagInactiveZone').forEach(z => {
        z.style.borderColor = 'var(--border)';
        z.style.background = 'var(--card)';
      });
    }
    function onTagPillDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const zone = e.currentTarget;
      zone.style.borderColor = 'var(--primary)';
      zone.style.background = 'var(--primary)08';
    }
    function onTagPillDrop(e, targetZone) {
      e.preventDefault();
      const tag = _dragPillTag;
      if (!tag) return;
      const config = getUserTagConfig() || { active: [...ALL_TAG_KEYS], disabled: [] };

      if (targetZone === 'active') {
        // 拖到使用区
        // 先从 disabled 移除
        const di = config.disabled.indexOf(tag);
        if (di >= 0) config.disabled.splice(di, 1);
        // 如果不在 active 中，插入
        if (!config.active.includes(tag)) {
          const activeZone = document.getElementById('tagActiveZone');
          const pills = activeZone.querySelectorAll('.tag-pill');
          let insertIdx = config.active.length;
          for (const pill of pills) {
            const rect = pill.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            if (e.clientX < midX) {
              const ti = config.active.indexOf(pill.dataset.tag);
              if (ti >= 0) { insertIdx = ti; break; }
            }
          }
          config.active.splice(insertIdx, 0, tag);
        } else {
          // 已在使用中，调整顺序
          const fromIdx = config.active.indexOf(tag);
          config.active.splice(fromIdx, 1);
          const activeZone = document.getElementById('tagActiveZone');
          const pills = activeZone.querySelectorAll('.tag-pill');
          let insertIdx = config.active.length;
          for (const pill of pills) {
            const rect = pill.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            if (e.clientX < midX) {
              const ti = config.active.indexOf(pill.dataset.tag);
              if (ti >= 0) { insertIdx = ti; break; }
            }
          }
          config.active.splice(insertIdx, 0, tag);
        }
      } else {
        // 拖到未使用区：从 active 移到 disabled
        const ai = config.active.indexOf(tag);
        if (ai >= 0) config.active.splice(ai, 1);
        if (!config.disabled.includes(tag)) config.disabled.push(tag);
      }

      saveUserTagConfig(config);
      openTagManager();
      renderWallChannels();
    }

    function resetTagOrder() {
      localStorage.removeItem('wallTagConfig');
      openTagManager();
      renderWallChannels();
    }

    // 重写 filterByTag 以支持频道和重置分页
    const _origFilterByTag = window.filterByTag;
    window.filterByTag = function(tag) {
      wallTagFilter = tag;
      _wallPage = 1;
      _wallHasMore = true;
      wallPosts = [];
      loadWallFeed();
      renderWallChannels();
    };

    // ══════ P0-5: 评论楼中楼优化 ══════
    // 在 showWallDetail 中已支持嵌套，这里优化评论区的视觉样式

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
window.initMessagePage = initMessagePage;
window.loadChatList = loadChatList;
window.openChatConv = openChatConv;
window.toggleChatSettings = openChatSettings;
window.openChatSettings = openChatSettings;
window.closeChatSettings = closeChatSettings;
window.backToChatList = backToChatList;
window.openNotifConv = openNotifConv;
window.backFromNotifConv = backFromNotifConv;
window.loadNotifMessages = loadNotifMessages;
window.markNotifRead = markNotifRead;
window.loadChatMessages = loadChatMessages;
window.sendChatMsg = sendChatMsg;
window.userChatUpload = userChatUpload;
window.toggleWallCommentEmoji = toggleWallCommentEmoji;
window.insertWallCommentEmoji = insertWallCommentEmoji;
window.uploadWallCommentMedia = uploadWallCommentMedia;
window.clearWallCommentMedia = clearWallCommentMedia;
window.openChatFromOrder = openChatFromOrder;
window.showChatPrivacyOptions = showChatPrivacyOptions;
window.setChatPrivacy = setChatPrivacy;
window.showReportMenu = showReportMenu;
window.shareComment = shareComment;
window.showPostMoreMenu = showPostMoreMenu;
window.doSharePost = doSharePost;
window.doDeletePost = doDeletePost;
window.doEditWallPost = doEditWallPost;
window.doBlockUser = doBlockUser;
window.doReport = doReport;
window.loadMoreWallPosts = loadMoreWallPosts;
window.sendShareMessageToConv = sendShareMessageToConv;
window.renderWallChannels = renderWallChannels;
window.togglePostTag = togglePostTag;
window.renderPostTagGrid = renderPostTagGrid;
window.openTagManager = openTagManager;
window.toggleTagPill = toggleTagPill;
window.toggleCategoryInManager = toggleCategoryInManager;
window.toggleSubTagInManager = toggleSubTagInManager;
window.toggleCategoryExpand = toggleCategoryExpand;
window.promptAddSubTag = promptAddSubTag;
window.removeCustomSubTag = removeCustomSubTag;
window.deleteSubTag = deleteSubTag;
window.togglePostTagSection = togglePostTagSection;
window.onTagPillDragStart = onTagPillDragStart;
window.onTagPillDragEnd = onTagPillDragEnd;
window.onTagPillDragOver = onTagPillDragOver;
window.onTagPillDrop = onTagPillDrop;
window.resetTagOrder = resetTagOrder;
window.scrollWallChannels = scrollWallChannels;
