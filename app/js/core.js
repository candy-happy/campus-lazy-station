// core.js - 核心工具/全局/初始化
// 包含: 全局变量、i18n、工具函数、页面切换、子页面、初始化
// 新功能请添加为独立JS模块，不要在此骨架文件中添加代码


    // ═══════════════════════════════════════════════════════
    // 🌐 国际化 i18n
    // ═══════════════════════════════════════════════════════
    const I18N = {
      zh: {
        appName: '懒人效率站',
        campusEdition: '校园版',
        searchPlaceholder: '搜索服务、订单...',
        serviceDelivery: '代取外卖',
        serviceExpress: '代取快递',
        serviceTeacher: '师说',
        servicePurchase: '代买东西',
        serviceLaundry: '代取洗衣',
        serviceErrand: '跑腿办事',
        serviceOther: '其他服务',
        serviceMore: '更多服务',
        coupons: '优惠券',
        viewCoupons: '查看可用优惠',
        myPoints: '我的积分',
        pointsDesc: '积分可抵现金',
        navHome: '首页',
        navWall: '校园墙',
        navOrders: '订单',
        navMe: '我的',
        menuTrades: '我的交易',
        menuListings: '我的在售',
        menuMessages: '我的消息',
        menuAddresses: '常用地址',
        menuMyCoupons: '我的优惠券',
        menuPointsDetail: '积分明细',
        menuSettings: '设置',
        meFollowers: '粉丝',
        meFollowing: '关注',
        meWallLikes: '获赞',
        meViews: '浏览',
        myViewers: '浏览者',
        myLikes: '获赞详情',
        noViewers: '暂无浏览者',
        noPosts: '暂无帖子',
        settingsTitle: '⚙️ 设置',
        settingsAppearance: '外观',
        darkMode: '🌙 深色模式',
        settingsAccount: '账户',
        phoneLabel: '📱 手机号',
        languageLabel: '🌐 语言',
        langZh: '中文',
        langEn: 'English',
        logoutBtn: '退出登录',
        logoutConfirm: '确定退出登录？',
        versionText: '校园懒人效率站 v3.0',
        moreServiceSoon: '更多服务开发中...',
        loginFirst: '请先登录',
        // ─── 订单页 ───
        orderPageTitle: '我的订单',
        orderTabAll: '全部',
        orderTabPending: '待接单',
        orderTabRunning: '进行中',
        orderTabCompleted: '已完成',
        orderTabCancelled: '已取消',
        timeAll: '全部时间',
        timeToday: '今天',
        timeWeek: '近7天',
        timeMonth: '近30天',
        timeCustom: '📅 自定义',
        timeTo: '至',
        orderStatusPending: '待接单',
        orderStatusAccepted: '已接单',
        orderStatusRunning: '配送中',
        orderStatusCompleted: '已完成',
        orderStatusCancelled: '已取消',
        orderTypeDelivery: '代取外卖',
        orderTypeExpress: '代取快递',
        orderTypePurchase: '代买东西',
        orderTypeLaundry: '代取洗衣',
        orderTypeErrand: '跑腿办事',
        orderTypeOther: '其他服务',
        orderFee: '订单费用',
        orderDeliveryInfo: '📍 配送信息',
        orderPickup: '取件',
        orderDeliverTo: '送达',
        orderNote: '📝 订单备注',
        orderNoNote: '无备注',
        orderRiderInfo: '🚴 骑手信息',
        orderTimeInfo: '🕐 时间信息',
        orderTimeCreated: '下单时间',
        orderTimeAccepted: '接单时间',
        orderTimeCompleted: '完成时间',
        orderRating: '⭐ 订单评价',
        orderNotFilled: '未填写',
        orderDetail: '📋 订单详情',
        tipLabel: '🪙 加小费（骑手优先接单）',
        tipNone: '无小费',
        contactRider: '联系骑手',
        rateOrder: '⭐ 评价订单',
        cancelOrder: '取消订单',
        requestCancel: '申请取消',
        cancelPending: '取消审核中',
        cancelRejected: '取消被拒绝',
        reapply: '重新申请',
        requestRefund: '申请退款',
        refundPending: '退款审核中',
        refundFull: '✅ 全额退款 ¥',
        refundPartial: '✅ 部分退款 ¥',
        refundRejected: '退款被拒绝',
        cancelConfirm: '确认取消订单？',
        orderCancelled: '订单已取消',
        cancelApplied: '取消申请已提交',
        cancelReasonPrompt: '请输入取消原因',
        cancelAppliedWaiting: '取消申请审核中，请等待',
        refundReasonPrompt: '请输入退款原因',
        refundApplied: '退款申请已提交',
        cancelFailed: '取消失败',
        applyFailed: '申请失败',
        // ─── 下单子页面 ───
        serviceDescDelivery: '骑手代取，送达宿舍',
        serviceDescExpress: '快递代取，送货上门',
        serviceDescPurchase: '代购生活用品、药品等',
        serviceDescLaundry: '取送洗衣，方便省心',
        serviceDescErrand: '万能跑腿，随叫随到',
        serviceDescOther: '其他个性化需求',
        pickupLocation: '📦 取货地点',
        deliveryLocation: '🏠 送达地点',
        orderDetails: '📝 详细说明',
        contactPhone: '📱 联系电话',
        yourPhone: '您的手机号',
        estimatedFee: '预估费用',
        submitOrder: '🚀 提交订单',
        selectAddress: '💡 点击选择常用地址',
        noTip: '无小费',
        // ─── 评价弹窗 ───
        rateVeryBad: '很差',
        rateBad: '不太好',
        rateOk: '一般',
        rateGood: '满意',
        rateExcellent: '非常满意',
        rateFast: '配送很快',
        rateFriendly: '态度友好',
        rateIntact: '物品完好',
        rateOnTime: '准时送达',
        rateSmooth: '沟通顺畅',
        rateCareful: '包装用心',
        submitReview: '提交评价',
        reviewSuccess: '✅ 评价提交成功！',
        reviewFailed: '评价失败',
        reviewContentRequired: '请输入评价内容',
        reviewStarRequired: '请给1-5星评分',
        // ─── 师说页 ───
        teacherPageTitle: '📖 师说',
        teacherHeroText: '师者，传道授业解惑',
        teacherHeroSub: '1062位教师 · 11个学院 · 真实评价',
        teacherSearchPlaceholder: '搜索教师姓名、学院、研究方向...',
        teacherSearchBtn: '搜索',
        teacherLoadMore: '📄 加载更多',
        teacherNoData: '👨‍🏫</div>暂无教师数据',
        teacherDetail: '教师详情',
        teacherLikes: '点赞',
        teacherReviews: '评价',
        teacherRating: '评分',
        teacherEdu: '学历背景',
        teacherUndergrad: '本科院校',
        teacherGrad: '研究生院校',
        teacherResearch: '研究方向',
        teacherCourses: '授课课程',
        teacherPapers: '代表论文',
        teacherProjects: '科研项目',
        teacherSocialRoles: '社会兼职',
        teacherAchievements: '主要成就',
        teacherBio: '个人简介',
        teacherNoDetail: '暂无详细信息',
        teacherLike: '点赞',
        teacherLiked: '已点赞',
        teacherWriteReview: '写评价',
        teacherReviewed: '已评价',
        teacherLikeToday: '今日已点赞',
        teacherLikeTip: '每位老师每天可点赞一次',
        teacherReviewToday: '今日已评价',
        teacherReviewList: '💬 评价列表',
        teacherNoReview: '暂无评价',
        teacherReviewRating: '评分',
        teacherReviewAnonymous: '🕵 匿名',
        teacherReviewPublic: '公开',
        teacherReviewDisplayMethod: '评价显示方式',
        teacherReviewAnonHint: '匿名评价仅管理员可见真实身份',
        teacherReviewContent: '评价内容',
        teacherReviewPlaceholder: '请输入您的评价...',
        teacherReviewEmoji: '😊 表情',
        teacherReviewMedia: '📷 添加图片/视频',
        teacherReviewSubmit: '提交评价',
        teacherReviewSuccess: '评价提交成功！',
        teacherLikeFailed: '点赞失败',
        teacherNotFound: '未找到该教师',
        teacherLoadFailed: '加载失败',
        teacherDr: '博士',
        teacherMs: '硕士',
        loadFailed: '加载失败',
        noOrders: '暂无订单',
      },
      en: {
        appName: 'Lazy Station',
        campusEdition: 'Campus',
        searchPlaceholder: 'Search services, orders...',
        serviceDelivery: 'Food Pickup',
        serviceExpress: 'Parcel Pickup',
        serviceTeacher: 'Teachers',
        servicePurchase: 'Shopping',
        serviceLaundry: 'Laundry',
        serviceErrand: 'Errands',
        serviceOther: 'Other',
        serviceMore: 'More',
        coupons: 'Coupons',
        viewCoupons: 'View available',
        myPoints: 'My Points',
        pointsDesc: 'Points as cash',
        navHome: 'Home',
        navWall: 'Wall',
        navOrders: 'Orders',
        navMe: 'Me',
        menuTrades: 'My Trades',
        menuListings: 'My Listings',
        menuMessages: 'Messages',
        menuAddresses: 'Addresses',
        menuMyCoupons: 'My Coupons',
        menuPointsDetail: 'Points',
        menuSettings: 'Settings',
        meFollowers: 'Followers',
        meFollowing: 'Following',
        meWallLikes: 'Likes',
        meViews: 'Views',
        myViewers: 'Viewers',
        myLikes: 'Likes Detail',
        noViewers: 'No viewers yet',
        noPosts: 'No posts yet',
        settingsTitle: '⚙️ Settings',
        settingsAppearance: 'Appearance',
        darkMode: '🌙 Dark Mode',
        settingsAccount: 'Account',
        phoneLabel: '📱 Phone',
        languageLabel: '🌐 Language',
        langZh: '中文',
        langEn: 'English',
        logoutBtn: 'Log Out',
        logoutConfirm: 'Are you sure you want to log out?',
        versionText: 'Campus Lazy Station v3.0',
        moreServiceSoon: 'More services coming soon...',
        loginFirst: 'Please log in first',
        // ─── Order Page ───
        orderPageTitle: 'My Orders',
        orderTabAll: 'All',
        orderTabPending: 'Pending',
        orderTabRunning: 'In Progress',
        orderTabCompleted: 'Completed',
        orderTabCancelled: 'Cancelled',
        timeAll: 'All Time',
        timeToday: 'Today',
        timeWeek: 'Last 7 Days',
        timeMonth: 'Last 30 Days',
        timeCustom: '📅 Custom',
        timeTo: 'to',
        orderStatusPending: 'Pending',
        orderStatusAccepted: 'Accepted',
        orderStatusRunning: 'Delivering',
        orderStatusCompleted: 'Completed',
        orderStatusCancelled: 'Cancelled',
        orderTypeDelivery: 'Food Pickup',
        orderTypeExpress: 'Parcel Pickup',
        orderTypePurchase: 'Shopping',
        orderTypeLaundry: 'Laundry',
        orderTypeErrand: 'Errands',
        orderTypeOther: 'Other',
        orderFee: 'Order Fee',
        orderDeliveryInfo: '📍 Delivery Info',
        orderPickup: 'Pickup',
        orderDeliverTo: 'Deliver to',
        orderNote: '📝 Order Note',
        orderNoNote: 'No notes',
        orderRiderInfo: '🚴 Rider Info',
        orderTimeInfo: '🕐 Time Info',
        orderTimeCreated: 'Created',
        orderTimeAccepted: 'Accepted',
        orderTimeCompleted: 'Completed',
        orderRating: '⭐ Order Review',
        orderNotFilled: 'Not filled',
        orderDetail: '📋 Order Details',
        tipLabel: '🪙 Add Tip (Priority Pickup)',
        tipNone: 'No Tip',
        contactRider: '💬 Contact Rider',
        rateOrder: '⭐ Rate Order',
        cancelOrder: '❌ Cancel Order',
        requestCancel: '🚫 Request Cancel',
        cancelPending: '⏳ Cancel request under review...',
        cancelRejected: '❌ Cancel request rejected',
        reapply: '🔄 Reapply',
        requestRefund: '💰 Request Refund',
        refundPending: '⏳ Refund request under review...',
        refundFull: '✅ Full refund ¥',
        refundPartial: '✅ Partial refund ¥',
        refundRejected: '❌ Refund request rejected',
        cancelConfirm: 'Are you sure to cancel this order?',
        orderCancelled: 'Order cancelled',
        cancelApplied: 'Cancel request submitted',
        cancelReasonPrompt: 'Please enter cancel reason:',
        cancelAppliedWaiting: 'Cancel request submitted, waiting for review',
        refundReasonPrompt: 'Please enter refund reason:',
        refundApplied: 'Refund request submitted, waiting for admin review',
        cancelFailed: 'Cancel failed',
        applyFailed: 'Request failed',
        // ─── Order Form ───
        serviceDescDelivery: 'Rider pickup, dorm delivery',
        serviceDescExpress: 'Parcel pickup, door delivery',
        serviceDescPurchase: 'Buy daily supplies, medicine, etc.',
        serviceDescLaundry: 'Laundry pickup & delivery',
        serviceDescErrand: 'Any errand, anytime',
        serviceDescOther: 'Other personalized needs',
        pickupLocation: '📦 Pickup Location',
        deliveryLocation: '🏠 Delivery Location',
        orderDetails: '📝 Details',
        contactPhone: '📱 Contact Phone',
        yourPhone: 'Your phone number',
        estimatedFee: 'Estimated Fee',
        submitOrder: '🚀 Submit Order',
        selectAddress: '💡 Tap to select saved address',
        noTip: 'No Tip',
        // ─── Rating Modal ───
        rateVeryBad: 'Terrible',
        rateBad: 'Bad',
        rateOk: 'OK',
        rateGood: 'Good',
        rateExcellent: 'Excellent',
        rateFast: 'Fast delivery',
        rateFriendly: 'Friendly',
        rateIntact: 'Item intact',
        rateOnTime: 'On time',
        rateSmooth: 'Smooth communication',
        rateCareful: 'Careful packaging',
        submitReview: 'Submit Review',
        reviewSuccess: '✅ Review submitted!',
        reviewFailed: 'Review failed',
        reviewContentRequired: 'Please enter review content',
        reviewStarRequired: 'Please rate 1-5 stars',
        // ─── Teachers Page ───
        teacherPageTitle: '📖 Teachers',
        teacherHeroText: 'Teachers guide and inspire',
        teacherHeroSub: '1062 Teachers · 11 Colleges · Real Reviews',
        teacherSearchPlaceholder: 'Search name, college, research...',
        teacherSearchBtn: 'Search',
        teacherLoadMore: '📄 Load More',
        teacherNoData: '👨‍🏫</div>No teacher data',
        teacherDetail: 'Teacher Detail',
        teacherLikes: 'Likes',
        teacherReviews: 'Reviews',
        teacherRating: 'Rating',
        teacherEdu: '🎓 Education',
        teacherUndergrad: '🎓 Undergrad: ',
        teacherGrad: '🎓 Graduate: ',
        teacherResearch: '🔬 Research',
        teacherCourses: '📖 Courses',
        teacherPapers: '📄 Papers',
        teacherProjects: '🔬 Projects',
        teacherSocialRoles: '🌐 Social Roles',
        teacherAchievements: '🏆 Achievements',
        teacherBio: '📝 Bio',
        teacherNoDetail: 'No detailed info',
        teacherLike: 'Like',
        teacherLiked: 'Liked',
        teacherWriteReview: 'Review',
        teacherReviewed: 'Reviewed',
        teacherLikeToday: '✅ Already liked today',
        teacherLikeTip: '💡 You can like each teacher once per day',
        teacherReviewToday: '✅ Already reviewed today',
        teacherReviewList: '💬 Reviews',
        teacherNoReview: 'No reviews yet. Be the first!',
        teacherReviewRating: 'Rating',
        teacherReviewAnonymous: '🕵 Anonymous',
        teacherReviewPublic: 'Public',
        teacherReviewDisplayMethod: 'Display as:',
        teacherReviewAnonHint: 'Anonymous hides your profile',
        teacherReviewContent: 'Review Content',
        teacherReviewPlaceholder: 'Share your experience with this teacher...',
        teacherReviewEmoji: '😊 Emoji',
        teacherReviewMedia: '📷 Add Photo/Video',
        teacherReviewSubmit: 'Submit Review',
        teacherReviewSuccess: '👍 Liked!',
        teacherLikeFailed: 'Like failed',
        teacherNotFound: 'Teacher not found',
        teacherLoadFailed: 'Load failed',
        teacherDr: 'Ph.D',
        teacherMs: 'Master',
        loadFailed: 'Load failed',
        noOrders: 'No orders',
      }
    };

    let _lang = localStorage.getItem('lazyLang') || 'zh';

    function _t(key) { return (I18N[_lang] && I18N[_lang][key]) || (I18N.zh[key]) || key; }

    function setLang(lang) {
      _lang = lang;
      localStorage.setItem('lazyLang', lang);
      applyLanguage();
    }

    function applyLanguage() {
      document.documentElement.lang = _lang === 'en' ? 'en' : 'zh-CN';
      // Update all data-i18n elements
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[_lang] && I18N[_lang][key] !== undefined) {
          el.textContent = I18N[_lang][key];
        }
      });
      // Update placeholders
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (I18N[_lang] && I18N[_lang][key] !== undefined) {
          el.placeholder = I18N[_lang][key];
        }
      });
      // Update page title
      document.title = _t('appName');
      // Re-render settings if open
      const settingsEl = document.getElementById('settingsPage_sub');
      if (settingsEl && settingsEl.classList.contains('active')) {
        closeSubPage('settingsPage_sub');
        setTimeout(() => showSettings(), 200);
      }
    }

    // Apply saved language on load
    document.addEventListener('DOMContentLoaded', function() {
      if (_lang !== 'zh') applyLanguage();
    });

    // 全局错误捕获 - 页面右上角显示JS错误
    window.onerror = function(msg, src, line, col, err) {
      console.error('JS Error:', msg, src, line);
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#e74c3c;color:#fff;padding:8px 12px;font-size:12px;z-index:99999;white-space:pre-wrap;';
      d.textContent = 'JS错误: ' + msg + ' (行' + line + ')';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 8000);
    };
    window.onunhandledrejection = function(e) {
      console.error('Promise Error:', e.reason);
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#e67e22;color:#fff;padding:8px 12px;font-size:12px;z-index:99999;';
      d.textContent = '异步错误: ' + (e.reason && e.reason.message || e.reason);
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 8000);
    };

    // ═══════════════════════════════════════════════════════    // 🚀 校园懒人效率站 - 数据库版 (API驱动)
    // ═══════════════════════════════════════════════════════
    // ══════ 状态══════
    // JS加载成功标记（页面加载后会在控制台输出）
    console.log('[校园懒人效率站] JS加载成功 v2.1-' + new Date().toISOString().slice(0,10));
    let currentUser = null;
    let orders = [];
    let coupons = [];
    let userPoints = { total: 0, history: [] };
    let notifications = [];
    let addresses = [];
    let currentTip = 0;

    // ═══ 二手市场状态 ═══
    let marketItems = [];
    let marketCategory = 'all';
    let marketPage = 1;
    let marketHasMore = false;
    let publishImages = []; // 已选图片File对象
    let publishImgUrls = []; // 预览URL
    let publishCategory = 'other';
    let publishCondition = '9成新';
    let tradeTab = 'all';

    // ═══ 子页面栈管理 ═══
    let _pageStack = [];
    let _subPageZBase = 1000;

    function openSubPage(id) {
      const el = document.getElementById(id);
      if (!el) return;
      _pageStack.push(id);
      _subPageZBase++;
      el.style.zIndex = _subPageZBase;
      el.classList.add('active');
      /* overflow managed by sub-page */
    }

    function closeSubPage(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active');
      el.style.zIndex = '';
      _pageStack = _pageStack.filter(p => p !== id);
      if (_pageStack.length === 0) { document.body.style.overflow = ''; _subPageZBase = 1000; }
    }

    function goBack() {
      if (_pageStack.length > 0) closeSubPage(_pageStack[_pageStack.length - 1]);
    }

    // 物理返回键支持
    window.addEventListener('popstate', () => goBack());

    let currentService = 'delivery';
    let currentTab = 'all';

    // ══════ 工具 ══════
    const phoneRegex = /^1[3-9]\d{9}$/;
    const fmtPhone = (p) => p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '...';
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
      // 超过7天显示具体日期
      const m = ('0' + (d.getMonth() + 1)).slice(-2);
      const day = ('0' + d.getDate()).slice(-2);
      const h = ('0' + d.getHours()).slice(-2);
      const min = ('0' + d.getMinutes()).slice(-2);
      return m + '-' + day + ' ' + h + ':' + min;
    };
    const showToast = (msg, duration = 2500) => {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), duration);
    };

    // ══════ 加载数据 ══════
    let adsList = [];
    let adsIdx = 0, adsTimer = null;
    let adsImpressionSent = new Set(); // 避免重复记录展示
    // 触摸滑动状态
    let bannerTouchX0 = 0, bannerTouchY0 = 0;


    function renderAds(ads) {
      adsList = ads;
      const dots = document.getElementById('bannerDots');
      if (!ads.length) { if (dots) dots.style.display = 'none'; return; }
      if (dots) { dots.style.display = 'flex'; dots.innerHTML = ads.map((_,i)=>'<span class="banner-dot'+(i===0?' active':'')+'" onclick="event.stopPropagation();showAd('+i+');resetAdsTimer()"></span>').join(''); }
      showAd(0);
      if (ads.length > 1) { clearInterval(adsTimer); adsTimer = setInterval(()=>showAd((adsIdx+1)%adsList.length), 4000); }
    }

    // 手动切换广告（direction: -1=上一个, 1=下一个）

    function switchAd(dir) {
      if (!adsList.length) return;
      let next = (adsIdx + dir + adsList.length) % adsList.length;
      showAd(next);
      resetAdsTimer();
    }

    // 重置自动播放计时器

    function resetAdsTimer() {
      if (adsList.length <= 1) return;
      clearInterval(adsTimer);
      adsTimer = setInterval(()=>showAd((adsIdx+1)%adsList.length), 4000);
    }

    // 触摸滑动切换广告
    document.addEventListener('DOMContentLoaded', () => {
      const b = document.getElementById('banner1');
      if (!b) return;
      b.addEventListener('touchstart', e => {
        bannerTouchX0 = e.touches[0].clientX;
        bannerTouchY0 = e.touches[0].clientY;
      }, { passive: true });
      b.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - bannerTouchX0;
        const dy = e.changedTouches[0].clientY - bannerTouchY0;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          e.preventDefault();
          switchAd(dx < 0 ? 1 : -1);
        }
      });
    });

    function showAd(idx) {
      adsIdx = idx;
      const ad = adsList[idx]; if (!ad) return;
      // 记录展示（每个广告每个会话只记一次）
      if (!adsImpressionSent.has(ad.id)) {
        adsImpressionSent.add(ad.id);
        API.adView(ad.id, 'impression').catch(()=>{});
      }
      const banner = document.getElementById('banner1');
      const title = document.getElementById('bannerTitle');
      const icon = document.getElementById('bannerIcon');
      const dots = document.getElementById('bannerDots');
      if (title) title.textContent = ad.title || '';
      const hasMedia = ad.media_url && ad.media_url.trim();
      if (hasMedia) {
        const isVid = ad.media_url.match(/\.(mp4|webm|mov)$/i);
        if (isVid) {
          if (icon) icon.innerHTML = '<video src="'+ad.media_url+'" autoplay loop muted playsinline></video>';
        } else {
          if (icon) icon.innerHTML = '<img src="'+ad.media_url+'" onerror="this.parentElement.textContent=\x27🎁\x27">';
        }
      } else {
        if (icon) icon.textContent = ad.image || '🎁';
      }
      if (dots) dots.querySelectorAll('.banner-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
    }

    function clickAd(idx) {
      const ad = adsList[idx]; if (!ad) return;
      // 记录点击
      API.adView(ad.id, 'click').catch(()=>{});
      // 1. 直接外部链接
      if (ad.link_url && ad.link_url.trim()) { window.open(ad.link_url, '_blank'); return; }
      // 2. 内部链接类型
      if (ad.link_type==='order' && ad.link_value) openOrderModal(ad.link_value);
      else if (ad.link_type==='coupon') showCoupons();
      else if (ad.link_type==='url' && ad.link_value) { window.open(ad.link_value, '_blank'); }
      // 3. link_type 为 none 但 link_value 是 URL
      else if (ad.link_value && ad.link_value.trim() && /^https?:\/\//i.test(ad.link_value.trim())) { window.open(ad.link_value.trim(), '_blank'); }
      else showToast(ad.description || ad.title);
    }



    async function loadData() {
      try {
        const [o, c, p, n, ads] = await Promise.all([
          API.getOrders({ phone: currentUser.phone }),
          API.getCoupons(),
          API.getPoints(currentUser.phone),
          API.getNotifications(currentUser.phone),
          API.getAds()
        ]);
        orders = Array.isArray(o) ? o : [];
        coupons = Array.isArray(c) ? c : [];
        userPoints = p || { total: 0, history: [] };
        notifications = Array.isArray(n) ? n : [];
        renderAds(Array.isArray(ads) ? ads : []);
        renderOrders();
        updateMePage();
        updateNotifBadge();
        loadMarketItems(true); // 加载二手市场
      } catch(e) {
        console.error('loadData error:', e);
        orders = [];
      }
    }



    function renderAvatarHtml(avatar, name) {
      if (avatar && (avatar.startsWith('/') || avatar.startsWith('http'))) {
        return '<img src="' + avatar + '" style="width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:middle" />';
      }
      if (avatar && avatar.length <= 2) return '<span style="font-size:14px">' + avatar + '</span>';
      return '<span style="font-size:12px;color:var(--text-light)">' + escHtml((name || '?')[0]) + '</span>';
    }



    function cancelReplyComment() {
      _replyToCommentId = null;
      _replyToCommentName = '';
      const hintEl = document.getElementById('replyHint');
      const inputEl = document.getElementById('commentInput');
      if (hintEl) hintEl.style.display = 'none';
      if (inputEl) inputEl.placeholder = '说点什么...';
    }



    function showMainApp() {
      document.getElementById('homePage').classList.add('active');
      document.querySelectorAll('.nav-item')[0].classList.add('active');
      if (currentUser) loadWallFeed();
    }


    // ══════ 退出登录══════

    async function logout() {
      API.logout();
      location.reload();
    }


    // ══════ 主题切换 ══════

    function toggleTheme() {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      document.getElementById('themeBtn').textContent = isDark ? '...' : '...';
      localStorage.setItem('lazyTheme', isDark ? 'dark' : 'light');
    }



    function renderWallFeed() {
      const el = document.getElementById('wallFeed');
      // 更新标签栏选中状态
      document.querySelectorAll('.wall-tag-pill').forEach(pill => {
        const tag = pill.dataset.tag;
        pill.classList.toggle('active', tag === wallTagFilter);
      });
      if (!wallPosts.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">还没有帖子，来发第一条吧！</div></div>';
        return;
      }
      el.innerHTML = wallPosts.map(p => {
        const avatarHtml = p.avatar && (p.avatar.startsWith('/') || p.avatar.startsWith('http'))
          ? '<div class="wall-avatar" style="cursor:pointer;overflow:hidden" onclick="showWallUser(\''+p.phone+'\')" title="查看TA的主页"><img src="'+escHtml(p.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" /></div>'
          : '<div class="wall-avatar" style="cursor:pointer" onclick="showWallUser(\''+p.phone+'\')" title="查看TA的主页">'+(p.avatar && /\p{Emoji}/u.test(p.avatar) && p.avatar.length<=2 ? p.avatar : (p.nickname||'匿')[0])+'</div>';
        return `
        <div class="wall-card">
          <div class="wall-card-header">
            ${avatarHtml}
            <div style="flex:1;min-width:0">
              <div class="wall-nickname" onclick="showWallUser('${p.phone}')" style="cursor:pointer">${escHtml(p.nickname||_t('teacherReviewAnonymous'))}</div>
              <div class="wall-time">${timeAgo(p.created_at)}</div>
            </div>
            ${p.phone !== (currentUser && currentUser.phone) ? '<button onclick="event.stopPropagation();doWallFollowFeed('+p.id+',\''+p.phone+'\',this)" class="wall-follow-btn ' + (p.isFollowing?'followed':'') + '">' + (p.isFollowing?'已关注':'+ 关注') + '</button>' : ''}
          </div>
          <div class="wall-content" onclick="showWallDetail(${p.id})" style="cursor:pointer">${escHtml(p.content)}</div>
          ${(p.tags && p.tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + p.tags.map(t => {
            const cfg = TAG_CONFIG[t] || { emoji: '🏷️', color: '#95A5A6' };
            return '<span onclick="event.stopPropagation();filterByTag(\''+t+'\')" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:12px;font-size:11px;background:'+cfg.color+'18;color:'+cfg.color+';cursor:pointer;transition:all 0.2s" onmouseover="this.style.background=\''+cfg.color+'30\'" onmouseout="this.style.background=\''+cfg.color+'18\'">'+cfg.emoji+' '+t+'</span>';
          }).join('') + '</div>' : ''}
          ${(p.ai_tags && p.ai_tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">' + p.ai_tags.map(at => '<span onclick="event.stopPropagation();filterByTag(\''+at+'\')" style="display:inline-flex;align-items:center;gap:2px;padding:1px 7px;border-radius:9px;font-size:10px;background:#8E44AD12;color:#8E44AD;cursor:pointer">🤖 '+escHtml(at)+'</span>').join('') + '</div>' : ''}
          ${p.images && p.images.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + (Array.isArray(p.images) ? p.images : p.images.split(',').filter(Boolean)).map(img => {
            const url = typeof img === 'object' ? img.url : img;
            const isVid = typeof img === 'object' ? img.isVideo : /\.mp4|\.mov|\.webm/i.test(url);
            return isVid ? '<video src="' + url + '" style="width:100px;height:100px;object-fit:cover;border-radius:8px" muted></video>' : '<img src="' + url + '" style="width:100px;height:100px;object-fit:cover;border-radius:8px" loading="lazy" />';
          }).join('') + '</div>' : ''}
          <div class="wall-actions">
            <button class="wall-action" onclick="event.stopPropagation();doWallLike(${p.id},this)">❤️ <span>${p.like_count||0}</span></button>
            <button class="wall-action" onclick="showWallDetail(${p.id})">💬 <span>${p.comment_count||0}</span></button>
            ${p.phone !== currentUser.phone ? '<button class="wall-action" onclick="event.stopPropagation();tryWallChat(\''+p.phone+'\')">✉️ 私信</button>' : ''}
          </div>
        </div>
      `;
      }).join('');
    }



    function _avatarColor(i) {
      const colors = ['#FF6B6B,#FF8E8E','#4ECDC4,#6EE7DE','#45B7D1,#6DD5ED','#F7DC6F,#F9E894','#BB8FCE,#D2B4E0','#E59866,#F0B27A','#58D68D,#82E0AA','#5DADE2,#85C1E9'];
      return colors[i % colors.length];
    }



    function timeAgo(ts) {
      if (!ts) return '';
      const diff = Date.now() - new Date(ts).getTime();
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
      if (diff < 604800000) return Math.floor(diff/86400000) + '天前';
      return ts.slice(0,10);
    }



    function escHtml(s) {
      if (!s) return '';
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }



    // ══════ 页面切换 ══════

    function switchPage(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      if (page === 'home') {
        document.getElementById('homePage').classList.add('active');
        document.querySelectorAll('.nav-item')[0]?.classList.add('active');
        if (currentUser) loadWallFeed();
      } else if (page === 'message') {
        document.getElementById('messagePage').classList.add('active');
        document.querySelectorAll('.nav-item')[1]?.classList.add('active');
        initMessagePage();
      } else if (page === 'me') {
        document.getElementById('mePage').classList.add('active');
        document.querySelectorAll('.nav-item')[2]?.classList.add('active');
        updateMePage();
      }
    }


    // ══════ 我的页面 ══════

    async function updateMePage() {
      if (!currentUser) return;
      try {
        const [pdata, wallStats] = await Promise.all([
          fetch('/api/users/' + currentUser.phone, { headers: API._headers() }).then(r => r.json()).catch(() => null),
          API.wallMyStats(currentUser.phone).catch(() => null)
        ]);
        // 更新校园墙统计
        if (wallStats && !wallStats.error) {
          const ef = document.getElementById('meFollowers');
          if (ef) ef.textContent = wallStats.followers || 0;
          const efg = document.getElementById('meFollowing');
          if (efg) efg.textContent = wallStats.following || 0;
          const el = document.getElementById('meWallLikes');
          if (el) el.textContent = wallStats.totalLikes || 0;
          const ev = document.getElementById('meViews');
          if (ev) ev.textContent = wallStats.totalViews || 0;
        }
        // 更新资料卡
        const avatars = ['🦥','🐱','🐶','🦊','🐼','🐨','🦄','🐸','🐧','🦋','🌸','⭐','🔥','💎','🎭'];
        const nameEl = document.getElementById('meName');
        const phoneEl = document.getElementById('mePhone');
        const avatarEl = document.getElementById('meAvatar');
        if (nameEl) nameEl.textContent = pdata?.nickname || pdata?.name || '校园懒人';
        if (phoneEl) phoneEl.textContent = fmtPhone(currentUser.phone);
        if (avatarEl) {
          const av = pdata?.avatar || avatars[parseInt(currentUser.phone.slice(-2)) % avatars.length];
          const isUrl = av && (av.startsWith('/') || av.startsWith('http'));
          if (isUrl) {
            avatarEl.innerHTML = '<img src="' + av + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
          } else {
            avatarEl.textContent = av;
          }
        }
        const bioEl = document.getElementById('meBio');
        if (bioEl) bioEl.textContent = pdata?.bio || '';
      } catch(e) {
        console.error('updateMePage error:', e);
      }
    }



    function updateNotifBadge() {
      const unread = notifications.filter(n => !n.read).length;
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
      }
    }



    async function openNotifModal() {
      const list = document.getElementById('notifList');
      if (!list) return;
      if (!notifications.length) {
        await API.getNotifications(currentUser.phone).then(n => { notifications = n || []; });
      }
      await API.markRead(currentUser.phone);
      notifications.forEach(n => n.read = true);
      updateNotifBadge();
      list.innerHTML = notifications.length ? notifications.map(n => {
        const iconMap = {order:'📦',wall_like:'❤️',wall_comment:'💬',rating:'⭐',promo:'🎉'};
        const clsMap = {order:'order',wall_like:'system',wall_comment:'system',rating:'promo',promo:'promo'};
        const icon = iconMap[n.type] || '🔔';
        const cls = clsMap[n.type] || 'system';
        return `<div class="notif-item">
          <div class="notif-icon ${cls}">${icon}</div>
          <div class="notif-body">
            <div class="notif-title">${escHtml(n.title)}</div>
            <div class="notif-text">${escHtml(n.content)}</div>
            <div class="notif-time">${fmtTime(new Date(n.created_at).getTime())}</div>
          </div>
        </div>`;
      }).join('') : '<div class="sub-empty"><div class="sub-empty-icon">🔔</div><div class="sub-empty-text">暂无通知</div></div>';
      openSubPage('notifPage_sub');
    }


    // ══════ 关闭寮圭獥 ══════

    function closeModal(id) {
      // 兼容映射：旧的modal id → 新的sub-page id
      const map = {
        'orderModal':'orderPage_sub','detailModal':'detailPage_sub',
        'wallPostModal':'wallPostPage_sub','wallDetailModal':'wallDetailPage_sub',
        'rateModal':'ratePage_sub','notifModal':'notifPage_sub',
        'settingsModal':'settingsPage_sub','profileModal':'profilePage_sub',
        'genericModal':'genericPage_sub'
      };
      const target = map[id] || id;
      closeSubPage(target);
    }

    function openModal(title, bodyHtml) {
      let el = document.getElementById('genericPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'genericPage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'genericPage_sub\')">←</button><span class="sub-page-title" id="genericPageTitle"></span></div><div class="sub-page-body" id="genericPageBody"></div>';
        document.body.appendChild(el);
      }
      document.getElementById('genericPageTitle').textContent = title;
      document.getElementById('genericPageBody').innerHTML = bodyHtml;
      openSubPage('genericPage_sub');
    }


    // ══════ 关闭寮圭獥浜嬩欢 ══════
    // 弹窗点击关闭已移除，改用子页面返回按钮


    // 小费选择

    function setTip(n) {
      currentTip = n;
      var input = document.getElementById('tipInput');
      if (input) input.value = n;
      document.querySelectorAll('.tip-btn').forEach(b => { b.classList.remove('active');
        var v = parseInt(b.textContent.replace(/[^0-9]/g, ''));
        if ((n === 0 && b.textContent.includes('无')) || v === n) b.classList.add('active');
      });
      updatePrice();
    }

    // 快捷入口

    async function showCoupons() {
      try {
        const [available, mine] = await Promise.all([API.getCoupons(), currentUser ? API.getMyCoupons(currentUser.phone) : []]);
        const mineIds = new Set((mine||[]).map(c=>c.id));
        let el = document.getElementById('couponPage_sub');
        if (!el) {
          el = document.createElement('div');
          el.id = 'couponPage_sub';
          el.className = 'sub-page';
          el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'couponPage_sub\')">←</button><span class="sub-page-title">🎫 优惠券</span></div><div class="sub-page-body"></div>';
          document.body.appendChild(el);
        }
        let h = '';
        h += '<div class="sp-card"><div class="sp-card-title">🎟️ 可领取优惠券</div><div class="sp-card-body">';
        if (!available.length) h += '<div style="text-align:center;color:var(--text-secondary);padding:20px">暂无可用优惠券</div>';
        available.forEach(c => {
          const cl = mineIds.has(c.id);
          h += '<div class="coupon-item' + (cl?' claimed':'') + '">';
          h += '<div class="coupon-left"><div class="coupon-name">' + escHtml(c.name) + '</div><div class="coupon-desc">满' + c.min_amount + '可用 | 有效期至' + c.expire_at.slice(0,10) + '</div></div>';
          h += '<div class="coupon-amount">\u00a5' + c.value + '</div>';
          h += '<button onclick="claimCoupon(' + c.id + ')" class="coupon-btn ' + (cl?'coupon-btn-disabled':'coupon-btn-primary') + '"' + (cl?' disabled':'') + '>' + (cl?'已领取':'领取') + '</button></div>';
        });
        h += '</div></div>';
        h += '<div class="sp-card"><div class="sp-card-title">🎒 我的优惠券</div><div class="sp-card-body">';
        if (!mine||!mine.length) h += '<div style="text-align:center;color:var(--text-secondary);padding:20px">暂无已领取优惠券</div>';
        (mine||[]).forEach(c => {
          h += '<div class="coupon-item' + (c.used?' used':'') + '">';
          h += '<div class="coupon-left"><div class="coupon-name">' + escHtml(c.name) + '</div><div class="coupon-desc">满' + c.min_amount + '可用 | ' + (c.used?'已使用':'可用') + ' | 有效期至' + c.expire_at.slice(0,10) + '</div></div>';
          h += '<div class="coupon-amount' + (c.used?' used':'') + '">\u00a5' + c.value + '</div></div>';
        });
        h += '</div></div>';
        el.querySelector('.sub-page-body').innerHTML = h;
        openSubPage('couponPage_sub');
      } catch(e) { showToast(_t('loadFailed')); }
    }

    async function claimCoupon(id) {
      if (!currentUser) return showToast('请先登录');
      try { await API.claimCoupon(currentUser.phone, id); showToast('领取成功！'); showCoupons(); } catch(e) { showToast(e.message); }
    }

    async function showPoints() {
      if (!currentUser) return showToast('请先登录');
      try {
        const data = await API.getPoints(currentUser.phone);
        let el = document.getElementById('pointsPage_sub');
        if (!el) {
          el = document.createElement('div');
          el.id = 'pointsPage_sub';
          el.className = 'sub-page';
          el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'pointsPage_sub\')">←</button><span class="sub-page-title">⭐ 积分</span></div><div class="sub-page-body"></div>';
          document.body.appendChild(el);
        }
        let h = '<div class="points-hero">';
        h += '<div class="points-hero-label">我的积分</div>';
        h += '<div class="points-hero-num">' + (data.total||0) + '</div>';
        h += '<div class="points-hero-hint">积分可在下单时抵扣</div></div>';
        h += '<div class="sp-card"><div class="sp-card-title">📜 积分明细</div><div class="sp-card-body">';
        if (!data.history||!data.history.length) h += '<div style="text-align:center;color:var(--text-secondary);padding:20px">暂无积分记录</div>';
        (data.history||[]).forEach(l => {
          const isAdd = l.amount > 0;
          h += '<div class="points-item">';
          h += '<div class="points-item-info"><div class="points-item-desc">' + escHtml(l.description||l.type) + '</div><div class="points-item-time">' + l.created_at + '</div></div>';
          h += '<div class="points-item-val ' + (isAdd?'pos':'neg') + '">' + (isAdd?'+':'') + l.amount + '</div></div>';
        });
        h += '</div></div>';
        el.querySelector('.sub-page-body').innerHTML = h;
        openSubPage('pointsPage_sub');
      } catch(e) { showToast(_t('loadFailed')); }
    }


    // ═══════════════════════════════════════════════════════
    // 😊 表情选择器
    // ═══════════════════════════════════════════════════════
    const emojiList = ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','🥴','😇','🥳','🥺','🤠','🤡','🤥','🤫','🤭','🧐','🤓','💪','👍','👎','👏','🙏','🤝','❤️','💔','🔥','💯','✨','🎉','🎊','⭐','🌟','💬','💭','🤷','🤦','👋','✌️','🤞','🤟','🤘','👌','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','🤌','🫶','🫡','🫣','🫠'];
    let emojiInited = false;

    function toggleEmojiPicker() {
      const picker = document.getElementById('emojiPicker');
      if (!picker) return;
      if (!emojiInited) {
        const grid = document.getElementById('emojiGrid');
        if (grid) grid.innerHTML = emojiList.map(e => '<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;display:inline-block" onclick="insertEmoji(\''+e+'\')">' + e + '</span>').join('');
        emojiInited = true;
      }
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    }

    function insertEmoji(emoji) {
      const input = document.getElementById('chatInput');
      if (input) { input.value += emoji; input.focus(); }
      const picker = document.getElementById('emojiPicker');
      if (picker) picker.style.display = 'none';
    }


    // ═══════════════════════════════════════════════════════
    // 🖼️ GIF搜索
    // ═══════════════════════════════════════════════════════

    function switchPickerTab(tab) {
      const emojiTab = document.getElementById('emojiTabContent');
      const gifTab = document.getElementById('gifTabContent');
      const tabEmoji = document.getElementById('tabEmoji');
      const tabGif = document.getElementById('tabGif');
      if (tab === 'gif') {
        emojiTab.style.display = 'none'; gifTab.style.display = 'block';
        tabEmoji.style.color = 'var(--text-secondary)'; tabEmoji.style.background = 'transparent';
        tabGif.style.color = 'var(--primary)'; tabGif.style.background = 'var(--bg)';
      } else {
        emojiTab.style.display = 'block'; gifTab.style.display = 'none';
        tabEmoji.style.color = 'var(--primary)'; tabEmoji.style.background = 'var(--bg)';
        tabGif.style.color = 'var(--text-secondary)'; tabGif.style.background = 'transparent';
      }
    }

    async function searchGif(keyword) {
      const container = document.getElementById('gifResults');
      if (!container) return;
      container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px">搜索中...</div>';
      try {
        const res = await fetch('/api/gif/search?q=' + encodeURIComponent(keyword), { headers: API._headers() });
        const data = await res.json();
        if (!data.gifs || !data.gifs.length) { container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px">暂无结果</div>'; return; }
        container.innerHTML = data.gifs.map(g =>
          '<span style="display:inline-flex;flex-direction:column;align-items:center;cursor:pointer;padding:6px;border-radius:12px;background:var(--bg);transition:transform 0.2s" ' +
          'onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'" ' +
          'onclick="insertAnimEmoji(\''+g.emoji+'\',\''+g.anim+'\',\''+escHtml(g.code)+'\')" title="' + escHtml(g.title) + '">' +
          '<span class="anim-'+g.anim+'" style="font-size:32px">'+g.emoji+'</span>' +
          '<span style="font-size:11px;color:var(--text-secondary);margin-top:2px">'+escHtml(g.title)+'</span></span>'
        ).join('');
      } catch(e) { container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px">搜索失败</div>'; }
    }

    function insertAnimEmoji(emoji, anim, code) {
      const input = document.getElementById('chatInput');
      if (input) { input.value = code; sendChatMsg(); }
      const picker = document.getElementById('emojiPicker');
      if (picker) picker.style.display = 'none';
    }

    function insertGif(url) { insertAnimEmoji('🎬','bounce','[GIF]'+url); }


// 图片预览弹窗

function previewImage(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = '<img src="' + src + '" style="max-width:95%;max-height:90vh;object-fit:contain;border-radius:8px">';
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}


// 猫狗日记子页面打开时加载
const _prevOpenSubPage = window.openSubPage;
window.openSubPage = function(id) {
  _prevOpenSubPage(id);
  if (id === 'petListPage_sub') loadPets('all');
};


// ── Window exports ──
window._t = _t;
window.setLang = setLang;
window.applyLanguage = applyLanguage;
window.openSubPage = openSubPage;
window.closeSubPage = closeSubPage;
window.goBack = goBack;
window.renderAds = renderAds;
window.switchAd = switchAd;
window.resetAdsTimer = resetAdsTimer;
window.showAd = showAd;
window.clickAd = clickAd;
window.loadData = loadData;
window.renderAvatarHtml = renderAvatarHtml;
window.cancelReplyComment = cancelReplyComment;
window.showMainApp = showMainApp;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.renderWallFeed = renderWallFeed;
window._avatarColor = _avatarColor;
window.timeAgo = timeAgo;
window.escHtml = escHtml;
window.switchPage = switchPage;
window.updateMePage = updateMePage;
window.updateNotifBadge = updateNotifBadge;
window.openNotifModal = openNotifModal;
window.closeModal = closeModal;
window.openModal = openModal;
window.setTip = setTip;
window.showCoupons = showCoupons;
window.claimCoupon = claimCoupon;
window.showPoints = showPoints;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.switchPickerTab = switchPickerTab;
window.searchGif = searchGif;
window.insertAnimEmoji = insertAnimEmoji;
window.insertGif = insertGif;
window.previewImage = previewImage;
window.showToast = showToast;
