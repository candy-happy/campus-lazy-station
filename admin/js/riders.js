// === 骑手管理 ===

 function renderRidersTable() {
 const q = (document.getElementById('riderSearchInput')?.value||'').toLowerCase();
 const filtered = riders.filter(r => {
   if (q && !(r.uid||'').toLowerCase().includes(q) && !(r.name||'').includes(q) && !(r.phone||'').includes(q)) return false;
   return true;
 });
 // 更新统计
 document.getElementById('statRidersTotal').textContent = riders.length;
 document.getElementById('statRidersOnline').textContent = riders.filter(r=>r.status==='online'&&!r.frozen).length;
 document.getElementById('statRidersFrozen').textContent = riders.filter(r=>r.frozen===1).length;
 const avg = riders.length ? (riders.reduce((s,r)=>s+(r.rating||5),0)/riders.length).toFixed(1) : '0';
 document.getElementById('statRidersAvgRating').textContent = avg;
 document.getElementById('ridersTable').innerHTML = filtered.length ? filtered.map(r => {
   const isFrozen = r.frozen === 1;
   const statusBadge = isFrozen
     ? '<span class="badge badge-red">🔴 已冻结</span>'
     : r.status === 'online'
       ? '<span class="badge badge-green">🟢 在线</span>'
       : '<span class="badge badge-gray">⚪ 离线</span>';
   const actions = isFrozen
     ? `<button class="btn btn-success btn-sm" onclick="unfreezeRider(${r.id})">解冻</button>`
     : `<button class="btn btn-danger btn-sm" onclick="showFreezeModal(${r.id},'${escHtml(r.name)}','${escHtml(r.uid||'')}')">冻结</button>`;
   return `<tr><td><span style="font-weight:600;color:var(--orange)">${r.uid||'-'}</span></td><td>${escHtml(r.name)}</td><td>${escHtml(r.student_id||'-')}</td><td>${escHtml(r.phone)}</td><td>${r.total_orders||0}</td><td><span style="font-weight:600">¥${(r.total_earnings||0).toFixed(0)}</span></td><td><span style="color:#F39C12">⭐</span> ${r.rating||5.0}</td><td>${statusBadge}</td><td style="white-space:nowrap">${actions} <button class="btn btn-secondary btn-sm" onclick="removeRider(${r.id})">移除</button></td></tr>`;
 }).join('') : '<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">🛵</div><div class="empty-state-text">暂无骑手数据</div></div></td></tr>';
 }

 function showFreezeModal(id, name, uid) {
   freezeTargetId = id;
   document.getElementById('freezeRiderInfo').textContent = name + ' (' + uid + ')';
   document.getElementById('freezeReason').value = '';
   document.getElementById('freezeReasonModal').classList.add('active');
 }

 function closeFreezeModal() {
   document.getElementById('freezeReasonModal').classList.remove('active');
   freezeTargetId = null;
 }

 async function confirmFreezeRider() {
   if (!freezeTargetId) return;
   const reason = document.getElementById('freezeReason').value.trim() || '管理员冻结';
   try {
     const res = await fetch('/api/riders/' + freezeTargetId + '/freeze', {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_admin_token')||'') },
       body: JSON.stringify({ reason })
     }).then(r => r.json());
     if (res.ok) {
       riders = riders.map(r => r.id === freezeTargetId ? { ...r, frozen: 1, frozen_reason: reason, status: 'frozen' } : r);
       renderRidersTable();
       showToast('骑手已冻结');
     } else { showToast(res.error || '冻结失败'); }
   } catch(e) { showToast('冻结失败'); }
   closeFreezeModal();
 }

 async function unfreezeRider(id) {
   try {
     const res = await fetch('/api/riders/' + id + '/unfreeze', {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_admin_token')||'') }
     }).then(r => r.json());
     if (res.ok) {
       riders = riders.map(r => r.id === id ? { ...r, frozen: 0, frozen_reason: null, status: 'offline' } : r);
       renderRidersTable();
       showToast('骑手已解冻');
     } else { showToast(res.error || '解冻失败'); }
   } catch(e) { showToast('解冻失败'); }
 }

 function showAddRiderModal() {
   document.getElementById('newRiderName').value = '';
   document.getElementById('newRiderStudentId').value = '';
   document.getElementById('newRiderPhone').value = '';
   document.getElementById('newRiderDormitory').value = '';
   document.getElementById('addRiderModal').classList.add('active');
 }

 function closeAddRiderModal() {
   document.getElementById('addRiderModal').classList.remove('active');
 }

 async function addRider() {
   const name = document.getElementById('newRiderName').value.trim();
   const student_id = document.getElementById('newRiderStudentId').value.trim();
   const phone = document.getElementById('newRiderPhone').value.trim();
   const dormitory = document.getElementById('newRiderDormitory').value.trim();
   if (!name) return showToast('请输入姓名');
   if (!phone || phone.length !== 11) return showToast('请输入正确的11位手机号');
   try {
     const res = await fetch('/api/riders', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_admin_token')||'') },
       body: JSON.stringify({ name, student_id, phone, dormitory })
     }).then(r => r.json());
     if (res.ok) {
       riders.unshift({ ...res.rider, createdAt: res.rider.created_at });
       renderRidersTable();
       updateStats();
       closeAddRiderModal();
       showToast('骑手添加成功！UID: ' + res.rider.uid);
     } else { showToast(res.error || '添加失败'); }
   } catch(e) { showToast('添加失败'); }
 }

 async function removeRider(id) {
 if (confirm('确定移除该骑手？')) {
 try {
 await fetch('/api/riders/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_admin_token')||'') } }).then(r=>r.json());
 riders = riders.filter(r => r.id !== id);
 renderRidersTable();
 updateStats();
 showToast('骑手已移除');
 } catch(e) { showToast('移除失败'); }
 }
 }

 async function loadRidersPage() {
 try {
 riders = (await API.getRiders()).map(r => ({ ...r, createdAt: r.created_at }));
 renderRidersTable();
 } catch(e) { console.error('骑手数据加载失败:', e); }
 }

// window exports
window.renderRidersTable = renderRidersTable;
window.showFreezeModal = showFreezeModal;
window.closeFreezeModal = closeFreezeModal;
window.confirmFreezeRider = confirmFreezeRider;
window.unfreezeRider = unfreezeRider;
window.showAddRiderModal = showAddRiderModal;
window.closeAddRiderModal = closeAddRiderModal;
window.addRider = addRider;
window.removeRider = removeRider;
window.loadRidersPage = loadRidersPage;
