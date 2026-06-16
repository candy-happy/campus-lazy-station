// === 小功能管理模块 ===

// 所有可用功能定义
const ALL_SERVICES = [
  { key: 'errand',  icon: '🏃', name: '跑腿服务', action: "showErrandServices()" },
  { key: 'teacher', icon: '👨‍🏫', name: '师说',     action: "openSubPage('teacherListPage_sub')" },
  { key: 'pet',     icon: '🐱', name: '猫狗日记', action: "openSubPage('petListPage_sub')" },
  { key: 'market',  icon: '🛒', name: '二手市场', action: "loadMarketItems(true);openSubPage('marketListPage_sub')" },
  { key: 'review',  icon: '📚', name: '复习资料', action: "openSubPage('reviewPage_sub')" },
  { key: 'club',    icon: '🌟', name: '社团',     action: "openClubPage()" },
  { key: 'star',    icon: '🌸', name: '校花校草', action: "openCampusStar()" },
];

const SERVICE_STORAGE_KEY = 'homeServicesOrder';
const MAX_HOME_SERVICES = 4;

// 获取首页显示的功能列表（有序）
function getHomeServices() {
  try {
    const saved = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) {
      // 过滤掉不存在的key
      return saved.filter(k => ALL_SERVICES.some(s => s.key === k));
    }
  } catch(e) {}
  // 默认：前4个
  return ALL_SERVICES.slice(0, MAX_HOME_SERVICES).map(s => s.key);
}

// 保存首页功能顺序
function saveHomeServices(keys) {
  localStorage.setItem(SERVICE_STORAGE_KEY, JSON.stringify(keys));
}

// 渲染首页服务网格
function renderHomeServices() {
  const grid = document.getElementById('homeServiceGrid');
  if (!grid) return;

  const homeKeys = getHomeServices();
  let html = '';

  // 渲染选中的功能
  homeKeys.forEach(key => {
    const svc = ALL_SERVICES.find(s => s.key === key);
    if (!svc) return;
    html += `<div class="service-item" onclick="${svc.action}">
      <div class="service-icon">${svc.icon}</div>
      <div class="service-name">${svc.name}</div>
    </div>`;
  });

  // "更多功能"按钮始终在最右边
  html += `<div class="service-item" onclick="openServiceManage()" style="opacity:0.85">
    <div class="service-icon">⚙️</div>
    <div class="service-name">更多功能</div>
  </div>`;

  grid.innerHTML = html;
}

// 打开功能管理页面
function openServiceManage() {
  openSubPage('serviceManagePage_sub');
  renderServiceManageList();
}

// 渲染功能管理列表
function renderServiceManageList() {
  const homeKeys = getHomeServices();
  const shownList = document.getElementById('serviceManageList');
  const hiddenList = document.getElementById('serviceHiddenList');
  if (!shownList || !hiddenList) return;

  // 首页显示的功能 - 正方形小图标网格
  let shownHtml = '<div id="shownDropZone" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px" ondragover="svcDragOverShown(event)" ondrop="svcDropToShown(event)">';
  homeKeys.forEach((key, idx) => {
    const svc = ALL_SERVICES.find(s => s.key === key);
    if (!svc) return;
    shownHtml += `<div class="svc-manage-item" data-key="${key}" draggable="true"
      onmousedown="onPressStart(event, '${key}')" onmouseup="onPressCancel(event)" onmouseleave="onPressCancel(event)" onclick="onItemClick(event, '${key}')"
      ondragstart="svcDragStart(event)" ondragover="svcDragOver(event)" ondrop="svcDrop(event)" ondragend="svcDragEnd(event)"
      style="background:var(--card-bg);border-radius:14px;padding:12px 6px;text-align:center;cursor:pointer;touch-action:none;position:relative;border:2px solid #FF6B2B20;user-select:none;-webkit-user-select:none">
      <div style="font-size:28px;margin-bottom:4px">${svc.icon}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text)">${svc.name}</div>
      <div style="position:absolute;top:2px;right:4px;font-size:10px;color:#FF6B2B;font-weight:700">${idx + 1}</div>
    </div>`;
  });
  shownHtml += '</div>';
  shownList.innerHTML = shownHtml;

  // 未显示的功能 - 正方形小图标网格（可接收拖入）
  const hiddenKeys = ALL_SERVICES.filter(s => !homeKeys.includes(s.key)).map(s => s.key);
  if (hiddenKeys.length === 0) {
    hiddenList.innerHTML = '<div id="hiddenDropZone" style="min-height:60px;border:2px dashed var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--text-light);font-size:13px" ondragover="svcDragOverHidden(event)" ondrop="svcDropToHidden(event)">拖到这里移出首页</div>';
  } else {
    let hiddenHtml = `<div id="hiddenDropZone" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;min-height:60px" ondragover="svcDragOverHidden(event)" ondrop="svcDropToHidden(event)">`;
    hiddenKeys.forEach(key => {
      const svc = ALL_SERVICES.find(s => s.key === key);
      if (!svc) return;
      hiddenHtml += `<div class="svc-manage-item" data-key="${key}" draggable="true"
      onmousedown="onPressStart(event, '${key}')" onmouseup="onPressCancel(event)" onmouseleave="onPressCancel(event)" onclick="onItemClick(event, '${key}')"
      ondragstart="svcDragStart(event)" ondragend="svcDragEnd(event)"
      style="background:var(--card-bg);border-radius:14px;padding:12px 6px;text-align:center;cursor:pointer;touch-action:none;border:2px dashed var(--border);user-select:none;-webkit-user-select:none">
        <div style="font-size:28px;margin-bottom:4px">${svc.icon}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${svc.name}</div>
      </div>`;
    });
    hiddenHtml += '</div>';
    hiddenList.innerHTML = hiddenHtml;
  }

  // 绑定触摸拖拽
  bindTouchDrag();
}

