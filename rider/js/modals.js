// modals.js - 弹窗/设置/帮助

 function closeModal(id) { $(id).classList.remove('active'); document.body.style.overflow = ''; }

 function showProfile() { riderSwitchTab('profile'); }

 function showSettings() { showSettingsModal(); }

 function showWithdrawModal() {
   if (!currentRider) return;
   openSubPage('withdrawPage_sub');
   loadWalletInfo();
 }

 async function showReviewsModal() {
   if (!currentRider) return showToast('请先登录');
   const id = 'reviewsPage_sub';
   let el = document.getElementById(id);
   if (el) el.remove();
   el = document.createElement('div');
   el.id = id;
   el.className = 'sub-page';
   try {
     const data = await API.riderReviews(currentRider.phone);
     const avgRating = data.avgRating || '--';
     const reviews = data.reviews || [];
     let html = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'reviewsPage_sub\')">←</button><span class="sub-page-title">⭐ 评价管理</span></div>' +
       '<div class="sub-page-body">' +
       '<div class="sp-card" style="text-align:center">' +
       '<div style="font-size:48px;font-weight:900;color:var(--yellow)">' + avgRating + '</div>' +
       '<div style="color:var(--text-muted);font-size:13px;margin-top:2px">平均评分</div>' +
       '<div style="font-size:18px;color:#F39C12;margin-top:4px">' + '★'.repeat(Math.round(parseFloat(avgRating)||5)) + '</div></div>';
     if (reviews.length) {
       html += '<div class="sp-card"><div class="sp-card-title">最近评价</div>';
       html += reviews.map(o =>
         '<div class="sp-row"><div><div style="font-size:14px;font-weight:600">' + escHtml(o.pickup_location||'') + ' → ' + escHtml(o.delivery_location||'') + '</div>' +
         '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">' + fmtTime(o.completed_at) + '</div></div>' +
         '<div style="color:#F39C12;font-weight:800;font-size:15px">' + '★'.repeat(o.rating || 5) + '</div></div>'
       ).join('');
       html += '</div>';
     } else { html += '<div class="sp-empty"><div class="sp-empty-icon">📭</div><div class="sp-empty-text">暂无评价</div></div>'; }
     html += '</div>';
     el.innerHTML = html;
   } catch(e) { console.error('showReviewsModal', e); el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'reviewsPage_sub\')">←</button><span class="sub-page-title">⭐ 评价管理</span></div><div class="sub-page-body"><div class="sp-empty"><div class="sp-empty-icon">⚠️</div><div class="sp-empty-text">加载失败: ' + escHtml(e.message||'') + '</div></div></div>'; }
   document.body.appendChild(el);
   openSubPage(id);
 }

 async function showRankModal() {
   if (!currentRider) return showToast('请先登录');
   const id = 'rankPage_sub';
   let el = document.getElementById(id);
   if (el) el.remove();
   el = document.createElement('div');
   el.id = id;
   el.className = 'sub-page';
   try {
     const riders = await API.riderRanking();
     const sorted = (riders || []).sort((a,b) => (b.total_earnings||0) - (a.total_earnings||0));
     const myIdx = sorted.findIndex(r => r.phone === currentRider.phone);
     let html = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'rankPage_sub\')">←</button><span class="sub-page-title">🏆 骑手排行榜</span></div>' +
       '<div class="sub-page-body">' +
       '<div class="sp-card" style="text-align:center;background:linear-gradient(135deg,#f9d423,#ff4e50);color:#fff;border:none">' +
       '<div style="font-size:13px;opacity:.8">我的排名</div>' +
       '<div style="font-size:36px;font-weight:900">第 ' + (myIdx >= 0 ? myIdx + 1 : '--') + ' 名</div></div>';
     const medals = ['🥇','🥈','🥉'];
     html += '<div class="sp-card"><div class="sp-card-title">收入排行 TOP 10</div>';
     sorted.slice(0, 10).forEach((r, i) => {
       const isMe = r.phone === currentRider.phone;
       html += '<div class="sp-row" style="' + (isMe ? 'background:rgba(46,204,113,.08);border-radius:10px;padding:11px 10px;margin:2px -10px' : '') + '">' +
         '<div style="display:flex;align-items:center;gap:10px">' +
         '<span style="width:28px;text-align:center;font-size:' + (i<3?'18px':'14px') + ';font-weight:800">' + (i < 3 ? medals[i] : (i+1)) + '</span>' +
         '<span style="font-weight:600;font-size:14px">' + escHtml(r.name || r.phoneDisplay || r.phone) + (isMe?' (我)':'') + '</span></div>' +
         '<span style="font-weight:800;color:var(--green);font-size:15px">¥' + ((r.total_earnings||0).toFixed(2)) + '</span></div>';
     });
     html += '</div></div>';
     el.innerHTML = html;
   } catch(e) { console.error('showRankModal', e); el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'rankPage_sub\')">←</button><span class="sub-page-title">🏆 骑手排行榜</span></div><div class="sub-page-body"><div class="sp-empty"><div class="sp-empty-icon">⚠️</div><div class="sp-empty-text">加载失败: ' + escHtml(e.message||'') + '</div></div></div>'; }
   document.body.appendChild(el);
   openSubPage(id);
 }

 function showHelpModal() {
   const faqs = [
     ['🛵 如何接单？', '登录后在首页点击「接单」即可，系统会根据您的等级推送附近订单。'],
     ['💸 如何提现？', '在钱包页面点击「立即提现」，输入金额提交申请，管理员审核后到账。'],
     ['📊 收入如何计算？', '骑手收入 = 订单价格 × 80%，平台收取20%服务费。'],
     ['⬆️ 等级如何提升？', '完成更多订单可自动升级：bronze→silver→gold→diamond，等级越高接单优先级越高。'],
     ['🆘 遇到问题怎么办？', '可以通过「意见反馈」联系我们，或直接拨打客服电话。']
   ];
   const id = 'helpPage_sub';
   let el = document.getElementById(id);
   if (el) el.remove();
   el = document.createElement('div');
   el.id = id;
   el.className = 'sub-page';
   let html = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'helpPage_sub\')">←</button><span class="sub-page-title">❓ 帮助中心</span></div><div class="sub-page-body">';
   faqs.forEach(([q,a]) => {
     html += '<details class="sp-card" style="padding:0;cursor:pointer"><summary style="font-weight:700;font-size:15px;padding:16px 18px;list-style:none;display:flex;align-items:center;justify-content:space-between">' + q + '<span style="font-size:12px;color:var(--text-muted);transition:transform .2s" class="faq-arrow">▶</span></summary>' +
       '<div style="padding:0 18px 16px;color:var(--text-muted);font-size:14px;line-height:1.7;border-top:1px solid var(--border);padding-top:12px">' + a + '</div></details>';
   });
   html += '<div style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:13px">还没解决？试试「意见反馈」联系我们 💬</div></div>';
   el.innerHTML = html;
   // FAQ arrow rotation
   el.querySelectorAll('details').forEach(d => {
     d.addEventListener('toggle', () => {
       const arrow = d.querySelector('.faq-arrow');
       if (arrow) arrow.style.transform = d.open ? 'rotate(90deg)' : '';
     });
   });
   document.body.appendChild(el);
   openSubPage(id);
 }

 function showFeedbackModal() {
   const id = 'feedbackPage_sub';
   let el = document.getElementById(id);
   if (el) el.remove();
   el = document.createElement('div');
   el.id = id;
   el.className = 'sub-page';
   const types = [
     { val: 'bug', emoji: '🐛', label: '问题反馈' },
     { val: 'feature', emoji: '💡', label: '功能建议' },
     { val: 'complaint', emoji: '😤', label: '投诉' },
     { val: 'other', emoji: '📌', label: '其他' }
   ];
   el.innerHTML =
     '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'feedbackPage_sub\')">←</button><span class="sub-page-title">📝 意见反馈</span></div>' +
     '<div class="sub-page-body">' +
     // Type selector
     '<div class="sp-card" style="padding-bottom:6px">' +
       '<div class="sp-card-title">反馈类型</div>' +
       '<div class="fb-type-grid">' +
         types.map(t =>
           '<div class="fb-type-item' + (t.val === 'bug' ? ' active' : '') + '" data-type="' + t.val + '" onclick="selectFbType(this,\'' + t.val + '\')">' +
             '<span class="fb-type-emoji">' + t.emoji + '</span><span>' + t.label + '</span></div>'
         ).join('') +
       '</div>' +
     '</div>' +
     // Textarea
     '<div class="sp-card" style="padding:14px">' +
       '<div class="fb-textarea-wrap">' +
         '<textarea id="fbContent" class="fb-textarea" placeholder="请描述您的问题或建议，我们会认真对待每一条反馈..." oninput="updateFbCount()"></textarea>' +
         '<div class="fb-char-count" id="fbCharCount">0/500</div>' +
       '</div>' +
     '</div>' +
     // Submit
     '<button onclick="submitFeedback()" class="fb-submit-btn">📤 提交反馈</button>' +
     // Success (hidden initially)
     '<div class="fb-success" id="fbSuccess" style="display:none">' +
       '<div class="fb-success-icon">✅</div>' +
       '<div class="fb-success-title">感谢反馈！</div>' +
       '<div class="fb-success-desc">我们会认真对待每一条反馈，<br>尽快为您处理。</div>' +
       '<button onclick="closeSubPage(\'feedbackPage_sub\')" class="sp-btn sp-btn-outline">返回</button>' +
     '</div>' +
     '</div>';
   document.body.appendChild(el);
   openSubPage(id);
 }

 function selectFbType(el, type) {
   _fbType = type;
   el.closest('.fb-type-grid').querySelectorAll('.fb-type-item').forEach(i => i.classList.remove('active'));
   el.classList.add('active');
 }

 function updateFbCount() {
   const ta = document.getElementById('fbContent');
   const cnt = document.getElementById('fbCharCount');
   if (!ta || !cnt) return;
   const len = ta.value.length;
   cnt.textContent = len + '/500';
   cnt.style.color = len > 500 ? 'var(--red)' : 'var(--text-muted)';
 }

 function submitFeedback() {
   const content = document.getElementById('fbContent').value.trim();
   if (!content) return showToast('请输入反馈内容');
   if (content.length > 500) return showToast('反馈内容不能超过500字');
   const feedbacks = JSON.parse(localStorage.getItem('riderFeedbacks') || '[]');
   feedbacks.push({ type: _fbType, content, time: new Date().toISOString(), rider: currentRider ? currentRider.phone : 'anon' });
   localStorage.setItem('riderFeedbacks', JSON.stringify(feedbacks));
   // Show success, hide form
   const form = document.querySelector('#feedbackPage_sub .sp-card, #feedbackPage_sub .fb-submit-btn');
   if (form) { document.querySelectorAll('#feedbackPage_sub .sp-card, #feedbackPage_sub .fb-submit-btn').forEach(e => e.style.display = 'none'); }
   const success = document.getElementById('fbSuccess');
   if (success) success.style.display = 'block';
 }

 function showSettingsModal() {
   if (!currentRider) return showToast('请先登录');
   const isDark = document.body.classList.contains('dark');
   const id = 'settingsPage_sub';
   let el = document.getElementById(id);
   if (el) el.remove();
   el = document.createElement('div');
   el.id = id;
   el.className = 'sub-page';
   const levelIcons = { bronze:'🥉', silver:'🥈', gold:'🥇', diamond:'💎' };
   const levelNames = { bronze:'青铜骑手', silver:'白银骑手', gold:'黄金骑手', diamond:'钻石骑手' };
   const lvl = currentRider.level || 'bronze';
   el.innerHTML =
     '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'settingsPage_sub\')">←</button><span class="sub-page-title">⚙️ 设置</span></div>' +
     '<div class="sub-page-body">' +
     // Avatar hero card
     '<div class="settings-avatar-row">' +
       '<div class="settings-avatar-circle" onclick="document.getElementById(\'riderAvatarInput\').click()">' + (currentRider.avatar ? '<img src="' + escHtml(currentRider.avatar) + '" />' : '\u{1F6F5}') + '</div>' +
       '<div class="settings-avatar-info">' +
         '<div class="settings-avatar-name">' + escHtml(currentRider.name || '骑手') + '</div>' +
         '<div class="settings-avatar-sub">点击头像更换照片</div>' +
         '<div class="settings-level-badge"><span>' + (levelIcons[lvl]||'\u{1F949}') + '</span><span>' + (levelNames[lvl]||lvl) + '</span></div>' +
       '</div>' +
     '</div>' +
     '<input type="file" id="riderAvatarInput" style="display:none" onchange="uploadRiderAvatar(this)" />' +
     // Appearance
     '<div class="sp-card">' +
       '<div class="sp-card-title">外观</div>' +
       '<div class="settings-toggle-row">' +
         '<div class="settings-toggle-label"><div class="settings-toggle-icon" style="background:#FFF3E0">🌙</div><span>深色模式</span></div>' +
         '<label class="toggle-switch"><input type="checkbox" id="riderDarkToggle" ' + (isDark?'checked':'') + ' onchange="riderToggleDark(this.checked)"><span class="toggle-slider"></span></label>' +
       '</div>' +
     '</div>' +
     // Account info
     '<div class="sp-card">' +
       '<div class="sp-card-title">账号信息</div>' +
       '<div class="settings-info-row"><span class="settings-info-label">姓名</span><span class="settings-info-value">' + escHtml(currentRider.name || '--') + '</span></div>' +
       '<div class="settings-info-row"><span class="settings-info-label">UID</span><span class="settings-info-value" style="font-family:Space Mono,monospace">' + escHtml(currentRider.uid || '--') + '</span></div>' +
       '<div class="settings-info-row"><span class="settings-info-label">手机</span><span class="settings-info-value">' + escHtml(currentRider.phone) + '</span></div>' +
       '<div class="settings-info-row"><span class="settings-info-label">等级</span><span class="settings-info-value" style="display:flex;align-items:center;gap:6px"><span style="font-size:18px">' + (levelIcons[lvl]||'🥉') + '</span>' + (levelNames[lvl]||lvl) + '</span></div>' +
     '</div>' +
     // About
     '<div class="sp-card">' +
       '<div class="sp-card-title">关于</div>' +
       '<div class="settings-info-row"><span class="settings-info-label">版本</span><span class="settings-info-value">v3.0.0</span></div>' +
       '<div class="settings-info-row"><span class="settings-info-label">平台</span><span class="settings-info-value">校园圈</span></div>' +
     '</div>' +
     // Logout
     '<button onclick="if(confirm(\'确定退出登录？\')){localStorage.removeItem(\'lazyRider\');localStorage.removeItem(\'lazy_rider_token\');localStorage.removeItem(\'lazy_session\');location.reload()}" class="settings-logout-btn">🚪 退出登录</button>' +
     '<div class="settings-version">校园圈 v3.0 骑手端</div>' +
     '</div>';
   document.body.appendChild(el);
   openSubPage(id);
 }

 function handleFrozenResponse() {
   // 任何API请求返回RIDER_FROZEN时触发退出
   clearInterval(frozenCheckInterval);
   showToast('你的账号已被冻结，即将退出', 5000);
   setTimeout(() => { API.logout(); location.reload(); }, 3000);
 }

 function startFrozenCheck() {
   if (frozenCheckInterval) clearInterval(frozenCheckInterval);
   frozenCheckInterval = setInterval(async () => {
     if (!currentRider) return;
     try {
       const res = await API.frozenCheck(currentRider.phone);
       if (res.frozen) {
         clearInterval(frozenCheckInterval);
         showToast('你的账号已被冻结，原因: ' + (res.frozen_reason || '管理员冻结'), 5000);
         setTimeout(() => { API.logout(); location.reload(); }, 3000);
       }
     } catch(e) {
       // 请求失败也不做处理，等下次轮询
     }
   }, 30000); // 每30秒检查一次
 }

// Exports
window.closeModal = closeModal;
window.showProfile = showProfile;
window.showSettings = showSettings;
window.showWithdrawModal = showWithdrawModal;
window.showReviewsModal = showReviewsModal;
window.showRankModal = showRankModal;
window.showHelpModal = showHelpModal;
window.showFeedbackModal = showFeedbackModal;
window.selectFbType = selectFbType;
window.updateFbCount = updateFbCount;
window.submitFeedback = submitFeedback;
window.showSettingsModal = showSettingsModal;
window.handleFrozenResponse = handleFrozenResponse;
window.startFrozenCheck = startFrozenCheck;
