// core.js - 核心工具/全局/初始化
// 包含: 全局变量、i18n、工具函数、页面切换、子页面、初始化
// 新功能请添加为独立JS模块，不要在此骨架文件中添加代码


    // ═══════════════════════════════════════════════════════
    // 🌐 国际化 i18n
    // ═══════════════════════════════════════════════════════
    const I18N = {
      zh: {
        appName: '校园圈',
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
        versionText: '校园圈 v3.0',
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

    var _lang = localStorage.getItem('lazyLang') || 'zh';

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
      // 检测分享链接参数：?post=xxx → 自动打开帖子详情
      handleSharedPostUrl();
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

    // ═══════════════════════════════════════════════════════    // 🚀 校园圈 - 数据库版 (API驱动)
    // ═══════════════════════════════════════════════════════
    // ══════ 状态══════
    // JS加载成功标记（页面加载后会在控制台输出）
    console.log('[校园圈] JS加载成功 v2.1-' + new Date().toISOString().slice(0,10));
    var currentUser = null;
    var orders = [];
    var coupons = [];
    var userPoints = { total: 0, history: [] };
    var notifications = [];
    var addresses = [];
    var currentTip = 0;

    // ═══ 二手市场状态 ═══
    var marketItems = [];
    var marketCategory = 'all';
    var marketPage = 1;
    var marketHasMore = false;
    var publishImages = []; // 已选图片File对象
    var publishImgUrls = []; // 预览URL
    var publishCategory = 'other';
    var publishCondition = '9成新';
    var tradeTab = 'all';

    // ═══ 子页面栈管理 ═══
    var _pageStack = [];
    var _subPageZBase = 1000;

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
      if (el.scrollTop) el.scrollTop = 0;
      _pageStack = _pageStack.filter(p => p !== id);
      if (_pageStack.length === 0) { document.body.style.overflow = ''; _subPageZBase = 1000; }
    }

    function goBack() {
      if (_pageStack.length > 0) closeSubPage(_pageStack[_pageStack.length - 1]);
    }

    // 物理返回键支持
    window.addEventListener('popstate', () => goBack());

    var currentService = 'delivery';
    var currentTab = 'all';

    // ══════ 工具 ══════
    const phoneRegex = /^1[3-9]\d{9}$/;
    const fmtPhone = (p) => p ? (phoneRegex.test(p) ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : p) : '...';
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
    var adsList = [];
    var adsIdx = 0, adsTimer = null;
    var adsImpressionSent = new Set(); // 避免重复记录展示
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
        orders = Array.isArray(o) ? o : (o && o.list || []);
        coupons = Array.isArray(c) ? c : [];
        userPoints = p || { total: 0, history: [] };
        notifications = Array.isArray(n) ? n : [];
        renderAds(Array.isArray(ads) ? ads : []);
        renderOrders();
        updateMePage();
        updateMsgBadge();
        // 初始化聊天未读数
        if (API.getChatUnread) {
          API.getChatUnread().then(d => { _lastUnreadCount = d.count || 0; updateMsgBadge(); }).catch(() => {});
        }
        loadMarketItems(true); // 加载二手市场
        startChatPolling(); // 启动消息轮询
        startNotifPolling(); // 启动通知轮询
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
      if (currentUser) { loadWallFeed(); }
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
      document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
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
        const hasImages = p.images && p.images.length;
        // 图片布局：1张大图/2张并排/3+宫格
        let imageGrid = '';
        if (hasImages) {
          const imgs = (Array.isArray(p.images) ? p.images : p.images.split(',').filter(Boolean));
          const imgCount = imgs.length;
          if (imgCount === 1) {
            const url = typeof imgs[0] === 'object' ? imgs[0].url : imgs[0];
            const isVid = typeof imgs[0] === 'object' ? imgs[0].isVideo : /\.mp4|\.mov|\.webm/i.test(url);
            imageGrid = isVid
              ? '<video src="' + url + '" controls style="width:100%;border-radius:12px;margin-top:8px" muted></video>'
              : '<img src="' + url + '" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-top:8px" loading="lazy" onclick="showWallDetail('+p.id+')" />';
          } else if (imgCount === 2) {
            imageGrid = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px">' + imgs.map(img => {
              const url = typeof img === 'object' ? img.url : img;
              const isVid = typeof img === 'object' ? img.isVideo : /\.mp4|\.mov|\.webm/i.test(url);
              return isVid ? '<video src="' + url + '" style="width:100%;height:140px;object-fit:cover;border-radius:8px" muted></video>' : '<img src="' + url + '" style="width:100%;height:140px;object-fit:cover;border-radius:8px" loading="lazy" />';
            }).join('') + '</div>';
          } else {
            imageGrid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">' + imgs.slice(0,9).map(img => {
              const url = typeof img === 'object' ? img.url : img;
              const isVid = typeof img === 'object' ? img.isVideo : /\.mp4|\.mov|\.webm/i.test(url);
              return isVid ? '<video src="' + url + '" style="width:100%;height:100px;object-fit:cover;border-radius:6px" muted></video>' : '<img src="' + url + '" style="width:100%;height:100px;object-fit:cover;border-radius:6px" loading="lazy" />';
            }).join('') + (imgCount > 9 ? '<div style="width:100%;height:100px;background:var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary)">+' + (imgCount - 9) + '</div>' : '') + '</div>';
          }
        }
        // 标签
        const tagsHtml = (p.tags && p.tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">' + p.tags.map(t => {
          const cfg = TAG_CONFIG[t] || { emoji: '🏷️', color: '#95A5A6' };
          return '<span onclick="event.stopPropagation();filterByTag(\''+t+'\')" style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:10px;font-size:11px;background:'+cfg.color+'18;color:'+cfg.color+';cursor:pointer">'+cfg.emoji+' '+t+'</span>';
        }).join('') + '</div>' : '';
        const aiTagsHtml = (p.ai_tags && p.ai_tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + p.ai_tags.map(at => '<span onclick="event.stopPropagation();filterByTag(\''+at+'\')" style="display:inline-flex;align-items:center;gap:2px;padding:1px 7px;border-radius:9px;font-size:10px;background:#8E44AD12;color:#8E44AD;cursor:pointer">🤖 '+escHtml(at)+'</span>').join('') + '</div>' : '';
        const badgeHtml = (p.is_pinned ? '<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:8px;font-size:10px;background:#E74C3C18;color:#E74C3C;font-weight:600;margin-right:4px">📌 置顶</span>' : '') + (p.is_featured ? '<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:8px;font-size:10px;background:#F39C1218;color:#F39C12;font-weight:600">⭐ 精华</span>' : '');
        // 内联操作按钮（编辑/举报/拉黑/删除）
        const actionEditBtn = (currentUser && p.phone === currentUser.phone) ? '<button onclick="event.stopPropagation();doEditWallPost('+p.id+')" style="background:none;border:none;font-size:14px;cursor:pointer;padding:8px 16px;border-radius:8px;transition:all 0.15s;display:flex;align-items:center;gap:8px;white-space:nowrap" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'">✏️ 编辑</button>' : '';
        const actionReportBtn = '<button onclick="event.stopPropagation();showReportMenu(\'post\','+p.id+')" style="background:none;border:none;font-size:14px;cursor:pointer;padding:8px 16px;border-radius:8px;transition:all 0.15s;display:flex;align-items:center;gap:8px;white-space:nowrap" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'transparent\'">🚫 举报</button>';
        const actionBlockBtn = (currentUser && p.phone !== currentUser.phone) ? '<button onclick="event.stopPropagation();doBlockUser(\''+escHtml(p.phone)+'\')" style="background:none;border:none;font-size:14px;cursor:pointer;padding:8px 16px;border-radius:8px;transition:all 0.15s;color:#E74C3C;display:flex;align-items:center;gap:8px;white-space:nowrap" onmouseover="this.style.background=\'rgba(231,76,60,0.08)\'" onmouseout="this.style.background=\'transparent\'">🚷 拉黑</button>' : '';
        const actionDeleteBtn = ((currentUser && p.phone === currentUser.phone) || (currentUser && (currentUser.role==='admin'||currentUser.role==='super'))) ? '<button onclick="event.stopPropagation();doDeletePost('+p.id+')" style="background:none;border:none;font-size:14px;cursor:pointer;padding:8px 16px;border-radius:8px;transition:all 0.15s;color:#E74C3C;display:flex;align-items:center;gap:8px;white-space:nowrap" onmouseover="this.style.background=\'rgba(231,76,60,0.08)\'" onmouseout="this.style.background=\'transparent\'">🗑️ 删除</button>' : '';
        const inlineActionsHtml = actionEditBtn + actionReportBtn + actionBlockBtn + actionDeleteBtn;
        return `
        <div class="wall-card" style="border-radius:14px;overflow:hidden;${p.is_pinned ? 'border-left:3px solid #E74C3C' : ''}${p.is_featured ? 'border-left:3px solid #F39C12' : ''}">
          <div class="wall-card-header" style="position:relative">
            ${avatarHtml}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                <span class="wall-nickname" onclick="showWallUser('${p.phone}')" style="cursor:pointer">${escHtml(p.nickname||_t('teacherReviewAnonymous'))}</span>
                ${badgeHtml}
              </div>
              <div class="wall-time">${timeAgo(p.created_at)}</div>
            </div>
            <span style="position:relative;flex-shrink:0"><button class="wall-more-btn" onclick="event.stopPropagation();toggleInlineActions(this,${p.id},'${escHtml(p.phone)}',event)" title="更多" style="background:none;border:none;font-size:20px;color:var(--text-secondary);cursor:pointer;padding:4px 8px;border-radius:8px;line-height:1;transition:all 0.15s" onmouseover="this.style.background='var(--border)';this.style.color='var(--text)'" onmouseout="this.style.background='none';this.style.color='var(--text-secondary)'">⋯</button><span class="wall-inline-actions" style="display:none;position:absolute;right:0;top:100%;background:var(--card);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:6px;z-index:50;min-width:120px;margin-top:4px" onmouseleave="this.classList.remove('open')">${inlineActionsHtml}</span></span>
          </div>
          <div class="wall-content" onclick="showWallDetail(${p.id})" style="cursor:pointer;font-size:15px;line-height:1.6">${escHtml(p.content)}</div>
          ${tagsHtml}${aiTagsHtml}
          ${imageGrid}
          <div class="wall-actions" style="border-top:1px solid var(--border);margin-top:10px;padding-top:8px">
            <button class="wall-action" onclick="event.stopPropagation();doWallLike(${p.id},this)">❤️ <span>${p.like_count||0}</span></button>
            <button class="wall-action" onclick="showWallDetail(${p.id})">💬 <span>${p.comment_count||0}</span></button>
            <button class="wall-action" onclick="event.stopPropagation();doSharePost(${p.id})">📤 <span>${p.share_count||0}</span></button>
            <button class="wall-action" onclick="event.stopPropagation();generateShareImage(${p.id})" title="生成卡片分享到QQ/微信">📲</button>
          </div>
        </div>
      `;
      }).join('');
      // 底部状态：加载中 / 到底了 / 继续滚动触发
      let html = el.innerHTML;
      if (_wallLoading) {
        html += '<div class="wall-loading"><div class="wall-spinner"></div><span>加载中...</span></div>';
      } else if (!_wallHasMore) {
        html += '<div class="wall-end">— 已经到底了 —</div>';
      } else {
        html += '<div class="wall-load-more-sentinel"></div>';
      }
      el.innerHTML = html;
      // 触发无限滚动观察
      setupWallInfiniteScroll();
    }

    // ══════ 内联操作按钮（展开/收起） ══════
    function toggleInlineActions(btn, postId, postPhone, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      const wrapper = btn.parentNode;
      // 关闭其他已展开的
      document.querySelectorAll('.wall-inline-actions.open').forEach(el => {
        if (el.parentNode !== wrapper) el.classList.remove('open');
      });
      // 切换当前
      const actions = wrapper.querySelector('.wall-inline-actions');
      if (actions) actions.classList.toggle('open');
    }
    window.toggleInlineActions = toggleInlineActions;

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
      // 清除行内样式，恢复CSS class控制
      document.querySelectorAll('.page').forEach(p => { p.style.display = ''; p.classList.remove('active'); });
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      if (page === 'home') {
        document.getElementById('homePage').classList.add('active');
        document.querySelectorAll('.nav-item')[0]?.classList.add('active');
        if (currentUser) { loadWallFeed(); }
      } else if (page === 'wallPage') {
        // 全站搜索或标签筛选进入：切换到首页但不刷新帖子流
        document.getElementById('homePage').classList.add('active');
        document.querySelectorAll('.nav-item')[0]?.classList.add('active');
      } else if (page === 'discover') {
        document.getElementById('discoverPage').classList.add('active');
        document.querySelectorAll('.nav-item')[1]?.classList.add('active');
        if (typeof initDiscoverPage === 'function') initDiscoverPage();
      } else if (page === 'message') {
        document.getElementById('messagePage').classList.add('active');
        document.querySelectorAll('.nav-item')[2]?.classList.add('active');
        initMessagePage();
      } else if (page === 'order') {
        document.getElementById('orderPage').classList.add('active');
        renderOrders();
      } else if (page === 'me') {
        document.getElementById('mePage').classList.add('active');
        document.querySelectorAll('.nav-item')[3]?.classList.add('active');
        updateMePage();
      }
    }

    // ══════ 分享链接检测：自动打开帖子 ══════
    function handleSharedPostUrl() {
      var params = new URLSearchParams(window.location.search);
      var postId = params.get('post');
      if (!postId) return;
      // 延迟等待页面完全加载和登录状态就绪
      setTimeout(function () {
        if (typeof showWallDetail === 'function') {
          showWallDetail(parseInt(postId));
        } else {
          var retries = 0;
          var timer = setInterval(function () {
            retries++;
            if (typeof showWallDetail === 'function') {
              clearInterval(timer);
              showWallDetail(parseInt(postId));
            }
            if (retries > 20) clearInterval(timer);
          }, 300);
        }
      }, 500);
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
        if (nameEl) nameEl.textContent = pdata?.nickname || pdata?.name || '校园圈用户';
        // 同步更新顶部问候语
        const headerTitle = document.querySelector('.header .logo-text');
        if (headerTitle && pdata?.nickname) headerTitle.textContent = '你好, ' + pdata.nickname;
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
        // 更新资料卡背景
        const cardEl = document.querySelector('.me-profile-card');
        if (cardEl) {
          if (pdata?.bg_image) {
            cardEl.style.backgroundImage = 'url(' + pdata.bg_image + ')';
            cardEl.style.backgroundSize = 'cover';
            cardEl.style.backgroundPosition = 'center';
          } else if (pdata?.bg_color) {
            cardEl.style.background = pdata.bg_color;
          }
        }
      } catch(e) {
        console.error('updateMePage error:', e);
      }
    }



    // 合并通知+消息未读数，更新导航栏"消息"徽章
    function updateMsgBadge() {
      const notifUnread = notifications.filter(n => !n.read).length;
      const totalUnread = notifUnread + _lastUnreadCount;
      const navBadge = document.getElementById('chatBadge');
      if (navBadge) {
        navBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
        navBadge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
      }
    }



    function openNotifModal() {
      switchPage('message');
    }


    // ══════ 关闭寮圭獥 ══════

    function closeModal(id) {
      // 兼容映射：旧的modal id → 新的sub-page id
      const map = {
        'orderModal':'orderPage_sub','detailModal':'detailPage_sub',
        'wallPostModal':'wallPostPage_sub','wallDetailModal':'wallDetailPage_sub',
        'rateModal':'ratePage_sub',
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
  if (id === 'reviewPage_sub') loadReviewMaterials(1);
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
window.fmtTime = fmtTime;
window.switchPage = switchPage;
window.updateMePage = updateMePage;
window.updateMsgBadge = updateMsgBadge;
window.setNotifications = function(v) { notifications = Array.isArray(v) ? v : []; };
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

    // ═══════════════════════════════════════════════════════
    // 🔍 全局搜索（融合首页+校园墙搜索）
    // ═══════════════════════════════════════════════════════
    let _globalSearchTimer = null;

    async function doGlobalSearch() {
      const q = document.getElementById('globalSearchInput').value.trim();
      if (!q) return;
      document.getElementById('globalSearchClear').style.display = '';
      // 并行搜索：帖子+社团+活动+猫狗+师说+二手
      let posts = [], clubs = [], acts = [], pets = [], teachers = [], marketItems = [];
      try {
        const [wallRes, clubRes, actRes, petRes, teacherRes, marketRes] = await Promise.allSettled([
          API.wallSearch(q, currentUser.phone),
          API.getClubs({ search: q, limit: 50 }),
          API.getActivities({ search: q, limit: 50 }),
          API.getPets({ search: q, limit: 50 }),
          API.getTeachers({ search: q, limit: 50 }),
          API.getMarketItems({ search: q, limit: 50 })
        ]);
        if (wallRes.status === 'fulfilled') posts = Array.isArray(wallRes.value) ? wallRes.value : (wallRes.value && wallRes.value.value || []);
        if (clubRes.status === 'fulfilled') clubs = Array.isArray(clubRes.value) ? clubRes.value : (clubRes.value && clubRes.value.list || []); _globalSearchClubsTotal = (clubRes.value && clubRes.value.total) || clubs.length;
        if (actRes.status === 'fulfilled') acts = Array.isArray(actRes.value) ? actRes.value : (actRes.value && actRes.value.list || []); _globalSearchActsTotal = (actRes.value && actRes.value.total) || acts.length;
        if (petRes.status === 'fulfilled') pets = Array.isArray(petRes.value) ? petRes.value : []; _globalSearchPetsCount = pets.length;
        if (teacherRes.status === 'fulfilled') teachers = Array.isArray(teacherRes.value) ? teacherRes.value : (teacherRes.value && teacherRes.value.teachers || []); _globalSearchTeachersTotal = (teacherRes.value && teacherRes.value.total) || teachers.length;
        if (marketRes.status === 'fulfilled') marketItems = Array.isArray(marketRes.value) ? marketRes.value : (marketRes.value && marketRes.value.items || []); _globalSearchMarketTotal = (marketRes.value && marketRes.value.total) || marketItems.length;
      } catch(e) {}
      if (posts.length === 0 && clubs.length === 0 && acts.length === 0 && pets.length === 0 && teachers.length === 0 && marketItems.length === 0) {
        showToast('未找到相关内容');
        hideGlobalSearchHints();
        return;
      }
      wallPosts = posts;
      _wallSearchMode = true;
      _globalSearchClubs = clubs;
      _globalSearchActs = acts;
      _globalSearchPets = pets;
      _globalSearchTeachers = teachers;
      _globalSearchMarket = marketItems;
      _globalSearchQuery = q;
      openSubPage('searchResultPage_sub');
      document.getElementById('searchResultTitle').textContent = '🔍 "' + q + '"';
      renderSearchResults();
      hideGlobalSearchHints();
    }

    function renderWallPostCard(p) {
      const avatarHtml = p.avatar && (p.avatar.startsWith('/') || p.avatar.startsWith('http'))
        ? '<div class="wall-avatar" style="cursor:pointer;overflow:hidden" onclick="showWallUser(\''+p.phone+'\')" title="查看TA的主页"><img src="'+escHtml(p.avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" /></div>'
        : '<div class="wall-avatar" style="cursor:pointer" onclick="showWallUser(\''+p.phone+'\')" title="查看TA的主页">'+(p.avatar && /\p{Emoji}/u.test(p.avatar) && p.avatar.length<=2 ? p.avatar : (p.nickname||'匿')[0])+'</div>';
      const hasImages = p.images && p.images.length;
      let imageGrid = '';
      if (hasImages) {
        const imgs = (Array.isArray(p.images) ? p.images : p.images.split(',').filter(Boolean));
        const imgCount = imgs.length;
        if (imgCount === 1) {
          const url = typeof imgs[0] === 'object' ? imgs[0].url : imgs[0];
          const isVid = typeof imgs[0] === 'object' ? imgs[0].isVideo : /\.mp4|\.mov|\.webm/i.test(url);
          imageGrid = isVid
            ? '<video src="' + url + '" controls style="width:100%;border-radius:12px;margin-top:8px" muted></video>'
            : '<img src="' + url + '" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-top:8px" loading="lazy" onclick="showWallDetail('+p.id+')" />';
        } else if (imgCount === 2) {
          imageGrid = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px">' + imgs.map(img => {
            const url = typeof img === 'object' ? img.url : img;
            return '<img src="' + url + '" style="width:100%;height:140px;object-fit:cover;border-radius:8px" loading="lazy" />';
          }).join('') + '</div>';
        } else {
          imageGrid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">' + imgs.slice(0,9).map(img => {
            const url = typeof img === 'object' ? img.url : img;
            return '<img src="' + url + '" style="width:100%;height:100px;object-fit:cover;border-radius:6px" loading="lazy" />';
          }).join('') + (imgCount > 9 ? '<div style="width:100%;height:100px;background:var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary)">+' + (imgCount - 9) + '</div>' : '') + '</div>';
        }
      }
      const tagsHtml = (p.tags && p.tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">' + p.tags.map(t => {
        const cfg = TAG_CONFIG[t] || { emoji: '🏷️', color: '#95A5A6' };
        return '<span onclick="event.stopPropagation();filterByTag(\''+t+'\')" style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:10px;font-size:11px;background:'+cfg.color+'18;color:'+cfg.color+';cursor:pointer">'+cfg.emoji+' '+t+'</span>';
      }).join('') + '</div>' : '';
      const aiTagsHtml = (p.ai_tags && p.ai_tags.length) ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + p.ai_tags.map(at => '<span onclick="event.stopPropagation();filterByTag(\''+at+'\')" style="display:inline-flex;align-items:center;gap:2px;padding:1px 7px;border-radius:9px;font-size:10px;background:#8E44AD12;color:#8E44AD;cursor:pointer">🤖 '+escHtml(at)+'</span>').join('') + '</div>' : '';
      return `
        <div class="wall-card" style="border-radius:14px;overflow:hidden;cursor:pointer" onclick="showWallDetail(${p.id})">
          <div class="wall-card-header">
            ${avatarHtml}
            <div style="flex:1;min-width:0">
              <span class="wall-nickname">${escHtml(p.nickname||_t('teacherReviewAnonymous'))}</span>
              <div class="wall-time">${escHtml(p.created_at||'')}</div>
            </div>
          </div>
          <div class="wall-content-text">${escHtml(p.content||'').substring(0, 200)}</div>
          ${imageGrid}
          ${tagsHtml}
          ${aiTagsHtml}
          <div style="display:flex;gap:12px;align-items:center;padding:4px 0 0;font-size:12px;color:var(--text-secondary)">
            <span>❤️ ${p.like_count||0}</span>
            <span>💬 ${p.comment_count||0}</span>
            <span>📤 ${p.share_count||0}</span>
          </div>
        </div>`;
    }

    function renderSearchResults() {
      const el = document.getElementById('searchResultContent');
      if (!el) return;
      const clubs = _globalSearchClubs || [];
      const acts = _globalSearchActs || [];
      const pets = _globalSearchPets || [];
      const teachers = _globalSearchTeachers || [];
      const marketItems = _globalSearchMarket || [];
      const posts = wallPosts || [];

      let html = '';

      // 社团
      if (clubs.length > 0) {
        html += '<div style="padding:12px 0 8px;font-size:13px;color:var(--text-secondary);font-weight:600">🏘️ 相关社团 (' + clubs.length + '条)</div>';
        clubs.forEach(c => {
          html += '<div class="wall-post" style="padding:12px;cursor:pointer;margin-bottom:8px;border:1px solid var(--border);border-radius:12px" onclick="closeSubPage(\'searchResultPage_sub\');showClubDetail(' + c.id + ')">' +
            '<div style="font-weight:600;font-size:14px">🏘️ ' + escHtml(c.name) + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">' + escHtml(c.description||'') + ' · ' + (c.member_count||0) + ' 人</div>' +
            '</div>';
        });
        if (clubs.length >= 50) { html += '<a onclick="closeSubPage(\'searchResultPage_sub\');openClubPage()" style="display:block;padding:8px 12px;text-align:center;font-size:13px;color:var(--text-secondary);cursor:pointer;border-top:1px solid var(--border)">查看全部社团 →</a>'; }
      }

      // 活动
      if (acts.length > 0) {
        html += '<div style="padding:12px 0 8px;font-size:13px;color:var(--text-secondary);font-weight:600">🎯 相关活动 (' + acts.length + '条)</div>';
        acts.forEach(a => {
          html += '<div class="wall-post" style="padding:12px;cursor:pointer;margin-bottom:8px;border:1px solid var(--border);border-radius:12px" onclick="closeSubPage(\'searchResultPage_sub\');switchPage(\'discoverPage\');switchDiscoverTab(\'activities\')">' +
            '<div style="font-weight:600;font-size:14px">🎯 ' + escHtml(a.title) + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">' + escHtml(a.location||'未知地点') + ' · ' + (a.signup_count||0) + '/' + (a.max_participants||'∞') + ' 人</div>' +
            '</div>';
        });
        if (acts.length >= 50) { html += '<a onclick="closeSubPage(\'searchResultPage_sub\');switchPage(\'discoverPage\');switchDiscoverTab(\'activities\')" style="display:block;padding:8px 12px;text-align:center;font-size:13px;color:var(--text-secondary);cursor:pointer;border-top:1px solid var(--border)">查看全部活动 →</a>'; }
      }

      // 猫狗
      if (pets.length > 0) {
        html += '<div style="padding:12px 0 8px;font-size:13px;color:var(--text-secondary);font-weight:600">🐱 相关猫狗 (' + pets.length + '条)</div>';
        pets.forEach(p => {
          const statusMap = { healthy: '😊健康', sick: '🤒生病', injured: '🤕受伤', pregnant: '🤰孕期', nursing: '🍼哺乳', quarantine: '🔒隔离', other: '❓其他' };
          const statusText = statusMap[p.status] || '';
          html += '<div class="wall-post" style="padding:12px;cursor:pointer;margin-bottom:8px;border:1px solid var(--border);border-radius:12px" onclick="showPetDetail(' + p.id + ')">' +
            '<div style="font-weight:600;font-size:14px">🐾 ' + escHtml(p.code_name || p.name) + ' <span style="font-size:11px;font-weight:400;color:var(--text-secondary)">' + escHtml(p.species||'') + '</span>' + (statusText ? ' · ' + statusText : '') + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">' + escHtml(p.bio||p.personality||'') + ' · ' + escHtml(p.location||'') + '</div>' +
            '</div>';
        });
        if (pets.length >= 50) { html += '<a onclick="switchPage(\'petPage\')" style="display:block;padding:8px 12px;text-align:center;font-size:13px;color:var(--text-secondary);cursor:pointer;border-top:1px solid var(--border)">查看全部猫狗 →</a>'; }
      }

      // 师说
      if (teachers.length > 0) {
        html += '<div style="padding:12px 0 8px;font-size:13px;color:var(--text-secondary);font-weight:600">👨‍🏫 相关师说 (' + teachers.length + '条)</div>';
        teachers.forEach(t => {
          html += '<div class="wall-post" style="padding:12px;cursor:pointer;margin-bottom:8px;border:1px solid var(--border);border-radius:12px" onclick="openTeacherDetail(' + t.id + ')">' +
            '<div style="font-weight:600;font-size:14px">👨‍🏫 ' + escHtml(t.name) + ' <span style="font-size:11px;font-weight:400;color:var(--text-secondary)">' + escHtml(t.title||'') + '</span></div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">' + escHtml(t.college||'未知学院') + ' · ' + (t.like_count||0) + ' 👍' + '</div>' +
            '</div>';
        });
        if (teachers.length >= 50) { html += '<a onclick="switchPage(\'teacherPage\')" style="display:block;padding:8px 12px;text-align:center;font-size:13px;color:var(--text-secondary);cursor:pointer;border-top:1px solid var(--border)">查看全部教师 →</a>'; }
      }

      // 二手
      if (marketItems.length > 0) {
        html += '<div style="padding:12px 0 8px;font-size:13px;color:var(--text-secondary);font-weight:600">🛒 相关二手 (' + marketItems.length + '条)</div>';
        marketItems.forEach(m => {
          const priceText = m.price ? '¥' + m.price : '免费';
          html += '<div style="padding:12px;cursor:pointer;margin-bottom:8px;border:1px solid var(--border);border-radius:12px;display:flex;justify-content:space-between;align-items:center" onclick="openItemDetail(' + m.id + ')">' +
            '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">🛒 ' + escHtml(m.title) + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">' + escHtml(m.description||'').substring(0, 50) + ' · ' + (m.views||0) + ' 次浏览</div></div>' +
            '<div style="font-weight:600;color:#E74C3C;font-size:14px;flex-shrink:0;margin-left:12px">' + escHtml(priceText) + '</div>' +
            '</div>';
        });
        if (marketItems.length >= 50) { html += '<a onclick="switchPage(\'marketPage\')" style="display:block;padding:8px 12px;text-align:center;font-size:13px;color:var(--text-secondary);cursor:pointer;border-top:1px solid var(--border)">查看全部二手 →</a>'; }
      }

      // 校园墙帖子
      if (posts.length > 0) {
        if (html) html += '<div style="padding:12px 0 8px;font-size:13px;color:var(--text-secondary);font-weight:600;border-top:1px solid var(--border);margin-top:8px">📱 相关帖子 (' + posts.length + '条)</div>';
        html += posts.map(p => renderWallPostCard(p)).join('');
      }

      if (!html) {
        el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary)"><div style="font-size:48px;margin-bottom:12px">🔍</div><div style="font-size:15px">没有找到相关内容</div></div>';
        return;
      }
      el.innerHTML = html;
    }

    function clearGlobalSearch() {
      const input = document.getElementById('globalSearchInput');
      if (input) input.value = '';
      document.getElementById('globalSearchClear').style.display = 'none';
      _wallSearchMode = false;
      _globalSearchClubs = [];
      _globalSearchActs = [];
      _globalSearchPets = [];
      _globalSearchTeachers = [];
      _globalSearchMarket = [];
      _globalSearchClubsTotal = 0;
      _globalSearchActsTotal = 0;
      _globalSearchPetsCount = 0;
      _globalSearchTeachersTotal = 0;
      _globalSearchMarketTotal = 0;
      _globalSearchQuery = '';
      hideGlobalSearchHints();
      if (typeof loadWallFeed === 'function') loadWallFeed();
    }

    async function showGlobalSearchHints() {
      const q = document.getElementById('globalSearchInput').value.trim();
      const hints = document.getElementById('globalSearchHints');
      if (!q) { hints.style.display = 'none'; return; }
      clearTimeout(_globalSearchTimer);
      _globalSearchTimer = setTimeout(async () => {
        let html = '';
        try {
          // 1. 搜索校园墙用户
          const users = await API.wallUsers(q);
          const userList = Array.isArray(users) ? users : [];
          if (userList.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">👤 用户</div>';
            userList.slice(0, 5).forEach(u => {
              html += '<div onclick="showWallUser(\'' + escHtml(u.phone) + '\');hideGlobalSearchHints()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">' +
                '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#FF6B2B,#FF8F5E);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + escHtml((u.nickname||'?')[0]) + '</span>' +
                '<span>' + escHtml(u.nickname||u.phone) + '</span></div>';
            });
          }
        } catch(e) {}
        try {
          // 2. 搜索校园墙帖子
          const data = await API.wallSearch(q, currentUser.phone);
          const posts = Array.isArray(data) ? data : (data && data.value || []);
          if (posts.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">📱 校园墙</div>';
            posts.slice(0, 5).forEach(p => {
              html += '<div onclick="doGlobalSearch()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">' + escHtml((p.content||'').slice(0,60)) + '</div>';
            });
          }
        } catch(e) {}
        try {
          // 3. 搜索社团
          const clubData = await API.getClubs({ search: q, limit: 10 });
          const clubs = Array.isArray(clubData) ? clubData : (clubData && clubData.list || []);
          if (clubs.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">🏘️ 社团</div>';
            clubs.slice(0, 5).forEach(c => {
              html += '<div onclick="showClubDetail(' + c.id + ');hideGlobalSearchHints()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">🏘️ ' + escHtml(c.name) + ' <span style="font-size:10px;color:var(--text-secondary);opacity:0.6">' + (c.member_count||0) + ' 人</span></div>';
            });
          }
        } catch(e) {}
        try {
          // 4. 搜索活动
          const actData = await API.getActivities({ search: q, limit: 10 });
          const acts = Array.isArray(actData) ? actData : (actData && actData.list || []);
          if (acts.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">🎯 活动</div>';
            acts.slice(0, 5).forEach(a => {
              html += '<div onclick="switchPage(\'discoverPage\');switchDiscoverTab(\'activities\');hideGlobalSearchHints()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">🎯 ' + escHtml(a.title) + ' <span style="font-size:10px;color:var(--text-secondary);opacity:0.6">' + (a.signup_count||0) + '/' + (a.max_participants||'∞') + '</span></div>';
            });
          }
        } catch(e) {}
        try {
          // 5. 搜索猫狗日记（仅限宠物姓名）
          const petData = await API.getPets({ search: q, limit: 10 });
          const pets = Array.isArray(petData) ? petData : [];
          if (pets.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">🐱 猫狗</div>';
            pets.slice(0, 5).forEach(p => {
              html += '<div onclick="switchPage(\'petPage\');showPetDetail(' + p.id + ');hideGlobalSearchHints()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">🐾 ' + escHtml(p.code_name||p.name) + ' <span style="font-size:10px;color:var(--text-secondary);opacity:0.6">' + escHtml(p.species||'') + '</span></div>';
            });
          }
        } catch(e) {}
        try {
          // 6. 搜索师说（仅限姓名+毕业院校）
          const teacherData = await API.getTeachers({ search: q, limit: 10 });
          const teachers = Array.isArray(teacherData) ? teacherData : (teacherData && teacherData.teachers || []);
          if (teachers.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">👨‍🏫 师说</div>';
            teachers.slice(0, 5).forEach(t => {
              html += '<div onclick="switchPage(\'teacherPage\');openTeacherDetail(' + t.id + ');hideGlobalSearchHints()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">👨‍🏫 ' + escHtml(t.name) + ' <span style="font-size:10px;color:var(--text-secondary);opacity:0.6">' + escHtml(t.college||'') + '</span></div>';
            });
          }
        } catch(e) {}
        try {
          // 7. 搜索二手市场（仅限标题+内容）
          const marketData = await API.getMarketItems({ search: q, limit: 10 });
          const items = Array.isArray(marketData) ? marketData : (marketData && marketData.items || []);
          if (items.length > 0) {
            html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">🛒 二手</div>';
            items.slice(0, 5).forEach(m => {
              html += '<div onclick="switchPage(\'marketPage\');openItemDetail(' + m.id + ');hideGlobalSearchHints()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">🛒 ' + escHtml(m.title) + '</span><span style="font-size:12px;color:#E74C3C;font-weight:600;flex-shrink:0;margin-left:8px">' + (m.price ? '¥' + m.price : '免费') + '</span></div>';
            });
          }
        } catch(e) {}
        // 8. 搜索服务关键词
        const serviceKeywords = { '外卖': 'delivery', '快递': 'express', '打印': 'print', '跑腿': 'errand', '代买': 'purchase', '洗衣': 'laundry' };
        const matchedServices = Object.entries(serviceKeywords).filter(([k]) => k.includes(q) || q.includes(k));
        if (matchedServices.length > 0) {
          html += '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-weight:600">🛎️ 服务</div>';
          matchedServices.forEach(([name, key]) => {
            html += '<div onclick="showErrandServices()" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">🏃 ' + name + '服务</div>';
          });
        }
        if (!html) html = '<div style="padding:12px;font-size:13px;color:var(--text-secondary);text-align:center">无搜索结果</div>';
        hints.innerHTML = html;
        hints.style.display = 'block';
      }, 300);
    }

    function hideGlobalSearchHints() {
      const hints = document.getElementById('globalSearchHints');
      if (hints) hints.style.display = 'none';
    }

    // 点击外部关闭搜索提示 & 内联操作按钮
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-bar')) hideGlobalSearchHints();
      if (!e.target.closest('.wall-more-btn')) {
        document.querySelectorAll('.wall-inline-actions.open').forEach(el => el.classList.remove('open'));
      }
    });

    window.doGlobalSearch = doGlobalSearch;
    window.clearGlobalSearch = clearGlobalSearch;
    window.showGlobalSearchHints = showGlobalSearchHints;
    window.hideGlobalSearchHints = hideGlobalSearchHints;

    // ═══════════════════════════════════════════════════════
    // 💬 消息轮询（私聊未读提醒）
    // ═══════════════════════════════════════════════════════
    let _chatPollTimer = null;
    let _lastUnreadCount = 0;

    function startChatPolling() {
      if (_chatPollTimer) clearInterval(_chatPollTimer);
      pollChatUnread();
      _chatPollTimer = setInterval(pollChatUnread, 15000); // 每15秒轮询
    }

    async function pollChatUnread() {
      if (!currentUser) return;
      try {
        const data = await API.getChatUnread();
        const count = data.count || 0;
        // 新消息提醒（仅当数量增加时）
        if (count > _lastUnreadCount && _lastUnreadCount >= 0) {
          const newMsgs = count - _lastUnreadCount;
          if (newMsgs > 0 && _lastUnreadCount > 0) {
            showToast('收到 ' + newMsgs + ' 条新消息');
          }
        }
        _lastUnreadCount = count;
        updateMsgBadge();
      } catch(e) {}
    }

    window.startChatPolling = startChatPolling;

    // ═══════════════════════════════════════════════════════
    // 🔔 通知轮询（实时更新通知徽章）
    // ═══════════════════════════════════════════════════════
    let _notifPollTimer = null;
    let _lastNotifCount = 0;

    function startNotifPolling() {
      if (_notifPollTimer) clearInterval(_notifPollTimer);
      pollNotifications();
      _notifPollTimer = setInterval(pollNotifications, 30000); // 每30秒轮询
    }

    async function pollNotifications() {
      if (!currentUser) return;
      try {
        const data = await API.getNotifications(currentUser.phone);
        const newNotifs = Array.isArray(data) ? data : [];
        const newUnread = newNotifs.filter(n => !n.read).length;
        // 新通知提醒
        if (newUnread > _lastNotifCount && _lastNotifCount >= 0 && _lastNotifCount > 0) {
          const diff = newUnread - _lastNotifCount;
          showToast('收到 ' + diff + ' 条新通知');
        }
        _lastNotifCount = newUnread;
        notifications = newNotifs;
        updateMsgBadge();
      } catch(e) {}
    }

    window.startNotifPolling = startNotifPolling;
