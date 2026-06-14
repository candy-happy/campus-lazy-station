// 校园圈 - 前端API桥接层
// 所有前端页面引入此文件后，自动从localStorage模式切换为数据库模式

const API = {
  _user: null,
  _rider: null,
  _admin: null,
  _role: 'user', // 'user' | 'rider' | 'admin'
  _token: null,
  _dbConnected: true, // 数据库连接状态
  _connectionCheckInterval: null,
  _headers() { const h = { 'Content-Type': 'application/json' }; if (this._token) h['Authorization'] = 'Bearer ' + this._token; return h; },
  _authHeaders() { const h = {}; if (this._token) h['Authorization'] = 'Bearer ' + this._token; return h; },

  // ─── 数据库连接状态检测 ──────────────────────────────────────
  async checkConnection() {
    try {
      // 使用不需要认证的公共接口检测连接
      const res = await fetch('/api/services', { headers: this._headers() });
      if (res.ok) {
        this._dbConnected = true;
        this._notifyConnectionStatus(true);
        return true;
      } else {
        this._dbConnected = false;
        this._notifyConnectionStatus(false);
        return false;
      }
    } catch (e) {
      this._dbConnected = false;
      this._notifyConnectionStatus(false);
      return false;
    }
  },

  _notifyConnectionStatus(connected) {
    const event = new CustomEvent('db-connection-change', { detail: { connected } });
    window.dispatchEvent(event);
  },

  startConnectionCheck(interval = 30000) {
    if (this._connectionCheckInterval) {
      clearInterval(this._connectionCheckInterval);
    }
    this._connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, interval);
  },

  stopConnectionCheck() {
    if (this._connectionCheckInterval) {
      clearInterval(this._connectionCheckInterval);
      this._connectionCheckInterval = null;
    }
  },

  isDbConnected() {
    return this._dbConnected;
  },

  // ─── 简易内存缓存 ──────────────────────────────────────
  _cache: {},
  _cacheTTL: 30000, // 默认30秒
  _cachedFetch(key, url, ttl) {
    const now = Date.now();
    const entry = this._cache[key];
    if (entry && now - entry.time < (ttl || this._cacheTTL)) return Promise.resolve(entry.data);
    return fetch(url, { headers: this._headers() }).then(r => r.json()).then(data => {
      this._cache[key] = { data, time: now };
      return data;
    });
  },
  _invalidateCache(key) { delete this._cache[key]; },
  _invalidateAllCache() { this._cache = {}; },

  // 恢复token（按角色读取各自独立的token key，避免跨端覆盖）
  _init() {
    // 先从 lazy_session 判断角色
    try {
      const s = JSON.parse(localStorage.getItem('lazy_session'));
      if (s) {
        this._role = s.role;
        const key = s.role === 'admin' ? 'lazy_admin_token' : s.role === 'rider' ? 'lazy_rider_token' : 'lazy_token';
        const t = localStorage.getItem(key);
        if (t) this._token = t;
        return;
      }
    } catch (e) {}
    const t = localStorage.getItem('lazy_token');
    if (t) this._token = t;
  },

  // ─── 用户 ───
  async userLogin(student_id, password, captcha, captchaKey) {
    const res = await fetch('/api/user/login', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ student_id, password, captcha, captchaKey })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._user = Object.assign({}, res.user, { phone_original: res.user?.phone || student_id });
    this._role = 'user';
    if (res.token) { this._token = res.token; localStorage.setItem('lazy_token', res.token); }
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'user', student_id, phone: res.user?.phone || student_id, name: res.user?.name || '', avatar: res.user?.avatar || '' }));
    return { ...this._user, isNewUser: res.isNewUser };
  },

  async verifyPassword(oldPassword) {
    const res = await fetch('/api/user/verify-password', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ oldPassword })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res.valid === true;
  },

  async changePassword(oldPassword, newPassword) {
    const res = await fetch('/api/user/change-password', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ oldPassword, newPassword })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },

  // ─── 骑手 ───
  async riderLogin(uid, student_id, phone) {
    const res = await fetch('/api/rider/login', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ uid, student_id, phone })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    if (res.code === 'RIDER_FROZEN') throw { message: res.error, code: 'RIDER_FROZEN' };
    this._rider = { ...res.rider, phone_original: phone };
    this._role = 'rider';
    if (res.token) { this._token = res.token; localStorage.setItem('lazy_rider_token', res.token); }
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'rider', phone, uid, avatar: res.rider?.avatar || '', name: res.rider?.name || '' }));
    return this._rider;
  },

  // ─── 管理员 ───
  async adminLogin(api_key) {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ api_key })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._admin = res.admin;
    this._role = 'admin';
    if (res.token) { this._token = res.token; localStorage.setItem('lazy_admin_token', res.token); }
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'admin', username: res.admin.username || 'admin' }));
    return this._admin;
  },

  // ─── 订单 ───
  async getOrders(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return fetch('/api/orders' + (params ? '?' + params : ''), { headers: this._headers() }).then(r => r.json());
  },
  async getOrder(id) { return fetch('/api/orders/' + id, { headers: this._headers() }).then(r => r.json()); },
  async createOrder(data) { return fetch('/api/orders', {
    method: 'POST', headers: this._headers(), body: JSON.stringify(data)
  }).then(r => r.json()); },
  async acceptOrder(id, rider_phone, rider_name) { return fetch('/api/orders/' + id + '/accept', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ rider_phone, rider_name })
  }).then(r => r.json()); },
  async startDelivery(id) { return fetch('/api/orders/' + id + '/start', {
    method: 'POST', headers: this._headers()
  }).then(r => r.json()); },
  async completeOrder(id) { return fetch('/api/orders/' + id + '/complete', {
    method: 'POST', headers: this._headers()
  }).then(r => r.json()); },
  async cancelOrder(id, reason) { return fetch('/api/orders/' + id + '/cancel', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ reason })
  }).then(r => r.json()); },
  async requestRefund(id, reason) { return fetch('/api/orders/' + id + '/refund', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ reason })
  }).then(r => r.json()); },
  async reviewCancel(id, action, name) { return fetch('/api/orders/' + id + '/cancel-review', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ action, admin_name: name })
  }).then(r => r.json()); },
  async riderReviewCancel(id, action, name) { return fetch('/api/orders/' + id + '/cancel-rider-review', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ action, rider_name: name })
  }).then(r => r.json()); },
  async reviewRefund(id, action, refundAmount, name) { return fetch('/api/orders/' + id + '/refund-review', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ action, refund_amount: refundAmount, admin_name: name })
  }).then(r => r.json()); },
  async rateOrder(id, stars, comment, phone) { return fetch('/api/orders/' + id + '/rate', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ stars, comment, phone })
  }).then(r => r.json()); },

  // ─── 骑手数据 ───
  async getRiders() { return fetch('/api/riders', { headers: this._headers() }).then(r => r.json()); },
  async getRider(phone) { return fetch('/api/riders/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async frozenCheck(phone) { return fetch('/api/riders/frozen-check/' + phone).then(r => r.json()); },
  async riderRanking() { return fetch('/api/riders/stats/ranking', { headers: this._headers() }).then(r => r.json()); },
  async riderReviews(phone) { return fetch('/api/riders/stats/reviews/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async updateRiderStatus(phone, status) { return fetch('/api/riders/' + phone, {
    method: 'PATCH', headers: this._headers(),
    body: JSON.stringify({ status })
  }).then(r => r.json()); },
  async updateRiderProfile(phone, data) { return fetch('/api/riders/' + phone, {
    method: 'PUT', headers: this._headers(),
    body: JSON.stringify(data)
  }).then(r => r.json()); },
  async uploadRiderAvatar(phone, file) {
    const fd = new FormData(); fd.append('avatar', file);
    const headers = this._authHeaders();
    return fetch('/api/riders/' + phone + '/avatar', {
      method: 'POST', headers, body: fd
    }).then(r => r.json());
  },

  // ─── 用户数据 ───
  async getUsers() { return fetch('/api/users', { headers: this._headers() }).then(r => r.json()); },
  async getUser(phone) { return fetch('/api/users/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async updateUser(phone, data) { return fetch('/api/users/' + phone, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },
  async uploadUserAvatar(phone, file) {
    const fd = new FormData(); fd.append('avatar', file);
    const headers = this._authHeaders();
    return fetch('/api/users/' + phone + '/avatar', {
      method: 'POST', headers, body: fd
    }).then(r => r.json());
  },

  // 上传用户封面图
  async uploadUserCover(phone, file) {
    const fd = new FormData(); fd.append('cover', file);
    const headers = this._authHeaders();
    return fetch('/api/users/' + phone + '/cover', {
      method: 'POST', headers, body: fd
    }).then(r => r.json());
  },

  // ─── 优惠券 ───
  async getCoupons() { return this._cachedFetch('coupons', '/api/coupons', 60000); },
  async claimCoupon(phone, coupon_id) {
    const res = await fetch('/api/coupons/claim', { method: 'POST', headers: this._headers(), body: JSON.stringify({ phone, coupon_id }) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._invalidateCache('coupons');
    return res;
  },
  async getMyCoupons(phone) { return fetch('/api/coupons/mine?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },

  // ─── 积分 ───
  async getPoints(phone) { return this._cachedFetch('points_' + phone, '/api/points/' + phone, 30000); },

  // ─── 地址管理 ───
  async getAddresses(phone) { return fetch('/api/addresses?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async addAddress(data) {
    const res = await fetch('/api/addresses', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async updateAddress(id, data) {
    const res = await fetch('/api/addresses/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async deleteAddress(id) {
    const res = await fetch('/api/addresses/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },

  // ─── 广告 ───
  async getAds() { return this._cachedFetch('ads', '/api/ads', 120000); },
  async getAdminAds() { return fetch('/api/ads/admin', { headers: this._headers() }).then(r => r.json()); },
  async addAd(data) {
    const res = await fetch('/api/ads/admin', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async updateAd(id, data) {
    const res = await fetch('/api/ads/admin/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async deleteAd(id) {
    const res = await fetch('/api/ads/admin/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  // 记录广告浏览（展示/点击）
  async adView(adId, eventType) {
    return fetch('/api/ads/' + adId + '/view', { method: 'POST', headers: this._headers(), body: JSON.stringify({ event_type: eventType }) }).then(r => r.json());
  },
  // 管理员：广告统计
  async adStats(startDate) {
    const qs = startDate ? '?start_date=' + startDate : '';
    return fetch('/api/ads/admin/stats' + qs, { headers: this._headers() }).then(r => r.json());
  },

  // ─── 通知 ───
  async getNotifications(phone) { return fetch('/api/notifications/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async markRead(phone, ids) { return fetch('/api/notifications/' + phone + '/read', {
    method: 'PATCH', headers: this._headers(),
    body: JSON.stringify({ ids: ids || [] })
  }).then(r => r.json()); },

  // ─── 统计 ───
  async getStats() { return fetch('/api/stats', { headers: this._headers() }).then(r => r.json()); },

  // ─── 服务 ───
  async getServices() { return fetch('/api/services', { headers: this._headers() }).then(r => r.json()); },

  // ─── 管理员管理 ───
  async getAdmins() { return fetch('/api/admins', { headers: this._headers() }).then(r => r.json()); },
  async addAdmin(username, password, role) { return fetch('/api/admins', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ username, password, role })
  }).then(r => r.json()); },
  async deleteAdmin(id) { return fetch('/api/admins/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async toggleAdmin(id, status) { return fetch('/api/admins/' + id, {
    method: 'PATCH', headers: this._headers(),
    body: JSON.stringify({ status })
  }).then(r => r.json()); },
  // 审计日志
  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetch('/api/audit?' + qs, { headers: this._headers() }).then(r => r.json());
  },
  async getAuditStats() { return fetch('/api/audit/stats', { headers: this._headers() }).then(r => r.json()); },

  // ─── 校园墙 ───
  async wallPost(data, files) {
    if (files && files.length) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      files.forEach(f => fd.append('files', f));
      const fdHeaders = this._authHeaders();
      return fetch('/api/wall/posts', { method: 'POST', headers: fdHeaders, body: fd }).then(r => r.json());
    }
    return fetch('/api/wall/posts', {
      method: 'POST', headers: this._headers(), body: JSON.stringify(data)
    }).then(r => r.json());
  },
  async wallFeed(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetch('/api/wall/feed' + (qs ? '?' + qs : ''), { headers: this._headers() }).then(r => r.json());
  },
  async wallPostDetail(id) { const phone = (JSON.parse(localStorage.getItem('lazy_session')||'{}')).phone || ''; return fetch('/api/wall/posts/' + id + (phone ? '?phone=' + encodeURIComponent(phone) : ''), { headers: this._headers() }).then(r => r.json()); },
  async wallSearch(q, phone) { return fetch('/api/wall/search?q=' + encodeURIComponent(q) + (phone ? '&phone=' + phone : ''), { headers: this._headers() }).then(r => r.json()); },
  async wallUsers(q) { return fetch('/api/wall/users?q=' + encodeURIComponent(q), { headers: this._headers() }).then(r => r.json()); },
  async wallTagsHot(limit) { return fetch('/api/wall/tags/hot' + (limit ? '?limit=' + limit : ''), { headers: this._headers() }).then(r => r.json()); },
  async wallLike(postId, phone) { return fetch('/api/wall/posts/' + postId + '/like', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ phone })
  }).then(r => r.json()); },
  async wallComment(postId, data) { return fetch('/api/wall/posts/' + postId + '/comments', {
    method: 'POST', headers: this._headers(), body: JSON.stringify(data)
  }).then(r => r.json()); },
  async wallFollow(follower_phone, following_phone) { return fetch('/api/wall/follow', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ follower_phone, following_phone })
  }).then(r => r.json()); },
  async wallUserProfile(phone) { return fetch('/api/wall/user/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async wallCommentLike(commentId, phone) { return fetch('/api/wall/comments/' + commentId + '/like', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ phone })
  }).then(r => r.json()); },
  async wallDeletePost(id) { return fetch('/api/wall/posts/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async wallEditPost(id, content) { return fetch('/api/wall/posts/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify({ content }) }).then(r => r.json()); },
  async wallSharePost(id) { return fetch('/api/wall/share/' + id, { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async wallBlockUser(blockedPhone) { return fetch('/api/wall/users/block', { method: 'POST', headers: this._headers(), body: JSON.stringify({ blockedPhone }) }).then(r => r.json()); },
  async wallUnblockUser(phone) { return fetch('/api/wall/users/block/' + phone, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async wallGetBlocks() { return fetch('/api/wall/users/blocks', { headers: this._headers() }).then(r => r.json()); },
  async wallFollowing(phone) { return fetch('/api/wall/following/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async wallFollowers(phone) { return fetch('/api/wall/followers/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async wallMyStats(phone) { return fetch('/api/wall/my-stats/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async wallMyViewers(phone) { return fetch('/api/wall/my-viewers/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async wallReport(targetType, targetId, reason, detail) { return fetch('/api/wall/report', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, detail: detail || '' })
  }).then(r => r.json()); },
  async marketReport(targetType, targetId, reason, detail) { return fetch('/api/market/report', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, detail: detail || '' })
  }).then(r => r.json()); },
  async petReport(targetType, targetId, reason, detail) { return fetch('/api/pets/report', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, detail: detail || '' })
  }).then(r => r.json()); },
  async teacherReport(targetType, targetId, reason, detail) { return fetch('/api/teachers/report', {
    method: 'POST', headers: this._headers(), body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, detail: detail || '' })
  }).then(r => r.json()); },

  // ─── 聊天 ───
  async chatGetOrCreateConversation(data) { return fetch('/api/chat/conversation', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },
  async chatConversations(phone) { return fetch('/api/chat/conversations?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async chatSend(data) { return fetch('/api/chat/send', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },
  async chatMessages(conversationId, phone, before) { let url = '/api/chat/messages/' + conversationId + '?phone=' + phone; if (before) url += '&before=' + before; return fetch(url, { headers: this._headers() }).then(r => r.json()); },
  async chatUnread(phone) { return fetch('/api/chat/unread?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async getChatUnread() { return fetch('/api/chat/unread', { headers: this._headers() }).then(r => r.json()); },

  // ─── 骑手钱包 ───
  async riderWallet(phone) { return fetch('/api/rider/wallet?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async riderWithdraw(phone, amount) { return fetch('/api/rider/withdraw', { method: 'POST', headers: this._headers(), body: JSON.stringify({phone, amount}) }).then(r => r.json()); },
  async riderWithdrawLogs(phone) { return fetch('/api/rider/withdraw/logs?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async riderEarnings(phone) { return fetch('/api/rider/earnings?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async adminWithdrawList() { const res = await fetch('/api/admin/withdraw', { headers: this._headers() }).then(r => r.json()); return Array.isArray(res) ? res : (res.error ? [] : res); },
  async adminWithdrawAction(id, status, reason) { return fetch('/api/admin/withdraw/' + id, { method: 'POST', headers: this._headers(), body: JSON.stringify({status, reason}) }).then(r => r.json()); },

  // ─── 聊天文件上传 ───
  async chatUpload(file) {
    const fd = new FormData(); fd.append('file', file);
    const h = this._authHeaders();
    const res = await fetch('/api/chat/upload', { method: 'POST', headers: h, body: fd });
    return res.json();
  },

  // ─── 校园墙私聊 ───
  async wallChat(from_phone, to_phone) {
    return fetch('/api/chat/wall-chat', { method: 'POST', headers: this._headers(), body: JSON.stringify({ from_phone, to_phone }) }).then(r => r.json());
  },
  async getChatPrivacy(phone) {
    return fetch('/api/chat/chat-privacy?phone=' + phone, { headers: this._headers() }).then(r => r.json());
  },
  async setChatPrivacy(phone, privacy) {
    return fetch('/api/chat/chat-privacy', { method: 'PUT', headers: this._headers(), body: JSON.stringify({ phone, privacy }) }).then(r => r.json());
  },


  // ─── 二手交易市场 ───
  async getMarketItems(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetch('/api/market/items' + (qs ? '?' + qs : ''), { headers: this._headers() }).then(r => r.json());
  },
  async getMarketItem(id) { return fetch('/api/market/items/' + id, { headers: this._headers() }).then(r => r.json()); },
  async getMarketCategories() { return fetch('/api/market/categories', { headers: this._headers() }).then(r => r.json()); },
  async createMarketItem(data, files) {
    if (files && files.length) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      files.forEach(f => fd.append('images', f));
      const h = this._authHeaders();
      return fetch('/api/market/items', { method: 'POST', headers: h, body: fd }).then(r => r.json());
    }
    return fetch('/api/market/items', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async updateMarketItem(id, data, files) {
    if (files && files.length) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      files.forEach(f => fd.append('images', f));
      const h = this._authHeaders();
      return fetch('/api/market/items/' + id, { method: 'PUT', headers: h, body: fd }).then(r => r.json());
    }
    return fetch('/api/market/items/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async deleteMarketItem(id) { return fetch('/api/market/items/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async marketItemChat(itemId) { return fetch('/api/market/items/' + itemId + '/chat', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async createMarketOrder(itemId) { return fetch('/api/market/orders', { method: 'POST', headers: this._headers(), body: JSON.stringify({ item_id: itemId }) }).then(r => r.json()); },
  async getMarketOrders(role) { return fetch('/api/market/orders' + (role ? '?role=' + role : ''), { headers: this._headers() }).then(r => r.json()); },
  async updateMarketOrder(id, action) { return fetch('/api/market/orders/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify({ action }) }).then(r => r.json()); },
  async reviewMarketOrder(id, rating, review) { return fetch('/api/market/orders/' + id + '/review', { method: 'POST', headers: this._headers(), body: JSON.stringify({ rating, review }) }).then(r => r.json()); },
  async getTrust(phone) { return fetch('/api/market/trust/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async getMyMarketItems() { return fetch('/api/market/my-items', { headers: this._headers() }).then(r => r.json()); },
  async getMarketComments(itemId) { return fetch('/api/market/items/' + itemId + '/comments', { headers: this._headers() }).then(r => r.json()); },
  async postMarketComment(itemId, content, parentId, mediaFile) {
    if (mediaFile) {
      const fd = new FormData();
      if (content) fd.append('content', content);
      if (parentId) fd.append('parent_id', parentId);
      fd.append('media', mediaFile);
      return fetch('/api/market/items/' + itemId + '/comments', { method: 'POST', headers: this._authHeaders(), body: fd }).then(r => r.json());
    }
    return fetch('/api/market/items/' + itemId + '/comments', { method: 'POST', headers: this._headers(), body: JSON.stringify({ content, parent_id: parentId || null }) }).then(r => r.json());
  },
  async deleteMarketComment(commentId) { return fetch('/api/market/comments/' + commentId, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },

  // ─── 卖家评价 ───
  async getSellerStats(phone) { return fetch('/api/market/sellers/' + encodeURIComponent(phone) + '/stats', { headers: this._headers() }).then(r => r.json()); },
  async getSellerRatings(phone, page = 1) { return fetch('/api/market/sellers/' + encodeURIComponent(phone) + '/ratings?page=' + page, { headers: this._headers() }).then(r => r.json()); },
  async rateSeller(phone, data) { return fetch('/api/market/sellers/' + encodeURIComponent(phone) + '/rate', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },

  // ─── 教师评价 ───
  async getTeacherColleges() { return fetch('/api/teachers/colleges', { headers: this._headers() }).then(r => r.json()); },
  async getTeachers(params = {}) {
    let url = '/api/teachers?';
    if (params.college) url += 'college=' + encodeURIComponent(params.college) + '&';
    if (params.search) url += 'search=' + encodeURIComponent(params.search) + '&';
    if (params.page) url += 'page=' + params.page + '&';
    if (params.limit) url += 'limit=' + params.limit + '&';
    return fetch(url, { headers: this._headers() }).then(r => r.json());
  },
  async getTeacherDetail(id) { return fetch('/api/teachers/' + id, { headers: this._headers() }).then(r => r.json()); },
  async likeTeacher(id) { return fetch('/api/teachers/' + id + '/like', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async reviewTeacher(id, rating, content, isAnonymous, mediaUrl) { return fetch('/api/teachers/' + id + '/review', { method: 'POST', headers: this._headers(), body: JSON.stringify({ rating, content, is_anonymous: isAnonymous || 0, media_url: mediaUrl || '' }) }).then(r => r.json()); },
  async getHotTeachers() { return fetch('/api/teachers/hot', { headers: this._headers() }).then(r => r.json()); },

  // ─── 猫狗日记 ───
  async getPets(params = {}) { const qs = new URLSearchParams(params).toString(); return fetch('/api/pets/list' + (qs ? '?' + qs : ''), { headers: this._headers() }).then(r => r.json()); },
  async getPetDetail(id) { return fetch('/api/pets/detail/' + id, { headers: this._headers() }).then(r => r.json()); },
  async likePet(id, phone) { return fetch('/api/pets/like/' + id, { method: 'POST', headers: { ...this._headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) }).then(r => r.json()); },
  async commentPet(id, data) { return fetch('/api/pets/comment/' + id, { method: 'POST', headers: this._authHeaders(), body: data }).then(r => r.json()); },
  async deletePetComment(commentId, phone) { return fetch('/api/pets/comment/' + commentId, { method: 'DELETE', headers: { ...this._headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) }).then(r => r.json()); },
  async sightPet(id, phone, location, note) { return fetch('/api/pets/sight/' + id, { method: 'POST', headers: { ...this._headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, location: location || '', note: note || '' }) }).then(r => r.json()); },
  async petAlertCheck() { return fetch('/api/pets/alert-check').then(r => r.json()); },
  async getPetSightings(id) { return fetch('/api/pets/sightings/' + id).then(r => r.json()); },
  async updatePetStatus(id, status) { return fetch('/api/pets/admin/status/' + id, { method: 'PUT', headers: { ...this._headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then(r => r.json()); },
  async getPendingSightings() { return fetch('/api/pets/admin/pending-sightings', { headers: this._headers() }).then(r => r.json()); },
  async reviewSighting(id, action) { return fetch('/api/pets/admin/review-sighting/' + id, { method: 'PUT', headers: { ...this._headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then(r => r.json()); },

  // ─── 会话恢复 ───
  restoreSession() {
    try {
      const s = JSON.parse(localStorage.getItem('lazy_session'));
      if (s) {
        this._role = s.role;
        const key = s.role === 'admin' ? 'lazy_admin_token' : s.role === 'rider' ? 'lazy_rider_token' : 'lazy_token';
        const t = localStorage.getItem(key);
        if (t) this._token = t;
        if (s.role === 'user') return { phone: s.phone, student_id: s.student_id, name: s.name, avatar: s.avatar || '' };
        if (s.role === 'rider') return { phone: s.phone, name: s.name, avatar: s.avatar || '' };
        if (s.role === 'admin') return { username: s.username };
      }
    } catch (e) {}
    return null;
  },

  logout() {
    this._user = null;
    this._rider = null;
    this._admin = null;
    this._token = null;
    localStorage.removeItem('lazy_token');
    localStorage.removeItem('lazy_rider_token');
    localStorage.removeItem('lazy_admin_token');
    localStorage.removeItem('lazy_session');
    localStorage.removeItem('lazyUser');
    localStorage.removeItem('lazyRider');
    localStorage.removeItem('lazyRiders');
    localStorage.removeItem('lazyOrders');
    localStorage.removeItem('lazyCoupons');
    localStorage.removeItem('lazyPoints');
    localStorage.removeItem('lazyAddrs');
    localStorage.removeItem('lazyNotifs');
  },

  // ─── 社团 ───
  async getClubs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetch('/api/clubs' + (qs ? '?' + qs : ''), { headers: this._headers() }).then(r => r.json());
  },
  async getClub(id) { return fetch('/api/clubs/' + id, { headers: this._headers() }).then(r => r.json()); },
  async createClub(data, file) {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      fd.append('logo', file);
      return fetch('/api/clubs', { method: 'POST', headers: this._authHeaders(), body: fd }).then(r => r.json());
    }
    return fetch('/api/clubs', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async joinClub(id, reason) { return fetch('/api/clubs/' + id + '/join', { method: 'POST', headers: this._headers(), body: JSON.stringify({ reason: reason || '' }) }).then(r => r.json()); },
  async leaveClub(id) { return fetch('/api/clubs/' + id + '/leave', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async updateClub(id, data, file) {
    if (file) {
      const fd = new FormData();
      Object.entries(data || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      fd.append('logo', file);
      return fetch('/api/clubs/' + id, { method: 'PUT', headers: this._authHeaders(), body: fd }).then(r => r.json());
    }
    return fetch('/api/clubs/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async getClubCategories() { return fetch('/api/clubs/meta/categories', { headers: this._headers() }).then(r => r.json()); },
  async getClubApplications(id, status) { return fetch('/api/clubs/' + id + '/applications' + (status ? '?status=' + status : ''), { headers: this._headers() }).then(r => r.json()); },
  async approveClubApplication(clubId, appId) { return fetch('/api/clubs/' + clubId + '/applications/' + appId + '/approve', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async rejectClubApplication(clubId, appId) { return fetch('/api/clubs/' + clubId + '/applications/' + appId + '/reject', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async kickClubMember(clubId, phone) { return fetch('/api/clubs/' + clubId + '/members/' + phone, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async updateMemberRole(clubId, phone, role) { return fetch('/api/clubs/' + clubId + '/members/' + phone + '/role', { method: 'PUT', headers: this._headers(), body: JSON.stringify({ role }) }).then(r => r.json()); },
  // 社团公告
  async getClubPosts(clubId) { return fetch('/api/clubs/' + clubId + '/posts', { headers: this._headers() }).then(r => r.json()); },
  async createClubPost(clubId, content, files) {
    if (files && files.length) {
      const fd = new FormData();
      fd.append('content', content);
      Array.from(files).forEach(f => fd.append('photos', f));
      return fetch('/api/clubs/' + clubId + '/posts', { method: 'POST', headers: this._authHeaders(), body: fd }).then(r => r.json());
    }
    return fetch('/api/clubs/' + clubId + '/posts', { method: 'POST', headers: this._headers(), body: JSON.stringify({ content }) }).then(r => r.json());
  },
  async deleteClubPost(clubId, postId) { return fetch('/api/clubs/' + clubId + '/posts/' + postId, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async pinClubPost(clubId, postId) { return fetch('/api/clubs/' + clubId + '/posts/' + postId + '/pin', { method: 'PUT', headers: this._headers() }).then(r => r.json()); },
  // 社团管理
  async getClubStats(clubId) { return fetch('/api/clubs/' + clubId + '/stats', { headers: this._headers() }).then(r => r.json()); },
  async getClubRanking(top = 10) { return fetch('/api/clubs/ranking?top=' + top).then(r => r.json()); },
  async transferClub(clubId, targetPhone) { return fetch('/api/clubs/' + clubId + '/transfer', { method: 'POST', headers: this._headers(), body: JSON.stringify({ target_phone: targetPhone }) }).then(r => r.json()); },
  async dissolveClub(clubId) { return fetch('/api/clubs/' + clubId, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },

  // ─── 活动 ───
  async getActivities(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetch('/api/activities' + (qs ? '?' + qs : ''), { headers: this._headers() }).then(r => r.json());
  },
  async getActivity(id) { return fetch('/api/activities/' + id, { headers: this._headers() }).then(r => r.json()); },
  async createActivity(data, file) {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      fd.append('cover', file);
      return fetch('/api/activities', { method: 'POST', headers: this._authHeaders(), body: fd }).then(r => r.json());
    }
    return fetch('/api/activities', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async signupActivity(id) { return fetch('/api/activities/' + id + '/signup', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async cancelActivitySignup(id) { return fetch('/api/activities/' + id + '/cancel-signup', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async checkinActivity(id) { return fetch('/api/activities/' + id + '/checkin', { method: 'POST', headers: this._headers() }).then(r => r.json()); },
  async getActivityParticipants(id) { return fetch('/api/activities/' + id + '/participants', { headers: this._headers() }).then(r => r.json()); },
  async updateActivity(id, data, file) {
    if (file) {
      const fd = new FormData();
      Object.entries(data || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      fd.append('cover', file);
      return fetch('/api/activities/' + id, { method: 'PUT', headers: this._authHeaders(), body: fd }).then(r => r.json());
    }
    return fetch('/api/activities/' + id, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async deleteActivity(id) { return fetch('/api/activities/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async getActivityCategories() { return fetch('/api/activities/meta/categories', { headers: this._headers() }).then(r => r.json()); }
};

// 全局暴露
window.API = API;

// 兼容旧的 localStorage 数据结构
window.lazyServices = {
  delivery: { name: '代取外卖', icon: '🍱', price: 2 },
  express: { name: '代取快递', icon: '📦', price: 2 },
  print: { name: '打印复印', icon: '🖨️', price: 1 },
  purchase: { name: '代买东西', icon: '🛒', price: 3 },
  laundry: { name: '代取洗衣', icon: '👕', price: 2 },
  errand: { name: '跑腿办事', icon: '🏃', price: 5 },
  other: { name: '其他服务', icon: '💡', price: 3 }
};

// 自动初始化：恢复token（确保在任何API调用前token已就绪）
API._init();

console.log('✅ API桥接层已加载，数据库模式');
