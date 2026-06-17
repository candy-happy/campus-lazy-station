// admin/js/users.js - 用户管理模块

let _userPage = 1;
const _userSize = 15;
let _userSearchTimer = null;
let _selectedUsers = new Set();
let _userTotal = 0;
let _userTotalPages = 1;

function _userAuth() { return API._authHeaders(); }

// HTML属性安全值：先JSON.stringify保证JS字符串合法，再escHtml保证HTML属性合法
function _attr(v) { return escHtml(JSON.stringify(v)); }

// ─── 渲染分页栏 ──────────────────────────────────────
function renderUserPager() {
  const pager = document.getElementById('userPager');
  if (!pager) return;
  const total = _userTotal;
  const totalPages = Math.max(1, _userTotalPages);

  let batchHtml = '';
  if (_selectedUsers.size > 0) {
    batchHtml = `<span style="font-size:13px;color:#E74C3C;margin-right:12px">已选${_selectedUsers.size}人</span>
      <button onclick="batchPurgeUsers()" style="padding:6px 16px;background:#E74C3C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">🗑️ 批量删除</button>`;
  }

  if (totalPages <= 1) {
    pager.innerHTML = batchHtml + '<span style="font-size:13px;color:var(--text-secondary)">共 ' + total + ' 条</span>';
  } else {
    pager.innerHTML = batchHtml + `
      <button onclick="loadUserList(1)" ${_userPage<=1?'disabled':''} style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);cursor:pointer;font-size:12px">首页</button>
      <button onclick="loadUserList(${_userPage-1})" ${_userPage<=1?'disabled':''} style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);cursor:pointer;font-size:12px">上页</button>
      <span style="font-size:13px;color:var(--text-secondary)">${_userPage}/${totalPages} · ${total}条</span>
      <button onclick="loadUserList(${_userPage+1})" ${_userPage>=totalPages?'disabled':''} style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);cursor:pointer;font-size:12px">下页</button>
      <button onclick="loadUserList(${totalPages})" ${_userPage>=totalPages?'disabled':''} style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);cursor:pointer;font-size:12px">末页</button>`;
  }
}

// ─── 加载用户列表 ──────────────────────────────────────
async function loadUserList(page) {
  if (page) _userPage = page;
  const q = (document.getElementById('userSearchInput')?.value || '').trim();
  const params = new URLSearchParams({ page: _userPage, size: _userSize });
  if (q) params.set('q', q);

  try {
    const res = await fetch('/api/users/search?' + params, { headers: _userAuth() }).then(r => r.json());
    if (res.error) throw new Error(res.error);

    const { total, page: cp, list } = res;
    _userPage = cp || 1;
    _userTotal = total;
    _userTotalPages = Math.ceil(total / _userSize);
    document.getElementById('userTotalCount').textContent = total;

    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px">暂无用户</td></tr>';
    } else {
      tbody.innerHTML = list.map(u => {
        const name = u.nickname || u.name || '';
        const phoneDisp = u.phoneDisplay || u.phone || '';
        const checked = _selectedUsers.has(u.phone) ? ' checked' : '';
        return `<tr>
          <td style="width:36px;text-align:center"><input type="checkbox" class="user-checkbox" value="${escHtml(u.phone)}" onchange="onUserCheckChange()"${checked}></td>
          <td>${escHtml(name)}</td>
          <td style="font-size:12px;color:var(--text-secondary)">${escHtml(phoneDisp)}</td>
          <td style="font-size:12px">${escHtml(u.student_id || '-')}</td>
          <td style="font-size:12px">${escHtml(u.dormitory || '-')}</td>
          <td>${u.total_orders || 0}</td>
          <td style="font-size:11px;color:var(--text-muted)">${(u.created_at || '').slice(0,10)}</td>
          <td style="white-space:nowrap">
            <button onclick="showUserDetail(${_attr(u.phone)})" style="padding:4px 10px;background:var(--primary);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:4px">详情</button>
            <button onclick="confirmPurgeUser(${_attr(u.phone)},${_attr(name)})" style="padding:4px 10px;background:#E74C3C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">删除</button>
          </td>
        </tr>`;
      }).join('');
    }

    renderUserPager();
    updateSelectAllState();
  } catch(e) {
    console.error('loadUserList:', e);
    const tbody = document.getElementById('userTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#E74C3C;padding:24px">加载失败: ' + escHtml(e.message) + '</td></tr>';
  }
}

