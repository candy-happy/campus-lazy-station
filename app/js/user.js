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
      if (saved && (saved.phone || saved.student_id)) {
        // 如果phone含脱敏标记，清除session要求重新登录
        if (saved.phone && saved.phone.includes('*')) {
          API.logout();
          showLoginPage();
        } else {
          currentUser = { student_id: saved.student_id, phone: saved.phone || '', name: saved.name || '', nickname: saved.nickname || '', avatar: saved.avatar || '' };
          var h = document.querySelector('.header .logo-text'); if (h) h.textContent = '你好, ' + (saved.nickname || saved.name || '...');
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
        overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;background:var(--bg);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
          <div style="width:100%;max-width:380px;text-align:center">
            <div style="font-size:56px;margin-bottom:8px">🦥</div>
            <h1 style="font-size:22px;font-weight:900;color:var(--primary);background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">校园圈</h1>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:32px">随时随地，帮我干活</p>
            <div style="background:var(--card);border-radius:20px;padding:28px 24px;box-shadow:var(--shadow)">
              <div style="text-align:left;margin-bottom:20px">
                <label style="font-size:13px;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:6px">学号</label>
                <input id="loginStudentId" type="text" placeholder="请输入9位学号" maxlength="9" inputmode="numeric" pattern="[0-9]*" style="width:100%;padding:12px 14px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
              </div>
              <div style="text-align:left;margin-bottom:16px">
                <label style="font-size:13px;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:6px">密码</label>
                <input id="loginPassword" type="password" placeholder="请输入密码" style="width:100%;padding:12px 14px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
                <p style="font-size:11px;color:var(--text-secondary);margin-top:4px">首次登录默认密码：shoujihao</p>
              </div>
              <div style="text-align:left;margin-bottom:24px">
                <label style="font-size:13px;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:6px">验证码</label>
                <div style="display:flex;gap:10px;align-items:center">
                  <input id="loginCaptcha" type="text" placeholder="4位数字" maxlength="4" style="flex:1;padding:12px 14px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;min-width:0" />
                  <img id="captchaImg" src="" alt="验证码" onclick="refreshCaptcha()" style="height:44px;border-radius:10px;cursor:pointer;border:2px solid var(--border);flex-shrink:0" title="点击刷新验证码" />
                </div>
              </div>
              <button id="loginBtn" onclick="doLogin()" style="width:100%;padding:14px;border:none;border-radius:14px;background:var(--gradient);color:white;font-size:16px;font-weight:700;cursor:pointer">
                登录 / 注册
              </button>
              <div style="margin-top:16px;text-align:left">
                <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;color:var(--text-secondary);line-height:1.6">
                  <input type="checkbox" id="agreeTerms" onchange="updateLoginBtn()" style="margin-top:2px;flex-shrink:0;accent-color:var(--primary);width:16px;height:16px" />
                  <span>我已阅读并同意<br><a href="javascript:void(0)" onclick="showTermsModal('terms')" style="color:var(--primary);text-decoration:underline">《服务条款》</a> 和 <a href="javascript:void(0)" onclick="showTermsModal('privacy')" style="color:var(--primary);text-decoration:underline">《隐私协议》</a></span>
                </label>
              </div>
            </div>
          </div>`;
        app.parentNode.insertBefore(overlay, app.nextSibling);
        // 暗色模式样式
        const s = document.createElement('style');
        s.textContent = `body.dark #loginOverlay{background:#0D1117!important}body.dark #loginOverlay input{background:#161B22!important;border-color:#30363D!important;color:#E6EDF3!important}`;
        document.head.appendChild(s);
      }
      overlay.style.display = 'flex';
      setTimeout(() => updateLoginBtn(), 0);
      setTimeout(() => refreshCaptcha(), 100);
    }

    var _captchaKey = '';
    function refreshCaptcha() {
      const sid = document.getElementById('loginStudentId')?.value?.trim() || 'default';
      _captchaKey = sid;
      const img = document.getElementById('captchaImg');
      if (img) img.src = '/api/captcha?phone=' + encodeURIComponent(sid) + '&t=' + Date.now();
    }


    function updateLoginBtn() {
      const btn = document.getElementById('loginBtn');
      const cb = document.getElementById('agreeTerms');
      if (btn) {
        btn.disabled = !cb.checked;
        btn.style.opacity = cb.checked ? '1' : '0.5';
      }
    }

    function showTermsModal(type) {
      // 移除已有弹窗
      const old = document.getElementById('termsOverlay');
      if (old) old.remove();
      const overlay = document.createElement('div');
      overlay.id = 'termsOverlay';
      overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:var(--bg);display:flex;flex-direction:column';
      overlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);flex-shrink:0"><div style="display:flex;gap:0"><button id="termsTabTerms" style="padding:8px 16px;border:none;background:none;font-size:14px;font-weight:600;color:var(--primary);border-bottom:2px solid var(--primary);cursor:pointer;font-family:inherit" onclick="switchTermsTab(\'terms\')">服务条款</button><button id="termsTabPrivacy" style="padding:8px 16px;border:none;background:none;font-size:14px;font-weight:600;color:var(--text-light);cursor:pointer;font-family:inherit" onclick="switchTermsTab(\'privacy\')">隐私协议</button></div><button onclick="closeTermsModal()" style="width:32px;height:32px;border-radius:50%;border:none;background:var(--bg);font-size:16px;cursor:pointer;color:var(--text-secondary);display:flex;align-items:center;justify-content:center">✕</button></div><iframe id="termsFrame" src="/public/terms.html" style="flex:1;width:100%;border:none"></iframe>';
      document.body.appendChild(overlay);
      // 初始tab
      setTimeout(() => {
        const frame = document.getElementById('termsFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ action: 'switchTab', tab: type }, '*');
        }
      }, 500);
      window._termsMsgHandler = function(e) {
        if (e.data === 'closeTerms' || (e.data && e.data.action === 'closeTerms')) {
          document.getElementById('termsOverlay').remove();
          window.removeEventListener('message', window._termsMsgHandler);
          delete window._termsMsgHandler;
          delete window.closeTermsModal;
          delete window.switchTermsTab;
        }
      };
      window.addEventListener('message', window._termsMsgHandler);
      window.closeTermsModal = function() {
        document.getElementById('termsOverlay').remove();
        window.removeEventListener('message', window._termsMsgHandler);
        delete window._termsMsgHandler;
        delete window.closeTermsModal;
        delete window.switchTermsTab;
      };
      window.switchTermsTab = function(tab) {
        document.getElementById('termsTabTerms').style.color = tab==='terms'?'var(--primary)':'var(--text-light)';
        document.getElementById('termsTabTerms').style.borderBottom = tab==='terms'?'2px solid var(--primary)':'none';
        document.getElementById('termsTabPrivacy').style.color = tab==='privacy'?'var(--primary)':'var(--text-light)';
        document.getElementById('termsTabPrivacy').style.borderBottom = tab==='privacy'?'2px solid var(--primary)':'none';
        const frame = document.getElementById('termsFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ action: 'switchTab', tab: tab }, '*');
        }
      };
    }

    async function doLogin() {
      const btn = document.getElementById('loginBtn');
      const studentId = document.getElementById('loginStudentId').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const captchaInput = document.getElementById('loginCaptcha').value.trim();
      if (!/^\d{9}$/.test(studentId)) { showToast('请输入正确的9位学号'); return; }
      if (!password) { showToast('请输入密码'); return; }
      if (!captchaInput) { showToast('请输入验证码'); return; }
      if (captchaInput.length !== 4) { showToast('请输入4位验证码'); return; }
      if (!document.getElementById('agreeTerms').checked) { showToast('请先阅读并同意服务条款和隐私协议'); return; }
      btn.textContent = '登录中...';
      btn.disabled = true;
      try {
        const res = await API.userLogin(studentId, password, captchaInput, _captchaKey);
        currentUser = { student_id: studentId, phone: res.phone || studentId, name: res.name || '同学', nickname: res.nickname || '' };
        localStorage.setItem('lazy_session', JSON.stringify({ role: 'user', student_id: studentId, phone: res.phone || studentId, name: res.name || '同学', nickname: res.nickname || '' }));
        document.getElementById('loginOverlay').style.display = 'none';
        var h = document.querySelector('.header .logo-text'); if (h) h.textContent = '你好, ' + (res.nickname || res.name || '同学');
        showMainApp();
        await loadData();
        startOrderPolling();
        showToast(res.isNewUser ? '🎉 首次登录，默认密码为 shoujihao，记得去设置修改哦' : '欢迎回来！');
      } catch(e) {
        const msg = e.message || '';
        const code = e.code || '';
        // 密码错误 → 抖动密码框
        if (msg.includes('密码') && !msg.includes('验证码')) {
          const pwEl = document.getElementById('loginPassword');
          if (pwEl) { pwEl.style.borderColor = '#e74c3c'; pwEl.style.animation = 'shake 0.4s ease'; setTimeout(() => { pwEl.style.borderColor = ''; pwEl.style.animation = ''; }, 500); }
          if (msg.includes('首次登录')) { showToast(msg + '，请重试', 4500); }
          else { showToast('密码错误，请重试'); }
          document.getElementById('loginPassword').value = '';
        }
        // 验证码错误 → 刷新验证码
        else if (msg.includes('验证码')) {
          const cpEl = document.getElementById('loginCaptcha');
          if (cpEl) { cpEl.style.borderColor = '#e74c3c'; cpEl.style.animation = 'shake 0.4s ease'; setTimeout(() => { cpEl.style.borderColor = ''; cpEl.style.animation = ''; }, 500); }
          refreshCaptcha();
          document.getElementById('loginCaptcha').value = '';
          showToast('验证码错误，请重新输入');
        }
        // 请求频繁 → 显示重试倒计时
        else if (code === 'RATE_001' && e.retryAfter) {
          showToast('登录尝试过多，请 ' + e.retryAfter + ' 秒后重试', 4000);
        }
        // 其他错误
        else {
          showToast(msg || '网络异常，请重试');
        }
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
      const curPhone = currentUser.phone && /^1[3-9]\d{9}$/.test(currentUser.phone) ? currentUser.phone : '';
      const displayPhone = curPhone || currentUser.student_id || '';
      const hasPhone = !!curPhone;
      API.getChatPrivacy(curPhone || displayPhone).then(pr => {
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
          (currentUser.student_id ? '<div class="settings-item"><div class="settings-item-left">🎓 学号</div><div class="settings-item-right">' + escHtml(currentUser.student_id) + '</div></div>' : '') +
          (hasPhone ? '<div class="settings-item"><div class="settings-item-left">' + _t('phoneLabel') + '</div><div class="settings-item-right">' + escHtml(curPhone) + '</div></div>' : '') +
          '<div class="settings-item" style="cursor:pointer" onclick="showChangePassword()">' +
          '<div class="settings-item-left">🔑 修改密码</div>' +
          '<div class="settings-item-right" style="font-weight:600;color:var(--primary)">›</div>' +
          '</div>' +
          '</div>' +
          '<button class="settings-logout-btn" onclick="if(confirm(_t(\'logoutConfirm\'))){API.logout();location.reload()}">' + _t('logoutBtn') + '</button>' +
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

    // ─── 修改密码弹窗 ────────────────────────────────────
    var _verifiedOldPwd = ''; // 已验证通过的旧密码

    function showChangePassword() {
      const old = document.getElementById('changePwdOverlay');
      if (old) old.remove();
      _verifiedOldPwd = '';
      const overlay = document.createElement('div');
      overlay.id = 'changePwdOverlay';
      overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div class="change-pwd-card" style="background:var(--card);border-radius:20px;padding:28px 24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <h3 style="font-size:18px;font-weight:700;margin-bottom:20px;text-align:center">🔑 修改密码</h3>
          <p id="changePwdHint" style="font-size:12px;color:var(--text-secondary);text-align:center;margin-bottom:16px">请先验证旧密码</p>
          <div id="changePwdStep1">
            <div style="margin-bottom:16px">
              <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:6px">旧密码</label>
              <input id="changePwdOld" type="password" placeholder="输入旧密码" autocomplete="new-password" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
            </div>
            <div style="display:flex;gap:10px">
              <button onclick="document.getElementById('changePwdOverlay').remove()" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font-size:15px;cursor:pointer;font-family:inherit">取消</button>
              <button id="changePwdVerify" onclick="doVerifyOldPassword()" style="flex:1;padding:12px;border:none;border-radius:12px;background:var(--gradient);color:white;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">验证</button>
            </div>
          </div>
          <div id="changePwdStep2" style="display:none">
            <div style="margin-bottom:12px">
              <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:6px">新密码</label>
              <input id="changePwdNew" type="password" placeholder="新密码（至少6位）" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
            </div>
            <div style="margin-bottom:16px">
              <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:6px">确认新密码</label>
              <input id="changePwdNew2" type="password" placeholder="再次输入新密码" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box" />
            </div>
            <div style="display:flex;gap:10px">
              <button onclick="showChangePassword()" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font-size:15px;cursor:pointer;font-family:inherit">← 返回</button>
              <button id="changePwdSubmit" onclick="doChangePassword()" style="flex:1;padding:12px;border:none;border-radius:12px;background:var(--gradient);color:white;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">确认修改</button>
            </div>
          </div>
        </div>`;
      overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      setTimeout(() => {
        const inp = document.getElementById('changePwdOld');
        if (inp) { inp.value = ''; inp.focus(); }
      }, 150);
    }

    // 第一步：验证旧密码
    async function doVerifyOldPassword() {
      const oldPwd = document.getElementById('changePwdOld').value.trim();
      const btn = document.getElementById('changePwdVerify');
      if (!oldPwd) return showToast('请输入旧密码');
      btn.textContent = '验证中...';
      btn.disabled = true;
      try {
        const valid = await API.verifyPassword(oldPwd);
        if (!valid) {
          showToast('❌ 旧密码不正确');
          return;
        }
        _verifiedOldPwd = oldPwd;
        // 切换到第二步
        document.getElementById('changePwdStep1').style.display = 'none';
        document.getElementById('changePwdStep2').style.display = 'block';
        document.getElementById('changePwdHint').textContent = '旧密码验证通过，请设置新密码';
        document.getElementById('changePwdHint').style.color = '#22c55e';
        setTimeout(() => document.getElementById('changePwdNew')?.focus(), 100);
      } catch(e) {
        showToast('验证失败: ' + (e.message || '请重试'));
      } finally {
        btn.textContent = '验证';
        btn.disabled = false;
      }
    }

    // 第二步：修改密码（需两次输入一致）
    async function doChangePassword() {
      const newPwd = document.getElementById('changePwdNew').value.trim();
      const newPwd2 = document.getElementById('changePwdNew2').value.trim();
      const btn = document.getElementById('changePwdSubmit');
      if (!newPwd) return showToast('请输入新密码');
      if (newPwd.length < 6) return showToast('新密码长度至少6位');
      if (newPwd !== newPwd2) return showToast('两次输入的新密码不一致');
      if (newPwd === _verifiedOldPwd) return showToast('新密码不能与旧密码相同');
      btn.textContent = '修改中...';
      btn.disabled = true;
      try {
        await API.changePassword(_verifiedOldPwd, newPwd);
        showToast('✅ 密码修改成功');
        document.getElementById('changePwdOverlay').remove();
      } catch(e) {
        showToast('修改失败: ' + (e.message || '请重试'));
      } finally {
        btn.textContent = '确认修改';
        btn.disabled = false;
      }
    }


    // ═══════════════════════════════════════════════════════
    // 👤 用户资料编辑
    // ═══════════════════════════════════════════════════════

    async function showUserProfile() {
      if (!currentUser) return showToast('请先登录');
      const u = await API.getUser(currentUser.phone);
      if (!u) return showToast(_t('loadFailed'));
      const curAvatar = u.avatar || '\u{1F9A5}';
      const curBg = u.bg_image || '';
      const isUrl = curAvatar && (curAvatar.startsWith('/') || curAvatar.startsWith('http'));
      const avatarPreviewHtml = isUrl
        ? '<img src="' + curAvatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />'
        : (curAvatar || '\u{1F9A5}');
      const bgStyle = curBg ? ' style="background:url(' + escHtml(curBg) + ') center/cover no-repeat"' : '';
      let el = document.getElementById('profilePage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'profilePage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'profilePage_sub\')">\u2190</button><span class="sub-page-title">\u{1F464} 个人资料</span></div><div class="sub-page-body"></div>';
        document.body.appendChild(el);
      }
      const heroPart = '<div class="profile-hero' + (curBg ? ' has-bg' : '') + '"'+bgStyle+'>' +
        '<div class="profile-hero-inner">' +
        '<div class="profile-avatar-big" id="profileAvatarPreview" onclick="document.getElementById(\'userAvatarInput\').click()">' + avatarPreviewHtml + '<div class="profile-avatar-hint">📷</div></div>' +
        '<div class="profile-hero-actions">' +
        '<label class="profile-hero-btn"><input type="file" id="userBgInput" style="display:none" onchange="uploadUserBg(this)" />🎨 更换封面</label>' +
        '<label class="profile-hero-btn" style="background:transparent;border:1.5px solid rgba(255,255,255,0.55)"><input type="file" id="userAvatarInput" style="display:none" onchange="uploadUserAvatar(this)" />📷 上传头像</label>' +
        '</div>' +
        '</div>' +
        '</div>';
      const formPart = '<div class="profile-form-card">' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u270F\uFE0F</span><span class="profile-form-label">昵称</span><input type="text" class="profile-form-input" id="profileNickname" value="' + escHtml(u.nickname || '') + '" placeholder="给自己取个昵称" maxlength="20" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F464}</span><span class="profile-form-label">姓名</span><input type="text" class="profile-form-input" id="profileName" value="' + escHtml(u.name || '') + '" placeholder="选填" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F4AD}</span><span class="profile-form-label">签名</span><input type="text" class="profile-form-input" id="profileBio" value="' + escHtml(u.bio || '') + '" placeholder="一句话介绍自己" maxlength="50" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F4F1}</span><span class="profile-form-label">电话</span><input type="text" class="profile-form-input" id="profilePhone" value="' + escHtml(u.phone || '') + '" readonly style="opacity:0.7" /></div>' +
        
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F4AC}</span><span class="profile-form-label">微信号</span><input type="text" class="profile-form-input" id="profileWechat" value="' + escHtml(u.wechat || '') + '" placeholder="选填" maxlength="50" /></div>' +
        
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F427}</span><span class="profile-form-label">QQ号</span><input type="text" class="profile-form-input" id="profileQQ" value="' + escHtml(u.qq || '') + '" placeholder="选填" maxlength="20" /></div>' +
        
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F3E0}</span><span class="profile-form-label">宿舍楼</span><input type="text" class="profile-form-input" id="profileDorm" value="' + escHtml(u.dormitory || '') + '" placeholder="例如：3号宿舍楼" /></div>' +
        '<div class="profile-form-item with-icon"><span class="profile-form-icon">\u{1F6AA}</span><span class="profile-form-label">房间号</span><input type="text" class="profile-form-input" id="profileRoom" value="' + escHtml(u.room || '') + '" placeholder="例如：301" /></div>' +
        '</div>';
      el.querySelector('.sub-page-body').innerHTML =
        heroPart +
        formPart +
        '<input type="hidden" id="profileAvatar" value="' + escHtml(curAvatar) + '" />' +
        '<input type="hidden" id="profileBg" value="' + escHtml(curBg) + '" />' +
        '<button class="profile-save-btn" onclick="saveProfile()">\u{1F4BE} 保存修改</button>';
      openSubPage('profilePage_sub');
    }

    function selectProfileAvatar(el, emoji) {
      document.querySelectorAll('.profile-emoji-item').forEach(e => e.classList.remove('selected'));
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
          // 头像已更新为真实图片，无需管理 emoji 选中态
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
          if (hero) { hero.style.cssText = 'background: url(' + res.bgImageUrl + ') center/cover no-repeat'; hero.classList.add('has-bg'); }
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
window.refreshCaptcha = refreshCaptcha;
window.doLogin = doLogin;
window.updateLoginBtn = updateLoginBtn;
window.showTermsModal = showTermsModal;

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

    // ─── 黑名单 ────────────────────────────────────
    async function showBlockList() {
      try {
        const blocks = await API.wallGetBlocks();
        const html = blocks && blocks.length > 0
          ? blocks.map(b => {
              const avatar = b.avatar || '';
              const nickname = b.nickname || b.blocked_phone || '未知';
              const avatarHtml = avatar
                ? `<img src="${escHtml(avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'" />`
                : `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:700">${(nickname[0]||'?').toUpperCase()}</div>`;
              return `
                <div class="block-list-item" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
                  ${avatarHtml}
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(nickname)}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${escHtml(b.blocked_phone)}</div>
                  </div>
                  <button onclick="event.stopPropagation();doUnblockUser('${escHtml(b.blocked_phone)}')" style="padding:6px 14px;border:1.5px solid var(--primary);border-radius:20px;background:transparent;color:var(--primary);font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap">解除屏蔽</button>
                </div>`;
            }).join('')
          : '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:14px">📭 黑名单为空</div>';
        const overlay = document.createElement('div');
        overlay.id = 'blockListOverlay';
        overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `
          <div style="background:var(--card);border-radius:20px;padding:0;width:100%;max-width:400px;max-height:70vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 12px">
              <h3 style="font-size:18px;font-weight:700;margin:0">🚫 黑名单</h3>
              <button onclick="document.getElementById('blockListOverlay').remove()" style="width:32px;height:32px;border:none;border-radius:50%;background:var(--bg);color:var(--text);font-size:18px;cursor:pointer;line-height:1;font-family:inherit">✕</button>
            </div>
            <div style="overflow-y:auto;padding:0 20px 20px;flex:1">
              ${html}
            </div>
          </div>`;
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
      } catch(e) {
        showToast('加载失败: ' + (e.message || '请重试'));
      }
    }

    async function doUnblockUser(phone) {
      if (!confirm('确定解除对 ' + phone + ' 的屏蔽？')) return;
      try {
        await API.wallUnblockUser(phone);
        showToast('✅ 已解除屏蔽');
        const overlay = document.getElementById('blockListOverlay');
        if (overlay) overlay.remove();
        // 重新打开黑名单
        showBlockList();
      } catch(e) {
        showToast('操作失败: ' + (e.message || '请重试'));
      }
    }

    window.showSettings = showSettings;
window.showWallPrivacySettings = showWallPrivacySettings;
window.showBlockList = showBlockList;
window.doUnblockUser = doUnblockUser;
window.selectPrivacyLevel = selectPrivacyLevel;
window.saveWallPrivacy = saveWallPrivacy;
window.toggleLanguage = toggleLanguage;
window.toggleDark = toggleDark;
window.showUserProfile = showUserProfile;
window.selectProfileAvatar = selectProfileAvatar;
window.saveProfile = saveProfile;
window.uploadUserAvatar = uploadUserAvatar;
window.uploadUserBg = uploadUserBg;
window.showChangePassword = showChangePassword;
window.doVerifyOldPassword = doVerifyOldPassword;
window.doChangePassword = doChangePassword;
window.showLoginPage = showLoginPage;
window.doLogin = doLogin;
window.updateLoginBtn = updateLoginBtn;
