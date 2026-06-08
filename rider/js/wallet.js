// wallet.js - 钱包/收入

 async function loadWalletInfo() {
   const w = await API.riderWallet(currentRider.phone);
   if (w.error) return showToast(w.error);
   $('walletAvail').textContent = (w.available||0).toFixed(2);
   $('walletPending').textContent = (w.pending||0).toFixed(2);
   $('withdrawMax').textContent = (w.available||0).toFixed(2);
   $('withdrawInput').max = w.available || 0;
 }

 async function doWithdraw() {
   const amt = parseFloat($('withdrawInput').value);
   if (!amt || amt < 1) return showToast('最低提现1元');
   const res = await API.riderWithdraw(currentRider.phone, amt);
   if (res.error) return showToast(res.error);
   showToast(res.message || '提现申请已提交');
   closeSubPage('withdrawPage_sub');
   // 刷新钱包数据
   const rider = await API.getRider(currentRider.phone);
   if (rider) { $('walletBalance').textContent = (rider.total_earnings||0).toFixed(2); }
 }

 function showEarningsDetail() {
   if (!currentRider) return;
   openSubPage('earningsPage_sub');
   loadEarningsDetail();
 }

 async function loadEarningsDetail() {
   const [earnings, logs] = await Promise.all([
     API.riderEarnings(currentRider.phone),
     API.riderWithdrawLogs(currentRider.phone)
   ]);
   let html = '';
   // Summary card
   const totalEarn = (earnings||[]).reduce((s,e) => s + (e.amount||0), 0);
   const totalWithdraw = (logs||[]).filter(l=>l.status==='approved').reduce((s,l) => s + (l.amount||0), 0);
   html += '<div class="sp-card" style="display:flex;gap:16px;text-align:center">' +
     '<div style="flex:1"><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">配送收入</div><div style="font-size:20px;font-weight:900;color:var(--green)">+' + totalEarn.toFixed(2) + '</div></div>' +
     '<div style="width:1px;background:var(--border)"></div>' +
     '<div style="flex:1"><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">已提现</div><div style="font-size:20px;font-weight:900;color:var(--text)">-' + totalWithdraw.toFixed(2) + '</div></div></div>';
   // Earnings list
   html += '<div class="sp-card"><div class="sp-card-title">📦 配送收入</div>';
   if (earnings && earnings.length) {
     html += earnings.map(e => '<div class="sp-row"><div><div style="font-size:13px;font-weight:600">订单 ' + escHtml(e.order_no) + '</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + fmtTime(e.time) + '</div></div><span style="color:var(--green);font-weight:800;font-size:15px">+' + (e.amount||0).toFixed(2) + '</span></div>').join('');
   } else { html += '<div class="sp-empty" style="padding:20px"><div class="sp-empty-text">暂无收入</div></div>'; }
   html += '</div>';
   // Withdraw logs
   html += '<div class="sp-card"><div class="sp-card-title">💸 提现记录</div>';
   if (logs && logs.length) {
     const statusMap = { pending:'审核中', approved:'已通过', rejected:'已驳回' };
     const badgeMap = { pending:'sp-badge-yellow', approved:'sp-badge-green', rejected:'sp-badge-red' };
     html += logs.map(l => '<div class="sp-row"><div><div style="font-size:13px;font-weight:600">-' + (l.amount||0).toFixed(2) + ' 元</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + fmtTime(l.created_at) + '</div></div><span class="sp-badge ' + (badgeMap[l.status]||'') + '">' + (statusMap[l.status]||l.status) + '</span></div>').join('');
   } else { html += '<div class="sp-empty" style="padding:20px"><div class="sp-empty-text">暂无提现记录</div></div>'; }
   html += '</div>';
   $('earningsBody').innerHTML = html;
 }

 function showActivityModal() {
   const id = 'activityPage_sub';
   let el = document.getElementById(id);
   if (el) el.remove();
   el = document.createElement('div');
   el.id = id;
   el.className = 'sub-page';
   el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'activityPage_sub\')">←</button><span class="sub-page-title">🎁 活动中心</span></div>' +
     '<div class="sub-page-body">' +
     '<div class="sp-card" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none">' +
     '<div style="font-size:20px;font-weight:800">🎉 新手任务奖励</div>' +
     '<div style="font-size:14px;margin-top:8px;opacity:.9;line-height:1.6">完成首单即得5元红包，限时活动！</div>' +
     '<div style="font-size:12px;margin-top:10px;opacity:.55;display:flex;align-items:center;gap:4px">⏰ 即日起至2026年6月30日</div></div>' +
     '<div class="sp-card" style="background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;border:none">' +
     '<div style="font-size:20px;font-weight:800">🏅 接单达人榜</div>' +
     '<div style="font-size:14px;margin-top:8px;opacity:.9;line-height:1.6">本周接单满20单额外奖励10元</div>' +
     '<div style="font-size:12px;margin-top:10px;opacity:.55;display:flex;align-items:center;gap:4px">🔄 每周一重置计数</div></div>' +
     '<div class="sp-card" style="background:linear-gradient(135deg,#4facfe,#00f2fe);color:#fff;border:none">' +
     '<div style="font-size:20px;font-weight:800">⭐ 好评达人奖</div>' +
     '<div style="font-size:14px;margin-top:8px;opacity:.9;line-height:1.6">获得5星好评满10次奖励8元</div>' +
     '<div style="font-size:12px;margin-top:10px;opacity:.55;display:flex;align-items:center;gap:4px">∞ 持续累计，不设上限</div></div>' +
     '</div>';
   document.body.appendChild(el);
   openSubPage(id);
 }

// Exports
window.loadWalletInfo = loadWalletInfo;
window.doWithdraw = doWithdraw;
window.showEarningsDetail = showEarningsDetail;
window.loadEarningsDetail = loadEarningsDetail;
window.showActivityModal = showActivityModal;
