// order.js - 订单系统
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码


    // ══════ 订单数据同步 ══════
    let _orderPollTimer = null;


    async function refreshOrders() {
      if (!currentUser) return;
      try {
        const o = await API.getOrders({ phone: currentUser.phone });
        const newOrders = Array.isArray(o) ? o : [];
        newOrders.forEach(no => {
          const old = orders.find(o2 => o2.id === no.id);
          if (old && old.status !== no.status) {
            const labels = {accepted:"已接单",running:"配送中",completed:"已完成",cancelled:"已取消"};
            if (labels[no.status]) showToast("订单 #" + (no.order_no||no.id) + " " + labels[no.status]);
          }
        });
        orders = newOrders;
        renderOrders();
        updateMePage();
      } catch(e) { console.error("refreshOrders error:", e); }
    }



    function startOrderPolling() {
      stopOrderPolling();
      _orderPollTimer = setInterval(refreshOrders, 10000);
    }



    function stopOrderPolling() {
      if (_orderPollTimer) { clearInterval(_orderPollTimer); _orderPollTimer = null; }
    }


    // ══════ 订单筛选 - 状态 ══════
    let orderStatusFilter = 'all';
    let orderTimeFilter = 'all';
    let orderDateFrom = null;
    let orderDateTo = null;


    function switchOrderFilter(status) {
      orderStatusFilter = status;
      // 高亮状态标签（首页 + 订单页）
      document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
      const labelMap = { all:'全部', pending:'待接单', running:'进行中', completed:'已完成', cancelled:'已取消' };
      const targetText = labelMap[status] || '';
      document.querySelectorAll('.order-tab').forEach(t => {
        if (t.textContent.includes(targetText)) t.classList.add('active');
      });
      currentTab = status; // 兼容首页
      renderOrders();
    }


    // ══════ 订单筛选 - 时间 ══════

    function switchTimeFilter(period) {
      orderTimeFilter = period;
      document.querySelectorAll('.time-filter-chip').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      const rangeEl = document.getElementById('customTimeRange');
      if (period === 'custom') {
        rangeEl.style.display = 'flex';
      } else {
        rangeEl.style.display = 'none';
        orderDateFrom = null;
        orderDateTo = null;
      }
      renderOrders();
    }



    function applyCustomTime() {
      const from = document.getElementById('orderDateFrom').value;
      const to = document.getElementById('orderDateTo').value;
      if (from) orderDateFrom = new Date(from);
      else orderDateFrom = null;
      if (to) orderDateTo = new Date(to + 'T23:59:59');
      else orderDateTo = null;
      renderOrders();
    }



    function filterByTime(orders) {
      if (orderTimeFilter === 'all') return orders;
      const now = new Date();
      let start, end;
      if (orderTimeFilter === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (orderTimeFilter === 'week') {
        start = new Date(now.getTime() - 7 * 86400000);
        end = now;
      } else if (orderTimeFilter === 'month') {
        start = new Date(now.getTime() - 30 * 86400000);
        end = now;
      } else if (orderTimeFilter === 'custom') {
        start = orderDateFrom;
        end = orderDateTo;
      }
      if (!start && !end) return orders;
      return orders.filter(o => {
        const d = new Date(o.created_at);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }


    // ══════ 涓嬪崟寮圭獥 ══════

    function showErrandServices() {
      let el = document.getElementById('errandPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'errandPage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'errandPage_sub\')">←</button><span class="sub-page-title">🏃 跑腿服务</span></div><div class="sub-page-body"></div>';
        document.body.appendChild(el);
      }
      const services = [
        { key:'delivery', icon:'🍱', name:_t('serviceDelivery'), desc:_t('serviceDescDelivery'), price:2 },
        { key:'express', icon:'📦', name:_t('serviceExpress'), desc:_t('serviceDescExpress'), price:2 },
        { key:'purchase', icon:'🛒', name:_t('servicePurchase'), desc:_t('serviceDescPurchase'), price:3 },
        { key:'laundry', icon:'👕', name:_t('serviceLaundry'), desc:_t('serviceDescLaundry'), price:2 },
        { key:'errand', icon:'🏃', name:_t('serviceErrand'), desc:_t('serviceDescErrand'), price:5 },
        { key:'other', icon:'✨', name:_t('serviceOther'), desc:_t('serviceDescOther'), price:3 }
      ];
      const gradients = [
        'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
        'linear-gradient(135deg, #4ECDC4, #6EE7DE)',
        'linear-gradient(135deg, #DDA0DD, #E8B8E8)',
        'linear-gradient(135deg, #F7DC6F, #F9E79F)',
        'linear-gradient(135deg, #45B7D1, #6DD5ED)',
        'linear-gradient(135deg, #96CEB4, #B8E0C8)'
      ];
      let h = '<div class="errand-hero">';
      h += '<div class="errand-hero-icon">🏃</div>';
      h += '<div class="errand-hero-title">跑腿服务</div>';
      h += '<div class="errand-hero-desc">选择你需要的服务，骑手即刻出发</div>';
      h += '</div>';
      h += '<div class="errand-grid">';
      services.forEach((s, i) => {
        h += '<div class="errand-card" onclick="closeSubPage(\'errandPage_sub\');openOrderModal(\'' + s.key + '\')">';
        h += '<div class="errand-card-icon" style="background:' + gradients[i] + '">' + s.icon + '</div>';
        h += '<div class="errand-card-name">' + s.name + '</div>';
        h += '<div class="errand-card-price">¥' + s.price + '起</div>';
        h += '<div class="errand-card-desc">' + s.desc + '</div>';
        h += '</div>';
      });
      h += '</div>';
      el.querySelector('.sub-page-body').innerHTML = h;
      openSubPage('errandPage_sub');
    }



    function openOrderModal(type) {
      if (!currentUser) return showLoginPage();
      currentService = type;
      currentTip = 0;
      const svc = {
        delivery:{icon:'🍔',name:_t('serviceDelivery'),desc:_t('serviceDescDelivery'),price:2,color:'#FFF0EB'},
        express:{icon:'📦',name:_t('serviceExpress'),desc:_t('serviceDescExpress'),price:2,color:'#E3F2FD'},
        print:{icon:'🖨️',name:_t('serviceMore'),desc:_t('serviceDescOther'),price:1,color:'#E8F5E9'},
        purchase:{icon:'🛒',name:_t('servicePurchase'),desc:_t('serviceDescPurchase'),price:3,color:'#F3E5F5'},
        laundry:{icon:'👕',name:_t('serviceLaundry'),desc:_t('serviceDescLaundry'),price:2,color:'#FFF3E0'},
        errand:{icon:'🏃',name:_t('serviceErrand'),desc:_t('serviceDescErrand'),price:5,color:'#E0F7FA'},
        other:{icon:'✨',name:_t('serviceOther'),desc:_t('serviceDescOther'),price:3,color:'#FCE4EC'}
      };
      const s = svc[type] || svc.other;
      document.getElementById('modalTitle').textContent = s.icon + ' ' + s.name;
      document.getElementById('priceValue').textContent = '¥' + s.price.toFixed(2);
      document.getElementById('tipSection').style.display = 'block';
      // 更新服务卡片
      const heroEl = document.getElementById('serviceHero');
      if (heroEl) {
        document.getElementById('serviceIcon').textContent = s.icon;
        document.getElementById('serviceIcon').style.background = s.color;
        document.getElementById('serviceName').textContent = s.name;
        document.getElementById('serviceDesc').textContent = s.desc;
      }
      document.getElementById('orderForm').reset();
      openSubPage('orderPage_sub');
    }



    function updatePrice() {
      const svc = { delivery:{price:2}, express:{price:2}, print:{price:1}, purchase:{price:3}, laundry:{price:2}, errand:{price:5}, other:{price:3} };
      const s = svc[currentService] || { price: 2 };
      currentTip = parseInt(document.getElementById('tipInput')?.value || '0');
      const total = s.price + currentTip;
      document.getElementById('priceValue').textContent = '¥' + total.toFixed(2);
    }



    async function submitOrder() {
      const pickup = document.getElementById('pickupLocation').value.trim();
      const delivery = document.getElementById('deliveryLocation').value.trim();
      const details = document.getElementById('orderDetails').value.trim();
      if (!pickup) return showToast('...');
      if (!delivery) return showToast('...');
      if (!currentUser) return showLoginPage();
      const btn = document.querySelector('button[type=submit]');
      btn.textContent = '...';
      btn.disabled = true;
      try {
        const res = await API.createOrder({
          type: currentService,
          pickup_location: pickup,
          delivery_location: delivery,
          details: details,
          phone: currentUser.phone,
          tip: currentTip
        });
        if (res.error) throw new Error(res.error);
        closeSubPage('orderPage_sub');
        await refreshOrders();
        showToast('下单成功！');
      } catch(e) {
        showToast(e.message || '...');
      } finally {
        btn.textContent = '...';
        btn.disabled = false;
      }
    }



    function renderOrders() {
      const homeList = document.getElementById('orderList');
      const allList = document.getElementById('allOrderList');
      const statsEl = document.getElementById('orderStats');
      if (!currentUser) return;

      const statusLabel = { pending:_t('orderStatusPending'), accepted:_t('orderStatusAccepted'), running:_t('orderStatusRunning'), completed:_t('orderStatusCompleted'), cancelled:_t('orderStatusCancelled') };
      const statusColor = { pending:'#F39C12', accepted:'#3498DB', running:'#2ECC71', completed:'#95A5A6', cancelled:'#E74C3C' };
      const typeIcon = { delivery:'🍱', express:'📦', purchase:'🛒', laundry:'👕', errand:'🏃', other:'💡' };
      const typeLabel = { delivery:_t('orderTypeDelivery'), express:_t('orderTypeExpress'), purchase:_t('orderTypePurchase'), laundry:_t('orderTypeLaundry'), errand:_t('orderTypeErrand'), other:_t('orderTypeOther') };

      // 1. 先按状态筛选
      let filtered = orders;
      const sf = orderStatusFilter || currentTab || 'all';
      if (sf === 'pending') filtered = orders.filter(o => o.status === 'pending');
      else if (sf === 'running') filtered = orders.filter(o => o.status === 'accepted' || o.status === 'running');
      else if (sf === 'completed') filtered = orders.filter(o => o.status === 'completed');
      else if (sf === 'cancelled') filtered = orders.filter(o => o.status === 'cancelled');

      // 2. 再按时间筛选
      filtered = filterByTime(filtered);

      // 3. 统计信息（仅订单页）
      if (statsEl) {
        const total = filtered.length;
        const totalAmount = filtered.reduce((s, o) => s + (o.price || 0), 0);
        const pending = filtered.filter(o => o.status === 'pending').length;
        const running = filtered.filter(o => o.status === 'accepted' || o.status === 'running').length;
        const done = filtered.filter(o => o.status === 'completed').length;
        statsEl.innerHTML = `
          <div class="order-stat-pill"><div class="stat-num" style="color:var(--primary)">${total}</div><div class="stat-label">${_t('orderTabAll')}</div></div>
          <div class="order-stat-pill"><div class="stat-num" style="color:#F39C12">${pending}</div><div class="stat-label">${_t('orderTabPending')}</div></div>
          <div class="order-stat-pill"><div class="stat-num" style="color:#2ECC71">${running}</div><div class="stat-label">${_t('orderTabRunning')}</div></div>
          <div class="order-stat-pill"><div class="stat-num" style="color:#95A5A6">${done}</div><div class="stat-label">${_t('orderTabCompleted')}</div></div>
          <div class="order-stat-pill"><div class="stat-num" style="color:var(--primary)">¥${totalAmount.toFixed(1)}</div><div class="stat-label">💰</div></div>
        `;
      }

      // 4. 渲染列表
      const sLabel = { pending:_t('orderStatusPending'), accepted:_t('orderStatusAccepted'), running:_t('orderStatusRunning'), completed:_t('orderStatusCompleted'), cancelled:_t('orderStatusCancelled') };
      const tLabel = { delivery:_t('orderTypeDelivery'), express:_t('orderTypeExpress'), purchase:_t('orderTypePurchase'), laundry:_t('orderTypeLaundry'), errand:_t('orderTypeErrand'), other:_t('orderTypeOther') };
      const html = filtered.length ? filtered.map(o => `
        <div class="order-card" onclick="showOrderDetail('${o.order_no||o.id}')" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>${typeIcon[o.type]||'📦'} ${tLabel[o.type]||o.type}</b>
            <span style="font-size:12px;padding:4px 8px;border-radius:8px;background:${statusColor[o.status]||'#ddd'};color:white">${sLabel[o.status]||o.status}</span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">📍 ${escHtml(o.pickup_location||'')} → 📍 ${escHtml(o.delivery_location||'')}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${fmtTime(o.created_at)} · ¥${(o.price||0).toFixed(2)}</div>
        </div>
      `).join('') : `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">${_t('noOrders')}</div></div>`;

      if (homeList) homeList.innerHTML = html;
      if (allList) allList.innerHTML = html;
    }



    // ══════ 订单详情 ══════

    async function showOrderDetail(id) {
      let o = orders.find(x => (x.order_no || x.id) == id);
      if (!o) { o = await API.getOrder(id); }
      if (!o) return;
      const statusLabel = { pending:_t('orderStatusPending'), accepted:_t('orderStatusAccepted'), running:_t('orderStatusRunning'), completed:_t('orderStatusCompleted'), cancelled:_t('orderStatusCancelled') };
      const statusColor = { pending:'#F39C12', accepted:'#3498DB', running:'#2ECC71', completed:'#95A5A6', cancelled:'#E74C3C' };
      const statusIcon = { pending:'⏳', accepted:'👍', running:'🚴', completed:'✅', cancelled:'❌' };
      const typeLabel = { delivery:_t('orderTypeDelivery'), express:_t('orderTypeExpress'), purchase:_t('orderTypePurchase'), laundry:_t('orderTypeLaundry'), errand:_t('orderTypeErrand'), other:_t('orderTypeOther') };
      const typeIcon = { delivery:'🍱', express:'📦', purchase:'🛒', laundry:'👔', errand:'🏃', other:'📋' };
      const canChat = o.rider_phone && ['accepted','running'].includes(o.status);
      const canCancelDirect = o.status === 'pending'; // 未接单可直接取消
      const canRequestCancel = ['accepted','running'].includes(o.status) && !o.cancel_request_status; // 已接单可申请取消
      const cancelPending = o.cancel_request_status === 'pending'; // 取消申请待审核
      const cancelRejected = o.cancel_request_status === 'rejected'; // 取消申请被拒绝
      const canRate = o.status === 'completed' && !o.rating_stars;
      const canRefund = o.status === 'completed' && !o.refund_status && !o.rating_stars; // 已完成未评价可申请退款
      const refundPending = o.refund_status === 'pending';
      const content = document.getElementById('detailContent');
      content.innerHTML = `
        <!-- 状态头部 -->
        <div class="od-status-hero" style="background:${statusColor[o.status]||'#95A5A6'}">
          <div class="od-status-icon">${statusIcon[o.status]||'📋'}</div>
          <div class="od-status-text">${statusLabel[o.status]||o.status}</div>
          <div class="od-status-sub">${typeIcon[o.type]||'📋'} ${typeLabel[o.type]||o.type} #${o.order_no||o.id}</div>
        </div>
        <!-- 费用 -->
        <div class="od-fee-row">
          <span class="od-fee-label">' + _t('orderFee') + '</span>
          <span class="od-fee-amount">¥${(o.price||0).toFixed(2)}${o.tip?' <small style="color:var(--primary)">+小费¥'+o.tip+'</small>':''}</span>
        </div>
        <!-- 地址卡片 -->
        <div class="sp-card">
          <div class="sp-card-title">' + _t('orderDeliveryInfo') + '</div>
          <div class="sp-card-body">
            <div class="od-addr-row">
              <div class="od-addr-dot" style="background:#2ECC71"></div>
              <div class="od-addr-info">' + _t('orderPickup') + '</span>${escHtml(o.pickup_location||'未填写')}</div>
            </div>
            <div class="od-addr-line"></div>
            <div class="od-addr-row">
              <div class="od-addr-dot" style="background:var(--primary)"></div>
              <div class="od-addr-info">' + _t('orderDeliverTo') + '</span>${escHtml(o.delivery_location||'未填写')}</div>
            </div>
          </div>
        </div>
        <!-- 备注 -->
        <div class="sp-card">
          <div class="sp-card-title">' + _t('orderNote') + '</div>
          <div class="sp-card-body">
            <div class="od-note">${escHtml(o.note||'无备注')}</div>
          </div>
        </div>
        <!-- 骑手信息 -->
        ${o.rider_name ? `
        <div class="sp-card">
          <div class="sp-card-title">' + _t('orderRiderInfo') + '</div>
          <div class="sp-card-body">
            <div class="od-rider-row">
              <div class="od-rider-avatar">${o.rider_name.charAt(0)}</div>
              <div class="od-rider-info">
                <div class="od-rider-name">${escHtml(o.rider_name)}</div>
                <div class="od-rider-status" style="color:${statusColor[o.status]||'#999'}">${statusLabel[o.status]||o.status}</div>
              </div>
            </div>
          </div>
        </div>` : ''}
        <!-- 时间线 -->
        <div class="sp-card">
          <div class="sp-card-title">' + _t('orderTimeInfo') + '</div>
          <div class="sp-card-body">
            <div class="od-timeline">
              <div class="od-tl-item"><span class="od-tl-dot active"></span><span>' + _t('orderTimeCreated') + '</span><span class="od-tl-time">${o.created_at||'--'}</span></div>
              ${o.accepted_at ? '<div class="od-tl-item"><span class="od-tl-dot active"></span><span>' + _t('orderTimeAccepted') + '</span><span class="od-tl-time">'+o.accepted_at+'</span></div>' : ''}
              ${o.completed_at ? '<div class="od-tl-item"><span class="od-tl-dot active"></span><span>' + _t('orderTimeCompleted') + '</span><span class="od-tl-time">'+o.completed_at+'</span></div>' : ''}
            </div>
          </div>
        </div>
        <!-- 评分 -->
        ${o.rating_stars ? `
        <div class="sp-card">
          <div class="sp-card-title">' + _t('orderRating') + '</div>
          <div class="sp-card-body">
            <div class="od-rating-stars">${'★'.repeat(o.rating_stars)+'☆'.repeat(5-o.rating_stars)}</div>
            ${o.rating_comment ? '<div class="od-note">'+escHtml(o.rating_comment)+'</div>' : ''}
          </div>
        </div>` : ''}
        <!-- 操作按钮 -->
        <div class="od-actions">
          ${canChat ? '<button class="od-btn od-btn-primary" onclick="openChatFromOrder(\''+o.id+'\',\''+o.rider_phone+'\',\''+escHtml(o.rider_name||'')+'\')">💬 联系骑手</button>' : ''}
          ${canRate ? '<button class="od-btn od-btn-primary" onclick="openRateModal(\''+o.id+'\')">⭐ 评价订单</button>' : ''}
          ${canCancelDirect ? '<button class="od-btn od-btn-danger" onclick="cancelOrder(\''+o.id+'\')">❌ 取消订单</button>' : ''}
          ${canRequestCancel ? '<button class="od-btn od-btn-warning" onclick="requestCancelOrder(\''+o.id+'\')">🚫 申请取消</button>' : ''}
          ${cancelPending ? '<div class="od-status-tag od-tag-waiting">⏳ 取消申请审核中...</div>' : ''}
          ${cancelRejected ? '<div class="od-status-tag od-tag-rejected">❌ 取消申请已被拒绝</div><button class="od-btn od-btn-warning" onclick="requestCancelOrder(\''+o.id+'\')">🔄 重新申请</button>' : ''}
          ${canRefund ? '<button class="od-btn od-btn-refund" onclick="requestRefund(\''+o.id+'\')">💰 申请退款</button>' : ''}
          ${refundPending ? '<div class="od-status-tag od-tag-waiting">⏳ 退款申请审核中...</div>' : ''}
          ${o.refund_status==='approved_full' ? '<div class="od-status-tag od-tag-approved">✅ 已全额退款 ¥'+(o.refund_amount||0).toFixed(2)+'</div>' : ''}
          ${o.refund_status==='approved_partial' ? '<div class="od-status-tag od-tag-approved">✅ 已部分退款 ¥'+(o.refund_amount||0).toFixed(2)+'</div>' : ''}
          ${o.refund_status==='rejected' ? '<div class="od-status-tag od-tag-rejected">❌ 退款申请被拒绝</div>' : ''}
        </div>
      `;
      openSubPage('detailPage_sub');
    }



    async function cancelOrder(id) {
      if (!confirm('确定取消该订单吗？')) return;
      try {
        const res = await API.cancelOrder(id, '用户取消');
        if (res.ok) {
          closeSubPage('detailPage_sub');
          await refreshOrders();
          showToast(res.direct ? '订单已取消' : (res.message || '取消申请已提交'));
        } else { showToast(res.error || '取消失败'); }
      } catch(e) { showToast(e.message || '取消失败'); }
    }


    // 申请取消（已接单/配送中）

    async function requestCancelOrder(id) {
      const reason = prompt('请填写取消原因：');
      if (!reason) return;
      try {
        const res = await API.cancelOrder(id, reason);
        if (res.ok) {
          closeSubPage('detailPage_sub');
          await refreshOrders();
          showToast(res.message || '取消申请已提交，等待审核');
        } else { showToast(res.error || '申请失败'); }
      } catch(e) { showToast(e.message || '申请失败'); }
    }


    // 申请退款（已完成订单）

    async function requestRefund(id) {
      const reason = prompt('请填写退款原因：');
      if (!reason) return;
      try {
        const res = await API.requestRefund(id, reason);
        if (res.ok) {
          closeSubPage('detailPage_sub');
          await refreshOrders();
          showToast(res.message || '退款申请已提交，等待管理员审核');
        } else { showToast(res.error || '申请失败'); }
      } catch(e) { showToast(e.message || '申请失败'); }
    }



    function openRateModal(id) {
      document.getElementById('rateOrderId').value = id;
      document.getElementById('rateComment').value = '';
      document.getElementById('rateCharCount').textContent = '0 / 200';
      document.querySelectorAll('.rate-tag').forEach(t => t.classList.remove('active'));
      setStar(5);
      openSubPage('ratePage_sub');
    }



    function setStar(n) {
      document.querySelectorAll('.rate-star').forEach((s,i) => s.classList.toggle('active', i < n));
      document.getElementById('starCount').value = n;
      const emoji = ['😡','😟','😐','🙂','😊'][n-1] || '😊';
      const label = [_t('rateVeryBad'),_t('rateBad'),_t('rateOk'),_t('rateGood'),_t('rateExcellent')][n-1] || _t('rateExcellent');
      const emojiEl = document.getElementById('rateEmoji');
      const labelEl = document.getElementById('rateLabel');
      if (emojiEl) { emojiEl.textContent = emoji; emojiEl.classList.remove('bounce'); void emojiEl.offsetWidth; emojiEl.classList.add('bounce'); }
      if (labelEl) labelEl.textContent = label;
    }



    function toggleRateTag(el) {
      el.classList.toggle('active');
      // 将选中标签拼接写入备注
      const tags = Array.from(document.querySelectorAll('.rate-tag.active')).map(t => t.textContent);
      const textarea = document.getElementById('rateComment');
      const customText = textarea.value.replace(/^\s*(配送很快|态度友好|物品完好|准时送达|沟通顺畅|包装用心)(\s*(配送很快|态度友好|物品完好|准时送达|沟通顺畅|包装用心))*\s*/, '').trim();
      textarea.value = tags.join(' ') + (tags.length && customText ? ' ' : '') + customText;
      onRateInput();
    }



    function onRateInput() {
      const textarea = document.getElementById('rateComment');
      const count = (textarea.value || '').length;
      const el = document.getElementById('rateCharCount');
      el.textContent = count + ' / 200';
      el.className = 'rate-char-count' + (count > 200 ? ' over' : count > 150 ? ' warn' : '');
    }



    async function submitRating() {
      const id = document.getElementById('rateOrderId').value;
      const stars = parseInt(document.getElementById('starCount').value || '5');
      const comment = document.getElementById('rateComment').value.trim();
      try {
        await API.rateOrder(id, stars, comment, currentUser.phone);
        const idx = orders.findIndex(o => (o.order_no||o.id) == id);
        if (idx >= 0) { orders[idx].rating_stars = stars; orders[idx].rating_comment = comment; }
        closeSubPage('ratePage_sub');
        closeSubPage('detailPage_sub');
        renderOrders();
        showToast('...');
      } catch(e) { showToast(e.message || '...'); }
    }

// ── Window exports ──
window.refreshOrders = refreshOrders;
window.startOrderPolling = startOrderPolling;
window.stopOrderPolling = stopOrderPolling;
window.switchOrderFilter = switchOrderFilter;
window.switchTimeFilter = switchTimeFilter;
window.applyCustomTime = applyCustomTime;
window.filterByTime = filterByTime;
window.showErrandServices = showErrandServices;
window.openOrderModal = openOrderModal;
window.updatePrice = updatePrice;
window.submitOrder = submitOrder;
window.renderOrders = renderOrders;
window.showOrderDetail = showOrderDetail;
window.cancelOrder = cancelOrder;
window.requestCancelOrder = requestCancelOrder;
window.requestRefund = requestRefund;
window.openRateModal = openRateModal;
window.setStar = setStar;
window.toggleRateTag = toggleRateTag;
window.onRateInput = onRateInput;
window.submitRating = submitRating;
