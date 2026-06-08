// === 管理员管理 ===
 async function addAdmin(e) {
 e.preventDefault();
 const username = document.getElementById('newAdminUsername').value;
 const password = document.getElementById('newAdminPassword').value;
 const phone = document.getElementById('newAdminPhone').value;
 if (!phoneRegex.test(phone)) {
 document.getElementById('newAdminPhoneError').style.display = 'block';
 return;
 }
 try {
 await API.addAdmin(username, password, 'admin');
 closeModal('addAdminModal');
 admins = await API.getAdmins();
 renderAdminsTable();
 showToast('管理员添加成功');
 } catch(err) { showToast(err.message || '添加失败'); }
 }

 function updatePendingBadge() {
 document.getElementById('pendingBadge').style.display = 'none';
 document.getElementById('pendingApprovalsCard').style.display = 'none';
 }

 async function deleteAdmin(id) {
 if (id === 1) return showToast('不能删除总管理员');
 if (confirm('确定删除该管理员吗？')) {
 try {
 await API.deleteAdmin(id);
 admins = await API.getAdmins();
 renderAdminsTable();
 showToast('管理员已删除');
 } catch(e) { showToast(e.message || '删除失败'); }
 }
 }

 function renderAdminsTable() {
 document.getElementById('pendingApprovalsCard').style.display = 'none';
 // 更新统计
 document.getElementById('statAdminsTotal').textContent = admins.length;
 document.getElementById('statAdminsSuper').textContent = admins.filter(a=>a.role==='super').length;
 document.getElementById('statAdminsNormal').textContent = admins.filter(a=>a.role!=='super').length;
 const tbody = document.getElementById('adminsTable');
 if (!admins.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">暂无管理员数据</div></div></td></tr>'; return; }
 tbody.innerHTML = admins.map(a => `
 <tr><td><span style="font-weight:600">${escHtml(a.username)}</span></td><td>${a.name||'-'}</td><td>${a.phone||'-'}</td><td><span class="badge ${a.role==='super'?'badge-orange':'badge-blue'}">${a.role==='super'?'👑 总管理员':'🛡️ 管理员'}</span></td><td>${a.created_at?new Date(a.created_at).toLocaleDateString('zh-CN'):'-'}</td><td>${a.role!=='super'&&currentAdmin?.role==='super'?`<button class="btn btn-danger btn-sm" onclick="deleteAdmin(${a.id})">删除</button>`:'-'}</td></tr>`).join('');
 }

// window exports
window.addAdmin = addAdmin;
window.updatePendingBadge = updatePendingBadge;
window.deleteAdmin = deleteAdmin;
window.renderAdminsTable = renderAdminsTable;
