// core.js - 核心工具/全局/初始化

// ====== 全局状态 ======
var currentRider = null;
var riderStatusFilter = 'all';
var riderTimeFilter = 'all';
var riderDateFrom = null;
var riderDateTo = null;
var riderAllOrders = [];
var newOrders = [];
var myOrders = [];
var riderConvId = null;
var riderConvPhone = null;
var riderChatTimer = null;
var riderEmojiInited = false;
var frozenCheckInterval = null;
var isOnline = true;

 // ====== 工具函数 ======
 const $ = (id) => document.getElementById(id);

 const fmtTime = (ts) => {
   if (!ts) return '';
   const d = new Date(ts);
   if (isNaN(d.getTime())) return '';
   const now = new Date();
   const diff = now - d;
   if (diff < 0) return '刚刚';
   if (diff < 60000) return '刚刚';
   if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
   if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
   if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
   const m = ('0' + (d.getMonth() + 1)).slice(-2);
   const day = ('0' + d.getDate()).slice(-2);
   const h = ('0' + d.getHours()).slice(-2);
   const min = ('0' + d.getMinutes()).slice(-2);
   return m + '-' + day + ' ' + h + ':' + min;
 };

 const showToast = (msg, duration = 2500) => {
   const el = document.getElementById('toast');
   if (!el) return;
   el.textContent = msg;
   el.classList.add('show');
   setTimeout(() => el.classList.remove('show'), duration);
 };

 // ====== 子页面栈管理 ======
 let _pageStack = [];

 function openSubPage(id) {
   const el = document.getElementById(id);
   if (!el) return;
   _pageStack.push(id);
   el.classList.add('active');
 }

 function closeSubPage(id) {
   const el = document.getElementById(id);
   if (!el) return;
   el.classList.remove('active');
   _pageStack = _pageStack.filter(p => p !== id);
   if (_pageStack.length === 0) document.body.style.overflow = '';
 }

 function goBack() {
   if (_pageStack.length > 0) closeSubPage(_pageStack[_pageStack.length - 1]);
 }

 async function updateProfile() {
 if (!currentRider) return;
 try {
 const r = await API.getRider(currentRider.phone);
 currentRider = { ...r, phone: currentRider.phone };
 if (r.avatar) currentRider.avatar = r.avatar;
 localStorage.setItem('lazyRider', JSON.stringify(currentRider));
 // 更新头像显示
 const avatarLg = $('userAvatarLg');
 if (avatarLg) {
   if (currentRider.avatar) {
     avatarLg.innerHTML = '<img src="' + currentRider.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
   } else {
     avatarLg.textContent = '\u{1F6F5}';
   }
 }
 // 更新侧边栏小头像
 const sidebarAvatar = document.querySelector('.app-user .user-avatar');
 if (sidebarAvatar) {
   if (currentRider.avatar) {
     sidebarAvatar.innerHTML = '<img src="' + currentRider.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
   } else {
     sidebarAvatar.textContent = '\u{1F6F5}';
   }
 }
 // 更新顶部header名称
 const headerName = $('userName');
 if (headerName) headerName.textContent = currentRider.name || '骑手';
 $('userNameLg').textContent = currentRider.name || '骑手';
 $('userUidDisplay').textContent = currentRider.uid || '--';
 $('userPhoneDisplay').textContent = currentRider.phone ? currentRider.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '--';
 $('walletBalance').textContent = (r.total_earnings||0).toFixed(2);
 $('statTotalEarnings').textContent = '¥' + (r.total_earnings||0).toFixed(2);
 $('statTotalEarnings2').textContent = $('statTotalEarnings').textContent;
 $('statMyOrders').textContent = myOrders.length;
 $('statTotalOrders2').textContent = r.total_orders || 0;
 $('statRating2').textContent = (r.rating||5).toFixed(1);
 $('ratingValue').textContent = (r.rating||5).toFixed(1);
 const stars = Math.round(r.rating||5);
 let starsHtml = '';
 for (let i=0;i<5;i++) starsHtml += '<span class="star '+(i<stars?'active':'')+'">'+(i<stars?'★':'☆')+'</span>';
 $('ratingStars').innerHTML = starsHtml;
 const levels = { bronze:{name:'青铜骑手',icon:'🥉',next:20,nextName:'银骑手'}, silver:{name:'银骑手',icon:'🥈',next:50,nextName:'金骑手'}, gold:{name:'金骑手',icon:'🥇',next:100,nextName:'钻石骑手'}, diamond:{name:'钻石骑手',icon:'💎',next:Infinity,nextName:''} };
 const info = levels[r.level||'bronze'] || levels.bronze;
 const progress = Math.min((r.total_orders||0)/info.next*100, 100);
 $('levelBadge').innerHTML = '<div class="level-icon level-'+(r.level||'bronze')+'">'+info.icon+'</div><div class="level-info"><div class="level-name">'+escHtml(info.name)+'</div><div class="level-progress"><div class="level-progress-bar" style="width:'+progress+'%"></div></div><div class="level-next">'+(info.nextName?'再接'+(info.next-(r.total_orders||0))+'单升级'+info.nextName:'已达最高等级')+'</div></div>';
 } catch(e){ console.error(e); }
 }

 function riderSwitchTab(tab, evt) {
   document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
   if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
   // 隐藏所有主区域
   $('orderSection').style.display = 'none';
   $('profileSection').classList.remove('active');
   $('msgSection').style.display = 'none';
   const chatSub = document.getElementById('chatConvPage_sub');
   if (chatSub) chatSub.classList.remove('active');

   if (tab === 'home') {
     $('orderSection').style.display = 'block';
     refreshOrders();
   } else if (tab === 'msg') {
     $('msgSection').style.display = 'block';
     loadChatList();
   } else if (tab === 'profile') {
     $('profileSection').classList.add('active');
     updateProfile();
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }
 }

