// === 小功能管理模块 ===

// 所有可用功能定义
const ALL_SERVICES = [
  { key: 'errand',  icon: '🏃', name: '跑腿服务', action: "showErrandServices()" },
  { key: 'teacher', icon: '👨‍🏫', name: '师说',     action: "openSubPage('teacherListPage_sub')" },
  { key: 'pet',     icon: '🐱', name: '猫狗日记', action: "openSubPage('petListPage_sub')" },
  { key: 'market',  icon: '🛒', name: '二手市场', action: "loadMarketItems(true);openSubPage('marketListPage_sub')" },
  { key: 'review',  icon: '📚', name: '复习资料', action: "openSubPage('reviewPage_sub')" },
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
  let shownHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">';
  homeKeys.forEach((key, idx) => {
    const svc = ALL_SERVICES.find(s => s.key === key);
    if (!svc) return;
    shownHtml += `<div class="svc-manage-item" data-key="${key}" draggable="true"
      ondragstart="svcDragStart(event)" ondragover="svcDragOver(event)" ondrop="svcDrop(event)" ondragend="svcDragEnd(event)"
      style="background:var(--card-bg);border-radius:14px;padding:12px 6px;text-align:center;cursor:grab;touch-action:none;position:relative;border:2px solid #FF6B2B20">
      <div style="font-size:28px;margin-bottom:4px">${svc.icon}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text)">${svc.name}</div>
      <div style="position:absolute;top:2px;right:4px;font-size:10px;color:#FF6B2B;font-weight:700">${idx + 1}</div>
      <div onclick="event.stopPropagation();removeFromHome('${key}')" style="position:absolute;top:2px;left:4px;width:18px;height:18px;background:#e74c3c;color:#fff;border-radius:50%;font-size:11px;line-height:18px;cursor:pointer">×</div>
    </div>`;
  });
  shownHtml += '</div>';
  shownList.innerHTML = shownHtml;

  // 未显示的功能 - 正方形小图标网格
  const hiddenKeys = ALL_SERVICES.filter(s => !homeKeys.includes(s.key)).map(s => s.key);
  if (hiddenKeys.length === 0) {
    hiddenList.innerHTML = '';
  } else {
    let hiddenHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">';
    hiddenKeys.forEach(key => {
      const svc = ALL_SERVICES.find(s => s.key === key);
      if (!svc) return;
      hiddenHtml += `<div onclick="addToHome('${key}')" style="background:var(--card-bg);border-radius:14px;padding:12px 6px;text-align:center;cursor:pointer;border:2px dashed var(--border)">
        <div style="font-size:28px;margin-bottom:4px">${svc.icon}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${svc.name}</div>
        <div style="font-size:10px;color:#27ae60;margin-top:2px">+ 添加</div>
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

// ── 拖拽排序（PC端 drag events）──
let _svcDragKey = null;

function svcDragStart(e) {
  _svcDragKey = e.currentTarget.dataset.key;
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
}

function svcDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  // 视觉提示
  item.style.transform = 'scale(1.02)';
  item.style.boxShadow = '0 2px 12px rgba(255,107,43,0.2)';
}

function svcDrop(e) {
  e.preventDefault();
  const targetKey = e.currentTarget.dataset.key;
  if (!_svcDragKey || _svcDragKey === targetKey) return;

  let keys = getHomeServices();
  const fromIdx = keys.indexOf(_svcDragKey);
  const toIdx = keys.indexOf(targetKey);
  if (fromIdx < 0 || toIdx < 0) return;

  keys.splice(fromIdx, 1);
  keys.splice(toIdx, 0, _svcDragKey);
  saveHomeServices(keys);
  renderServiceManageList();
  renderHomeServices();
}

function svcDragEnd(e) {
  e.currentTarget.style.opacity = '';
  // 清除所有高亮
  document.querySelectorAll('.svc-manage-item').forEach(el => {
    el.style.transform = '';
    el.style.boxShadow = '';
  });
  _svcDragKey = null;
}

// ── 触摸拖拽（移动端）──
let _touchItem = null;
let _touchStartY = 0;
let _touchCurrentItem = null;

function bindTouchDrag() {
  document.querySelectorAll('.svc-manage-item').forEach(item => {
    item.addEventListener('touchstart', onTouchStart, { passive: false });
    item.addEventListener('touchmove', onTouchMove, { passive: false });
    item.addEventListener('touchend', onTouchEnd, { passive: false });
  });
}

function onTouchStart(e) {
  _touchItem = e.currentTarget;
  _touchStartY = e.touches[0].clientY;
  _touchCurrentItem = _touchItem;
  _touchItem.style.transition = 'none';
}

function onTouchMove(e) {
  if (!_touchItem) return;
  e.preventDefault();
  const touchY = e.touches[0].clientY;
  const dy = touchY - _touchStartY;
  _touchItem.style.transform = `translateY(${dy}px)`;
  _touchItem.style.zIndex = '100';
  _touchItem.style.opacity = '0.9';

  // 检测交换
  const items = document.querySelectorAll('.svc-manage-item');
  items.forEach(item => {
    if (item === _touchItem) return;
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (touchY > mid - 20 && touchY < mid + 20) {
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

function onTouchEnd(e) {
  if (!_touchItem) return;
  _touchItem.style.transition = '';
  _touchItem.style.transform = '';
  _touchItem.style.zIndex = '';
  _touchItem.style.opacity = '';

  // 找到目标位置
  if (_touchCurrentItem && _touchCurrentItem !== _touchItem) {
    const fromKey = _touchItem.dataset.key;
    const toKey = _touchCurrentItem.dataset.key;
    let keys = getHomeServices();
    const fromIdx = keys.indexOf(fromKey);
    const toIdx = keys.indexOf(toKey);
    if (fromIdx >= 0 && toIdx >= 0) {
      keys.splice(fromIdx, 1);
      keys.splice(toIdx, 0, fromKey);
      saveHomeServices(keys);
      renderHomeServices();
    }
  }

  // 清除所有高亮
  document.querySelectorAll('.svc-manage-item').forEach(el => {
    el.style.transform = '';
    el.style.boxShadow = '';
  });

  _touchItem = null;
  _touchCurrentItem = null;

  // 重新渲染列表
  renderServiceManageList();
}

// 页面加载时渲染首页服务
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderHomeServices, 100);
});
