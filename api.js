// 校园懒人效率站 - 前端API桥接层
// 所有前端页面引入此文件后，自动从localStorage模式切换为数据库模式

const API = {
  _user: null,
  _rider: null,
  _admin: null,
  _role: 'user', // 'user' | 'rider' | 'admin'
  _token: null,
  _headers() { const h = { 'Content-Type': 'application/json' }; if (this._token) h['Authorization'] = 'Bearer ' + this._token; return h; },

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
  async userLogin(name, phone) {
    const res = await fetch('/api/user/login', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ name, phone })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._user = { ...res.user, phone_original: phone };
    this._role = 'user';
    if (res.token) { this._token = res.token; localStorage.setItem('lazy_token', res.token); }
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'user', phone, name, avatar: res.user?.avatar || '' }));
    return this._user;
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
  async adminLogin(username, password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ username, password })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._admin = res.admin;
    this._role = 'admin';
    if (res.token) { this._token = res.token; localStorage.setItem('lazy_admin_token', res.token); }
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'admin', username }));
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
  async rateOrder(id, stars, comment, phone) { return fetch('/api/orders/' + id + '/rate', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ stars, comment, phone })
  }).then(r => r.json()); },

  // ─── 骑手数据 ───
  async getRiders() { return fetch('/api/riders', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
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
    const headers = {};
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;
    return fetch('/api/riders/' + phone + '/avatar', {
      method: 'POST', headers, body: fd
    }).then(r => r.json());
  },

  // ─── 用户数据 ───
  async getUsers() { return fetch('/api/users', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
  async getUser(phone) { return fetch('/api/users/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async updateUser(phone, data) { return fetch('/api/users/' + phone, { method: 'PUT', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },
  async uploadUserAvatar(phone, file) {
    const fd = new FormData(); fd.append('avatar', file);
    const headers = {};
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;
    return fetch('/api/users/' + phone + '/avatar', {
      method: 'POST', headers, body: fd
    }).then(r => r.json());
  },

  // ─── 优惠券 ───
  async getCoupons() { return fetch('/api/coupons', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
  async claimCoupon(phone, coupon_id) {
    const res = await fetch('/api/coupons/claim', { method: 'POST', headers: this._headers(), body: JSON.stringify({ phone, coupon_id }) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async getMyCoupons(phone) { return fetch('/api/coupons/mine?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },

  // ─── 积分 ───
  async getPoints(phone) { return fetch('/api/points/' + phone, { headers: this._headers() }).then(r => r.json()); },

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
  async getAds() { return fetch('/api/ads', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
  async getAdminAds() { return fetch('/api/ads/admin', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
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
    return fetch('/api/ads/admin/stats' + qs, { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json());
  },

  // ─── 通知 ───
  async getNotifications(phone) { return fetch('/api/notifications/' + phone, { headers: this._headers() }).then(r => r.json()); },
  async markRead(phone, ids) { return fetch('/api/notifications/' + phone + '/read', {
    method: 'PATCH', headers: this._headers(),
    body: JSON.stringify({ ids: ids || [] })
  }).then(r => r.json()); },

  // ─── 统计 ───
  async getStats() { return fetch('/api/stats', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },

  // ─── 服务 ───
  async getServices() { return fetch('/api/services', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },

  // ─── 管理员管理 ───
  async getAdmins() { return fetch('/api/admins', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
  async addAdmin(username, password, role) { return fetch('/api/admins', {
    method: 'POST', headers: this._headers(),
    body: JSON.stringify({ username, password, role })
  }).then(r => r.json()); },
  async deleteAdmin(id) { return fetch('/api/admins/' + id, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },
  async toggleAdmin(id, status) { return fetch('/api/admins/' + id, {
    method: 'PATCH', headers: this._headers(),
    body: JSON.stringify({ status })
  }).then(r => r.json()); },

  // ─── 校园墙 ───
  async wallPost(data, files) {
    if (files && files.length) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      files.forEach(f => fd.append('files', f));
      const fdHeaders = {}; if (this._token) fdHeaders['Authorization'] = 'Bearer ' + this._token;
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
  async wallPostDetail(id) { return fetch('/api/wall/posts/' + id, { headers: this._headers() }).then(r => r.json()); },
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

  // ─── 聊天 ───
  async chatGetOrCreateConversation(data) { return fetch('/api/chat/conversation', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },
  async chatConversations(phone) { return fetch('/api/chat/conversations?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async chatSend(data) { return fetch('/api/chat/send', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json()); },
  async chatMessages(conversationId, phone, before) { let url = '/api/chat/messages/' + conversationId + '?phone=' + phone; if (before) url += '&before=' + before; return fetch(url, { headers: this._headers() }).then(r => r.json()); },
  async chatUnread(phone) { return fetch('/api/chat/unread?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },

  // ─── 骑手钱包 ───
  async riderWallet(phone) { return fetch('/api/rider/wallet?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async riderWithdraw(phone, amount) { return fetch('/api/rider/withdraw', { method: 'POST', headers: this._headers(), body: JSON.stringify({phone, amount}) }).then(r => r.json()); },
  async riderWithdrawLogs(phone) { return fetch('/api/rider/withdraw/logs?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async riderEarnings(phone) { return fetch('/api/rider/earnings?phone=' + phone, { headers: this._headers() }).then(r => r.json()); },
  async adminWithdrawList() { return fetch('/api/admin/withdraw', { headers: this._token ? { Authorization: 'Bearer ' + this._token } : {} }).then(r => r.json()); },
  async adminWithdrawAction(id, status, reason) { return fetch('/api/admin/withdraw/' + id, { method: 'POST', headers: this._headers(), body: JSON.stringify({status, reason}) }).then(r => r.json()); },

  // ─── 聊天文件上传 ───
  async chatUpload(file) {
    const fd = new FormData(); fd.append('file', file);
    const h = {}; if (this._token) h['Authorization'] = 'Bearer ' + this._token;
    const res = await fetch('/api/chat/upload', { method: 'POST', headers: h, body: fd });
    return res.json();
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
      const h = {}; if (this._token) h['Authorization'] = 'Bearer ' + this._token;
      return fetch('/api/market/items', { method: 'POST', headers: h, body: fd }).then(r => r.json());
    }
    return fetch('/api/market/items', { method: 'POST', headers: this._headers(), body: JSON.stringify(data) }).then(r => r.json());
  },
  async updateMarketItem(id, data, files) {
    if (files && files.length) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      files.forEach(f => fd.append('images', f));
      const h = {}; if (this._token) h['Authorization'] = 'Bearer ' + this._token;
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
      return fetch('/api/market/items/' + itemId + '/comments', { method: 'POST', headers: { 'Authorization': 'Bearer ' + (this._token || '') }, body: fd }).then(r => r.json());
    }
    return fetch('/api/market/items/' + itemId + '/comments', { method: 'POST', headers: this._headers(), body: JSON.stringify({ content, parent_id: parentId || null }) }).then(r => r.json());
  },
  async deleteMarketComment(commentId) { return fetch('/api/market/comments/' + commentId, { method: 'DELETE', headers: this._headers() }).then(r => r.json()); },

  // ─── 会话恢复 ───
  restoreSession() {
    try {
      const s = JSON.parse(localStorage.getItem('lazy_session'));
      if (s) {
        this._role = s.role;
        const key = s.role === 'admin' ? 'lazy_admin_token' : s.role === 'rider' ? 'lazy_rider_token' : 'lazy_token';
        const t = localStorage.getItem(key);
        if (t) this._token = t;
        if (s.role === 'user') return { phone: s.phone, name: s.name, avatar: s.avatar || '' };
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
  }
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
console.log('✅ API桥接层已加载，数据库模式');
