// migrate-club-applications.js - 社团申请审批表
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'lazy_station.db');
const db = new Database(dbPath);

db.pragma('journal_mode=WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS club_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(club_id, phone)
  )
`);

const cols = db.prepare('PRAGMA table_info(club_applications)').all();
console.log('club_applications created OK, columns:');
cols.forEach(c => console.log('  ' + c.name + ' ' + c.type));

// 将现有成员转为已审批的申请记录（补充数据）
const existing = db.prepare(`
  SELECT cm.club_id, cm.phone, cm.joined_at
  FROM club_members cm
  LEFT JOIN club_applications ca ON ca.club_id = cm.club_id AND ca.phone = cm.phone
  WHERE ca.id IS NULL AND cm.role = 'member'
`).all();

if (existing.length > 0) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO club_applications (club_id, phone, status, reviewed_at, created_at)
    VALUES (?, ?, 'approved', ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const m of existing) {
      insert.run(m.club_id, m.phone, m.joined_at, m.joined_at);
    }
  });
  tx();
  console.log(`Migrated ${existing.length} existing members to applications`);
}

db.close();
console.log('Done.');
