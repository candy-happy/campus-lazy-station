// reports.js - 管理端统一举报管理（校园墙/二手市场/猫狗日记/教师评价/社团/活动）
let _reportPage = 1, _reportSource = 'all', _reportStatus = 'pending';

const REPORT_SOURCES = [
  { key: 'all',     label: '全部',      icon: '📋' },
  { key: 'wall',    label: '校园墙',     icon: '📝' },
  { key: 'market',  label: '二手市场',    icon: '🛒' },
  { key: 'pet',     label: '猫狗日记',    icon: '🐱' },
  { key: 'teacher', label: '教师评价',    icon: '👨‍🏫' },
  { key: 'club',    label: '社团',       icon: '🏘️' },
  { key: 'activity',label: '活动',       icon: '🎉' }
];

const STATUS_MAP = { pending: '待处理', resolved: '已处理', dismissed: '已驳回' };
const STATUS_COLOR = { pending: '#E67E22', resolved: '#27AE60', dismissed: '#95A5A6' };

async function loadReports(page) {
  if (page) _reportPage = page;
  try {
    const params = new URLSearchParams({
      source: _reportSource,
      status: _reportStatus,
      page: _reportPage,
      limit: 20
    });
    const res = await fetch('/api/reports?' + params, { headers: API._headers() }).then(r => r.json());
    const list = document.getElementById('reportsList');
    const pager = document.getElementById('reportsPager');
    const badge = document.getElementById('reportBadge');

    // 更新各来源待处理badge
    await loadReportStats();

    if (!res.reports || res.reports.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">暂无举报记录</div>';
      if (pager) pager.innerHTML = '';
      if (badge) badge.style.display = 'none';
      return;
    }

    const sourceLabel = {};
    REPORT_SOURCES.forEach(s => sourceLabel[s.key] = s.label);

    list.innerHTML = '<table class="data-table"><thead><tr>' +
      '<th>ID</th><th>来源</th><th>类型</th><th>举报内容</th><th>举报原因</th><th>举报人</th><th>状态</th><th>时间</th><th>操作</th>' +
      '</tr></thead><tbody>' +
      res.reports.map(r => `<tr>
        <td>${r.id}</td>
        <td><span style="font-size:12px">${sourceLabel[r.source] || r.source}</span></td>
        <td>${r.target_type}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.target_content||'').replace(/"/g,'&quot;')}">${(r.target_content||'').substring(0,50)}</td>
        <td>${r.reason}</td>
        <td>${r.reporter_phone}</td>
        <td><span style="color:${STATUS_COLOR[r.status]||'#999'};font-weight:600">${STATUS_MAP[r.status]||r.status}</span></td>
        <td style="font-size:11px">${(r.created_at||'').slice(0,16)}</td>
        <td>${r.status === 'pending'
          ? `<button onclick="handleReport(${r.id},'remove')" style="padding:3px 8px;border-radius:4px;background:#E74C3C;color:#fff;border:none;cursor:pointer;font-size:11px;margin-right:4px">删除内容</button><button onclick="handleReport(${r.id},'dismiss')" style="padding:3px 8px;border-radius:4px;background:var(--border);color:var(--text);border:none;cursor:pointer;font-size:11px">驳回</button>`
          : (r.admin_note || '')}
        </td>
      </tr>`).join('') + '</tbody></table>';

    if (pager && res.totalPages > 1) {
      pager.innerHTML = `<button onclick="loadReports(${_reportPage-1})" ${_reportPage<=1?'disabled':''}>上一页</button> 第${_reportPage}/${res.totalPages}页 <button onclick="loadReports(${_reportPage+1})" ${_reportPage>=res.totalPages?'disabled':''}>下一页</button>`;
    } else if (pager) { pager.innerHTML = ''; }
  } catch(e) { console.error('加载举报列表失败:', e); }
}

async function loadReportStats() {
  try {
    const res = await fetch('/api/reports/stats', { headers: API._headers() }).then(r => r.json());
    REPORT_SOURCES.forEach(s => {
      const badge = document.getElementById('reportBadge-' + s.key);
      if (badge) {
        const stats = res.bySource[s.key];
        const pending = stats ? stats.pending : 0;
        badge.style.display = pending > 0 ? '' : 'none';
        badge.textContent = pending;
      }
    });
    // 总badge
    const totalBadge = document.getElementById('reportBadge');
    if (totalBadge) {
      totalBadge.style.display = res.totalPending > 0 ? '' : 'none';
      totalBadge.textContent = res.totalPending;
    }
  } catch(e) {}
}

function switchReportSource(source) {
  _reportSource = source;
  _reportPage = 1;
  // 更新tab高亮
  document.querySelectorAll('#reportSourceTabs .source-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`#reportSourceTabs .source-tab[data-source="${source}"]`);
  if (activeTab) activeTab.classList.add('active');
  loadReports();
}

function filterReportStatus(status) {
  _reportStatus = status;
  _reportPage = 1;
  document.querySelectorAll('#reportStatusBtns .status-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`#reportStatusBtns .status-btn[data-status="${status}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  loadReports();
}

async function handleReport(id, action) {
  const note = action === 'remove' ? '管理员已删除违规内容' : '举报不成立';
  try {
    const res = await fetch(`/api/reports/${id}/handle`, {
      method: 'POST', headers: API._headers(),
      body: JSON.stringify({ action, admin_note: note })
    }).then(r => r.json());
    if (res.ok) { loadReports(); } else { alert(res.error || '操作失败'); }
  } catch(e) { alert('操作失败'); }
}

window.loadReports = loadReports;
window.switchReportSource = switchReportSource;
window.filterReportStatus = filterReportStatus;
window.handleReport = handleReport;
