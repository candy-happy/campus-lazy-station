// 校园懒人效率站 - 前端API桥接层
// 所有前端页面引入此文件后，自动从localStorage模式切换为数据库模式

const API = {
  _user: null,
  _rider: null,
  _admin: null,
  _role: 'user', // 'user' | 'rider' | 'admin'

  // ─── 用户 ───
  async userLogin(name, phone) {
    const res = await fetch('/api/user/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._user = { ...res.user, phone_original: phone };
    this._role = 'user';
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'user', phone, name }));
    return this._user;
  },

  // ─── 骑手 ───
  async riderLogin(uid, name, student_id, phone) {
    const res = await fetch('/api/rider/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, name, student_id, phone })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._rider = { ...res.rider, phone_original: phone };
    this._role = 'rider';
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'rider', phone, name, uid }));
    return this._rider;
  },

  // ─── 管理员 ───
  async adminLogin(username, password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    this._admin = res.admin;
    this._role = 'admin';
    localStorage.setItem('lazy_session', JSON.stringify({ role: 'admin', username }));
    return this._admin;
  },

  // ─── 订单 ───
  async getOrders(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return fetch('/api/orders' + (params ? '?' + params : '')).then(r => r.json());
  },
  async getOrder(id) { return fetch('/api/orders/' + id).then(r => r.json()); },
  async createOrder(data) { return fetch('/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()); },
  async acceptOrder(id, rider_phone, rider_name) { return fetch('/api/orders/' + id + '/accept', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rider_phone, rider_name })
  }).then(r => r.json()); },
  async startDelivery(id) { return fetch('/api/orders/' + id + '/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }).then(r => r.json()); },
  async completeOrder(id) { return fetch('/api/orders/' + id + '/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }).then(r => r.json()); },
  async cancelOrder(id, reason) { return fetch('/api/orders/' + id + '/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  }).then(r => r.json()); },
  async rateOrder(id, stars, comment, phone) { return fetch('/api/orders/' + id + '/rate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stars, comment, phone })
  }).then(r => r.json()); },

  // ─── 骑手数据 ───
  async getRiders() { return fetch('/api/riders').then(r => r.json()); },
  async getRider(phone) { return fetch('/api/riders/' + phone).then(r => r.json()); },
  async updateRiderStatus(phone, status) { return fetch('/api/riders/' + phone, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(r => r.json()); },

  // ─── 用户数据 ───
  async getUsers() { return fetch('/api/users').then(r => r.json()); },
  async getUser(phone) { return fetch('/api/users/' + phone).then(r => r.json()); },
  async updateUser(phone, data) { return fetch('/api/users/' + phone, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()); },

  // ─── 优惠券 ───
  async getCoupons() { return fetch('/api/coupons').then(r => r.json()); },
  async claimCoupon(phone, coupon_id) {
    const res = await fetch('/api/coupons/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, coupon_id }) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async getMyCoupons(phone) { return fetch('/api/coupons/mine?phone=' + phone).then(r => r.json()); },

  // ─── 积分 ───
  async getPoints(phone) { return fetch('/api/points/' + phone).then(r => r.json()); },

  // ─── 地址管理 ───
  async getAddresses(phone) { return fetch('/api/addresses?phone=' + phone).then(r => r.json()); },
  async addAddress(data) {
    const res = await fetch('/api/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async updateAddress(id, data) {
    const res = await fetch('/api/addresses/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async deleteAddress(id) {
    const res = await fetch('/api/addresses/' + id, { method: 'DELETE' }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },

  // ─── 广告 ───
  async getAds() { return fetch('/api/ads').then(r => r.json()); },
  async getAdminAds() { return fetch('/api/admin/ads').then(r => r.json()); },
  async addAd(data) {
    const res = await fetch('/api/admin/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async updateAd(id, data) {
    const res = await fetch('/api/admin/ads/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },
  async deleteAd(id) {
    const res = await fetch('/api/admin/ads/' + id, { method: 'DELETE' }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    return res;
  },

  // ─── 通知 ───
  async getNotifications(phone) { return fetch('/api/notifications/' + phone).then(r => r.json()); },
  async markRead(phone, ids) { return fetch('/api/notifications/' + phone + '/read', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ids || [] })
  }).then(r => r.json()); },

  // ─── 统计 ───
  async getStats() { return fetch('/api/stats').then(r => r.json()); },

  // ─── 服务 ───
  async getServices() { return fetch('/api/services').then(r => r.json()); },

  // ─── 管理员管理 ───
  async getAdmins() { return fetch('/api/admins').then(r => r.json()); },
  async addAdmin(username, password, role) { return fetch('/api/admins', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  }).then(r => r.json()); },
  async deleteAdmin(id) { return fetch('/api/admins/' + id, { method: 'DELETE' }).then(r => r.json()); },
  async toggleAdmin(id, status) { return fetch('/api/admins/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(r => r.json()); },

  // ─── 校园墙 ───
  async wallPost(data) { return fetch('/api/wall/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()); },
  async wallFeed(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetch('/api/wall/feed' + (qs ? '?' + qs : '')).then(r => r.json());
  },
  async wallPostDetail(id) { return fetch('/api/wall/posts/' + id).then(r => r.json()); },
  async wallLike(postId, phone) { return fetch('/api/wall/posts/' + postId + '/like', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone })
  }).then(r => r.json()); },
  async wallComment(postId, data) { return fetch('/api/wall/posts/' + postId + '/comments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()); },
  async wallFollow(follower_phone, following_phone) { return fetch('/api/wall/follow', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ follower_phone, following_phone })
  }).then(r => r.json()); },
  async wallUserProfile(phone) { return fetch('/api/wall/user/' + phone).then(r => r.json()); },
  async wallDeletePost(id) { return fetch('/api/wall/posts/' + id, { method: 'DELETE' }).then(r => r.json()); },

  // ─── 聊天 ───
  async chatGetOrCreateConversation(data) { return fetch('/api/chat/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()); },
  async chatConversations(phone) { return fetch('/api/chat/conversations?phone=' + phone).then(r => r.json()); },
  async chatSend(data) { return fetch('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()); },
  async chatMessages(conversationId, phone, before) { let url = '/api/chat/messages/' + conversationId + '?phone=' + phone; if (before) url += '&before=' + before; return fetch(url).then(r => r.json()); },
  async chatUnread(phone) { return fetch('/api/chat/unread?phone=' + phone).then(r => r.json()); },

  // ─── 骑手钱包 ───
  async riderWallet(phone) { return fetch('/api/rider/wallet?phone=' + phone).then(r => r.json()); },
  async riderWithdraw(phone, amount) { return fetch('/api/rider/withdraw', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone, amount}) }).then(r => r.json()); },
  async riderWithdrawLogs(phone) { return fetch('/api/rider/withdraw/logs?phone=' + phone).then(r => r.json()); },
  async riderEarnings(phone) { return fetch('/api/rider/earnings?phone=' + phone).then(r => r.json()); },
  async adminWithdrawList() { return fetch('/api/admin/withdraw').then(r => r.json()); },
  async adminWithdrawAction(id, status, reason) { return fetch('/api/admin/withdraw/' + id, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status, reason}) }).then(r => r.json()); },


  // ─── 会话恢复 ───
  restoreSession() {
    try {
      const s = JSON.parse(localStorage.getItem('lazy_session'));
      if (s) {
        this._role = s.role;
        if (s.role === 'user') return { phone: s.phone, name: s.name };
        if (s.role === 'rider') return { phone: s.phone, name: s.name };
        if (s.role === 'admin') return { username: s.username };
      }
    } catch (e) {}
    return null;
  },

  logout() {
    this._user = null;
    this._rider = null;
    this._admin = null;
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
