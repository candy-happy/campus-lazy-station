// app/js/feedback.js - 问题反馈模块

// 反馈分类配置
const FB_CATEGORIES = [
  { key: 'bug', label: 'Bug报告', icon: '🐛' },
  { key: 'feature', label: '功能建议', icon: '💡' },
  { key: 'complaint', label: '投诉', icon: '😤' },
  { key: 'other', label: '其他', icon: '📝' }
];

const FB_STATUS_MAP = {
  pending: { label: '待处理', color: '#F39C12' },
  processing: { label: '处理中', color: '#3498DB' },
  replied: { label: '已回复', color: '#27AE60' },
  closed: { label: '已关闭', color: '#95A5A6' }
};

// 显示反馈页面
async function showFeedback() {
  if (!currentUser) { showToast('请先登录', 'error'); return; }
  openSubPage('feedbackPage_sub');
  renderFeedbackList();
}

// 渲染反馈列表
async function renderFeedbackList() {
  const body = document.getElementById('feedbackBody');
  if (!body) return;

  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div>';

  try {
    const list = await fetch('/api/feedback/mine', { headers: API._headers() }).then(r => r.json());
    let h = '';

    // 提交新反馈按钮
    h += `<button onclick="showFeedbackForm()" style="width:100%;padding:14px;background:linear-gradient(135deg,#FF6B2B,#ff9a56);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:16px">✏️ 提交新反馈</button>`;

    if (!list || list.length === 0) {
      h += '<div style="text-align:center;color:var(--text-secondary);padding:30px"><div style="font-size:40px;margin-bottom:12px">📭</div><div>暂无反馈记录</div></div>';
    } else {
      h += '<div style="font-size:14px;color:var(--text-secondary);margin-bottom:10px">我的反馈</div>';
      list.forEach(fb => {
        const cat = FB_CATEGORIES.find(c => c.key === fb.category) || FB_CATEGORIES[3];
        const st = FB_STATUS_MAP[fb.status] || FB_STATUS_MAP.pending;
        h += `<div onclick="showFeedbackDetail(${fb.id})" style="background:var(--card-bg);border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:14px;font-weight:600">${cat.icon} ${cat.label}</span>
            <span style="font-size:12px;color:${st.color};font-weight:600">${st.label}</span>
          </div>
          <div style="font-size:13px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(fb.content)}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:6px">${fb.created_at ? fb.created_at.slice(0,16).replace('T',' ') : ''}</div>
          ${fb.reply ? '<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text-secondary)"><b>回复：</b>' + escHtml(fb.reply) + '</div>' : ''}
        </div>`;
      });
    }
    body.innerHTML = h;
  } catch(e) {
    console.error('renderFeedbackList error:', e);
    body.innerHTML = '<div style="text-align:center;color:#E74C3C;padding:30px">加载失败，请重试</div>';
  }
}

// 显示反馈表单
function showFeedbackForm() {
  const body = document.getElementById('feedbackBody');
  if (!body) return;

  let h = `<div style="margin-bottom:16px">
    <button onclick="renderFeedbackList()" style="background:none;border:none;color:var(--orange);font-size:14px;cursor:pointer;padding:4px 0">← 返回列表</button>
  </div>
  <div style="font-size:18px;font-weight:700;margin-bottom:16px">📝 提交反馈</div>
  <div style="margin-bottom:14px">
    <label style="font-size:14px;font-weight:600;display:block;margin-bottom:6px">反馈类型</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap" id="fbCategoryBtns">`;

  FB_CATEGORIES.forEach((cat, i) => {
    h += `<button onclick="selectFbCategory('${cat.key}',this)" class="fb-cat-btn${i === 0 ? ' active' : ''}" data-cat="${cat.key}" style="padding:8px 14px;border:2px solid var(--border);border-radius:20px;background:${i === 0 ? 'var(--orange)' : 'var(--card-bg)'};color:${i === 0 ? '#fff' : 'var(--text)'};font-size:13px;cursor:pointer;font-weight:600">${cat.icon} ${cat.label}</button>`;
  });

  h += `</div></div>
  <div style="margin-bottom:14px">
    <label style="font-size:14px;font-weight:600;display:block;margin-bottom:6px">反馈内容 <span style="color:var(--danger)">*</span></label>
    <textarea id="fbContent" rows="5" placeholder="请详细描述你遇到的问题或建议..." style="width:100%;border:1px solid var(--border);border-radius:12px;padding:12px;font-size:14px;resize:vertical;outline:none;font-family:inherit;box-sizing:border-box" maxlength="1000" oninput="updateFbCharCount()"></textarea>
    <div style="text-align:right;font-size:12px;color:var(--text-secondary);margin-top:4px"><span id="fbCharCount">0</span>/1000</div>
  </div>
  <div style="margin-bottom:14px">
    <label style="font-size:14px;font-weight:600;display:block;margin-bottom:6px">联系方式（选填）</label>
    <input type="text" id="fbContact" placeholder="QQ/微信/邮箱" style="width:100%;border:1px solid var(--border);border-radius:12px;padding:12px;font-size:14px;outline:none;box-sizing:border-box">
  </div>
  <button onclick="submitFeedback()" id="fbSubmitBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#FF6B2B,#ff9a56);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer">提交反馈</button>`;

  body.innerHTML = h;
  window._fbCategory = 'bug';
}

