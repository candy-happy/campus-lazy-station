// app/js/review.js - 校园期末复习资料（用户端）
(function () {
  'use strict';

  var reviewPage = 1;
  var reviewHasMore = false;

  // ══════ 加载复习资料列表 ══════
  window.loadReviewMaterials = function (page) {
    reviewPage = page || 1;
    var subject = document.getElementById('reviewSubjectFilter')?.value || '';
    var search = document.getElementById('reviewSearchInput')?.value.trim() || '';
    var listEl = document.getElementById('reviewMaterialsList');
    var pagerEl = document.getElementById('reviewMaterialsPager');
    if (!listEl) return;

    // 显示搜索清除按钮
    var clearBtn = document.getElementById('reviewSearchClear');
    if (clearBtn) clearBtn.style.display = search ? 'inline' : 'none';

    listEl.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999"><div style="font-size:2.5rem;margin-bottom:12px">⏳</div><div style="font-size:14px">加载中...</div></div>';

    var params = '?page=' + reviewPage + '&limit=20';
    if (subject) params += '&subject=' + encodeURIComponent(subject);
    if (search) params += '&search=' + encodeURIComponent(search);

    fetch('/api/review-materials' + params, { headers: API._headers() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">加载失败</div>'; return; }

        reviewHasMore = data.hasMore;

        // 更新科目筛选
        if (reviewPage === 1 && data.subjects) {
          var sel = document.getElementById('reviewSubjectFilter');
          if (sel) {
            var currentVal = sel.value;
            sel.innerHTML = '<option value="">全部科目</option>';
            data.subjects.forEach(function (s) {
              sel.innerHTML += '<option value="' + escHtml(s) + '"' + (s === currentVal ? ' selected' : '') + '>' + escHtml(s) + '</option>';
            });
          }
        }

        if (!data.list || data.list.length === 0) {
          listEl.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#bbb"><div style="font-size:3.5rem;margin-bottom:16px">📭</div><div style="font-size:15px;font-weight:600;color:#999;margin-bottom:4px">暂无复习资料</div><div style="font-size:12px;color:#bbb">快来上传第一份资料吧 ✨</div></div>';
          pagerEl.innerHTML = '';
          return;
        }

        var html = '';
        data.list.forEach(function (m) {
          var time = formatReviewTime(m.created_at);
          var uploader = m.uploader_name || m.nickname || m.name || '匿名';
          var fileIcon = getFileIcon(m.file_url);
          var fileSize = formatFileSize(m.file_size);
          var desc = m.description ? '<div style="font-size:12px;color:#888;margin-top:6px;line-height:1.5">' + escHtml(m.description) + '</div>' : '';

          html += '<div class="review-card" style="background:#fff;border-radius:14px;padding:0;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #f0f0f0;transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 2px 12px rgba(0,0,0,0.06)\'" >' +
            '<div style="display:flex;align-items:stretch">' +
              // 左侧色条 + 图标
              '<div style="width:56px;flex-shrink:0;background:linear-gradient(180deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:1.8rem">' + fileIcon + '</div>' +
              '<div style="flex:1;min-width:0;padding:14px 16px">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">' +
                  '<span style="font-size:11px;background:linear-gradient(135deg,#667eea20,#764ba220);color:#667eea;padding:3px 10px;border-radius:12px;font-weight:600;white-space:nowrap">' + escHtml(m.subject) + '</span>' +
                  '<span style="font-size:11px;color:#aaa">' + fileSize + '</span>' +
                  '<span style="font-size:11px;color:#aaa">' + (m.download_count || 0) + ' 次下载</span>' +
                '</div>' +
                '<div style="font-weight:600;font-size:15px;color:#222;word-break:break-all;line-height:1.4">' + escHtml(m.title) + '</div>' +
                desc +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">' +
                  '<span style="font-size:11px;color:#bbb">' + time + ' · ' + escHtml(uploader) + '</span>' +
                  (m.file_url ? '<a href="' + m.file_url + '" target="_blank" onclick="trackDownload(' + m.id + ')" style="font-size:12px;color:#fff;text-decoration:none;font-weight:600;padding:6px 16px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:18px;transition:all 0.2s;box-shadow:0 2px 8px rgba(102,126,234,0.25)" onmouseover="this.style.transform=\'scale(1.05)\';this.style.boxShadow=\'0 4px 14px rgba(102,126,234,0.35)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 2px 8px rgba(102,126,234,0.25)\'" >📥 下载</a>' : '<span style="font-size:12px;color:#ccc">无文件</span>') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        });

        listEl.innerHTML = html;

        // 分页
        var pagerHtml = '';
        if (reviewPage > 1) {
          pagerHtml += '<button onclick="loadReviewMaterials(' + (reviewPage - 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:13px">← 上一页</button>';
        }
        pagerHtml += '<span style="margin:0 12px">第 ' + reviewPage + ' 页</span>';
        if (reviewHasMore) {
          pagerHtml += '<button onclick="loadReviewMaterials(' + (reviewPage + 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:13px">下一页 →</button>';
        }
        pagerEl.innerHTML = pagerHtml;
      })
      .catch(function (e) {
        console.error('loadReviewMaterials error:', e);
        listEl.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#bbb"><div style="font-size:2.5rem;margin-bottom:12px">😢</div><div style="font-size:14px">加载失败，请重试</div></div>';
      });
  };

  // ══════ 打开上传弹窗 ══════
  window.openUploadMaterial = function () {
    if (!currentUser) {
      if (typeof showToast === 'function') showToast('请先登录');
      return;
    }
    document.getElementById('uploadSubject').value = '';
    document.getElementById('uploadTitle').value = '';
    document.getElementById('uploadDesc').value = '';
    document.getElementById('uploadFile').value = '';
    document.getElementById('uploaderName').value = currentUser.nickname || currentUser.name || '';
    document.getElementById('uploadMaterialModal').style.display = 'flex';
  };

  // ══════ 执行上传 ══════
  window.doUploadMaterial = function () {
    var subject = document.getElementById('uploadSubject').value.trim();
    var title = document.getElementById('uploadTitle').value.trim();
    var desc = document.getElementById('uploadDesc').value.trim();
    var fileInput = document.getElementById('uploadFile');
    var uploaderName = document.getElementById('uploaderName').value.trim();

    if (!subject) { if (typeof showToast === 'function') showToast('请填写科目'); return; }
    if (!title) { if (typeof showToast === 'function') showToast('请填写标题'); return; }

    var formData = new FormData();
    formData.append('subject', subject);
    formData.append('title', title);
    formData.append('description', desc);
    formData.append('uploader_name', uploaderName);
    if (fileInput.files && fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }

    fetch('/api/review-materials', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_token') || '') },
      body: formData
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          if (typeof showToast === 'function') showToast('资料已提交，等待审核');
          document.getElementById('uploadMaterialModal').style.display = 'none';
          loadReviewMaterials(1);
        } else {
          if (typeof showToast === 'function') showToast(data.message || '上传失败');
        }
      })
      .catch(function (e) {
        console.error('upload error:', e);
        if (typeof showToast === 'function') showToast('上传失败，请重试');
      });
  };

  // ══════ 下载计数 ══════
  window.trackDownload = function (id) {
    fetch('/api/review-materials/' + id + '/download', { method: 'POST', headers: API._headers() })
      .catch(function () {});
  };

  // ══════ 辅助函数 ══════
  function getFileIcon(url) {
    if (!url) return '📄';
    var ext = url.split('.').pop().toLowerCase();
    var map = {
      pdf: '📕', doc: '📘', docx: '📘', ppt: '📊', pptx: '📊',
      xls: '📗', xlsx: '📗', zip: '📦', rar: '📦', '7z': '📦',
      txt: '📝', md: '📝', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️'
    };
    return map[ext] || '📄';
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  function formatReviewTime(t) {
    if (!t) return '';
    var d = new Date(t.replace(' ', 'T') + (t.includes('+') || t.includes('Z') ? '' : '+08:00'));
    if (isNaN(d.getTime())) return t;
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
