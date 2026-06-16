// badges.js - 勋章墙功能模块
// 依赖: core.js, api.js (需先加载)

// ─── 打开勋章墙子页面 ────────────────────────────────
async function showBadgeWall() {
  openSubPage('badgeWallPage_sub');

  // 标记所有勋章已查看，清除红点
  try {
    await fetch('/api/badges/seen', { method: 'PUT', headers: API._authHeaders() });
  } catch(e) {}
  updateBadgeCount(0);
  if (typeof loadChatList === 'function') loadChatList();

  const grid = document.getElementById('badgeGrid');
  grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light)">加载中...</div>';

  try {
    const res = await fetch('/api/badges', { headers: API._authHeaders() });
    const data = await res.json();
    if (data.code !== 'OK') throw new Error(data.error || '获取失败');

    const badges = data.data.badges;
    document.getElementById('badgeEarnedNum').textContent = data.data.earnedCount;
    document.getElementById('badgeTotalNum').textContent = data.data.totalCount;

    grid.innerHTML = badges.map(b => {
      const earned = b.earned;
      const dateStr = b.earned_at ? new Date(b.earned_at).toLocaleDateString('zh-CN') : '';
      const iconHtml = b.isImage
        ? `<img src="${b.icon}" alt="${b.name}" class="badge-img-icon${earned ? '' : ' badge-img-locked'}" onerror="this.style.display='none'">`
        : `<span class="badge-icon">${b.icon}</span>`;
      return `
        <div class="badge-card ${earned ? 'earned' : 'locked'}" ${earned ? `onclick="showBadgeDetail('${b.id}','${b.name}','${b.desc}','${b.color}','${dateStr}', this)"` : ''}>
          ${earned ? '' : '<span class="badge-lock">🔒</span>'}
          ${iconHtml}
          <div class="badge-name">${b.name}</div>
          <div class="badge-desc">${b.desc}</div>
          ${earned ? `<div class="badge-earned-at">${dateStr} 获得</div>` : ''}
        </div>
      `;
    }).join('');

    updateBadgeCount(0);
  } catch (e) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">加载失败: ' + e.message + '</div>';
  }
}

// ─── 更新我的页面勋章计数徽章（仅显示未查看） ─────────
function updateBadgeCount(unseen) {
  const badge = document.getElementById('meBadgeCount');
  if (badge) {
    if (unseen > 0) {
      badge.textContent = unseen > 99 ? '99+' : unseen;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ─── 页面加载时预取勋章未查看计数 ─────────────────────
async function loadBadgeCount() {
  if (!currentUser || !currentUser.phone) return;
  try {
    const res = await fetch('/api/badges/count', { headers: API._authHeaders() });
    const data = await res.json();
    if (data.code === 'OK') {
      updateBadgeCount(data.data.unseen);
    }
  } catch (e) {
    // 静默失败
  }
}

// ─── 勋章详情动画 ──────────────────────────────────────
function showBadgeDetail(id, name, desc, color, dateStr, cardEl) {
  const old = document.getElementById('badgeDetailOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'badgeDetailOverlay';
  overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.3s ease';

  const iconClone = cardEl.querySelector('.badge-icon, .badge-img-icon');
  const iconHtml = iconClone ? iconClone.outerHTML : '';

  overlay.innerHTML = `
    <div class="badge-detail-card" style="background:var(--card);border-radius:24px;padding:32px 24px;width:100%;max-width:320px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);animation:badgePopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)">
      <div class="badge-detail-icon" style="animation:badgeGlow 1.5s ease-in-out infinite">
        ${iconHtml}
      </div>
      <div class="badge-detail-name" style="font-size:22px;font-weight:800;color:${color};margin:16px 0 8px">${name}</div>
      <div class="badge-detail-desc" style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">${desc}</div>
      <div class="badge-detail-date" style="font-size:12px;color:var(--text-light);margin-bottom:24px">🎖️ ${dateStr} 获得</div>
      <button onclick="document.getElementById('badgeDetailOverlay').remove()" style="padding:10px 32px;border:none;border-radius:25px;background:${color};color:white;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">知道了</button>
    </div>
    <canvas id="badgeConfetti" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100000"></canvas>
  `;

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

  setTimeout(() => launchConfetti(), 100);
}

function launchConfetti() {
  const canvas = document.getElementById('badgeConfetti');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6B2B','#9B59B6','#1ABC9C','#E74C3C','#F39C12','#3498DB'];
  const particles = [];
  const particleCount = 80;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12 - 3,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: Math.random() * 0.02 + 0.008,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.99;
      p.life -= p.decay;
      p.rotation += p.rotSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (Math.random() > 0.5) {
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size/2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    frame++;
    if (alive && frame < 120) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(animate);
}

// 导出
window.showBadgeWall = showBadgeWall;
window.updateBadgeCount = updateBadgeCount;
window.loadBadgeCount = loadBadgeCount;
window.showBadgeDetail = showBadgeDetail;
