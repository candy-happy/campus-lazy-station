// market.js - 二手市场
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码


    // ═══════════════════════════════════════════════════════
    // 🛒 二手交易市场函数
    // ═══════════════════════════════════════════════════════
    const CATEGORY_MAP = { textbook:'📚 教材', digital:'💻 数码', daily:'🏠 日用', clothing:'👔 服饰', beauty:'💄 美妆', other:'📦 其他' };
    const STATUS_MAP = { pending:'待确认', confirmed:'已确认', paid:'已付款', completed:'已完成', cancelled:'已取消' };


    async function loadMarketItems(reset) {
      if (!currentUser) return;
      if (reset) { marketPage = 1; marketItems = []; }
      try {
        const params = { page: marketPage, limit: 10 };
        if (marketCategory !== 'all') params.category = marketCategory;
        const res = await API.getMarketItems(params);
        if (res.items) {
          marketItems = reset ? res.items : marketItems.concat(res.items);
          marketHasMore = marketItems.length < res.total;
          renderMarketGrid();
        }
      } catch(e) { console.error('loadMarketItems error:', e); }
    }



    function loadMoreMarketItems() {
      marketPage++;
      loadMarketItems(false);
    }



    function switchMarketCategory(cat) {
      marketCategory = cat;
      // Reset to grid view
      document.getElementById('marketGrid').style.display = '';
      document.getElementById('marketMyListings').style.display = 'none';
      document.querySelectorAll('#marketTabs .market-tab').forEach(t => t.classList.toggle('active', t.textContent.includes(CATEGORY_MAP[cat] || '全部')));
      loadMarketItems(true);
    }



    function renderMarketGrid() {
      const grid = document.getElementById('marketGrid');
      const empty = document.getElementById('marketEmpty');
      const more = document.getElementById('marketMore');
      if (!grid) return;
      // Hide inline listings
      const listings = document.getElementById('marketMyListings');
      if (listings) listings.style.display = 'none';
      grid.style.display = '';
      if (!marketItems.length) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (more) more.style.display = 'none';
        return;
      }
      if (empty) empty.style.display = 'none';
      if (more) more.style.display = marketHasMore ? 'block' : 'none';
      const condLabel = { new:'全新', like_new:'几乎全新', good:'良好', fair:'一般' };
      const statusLabel = { active:'在售', trading:'交易中', sold:'已售', offline:'已下架' };
      grid.innerHTML = marketItems.map(item => {
        const img = (item.images && item.images[0]) || '';
        const trust = item.trust || {};
        const avatarHtml = renderAvatarHtml(item.seller_avatar, item.seller_name);
        const statusCls = item.status === 'active' ? 'active' : item.status === 'sold' ? 'sold' : 'offline';
        return '<div class="market-card" onclick="openItemDetail(' + item.id + ')">' +
          (img ? '<img class="market-card-img" src="' + img + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><div class="market-card-noimg" style="display:none">🛒</div>' : '<div class="market-card-noimg">🛒</div>') +
          (statusLabel[item.status] ? '<span class="market-card-status ' + statusCls + '">' + statusLabel[item.status] + '</span>' : '') +
          '<div class="market-card-info">' +
            '<div class="market-card-title">' + escHtml(item.title) + '</div>' +
            '<div class="market-card-price">¥' + (item.price || 0).toFixed(2) + (item.original_price ? '<small>¥' + item.original_price.toFixed(2) + '</small>' : '') + '</div>' +
            '<div class="market-card-meta">' +
              '<div class="market-card-seller">' + avatarHtml + ' ' + escHtml(item.seller_name || '') + ' <span class="trust-badge">' + (trust.icon || '') + '</span>' +
              (item.seller_avg_rating > 0 ? ' <span class="market-card-rating" style="font-size:12px">⭐' + parseFloat(item.seller_avg_rating).toFixed(1) + '</span>' : '') +
              '</div>' +
              (item.condition_level ? '<div class="market-card-condition">' + escHtml(condLabel[item.condition_level] || item.condition_level) + '</div>' : '') +
            '</div>' +
          '</div></div>';
      }).join('');
    }



    async function openItemDetail(id) {
      try {
        const item = await API.getMarketItem(id);
        if (item.error) { showToast(item.error); return; }
        renderItemDetail(item);
        openSubPage('itemDetailPage_sub');
      } catch(e) { console.error('openItemDetail error:', e); showToast('加载商品失败，请重试'); }
    }



    function renderItemDetail(item) {
      const body = document.getElementById('itemDetailBody');
      if (!body) return;
      const trust = item.trust || {};
      const imgs = item.images || [];
      const isOwner = currentUser && item.seller_phone === currentUser.phone;
      const sellerAvatar = renderAvatarHtml(item.seller_avatar, item.seller_name);
      const relatedHtml = (item.relatedItems || []).map(r => {
        const rImg = (r.images && r.images[0]) || '';
        return '<div style="min-width:120px;background:var(--card);border-radius:10px;overflow:hidden;box-shadow:var(--shadow);cursor:pointer" onclick="openItemDetail(' + r.id + ')">' +
          (rImg ? '<img src="' + rImg + '" loading="lazy" style="width:120px;height:90px;object-fit:cover" />' : '<div style="width:120px;height:90px;background:#FFF0EB;display:flex;align-items:center;justify-content:center;font-size:24px">🛒</div>') +
          '<div style="padding:8px;font-size:12px;font-weight:600">' + escHtml(r.title) + '</div>' +
          '<div style="padding:0 8px 8px;font-size:14px;font-weight:900;color:var(--danger)">¥' + (r.price || 0).toFixed(2) + '</div>' +
          '</div>';
      }).join('');

      body.innerHTML =
        (imgs.length ? '<div class="item-detail-imgs"><img src="' + imgs[0] + '" loading="lazy" /><div class="img-counter">1/' + imgs.length + '</div></div>' : '<div class="item-detail-imgs" style="display:flex;align-items:center;justify-content:center;font-size:64px;background:#FFF0EB">🛒</div>') +
        '<div class="item-detail-body">' +
          '<div class="item-detail-price">¥' + (item.price || 0).toFixed(2) + (item.original_price ? '<small>¥' + item.original_price.toFixed(2) + '</small>' : '') + '</div>' +
          '<div class="item-detail-title">' + escHtml(item.title) + '</div>' +
          '<div class="item-detail-tags">' +
            (item.status ? '<div class="item-detail-tag" style="background:' + (item.status==='active'?'#E8F5E9;color:#2ECC71':item.status==='sold'?'#E3F2FD;color:#3498DB':'#F5F5F5;color:#999') + '">' + ({active:'在售',sold:'已售',offline:'已下架',trading:'交易中'}[item.status]||item.status) + '</div>' : '') +
            (item.condition_level ? '<div class="item-detail-tag">' + escHtml({new:'全新',like_new:'几乎全新',good:'良好',fair:'一般'}[item.condition_level]||item.condition_level) + '</div>' : '') +
            (item.category ? '<div class="item-detail-tag">' + (CATEGORY_MAP[item.category] || item.category) + '</div>' : '') +
            '<div class="item-detail-tag">👁 ' + (item.views || 0) + '</div>' +
          '</div>' +
          (item.description ? '<div class="item-detail-desc">' + escHtml(item.description) + '</div>' : '') +
          (item.contact ? '<div style="margin-top:12px;font-size:13px;color:var(--primary)">📞 联系方式：' + escHtml(item.contact) + '</div>' : '') +
          '<div class="item-seller-card" onclick="viewSeller(\'' + escHtml(item.seller_phone) + '\', \'' + escHtml(item.seller_name || '卖家') + '\', \'' + (item.seller_avatar || '') + '\')">' +
            '<div class="item-seller-avatar">' + sellerAvatar + '</div>' +
            '<div class="item-seller-info">' +
              '<div class="item-seller-name">' + escHtml(item.seller_name || '卖家') + '</div>' +
              '<div class="item-seller-trust">' + trust.icon + ' ' + trust.label + ' · ' + (trust.totalDeals || 0) + '笔交易' +
              (item.seller_rating_count > 0 ? ' · <span class="star-rating" style="font-size:13px">' + renderStarRating(item.seller_avg_rating || 0, false) + '</span> ' + (item.seller_avg_rating || 0).toFixed(1) : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="item-comments-section">' +
            '<div class="item-comments-header"><span class="item-comments-title">💬 留言</span><span class="item-comments-count" id="commentCount">加载中...</span></div>' +
            '<div id="commentList"></div>' +
            '<div class="comment-input-wrap" id="commentInputWrap">' +
              '<div id="replyHint" class="comment-reply-hint" style="display:none;width:100%;margin-bottom:6px">回复 <span id="replyName"></span> <span class="cancel-reply" onclick="cancelReplyComment()">✕ 取消</span></div>' +
              '<div style="display:flex;gap:6px;align-items:center;width:100%">' +
                '<span class="comment-emoji-btn" onclick="toggleCommentEmoji()">😊</span>' +
                '<label class="comment-media-btn" title="上传图片/视频">📷<input type="file" style="display:none" onchange="commentUploadMedia(this)" /></label>' +
                '<input class="comment-input" id="commentInput" placeholder="说点什么..." maxlength="500" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendComment(' + item.id + ')}" />' +
                '<button class="comment-send-btn" id="commentSendBtn" onclick="sendComment(' + item.id + ')">发送</button>' +
              '</div>' +
              '<div id="commentMediaPreview" style="display:none;margin-top:8px;position:relative"></div>' +
              '<div id="commentEmojiPanel" style="display:none;margin-top:8px"></div>' +
            '</div>' +
          '</div>' +
          (relatedHtml ? '<div style="margin-top:20px"><div style="font-size:15px;font-weight:700;margin-bottom:10px">卖家其他商品</div><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px">' + relatedHtml + '</div></div>' : '') +
        '</div>' +
        (isOwner ?
          (item.status === 'active' ?
          '<div class="item-action-bar">' +
            '<button class="item-action-btn chat" style="background:#FFF0F0;color:var(--danger)" onclick="removeMyItem(' + item.id + ')">下架商品</button>' +
          '</div>' : '') :
          item.status === 'active' ?
          '<div class="item-action-bar">' +
            '<button class="item-action-btn chat" onclick="chatWithSeller(' + item.id + ')">💬 私聊卖家</button>' +
            '<button class="item-action-btn buy" onclick="buyItem(' + item.id + ')">🛒 购买</button>' +
          '</div>' :
          '<div class="item-action-bar">' +
            '<button class="item-action-btn chat" onclick="chatWithSeller(' + item.id + ')">💬 私聊卖家</button>' +
            '<button class="item-action-btn buy" style="background:#ccc;cursor:not-allowed" disabled>' + ({sold:'已售出',offline:'已下架',trading:'交易中'}[item.status]||'不可购买') + '</button>' +
          '</div>');

      // 加载评论
      loadMarketComments(item.id);

      // 图片滑动支持
      if (imgs.length > 1) {
        let imgIdx = 0;
        const imgBox = body.querySelector('.item-detail-imgs');
        if (imgBox) {
          let sx = 0;
          imgBox.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true});
          imgBox.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 40) {
              imgIdx = dx < 0 ? Math.min(imgIdx+1, imgs.length-1) : Math.max(imgIdx-1, 0);
              imgBox.querySelector('img').src = imgs[imgIdx];
              const counter = imgBox.querySelector('.img-counter');
              if (counter) counter.textContent = (imgIdx+1) + '/' + imgs.length;
            }
          });
        }
      }
    }


    // ─── 商品留言评论 ───────────────────────────────────
    var _replyToCommentId = null;
    var _replyToCommentName = '';


    async function loadMarketComments(itemId) {
      try {
        const data = await API.getMarketComments(itemId);
        const listEl = document.getElementById('commentList');
        const countEl = document.getElementById('commentCount');
        if (!listEl) return;
        if (data.error) { listEl.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px">加载失败</div>'; return; }
        const comments = data.comments || [];
        if (countEl) countEl.textContent = (data.total || 0) + '条';
        if (!comments.length) {
          listEl.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;font-size:13px">暂无留言，来说点什么吧 👋</div>';
          return;
        }
        listEl.innerHTML = comments.map(c => renderCommentCard(c, itemId)).join('');
      } catch(e) {
        const listEl = document.getElementById('commentList');
        if (listEl) listEl.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px">加载失败</div>';
      }
    }



    function renderCommentMedia(c) {
      if (!c.media_url) return '';
      if (c.media_type === 'video') return '<video src="' + c.media_url + '" controls playsinline style="max-width:100%;max-height:200px;border-radius:8px;margin-top:6px"></video>';
      return '<img src="' + c.media_url + '" loading="lazy" onclick="previewImage(this.src)" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:6px;cursor:pointer" />';
    }



    function renderCommentCard(c, itemId) {
      const avatarHtml = c.user_avatar && c.user_avatar.startsWith('http') ?
        '<img src="' + c.user_avatar + '" onerror="this.style.display=&apos;none&apos;" />' :
        '<img src="/default-avatar.png" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />';
      const isMine = currentUser && c.user_phone === currentUser.phone;
      let repliesHtml = '';
      if (c.replies && c.replies.length) {
        repliesHtml = '<div class="comment-replies">' + c.replies.map(r => {
          const rAvatar = r.user_avatar && r.user_avatar.startsWith('http') ?
            '<img src="' + r.user_avatar + '" onerror="this.style.display=&apos;none&apos;" />' : '<img src="/default-avatar.png" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.style.display=&apos;none&apos;" />';
          const rMine = currentUser && r.user_phone === currentUser.phone;
          return '<div class="comment-reply">' +
            '<div class="comment-top">' +
              '<div class="comment-avatar">' + rAvatar + '</div>' +
              '<div class="comment-body">' +
                '<div class="comment-name">' + escHtml(r.user_name || '用户') + '</div>' +
                (r.content ? '<div class="comment-text">' + escHtml(r.content) + '</div>' : '') +
                renderCommentMedia(r) +
                '<div class="comment-time">' + timeAgo(r.created_at) + (rMine ? ' · <button class="comment-del-btn" onclick="deleteComment(' + r.id + ',' + itemId + ')">删除</button>' : '') + '</div>' +
                '<div style="margin-top:4px;display:flex;gap:4px">' +
                  '<button onclick="shareComment(\'market\',\'商品\',\'' + escHtml((r.content||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')) + '\',\'' + escHtml((r.user_name||'用户').replace(/'/g,"\\'")) + '\')" style="background:none;border:none;font-size:11px;color:var(--text-secondary);cursor:pointer;padding:2px 6px;border-radius:8px;opacity:0.4;transition:opacity 0.15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.4\'">📤</button>' +
                  '<button onclick="showReportMenu(\'comment\',' + r.id + ',\'market\')" style="background:none;border:none;font-size:11px;color:var(--text-secondary);cursor:pointer;padding:2px 6px;border-radius:8px;opacity:0.4;transition:opacity 0.15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.4\'">🚫</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';
      }
      return '<div class="comment-card">' +
        '<div class="comment-top">' +
          '<div class="comment-avatar">' + avatarHtml + '</div>' +
          '<div class="comment-body">' +
            '<div class="comment-name">' + escHtml(c.user_name || '用户') + '</div>' +
            (c.content ? '<div class="comment-text">' + escHtml(c.content) + '</div>' : '') +
            renderCommentMedia(c) +
            '<div class="comment-time">' + timeAgo(c.created_at) + '</div>' +
            '<div class="comment-actions">' +
              '<button class="comment-action-btn" onclick="replyToComment(' + c.id + ',\'' + escHtml(c.user_name || '用户').replace(/'/g, "\\'") + '\')">💬 回复</button>' +
              '<button onclick="shareComment(\'market\',\'商品\',\'' + escHtml((c.content||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')) + '\',\'' + escHtml((c.user_name||'用户').replace(/'/g,"\\'")) + '\')" style="background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:5px 10px;border-radius:14px;opacity:0.45;transition:opacity 0.15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.45\'">📤</button>' +
              '<button onclick="showReportMenu(\'comment\',' + c.id + ',\'market\')" style="background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:5px 10px;border-radius:14px;opacity:0.45;transition:opacity 0.15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.45\'">🚫</button>' +
              (isMine ? '<button class="comment-del-btn" onclick="deleteComment(' + c.id + ',' + itemId + ')">🗑 删除</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        repliesHtml +
      '</div>';
    }


    let _commentMediaFile = null;


    function commentUploadMedia(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('文件不能超过5MB'); input.value = ''; return; }
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { showToast('仅支持图片/视频'); input.value = ''; return; }
      _commentMediaFile = file;
      const preview = document.getElementById('commentMediaPreview');
      if (!preview) return;
      preview.style.display = 'block';
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        preview.innerHTML = '<div style="position:relative;display:inline-block">' +
          '<video src="' + url + '" style="max-height:80px;border-radius:6px" muted></video>' +
          '<span onclick="clearCommentMedia()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>' +
        '</div>';
      } else {
        const url = URL.createObjectURL(file);
        preview.innerHTML = '<div style="position:relative;display:inline-block">' +
          '<img src="' + url + '" style="max-height:80px;border-radius:6px" />' +
          '<span onclick="clearCommentMedia()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>' +
        '</div>';
      }
    }



    function clearCommentMedia() {
      _commentMediaFile = null;
      const preview = document.getElementById('commentMediaPreview');
      if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
      const fileInput = document.querySelector('.comment-media-btn input[type=file]');
      if (fileInput) fileInput.value = '';
    }



    async function sendComment(itemId) {
      if (!currentUser) { showToast('请先登录'); return; }
      const inputEl = document.getElementById('commentInput');
      const sendBtn = document.getElementById('commentSendBtn');
      if (!inputEl) return;
      const content = inputEl.value.trim();
      if (!content && !_commentMediaFile) { showToast('请输入内容或上传图片/视频'); return; }
      if (sendBtn) sendBtn.disabled = true;
      try {
        const res = await API.postMarketComment(itemId, content, _replyToCommentId, _commentMediaFile);
        if (res.ok) {
          inputEl.value = '';
          clearCommentMedia();
          cancelReplyComment();
          loadMarketComments(itemId);
          showToast('留言成功 ✅');
        } else {
          showToast(res.error || '留言失败');
        }
      } catch(e) { showToast('留言失败'); }
      if (sendBtn) sendBtn.disabled = false;
    }



    async function deleteComment(commentId, itemId) {
      if (!confirm('确认删除这条留言？')) return;
      try {
        const res = await API.deleteMarketComment(commentId);
        if (res.ok) {
          loadMarketComments(itemId);
          showToast('已删除');
        } else {
          showToast(res.error || '删除失败');
        }
      } catch(e) { showToast('删除失败'); }
    }



    // 打开聊天会话（委托给 wall.js 的 window.openChatConv）
    function openChatWithId(convId, otherPhone, otherName) {
      if (typeof window.openChatConv === 'function') {
        // chatConversation 嵌套在 messagePage 内，必须先激活 messagePage
        document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
        document.getElementById('messagePage').classList.add('active');
        window.openChatConv(convId, otherPhone, otherName);
        // 关闭所有活跃的 sub-page，确保聊天不被遮挡
        document.querySelectorAll('.sub-page.active').forEach(function(p) { p.classList.remove('active'); });
      } else {
        showToast('聊天功能加载中，请稍后再试');
      }
    }

    async function chatWithSeller(itemId) {
      console.log('[chatWithSeller] called with itemId:', itemId, 'currentUser:', currentUser?.phone);
      if (!currentUser) { showToast('请先登录'); return; }
      try {
        console.log('[chatWithSeller] calling API.marketItemChat...');
        const res = await API.marketItemChat(itemId);
        console.log('[chatWithSeller] API response:', res);
        if (res.ok && res.conversation_id) {
          console.log('[chatWithSeller] opening chat:', res.conversation_id);
          openChatWithId(res.conversation_id, res.other_phone, res.other_name);
        } else {
          showToast(res.error || '创建会话失败');
        }
      } catch(e) { console.error('[chatWithSeller] error:', e); showToast('操作失败'); }
    }



    async function buyItem(itemId) {
      if (!currentUser) { showToast('请先登录'); return; }
      if (!confirm('确认购买此商品？')) return;
      try {
        const res = await API.createMarketOrder(itemId);
        if (res.ok) {
          showToast('购买成功！请在「我的交易」中查看进度 ✅');
          closeSubPage('itemDetailPage_sub');
          // 延迟打开交易页，确保子页面动画完成
          setTimeout(() => openMyTrades(), 350);
        } else {
          showToast(res.error || '购买失败');
        }
      } catch(e) { showToast('操作失败'); }
    }



    async function removeMyItem(itemId) {
      if (!confirm('确认下架此商品？')) return;
      try {
        const res = await API.deleteMarketItem(itemId);
        if (res.ok) {
          showToast('已下架');
          closeSubPage('itemDetailPage_sub');
          loadMarketItems(true);
        } else { showToast(res.error || '下架失败'); }
      } catch(e) { showToast('操作失败'); }
    }


    // ─── 发布商品 ─────────────────────────────────────────

    function openPublishItem() {
      if (!currentUser) { showToast('请先登录'); return; }
      publishImages = [];
      publishImgUrls = [];
      publishCategory = 'other';
      publishCondition = '9成新';
      document.getElementById('publishTitle').value = '';
      document.getElementById('publishDesc').value = '';
      document.getElementById('publishPrice').value = '';
      document.getElementById('publishOrigPrice').value = '';
      document.getElementById('publishContact').value = '';
      renderPublishImgGrid();
      resetPublishSelectors();
      openSubPage('publishItemPage_sub');
    }



    function onPublishImages(input) {
      if (!input.files) return;
      for (let i = 0; i < input.files.length && publishImages.length < 9; i++) {
        const f = input.files[i];
        if (!f.type.startsWith('image/')) { showToast('仅支持图片'); continue; }
        if (f.size > 5*1024*1024) { showToast(f.name + '超过5MB'); continue; }
        publishImages.push(f);
        publishImgUrls.push(URL.createObjectURL(f));
      }
      renderPublishImgGrid();
      input.value = '';
    }



    function renderPublishImgGrid() {
      const grid = document.getElementById('publishImgGrid');
      if (!grid) return;
      let html = publishImgUrls.map((url, i) =>
        '<div class="publish-img-item"><img src="' + url + '" /><button class="del-btn" onclick="removePublishImg(' + i + ')">×</button></div>'
      ).join('');
      if (publishImages.length < 9) {
        html += '<div class="publish-img-item add-btn" onclick="document.getElementById(\'publishImgInput\').click()"><div class="add-icon">+</div></div>';
      }
      grid.innerHTML = html;
    }



    function removePublishImg(idx) {
      URL.revokeObjectURL(publishImgUrls[idx]);
      publishImages.splice(idx, 1);
      publishImgUrls.splice(idx, 1);
      renderPublishImgGrid();
    }



    function selectPublishCategory(el, cat) {
      publishCategory = cat;
      document.querySelectorAll('#publishCategorySelector .category-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    }



    function selectPublishCondition(el, cond) {
      publishCondition = cond;
      document.querySelectorAll('#publishConditionSelector .condition-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    }



    function resetPublishSelectors() {
      document.querySelectorAll('#publishCategorySelector .category-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
      document.querySelectorAll('#publishConditionSelector .condition-chip').forEach((c, i) => c.classList.toggle('active', i === 1));
    }



    async function submitPublishItem() {
      const title = document.getElementById('publishTitle').value.trim();
      const price = parseFloat(document.getElementById('publishPrice').value);
      if (!title) { showToast('请输入标题'); return; }
      if (!price || price <= 0) { showToast('请输入有效价格'); return; }
      const data = {
        title,
        description: document.getElementById('publishDesc').value.trim(),
        price,
        original_price: parseFloat(document.getElementById('publishOrigPrice').value) || '',
        category: publishCategory,
        condition_level: publishCondition,
        contact: document.getElementById('publishContact').value.trim()
      };
      try {
        showToast('发布中...');
        const res = await API.createMarketItem(data, publishImages);
        if (res.ok) {
          showToast('发布成功 ✅');
          closeSubPage('publishItemPage_sub');
          loadMarketItems(true);
        } else {
          showToast(res.error || '发布失败');
        }
      } catch(e) { showToast('发布失败: ' + e.message); }
    }


    // ─── 我的交易 ─────────────────────────────────────────
    async function viewSeller(phone, name, avatar) {
      if (!phone) return;
      _currentSellerPhone = phone;
      _currentSellerName = name || '';
      document.getElementById('sellerItemsTitle').textContent = (name || '卖家') + ' 的主页';
      // 渲染空壳先
      const infoCard = document.getElementById('sellerInfoCard');
      infoCard.innerHTML = '<div style="text-align:center;padding:24px"><div class="skeleton" style="width:64px;height:64px;border-radius:50%;margin:0 auto 12px"></div><div class="skeleton" style="width:120px;height:18px;margin:0 auto 8px;border-radius:4px"></div><div class="skeleton" style="width:80px;height:14px;margin:0 auto;border-radius:4px"></div></div>';
      document.getElementById('sellerItemsContainer').innerHTML = '';
      document.getElementById('sellerRatingsList').innerHTML = '';
      openSubPage('sellerItemsPage_sub');
      // 并行加载
      loadSellerStats(phone, name, avatar);
      loadSellerItems(phone);
      loadSellerRatings(phone);
    }

    // 加载卖家统计信息
    async function loadSellerStats(phone, name, avatar) {
      try {
        const [stats, wallProfile] = await Promise.all([
          API.getSellerStats(phone),
          API.wallUserProfile(phone).catch(() => ({}))
        ]);
        const avgRating = parseFloat(stats.avg_rating) || 0;
        const ratingCount = stats.rating_count || 0;
        const itemCount = stats.item_count || 0;
        const wallCount = stats.wall_count || 0;
        // 同步校园墙头像和昵称
        const sellerAvatar = wallProfile.avatar || stats.seller_avatar || avatar || '';
        const sellerName = wallProfile.nickname || stats.seller_name || name || '';
        // 同步校园墙背景
        var bgStyle = '';
        if (wallProfile.bg_image) {
          bgStyle = 'style="background-image:url(' + escHtml(wallProfile.bg_image) + ');background-size:cover;background-position:center"';
        } else if (wallProfile.bg_color) {
          bgStyle = 'style="background-image:url(/default-cover.png);background-size:cover;background-position:center"';
        }
        document.getElementById('sellerRatingCount').textContent = ratingCount + '条';
        // 渲染信息卡
        const starsHtml = renderStarRating(avgRating, false);
        const infoCard = document.getElementById('sellerInfoCard');
        infoCard.innerHTML = 
          '<div class="seller-hero-bg" ' + bgStyle + '></div>' +
          '<div class="seller-hero-content">' +
            '<div class="seller-hero-avatar">' + renderAvatarHtml(sellerAvatar, sellerName) + '</div>' +
            '<div class="seller-hero-name">' + escHtml(sellerName || '卖家') + '</div>' +
            '<div class="seller-hero-rating">' + starsHtml + '<span class="seller-hero-rating-num">' + (avgRating > 0 ? avgRating.toFixed(1) : '暂无评分') + '</span></div>' +
            '<div class="seller-hero-stats">' +
              '<div class="seller-stat-item"><span class="seller-stat-num">' + itemCount + '</span><span class="seller-stat-label">商品</span></div>' +
              '<div class="seller-stat-item"><span class="seller-stat-num">' + ratingCount + '</span><span class="seller-stat-label">评价</span></div>' +
              '<div class="seller-stat-item"><span class="seller-stat-num">' + wallCount + '</span><span class="seller-stat-label">帖子</span></div>' +
            '</div>' +
            '<div class="seller-hero-actions">' +
              '<button class="seller-action-btn" onclick="event.stopPropagation();chatWithTrader(\'' + escHtml(phone) + '\')">💬 私聊</button>' +
              '<button class="seller-action-btn seller-action-wall" onclick="event.stopPropagation();openSellerWall(\'' + escHtml(phone) + '\',\'' + escHtml(sellerName) + '\')">📝 校园墙</button>' +
            '</div>' +
          '</div>';
      } catch(e) {
        console.error('加载卖家统计失败:', e);
      }
    }

    // 五角星评分渲染
    function renderStarRating(rating, showInteractive) {
      const full = Math.floor(rating);
      const half = rating - full >= 0.5 ? 1 : 0;
      const empty = 5 - full - half;
      let html = '<span class="star-rating">';
      for (let i = 0; i < full; i++) html += '<span class="star star-full">★</span>';
      if (half) html += '<span class="star star-half">★</span>';
      for (let i = 0; i < empty; i++) html += '<span class="star star-empty">☆</span>';
      html += '</span>';
      return html;
    }

    // 加载卖家评价列表
    async function loadSellerRatings(phone) {
      const container = document.getElementById('sellerRatingsList');
      container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px">加载中...</div>';
      try {
        const res = await API.getSellerRatings(phone, 1);
        const ratings = res.ratings || [];
        if (!ratings.length) {
          container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px">暂无评价</div>';
          return;
        }
        container.innerHTML = ratings.map(r => {
          const dateStr = (r.created_at || '').slice(0, 10);
          return '<div class="rating-item">' +
            '<div class="rating-item-header">' +
              '<span>' + renderStarRating(r.rating, false) + '</span>' +
              '<span class="rating-item-date">' + dateStr + '</span>' +
            '</div>' +
            (r.item_title ? '<div class="rating-item-product">📦 ' + escHtml(r.item_title) + '</div>' : '') +
            (r.comment ? '<div class="rating-item-comment">' + escHtml(r.comment) + '</div>' : '') +
          '</div>';
        }).join('');
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--danger);font-size:13px">加载失败</div>';
      }
    }

    var _currentSellerPhone = '';
    var _currentSellerName = '';

    // 打开卖家校园墙主页 → 关闭商品子页后跳转该用户个人墙
    async function openSellerWall(phone, name) {
      closeSubPage('sellerItemsPage_sub');
      showWallUser(phone);
    }

    async function loadSellerItems(sellerPhone) {
      const container = document.getElementById('sellerItemsContainer');
      if (!container) return;
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px">加载中...</div>';
      try {
        const res = await API.getMarketItems({ seller: sellerPhone, limit: 50 });
        const items = res.items || [];
        if (!items.length) {
          container.innerHTML = '<div class="sub-empty" style="padding:30px"><div class="sub-empty-icon">🛒</div><div class="sub-empty-text">该卖家暂无在售商品</div></div>';
          return;
        }
        const condLabel = { new:'全新', like_new:'几乎全新', good:'良好', fair:'一般' };
        const statusLabel = { active:'在售', trading:'交易中', sold:'已售', offline:'已下架' };
        container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">' +
          items.map(item => {
            const img = (item.images && item.images[0]) || '';
            const trust = item.trust || {};
            const statusCls = item.status === 'active' ? 'active' : item.status === 'sold' ? 'sold' : 'offline';
            return '<div class="market-card" onclick="openItemDetail(' + item.id + ')">' +
              (img ? '<img class="market-card-img" src="' + img + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><div class="market-card-noimg" style="display:none">🛒</div>' : '<div class="market-card-noimg">🛒</div>') +
              (statusLabel[item.status] ? '<span class="market-card-status ' + statusCls + '">' + statusLabel[item.status] + '</span>' : '') +
              '<div class="market-card-info">' +
                '<div class="market-card-title">' + escHtml(item.title) + '</div>' +
                '<div class="market-card-price">¥' + (item.price || 0).toFixed(2) + (item.original_price ? '<small>¥' + item.original_price.toFixed(2) + '</small>' : '') + '</div>' +
              '</div></div>';
          }).join('') +
        '</div>';
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger);font-size:13px">加载失败</div>';
      }
    }


    function switchTradeTab(tab) {
      tradeTab = tab;
      loadMyTradeList();
    }

    // 子Tab公共HTML
    function myMarketSubTabs() {
      return '<div class="my-market-subtabs" style="display:flex;gap:6px;margin-bottom:12px">' +
        '<span class="my-market-subtab' + (myMarketTab === 'items' ? ' active' : '') + '" onclick="switchMyMarketTab(\'items\')" style="padding:7px 16px;border-radius:18px;font-size:13px;font-weight:600;cursor:pointer;' + (myMarketTab === 'items' ? 'background:var(--gradient);color:#fff' : 'background:var(--bg);color:var(--text-secondary);border:1px solid var(--border)') + '">📦 我的商品</span>' +
        '<span class="my-market-subtab' + (myMarketTab === 'trades' ? ' active' : '') + '" onclick="switchMyMarketTab(\'trades\')" style="padding:7px 16px;border-radius:18px;font-size:13px;font-weight:600;cursor:pointer;' + (myMarketTab === 'trades' ? 'background:var(--gradient);color:#fff' : 'background:var(--bg);color:var(--text-secondary);border:1px solid var(--border)') + '">🛒 我的交易</span>' +
      '</div>';
    }

    async function loadMyTradeList() {
      const container = document.getElementById('marketMyListings');
      if (!container) return;
      const subTabs = myMarketSubTabs();
      // 交易角色Tab
      const tabLabels = { all:'全部', buyer:'买入', seller:'卖出' };
      let tabsHtml = subTabs + '<div id="tradeTabs" style="display:flex;gap:8px;margin-bottom:12px">';
      Object.entries(tabLabels).forEach(([k, v]) => {
        tabsHtml += '<div class="trade-tab' + (tradeTab === k ? ' active' : '') + '" id="tradeTab' + k.charAt(0).toUpperCase() + k.slice(1) + '" onclick="switchTradeTab(\'' + k + '\')" style="padding:6px 16px;border-radius:16px;font-size:13px;cursor:pointer;' + (tradeTab === k ? 'background:var(--gradient);color:#fff' : 'background:var(--bg);color:var(--text-secondary)') + '">' + v + '</div>';
      });
      tabsHtml += '</div>';
      container.innerHTML = tabsHtml + '<div style="text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div>';
      try {
        const res = await API.getMarketOrders(tradeTab === 'all' ? '' : tradeTab);
        const orders = res.orders || [];
        if (!orders.length) {
          container.innerHTML = tabsHtml + '<div class="sub-empty"><div class="sub-empty-icon">📭</div><div class="sub-empty-text">暂无交易记录</div></div>';
          return;
        }
        container.innerHTML = tabsHtml + orders.map(o => {
          const statusClass = o.status || 'pending';
          const statusText = STATUS_MAP[statusClass] || statusClass;
          const img = o.image || '';
          const otherName = o.is_buyer ? o.seller_name : o.buyer_name;
          const contactHtml = o.is_buyer && o.contact ? '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">📞 ' + escHtml(o.contact) + '</div>' : '';
          return '<div class="trade-card">' +
            '<div class="trade-card-top">' +
              (img ? '<img class="trade-card-img" src="' + img + '" loading="lazy" />' : '<div class="trade-card-noimg">🛒</div>') +
              '<div class="trade-card-info">' +
                '<div class="trade-card-title">' + escHtml(o.title || '') + '</div>' +
                '<div class="trade-card-price">¥' + (o.price || 0).toFixed(2) + '</div>' +
                '<div>' +
                  '<span class="trade-card-status ' + statusClass + '">' + statusText + '</span>' +
                  ' <span style="font-size:11px;color:var(--text-secondary)">' + (o.is_buyer ? '卖家' : '买家') + ' · ' + escHtml(otherName || '') + '</span>' +
                '</div>' +
                contactHtml +
              '</div>' +
            '</div>' +
            renderTradeGuide(o) +
            renderTradeActions(o) +
          '</div>';
        }).join('');
      } catch(e) {
        container.innerHTML = tabsHtml + '<div style="text-align:center;padding:40px;color:var(--danger)">加载失败</div>';
      }
    }



    function renderTradeGuide(o) {
      const steps = [
        { label: '下单', icon: '📝' },
        { label: '确认', icon: '✅' },
        { label: '完成', icon: '🎉' }
      ];
      const activeIdx = o.status === 'completed' ? 3 : o.status === 'cancelled' ? 0 : o.status === 'confirmed' ? 2 : 1;
      if (o.status === 'cancelled') {
        return '<div class="trade-guide cancelled">❌ 交易已取消</div>';
      }
      let html = '<div class="trade-guide">';
      steps.forEach((s, i) => {
        const isActive = i < activeIdx;
        const isCurrent = i === activeIdx - 1 && o.status !== 'completed';
        html += '<div class="trade-guide-step' + (isActive ? ' active' : '') + (isCurrent ? ' current' : '') + '">' +
          '<span class="trade-guide-dot">' + s.icon + '</span>' +
          '<span class="trade-guide-label">' + s.label + '</span>' +
        '</div>';
        if (i < 2) html += '<div class="trade-guide-line' + (i < activeIdx - 1 ? ' active' : '') + '"></div>';
      });
      html += '</div>';
      if (o.is_buyer && o.status === 'pending') {
        html += '<div class="trade-guide-hint">⏳ 等待卖家确认订单</div>';
      } else if (o.is_buyer && o.status === 'confirmed') {
        html += '<div class="trade-guide-hint">🤝 订单已确认，请与卖家协商交付，完成后点击「确认完成」</div>';
      } else if (o.is_seller && o.status === 'pending') {
        html += '<div class="trade-guide-hint">📢 有新订单！请确认后联系买家交易</div>';
      }
      return html;
    }


    function renderTradeActions(o) {
      let html = '<div class="trade-card-actions">';
      if (o.is_seller && o.status === 'pending') {
        html += '<button class="trade-btn trade-btn-primary" onclick="confirmTrade(' + o.id + ')">确认订单</button>';
        html += '<button class="trade-btn trade-btn-danger" onclick="cancelTrade(' + o.id + ')">取消</button>';
      }
      if (o.is_buyer && (o.status === 'confirmed' || o.status === 'paid')) {
        html += '<button class="trade-btn trade-btn-primary" onclick="completeTrade(' + o.id + ')">确认完成</button>';
        html += '<button class="trade-btn trade-btn-danger" onclick="cancelTrade(' + o.id + ')">取消</button>';
      }
      if (o.is_buyer && o.status === 'completed' && !o.rating) {
        html += '<button class="trade-btn trade-btn-outline" onclick="rateTrade(' + o.id + ')">⭐ 评价</button>';
      }
      html += '<button class="trade-btn trade-btn-outline" onclick="chatWithTrader(' + (o.is_buyer ? o.seller_phone : o.buyer_phone) + ')">💬 聊天</button>';
      html += '</div>';
      return html;
    }



    async function confirmTrade(orderId) {
      try {
        const res = await API.updateMarketOrder(orderId, 'confirm');
        if (res.ok) { showToast('已确认'); loadMyTradeList(); }
        else showToast(res.error || '操作失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function completeTrade(orderId) {
      if (!confirm('确认完成交易？')) return;
      try {
        const res = await API.updateMarketOrder(orderId, 'complete');
        if (res.ok) { showToast('交易完成 ✅'); loadMyTradeList(); }
        else showToast(res.error || '操作失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function cancelTrade(orderId) {
      if (!confirm('确认取消交易？')) return;
      try {
        const res = await API.updateMarketOrder(orderId, 'cancel');
        if (res.ok) { showToast('已取消'); loadMyTradeList(); }
        else showToast(res.error || '操作失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function rateTrade(orderId) {
      const rating = prompt('请给1-5星评分：');
      if (!rating || rating < 1 || rating > 5) { showToast('请输入1-5'); return; }
      const review = prompt('评价内容（选填）：') || '';
      try {
        const res = await API.reviewMarketOrder(orderId, parseInt(rating), review);
        if (res.ok) { showToast('评价成功 ⭐'); loadMyTradeList(); }
        else showToast(res.error || '评价失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function chatWithTrader(phone) {
      if (!currentUser) return;
      try {
        const res = await API.chatGetOrCreateConversation({ user_phone: currentUser.phone, rider_phone: phone });
        if (res.id) openChatWithId(res.id, res.other_phone, res.other_name);
        else showToast(res.error || '打开聊天失败');
      } catch(e) { showToast('操作失败'); }
    }


    // ─── 我的（在售+交易合并） ─────────────────────────
    let myMarketTab = 'items'; // 'items' | 'trades'

    async function openMyMarket(activeTab) {
      if (!currentUser) { showToast('请先登录'); return; }
      if (activeTab) myMarketTab = activeTab;
      // Show inline, hide grid
      document.getElementById('marketGrid').style.display = 'none';
      document.getElementById('marketEmpty').style.display = 'none';
      document.getElementById('marketMore').style.display = 'none';
      document.getElementById('marketMyListings').style.display = 'block';
      // Activate tab (marketTabMine may not exist since "我的" is a header button)
      document.querySelectorAll('#marketTabs .market-tab').forEach(t => t.classList.remove('active'));
      var mineTab = document.getElementById('marketTabMine');
      if (mineTab) mineTab.classList.add('active');
      // Switch sub-tab
      switchMyMarketTab(myMarketTab);
    }

    function switchMyMarketTab(tab) {
      myMarketTab = tab;
      if (tab === 'items') loadMyListings();
      else loadMyTradeList();
    }

    // 向后兼容
    window.openMyListings = () => openMyMarket('items');
    window.openMyTrades = () => openMyMarket('trades');
    window.switchMyMarketTab = switchMyMarketTab;

    async function loadMyListings(filterStatus) {
      const container = document.getElementById('marketMyListings');
      if (!container) return;
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div>';
      try {
        const res = await API.getMyMarketItems();
        const items = res.items || [];
        if (!items.length) {
          container.innerHTML = myMarketSubTabs() + '<div class="sub-empty"><div class="sub-empty-icon">📦</div><div class="sub-empty-text">暂无在售商品</div><button onclick="switchMarketCategory(\'all\');openPublishItem()" style="margin-top:16px;padding:10px 24px;border:2px solid var(--primary);border-radius:20px;background:transparent;color:var(--primary);font-weight:600;cursor:pointer">发布商品</button></div>';
          return;
        }
        // 按状态统计
        const statusOrder = [
          { key: 'active',  label: '在售', icon: '🟢' },
          { key: 'trading', label: '交易中', icon: '🔵' },
          { key: 'sold',    label: '已售', icon: '🟣' },
          { key: 'removed', label: '已下架', icon: '⚫' }
        ];
        const statusCounts = {};
        items.forEach(item => {
          const s = item.status || 'active';
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        // 状态Tab
        const subTabs = myMarketSubTabs();
        const activeStatus = filterStatus || '';
        const tabsHtml = subTabs + '<div class="my-listings-tabs">' +
          '<span class="my-listings-tab' + (!activeStatus ? ' active' : '') + '" onclick="loadMyListings()">全部 (' + items.length + ')</span>' +
          statusOrder.filter(s => statusCounts[s.key]).map(s =>
            '<span class="my-listings-tab' + (activeStatus === s.key ? ' active' : '') + '" onclick="loadMyListings(\'' + s.key + '\')">' + s.icon + ' ' + s.label + ' (' + statusCounts[s.key] + ')</span>'
          ).join('') +
        '</div>';
        // 筛选
        const filtered = activeStatus ? items.filter(i => (i.status || 'active') === activeStatus) : items;
        if (!filtered.length) {
          container.innerHTML = tabsHtml + '<div class="sub-empty"><div class="sub-empty-icon">📭</div><div class="sub-empty-text">该状态下暂无商品</div></div>';
          return;
        }
        // 按状态分组显示（全部时分组）
        const statusLabel = { active:'在售', trading:'交易中', sold:'已售', removed:'已下架' };
        const statusClass = { active:'completed', trading:'confirmed', sold:'paid', removed:'cancelled' };
        const renderCard = (item) => {
          const img = (item.images && item.images[0]) || '';
          return '<div class="trade-card clickable" onclick="event.stopPropagation();openItemDetail(' + item.id + ')">' +
            '<div class="trade-card-top">' +
              (img ? '<img class="trade-card-img" src="' + img + '" loading="lazy" />' : '<div class="trade-card-noimg">🛒</div>') +
              '<div class="trade-card-info">' +
                '<div class="trade-card-title">' + escHtml(item.title) + '</div>' +
                '<div class="trade-card-meta">' + (CATEGORY_MAP[item.category] || item.category || '其他') + '</div>' +
                '<div class="trade-card-price">¥' + (item.price || 0).toFixed(2) + '</div>' +
                '<span class="trade-card-status ' + (statusClass[item.status] || 'cancelled') + '">' + (statusLabel[item.status] || item.status) + '</span>' +
              '</div>' +
            '</div>' +
            (item.status === 'active' ? '<div class="trade-card-actions"><button class="trade-btn trade-btn-danger" onclick="event.stopPropagation();removeMyItem(' + item.id + ').then(function(){loadMyListings(\'' + (activeStatus || '') + '\')})">下架</button></div>' : '') +
          '</div>';
        };
        if (activeStatus) {
          // 单状态：直接列出
          container.innerHTML = tabsHtml + filtered.map(renderCard).join('');
        } else {
          // 全部：按状态分组显示
          let groupedHtml = '';
          statusOrder.forEach(s => {
            const group = items.filter(i => (i.status || 'active') === s.key);
            if (!group.length) return;
            groupedHtml += '<div class="my-listings-group"><div class="my-listings-group-title">' + s.icon + ' ' + s.label + ' <span class="my-listings-group-count">' + group.length + '件</span></div>' + group.map(renderCard).join('') + '</div>';
          });
          container.innerHTML = tabsHtml + groupedHtml;
        }
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">加载失败</div>';
      }
    }

// ── Window exports ──
window.loadMarketItems = loadMarketItems;
window.loadMoreMarketItems = loadMoreMarketItems;
window.switchMarketCategory = switchMarketCategory;
window.renderMarketGrid = renderMarketGrid;
window.openItemDetail = openItemDetail;
window.renderItemDetail = renderItemDetail;
window.loadMarketComments = loadMarketComments;
window.renderCommentMedia = renderCommentMedia;
window.renderCommentCard = renderCommentCard;
window.commentUploadMedia = commentUploadMedia;
window.clearCommentMedia = clearCommentMedia;
window.sendComment = sendComment;
window.deleteComment = deleteComment;
window.chatWithSeller = chatWithSeller;
window.buyItem = buyItem;
window.removeMyItem = removeMyItem;
window.openPublishItem = openPublishItem;
window.onPublishImages = onPublishImages;
window.renderPublishImgGrid = renderPublishImgGrid;
window.removePublishImg = removePublishImg;
window.selectPublishCategory = selectPublishCategory;
window.selectPublishCondition = selectPublishCondition;
window.resetPublishSelectors = resetPublishSelectors;
window.submitPublishItem = submitPublishItem;
window.openMyTrades = openMyTrades;  // backward compat wrapper
window.viewSeller = viewSeller;
window.loadSellerItems = loadSellerItems;
window.loadSellerStats = loadSellerStats;
window.loadSellerRatings = loadSellerRatings;
window.renderStarRating = renderStarRating;
window.openSellerWall = openSellerWall;
window.switchTradeTab = switchTradeTab;
window.loadMyTradeList = loadMyTradeList;
window.renderTradeActions = renderTradeActions;
window.confirmTrade = confirmTrade;
window.completeTrade = completeTrade;
window.cancelTrade = cancelTrade;
window.rateTrade = rateTrade;
window.chatWithTrader = chatWithTrader;
window.openMyMarket = openMyMarket;
window.loadMyListings = loadMyListings;
