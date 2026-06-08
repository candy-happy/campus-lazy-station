// === 提现管理 ===
 async function renderWithdrawTable() {
 try {
 const list = await API.adminWithdrawList();
 if (!Array.isArray(list)) { document.getElementById('withdrawTable').innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">加载失败</div></div></td></tr>'; return; }
 const tbody = document.getElementById('withdrawTable');
 // 更新统计
 const totalAmount = list.reduce((s,w)=>s+(w.amount||0),0);
 document.getElementById('statWithdrawTotal').textContent = list.length;
 document.getElementById('statWithdrawPending').textContent = list.filter(w=>w.status==='pending').length;
 document.getElementById('statWithdrawApproved').textContent = list.filter(w=>w.status==='approved').length;
 document.getElementById('statWithdrawAmount').textContent = '¥' + totalAmount.toFixed(0);
 if (!list.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">💸</div><div class="empty-state-text">暂无提现申请</div></div></td></tr>'; return; }
 const statusLabel = { pending:{text:'⏳ 审核中',cls:'badge-yellow'}, approved:{text:'✅ 已通过',cls:'badge-green'}, rejected:{text:'❌ 已驳回',cls:'badge-red'} };
 tbody.innerHTML = list.map(w => {
   const st = statusLabel[w.status] || {text:w.status,cls:'badge-gray'};
   return '<tr><td><span style="font-weight:600">' + (escHtml(w.rider_name||w.phone)) + '</span></td><td><span style="font-weight:600;color:var(--orange)">¥' + (w.amount||0).toFixed(2) + '</span></td><td><span class="badge ' + st.cls + '">' + st.text + '</span></td><td style="font-size:13px;color:var(--text-muted)">' + (w.created_at||'') + '</td><td><div class="table-actions">' + (w.status==='pending' ? '<button class="btn btn-success btn-sm" onclick="approveWithdraw('+w.id+',\'approved\')">✓ 通过</button><button class="btn btn-danger btn-sm" onclick="approveWithdraw('+w.id+',\'rejected\')">✗ 驳回</button>' : (w.reason||'-')) + '</div></td></tr>';
 }).join('');
 // 更新待审核徽章
 const pendingCount = list.filter(w => w.status === 'pending').length;
 const badge = document.getElementById('withdrawBadge');
 if (pendingCount > 0) { badge.textContent = pendingCount; badge.style.display = 'inline'; } else { badge.style.display = 'none'; }
 } catch(e) { console.error('renderWithdrawTable error:', e); }
 }

 async function approveWithdraw(id, status) {
 const res = await API.adminWithdrawAction(id, status, status==='rejected'?'管理员驳回':'');
 if (res.error) return showToast(res.error);
 showToast(status==='approved'?'已通过':'已驳回');
 renderWithdrawTable();
 }

// window exports
window.renderWithdrawTable = renderWithdrawTable;
window.approveWithdraw = approveWithdraw;