// 添加到首页
function addToHome(key) {
  let homeKeys = getHomeServices();
  if (homeKeys.length >= MAX_HOME_SERVICES) {
    showToast('首页最多显示' + MAX_HOME_SERVICES + '个功能，请先移除一个');
    return;
  }
  if (!homeKeys.includes(key)) {
    homeKeys.push(key);
    saveHomeServices(homeKeys);
  }
  renderServiceManageList();
  renderHomeServices();
}

// 从首页移除
function removeFromHome(key) {
  let homeKeys = getHomeServices();
  homeKeys = homeKeys.filter(k => k !== key);
  saveHomeServices(homeKeys);
  renderServiceManageList();
  renderHomeServices();
}

// ── 长按拖拽排序逻辑 ──
let _svcDragKey = null;
let _longPressTimer = null;
let _isLongPress = false;
let _dragEnabled = false;
const LONG_PRESS_DURATION = 400; // 长按触发时间(ms)

// 开始长按检测
function onPressStart(e, key) {
  _isLongPress = false;
  _dragEnabled = false;
  _svcDragKey = key;

  const item = e.currentTarget;
  item.style.transition = 'transform 0.1s';

  _longPressTimer = setTimeout(() => {
    _isLongPress = true;
    _dragEnabled = true;
    // 长按视觉反馈
    item.style.transform = 'scale(1.05)';
    item.style.boxShadow = '0 4px 20px rgba(255,107,43,0.3)';
    item.style.borderColor = '#FF6B2B';
    showToast('拖动调整位置');
  }, LONG_PRESS_DURATION);
}

// 取消长按
function onPressCancel(e) {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
  const item = e.currentTarget;
  if (!_dragEnabled) {
    item.style.transform = '';
    item.style.boxShadow = '';
    item.style.borderColor = '';
  }
}

// 按key执行对应功能（不用eval，避免CSP unsafe-eval拦截）
function executeServiceAction(key) {
  switch(key) {
    case 'errand': showErrandServices(); break;
    case 'teacher': openSubPage('teacherListPage_sub'); break;
    case 'pet': openSubPage('petListPage_sub'); break;
    case 'market': loadMarketItems(true); openSubPage('marketListPage_sub'); break;
    case 'review': openSubPage('reviewPage_sub'); break;
    case 'club': closeSubPage('serviceManagePage_sub'); setTimeout(function() { switchPage('discover'); setTimeout(function() { switchDiscoverTab('clubs'); }, 50); }, 100); break;
    case 'star': openCampusStar(); break;
  }
}

// 点击处理（区分单击进入 vs 长按拖拽）
function onItemClick(e, key) {
  if (_isLongPress || _dragEnabled) {
    // 长按后的释放，不触发点击
    _isLongPress = false;
    _dragEnabled = false;
    _svcDragKey = null;
    return;
  }
  executeServiceAction(key);
}

