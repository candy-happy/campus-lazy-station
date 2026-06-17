// admin/js/feedback.js - 问题反馈管理模块

const FB_CAT_MAP = { bug: '🐛 Bug报告', feature: '💡 功能建议', complaint: '😤 投诉', other: '📝 其他' };
const FB_STATUS_COLORS = { pending: '#F39C12', processing: '#3498DB', replied: '#27AE60', closed: '#95A5A6', approved: '#27AE60', rejected: '#E74C3C' };
const FB_STATUS_LABELS = { pending: '待处理', processing: '处理中', replied: '已回复', closed: '已关闭', approved: '已通过', rejected: '已驳回' };
let _fbPage = 1;
const _fbPageSize = 15;

// 管理端统一认证头
function _fbAuth() { return API._authHeaders(); }

async function loadFeedbackList(page) {
  if (page) _fbPage = page;
  const status = document.getElementById('fbFilterStatus')?.value || 'all';
  const category = document.getElementById('fbFilterCategory')?.value || 'all';
  const params = new URLSearchParams({ status, category, page: _fbPage, size: _fbPageSize });

  try {
    const res = await fetch('/api/feedback?' + params, { headers: _fbAuth() }).then(r => r.json());
    if (res.error) throw new Error(res.error);

    const { total, list, page: curPage } = res;
    _fbPage = curPage || _fbPage;

    // 更新统计
    loadFeedbackStats();

    // 渲染表格
    const tbody = document.getElementById('feedbackTable');
    if (!tbody) return;
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">暂无反馈</td></tr>';
    } else {
      tbody.innerHTML = list.map(fb => {
        const catLabel = FB_CAT_MAP[fb.category] || fb.category;
        const stColor = FB_STATUS_COLORS[fb.status] || '#999';
        const stLabel = FB_STATUS_LABELS[fb.status] || fb.status;
        const contentPreview = (fb.content || '').length > 40 ? fb.content.slice(0, 40) + '...' : (fb.content || '');
        return `<tr>
          <td style="font-weight:600">#${fb.id}</td>
          <td>${escHtml(fb.nickname || fb.phone || '')}<br><span style="font-size:11px;color:var(--text-muted)">${escHtml(fb.phone || '')}</span></td>
          <td>${catLabel}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(fb.content || '')}">${escHtml(contentPreview)}</td>
          <td><span style="color:${stColor};font-weight:600;font-size:12px;padding:3px 8px;background:${stColor}15;border-radius:10px">${stLabel}</span></td>
          <td style="font-size:12px;color:var(--text-muted)">${fb.created_at ? fb.created_at.slice(0,16).replace('T',' ') : ''}</td>
          <td style="white-space:nowrap">
            <button onclick="showFbReplyModal(${fb.id}, '${fb.status}')" style="padding:4px 10px;background:var(--orange);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:4px">回复</button>
            ${(fb.status === 'pending' || fb.status === 'processing') ? `<button onclick="approveFeedback(${fb.id})" style="padding:4px 10px;background:#27AE60;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:4px">通过</button>` : ''}
            ${(fb.status === 'pending' || fb.status === 'processing') ? `<button onclick="rejectFeedback(${fb.id})" style="padding:4px 10px;background:#E74C3C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:4px">驳回</button>` : ''}
            ${fb.status !== 'closed' && fb.status !== 'approved' && fb.status !== 'rejected' ? `<button onclick="closeFeedback(${fb.id})" style="padding:4px 10px;background:#95A5A6;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">关闭</button>` : ''}
          </td>
        </tr>`;
      }).join('');
    }

    // 分页
    const totalPages = Math.ceil(total / _fbPageSize);
    const pager = document.getElementById('feedbackPager');
    if (!pager) return;
    if (totalPages <= 1) {
      pager.innerHTML = '<span>共 ' + total + ' 条</span>';
    } else {
      pager.innerHTML = `
        <button onclick="loadFeedbackList(1)" ${_fbPage<=1?'disabled':''}>首页</button>
        <button onclick="loadFeedbackList(${_fbPage-1})" ${_fbPage<=1?'disabled':''}>上一页</button>
        <span>${_fbPage} / ${totalPages} 页，共 ${total} 条</span>
        <button onclick="loadFeedbackList(${_fbPage+1})" ${_fbPage>=totalPages?'disabled':''}>下一页</button>
        <button onclick="loadFeedbackList(${totalPages})" ${_fbPage>=totalPages?'disabled':''}>末页</button>`;
    }
  } catch(e) {
    console.error('loadFeedbackList error:', e);
    const tbody = document.getElementById('feedbackTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#E74C3C;padding:24px">加载失败: ' + escHtml(e.message) + '</td></tr>';
  }
}

