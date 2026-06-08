// address.js - 地址管理
// 依赖: core.js (需先加载)
// 新功能请添加为独立JS模块，不要在骨架文件中添加代码

    async function showAddresses() {
      if (!currentUser) return showToast(_t('loginFirst'));
      try {
        const list = await API.getAddresses(currentUser.phone);
        let el = document.getElementById('addrPage_sub');
        if (!el) {
          el = document.createElement('div');
          el.id = 'addrPage_sub';
          el.className = 'sub-page';
          el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'addrPage_sub\')">←</button><span class="sub-page-title">📍 地址管理</span></div><div class="sub-page-body"></div>';
          document.body.appendChild(el);
        }
        let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
        h += '<div style="font-weight:700;font-size:17px;color:var(--text)">我的地址</div>';
        h += '<button class="addr-add-btn" onclick="editAddress()">✚ 新增</button></div>';
        if (!list||!list.length) {
          h += '<div class="addr-empty">';
          h += '<div class="addr-empty-icon">📍</div>';
          h += '<div class="addr-empty-text">暂无地址</div>';
          h += '<div class="addr-empty-hint">点击右上角新增常用地址</div>';
          h += '</div>';
        }
        (list||[]).forEach(a => {
          const iconClass = a.name?.includes('宿舍') || a.name?.includes('楼') ? 'addr-icon-home' : a.name?.includes('教学') || a.name?.includes('图书馆') ? 'addr-icon-school' : 'addr-icon-other';
          const iconEmoji = a.name?.includes('宿舍') || a.name?.includes('楼') ? '🏠' : a.name?.includes('教学') || a.name?.includes('图书馆') ? '📚' : '📍';
          h += '<div class="addr-item' + (a.is_default ? ' is-default' : '') + '">';
          if (a.is_default) h += '<span class="addr-default-badge">⭐ 默认</span>';
          h += '<div style="display:flex;gap:12px;align-items:flex-start">';
          h += '<div class="addr-icon-wrap ' + iconClass + '">' + iconEmoji + '</div>';
          h += '<div class="addr-info">';
          h += '<div class="addr-name">' + escHtml(a.name) + '</div>';
          h += '<div class="addr-location">📍 ' + escHtml(a.location) + '</div>';
          if (a.note) h += '<div class="addr-note">💬 ' + escHtml(a.note) + '</div>';
          h += '</div></div>';
          h += '<div class="addr-actions">';
          h += '<button class="addr-action-btn edit" onclick="editAddress(' + a.id + ')">✏️ 编辑</button>';
          if (!a.is_default) h += '<button class="addr-action-btn default" onclick="setDefaultAddr(' + a.id + ')">⭐ 设为默认</button>';
          h += '<button class="addr-action-btn delete" onclick="deleteAddr(' + a.id + ')">🗑️ 删除</button>';
          h += '</div></div>';
        });
        el.querySelector('.sub-page-body').innerHTML = h;
        openSubPage('addrPage_sub');
      } catch(e) { showToast(_t('loadFailed')); }
    }

    async function editAddress(id) {
      let addr = {};
      if (id) { const list = await API.getAddresses(currentUser.phone); addr = list.find(a=>a.id===id)||{}; }
      let el = document.getElementById('addrEditPage_sub');
      if (!el) {
        el = document.createElement('div');
        el.id = 'addrEditPage_sub';
        el.className = 'sub-page';
        el.innerHTML = '<div class="sub-page-header"><button class="sub-page-back" onclick="closeSubPage(\'addrEditPage_sub\')">←</button><span class="sub-page-title" id="addrEditTitle"></span></div><div class="sub-page-body"></div>';
        document.body.appendChild(el);
      }
      document.getElementById('addrEditTitle').textContent = id ? '编辑地址' : '新增地址';
      let h = '<div class="sp-card"><div class="sp-card-body">';
      h += '<div class="addr-form-group"><label class="addr-form-label"><span class="label-icon">🏷️</span>名称</label><input class="addr-form-input" id="addrName" value="' + escHtml(addr.name||'') + '" placeholder="如：宿舍楼、教学楼" /></div>';
      h += '<div class="addr-form-group"><label class="addr-form-label"><span class="label-icon">📍</span>详细地址</label><input class="addr-form-input" id="addrLocation" value="' + escHtml(addr.location||'') + '" placeholder="如：3号楼405室" /></div>';
      h += '<div class="addr-form-group"><label class="addr-form-label"><span class="label-icon">💬</span>备注</label><input class="addr-form-input" id="addrNote" value="' + escHtml(addr.note||'') + '" placeholder="如：放门口架子上" /></div>';
      h += '<label class="addr-form-check"><input type="checkbox" id="addrDefault" ' + (addr.is_default?'checked':'') + ' /> ⭐ 设为默认地址</label>';
      h += '<button class="addr-form-save" onclick="saveAddress(' + (id||'null') + ')">💾 保存地址</button>';
      h += '</div></div>';
      el.querySelector('.sub-page-body').innerHTML = h;
      openSubPage('addrEditPage_sub');
    }

    async function saveAddress(id) {
      const name = document.getElementById('addrName').value.trim();
      const location = document.getElementById('addrLocation').value.trim();
      const note = document.getElementById('addrNote').value.trim();
      const is_default = document.getElementById('addrDefault').checked;
      if (!name||!location) return showToast('请填写名称和地址');
      try {
        if (id) await API.updateAddress(id, { name, location, note, is_default, phone: currentUser.phone });
        else await API.addAddress({ phone: currentUser.phone, name, location, note, is_default });
        showToast('保存成功'); showAddresses();
      } catch(e) { showToast(e.message); }
    }

    async function setDefaultAddr(id) {
      try { await API.updateAddress(id, { is_default: true, phone: currentUser.phone }); showAddresses(); } catch(e) { showToast(e.message); }
    }

    async function deleteAddr(id) {
      if (!confirm('确定删除此地址？')) return;
      try { await API.deleteAddress(id); showToast('已删除'); showAddresses(); } catch(e) { showToast(e.message); }
    }

// ── Window exports ──
window.showAddresses = showAddresses;
window.editAddress = editAddress;
window.saveAddress = saveAddress;
window.setDefaultAddr = setDefaultAddr;
window.deleteAddr = deleteAddr;
