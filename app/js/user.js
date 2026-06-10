// user.js - 用户/登录/设置
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码


    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && currentUser) refreshOrders();
    });

    // ══════ INIT ══════
    document.addEventListener('DOMContentLoaded', async () => {
  // 全局401拦截：token过期自动跳转登录（软跳转，不刷新页面）
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    return origFetch.apply(this, args).then(res => {
      if (res.status === 401) {
        const s = JSON.parse(localStorage.getItem('lazy_session') || '{}');
        if (s.role) {
          API.logout();
          currentUser = null;
          clearInterval(window._orderPolling);
          window._orderPolling = null;
          if (typeof showToast === 'function') showToast('登录已过期，请重新登录');
          // 软跳转：清理DOM后显示登录页
          const mainApp = document.querySelector('.main-app');
          if (mainApp) mainApp.innerHTML = '';
          showLoginPage();
        }
      }
      return res;
    });
  };

      const saved = API.restoreSession();
      if (saved && saved.phone) {
        // 如果phone含脱敏标记，清除session要求重新登录
        if (saved.phone.includes('*')) {
          API.logout();
          showLoginPage();
        } else {
          currentUser = { phone: saved.phone, name: saved.name, avatar: saved.avatar || '' };
          var h = document.querySelector('.header .logo-text'); if (h) h.textContent = '你好, ' + (saved.name || '...');
          showMainApp();
          await loadData();
          startOrderPolling();
        }
      } else {
        showLoginPage();
      }
      // 主题
      if (localStorage.getItem('lazyTheme') === 'dark') {
        document.body.classList.add('dark');
        const btn = document.getElementById('themeBtn');
        if (btn) btn.textContent = '...';
      }
    });

    // ══════ 登录页面 ══════

    function showLoginPage() {
      let overlay = document.getElementById('loginOverlay');
      if (!overlay) {
        const app = document.querySelector('.app');
        overlay = document.createElement('div');
        overlay.id = 'loginOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
          <div style="width:100%;max-width:380px;text-align:center">
            <div style="font-size:56px;margin-bottom:8px">🦥</div>
            <h1 style="font-size:22px;font-weight:900;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">校园圈</h1>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:32px">随时随地，帮我干活</p>
            <div style="background:var(--card);border-radius:20px;padding:28px 24px;box-shadow:var(--shadow)">
              <div style="text-align:left;margin-bottom:20px">
                <label style="font-size:13px;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:6px">您的称呼</label>
                <input id="loginName" type="text" placeholder="怎么称呼您？" style="width:100%;padding:12px 14px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
              </div>
              <div style="text-align:left;margin-bottom:24px">
                <label style="font-size:13px;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:6px">手机号码</label>
                <input id="loginPhone" type="tel" placeholder="请输入手机号" maxlength="11" style="width:100%;padding:12px 14px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
              </div>
              <button id="loginBtn" onclick="doLogin()" style="width:100%;padding:14px;border:none;border-radius:14px;background:var(--gradient);color:white;font-size:16px;font-weight:700;cursor:pointer">
                登录 / 注册
              </button>
              <p style="font-size:12px;color:var(--text-light);margin-top:14px">登录即表示同意《用户协议》</p>
            </div>
          </div>`;
        app.parentNode.insertBefore(overlay, app.nextSibling);
        // 暗色模式样式
        const s = document.createElement('style');
        s.textContent = `body.dark #loginOverlay{background:#0D1117!important}body.dark #loginOverlay input{background:#161B22!important;border-color:#30363D!important;color:#E6EDF3!important}`;
        document.head.appendChild(s);
      }
      overlay.style.display = 'flex';
    }



    async function doLogin() {
      const btn = document.getElementById('loginBtn');
      const name = document.getElementById('loginName').value.trim();
      const phone = document.getElementById('loginPhone').value.trim();
      if (!name) { showToast('请输入您的称呼'); return; }
      if (!phoneRegex.test(phone)) { showToast('请输入正确的手机号码'); return; }
      btn.textContent = '登录中...';
      btn.disabled = true;
      try {
        const res = await API.userLogin(name, phone);
        const userPhone = res.phone || phone;
        const userName = res.name || name;
        currentUser = { name: userName, phone: userPhone };
        localStorage.setItem('lazy_session', JSON.stringify({ role: 'user', phone: userPhone, name: userName }));
        document.getElementById('loginOverlay').style.display = 'none';
        var h = document.querySelector('.header .logo-text'); if (h) h.textContent = '你好, ' + userName;
        showMainApp();
        await loadData();
        startOrderPolling();
        showToast('欢迎回来！');
      } catch(e) {
        showToast('登录失败: ' + (e.message || '请重试'));
        console.error('doLogin error:', e);
      } finally {
        btn.textContent = '登录 / 注册';
        btn.disabled = false;
      }
    }


    // ═══════════════════════════════════════════════════════
    // ⚙️ 设置
    // ═══════════════════════════════════════════════════════

    function showSettings() {
      if (!currentUser) return showToast(_t('loginFirst'));
      const isDark = document.body.classList.contains('dark');
      // 加载私聊隐私设置
      API.getChatPrivacy(currentUser.phone).then(pr => {
        const curPrivacy = pr.privacy || 'all';
        const privacyLabels = { all: '所有人', mutual: '互相关注', followers: '关注我的人' };
        let el = document.getElementById('settingsPage_sub');
        if (!el) {
          el = document.createElement('div');
          el.id = 'settingsPage_sub';
          el.className = 'sub-page';
          el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'settingsPage_sub\')">←</button><span class="sub-page-title">' + _t('settingsTitle') + '</span></div><div class="sub-page-body"></div>';
          document.body.appendChild(el);
        }
        el.querySelector('.sub-page-body').innerHTML =
          '<div class="settings-section">' +
          '<div class="settings-section-title">' + _t('settingsAppearance') + '</div>' +
          '<div class="settings-item">' +
          '<div class="settings-item-left">' + _t('darkMode') + '</div>' +
          '<label class="toggle-switch"><input type="checkbox" id="darkToggle" ' + (isDark ? 'checked' : '') + ' onchange="toggleDark(this.checked)"><span class="toggle-track ' + (isDark?'on':'off') + '"></span><span class="toggle-thumb ' + (isDark?'on':'off') + '"></span></label>' +
          '</div>' +
          '<div class="settings-item" style="cursor:pointer" onclick="toggleLanguage()">' +
          '<div class="settings-item-left">' + _t('languageLabel') + '</div>' +
          '<div class="settings-item-right" style="font-weight:600;color:var(--primary)">' + (_lang === 'zh' ? '中文' : 'English') + ' ›</div>' +
          '</div></div>' +
          '<div class="settings-section">' +
          '<div class="settings-section-title">🔐 隐私设置</div>' +
          '<div class="settings-item" style="cursor:pointer" onclick="showChatPrivacyOptions()">' +
          '<div class="settings-item-left">💬 谁可以私聊我</div>' +
          '<div class="settings-item-right" style="font-weight:600;color:var(--primary)" id="chatPrivacyLabel">' + privacyLabels[curPrivacy] + ' ›</div>' +
          '</div>' +
          '<div class="settings-item" style="cursor:pointer" onclick="showWallPrivacySettings()">' +
          '<div class="settings-item-left">👁️ 校园墙隐私设置</div>' +
          '<div class="settings-item-right" style="font-weight:600;color:var(--primary)">谁可以看我的信息 ›</div>' +
          '</div>' +
          '<div class="settings-item" style="cursor:pointer" onclick="showBlockList()">' +
          '<div class="settings-item-left">🚫 黑名单</div>' +
          '<div class="settings-item-right" style="font-weight:600;color:var(--primary)" id="blockCountLabel">查看 ›</div>' +
          '</div></div>' +
          '<div class="settings-section">' +
          '<div class="settings-section-title">' + _t('settingsAccount') + '</div>' +
          '<div class="settings-item">' +
          '<div class="settings-item-left">' + _t('phoneLabel') + '</div>' +
          '<div class="settings-item-right">' + escHtml(currentUser.phone) + '</div>' +
          '</div></div>' +
          '<button class="settings-logout-btn" onclick="if(confirm(_t(\'logoutConfirm\'))){localStorage.removeItem(\'lazyUser\');location.reload()}">' + _t('logoutBtn') + '</button>' +
          '<div class="settings-version">' + _t('versionText') + '</div>';
        openSubPage('settingsPage_sub');
      });
    }

    function toggleLanguage() {
      setLang(_lang === 'zh' ? 'en' : 'zh');
    }

    function toggleDark(on) {
      if (on) { document.body.classList.add('dark'); } else { document.body.classList.remove('dark'); }
      localStorage.setItem('lazyTheme', on ? 'dark' : 'light');
      const btn = document.getElementById('themeBtn');
      if (btn) btn.textContent = on ? '☀️' : '🌙';
      closeSubPage('settingsPage_sub');
      setTimeout(() => showSettings(), 200);
    }


    // ═══════════════════════════════════════════════════════
    // 👤 用户资料编辑
    // ═══════════════════════════════════════════════════════

    async function showUserProfile() {
      if (!currentUser) return showToast('请先登录');
      const u = await API.getUser(currentUser.phone);
      if (!u) return showToast(_t('loadFailed'));
      const avatars = ['\u{1F9A5}','\u{1F431}','\u{1F436}','\u{1F98A}','\u{1F43C}','\u{1F428}','\u{1F984}','\u{1F438}','\u{1F427}','\u{1F98B}','\u{1F338}','\u2B50','\u{1F525}','\u{1F48E}','\u{1F3AD}'];
      const curAvatar = u.avatar || '\u{1F9A5}';
      const curBg = u.bg_image || '';
      const isUrl = curAvatar && (curAvatar.startsWith('/') || curAvatar.startsWith('http'));
      const avatarPreviewHtml = isUrl
        ? '<img src="' + curAvatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />'
        : (curAvatar || '\u{1F9A5}');
      const bgStyle = curBg ? ' style="background-image:url(' + escHtml(curBg) + ');background-size:cover;background-position:center"' : '';
      let el = document.getElementById('profilePage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'profilePage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'profilePage_sub\')">\u2190</button><span class="sub-page-title">\u{1F464} 个人资料</span></div><div class="sub-page-body"></div>';
        document.body.appendChild(el);
      }
      el.querySelector('.sub-page-body').innerHTML =
        '<div class="profile-hero"'+bgStyle+'>' +
        '<div class="profile-hero-overlay"></div>' +
        '<div class="profile-hero-inner">' +
        '<div class="profile-avatar-big" id="profileAvatarPreview" style="cursor:pointer;position:relative;overflow:hidden;z-index:1" onclick="document.getElementById(\'userAvatarInput\').click()">' + avatarPreviewHtml + '</div>' +
        '<div class="profile-avatar-label" style="z-index:1;color:#fff">点击头像上传照片，或在下方选择emoji</div>' +
        '<div style="z-index:1;margin-top:6px"><label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.2);color:#fff;padding:8px 16px;border-radius:20px;font-size:13px">\u{1F3A8} 更换封面背景<input type="file" id="userBgInput" accept="image/*" style="display:none" onchange="uploadUserBg(this)" /></label>' +
        '</div>' +
        '</div>' +
        '<input type="file" id="userAvatarInput" accept="image/*" style="display:none" onchange="uploadUserAvatar(this)" />' +
        '<div class="profile-avatar-grid">' +
        avatars.map(a => '<div class="profile-avatar-option' + (a === curAvatar ? ' selected' : '') + '" data-avatar="' + a + '" onclick="selectProfileAvatar(this,\'' + a + '\')">' + a + '</div>').join('') +
        '</div>' +
        '<div class="profile-form-card">' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u270F\uFE0F</span><span class="profile-form-label">昵称</span><input type="text" class="profile-form-input" id="profileNickname" value="' + escHtml(u.nickname || '') + '" placeholder="给自己取个昵称" maxlength="20" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F464}</span><span class="profile-form-label">姓名</span><input type="text" class="profile-form-input" id="profileName" value="' + escHtml(u.name || '') + '" placeholder="选填" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F4AD}</span><span class="profile-form-label">签名</span><input type="text" class="profile-form-input" id="profileBio" value="' + escHtml(u.bio || '') + '" placeholder="一句话介绍自己" maxlength="50" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F4F1}</span><span class="profile-form-label">电话</span><input type="text" class="profile-form-input" id="profilePhone" value="' + escHtml(u.phone || '') + '" readonly style="opacity:0.7" /></div>' +
        
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F4AC}</span><span class="profile-form-label">微信号</span><input type="text" class="profile-form-input" id="profileWechat" value="' + escHtml(u.wechat || '') + '" placeholder="选填" maxlength="50" /></div>' +
        
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F427}</span><span class="profile-form-label">QQ号</span><input type="text" class="profile-form-input" id="profileQQ" value="' + escHtml(u.qq || '') + '" placeholder="选填" maxlength="20" /></div>' +
        
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F3E0}</span><span class="profile-form-label">宿舍楼</span><input type="text" class="profile-form-input" id="profileDorm" value="' + escHtml(u.dormitory || '') + '" placeholder="例如：3号宿舍楼" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F6AA}</span><span class="profile-form-label">房间号</span><input type="text" class="profile-form-input" id="profileRoom" value="' + escHtml(u.room || '') + '" placeholder="例如：301" /></div>' +
        '</div>' +
        '<input type="hidden" id="profileAvatar" value="' + escHtml(curAvatar) + '" />' +
        '<input type="hidden" id="profileBg" value="' + escHtml(curBg) + '" />' +

        '<button class="profile-save-btn" onclick="saveProfile()">\u{1F4BE} 保存修改</button>';
      openSubPage('profilePage_sub');
    }

    function selectProfileAvatar(el, emoji) {
      document.querySelectorAll('.profile-avatar-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('profileAvatar').value = emoji;
      document.getElementById('profileAvatarPreview').textContent = emoji;
    }

    async function saveProfile() {
      if (!currentUser) return;
      const data = {
        nickname: document.getElementById('profileNickname').value.trim(),
        name: document.getElementById('profileName').value.trim(),
        bio: document.getElementById('profileBio').value.trim(),
        dormitory: document.getElementById('profileDorm').value.trim(),
        room: document.getElementById('profileRoom').value.trim(),
        avatar: document.getElementById('profileAvatar').value,
        bg_image: document.getElementById('profileBg').value,

        wechat: document.getElementById('profileWechat').value.trim(),
        qq: document.getElementById('profileQQ').value.trim(),
        wall_privacy: _wallPrivacyDraft
      };
      try {
        const res = await API.updateUser(currentUser.phone, data);
        if (res.error) return showToast(res.error);
        showToast('\u2705 保存成功');
        closeSubPage('profilePage_sub');
        updateMePage();
      } catch(e) { showToast('保存失败'); }
    }


    // ═══════════════════════════════════════════════════════
    // \u{1F4F7} 用户头像上传
    // ═══════════════════════════════════════════════════════

    async function uploadUserAvatar(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (!file.type.startsWith('image/')) { showToast('请选择图片文件'); return; }
      if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB'); return; }
      try {
        showToast('上传中...');
        const res = await API.uploadUserAvatar(currentUser.phone, file);
        if (res.code === 0 || res.avatarUrl) {
          currentUser.avatar = res.avatarUrl || res.data?.avatarUrl;
          localStorage.setItem('lazyUser', JSON.stringify(currentUser));
          // 同步更新 lazy_session 中的 avatar
          try {
            const s = JSON.parse(localStorage.getItem('lazy_session') || '{}');
            s.avatar = currentUser.avatar;
            localStorage.setItem('lazy_session', JSON.stringify(s));
          } catch(e) {}
          showToast('头像更新成功 \u2705');
          // 更新预览
          const preview = document.getElementById('profileAvatarPreview');
          if (preview) {
            preview.innerHTML = '<img src="' + currentUser.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
          }
          document.getElementById('profileAvatar').value = currentUser.avatar;
          // 取消 emoji 选中
          document.querySelectorAll('.profile-avatar-option').forEach(e => e.classList.remove('selected'));
          updateMePage();
        } else {
          showToast(res.message || '上传失败');
        }
      } catch(e) {
        showToast('上传失败: ' + (e.message||''));
      }
      input.value = '';
    }

    // ═══════════════════════════════════════════════════════
    // \u{1F3A8} 封面背景上传
    // ═══════════════════════════════════════════════════════

    async function uploadUserBg(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (!file.type.startsWith('image/')) { showToast('请选择图片文件'); return; }
      if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB'); return; }
      try {
        showToast('上传封面中...');
        const res = await API.uploadUserCover(currentUser.phone, file);
        if (res.bgImageUrl) {
          document.getElementById('profileBg').value = res.bgImageUrl;
          var hero = document.querySelector('#profilePage_sub .profile-hero');
          if (hero) { hero.style.backgroundImage = 'url(' + res.bgImageUrl + ')'; hero.style.background = ''; }
          showToast('封面上传成功 \u2705');
        } else {
          showToast(res.message || '上传失败');
        }
      } catch(e) {
        showToast('上传失败: ' + (e.message||''));
      }
      input.value = '';
    }

// ── Window exports ──
window.showLoginPage = showLoginPage;
window.doLogin = doLogin;

    // ═══════════════════════════════════════════════════════
    // 🔒 校园墙隐私设置
    // ═══════════════════════════════════════════════════════
    const PRIVACY_LEVELS = [
      { v:0, label:'所有人可见', icon:'🌍' },
      { v:1, label:'仅粉丝可见', icon:'👥', desc:'关注我的人可以看到' },
      { v:2, label:'仅我关注的', icon:'👤', desc:'我只关注的人可以看到' },
      { v:3, label:'互相关注', icon:'🤝', desc:'互相follow的人可以看到' },
      { v:4, label:'仅自己可见', icon:'🔒' }
    ];
    var _wallPrivacyDraft = null;

    async function showWallPrivacySettings() {
      if (!currentUser) return showToast('请先登录');
      const u = await API.getUser(currentUser.phone);
      let wp = {};
      try { if (u.wall_privacy) wp = JSON.parse(u.wall_privacy); } catch(e) {}
      _wallPrivacyDraft = JSON.parse(JSON.stringify(wp));

      const fields = [
        { key:'phone', label:'📱 电话号码', desc:'别人在校园墙看到你的号码' },
        { key:'qq', label:'🐧 QQ号', desc:'别人在校园墙看到你的QQ' },
        { key:'wechat', label:'💬 微信号', desc:'别人在校园墙看到你的微信' },
        { key:'name', label:'👤 真实姓名', desc:'别人在校园墙看到你的真实姓名' },
        { key:'bio', label:'📝 个性签名', desc:'别人在校园墙看到你的签名' },
        { key:'dorm', label:'🏠 宿舍信息', desc:'宿舍楼+房间号是否可见' }
      ];

      let html = '<div class="profile-form-card" style="margin:0">';
      html += '<div style="padding:12px 16px;background:rgba(255,107,43,0.06);border-bottom:1px solid var(--border);font-size:13px;color:var(--text-secondary)">💡 以下设置控制其他用户在查看你的校园墙主页时，能否看到你的个人信息</div>';
      fields.forEach(f => {
        const curVal = _wallPrivacyDraft[f.key] != null ? _wallPrivacyDraft[f.key] : 0;
        html += '<div class="privacy-field">';
        html += '<div class="privacy-field-header"><span class="privacy-field-label">' + f.label + '</span><span class="privacy-field-desc">' + f.desc + '</span></div>';
        html += '<div class="privacy-field-options">';
        PRIVACY_LEVELS.forEach(l => {
          html += '<label class="privacy-option' + (curVal === l.v ? ' active' : '') + '" onclick="selectPrivacyLevel(this,\'' + f.key + '\',' + l.v + ')">';
          html += '<span class="privacy-option-icon">' + l.icon + '</span>';
          html += '<span class="privacy-option-label">' + l.label + '</span>';
          if (l.desc) html += '<span class="privacy-option-desc">' + l.desc + '</span>';
          html += '</label>';
        });
        html += '</div></div>';
      });
      html += '</div>';
      html += '<button class="profile-save-btn" style="margin-top:16px" onclick="saveWallPrivacy()">💾 保存隐私设置</button>';

      let el = document.getElementById('wallPrivacyPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'wallPrivacyPage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'wallPrivacyPage_sub\')">←</button><span class="sub-page-title">👁️ 校园墙隐私设置</span></div><div class="sub-page-body"></div>';
        document.body.appendChild(el);
      }
      el.querySelector('.sub-page-body').innerHTML = html;
      openSubPage('wallPrivacyPage_sub');
    }

    function selectPrivacyLevel(el, key, value) {
      _wallPrivacyDraft[key] = value;
      const parent = el.parentElement;
      parent.querySelectorAll('.privacy-option').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
    }

    async function saveWallPrivacy() {
      if (!currentUser) return;
      try {
        const res = await API.updateUser(currentUser.phone, { wall_privacy: _wallPrivacyDraft });
        if (res.error) return showToast(res.error);
        showToast('✅ 隐私设置已保存');
        closeSubPage('wallPrivacyPage_sub');
        updateMePage();
      } catch(e) {
        showToast('保存失败: ' + e.message);
      }
    }

    window.showSettings = showSettings;
window.showWallPrivacySettings = showWallPrivacySettings;
window.selectPrivacyLevel = selectPrivacyLevel;
window.saveWallPrivacy = saveWallPrivacy;
window.toggleLanguage = toggleLanguage;
window.toggleDark = toggleDark;
window.showUserProfile = showUserProfile;
window.selectProfileAvatar = selectProfileAvatar;
window.saveProfile = saveProfile;
window.uploadUserAvatar = uploadUserAvatar;
window.uploadUserBg = uploadUserBg;
