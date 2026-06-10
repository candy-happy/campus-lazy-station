
// 鍏ㄥ眬閿欒鎹曡幏 鈫?toast 鏄剧ず
window.addEventListener('error', function(e) {
  var t = document.getElementById('toast');
  if (t) { t.textContent = 'JS閿欒: ' + (e.message||e); t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 5000); }
});

// 绛夊緟 DOM + 鎵€鏈夊悓姝ヨ剼鏈氨缁悗鍒濆鍖?(function() {
  var steps = [];
  function log(s) { steps.push(s); console.log('[init]', s); }
  
  (async function initRider() {
    try {
      log('1. _init begin, token=' + (API._token ? 'set' : 'null'));
      API._init();
      log('2. _init done, token=' + (API._token ? 'set' : 'null'));
      
      var saved = localStorage.getItem('lazyRider');
      log('3. lazyRider=' + (saved ? 'exists' : 'null'));
      if (saved) {
        try { currentRider = JSON.parse(saved); } catch(e) { localStorage.removeItem('lazyRider'); }
      }
      log('4. currentRider=' + (currentRider ? 'set(phone=' + currentRider.phone + ')' : 'null'));
      
      if (!currentRider) {
        log('5. no rider 鈫?login page');
        openSubPage('loginPage_sub');
        return;
      }
      
      log('5. refreshOrders type=' + typeof refreshOrders);
      await refreshOrders();
      log('6. orders loaded, len=' + (riderAllOrders ? riderAllOrders.length : 'undefined'));
      
      updateProfile();
      log('7. profile updated');
      
      riderSwitchTab('home', null);
      log('8. switchTab done');
    } catch(e) {
      log('ERROR: ' + (e.message||e));
      console.error('[initRider]', e);
      var t = document.getElementById('toast');
      if (t) { t.textContent = '鍒濆鍖栧け璐? ' + e.message; t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 5000); }
    }
    
    // 涓婚 / 鐘舵€?    var theme = localStorage.getItem('lazyTheme');
    if (theme === 'dark') document.body.classList.add('dark');
    var sw = document.getElementById('statusSwitch');
    if (sw) { sw.classList.add('online'); }
    if (currentRider && typeof startFrozenCheck === 'function') startFrozenCheck();
    
    console.log('[initRider steps]', steps.join(' 鈫?'));
  })();
})();
