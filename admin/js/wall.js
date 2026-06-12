// wall.js - 管理端校园墙管理
let _wallPostPage = 1, _wallPostFilter = 'all';
let _wallCommentPage = 1;
let _wallDetailPostId = null;

// ══════════════════════════════════════════════════════
// Tab 切换
// ══════════════════════════════════════════════════════
function switchWallTab(tab, btn) {
  document.querySelectorAll('#page-wall .market-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('#page-wall .market-admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('wallPanel-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'posts') loadWallPosts();
  else if (tab === 'comments') loadWallComments();
}

// ══════════════════════════════════════════════════════
// 帖子管理
// ══════════════════════════════════════════════════════
function filterWallPosts(filter, btn) {
  document.querySelectorAll('#wallPanel-posts .ads-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _wallPostFilter = filter;
  _wallPostPage = 1;
  loadWallPosts();
}

async function loadWallPosts(page) {
  if (page) _wallPostPage = page;
  const keyword = document.getElementById('wallPostSearch')?.value || '';
  try {
    const params = new URLSearchParams({ page: _wallPostPage, limit: 20, status: _wallPostFilter, keyword });
    const res = await fetch('/api/wall/admin/posts?' + params, { headers: API._headers() }).then(r => r.json());
    const tbody = document.getElementById('wallPostsTable');
    document.getElementById('wallPostCount').textContent = `共 ${res.total || 0} 条`;

    if (!res.posts || res.posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-secondary)">暂无帖子</td></tr>';
      document.getElementById('wallPostsPager').innerHTML = '';
      return;
    }

    tbody.innerHTML = res.posts.map(p => {
      const content = (p.content || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const tags = (p.tags || '').replace(/,/g, ', ');
      const hasMedia = (p.images && p.images !== '[]') || (p.video && p.video !== '[]') ? '📷' : '-';
      const reportColor = p.pendingReports > 0 ? 'color:#E74C3C;font-weight:bold' : '';

      return `<tr style="cursor:pointer" onclick="showWallPostDetail(${p.id})" title="点击查看详情">
        <td>${p.id}</td>
        <td title="${p.phone}">${p.nickname || p.phone?.slice(-4) || '-'}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${content}">${(p.content||'').substring(0,50)}</td>
        <td style="max-width:100px;font-size:12px;color:var(--text-secondary)">${tags.substring(0,30) || '-'}</td>
        <td>${hasMedia}</td>
        <td>${p.like_count||0}</td>
        <td>${p.comment_count||0}</td>
        <td>${p.is_pinned ? '✅' : '—'}</td>
        <td>${p.is_featured ? '⭐' : '—'}</td>
        <td style="${reportColor}">${p.pendingReports > 0 ? '🚫'+p.pendingReports : '—'}</td>
        <td style="font-size:12px">${(p.created_at||'').slice(0,16)}</td>
        <td style="white-space:nowrap" onclick="event.stopPropagation()">
          <button onclick="toggleWallPin(${p.id})" style="padding:3px 7px;border-radius:4px;background:var(--border);border:none;cursor:pointer;font-size:11px;margin-right:3px" title="置顶/取消置顶">📌</button>
          <button onclick="toggleWallFeature(${p.id})" style="padding:3px 7px;border-radius:4px;background:var(--border);border:none;cursor:pointer;font-size:11px;margin-right:3px" title="精华/取消精华">⭐</button>
          <button onclick="deleteWallPost(${p.id})" style="padding:3px 7px;border-radius:4px;background:#E74C3C;color:#fff;border:none;cursor:pointer;font-size:11px" title="删除帖子">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    // 分页
    const totalPages = Math.ceil((res.total || 0) / 20);
    const pager = document.getElementById('wallPostsPager');
    if (totalPages > 1) {
      pager.innerHTML = `<button onclick="loadWallPosts(${_wallPostPage-1})" ${_wallPostPage<=1?'disabled':''}>上一页</button> 第${_wallPostPage}/${totalPages}页 <button onclick="loadWallPosts(${_wallPostPage+1})" ${_wallPostPage>=totalPages?'disabled':''}>下一页</button>`;
    } else { pager.innerHTML = ''; }
  } catch(e) { console.error('加载帖子列表失败:', e); }
}

async function toggleWallPin(id) {
  try {
    const res = await fetch(`/api/wall/pin/${id}`, { method: 'POST', headers: API._headers() }).then(r => r.json());
    if (res.ok) {
      loadWallPosts(_wallPostPage);
      if (_wallDetailPostId) showWallPostDetail(_wallDetailPostId);
    }
    else alert(res.error || '操作失败');
  } catch(e) { alert('置顶操作失败'); }
}

async function toggleWallFeature(id) {
  try {
    const res = await fetch(`/api/wall/feature/${id}`, { method: 'POST', headers: API._headers() }).then(r => r.json());
    if (res.ok) {
      loadWallPosts(_wallPostPage);
      if (_wallDetailPostId) showWallPostDetail(_wallDetailPostId);
    }
    else alert(res.error || '操作失败');
  } catch(e) { alert('精华操作失败'); }
}

async function deleteWallPost(id) {
  if (!confirm('确定删除该帖子？帖子下的所有评论、点赞、举报也会被一并删除。')) return;
  try {
    const res = await fetch(`/api/wall/admin/posts/${id}`, { method: 'DELETE', headers: API._headers() }).then(r => r.json());
    if (res.ok) { loadWallPosts(_wallPostPage); closeWallDetail(); }
    else alert(res.error || '删除失败');
  } catch(e) { alert('删除失败'); }
}

// ══════════════════════════════════════════════════════
// 帖子详情弹窗
// ══════════════════════════════════════════════════════
async function showWallPostDetail(id) {
  try {
    const res = await fetch(`/api/wall/posts/${id}`, { headers: API._headers() }).then(r => r.json());
    if (res.code) { alert(res.message || '获取帖子详情失败'); return; }
    const p = res;
    const tags = (p.tags || []).length ? p.tags.map(t => `<span style="display:inline-block;padding:3px 8px;background:var(--bg);border-radius:10px;font-size:12px;color:var(--text-secondary);margin:2px">#${t}</span>`).join('') : '<span style="color:var(--text-secondary);font-size:13px">无标签</span>';
    const images = (p.images || []).length > 0
      ? p.images.map(img => `<img src="${img}" style="max-width:100%;border-radius:8px;margin:4px 0;cursor:pointer" onclick="window.open('${img}')" />`).join('')
      : '';
    const commentsHtml = (p.comments || []).length > 0
      ? p.comments.map(c => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            ${c.avatar ? `<img src="${c.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover" />` : '<div style="width:24px;height:24px;border-radius:50%;background:var(--border)"></div>'}
            <span style="font-size:13px;font-weight:600">${c.nickname || (c.phone||'').slice(-4) || '匿名'}</span>
            <span style="font-size:11px;color:var(--text-secondary)">${(c.created_at||'').slice(0,16)}</span>
            <span style="margin-left:auto"><button onclick="event.stopPropagation();deleteWallComment(${c.id})" style="padding:2px 6px;border-radius:4px;background:#E74C3C;color:#fff;border:none;cursor:pointer;font-size:10px">删除</button></span>
          </div>
          <div style="font-size:14px;color:var(--text);word-break:break-all">${(c.content||'').replace(/</g,'&lt;')}</div>
        </div>`).join('')
      : '<div style="text-align:center;padding:20px;color:var(--text-secondary)">暂无评论</div>';

    const overlay = document.createElement('div');
    overlay.id = 'wallDetailOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="wallDetailBox" style="background:var(--card);border-radius:16px;width:680px;max-width:95vw;max-height:92vh;overflow-y:auto;padding:24px;animation:scaleIn 0.25s;position:relative" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;position:sticky;top:0;background:var(--card);padding-bottom:12px;border-bottom:1px solid var(--border);z-index:1">
          <div style="display:flex;align-items:center;gap:10px">
            ${p.avatar ? `<img src="${p.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />` : ''}
            <div>
              <div style="font-weight:700;font-size:15px">${p.nickname || (p.phone||'').slice(-4) || '匿名'}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${p.phone || ''} · ${(p.created_at||'').slice(0,16)}</div>
            </div>
          </div>
          <button onclick="document.getElementById('wallDetailOverlay').remove()" style="background:none;border:none;font-size:22px;color:var(--text-secondary);cursor:pointer;padding:4px 8px">✕</button>
        </div>

        <!-- 帖子内容 -->
        <div style="font-size:15px;line-height:1.7;color:var(--text);margin-bottom:12px;word-break:break-all">${(p.content||'').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
        ${images ? `<div style="margin-bottom:12px">${images}</div>` : ''}
        <div style="margin-bottom:12px">${tags}</div>

        <!-- 统计信息 -->
        <div style="display:flex;gap:16px;padding:10px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
          <span>👍 ${p.like_count||0}</span>
          <span>💬 ${p.comment_count||0}</span>
          <span>👁️ ${p.exposure_count||0}</span>
          <span style="margin-left:auto">${p.is_pinned?'📌置顶 ':''}${p.is_featured?'⭐精华 ':''}${!p.is_pinned && !p.is_featured ? '普通帖子' : ''}</span>
        </div>

        <!-- 管理操作 -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <button onclick="toggleWallPin(${p.id})" style="padding:6px 14px;border-radius:8px;background:${p.is_pinned?'#E74C3C':'var(--border)'};color:${p.is_pinned?'#fff':'var(--text)'};border:none;cursor:pointer;font-size:13px">📌 ${p.is_pinned?'取消置顶':'置顶'}</button>
          <button onclick="toggleWallFeature(${p.id})" style="padding:6px 14px;border-radius:8px;background:${p.is_featured?'#F39C12':'var(--border)'};color:${p.is_featured?'#fff':'var(--text)'};border:none;cursor:pointer;font-size:13px">⭐ ${p.is_featured?'取消精华':'设为精华'}</button>
          <button onclick="if(confirm('确定删除？'))deleteWallPost(${p.id})" style="padding:6px 14px;border-radius:8px;background:#E74C3C;color:#fff;border:none;cursor:pointer;font-size:13px;margin-left:auto">🗑️ 删除帖子</button>
        </div>

        <!-- 评论区 -->
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">评论 (${p.comments?.length||0})</div>
        <div id="wallDetailComments">${commentsHtml}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    _wallDetailPostId = id;
  } catch(e) { alert('加载详情失败: ' + e.message); }
}

function closeWallDetail() {
  const overlay = document.getElementById('wallDetailOverlay');
  if (overlay) overlay.remove();
  _wallDetailPostId = null;
}

// ══════════════════════════════════════════════════════
// 评论管理
// ══════════════════════════════════════════════════════
async function loadWallComments(page) {
  if (page) _wallCommentPage = page;
  const keyword = document.getElementById('wallCommentSearch')?.value || '';
  try {
    const params = new URLSearchParams({ page: _wallCommentPage, limit: 20, keyword });
    const res = await fetch('/api/wall/admin/comments?' + params, { headers: API._headers() }).then(r => r.json());
    const tbody = document.getElementById('wallCommentsTable');
    document.getElementById('wallCommentCount').textContent = `共 ${res.total || 0} 条`;

    if (!res.comments || res.comments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-secondary)">暂无评论</td></tr>';
      document.getElementById('wallCommentsPager').innerHTML = '';
      return;
    }

    tbody.innerHTML = res.comments.map(c => `<tr>
      <td>${c.id}</td>
      <td>${c.post_id}</td>
      <td title="${c.phone}">${c.nickname || c.phone?.slice(-4) || '-'}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(c.content||'').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${(c.content||'').substring(0,60)}</td>
      <td style="font-size:12px">${(c.created_at||'').slice(0,16)}</td>
      <td><button onclick="deleteWallComment(${c.id})" style="padding:3px 7px;border-radius:4px;background:#E74C3C;color:#fff;border:none;cursor:pointer;font-size:11px">🗑️ 删除</button></td>
    </tr>`).join('');

    const totalPages = Math.ceil((res.total || 0) / 20);
    const pager = document.getElementById('wallCommentsPager');
    if (totalPages > 1) {
      pager.innerHTML = `<button onclick="loadWallComments(${_wallCommentPage-1})" ${_wallCommentPage<=1?'disabled':''}>上一页</button> 第${_wallCommentPage}/${totalPages}页 <button onclick="loadWallComments(${_wallCommentPage+1})" ${_wallCommentPage>=totalPages?'disabled':''}>下一页</button>`;
    } else { pager.innerHTML = ''; }
  } catch(e) { console.error('加载评论列表失败:', e); }
}

async function deleteWallComment(id) {
  if (!confirm('确定删除该评论？相关点赞和举报也会被删除。')) return;
  try {
    const res = await fetch(`/api/wall/admin/comments/${id}`, { method: 'DELETE', headers: API._headers() }).then(r => r.json());
    if (res.ok) {
      loadWallComments(_wallCommentPage);
      if (_wallDetailPostId) showWallPostDetail(_wallDetailPostId);
    }
    else alert(res.error || '删除失败');
  } catch(e) { alert('删除失败'); }
}
// ══════════════════════════════════════════════════════
// 全局导出
// ══════════════════════════════════════════════════════
window.switchWallTab = switchWallTab;
window.filterWallPosts = filterWallPosts;
window.loadWallPosts = loadWallPosts;
window.toggleWallPin = toggleWallPin;
window.toggleWallFeature = toggleWallFeature;
window.deleteWallPost = deleteWallPost;
window.showWallPostDetail = showWallPostDetail;
window.closeWallDetail = closeWallDetail;
window.loadWallComments = loadWallComments;
window.deleteWallComment = deleteWallComment;
