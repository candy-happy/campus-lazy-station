const WS = require('ws');
const http = require('http');

async function getCdpPort() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:59635/json/version', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const info = await getCdpPort();
  const browserWs = info.webSocketDebuggerUrl;
  console.log('Browser WS:', browserWs);

  const ws = new WS(browserWs);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout')), 5000);
  });

  let mid = 1;
  const pending = {};
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id !== undefined && pending[msg.id]) {
      pending[msg.id](msg);
      delete pending[msg.id];
    }
  });

  function send(method, params = {}, sessionId) {
    return new Promise((resolve) => {
      const id = mid++;
      pending[id] = resolve;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });
  }

  const targetsMsg = await send('Target.getTargets');
  const targetInfos = targetsMsg.result?.targetInfos || [];
  const pages = targetInfos.filter(t => t.type === 'page');
  const app = pages.find(p => p.url && p.url.includes('app.html'));
  if (!app) { console.log('app.html not found! Pages:', pages.map(p=>p.url)); ws.close(); return; }

  const attach = await send('Target.attachToTarget', { targetId: app.targetId, flatten: true });
  const sid = attach.result?.sessionId || attach.sessionId;
  await send('Runtime.enable', {}, sid);

  async function evalOnPage(expression) {
    const res = await send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true, timeout: 8000,
    }, sid);
    const r = res.result?.result || res.result;
    if (r) {
      if (r.subtype === 'error') return { error: r.description };
      return { value: r.value, type: r.type };
    }
    if (res.result?.exceptionDetails) {
      const ed = res.result.exceptionDetails;
      return { error: ed.text || ed.exception?.description };
    }
    return { error: JSON.stringify(res.error || res) };
  }

  console.log('\n=== Before Reload ===');
  const cu = await evalOnPage('typeof currentUser !== "undefined" && currentUser !== null ? (currentUser.phone + ", " + currentUser.name) : (typeof currentUser === "undefined" ? "undefined" : "null")');
  console.log('currentUser:', JSON.stringify(cu));
  const wp = await evalOnPage('typeof wallPosts !== "undefined" ? wallPosts.length : "undefined"');
  console.log('wallPosts.length:', JSON.stringify(wp));
  const html = await evalOnPage('document.getElementById("wallFeed")?.innerHTML?.length || 0');
  console.log('wallFeed HTML chars:', html);

  console.log('\n=== Reloading with cache clear ===');
  await send('Page.reload', { ignoreCache: true }, sid);
  await new Promise(r => setTimeout(r, 5000));
  await send('Runtime.enable', {}, sid);

  console.log('\n=== After Reload ===');
  const cu2 = await evalOnPage('typeof currentUser !== "undefined" && currentUser !== null ? (currentUser.phone + ", " + currentUser.name) : (typeof currentUser === "undefined" ? "undefined" : "null")');
  console.log('currentUser:', JSON.stringify(cu2));
  const wp2 = await evalOnPage('typeof wallPosts !== "undefined" ? wallPosts.length : "undefined"');
  console.log('wallPosts.length:', JSON.stringify(wp2));
  const feedHtml = await evalOnPage('document.getElementById("wallFeed")?.innerHTML?.length || 0');
  console.log('wallFeed HTML chars:', feedHtml);

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' }, sid);
  if (ss.result?.data) {
    require('fs').writeFileSync('C:\\Users\\19733\\.agent-browser\\tmp\\screenshots\\fix-verify.png', Buffer.from(ss.result.data, 'base64'));
    console.log('Screenshot saved.');
  }

  ws.close();
}

main().catch(e => console.error('Fatal:', e));