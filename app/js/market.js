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
      document.querySelectorAll('#marketTabs .market-tab').forEach(t => t.classList.toggle('active', t.textContent.includes(CATEGORY_MAP[cat] || '全部')));
      loadMarketItems(true);
    }



    function renderMarketGrid() {
      const grid = document.getElementById('marketGrid');
      const empty = document.getElementById('marketEmpty');
      const more = document.getElementById('marketMore');
      if (!grid) return;
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
          (img ? '<img class="market-card-img" src="' + img + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><div class="market-card-noimg" style="display:none">🛒</div>' : '<div class="market-card-noimg">🛒</div>') +
          (statusLabel[item.status] ? '<span class="market-card-status ' + statusCls + '">' + statusLabel[item.status] + '</span>' : '') +
          '<div class="market-card-info">' +
            '<div class="market-card-title">' + escHtml(item.title) + '</div>' +
            '<div class="market-card-price">¥' + (item.price || 0).toFixed(2) + (item.original_price ? '<small>¥' + item.original_price.toFixed(2) + '</small>' : '') + '</div>' +
            '<div class="market-card-meta">' +
              '<div class="market-card-seller">' + avatarHtml + ' ' + escHtml(item.seller_name || '') + ' <span class="trust-badge">' + (trust.icon || '') + '</span></div>' +
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
      } catch(e) { showToast(_t('teacherLoadFailed')); }
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
          (rImg ? '<img src="' + rImg + '" style="width:120px;height:90px;object-fit:cover" />' : '<div style="width:120px;height:90px;background:#FFF0EB;display:flex;align-items:center;justify-content:center;font-size:24px">🛒</div>') +
          '<div style="padding:8px;font-size:12px;font-weight:600">' + escHtml(r.title) + '</div>' +
          '<div style="padding:0 8px 8px;font-size:14px;font-weight:900;color:var(--danger)">¥' + (r.price || 0).toFixed(2) + '</div>' +
          '</div>';
      }).join('');

      body.innerHTML =
        (imgs.length ? '<div class="item-detail-imgs"><img src="' + imgs[0] + '" /><div class="img-counter">1/' + imgs.length + '</div></div>' : '<div class="item-detail-imgs" style="display:flex;align-items:center;justify-content:center;font-size:64px;background:#FFF0EB">🛒</div>') +
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
          '<div class="item-seller-card" onclick="event.stopPropagation()">' +
            '<div class="item-seller-avatar">' + sellerAvatar + '</div>' +
            '<div class="item-seller-info">' +
              '<div class="item-seller-name">' + escHtml(item.seller_name || '卖家') + '</div>' +
              '<div class="item-seller-trust">' + trust.icon + ' ' + trust.label + ' · ' + (trust.totalDeals || 0) + '笔交易 · 好评' + (trust.goodRate || 100) + '%</div>' +
            '</div>' +
          '</div>' +
          '<div class="item-comments-section">' +
            '<div class="item-comments-header"><span class="item-comments-title">💬 留言</span><span class="item-comments-count" id="commentCount">加载中...</span></div>' +
            '<div id="commentList"></div>' +
            '<div class="comment-input-wrap" id="commentInputWrap">' +
              '<div id="replyHint" class="comment-reply-hint" style="display:none;width:100%;margin-bottom:6px">回复 <span id="replyName"></span> <span class="cancel-reply" onclick="cancelReplyComment()">✕ 取消</span></div>' +
              '<div style="display:flex;gap:6px;align-items:center;width:100%">' +
                '<span class="comment-emoji-btn" onclick="toggleCommentEmoji()">😊</span>' +
                '<label class="comment-media-btn" title="上传图片/视频">📎<input type="file" accept="image/*,video/*" style="display:none" onchange="commentUploadMedia(this)" /></label>' +
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
          '<div class="item-action-bar">' +
            '<button class="item-action-btn chat" onclick="chatWithSeller(' + item.id + ')">💬 私聊买家</button>' +
            (item.status === 'active' ? '<button class="item-action-btn chat" style="background:#FFF0F0;color:var(--danger)" onclick="removeMyItem(' + item.id + ')">下架商品</button>' : '') +
          '</div>' :
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
    let _replyToCommentId = null;
    let _replyToCommentName = '';


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
      return '<img src="' + c.media_url + '" onclick="previewImage(this.src)" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:6px;cursor:pointer" />';
    }



    function renderCommentCard(c, itemId) {
      const avatarHtml = c.user_avatar && c.user_avatar.startsWith('http') ?
        '<img src="' + c.user_avatar + '" />' :
        '<span>' + escHtml((c.user_name || 'U').charAt(0)) + '</span>';
      const isMine = currentUser && c.user_phone === currentUser.phone;
      let repliesHtml = '';
      if (c.replies && c.replies.length) {
        repliesHtml = '<div class="comment-replies">' + c.replies.map(r => {
          const rAvatar = r.user_avatar && r.user_avatar.startsWith('http') ?
            '<img src="' + r.user_avatar + '" />' : '<span>' + escHtml((r.user_name || 'U').charAt(0)) + '</span>';
          const rMine = currentUser && r.user_phone === currentUser.phone;
          return '<div class="comment-reply">' +
            '<div class="comment-top">' +
              '<div class="comment-avatar">' + rAvatar + '</div>' +
              '<div class="comment-body">' +
                '<div class="comment-name">' + escHtml(r.user_name || '用户') + '</div>' +
                (r.content ? '<div class="comment-text">' + escHtml(r.content) + '</div>' : '') +
                renderCommentMedia(r) +
                '<div class="comment-time">' + timeAgo(r.created_at) + (rMine ? ' · <button class="comment-del-btn" onclick="deleteComment(' + r.id + ',' + itemId + ')">删除</button>' : '') + '</div>' +
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



    async function chatWithSeller(itemId) {
      if (!currentUser) { showToast('请先登录'); return; }
      try {
        const res = await API.marketItemChat(itemId);
        if (res.ok && res.conversation_id) {
          closeSubPage('itemDetailPage_sub');
          openChatWithId(res.conversation_id);
        } else {
          showToast(res.error || '创建会话失败');
        }
      } catch(e) { showToast('操作失败'); }
    }



    async function buyItem(itemId) {
      if (!currentUser) { showToast('请先登录'); return; }
      if (!confirm('确认购买此商品？')) return;
      try {
        const res = await API.createMarketOrder(itemId);
        if (res.ok) {
          showToast('购买请求已发送 ✅');
          closeSubPage('itemDetailPage_sub');
          loadMarketItems(true);
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

    async function openMyTrades() {
      if (!currentUser) { showToast('请先登录'); return; }
      tradeTab = 'all';
      document.getElementById('tradeTabAll').classList.add('active');
      document.getElementById('tradeTabBuy').classList.remove('active');
      document.getElementById('tradeTabSell').classList.remove('active');
      openSubPage('myTradesPage_sub');
      await loadTradeList();
    }



    function switchTradeTab(tab) {
      tradeTab = tab;
      ['tradeTabAll','tradeTabBuy','tradeTabSell'].forEach(id => document.getElementById(id).classList.remove('active'));
      const map = { all:'tradeTabAll', buyer:'tradeTabBuy', seller:'tradeTabSell' };
      document.getElementById(map[tab]).classList.add('active');
      loadTradeList();
    }



    async function loadTradeList() {
      const container = document.getElementById('tradeListContainer');
      if (!container) return;
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div>';
      try {
        const res = await API.getMarketOrders(tradeTab === 'all' ? '' : tradeTab);
        const orders = res.orders || [];
        if (!orders.length) {
          container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">📭</div><div class="sub-empty-text">暂无交易记录</div></div>';
          return;
        }
        container.innerHTML = orders.map(o => {
          const statusClass = o.status || 'pending';
          const statusText = STATUS_MAP[statusClass] || statusClass;
          const img = o.image || '';
          const avatarHtml = renderAvatarHtml(o.is_buyer ? o.seller_avatar : o.buyer_avatar, o.is_buyer ? o.seller_name : o.buyer_name);
          const otherName = o.is_buyer ? o.seller_name : o.buyer_name;
          return '<div class="trade-card">' +
            '<div class="trade-card-top">' +
              (img ? '<img class="trade-card-img" src="' + img + '" />' : '<div class="trade-card-noimg">🛒</div>') +
              '<div class="trade-card-info">' +
                '<div class="trade-card-title">' + escHtml(o.title || '') + '</div>' +
                '<div class="trade-card-price">¥' + (o.price || 0).toFixed(2) + '</div>' +
                '<div>' +
                  '<span class="trade-card-status ' + statusClass + '">' + statusText + '</span>' +
                  ' <span style="font-size:11px;color:var(--text-secondary)">' + (o.is_buyer ? '买家' : '卖家') + ' · ' + escHtml(otherName || '') + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            renderTradeActions(o) +
          '</div>';
        }).join('');
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">加载失败</div>';
      }
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
        if (res.ok) { showToast('已确认'); loadTradeList(); }
        else showToast(res.error || '操作失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function completeTrade(orderId) {
      if (!confirm('确认完成交易？')) return;
      try {
        const res = await API.updateMarketOrder(orderId, 'complete');
        if (res.ok) { showToast('交易完成 ✅'); loadTradeList(); }
        else showToast(res.error || '操作失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function cancelTrade(orderId) {
      if (!confirm('确认取消交易？')) return;
      try {
        const res = await API.updateMarketOrder(orderId, 'cancel');
        if (res.ok) { showToast('已取消'); loadTradeList(); }
        else showToast(res.error || '操作失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function rateTrade(orderId) {
      const rating = prompt('请给1-5星评分：');
      if (!rating || rating < 1 || rating > 5) { showToast('请输入1-5'); return; }
      const review = prompt('评价内容（选填）：') || '';
      try {
        const res = await API.reviewMarketOrder(orderId, parseInt(rating), review);
        if (res.ok) { showToast('评价成功 ⭐'); loadTradeList(); }
        else showToast(res.error || '评价失败');
      } catch(e) { showToast('操作失败'); }
    }



    async function chatWithTrader(phone) {
      if (!currentUser) return;
      try {
        const res = await API.chatGetOrCreateConversation({ user_phone: currentUser.phone, rider_phone: phone });
        if (res.id) openChatWithId(res.id);
        else showToast(res.error || '打开聊天失败');
      } catch(e) { showToast('操作失败'); }
    }


    // ─── 我的在售 ─────────────────────────────────────────

    async function openMyListings() {
      if (!currentUser) { showToast('请先登录'); return; }
      openSubPage('myListingsPage_sub');
      await loadMyListings();
    }



    async function loadMyListings() {
      const container = document.getElementById('myListingsContainer');
      if (!container) return;
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div>';
      try {
        const res = await API.getMyMarketItems();
        const items = res.items || [];
        if (!items.length) {
          container.innerHTML = '<div class="sub-empty"><div class="sub-empty-icon">📦</div><div class="sub-empty-text">暂无在售商品</div><button onclick="closeSubPage(\'myListingsPage_sub\');openPublishItem()" style="margin-top:16px;padding:10px 24px;border:2px solid var(--primary);border-radius:20px;background:transparent;color:var(--primary);font-weight:600;cursor:pointer">发布商品</button></div>';
          return;
        }
        const statusLabel = { active:'在售', trading:'交易中', sold:'已售', removed:'已下架' };
        container.innerHTML = items.map(item => {
          const img = (item.images && item.images[0]) || '';
          return '<div class="trade-card">' +
            '<div class="trade-card-top">' +
              (img ? '<img class="trade-card-img" src="' + img + '" />' : '<div class="trade-card-noimg">🛒</div>') +
              '<div class="trade-card-info">' +
                '<div class="trade-card-title">' + escHtml(item.title) + '</div>' +
                '<div class="trade-card-price">¥' + (item.price || 0).toFixed(2) + '</div>' +
                '<span class="trade-card-status ' + (item.status === 'active' ? 'completed' : item.status === 'trading' ? 'confirmed' : 'cancelled') + '">' + (statusLabel[item.status] || item.status) + '</span>' +
              '</div>' +
            '</div>' +
            (item.status === 'active' ? '<div class="trade-card-actions"><button class="trade-btn trade-btn-danger" onclick="removeMyItem(' + item.id + ');loadMyListings()">下架</button></div>' : '') +
          '</div>';
        }).join('');
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
window.openMyTrades = openMyTrades;
window.switchTradeTab = switchTradeTab;
window.loadTradeList = loadTradeList;
window.renderTradeActions = renderTradeActions;
window.confirmTrade = confirmTrade;
window.completeTrade = completeTrade;
window.cancelTrade = cancelTrade;
window.rateTrade = rateTrade;
window.chatWithTrader = chatWithTrader;
window.openMyListings = openMyListings;
window.loadMyListings = loadMyListings;
