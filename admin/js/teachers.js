// admin/js/teachers.js - 师说管理模块
var teacherPage = 1, teacherTotalPages = 1;

function teacherFetch(method, url, body) {
  var opts = { method: method, headers: API._authHeaders() };
  if (body) {
    if (body instanceof FormData) {
      // don't set Content-Type for FormData
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  return fetch(url, opts).then(function(r) { return r.json(); });
}

async function loadTeachersAdmin(pg) {
  if (pg) teacherPage = pg;
  var search = (document.getElementById('teacherSearchInput') && document.getElementById('teacherSearchInput').value || '').trim();
  var college = document.getElementById('teacherFilterCollege') && document.getElementById('teacherFilterCollege').value || '全部';
  var params = new URLSearchParams({ page: teacherPage, limit: 30 });
  if (search) params.set('search', search);
  if (college !== '全部') params.set('college', college);
  
  try {
    var res = await teacherFetch('GET', '/api/teachers/admin/list?' + params.toString());
    if (!res || res.error) { showToast('❌ 加载失败: ' + (res && res.error || '网络错误')); return; }
    teacherTotalPages = res.totalPages || 1;
    renderTeachersTable(res.teachers || []);
    renderTeachersPager();
    if (!search && college === '全部') {
      var colleges = [];
      for (var i = 0; i < (res.teachers || []).length; i++) {
        var c = res.teachers[i].college;
        if (c && colleges.indexOf(c) === -1) colleges.push(c);
      }
      colleges.sort();
      var sel = document.getElementById('teacherFilterCollege');
      if (sel) {
        sel.innerHTML = '<option value="全部">🏫 全部学院</option>' + colleges.map(function(c) { return '<option value="' + escHtml(c) + '">' + escHtml(c) + '</option>'; }).join('');
        sel.value = '全部';
      }
    }
  } catch (e) {
    showToast('❌ 加载教师列表失败: ' + e.message);
  }
}

function renderTeachersTable(teachers) {
  var tbody = document.getElementById('teachersTable');
  if (!tbody) return;
  if (!teachers.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">暂无教师数据</td></tr>';
    return;
  }
  tbody.innerHTML = teachers.map(function(t) {
    var avatarHtml = t.avatar
      ? '<img src="' + escHtml(t.avatar) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'">'
      : '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#FFE0B2,#FFCC80);display:flex;align-items:center;justify-content:center;font-size:1.1rem">👤</div>';
    return '<tr>' +
      '<td>' + avatarHtml + '</td>' +
      '<td style="font-weight:600">' + escHtml(t.name) + '</td>' +
      '<td>' + escHtml(t.college) + '</td>' +
      '<td>' + escHtml(t.title || '-') + '</td>' +
      '<td>' + escHtml(t.education || '-') + '</td>' +
      '<td>' + (t.like_count || 0) + '</td>' +
      '<td>' + (t.review_count || 0) + '</td>' +
      '<td>' + (t.avg_rating ? '⭐' + Number(t.avg_rating).toFixed(1) : '-') + '</td>' +
      '<td><div style="display:flex;gap:6px">' +
        '<button class="btn btn-sm" onclick="showTeacherModal(' + t.id + ')" style="padding:4px 10px;font-size:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;cursor:pointer">✏️ 编辑</button>' +
        '<button class="btn btn-sm" onclick="deleteTeacherConfirm(' + t.id + ',\'' + escHtml(t.name).replace(/'/g, "\\'") + '\')" style="padding:4px 10px;font-size:12px;color:var(--danger);background:var(--card-bg);border:1px solid var(--border);border-radius:6px;cursor:pointer">🗑️</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function renderTeachersPager() {
  var pager = document.getElementById('teachersPager');
  if (!pager || teacherTotalPages <= 1) { if (pager) pager.innerHTML = ''; return; }
  var html = '<button class="btn btn-sm" ' + (teacherPage <= 1 ? 'disabled' : 'onclick="loadTeachersAdmin(' + (teacherPage - 1) + ')"') + '>◀ 上一页</button>';
  html += '<span style="margin:0 12px">第 ' + teacherPage + ' / ' + teacherTotalPages + ' 页</span>';
  html += '<button class="btn btn-sm" ' + (teacherPage >= teacherTotalPages ? 'disabled' : 'onclick="loadTeachersAdmin(' + (teacherPage + 1) + ')"') + '>下一页 ▶</button>';
  pager.innerHTML = html;
}

function showTeacherModal(id) {
  document.getElementById('teacherEditId').value = '';
  document.getElementById('teacherName').value = '';
  document.getElementById('teacherCollege').value = '';
  document.getElementById('teacherTitle').value = '';
  document.getElementById('teacherEducation').value = '';
  document.getElementById('teacherUndergraduate').value = '';
  document.getElementById('teacherGraduate').value = '';
  document.getElementById('teacherResearch').value = '';
  document.getElementById('teacherCourses').value = '';
  document.getElementById('teacherPapers').value = '';
  document.getElementById('teacherProjects').value = '';
  document.getElementById('teacherAchievements').value = '';
  document.getElementById('teacherSocialRoles').value = '';
  document.getElementById('teacherBio').value = '';
  document.getElementById('teacherLikeCount').value = '0';
  document.getElementById('teacherReviewCount').value = '0';
  document.getElementById('teacherAvgRating').value = '0';
  document.getElementById('teacherAvatarUrl').value = '';
  document.getElementById('teacherAvatarPreview').innerHTML = '<span style="font-size:2rem;opacity:0.3">👤</span>';
  document.getElementById('teacherDeleteBtn').style.display = 'none';
  
  if (id) {
    document.getElementById('teacherModalTitle').textContent = '✏️ 编辑教师';
    document.getElementById('teacherEditId').value = id;
    document.getElementById('teacherDeleteBtn').style.display = 'inline-block';
    loadTeacherData(id);
  } else {
    document.getElementById('teacherModalTitle').textContent = '👨‍🏫 添加教师';
  }
  showModal('teacherModal');
}

async function loadTeacherData(id) {
  try {
    var res = await teacherFetch('GET', '/api/teachers/' + id);
    if (!res || res.error) { showToast('❌ 加载教师数据失败: ' + (res && res.error || '')); return; }
    var t = res.teacher;
    if (!t) return;
    document.getElementById('teacherName').value = t.name || '';
    document.getElementById('teacherCollege').value = t.college || '';
    document.getElementById('teacherTitle').value = t.title || '';
    document.getElementById('teacherEducation').value = t.education || '';
    document.getElementById('teacherUndergraduate').value = t.undergraduate || '';
    document.getElementById('teacherGraduate').value = t.graduate || '';
    document.getElementById('teacherResearch').value = t.research || '';
    document.getElementById('teacherCourses').value = t.courses || '';
    document.getElementById('teacherPapers').value = t.papers || '';
    document.getElementById('teacherProjects').value = t.projects || '';
    document.getElementById('teacherAchievements').value = t.achievements || '';
    document.getElementById('teacherSocialRoles').value = t.social_roles || '';
    document.getElementById('teacherBio').value = t.bio || '';
    document.getElementById('teacherLikeCount').value = t.like_count || 0;
    document.getElementById('teacherReviewCount').value = t.review_count || 0;
    document.getElementById('teacherAvgRating').value = t.avg_rating || 0;
    document.getElementById('teacherAvatarUrl').value = t.avatar || '';
    if (t.avatar) {
      document.getElementById('teacherAvatarPreview').innerHTML = '<img src="' + escHtml(t.avatar) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML=\'<span style="font-size:2rem;opacity:0.3">👤</span>\'">';
    }
  } catch (e) {
    showToast('❌ 加载失败: ' + e.message);
  }
}

async function uploadTeacherAvatar() {
  var file = document.getElementById('teacherAvatarFile').files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append('avatar', file);
  try {
    var headers = API._authHeaders();
    var res = await fetch('/api/teachers/upload-avatar', { method: 'POST', body: fd, headers: headers });
    var data = await res.json();
    if (data.url) {
      document.getElementById('teacherAvatarUrl').value = data.url;
      document.getElementById('teacherAvatarPreview').innerHTML = '<img src="' + escHtml(data.url) + '" style="width:100%;height:100%;object-fit:cover">';
      showToast('✅ 头像上传成功');
    } else {
      showToast('❌ 上传失败: ' + (data.error || '未知错误'));
    }
  } catch (e) {
    showToast('❌ 上传失败: ' + e.message);
  }
}

async function saveTeacher() {
  var id = document.getElementById('teacherEditId').value;
  var data = {
    name: document.getElementById('teacherName').value.trim(),
    college: document.getElementById('teacherCollege').value.trim(),
    title: document.getElementById('teacherTitle').value.trim(),
    education: document.getElementById('teacherEducation').value.trim(),
    undergraduate: document.getElementById('teacherUndergraduate').value.trim(),
    graduate: document.getElementById('teacherGraduate').value.trim(),
    research: document.getElementById('teacherResearch').value.trim(),
    courses: document.getElementById('teacherCourses').value.trim(),
    papers: document.getElementById('teacherPapers').value.trim(),
    projects: document.getElementById('teacherProjects').value.trim(),
    achievements: document.getElementById('teacherAchievements').value.trim(),
    social_roles: document.getElementById('teacherSocialRoles').value.trim(),
    bio: document.getElementById('teacherBio').value.trim(),
    avatar: document.getElementById('teacherAvatarUrl').value,
    like_count: parseInt(document.getElementById('teacherLikeCount').value) || 0,
    review_count: parseInt(document.getElementById('teacherReviewCount').value) || 0,
    avg_rating: parseFloat(document.getElementById('teacherAvgRating').value) || 0
  };
  
  if (!data.name || !data.college) { showToast('⚠️ 姓名和学院为必填项'); return; }
  
  try {
    var res;
    if (id) {
      res = await teacherFetch('PUT', '/api/teachers/' + id, data);
    } else {
      res = await teacherFetch('POST', '/api/teachers', data);
    }
    if (res && res.ok) {
      showToast('✅ ' + (id ? '更新成功' : '添加成功'));
      closeModal('teacherModal');
      loadTeachersAdmin();
    } else {
      showToast('❌ ' + ((res && res.error) || '操作失败'));
    }
  } catch (e) {
    showToast('❌ 保存失败: ' + e.message);
  }
}

function deleteTeacherConfirm(id, name) {
  if (!confirm('确定要删除教师「' + name + '」吗？\n\n此操作不可撤销，将同时删除该教师的所有评价、点赞和举报数据。')) return;
  deleteTeacherById(id);
}

function deleteTeacher() {
  var id = document.getElementById('teacherEditId').value;
  var name = document.getElementById('teacherName').value;
  if (!id) return;
  deleteTeacherConfirm(parseInt(id), name);
}

async function deleteTeacherById(id) {
  try {
    var res = await teacherFetch('DELETE', '/api/teachers/' + id);
    if (res && res.ok) {
      showToast('✅ 已删除: ' + (res.deleted || '教师'));
      closeModal('teacherModal');
      loadTeachersAdmin();
    } else {
      showToast('❌ ' + ((res && res.error) || '删除失败'));
    }
  } catch (e) {
    showToast('❌ 删除失败: ' + e.message);
  }
}

// ── 导出 ──
function exportTeachers() {
  var headers = API._authHeaders();
  headers['Accept'] = 'text/csv';
  fetch('/api/teachers/admin/export', { headers: headers })
    .then(function(r) {
      if (!r.ok) throw new Error('导出失败');
      return r.blob();
    })
    .then(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'teachers_export_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('✅ 导出成功');
    })
    .catch(function(e) { showToast('❌ 导出失败: ' + e.message); });
}

// ── 导入 ──
var importFileData = null;

function showImportModal() {
  document.getElementById('importFile').value = '';
  importFileData = null;
  document.getElementById('importStatus').innerHTML = '';
  document.getElementById('importExecBtn').disabled = true;
  showModal('importModal');
}

function handleImportFile(input) {
  var file = input.files[0];
  if (!file) return;
  importFileData = file;
  document.getElementById('importStatus').innerHTML = '📄 ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
  document.getElementById('importExecBtn').disabled = false;
}

async function execImport() {
  if (!importFileData) return;
  document.getElementById('importExecBtn').disabled = true;
  document.getElementById('importStatus').innerHTML += '<br>⏳ 正在导入...';
  
  var fd = new FormData();
  fd.append('file', importFileData);
  
  try {
    var res = await fetch('/api/teachers/admin/import', { method: 'POST', headers: API._authHeaders(), body: fd });
    var data = await res.json();
    if (data.ok !== undefined && data.ok !== false) {
      var msg = '✅ 导入完成：新增 ' + data.created + ' 条，更新 ' + data.updated + ' 条';
      if (data.skipped > 0) msg += '，跳过 ' + data.skipped + ' 条';
      if (data.errors && data.errors.length > 0) msg += '\n⚠️ ' + data.errors.slice(0, 5).join('; ');
      document.getElementById('importStatus').innerHTML = msg.replace(/\n/g, '<br>');
      showToast('✅ 导入完成');
      loadTeachersAdmin();
    } else {
      document.getElementById('importStatus').innerHTML = '❌ ' + (data.error || '导入失败');
    }
  } catch (e) {
    document.getElementById('importStatus').innerHTML = '❌ 导入失败: ' + e.message;
  }
  document.getElementById('importExecBtn').disabled = false;
}
