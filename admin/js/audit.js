// === 操作审计日志 ===
let auditLogs = [];
let auditPage = 1;
let auditTotalPages = 1;
let auditFilter = { action: '', admin: '', keyword: '', target_type: '' };

async function loadAuditLogs(page = 1) {
  auditPage = page;
  try {
    const result = await API.getAuditLogs({ page, limit: 30, ...auditFilter });
    auditLogs = result.logs;
    auditTotalPages = result.totalPages;
    renderAuditTable();
    renderAuditPager();
  } catch (e) {
    showToast('加载审计日志失败: ' + (e.message || e));
  }
}

async function loadAuditStats() {
  try {
    const stats = await API.getAuditStats();
    const total = stats.reduce((s, i) => s + i.count, 0);
    document.getElementById('auditTotalCount').textContent = total;
    // 简洁统计卡片
    const top3 = stats.slice(0, 3);
    document.getElementById('auditTopActions').innerHTML = top3.length
      ? top3.map(s => `<span class="badge badge-sm">${actionLabel(s.action)}: ${s.count}</span>`).join(' ')
      : '<span class="text-muted">暂无记录</span>';
  } catch (e) { /* 静默失败 */ }
}

function actionLabel(action) {
  const map = {
    'admin.create': '➕ 创建管理员',
    'admin.delete': '🗑️ 删除管理员',
    'admin.disable': '🚫 禁用管理员',
    'admin.enable': '✅ 启用管理员',
    'admin.login': '🔑 管理员登录',
    'post.delete': '🗑️ 删帖',
    'comment.delete': '💬 删评论',
    'pet.create': '🐾 添加猫狗',
    'pet.update': '✏️ 编辑猫狗',
    'pet.delete': '🐾 删除猫狗',
    'ad.create': '🖼️ 创建广告',
    'ad.delete': '🖼️ 删除广告',
    'report.resolve': '✅ 处理举报',
    'withdraw.process': '💰 处理提现',
  };
  return map[action] || action;
}

function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!auditLogs.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">暂无操作记录</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = auditLogs.map(l => `
    <tr>
      <td>${l.id}</td>
      <td><span class="badge badge-blue">${escHtml(l.admin_username)}</span></td>
      <td><span class="badge">${actionLabel(l.action)}</span></td>
      <td>${l.target_type ? escHtml(l.target_type) + ' #' + l.target_id : '-'}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(l.detail)}">${l.detail ? escHtml(l.detail) : '-'}</td>
      <td style="font-size:0.82rem;color:var(--text-muted);white-space:nowrap">${l.created_at || '-'}</td>
    </tr>
  `).join('');
}

function renderAuditPager() {
  if (auditTotalPages <= 1) { document.getElementById('auditPager').innerHTML = ''; return; }
  let html = '';
  if (auditPage > 1) html += `<button class="btn btn-sm" onclick="loadAuditLogs(${auditPage - 1})">← 上一页</button>`;
  html += `<span style="margin:0 12px;font-size:0.85rem;color:var(--text-muted)">第 ${auditPage} / ${auditTotalPages} 页</span>`;
  if (auditPage < auditTotalPages) html += `<button class="btn btn-sm" onclick="loadAuditLogs(${auditPage + 1})">下一页 →</button>`;
  document.getElementById('auditPager').innerHTML = html;
}

function filterAudit() {
  auditFilter.action = document.getElementById('auditFilterAction').value;
  auditFilter.admin = document.getElementById('auditFilterAdmin').value.trim();
  auditFilter.keyword = document.getElementById('auditFilterKeyword').value.trim();
  auditFilter.target_type = document.getElementById('auditFilterType').value;
  loadAuditLogs(1);
}

function resetAuditFilter() {
  document.getElementById('auditFilterAction').value = '';
  document.getElementById('auditFilterAdmin').value = '';
  document.getElementById('auditFilterKeyword').value = '';
  document.getElementById('auditFilterType').value = '';
  auditFilter = { action: '', admin: '', keyword: '', target_type: '' };
  loadAuditLogs(1);
}

// window exports
window.loadAuditLogs = loadAuditLogs;
window.loadAuditStats = loadAuditStats;
window.filterAudit = filterAudit;
window.resetAuditFilter = resetAuditFilter;
window.actionLabel = actionLabel;
