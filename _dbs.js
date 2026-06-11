const D = require('better-sqlite3')('lazy_station.db', {readonly: true});
const tables = D.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(r => {
  const cols = D.prepare(`PRAGMA table_info('${r.name}')`).all().map(x => x.name).join(', ');
  console.log(r.name + ': ' + cols);
});
D.close();
