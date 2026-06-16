// admin/js/star.js - 校花校草管理
(function () {
  'use strict';

  var starAdminPage = 1;
  var starAdminHasMore = false;
  var starAdminTab = 'candidates'; // 'candidates' | 'comments'

  // ══════ 切换Tab ══════
  window.switchStarAdminTab = function (tab) {
    starAdminTab = tab;
    document.querySelectorAll('.star-admin-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('starCandidatesPanel').style.display = tab === 'candidates' ? '' : 'none';
    document.getElementById('starCommentsPanel').style.display = tab === 'comments' ? '' : 'none';
    if (tab === 'candidates') loadStarCandidates(1);
    else loadStarComments(1);
  };

  // ══════ 加载候选人列表 ══════
  window.loadStarCandidates = function (page) {
    starAdminPage = page || 1;
    var status = document.getElementById('starAdminStatus')?.value || '';
    var month = document.getElementById('starAdminMonth')?.value || '';
    var search = document.getElementById('starAdminSearch')?.value.trim() || '';
    var tbody = document.getElementById('starCandidatesTable');
    var pagerEl = document.getElementById('starCandidatesPager');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-secondary)">加载中...</td></tr>';

    var params = '?page=' + starAdminPage + '&limit=20';
    if (status) params += '&status=' + status;
    if (month) params += '&month=' + encodeURIComponent(month);
    if (search) params += '&search=' + encodeURIComponent(search);

    fetch('/api/campus-star/admin/list' + params, { headers: API._headers() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-secondary)">加载失败</td></tr>'; return; }

        starAdminHasMore = data.hasMore;

        // 更新月份筛选
        if (starAdminPage === 1 && data.months) {
          var sel = document.getElementById('starAdminMonth');
          if (sel) {
            var currentVal = sel.value;
            sel.innerHTML = '<option value="">📅 全部月份</option>';
            data.months.forEach(function (m) {
              sel.innerHTML += '<option value="' + escHtml(m) + '"' + (m === currentVal ? ' selected' : '') + '>' + escHtml(m) + '</option>';
            });
          }
        }

        // 更新状态计数
        if (data.statusCounts) {
          var cnts = data.statusCounts;
          var cntEl = document.getElementById('starStatusCounts');
          if (cntEl) {
            cntEl.innerHTML = '<span style="color:#27ae60">活跃 ' + (cnts.active||0) + '</span> · ' +
              '<span style="color:#e67e22">冠军 ' + (cnts.champion||0) + '</span> · ' +
              '<span style="color:#3498db">亚军 ' + (cnts.runner_up||0) + '</span> · ' +
              '<span style="color:#7f8c8d">归档 ' + (cnts.archived||0) + '</span>';
          }
        }

        if (!data.list || data.list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-secondary)">暂无数据</td></tr>';
          pagerEl.innerHTML = '';
          return;
        }

        var html = '';
        data.list.forEach(function (m) {
          var statusBadge = '';
          if (m.status === 'active') statusBadge = '<span style="background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:10px;font-size:12px">🟢 活跃</span>';
          else if (m.status === 'champion') statusBadge = '<span style="background:#FFF8E1;color:#F57F17;padding:2px 8px;border-radius:10px;font-size:12px">👑 冠军</span>';
          else if (m.status === 'runner_up') statusBadge = '<span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:10px;font-size:12px">🥈 亚军</span>';
          else if (m.status === 'archived') statusBadge = '<span style="background:#ECEFF1;color:#546E7A;padding:2px 8px;border-radius:10px;font-size:12px">📦 归档</span>';

          var photosHtml = '';
          if (m.photos) {
            var imgs = m.photos.split(',');
            imgs.forEach(function (p) {
              photosHtml += '<img src="' + p + '" style="width:40px;height:40px;border-radius:6px;object-fit:cover;margin:2px" onerror="this.style.display=\'none\'">';
            });
          }

          var statusSelect = '<select onchange="updateStarStatus(' + m.id + ', this.value)" style="padding:2px 6px;border-radius:6px;border:1px solid #ddd;font-size:11px;background:var(--card-bg);color:var(--text)">' +
            '<option value="active"' + (m.status === 'active' ? ' selected' : '') + '>活跃</option>' +
            '<option value="champion"' + (m.status === 'champion' ? ' selected' : '') + '>冠军</option>' +
            '<option value="runner_up"' + (m.status === 'runner_up' ? ' selected' : '') + '>亚军</option>' +
            '<option value="archived"' + (m.status === 'archived' ? ' selected' : '') + '>归档</option>' +
          '</select>';

          html += '<tr>' +
            '<td>' + photosHtml + '</td>' +
            '<td style="font-size:13px;font-weight:600">' + escHtml(m.name) + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary)">' + escHtml(m.nickname || m.student_id || '') + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(m.intro || '') + '">' + escHtml((m.intro || '').slice(0, 30)) + '</td>' +
            '<td style="font-size:13px;font-weight:600;color:#e67e22">' + (m.votes || 0) + '</td>' +
            '<td style="font-size:12px">' + (m.share_count || 0) + '</td>' +
            '<td>' + statusSelect + '</td>' +
            '<td style="font-size:11px;color:var(--text-muted)">' + escHtml(m.month) + '<br>' + (m.created_at ? m.created_at.slice(0, 10) : '') + '</td>' +
            '<td><button onclick="deleteStarCandidate(' + m.id + ', \'' + escHtml(m.name) + '\')" style="padding:4px 10px;border-radius:6px;background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;cursor:pointer;font-size:12px">🗑 删除</button></td>' +
          '</tr>';
        });

        tbody.innerHTML = html;

        var pagerHtml = '';
        if (starAdminPage > 1) {
          pagerHtml += '<button onclick="loadStarCandidates(' + (starAdminPage - 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);cursor:pointer;font-size:13px">← 上一页</button>';
        }
        pagerHtml += '<span style="margin:0 12px">第 ' + starAdminPage + ' 页</span>';
        if (starAdminHasMore) {
          pagerHtml += '<button onclick="loadStarCandidates(' + (starAdminPage + 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);cursor:pointer;font-size:13px">下一页 →</button>';
        }
        pagerEl.innerHTML = pagerHtml;
      })
      .catch(function (e) {
        console.error('loadStarCandidates error:', e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-secondary)">加载失败</td></tr>';
      });
  };

  // ══════ 更新候选人状态 ══════
  window.updateStarStatus = function (id, status) {
    fetch('/api/campus-star/admin/' + id + '/status', {
      method: 'PUT',
      headers: API._headers(),
      body: JSON.stringify({ status: status })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          showToast('状态已更新为: ' + status);
        } else {
          showToast(data.message || '操作失败');
        }
      })
      .catch(function () { showToast('操作失败'); });
  };

  // ══════ 删除候选人 ══════
  window.deleteStarCandidate = function (id, name) {
    if (!confirm('确认删除「' + name + '」？此操作不可撤销，将同时删除关联的投票和评论数据。')) return;
    fetch('/api/campus-star/admin/' + id, {
      method: 'DELETE',
      headers: API._headers()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          showToast('已删除');
          loadStarCandidates(starAdminPage);
        } else {
          showToast(data.message || '删除失败');
        }
      })
      .catch(function () { showToast('删除失败'); });
  };

  // ══════ 批量结算 ══════
  window.settleStarMonth = function () {
    var month = prompt('请输入要结算的月份（格式：YYYY-MM）：');
    if (!month) return;
    if (!/^\d{4}-\d{2}$/.test(month)) { showToast('月份格式错误，请使用 YYYY-MM 格式'); return; }
    if (!confirm('确认结算 ' + month + ' ？\n前3名将设为冠军/亚军，其余归档。')) return;

    fetch('/api/campus-star/admin/batch-settle', {
      method: 'POST',
      headers: API._headers(),
      body: JSON.stringify({ month: month })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          showToast(data.message);
          loadStarCandidates(1);
        } else {
          showToast(data.message || '结算失败');
        }
      })
      .catch(function () { showToast('结算失败'); });
  };

  // ══════ 加载评论列表 ══════
  window.loadStarComments = function (page) {
    var p = page || 1;
    var search = document.getElementById('starCommentSearch')?.value.trim() || '';
    var tbody = document.getElementById('starCommentsTable');
    var pagerEl = document.getElementById('starCommentsPager');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-secondary)">加载中...</td></tr>';

    var params = '?page=' + p + '&limit=20';
    if (search) params += '&search=' + encodeURIComponent(search);

    fetch('/api/campus-star/admin/comments' + params, { headers: API._headers() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">加载失败</td></tr>'; return; }

        if (!data.list || data.list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-secondary)">暂无评论</td></tr>';
          pagerEl.innerHTML = '';
          return;
        }

        var html = '';
        data.list.forEach(function (c) {
          html += '<tr>' +
            '<td style="font-size:13px;font-weight:600">' + escHtml(c.candidate_name || '') + '</td>' +
            '<td style="font-size:12px">' + escHtml(c.nickname || '') + '</td>' +
            '<td style="font-size:13px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(c.content || '') + '">' + escHtml(c.content || '') + '</td>' +
            '<td style="font-size:11px;color:var(--text-muted)">' + (c.created_at ? c.created_at.slice(0, 16) : '') + '</td>' +
            '<td><button onclick="deleteStarComment(' + c.id + ')" style="padding:4px 10px;border-radius:6px;background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;cursor:pointer;font-size:12px">🗑</button></td>' +
          '</tr>';
        });

        tbody.innerHTML = html;

        var pagerHtml = '';
        if (p > 1) {
          pagerHtml += '<button onclick="loadStarComments(' + (p - 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);cursor:pointer;font-size:13px">← 上一页</button>';
        }
        pagerHtml += '<span style="margin:0 12px">第 ' + p + ' 页</span>';
        if (data.hasMore) {
          pagerHtml += '<button onclick="loadStarComments(' + (p + 1) + ')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);cursor:pointer;font-size:13px">下一页 →</button>';
        }
        pagerEl.innerHTML = pagerHtml;
      })
      .catch(function (e) {
        console.error('loadStarComments error:', e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">加载失败</td></tr>';
      });
  };

  // ══════ 删除评论 ══════
  window.deleteStarComment = function (id) {
    if (!confirm('确认删除这条评论？')) return;
    fetch('/api/campus-star/admin/comments/' + id, {
      method: 'DELETE',
      headers: API._headers()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast('已删除'); loadStarComments(); }
        else showToast(data.message || '删除失败');
      })
      .catch(function () { showToast('删除失败'); });
  };

  // ══════ 辅助 ══════
  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
