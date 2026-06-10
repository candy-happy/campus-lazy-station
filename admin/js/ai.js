// === AI审核 ===
    let _aiLogsPage = 1;

    function switchAiTab(tab, btn) {
      document.querySelectorAll('#page-ai .market-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#page-ai .market-admin-panel').forEach(p => p.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const panel = document.getElementById('aiPanel-' + tab);
      if (panel) panel.classList.add('active');
      // 切换到审核记录Tab时自动加载
      if (tab === 'logs') loadAiLogs();
    }

    async function loadAiLogs() {
      const source = document.getElementById('aiLogSource').value;
      const level = document.getElementById('aiLogLevel').value;
      const action = document.getElementById('aiLogAction').value;
      try {
        // 加载统计
        const statsRes = await fetch('/api/ai/stats', { headers: API._authHeaders() });
        const stats = await statsRes.json();
        if (stats.error) { showToast('加载统计失败: ' + stats.error); return; }
        document.getElementById('aiLogTotal').textContent = stats.total || 0;
        document.getElementById('aiLogViolations').textContent = stats.violations || 0;
        document.getElementById('aiLogBlocked').textContent = stats.blocked || 0;
        document.getElementById('aiLog24h').textContent = stats.recent24h || 0;
        // 加载记录
        const params = new URLSearchParams({ page: _aiLogsPage, limit: 20 });
        if (source !== 'all') params.set('source', source);
        if (level !== 'all') params.set('level', level);
        if (action !== 'all') params.set('action', action);
        const res = await fetch('/api/ai/logs?' + params, { headers: API._authHeaders() });
        const data = await res.json();
        if (data.error) { showToast('加载记录失败: ' + data.error); return; }
        const tbody = document.getElementById('aiLogsTable');
        tbody.innerHTML = '';
        const sourceMap = { wall_post: '📢墙帖子', wall_comment: '💬墙评论', market_item: '🛒商品', market_comment: '💬商品评论' };
        const actionMap = { pass: '✅放行', block: '🚫拦截', '下架': '⬇️下架' };
        const levelColors = { high: '#E74C3C', medium: '#F39C12', low: '#3498DB', none: '#95A5A6' };
        (data.rows || []).forEach(r => {
          const tr = document.createElement('tr');
          if (r.violation) tr.style.background = 'rgba(231,76,60,0.06)';
          tr.innerHTML = `<td>${r.id}</td><td>${sourceMap[r.source]||r.source}</td><td>${r.source_id}</td><td>${escHtml(r.phone)}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.content_preview||'')}">${escHtml((r.content_preview||'').slice(0,30))}</td><td><span style="color:${levelColors[r.level]||'#999'};font-weight:600">${({high:'高危',medium:'中危',low:'低危',none:'无'}[r.level]||r.level)}</span></td><td>${escHtml(r.category||'无')}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.reason||'')}">${escHtml((r.reason||'').slice(0,30))}</td><td>${actionMap[r.action]||r.action}</td><td style="font-size:12px;color:var(--text-secondary)">${r.created_at}</td>`;
          tbody.appendChild(tr);
        });
        // 分页信息
        const totalPages = Math.ceil((data.total || 0) / 20);
        document.getElementById('aiLogsPageInfo').textContent = `第${_aiLogsPage}页 / 共${totalPages}页 (${data.total}条)`;
        document.getElementById('aiLogsPrevBtn').disabled = _aiLogsPage <= 1;
        document.getElementById('aiLogsNextBtn').disabled = _aiLogsPage >= totalPages;
      } catch(e) {
        showToast('加载审核记录失败: ' + e.message);
      }
    }

    function aiLogsPage(delta) {
      _aiLogsPage += delta;
      if (_aiLogsPage < 1) _aiLogsPage = 1;
      loadAiLogs();
    }

    async function runAiMarketCheck() {
      const status = document.getElementById('aiMarketStatus').value;
      const limit = parseInt(document.getElementById('aiMarketLimit').value) || 50;
      const btn = document.getElementById('aiMarketBtn');
      btn.disabled = true;
      const prog = document.getElementById('aiMarketProgress');
      prog.style.display = 'block';
      document.getElementById('aiMarketResult').style.display = 'none';
      const t0 = Date.now();
      try {
        const resp = await fetch('/api/ai/market/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...API._headers() },
          body: JSON.stringify({ status, limit })
        });
        const data = await resp.json();
        if (data.error) { showToast('检测失败: ' + data.error); return; }
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        document.getElementById('aiMarketTotal').textContent = data.total;
        document.getElementById('aiMarketViolations').textContent = data.violations;
        document.getElementById('aiMarketClean').textContent = data.total - data.violations;
        document.getElementById('aiMarketTime').textContent = elapsed + 's';
        const tbody = document.getElementById('aiMarketTable');
        tbody.innerHTML = '';
        (data.results || []).forEach(r => {
          const tr = document.createElement('tr');
          if (r.violation) tr.style.background = 'rgba(231,76,60,0.08)';
          const levelClass = r.level === 'high' ? 'ai-violation-high' : r.level === 'medium' ? 'ai-violation-medium' : r.level === 'low' ? 'ai-violation-low' : 'ai-violation-none';
          const badgeClass = 'ai-level-' + (r.level || 'none');
          tr.innerHTML = `<td>${r.itemId}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.title || '')}">${escHtml((r.title || '').slice(0, 30))}</td><td>${escHtml(r.seller || '')}</td><td class="${levelClass}">${r.violation ? '⚠️ 违规' : '✅ 合规'}</td><td><span class="ai-level-badge ${badgeClass}">${(r.level || 'none') === 'none' ? '无' : (r.level || '').toUpperCase()}</span></td><td>${escHtml(r.category || '无')}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.reason || '')}">${escHtml((r.reason || '').slice(0, 40))}</td><td><button class="btn btn-danger btn-sm" onclick="alert('请到二手市场管理页面操作')">处理</button></td>`;
          tbody.appendChild(tr);
        });
        document.getElementById('aiMarketResult').style.display = 'block';
        if (data.violations > 0) showToast('⚠️ 发现 ' + data.violations + ' 条违规内容！');
        else showToast('✅ 检测完成，无违规内容');
      } catch(e) {
        showToast('检测失败: ' + e.message);
      } finally {
        prog.style.display = 'none';
        btn.disabled = false;
      }
    }

    async function runAiWallCheck() {
      const limit = parseInt(document.getElementById('aiWallLimit').value) || 50;
      const btn = document.getElementById('aiWallBtn');
      btn.disabled = true;
      document.getElementById('aiWallProgress').style.display = 'block';
      document.getElementById('aiWallResult').style.display = 'none';
      const t0 = Date.now();
      try {
        const resp = await fetch('/api/ai/wall/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...API._headers() },
          body: JSON.stringify({ limit })
        });
        const data = await resp.json();
        if (data.error) { showToast('检测失败: ' + data.error); return; }
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        document.getElementById('aiWallTotal').textContent = data.total;
        document.getElementById('aiWallViolations').textContent = data.violations;
        document.getElementById('aiWallClean').textContent = data.total - data.violations;
        document.getElementById('aiWallTime').textContent = elapsed + 's';
        const tbody = document.getElementById('aiWallTable');
        tbody.innerHTML = '';
        (data.results || []).forEach(r => {
          const tr = document.createElement('tr');
          if (r.violation) tr.style.background = 'rgba(231,76,60,0.08)';
          const levelClass = r.level === 'high' ? 'ai-violation-high' : r.level === 'medium' ? 'ai-violation-medium' : r.level === 'low' ? 'ai-violation-low' : 'ai-violation-none';
          const badgeClass = 'ai-level-' + (r.level || 'none');
          tr.innerHTML = `<td>${r.postId}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.title || '')}">${escHtml((r.title || '').slice(0, 30))}</td><td>${escHtml(r.author || '')}</td><td class="${levelClass}">${r.violation ? '⚠️ 违规' : '✅ 合规'}</td><td><span class="ai-level-badge ${badgeClass}">${(r.level || 'none') === 'none' ? '无' : (r.level || '').toUpperCase()}</span></td><td>${escHtml(r.category || '无')}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.reason || '')}">${escHtml((r.reason || '').slice(0, 40))}</td><td><button class="btn btn-danger btn-sm" onclick="alert('请到校园墙管理页面操作')">处理</button></td>`;
          tbody.appendChild(tr);
        });
        document.getElementById('aiWallResult').style.display = 'block';
        if (data.violations > 0) showToast('⚠️ 发现 ' + data.violations + ' 条违规内容！');
        else showToast('✅ 检测完成，无违规内容');
      } catch(e) {
        showToast('检测失败: ' + e.message);
      } finally {
        document.getElementById('aiWallProgress').style.display = 'none';
        btn.disabled = false;
      }
    }

    async function runAiWallCommentCheck() {
      const limit = parseInt(document.getElementById('aiWallCommentLimit').value) || 50;
      const btn = document.getElementById('aiWallCommentBtn');
      btn.disabled = true;
      document.getElementById('aiWallCommentProgress').style.display = 'block';
      document.getElementById('aiWallCommentResult').style.display = 'none';
      const t0 = Date.now();
      try {
        const resp = await fetch('/api/ai/wall/comments/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...API._headers() },
          body: JSON.stringify({ limit })
        });
        const data = await resp.json();
        if (data.error) { showToast('检测失败: ' + data.error); return; }
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        document.getElementById('aiWallCommentTotal').textContent = data.total;
        document.getElementById('aiWallCommentViolations').textContent = data.violations;
        document.getElementById('aiWallCommentClean').textContent = data.total - data.violations;
        document.getElementById('aiWallCommentTime').textContent = elapsed + 's';
        const tbody = document.getElementById('aiWallCommentTable');
        tbody.innerHTML = '';
        (data.results || []).forEach(r => {
          const tr = document.createElement('tr');
          if (r.violation) tr.style.background = 'rgba(231,76,60,0.08)';
          const levelClass = r.level === 'high' ? 'ai-violation-high' : r.level === 'medium' ? 'ai-violation-medium' : r.level === 'low' ? 'ai-violation-low' : 'ai-violation-none';
          const badgeClass = 'ai-level-' + (r.level || 'none');
          tr.innerHTML = `<td>${r.commentId}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.content || '')}">${escHtml((r.content || '').slice(0, 30))}</td><td>${escHtml(r.author || '')}</td><td class="${levelClass}">${r.violation ? '⚠️ 违规' : '✅ 合规'}</td><td><span class="ai-level-badge ${badgeClass}">${(r.level || 'none') === 'none' ? '无' : (r.level || '').toUpperCase()}</span></td><td>${escHtml(r.category || '无')}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.reason || '')}">${escHtml((r.reason || '').slice(0, 40))}</td><td><button class="btn btn-danger btn-sm" onclick="alert('请到校园墙管理页面操作')">删除</button></td>`;
          tbody.appendChild(tr);
        });
        document.getElementById('aiWallCommentResult').style.display = 'block';
        if (data.violations > 0) showToast('⚠️ 发现 ' + data.violations + ' 条违规内容！');
        else showToast('✅ 检测完成，无违规内容');
      } catch(e) {
        showToast('检测失败: ' + e.message);
      } finally {
        document.getElementById('aiWallCommentProgress').style.display = 'none';
        btn.disabled = false;
      }
    }

// window exports
window.switchAiTab = switchAiTab;
window.loadAiLogs = loadAiLogs;
window.aiLogsPage = aiLogsPage;
window.runAiMarketCheck = runAiMarketCheck;
window.runAiWallCheck = runAiWallCheck;
window.runAiWallCommentCheck = runAiWallCommentCheck;
