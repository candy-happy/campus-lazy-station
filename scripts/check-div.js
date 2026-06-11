const fs = require('fs');
const html = fs.readFileSync('app.html', 'utf8');
const lines = html.split('\n');
let depth = 0, started = false;
for (let i = 191; i < Math.min(235, lines.length); i++) {
  const l = lines[i];
  if (l.includes('id="orderPage"')) started = true;
  if (!started) continue;
  const o = (l.match(/<div\b/g) || []).length;
  const c = (l.match(/<\/div>/g) || []).length;
  depth += o - c;
  console.log((i + 1) + ': d=' + depth + ' ' + l.trim().slice(0, 90));
}
console.log('Final depth:', depth);
