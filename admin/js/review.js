// admin/js/review.js - 复习资料管理
(function () {
  'use strict';

  var reviewAdminPage = 1;
  var reviewAdminHasMore = false;

  // ══════ 加载管理列表 ══════
  window.loadReviewMaterialsAdmin = function (page) {
    reviewAdminPage = page || 1;
    var status = document.getElementById('reviewAdminStatus')?.value || '';
    var subject = document.getElementById('reviewAdminSubject')?.value || '';
    var search = document.getElementById('reviewAdminSearch')?.value.trim() || '';
    var tbody = document.getElementById('reviewMaterialsTable');
    var pagerEl = document.getElementById('reviewMaterialsPager');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-secondary)">加载中...</td></tr>';

    var params = '?page=' + reviewAdminPage + '&limit=20';
    if (status) params += '&status=' + status;
    if (subject) params += '&subject=' + encodeURIComponent(subject);
    if (search) params += '&search=' + encodeURIComponent(search);

    fetch('/api/review-materials/admin/list' + params, { headers: API._headers() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-secondary)">加载失败</td></tr>'; return; }

        reviewAdminHasMore = data.hasMore;

        // 更新待审核徽章
        var badge = document.getElementById('reviewBadge');
        if (badge) {
          var cnt = data.pendingCount || 0;
          badge.textContent = cnt;
          badge.style.display = cnt > 0 ? 'inline-block' : 'none';
        }

        // 更新科目筛选
        if (reviewAdminPage === 1 && data.subjects) {
          var sel = document.getElementById('reviewAdminSubject');
          if (sel) {
            var currentVal = sel.value;
            sel.innerHTML = '<option value="">📖 全部科目</option>';
            data.subjects.forEach(function (s) {
              sel.innerHTML += '<option value="' + escHtml(s) + '"' + (s === currentVal ? ' selected' : '') + '>' + escHtml(s) + '</option>';
            });
          }
        }

        if (!data.list || data.list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary)">暂无资料</td></tr>';
          pagerEl.innerHTML = '';
          return;
        }

        var html = '';
        data.list.forEach(function (m) {
          var statusBadge = '';
          if (m.status === 'pending') statusBadge = '<span style="background:#FFF3E0;color:#E65100;padding:2px 8px;border-radius:10px;font-size:12px">⏳ 待审核</span>';
          else if (m.status === 'approved') statusBadge = '<span style="background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:10px;font-size:12px">✅ 已通过</span>';
          else if (m.status === 'rejected') statusBadge = '<span style="background:#FFEBEE;color:#C62828;padding:2px 8px;border-radius:10px;font-size:12px">❌ 已拒绝</span>';

          var fileInfo = m.file_url ? '<a href="' + m.file_url + '" target="_blank" style="color:var(--primary);font-size:12px">📎 ' + formatFileSize(m.file_size) + '</a>' : '<span style="color:var(--text-muted);font-size:12px">无</span>';

          var actions = '';
          if (m.status === 'pending') {
            actions = '<button onclick="approveMaterial(' + m.id + ')" style="padding:4px 10px;border-radius:6px;background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7;cursor:pointer;font-size:12px;margin-right:4px">✅ 通过</button>' +
                      '<button onclick="openRejectModal(' + m.id + ')" style="padding:4px 10px;border-radius:6px;background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;cursor:pointer;font-size:12px;margin-right:4px">❌ 拒绝</button>';
          }
          actions += '<button onclick="deleteMaterial(' + m.id + ')" style="padding:4px 10px;border-radius:6px;background:#fff;color:#666;border:1px solid #ddd;cursor:pointer;font-size:12px">🗑</button>';

          html += '<tr>' +
            '<td style="font-size:13px">' + escHtml(m.subject) + '</td>' +
            '<td style="font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(m.title) + '">' + escHtml(m.title) + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary)">' + escHtml(m.uploader_name || '匿名') + '</td>' +
            '<td>' + fileInfo + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary)">' + (m.download_count || 0) + '</td>' +
            '<td style="font-size:11px;color:var(--text-muted)">' + (m.created_at ? m.created_at.slice(0, 16) : '') + '</td>' +
            '<td style="white-space:nowrap">' + actions + '</td>' +
          '</tr>';
        });

        tbody.innerHTML = html;

        // 分页
        var pagerHtml = '';
        if (reviewAdminPage > 1) {
          pagerHtml += '<button onclick="loadReviewMaterialsAdmin(' + (reviewAdminPage - 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);cursor:pointer;font-size:13px">← 上一页</button>';
        }
        pagerHtml += '<span style="margin:0 12px">第 ' + reviewAdminPage + ' 页</span>';
        if (reviewAdminHasMore) {
          pagerHtml += '<button onclick="loadReviewMaterialsAdmin(' + (reviewAdminPage + 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);cursor:pointer;font-size:13px">下一页 →</button>';
        }
        pagerEl.innerHTML = pagerHtml;
      })
      .catch(function (e) {
        console.error('loadReviewMaterialsAdmin error:', e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-secondary)">加载失败</td></tr>';
      });
  };

  // ══════ 显示添加弹窗 ══════
  window.showReviewMaterialModal = function () {
    document.getElementById('reviewFormSubject').value = '';
    document.getElementById('reviewFormTitle').value = '';
    document.getElementById('reviewFormDesc').value = '';
    document.getElementById('reviewFormFile').value = '';
    document.getElementById('reviewMaterialModal').classList.add('active');
  };

  // ══════ 管理员直接添加 ══════
  window.doAddReviewMaterial = function () {
    var subject = document.getElementById('reviewFormSubject').value.trim();
    var title = document.getElementById('reviewFormTitle').value.trim();
    var desc = document.getElementById('reviewFormDesc').value.trim();
    var fileInput = document.getElementById('reviewFormFile');

    if (!subject) { showToast('请填写科目'); return; }
    if (!title) { showToast('请填写标题'); return; }

    var formData = new FormData();
    formData.append('subject', subject);
    formData.append('title', title);
    formData.append('description', desc);
    if (fileInput.files && fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }

    fetch('/api/review-materials/admin', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_token') || '') },
      body: formData
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          showToast('资料已添加');
          closeModal('reviewMaterialModal');
          loadReviewMaterialsAdmin(1);
        } else {
          showToast(data.message || '添加失败');
        }
      })
      .catch(function (e) {
        console.error('add error:', e);
        showToast('添加失败');
      });
  };

  // ══════ 审核通过 ══════
  window.approveMaterial = function (id) {
    if (!confirm('确认通过这条资料？')) return;
    fetch('/api/review-materials/' + id + '/approve', {
      method: 'PUT',
      headers: API._headers()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          showToast('已通过');
          loadReviewMaterialsAdmin(reviewAdminPage);
        } else {
          showToast(data.message || '操作失败');
        }
      })
      .catch(function () { showToast('操作失败'); });
  };

  // ══════ 打开拒绝弹窗 ══════
  window.openRejectModal = function (id) {
    document.getElementById('rejectMaterialId').value = id;
    document.getElementById('rejectMaterialRemark').value = '';
    document.getElementById('rejectMaterialModal').classList.add('active');
  };

  // ══════ 确认拒绝 ══════
  window.doRejectMaterial = function () {
    var id = document.getElementById('rejectMaterialId').value;
    var remark = document.getElementById('rejectMaterialRemark').value.trim();

    fetch('/api/review-materials/' + id + '/reject', {
      method: 'PUT',
      headers: API._headers(),
      body: JSON.stringify({ remark: remark })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          showToast('已拒绝');
          closeModal('rejectMaterialModal');
          loadReviewMaterialsAdmin(reviewAdminPage);
        } else {
          showToast(data.message || '操作失败');
        }
      })
      .catch(function () { showToast('操作失败'); });
  };

  // ══════ 删除 ══════
  window.deleteMaterial = function (id) {
    if (!confirm('确认删除这条资料？此操作不可撤销。')) return;
    fetch('/api/review-materials/' + id, {
      method: 'DELETE',
      headers: API._headers()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          showToast('已删除');
          loadReviewMaterialsAdmin(reviewAdminPage);
        } else {
          showToast(data.message || '删除失败');
        }
      })
      .catch(function () { showToast('删除失败'); });
  };

  // ══════ 辅助函数 ══════
  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
