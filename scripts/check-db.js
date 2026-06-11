const db = require('better-sqlite3')('lazy_station.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// users
try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  console.log('users columns:', cols.map(c => c.name).join(', '));
  const rows = db.prepare("SELECT phone, nickname FROM users LIMIT 10").all();
  console.log('users:', JSON.stringify(rows, null, 2));
} catch(e) { console.log('no users:', e.message); }

// market_items
try {
  const cols = db.prepare("PRAGMA table_info(market_items)").all();
  console.log('market_items columns:', cols.map(c => c.name).join(', '));
  const rows = db.prepare("SELECT * FROM market_items LIMIT 3").all();
  console.log('market_items sample:', JSON.stringify(rows, null, 2).slice(0, 500));
} catch(e) { console.log('no market_items:', e.message); }
