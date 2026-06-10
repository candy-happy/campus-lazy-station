// migrate-club-posts.js - 社团公告/动态表
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'lazy_station.db');
const db = new Database(dbPath);

db.pragma('journal_mode=WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS club_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )
`);

const cols = db.prepare('PRAGMA table_info(club_posts)').all();
console.log('club_posts created OK, columns:');
cols.forEach(c => console.log('  ' + c.name + ' ' + c.type));

db.close();
console.log('Done.');