// PC端 drag events（长按后启用）
function svcDragStart(e) {
  if (!_dragEnabled) {
    e.preventDefault();
    return;
  }
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
}

function svcDragOver(e) {
  if (!_dragEnabled) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  item.style.transform = 'scale(1.02)';
  item.style.boxShadow = '0 2px 12px rgba(255,107,43,0.2)';
}

function svcDrop(e) {
  e.preventDefault();
  if (!_dragEnabled || !_svcDragKey) return;

  const targetKey = e.currentTarget.dataset.key;
  if (_svcDragKey === targetKey) return;

  let keys = getHomeServices();
  const fromIdx = keys.indexOf(_svcDragKey);
  const toIdx = keys.indexOf(targetKey);
  if (fromIdx < 0 || toIdx < 0) return;

  keys.splice(fromIdx, 1);
  keys.splice(toIdx, 0, _svcDragKey);
  saveHomeServices(keys);
  _dragEnabled = false;
  _svcDragKey = null;
  renderServiceManageList();
  renderHomeServices();
}

function svcDragEnd(e) {
  e.currentTarget.style.opacity = '';
  document.querySelectorAll('.svc-manage-item').forEach(el => {
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.borderColor = '';
  });
  // 恢复区域样式
  ['hiddenDropZone', 'shownDropZone'].forEach(id => {
    const dz = document.getElementById(id);
    if (dz) { dz.style.background = ''; dz.style.borderColor = ''; }
  });
  _dragEnabled = false;
  _svcDragKey = null;
}

// 拖入未添加区域（PC端）
function svcDragOverHidden(e) {
  if (!_dragEnabled) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const dz = document.getElementById('hiddenDropZone');
  if (dz) { dz.style.background = 'rgba(255,107,43,0.08)'; dz.style.borderColor = '#FF6B2B'; }
}

function svcDropToHidden(e) {
  e.preventDefault();
  if (!_dragEnabled || !_svcDragKey) return;
  const dz = document.getElementById('hiddenDropZone');
  if (dz) { dz.style.background = ''; dz.style.borderColor = ''; }
  removeFromHome(_svcDragKey);
  _dragEnabled = false;
  _svcDragKey = null;
}

// 拖入首页显示区域（PC端）
function svcDragOverShown(e) {
  if (!_dragEnabled) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const dz = document.getElementById('shownDropZone');
  if (dz) { dz.style.background = 'rgba(255,107,43,0.08)'; dz.style.borderColor = '#FF6B2B'; }
}

function svcDropToShown(e) {
  e.preventDefault();
  if (!_dragEnabled || !_svcDragKey) return;
  if (getHomeServices().includes(_svcDragKey)) return; // 已在首页，由item swap处理
  const dz = document.getElementById('shownDropZone');
  if (dz) { dz.style.background = ''; dz.style.borderColor = ''; }
  addToHome(_svcDragKey);
  _dragEnabled = false;
  _svcDragKey = null;
}

// ── 触摸拖拽（移动端长按后启用）──
let _touchItem = null;
let _touchStartX = 0;
let _touchStartY = 0;
let _touchCurrentItem = null;
let _touchDragActive = false;

function bindTouchDrag() {
  document.querySelectorAll('.svc-manage-item').forEach(item => {
    item.addEventListener('touchstart', onTouchStart, { passive: false });
    item.addEventListener('touchmove', onTouchMove, { passive: false });
    item.addEventListener('touchend', onTouchEnd, { passive: false });
    item.addEventListener('touchcancel', onTouchCancel, { passive: false });
  });
}