// ─── 批量选择 ─────────────────────────────────────────
function onUserCheckChange() {
  const checks = document.querySelectorAll('#userTableBody .user-checkbox');
  _selectedUsers.clear();
  checks.forEach(cb => { if (cb.checked) _selectedUsers.add(cb.value); });
  updateSelectAllState();
  renderUserPager();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('userSelectAll');
  const checks = document.querySelectorAll('#userTableBody .user-checkbox');
  _selectedUsers.clear();
  if (selectAll.checked) {
    checks.forEach(cb => { cb.checked = true; _selectedUsers.add(cb.value); });
  } else {
    checks.forEach(cb => { cb.checked = false; });
  }
  updateSelectAllState();
  renderUserPager();
}

function updateSelectAllState() {
  const selectAll = document.getElementById('userSelectAll');
  if (!selectAll) return;
  const checks = document.querySelectorAll('#userTableBody .user-checkbox');
  if (checks.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; return; }
  const allChecked = [...checks].every(c => c.checked);
  const anyChecked = [...checks].some(c => c.checked);
  selectAll.checked = allChecked;
  selectAll.indeterminate = anyChecked && !allChecked;
}

// ─── 批量删除 ────────────────────────────────────────
function batchPurgeUsers() {
  if (_selectedUsers.size === 0) { showToast('请先选择用户'); return; }
  const phones = [..._selectedUsers];
  if (!confirm(`⚠️ 确定批量删除 ${phones.length} 个用户的所有数据吗？\n\n此操作不可撤销！`)) return;
  if (!confirm(`⚠️ 最后确认：真的永久删除这 ${phones.length} 位用户吗？`)) return;
  doBatchPurge(phones);
}