function selectFbCategory(cat, btn) {
  window._fbCategory = cat;
  document.querySelectorAll('.fb-cat-btn').forEach(b => {
    b.style.background = 'var(--card-bg)';
    b.style.color = 'var(--text)';
    b.style.borderColor = 'var(--border)';
  });
  btn.style.background = 'var(--orange)';
  btn.style.color = '#fff';
  btn.style.borderColor = 'var(--orange)';
}

function updateFbCharCount() {
  const el = document.getElementById('fbContent');
  const count = document.getElementById('fbCharCount');
  if (el && count) count.textContent = el.value.length;
}

// 提交反馈
async function submitFeedback() {
  const content = document.getElementById('fbContent')?.value?.trim();
  const contact = document.getElementById('fbContact')?.value?.trim() || '';

  if (!content) { showToast('请输入反馈内容', 'error'); return; }
  if (content.length < 5) { showToast('反馈内容至少5个字', 'error'); return; }

  const btn = document.getElementById('fbSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '提交中...'; }

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: API._headers(),
      body: JSON.stringify({ category: window._fbCategory || 'other', content, contact })
    }).then(r => r.json());

    if (res.error) throw new Error(res.error);
    showToast('反馈提交成功', 'success');
    renderFeedbackList();
  } catch(e) {
    showToast(e.message || '提交失败', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '提交反馈'; }
  }
}

// 查看反馈详情
async function showFeedbackDetail(id) {
  try {
    const fb = await fetch('/api/feedback/' + id, { headers: API._headers() }).then(r => r.json());
    if (fb.error) throw new Error(fb.error);

    const body = document.getElementById('feedbackBody');
    if (!body) return;

    const cat = FB_CATEGORIES.find(c => c.key === fb.category) || FB_CATEGORIES[3];
    const st = FB_STATUS_MAP[fb.status] || FB_STATUS_MAP.pending;

    let h = `<div style="margin-bottom:16px">
      <button onclick="renderFeedbackList()" style="background:none;border:none;color:var(--orange);font-size:14px;cursor:pointer;padding:4px 0">← 返回列表</button>
    </div>
    <div style="background:var(--card-bg);border-radius:12px;padding:16px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:15px;font-weight:700">${cat.icon} ${cat.label}</span>
        <span style="font-size:13px;color:${st.color};font-weight:600;padding:4px 10px;background:${st.color}15;border-radius:12px">${st.label}</span>
      </div>
      <div style="font-size:14px;line-height:1.6;margin-bottom:10px;white-space:pre-wrap">${escHtml(fb.content)}</div>
      ${fb.contact ? '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">联系方式: ' + escHtml(fb.contact) + '</div>' : ''}
      <div style="font-size:12px;color:var(--text-secondary)">${fb.created_at ? fb.created_at.slice(0,16).replace('T',' ') : ''}</div>
    </div>`;

    if (fb.reply) {
      h += `<div style="background:#E8F5E9;border-radius:12px;padding:16px;margin-top:12px;border:1px solid #C8E6C9">
        <div style="font-size:14px;font-weight:600;color:#2E7D32;margin-bottom:8px">📨 官方回复</div>
        <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escHtml(fb.reply)}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:8px">${fb.reply_by ? '回复人: ' + escHtml(fb.reply_by) + ' | ' : ''}${fb.reply_at ? fb.reply_at.slice(0,16).replace('T',' ') : ''}</div>
      </div>`;
    }

    body.innerHTML = h;
  } catch(e) {
    showToast('加载失败', 'error');
    console.error('showFeedbackDetail error:', e);
  }
}