function onTouchStart(e) {
  const touch = e.touches[0];
  _touchItem = e.currentTarget;
  _touchStartX = touch.clientX;
  _touchStartY = touch.clientY;
  _touchCurrentItem = _touchItem;
  _touchDragActive = false;

  const key = _touchItem.dataset.key;

  // 启动长按计时
  _longPressTimer = setTimeout(() => {
    _isLongPress = true;
    _touchDragActive = true;
    _touchItem.style.transition = 'none';
    _touchItem.style.transform = 'scale(1.05)';
    _touchItem.style.zIndex = '100';
    _touchItem.style.boxShadow = '0 4px 20px rgba(255,107,43,0.3)';
    _touchItem.style.borderColor = '#FF6B2B';
    showToast('拖动调整位置');
  }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
  if (!_touchItem) return;

  const touch = e.touches[0];
  const dx = touch.clientX - _touchStartX;
  const dy = touch.clientY - _touchStartY;

  // 如果移动距离超过阈值，取消长按
  if (!_touchDragActive && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    if (_longPressTimer) {
      clearTimeout(_longPressTimer);
      _longPressTimer = null;
    }
    return;
  }

  // 长按后启用拖拽
  if (_touchDragActive) {
    e.preventDefault();
    _touchItem.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
    _touchItem.style.opacity = '0.9';

    // 检测交换目标
    const items = document.querySelectorAll('.svc-manage-item');
    items.forEach(item => {
      if (item === _touchItem) return;
      const rect = item.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      if (touch.clientX > midX - 30 && touch.clientX < midX + 30 &&
          touch.clientY > midY - 30 && touch.clientY < midY + 30) {
        if (_touchCurrentItem !== item) {
          _touchCurrentItem = item;
          item.style.transform = 'scale(1.02)';
          item.style.boxShadow = '0 2px 12px rgba(255,107,43,0.2)';
        }
      } else {
        item.style.transform = '';
        item.style.boxShadow = '';
      }
    });
  }
}

function onTouchEnd(e) {
  if (!_touchItem) return;

  // 清除长按计时
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }

  // 如果没有触发长按，则是单击
  if (!_isLongPress && !_touchDragActive) {
    const key = _touchItem.dataset.key;
    executeServiceAction(key);
    _touchItem = null;
    return;
  }

  // 长按拖拽结束：检查目标区域
  if (_touchDragActive) {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const hiddenZone = document.getElementById('hiddenDropZone');
    const shownZone = document.getElementById('shownDropZone');
    const key = _touchItem.dataset.key;
    const homeKeys = getHomeServices();
    
    if (hiddenZone && (target === hiddenZone || hiddenZone.contains(target)) && homeKeys.includes(key)) {
      // 拖入隐藏区 → 从首页移除
      removeFromHome(key);
    } else if (shownZone && (target === shownZone || shownZone.contains(target)) && !homeKeys.includes(key)) {
      // 拖入首页区 → 添加到首页
      addToHome(key);
    } else if (_touchCurrentItem && _touchCurrentItem !== _touchItem) {
      // 与显示的项交换
      const fromKey = _touchItem.dataset.key;
      const toKey = _touchCurrentItem.dataset.key;
      const fromIdx = homeKeys.indexOf(fromKey);
      const toIdx = homeKeys.indexOf(toKey);
      if (fromIdx >= 0 && toIdx >= 0) {
        homeKeys.splice(fromIdx, 1);
        homeKeys.splice(toIdx, 0, fromKey);
        saveHomeServices(homeKeys);
        renderHomeServices();
      }
    }
  }

  // 重置样式
  _touchItem.style.transition = '';
  _touchItem.style.transform = '';
  _touchItem.style.zIndex = '';
  _touchItem.style.opacity = '';
  _touchItem.style.borderColor = '';

  document.querySelectorAll('.svc-manage-item').forEach(el => {
    el.style.transform = '';
    el.style.boxShadow = '';
  });

  _touchItem = null;
  _touchCurrentItem = null;
  _touchDragActive = false;
  _isLongPress = false;

  renderServiceManageList();
}

function onTouchCancel(e) {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
  if (_touchItem) {
    _touchItem.style.transition = '';
    _touchItem.style.transform = '';
    _touchItem.style.zIndex = '';
    _touchItem.style.opacity = '';
    _touchItem.style.borderColor = '';
    _touchItem = null;
  }
  _touchCurrentItem = null;
  _touchDragActive = false;
  _isLongPress = false;
}

// 页面加载时渲染首页服务
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderHomeServices, 100);
});

// 导出到全局作用域（内联onclick等属性需要）
window.openServiceManage = openServiceManage;
window.addToHome = addToHome;
window.removeFromHome = removeFromHome;
window.onItemClick = onItemClick;
window.onPressStart = onPressStart;
window.onPressCancel = onPressCancel;
window.executeServiceAction = executeServiceAction;
window.svcDragStart = svcDragStart;
window.svcDragOver = svcDragOver;
window.svcDrop = svcDrop;
window.svcDragEnd = svcDragEnd;
window.svcDragOverHidden = svcDragOverHidden;
window.svcDropToHidden = svcDropToHidden;
window.svcDragOverShown = svcDragOverShown;
window.svcDropToShown = svcDropToShown;
window.renderHomeServices = renderHomeServices;