function timeAgo(ts) { if (!ts) return ''; const diff=Date.now()-new Date(ts).getTime(); if(diff<60000) return '刚刚'; if(diff<3600000) return Math.floor(diff/60000)+'分钟前'; if(diff<86400000) return Math.floor(diff/3600000)+'小时前'; if(diff<604800000) return Math.floor(diff/86400000)+'天前'; return ts.slice(0,10); }

 function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function safeOrder(o) {
    return Object.fromEntries(Object.entries(o).map(([k,v]) => [k, typeof v === 'string' ? escHtml(v) : v]));
  }

 function riderToggleDark(on) {
   if (on) { document.body.classList.add('dark'); } else { document.body.classList.remove('dark'); }
   localStorage.setItem('lazyTheme', on ? 'dark' : 'light');
   closeSubPage('settingsPage_sub');
 }

 function logout() { API.logout(); location.reload(); }

 async function login(e) {
   e.preventDefault();
   const uid = $('loginUid').value.trim();
   const studentId = $('loginStudentId').value.trim();
   const phone = $('loginPhone').value.trim();
   if (!/^1[3-9]\d{9}$/.test(phone)) {
     $('loginPhoneError').style.display = 'block';
     return;
   }
   $('loginPhoneError').style.display = 'none';
   try {
     const rider = await API.riderLogin(uid, studentId, phone);
     currentRider = { ...rider, phone };
     localStorage.setItem('lazyRider', JSON.stringify(currentRider));
     closeSubPage('loginPage_sub');
     showToast('登录成功！🛵');
     await refreshOrders();
     updateProfile();
     startFrozenCheck(); // 启动冻结状态轮询
   } catch (err) {
     showToast(err.message || '登录失败');
   }
 }

 function toggleOnlineStatus() {
   isOnline = !isOnline;
   const sw = $('statusSwitch');
   if (sw) {
     sw.classList.toggle('online', isOnline);
     sw.classList.toggle('offline', !isOnline);
   }
   showToast(isOnline ? '已上线，可接单' : '已下线，暂停接单');
   if (currentRider) {
     API.updateRiderStatus(currentRider.phone, isOnline ? 'online' : 'offline').catch(() => {});
   }
 }

// Exports
window.openSubPage = openSubPage;
window.closeSubPage = closeSubPage;
window.goBack = goBack;
window.updateProfile = updateProfile;
window.riderSwitchTab = riderSwitchTab;
window.timeAgo = timeAgo;
window.escHtml = escHtml;
window.safeOrder = safeOrder;
window.riderToggleDark = riderToggleDark;
window.logout = logout;
window.login = login;
window.toggleOnlineStatus = toggleOnlineStatus;


// ─── 页面初始化（由 rider.html 底部内联脚本调用，确保所有模块已加载） ───
