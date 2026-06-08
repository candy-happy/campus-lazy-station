// === 猫狗管理 ===

    async function loadPetsAdmin() {
      const species = document.getElementById('petFilterSpecies').value;
      const status = document.getElementById('petFilterStatus').value;
      const health = document.getElementById('petFilterHealth').value;
      const search = document.getElementById('petSearchInput').value.trim();
      let url = '/api/pets/list?limit=100';
      if (species !== 'all') url += '&species=' + species;
      if (status !== 'all') url += '&status=' + status;
      const [petsRes, alertRes] = await Promise.all([
        fetch(url, { headers: AUTH() }).then(r => r.json()),
        fetch('/api/pets/alert-check', { headers: AUTH() }).then(r => r.json()).catch(function() { return { summary: { warning: 0, urgent: 0, critical: 0 } }; })
      ]);
      var pets = petsRes;
      if (search) pets = pets.filter(function(p) { return (p.code_name + p.breed + p.location + (p.health_note||'')).includes(search); });
      if (health !== 'all') pets = pets.filter(function(p) { return p.health_status === health; });

      // 更新告警统计卡片
      var s = alertRes.summary || { warning: 0, urgent: 0, critical: 0 };
      document.getElementById('petAlertWarning').textContent = s.warning;
      document.getElementById('petAlertUrgent').textContent = s.urgent;
      document.getElementById('petAlertCritical').textContent = s.critical;

      // 更新守护者告警详情
      if (typeof updateGuardianAlert === 'function') updateGuardianAlert(alertRes);

      // Update pending sightings badge
      try {
        const pendingRes = await fetch('/api/pets/admin/pending-sightings', { headers: AUTH() });
        const pendingList = await pendingRes.json();
        const badge = document.getElementById('petPendingBadge');
        if (badge && pendingList && pendingList.length > 0) {
          badge.textContent = pendingList.length;
          badge.style.display = 'flex';
        } else if (badge) {
          badge.style.display = 'none';
        }
        // 更新猫狗管理导航badge：失联告警数+待审核目击数
        var petNavCount = (s.warning || 0) + (s.urgent || 0) + (s.critical || 0) + (pendingList ? pendingList.length : 0);
        var petBadgeEl = document.getElementById('petBadge');
        if (petBadgeEl) {
          if (petNavCount > 0) { petBadgeEl.textContent = petNavCount; petBadgeEl.style.display = 'inline'; }
          else { petBadgeEl.style.display = 'none'; }
        }
      } catch(e) {}

      var speciesEmoji = { cat: '\u{1F431}', dog: '\u{1F436}' };
      var statusMap = {
        active: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#E8F5E9;color:#2E7D32">\u{1F7E2} 在校</span>',
        missing: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFF3E0;color:#E65100">\u{1F7E0} 走失</span>',
        adopted: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#F3E5F5;color:#7B1FA2">\u{1F49C} 已领养</span>',
        graduated: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#E3F2FD;color:#1565C0">\u{1F393} 已毕业</span>'
      };
      var alertBadge = {
        warning: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFF3E0;color:#E65100;border:1px solid #FFE0B2">\u26A0\uFE0F 7天</span>',
        urgent: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FBE9E7;color:#BF360C;border:1px solid #FFAB91">\u{1F7E0} 15天</span>',
        critical: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFEBEE;color:#B71C1C;border:1px solid #EF9A9A;animation:pulse 2s infinite">\u{1F534} 31天</span>'
      };
      var healthBadge = {
        healthy: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#E8F5E9;color:#2E7D32">💚 健康</span>',
        sick: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFF3E0;color:#E65100;animation:pulse 2s infinite">🤒 生病</span>',
        injured: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFEBEE;color:#C62828;animation:pulse 2s infinite">🩹 受伤</span>',
        pregnant: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FCE4EC;color:#AD1457">🤰 怀孕</span>',
        nursing: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#F3E5F5;color:#6A1B9A">🍼 哺乳</span>',
        quarantine: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#EFEBE9;color:#4E342E">🏥 隔离</span>',
        other: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#ECEFF1;color:#37474F">⚠️ 异常</span>'
      };
      var rows = '';
      for (var i = 0; i < pets.length; i++) {
        var p = pets[i];
        var seenDays = p.daysSinceSeen;
        var seenText = seenDays === 0 ? '<span style="color:#4CAF50;font-weight:600">今日已见</span>' : seenDays !== null ? '<span style="color:' + (seenDays >= 30 ? '#B71C1C' : seenDays >= 15 ? '#BF360C' : seenDays >= 7 ? '#E65100' : '#666') + ';font-weight:600">' + seenDays + '天前</span>' : '-';
        var alert = alertBadge[p.alert_level] || '<span style="color:#4CAF50;font-size:12px">\u2705</span>';
        var rowBg = p.alert_level === 'critical' ? 'background:#FFF5F5;' : p.alert_level === 'urgent' ? 'background:#FFF8F0;' : '';
        var avatarBorder = p.alert_level === 'critical' ? '#EF5350' : p.alert_level === 'urgent' ? '#FF9800' : '#FFE0B2';
        var nameColor = p.alert_level === 'critical' ? '#B71C1C' : '#E65100';
        var avatarHtml = (p.avatar && p.avatar.charAt(0) === '/') ? '<img src="' + esc(p.avatar) + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ' + avatarBorder + '">' : '<span style="font-size:1.8rem">' + (speciesEmoji[p.species] || '\u{1F43E}') + '</span>';
        var statusHtml = statusMap[p.status] || statusMap.active;
        var sightingBtn = '<button class="btn" style="padding:4px 8px;font-size:0.75rem;border-color:#81C784;color:#2E7D32;border-radius:8px" onclick="showSightings(' + p.id + ',\'' + esc(p.code_name).replace(/'/g, "\\'") + '\')">\u{1F4CD}</button>';
        var statusBtn = '<button class="btn" style="padding:4px 8px;font-size:0.75rem;border-color:#90CAF9;color:#1565C0;border-radius:8px" onclick="showStatusModal(' + p.id + ',\'' + esc(p.code_name).replace(/'/g, "\\'") + '\')">📋</button>';
        var healthBtn = '<button class="btn" style="padding:4px 8px;font-size:0.75rem;border-color:#F48FB1;color:#AD1457;border-radius:8px" onclick="showHealthModal(' + p.id + ',\'' + esc(p.code_name).replace(/'/g, "\\'") + '\',\'' + (p.health_status||'healthy') + '\',\'' + esc(p.health_note||'').replace(/'/g, "\\'") + '\')">🏥</button>';
        var healthBadgeMap = {
          healthy: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#E8F5E9;color:#2E7D32">💚 健康</span>',
          sick: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFF3E0;color:#E65100;animation:pulse 2s infinite">🤒 生病</span>',
          injured: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FFEBEE;color:#C62828;animation:pulse 2s infinite">🩹 受伤</span>',
          pregnant: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#FCE4EC;color:#AD1457">🤰 怀孕</span>',
          nursing: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#F3E5F5;color:#6A1B9A">🍼 哺乳</span>',
          quarantine: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#EFEBE9;color:#4E342E">🏥 隔离</span>',
          other: '<span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#ECEFF1;color:#37474F">⚠️ 异常</span>'
        };
        var healthHtml = healthBadgeMap[p.health_status || 'healthy'] || healthBadgeMap.healthy;
        if (p.health_note && p.health_status !== 'healthy') healthHtml += '<div style="font-size:10px;color:#999;margin-top:2px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(p.health_note) + '">' + esc(p.health_note) + '</div>';
        rows += '<tr style="transition:background 0.2s;' + rowBg + '" onmouseenter="this.style.background=\'#FFF8E1\'" onmouseleave="this.style.background=\'' + rowBg + '\">' +
          '<td>' + avatarHtml + '</td>' +
          '<td><strong style="color:' + nameColor + '">' + esc(p.code_name) + '</strong></td>' +
          '<td>' + (speciesEmoji[p.species] || '🐾') + '</td>' +
          '<td style="color:#666">' + esc(p.breed || '-') + '</td>' +
          '<td style="color:#666">📍 ' + esc(p.location || '-') + '</td>' +
          '<td>' + statusHtml + '</td>' +
          '<td>' + healthHtml + '</td>' +
          '<td>' + seenText + '</td>' +
          '<td>' + alert + '</td>' +
          '<td style="color:#EF5350;font-weight:600">' + (p.like_count||0) + '</td>' +
          '<td style="color:#42A5F5;font-weight:600">' + (p.comment_count||0) + '</td>' +
          '<td style="white-space:nowrap">' +
            sightingBtn + ' ' + statusBtn + ' ' + healthBtn + ' ' +
            '<button class="btn" style="padding:4px 10px;font-size:0.8rem;border-color:#FFCC80;color:#E65100;border-radius:8px" onclick="editPet(' + p.id + ')">✏️</button> ' +
            '<button class="btn" style="padding:4px 10px;font-size:0.8rem;color:#ef4444;border-radius:8px" onclick="deletePet(' + p.id + ')">🗑️</button>' +
          '</td></tr>';      document.getElementById('petsTable').innerHTML = rows || '<tr><td colspan="12" style="text-align:center;padding:40px;color:#999;font-size:1rem">\u{1F43E} 暂无猫狗数据</td></tr>';
    }
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function showAddPetModal() {
      document.getElementById('petEditId').value = '';
      document.getElementById('petModalTitle').innerHTML = '🐾 添加猫狗';
      ['petCodeName','petBreed','petAge','petColor','petLocation','petPersonality','petTags','petBio','petHealthNoteInput'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('petSpecies').value = 'cat';
      document.getElementById('petGender').value = 'male';
      document.getElementById('petHealthStatus').value = 'healthy';
      document.getElementById('petImagePreview').innerHTML = '';
      document.getElementById('petImageCount').textContent = '';
      showModal('petModal');
    }

    async function editPet(id) {
      const res = await fetch('/api/pets/detail/' + id, { headers: AUTH() });
      const p = await res.json();
      document.getElementById('petEditId').value = p.id;
      document.getElementById('petModalTitle').innerHTML = '✏️ 编辑「' + esc(p.code_name) + '」';
      document.getElementById('petCodeName').value = p.code_name || '';
      document.getElementById('petSpecies').value = p.species || 'cat';
      document.getElementById('petBreed').value = p.breed || '';
      document.getElementById('petGender').value = p.gender || 'unknown';
      document.getElementById('petAge').value = p.age || '';
      document.getElementById('petColor').value = p.color || '';
      document.getElementById('petLocation').value = p.location || '';
      document.getElementById('petPersonality').value = p.personality || '';
      document.getElementById('petTags').value = (p.tags || []).join(',');
      document.getElementById('petBio').value = p.bio || '';
      document.getElementById('petHealthStatus').value = p.health_status || 'healthy';
      document.getElementById('petHealthNoteInput').value = p.health_note || '';
      // Show existing images
      const previewDiv = document.getElementById('petImagePreview');
      const existingImages = p.images || [];
      previewDiv.innerHTML = existingImages.map((img, i) => '<div style="position:relative"><img src="' + img + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid #FFE0B2"></div>').join('');
      document.getElementById('petImageCount').textContent = existingImages.length ? '已有 ' + existingImages.length + ' 张' : '';
      showModal('petModal');
    }

    function previewPetImages(input) {
      const files = input.files;
      document.getElementById('petImageCount').textContent = files.length ? '已选 ' + files.length + ' 张' : '';
      const previewDiv = document.getElementById('petImagePreview');
      // Only show new file previews (keep existing images from editPet)
      const existing = previewDiv.querySelectorAll('[data-existing]').length ? '' : '';
      let newHtml = '';
      for (let i = 0; i < Math.min(files.length, 6); i++) {
        const url = URL.createObjectURL(files[i]);
        newHtml += '<div><img src="' + url + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid #FFCC80"></div>';
      }
      // Replace all previews with new files
      previewDiv.innerHTML = newHtml;
    }

    async function savePet() {
      const id = document.getElementById('petEditId').value;
      const isEdit = !!id;
      const fd = new FormData();
      fd.append('code_name', document.getElementById('petCodeName').value);
      fd.append('species', document.getElementById('petSpecies').value);
      fd.append('breed', document.getElementById('petBreed').value);
      fd.append('gender', document.getElementById('petGender').value);
      fd.append('age', document.getElementById('petAge').value);
      fd.append('color', document.getElementById('petColor').value);
      fd.append('location', document.getElementById('petLocation').value);
      fd.append('personality', document.getElementById('petPersonality').value);
      fd.append('tags', document.getElementById('petTags').value);
      fd.append('bio', document.getElementById('petBio').value);
      fd.append('health_status', document.getElementById('petHealthStatus').value);
      fd.append('health_note', document.getElementById('petHealthNoteInput').value);
      const files = document.getElementById('petImages').files;
      for (let i = 0; i < files.length; i++) fd.append('images', files[i]);

      const url = isEdit ? '/api/pets/admin/update/' + id : '/api/pets/admin/add';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: AUTH(), body: fd });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
      closeModal('petModal');
      showToast(isEdit ? '更新成功' : '添加成功');
      loadPetsAdmin();
    }

    async function deletePet(id) {
      if (!confirm('确定删除这只猫狗吗？相关留言和点赞也会被删除。')) return;
      const res = await fetch('/api/pets/admin/delete/' + id, { method: 'DELETE', headers: { ...AUTH(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: 'admin' }) });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
      showToast('删除成功');
      loadPetsAdmin();
    }

    async function showSightings(id, name) {
      document.getElementById('sightingsModalTitle').textContent = '\u{1F4CD} ' + name + ' 的目击记录';
      document.getElementById('sightingsContent').innerHTML = '<div style="text-align:center;padding:30px;color:#999">加载中...</div>';
      showModal('sightingsModal');
      const res = await fetch('/api/pets/admin/sightings/' + id, { headers: AUTH() });
      const sightings = await res.json();
      if (!sightings || sightings.length === 0) {
        document.getElementById('sightingsContent').innerHTML = '<div style="text-align:center;padding:40px;color:#999">\u{1F43E} 暂无目击记录</div>';
        return;
      }
      var html = sightings.map(function(s) {
        var avatarHtml = (s.user_avatar && s.user_avatar.charAt(0) === '/') ? '<img src="' + esc(s.user_avatar) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid #C8E6C9">' : '<div style="width:36px;height:36px;border-radius:50%;background:#E8F5E9;display:flex;align-items:center;justify-content:center;font-size:1rem">\u{1F464}</div>';
        var nickname = esc(s.user_nickname || s.nickname || s.phone);
        var loc = s.location ? ' <span style="color:#999;font-size:0.8rem">\u{1F4CD} ' + esc(s.location) + '</span>' : '';
        var note = s.note ? '<div style="margin-top:4px;color:#555;font-size:0.85rem">' + esc(s.note) + '</div>' : '';
        var photoHtml = s.photo ? '<div style="margin-top:8px"><img src="' + esc(s.photo) + '" style="max-width:120px;max-height:90px;border-radius:8px;object-fit:cover;cursor:pointer" onclick="window.open(this.src)"></div>' : '';
        return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">' +
          '<div>' + avatarHtml + '</div>' +
          '<div style="flex:1"><div><strong>' + nickname + '</strong>' + loc + '</div>' + note + photoHtml +
          '<div style="margin-top:4px;font-size:0.75rem;color:#aaa">' + timeAgoAdmin(s.created_at) + '</div></div></div>';
      }).join('');
      document.getElementById('sightingsContent').innerHTML = html;
    }

    function showStatusModal(id, name) {
      document.getElementById('petStatusId').value = id;
      document.getElementById('petStatusTitle').textContent = '\u{1F4CB} 修改「' + name + '」状态';
      showModal('petStatusModal');
    }

    async function changePetStatus(status) {
      const id = document.getElementById('petStatusId').value;
      const res = await fetch('/api/pets/admin/status/' + id, {
        method: 'PUT', headers: { ...AUTH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
      closeModal('petStatusModal');
      var statusNames = { active: '在校', missing: '走失', adopted: '已领养', graduated: '已毕业' };
      showToast('状态已更新为：' + (statusNames[status] || status));
      loadPetsAdmin();
    }

    function showHealthModal(id, name, healthStatus, healthNote) {
      document.getElementById('petHealthId').value = id;
      document.getElementById('petHealthTitle').textContent = '🏥 修改「' + name + '」健康状态';
      document.getElementById('petHealthNote').value = healthNote || '';
      showModal('petHealthModal');
    }

    async function changePetHealth(health_status) {
      const id = document.getElementById('petHealthId').value;
      const health_note = document.getElementById('petHealthNote').value.trim();
      const res = await fetch('/api/pets/admin/health-status/' + id, {
        method: 'PUT', headers: { ...AUTH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_status, health_note })
      });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
      closeModal('petHealthModal');
      var healthNames = { healthy: '健康', sick: '生病', injured: '受伤', pregnant: '怀孕', nursing: '哺乳', quarantine: '隔离', other: '异常' };
      showToast('健康状态已更新为：' + (healthNames[health_status] || health_status));
      loadPetsAdmin();
    }

    function timeAgoAdmin(dateStr) {
      if (!dateStr) return '';
      var now = Date.now();
      var d = new Date(dateStr).getTime();
      var diff = Math.floor((now - d) / 1000);
      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
      if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
      return dateStr.substring(0, 10);
    }

    function toggleGuardianDetail() {
      _guardianDetailOpen = !_guardianDetailOpen;
      var detail = document.getElementById('petGuardianDetail');
      var toggle = document.getElementById('petGuardianToggle');
      if (_guardianDetailOpen) {
        detail.style.display = 'block';
        toggle.textContent = '▲ 收起';
      } else {
        detail.style.display = 'none';
        toggle.textContent = '▼ 展开';
      }
    }

    function updateGuardianAlert(alertRes) {
      var s = alertRes.summary || { warning: 0, urgent: 0, critical: 0 };
      var total = s.warning + s.urgent + s.critical;
      var el = document.getElementById('petGuardianAlert');
      var summary = document.getElementById('petGuardianSummary');
      var detail = document.getElementById('petGuardianDetail');

      if (total === 0) {
        el.style.display = 'none';
        _guardianAlertData = null;
        return;
      }

      _guardianAlertData = alertRes;
      el.style.display = 'block';
      summary.textContent = '共 ' + total + ' 只猫狗失联';

      var html = '';
      if (alertRes.critical && alertRes.critical.length > 0) {
        html += '<div style="margin-bottom:6px"><strong style="color:#B71C1C">🔴 31天失联：</strong>' + alertRes.critical.map(function(p) { return '<span style="background:#FFEBEE;padding:2px 8px;border-radius:8px;margin:2px;display:inline-block;font-weight:600;color:#B71C1C">' + p.speciesEmoji + esc(p.code_name) + ' <span style="font-weight:400;font-size:0.8rem">(' + p.daysSince + '天)</span></span>'; }).join('') + '</div>';
      }
      if (alertRes.urgent && alertRes.urgent.length > 0) {
        html += '<div style="margin-bottom:6px"><strong style="color:#BF360C">🟠 15天未现：</strong>' + alertRes.urgent.map(function(p) { return '<span style="background:#FBE9E7;padding:2px 8px;border-radius:8px;margin:2px;display:inline-block;font-weight:600;color:#BF360C">' + p.speciesEmoji + esc(p.code_name) + ' <span style="font-weight:400;font-size:0.8rem">(' + p.daysSince + '天)</span></span>'; }).join('') + '</div>';
      }
      if (alertRes.warning && alertRes.warning.length > 0) {
        html += '<div style="margin-bottom:6px"><strong style="color:#E65100">⚠️ 7天未见：</strong>' + alertRes.warning.map(function(p) { return '<span style="background:#FFF3E0;padding:2px 8px;border-radius:8px;margin:2px;display:inline-block;font-weight:600;color:#E65100">' + p.speciesEmoji + esc(p.code_name) + ' <span style="font-weight:400;font-size:0.8rem">(' + p.daysSince + '天)</span></span>'; }).join('') + '</div>';
      }
      html += '<div style="margin-top:8px;color:#999;font-size:0.8rem">💡 请安排巡查确认猫狗安全，用户打卡可自动解除告警</div>';
      detail.innerHTML = html;
    }

    async function showReviewSightings() {
      var content = document.getElementById('reviewSightingsContent');
      content.innerHTML = '<div style="text-align:center;padding:30px;color:#999">加载中...</div>';
      showModal('reviewSightingsModal');
      try {
        var res = await fetch('/api/pets/admin/pending-sightings', { headers: AUTH() });
        var list = await res.json();
        if (!list || list.length === 0) {
          content.innerHTML = '<div style="text-align:center;padding:40px;color:#999">\u{1F43E} 暂无待审核目击记录</div>';
          return;
        }
        var speciesEmoji = { cat: '\u{1F431}', dog: '\u{1F436}' };
        var html = list.map(function(s) {
          var avatarHtml = (s.user_avatar && s.user_avatar.charAt(0) === '/') ? '<img src="' + esc(s.user_avatar) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1.5px solid #C8E6C9">' : '<div style="width:40px;height:40px;border-radius:50%;background:#E8F5E9;display:flex;align-items:center;justify-content:center;font-size:1rem">\u{1F464}</div>';
          var petEmoji = speciesEmoji[s.species] || '\u{1F43E}';
          var petName = esc(s.code_name || '未知');
          var nickname = esc(s.user_nickname || s.phone || '匿名');
          var loc = s.location ? '<span style="color:#999;font-size:0.8rem">\u{1F4CD} ' + esc(s.location) + '</span>' : '';
          var note = s.note ? '<div style="margin-top:4px;color:#555;font-size:0.85rem">' + esc(s.note) + '</div>' : '';
          var photoHtml = s.photo ? '<div style="margin-top:8px"><img src="' + esc(s.photo) + '" style="max-width:120px;max-height:90px;border-radius:8px;object-fit:cover;cursor:pointer" onclick="window.open(this.src)"></div>' : '';
          return '<div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #f0f0f0;align-items:flex-start">' +
            '<div>' + avatarHtml + '</div>' +
            '<div style="flex:1">' +
              '<div><strong>' + nickname + '</strong> 目击了 <strong style="color:#E65100">' + petEmoji + ' ' + petName + '</strong> ' + loc + '</div>' +
              note + photoHtml +
              '<div style="margin-top:4px;font-size:0.75rem;color:#aaa">' + timeAgoAdmin(s.created_at) + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-shrink:0">' +
              '<button onclick="reviewSighting(' + s.id + ',\'approve\')" style="padding:6px 12px;border-radius:8px;border:none;background:#4CAF50;color:#fff;cursor:pointer;font-size:0.8rem;font-weight:600">\u2705 通过</button>' +
              '<button onclick="reviewSighting(' + s.id + ',\'reject\')" style="padding:6px 12px;border-radius:8px;border:none;background:#EF5350;color:#fff;cursor:pointer;font-size:0.8rem;font-weight:600">\u274C 驳回</button>' +
            '</div></div>';
        }).join('');
        content.innerHTML = html;
      } catch(e) {
        content.innerHTML = '<div style="text-align:center;padding:30px;color:#E74C3C">加载失败: ' + esc(e.message) + '</div>';
      }
    }

    async function reviewSighting(id, action) {
      try {
        var res = await fetch('/api/pets/admin/review-sighting/' + id, {
          method: 'PUT',
          headers: { ...AUTH(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action })
        });
        var data = await res.json();
        if (data.error) { showToast(data.error); return; }
        showToast(action === 'approve' ? '\u2705 审核通过，已更新目击时间' : '\u274C 已驳回');
        // 刷新审核列表和猫狗列表
        showReviewSightings();
        loadPetsAdmin();
      } catch(e) {
        showToast('操作失败: ' + e.message);
      }
    }

// window exports
window.loadPetsAdmin = loadPetsAdmin;
window.showAddPetModal = showAddPetModal;
window.editPet = editPet;
window.previewPetImages = previewPetImages;
window.savePet = savePet;
window.deletePet = deletePet;
window.showSightings = showSightings;
window.showStatusModal = showStatusModal;
window.changePetStatus = changePetStatus;
window.showHealthModal = showHealthModal;
window.changePetHealth = changePetHealth;
window.timeAgoAdmin = timeAgoAdmin;
window.toggleGuardianDetail = toggleGuardianDetail;
window.updateGuardianAlert = updateGuardianAlert;
window.showReviewSightings = showReviewSightings;
window.reviewSighting = reviewSighting;
