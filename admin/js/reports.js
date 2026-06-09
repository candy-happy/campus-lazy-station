// reports.js - 管理端举报管理
let _reportPage = 1;

async function loadReports(page) {
  if (page) _reportPage = page;
  const status = document.getElementById('reportStatusFilter').value;
  try {
    const res = await fetch(`/api/wall/reports?status=${status}&page=${_reportPage}&limit=20`, { headers: API._headers() }).then(r => r.json());
    const list = document.getElementById('reportsList');
    if (!res.reports || res.reports.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">暂无举报记录</div>';
      document.getElementById('reportsPager').innerHTML = '';
      return;
    }
    const statusMap = { pending: '待处理', resolved: '已处理', dismissed: '已驳回' };
    const statusColor = { pending: '#E67E22', resolved: '#27AE60', dismissed: '#95A5A6' };
    list.innerHTML = '<table class="data-table"><thead><tr><th>ID</th><th>类型</th><th>举报内容</th><th>举报原因</th><th>举报人</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>' +
      res.reports.map(r => `<tr>
        <td>${r.id}</td>
        <td>${r.target_type === 'post' ? '帖子' : '评论'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.target_content||'').replace(/"/g,'&quot;')}">${(r.target_content||'').substring(0,40)}</td>
        <td>${r.reason}</td>
        <td>${r.reporter_phone}</td>
        <td><span style="color:${statusColor[r.status]||'#999'};font-weight:600">${statusMap[r.status]||r.status}</span></td>
        <td style="font-size:12px">${(r.created_at||'').slice(0,16)}</td>
        <td>${r.status === 'pending' ? `<button onclick="handleReport(${r.id},'remove')" style="padding:4px 10px;border-radius:6px;background:#E74C3C;color:#fff;border:none;cursor:pointer;font-size:12px;margin-right:4px">删除内容</button><button onclick="handleReport(${r.id},'dismiss')" style="padding:4px 10px;border-radius:6px;background:var(--border);color:var(--text);border:none;cursor:pointer;font-size:12px">驳回</button>` : (r.admin_note||'')}</td>
      </tr>`).join('') + '</tbody></table>';

    // 分页
    const pager = document.getElementById('reportsPager');
    if (res.totalPages > 1) {
      pager.innerHTML = `<button onclick="loadReports(${_reportPage-1})" ${_reportPage<=1?'disabled':''}>上一页</button> 第${_reportPage}/${res.totalPages}页 <button onclick="loadReports(${_reportPage+1})" ${_reportPage>=res.totalPages?'disabled':''}>下一页</button>`;
    } else { pager.innerHTML = ''; }

    // 更新badge
    const badge = document.getElementById('reportBadge');
    if (badge) {
      const pendingCount = res.total || 0;
      badge.style.display = pendingCount > 0 && status === 'pending' ? '' : 'none';
      badge.textContent = pendingCount;
    }
  } catch(e) { console.error('加载举报列表失败:', e); }
}

async function handleReport(id, action) {
  const note = action === 'remove' ? '管理员已删除违规内容' : '举报不成立';
  try {
    const res = await fetch(`/api/wall/reports/${id}/handle`, {
      method: 'POST', headers: API._headers(),
      body: JSON.stringify({ action, admin_note: note })
    }).then(r => r.json());
    if (res.ok) { loadReports(); } else { alert(res.error || '操作失败'); }
  } catch(e) { alert('操作失败'); }
}

window.loadReports = loadReports;
window.handleReport = handleReport;