async function doBatchPurge(phones) {
  try {
    const res = await fetch('/api/users/batch-purge', {
      method: 'POST',
      headers: { ..._userAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);

    const r = res.results || {};
    const msg = r.failed > 0 ? `成功 ${r.success||0} 个，失败 ${r.failed} 个` : `已批量删除 ${r.success||0} 个用户 ✅`;
    showToast(msg);
    _selectedUsers.clear();
    loadUserList(1);
  } catch(e) {
    showToast(`批量删除失败: ${e.message || ''}`);
  }
}

function onUserSearchInput() {
  clearTimeout(_userSearchTimer);
  _userSearchTimer = setTimeout(() => loadUserList(1), 400);
}

// ─── 用户详情 ─────────────────────────────────────────
async function showUserDetail(phone) {
  const modal = document.getElementById('userDetailModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const body = document.getElementById('userDetailBody');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">⏳ 加载中...</div>';

  try {
    const res = await fetch('/api/users/' + phone + '/summary', { headers: _userAuth() }).then(r => r.json());
    if (res.error) throw new Error(res.error);

    const { user, counts } = res;
    const name = user.nickname || user.name || '';
    const items = [
      { label: '📝 校园墙帖子', v: counts.wall_posts },
      { label: '💬 校园墙评论', v: counts.wall_comments },
      { label: '❤️ 点赞', v: counts.wall_likes },
      { label: '📋 订单', v: counts.orders },
      { label: '🛒 二手商品', v: counts.market_items },
      { label: '🐱 猫狗日记', v: counts.pet_sightings },
      { label: '🐾 猫狗评论', v: counts.pet_comments },
      { label: '👨‍🏫 教师评价', v: counts.teacher_reviews },
      { label: '👍 教师点赞', v: counts.teacher_likes },
      { label: '💬 私聊消息', v: counts.messages },
      { label: '💬 对话', v: counts.conversations },
      { label: '📋 反馈', v: counts.feedback },
      { label: '🚫 举报', v: counts.reports },
      { label: '🔔 通知', v: counts.notifications },
      { label: '👥 关注', v: counts.following },
      { label: '👥 粉丝', v: counts.followers },
      { label: '🚫 拉黑', v: counts.blocks },
      { label: '🚫 被拉黑', v: counts.blocked_by },
      { label: '📚 复习资料', v: counts.review_materials },
      { label: '⭐ 校花校草', v: counts.campus_star },
      { label: '🏘️ 社团', v: counts.club_members }
    ];

    const totalItems = items.reduce((s, i) => s + (i.v || 0), 0);

    body.innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;color:var(--text)">${escHtml(name)}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${escHtml(user.phoneDisplay || user.phone)} · ${escHtml(user.student_id || '无学号')}</div>
        <div style="font-size:12px;color:var(--text-muted)">宿舍: ${escHtml(user.dormitory || '-')} · 注册: ${(user.created_at||'').slice(0,10)}</div>
        <div style="margin-top:10px;font-size:13px;font-weight:600;color:${totalItems > 50 ? '#E74C3C' : 'var(--text-secondary)'}">📊 关联数据共 ${totalItems} 条</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:300px;overflow-y:auto;padding:0 4px">
        ${items.map(i => `
          <div style="background:var(--card-bg);border-radius:8px;padding:10px;text-align:center;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:700;color:${(i.v||0)>0?'var(--primary)':'var(--text-muted)'}">${i.v || 0}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${i.label}</div>
          </div>
        `).join('')}
      </div>
      <div style="text-align:center;margin-top:16px">
        <button onclick="confirmPurgeUser(${_attr(user.phone)},${_attr(name)})" style="padding:10px 24px;background:#E74C3C;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">🗑️ 删除该用户所有数据</button>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="text-align:center;padding:24px;color:#E74C3C">加载失败: ${escHtml(e.message)}</div>`;
  }
}

function closeUserDetail() {
  const modal = document.getElementById('userDetailModal');
  if (modal) modal.style.display = 'none';
}

// ─── 确认删除（模板字符串，无字符串拼接引号问题）─────────
function confirmPurgeUser(phone, name) {
  console.log('[DEBUG] confirmPurgeUser called, phone:', phone, 'name:', name);
  if (!confirm(`⚠️ 确定删除用户「${name}」的所有数据吗？

此操作将删除：
- 该用户所有帖子、评论、点赞
- 该用户所有订单
- 该用户所有私聊消息
- 该用户所有其他关联数据

此操作不可撤销！`)) return;

  if (!confirm(`请再次确认：
真的要永久删除「${name}」(${phone}) 的全部数据吗？`)) return;

  doPurgeUser(phone);
}

async function doPurgeUser(phone) {
  console.log('[DEBUG] doPurgeUser called, phone:', phone);
  try {
    const headers = _userAuth();
    console.log('[DEBUG] Auth headers:', JSON.stringify(headers));
    const url = '/api/users/' + encodeURIComponent(phone) + '/purge';
    console.log('[DEBUG] Fetch URL:', url, 'method: DELETE');
    const res = await fetch(url, {
      method: 'DELETE',
      headers
    });
    console.log('[DEBUG] Response status:', res.status, res.statusText);
    const data = await res.json();
    console.log('[DEBUG] Response body:', JSON.stringify(data));
    if (data.error) throw new Error(data.error);
    showToast('已删除用户所有数据 ✅');
    _selectedUsers.delete(phone);
    closeUserDetail();
    loadUserList();
  } catch(e) {
    console.error('[DEBUG] doPurgeUser error:', e);
    showToast(`删除失败: ${e.message || ''}`);
  }
}

// ─── 注册 switchPage ───────────────────────────────────
const _origSwitchForUsers = window.switchPage;
window.switchPage = function(page) {
  _origSwitchForUsers(page);
  if (page === 'users') loadUserList(1);
};

window.loadUserList = loadUserList;
window.onUserSearchInput = onUserSearchInput;
window.showUserDetail = showUserDetail;
window.closeUserDetail = closeUserDetail;
window.confirmPurgeUser = confirmPurgeUser;
window.doPurgeUser = doPurgeUser;
window.onUserCheckChange = onUserCheckChange;
window.toggleSelectAll = toggleSelectAll;
window.batchPurgeUsers = batchPurgeUsers;
window.doBatchPurge = doBatchPurge;
window.renderUserPager = renderUserPager;