async function loadFeedbackStats() {
  try {
    const s = await fetch('/api/feedback/stats/summary', { headers: _fbAuth() }).then(r => r.json());
    if (s.error) return;
    const el = (id) => document.getElementById(id);
    if (el('statFbTotal')) el('statFbTotal').textContent = s.total || 0;
    if (el('statFbPending')) el('statFbPending').textContent = s.pending || 0;
    if (el('statFbReplied')) el('statFbReplied').textContent = s.replied || 0;
    if (el('statFbClosed')) el('statFbClosed').textContent = s.closed || 0;
    if (el('statFbApproved')) el('statFbApproved').textContent = s.approved || 0;
    if (el('statFbRejected')) el('statFbRejected').textContent = s.rejected || 0;
    // 更新导航badge
    const badge = document.getElementById('feedbackBadge');
    if (badge) {
      badge.textContent = s.pending || 0;
      badge.style.display = (s.pending || 0) > 0 ? 'inline' : 'none';
    }
  } catch(e) { console.error('loadFeedbackStats error:', e); }
}

function showFbReplyModal(id, currentStatus) {
  const modal = document.getElementById('fbReplyModal');
  if (!modal) return;
  document.getElementById('fbReplyId').value = id;
  document.getElementById('fbReplyText').value = '';
  document.getElementById('fbReplyStatus').value = currentStatus === 'pending' ? 'processing' : currentStatus;
  modal.classList.add('active');
}

function closeFbReplyModal() {
  const modal = document.getElementById('fbReplyModal');
  if (modal) modal.classList.remove('active');
}

async function submitFbReply() {
  const id = document.getElementById('fbReplyId').value;
  const reply = document.getElementById('fbReplyText').value.trim();
  const status = document.getElementById('fbReplyStatus').value;
  if (!reply) { showToast('请输入回复内容'); return; }

  try {
    const res = await fetch('/api/feedback/' + id + '/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._fbAuth() },
      body: JSON.stringify({ reply, status })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    showToast('回复成功');
    closeFbReplyModal();
    loadFeedbackList();
  } catch(e) {
    showToast(e.message || '回复失败');
  }
}

async function closeFeedback(id) {
  if (!confirm('确定关闭此反馈？')) return;
  try {
    const res = await fetch('/api/feedback/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ..._fbAuth() },
      body: JSON.stringify({ status: 'closed' })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    showToast('已关闭');
    loadFeedbackList();
  } catch(e) {
    showToast(e.message || '操作失败');
  }
}

async function approveFeedback(id) {
  if (!confirm('确定通过此反馈？通过后会触发判官勋章统计。')) return;
  try {
    const res = await fetch('/api/feedback/' + id + '/approve', {
      method: 'POST',
      headers: _fbAuth()
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    showToast('已通过 ✅');
    loadFeedbackList();
  } catch(e) {
    showToast(e.message || '操作失败');
  }
}

async function rejectFeedback(id) {
  const reason = prompt('驳回理由（可选）：');
  if (reason === null) return; // 用户取消
  try {
    const res = await fetch('/api/feedback/' + id + '/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._fbAuth() },
      body: JSON.stringify({ reason: reason || '暂不处理' })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    showToast('已驳回 ❌');
    loadFeedbackList();
  } catch(e) {
    showToast(e.message || '操作失败');
  }
}

// 注册到 switchPage - 在 core.js 的 switchPage 基础上追加 feedback 页面逻辑
const _origSwitchPage = window.switchPage;
window.switchPage = function(page) {
  _origSwitchPage(page);
  if (page === 'feedback') loadFeedbackList();
};

window.loadFeedbackList = loadFeedbackList;
window.showFbReplyModal = showFbReplyModal;
window.closeFbReplyModal = closeFbReplyModal;
window.submitFbReply = submitFbReply;
window.closeFeedback = closeFeedback;
window.approveFeedback = approveFeedback;
window.rejectFeedback = rejectFeedback;
