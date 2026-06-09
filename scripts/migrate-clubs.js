const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'lazy_station.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS clubs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    category TEXT DEFAULT '其他',
    description TEXT,
    president_phone TEXT NOT NULL,
    member_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','frozen','pending')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS club_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
    joined_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(club_id, phone)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    cover TEXT,
    description TEXT,
    location TEXT,
    start_time TEXT,
    end_time TEXT,
    signup_deadline TEXT,
    max_participants INTEGER DEFAULT 0,
    current_participants INTEGER DEFAULT 0,
    category TEXT DEFAULT '其他',
    publisher_type TEXT DEFAULT 'user' CHECK(publisher_type IN ('club','user')),
    publisher_id INTEGER,
    publisher_name TEXT,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','closed','cancelled','ended')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS activity_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'signed' CHECK(status IN ('signed','cancelled','attended')),
    signed_up_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(activity_id, phone)
  );
`);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('All tables:', tables.map(t => t.name));
db.close();
