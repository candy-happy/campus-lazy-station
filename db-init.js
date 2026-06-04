// 校园懒人效率站 - 数据库初始化
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'lazy_station.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    dormitory TEXT,
    room TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS riders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    student_id TEXT,
    phone TEXT UNIQUE NOT NULL,
    dormitory TEXT,
    status TEXT DEFAULT 'online' CHECK(status IN ('online','offline','pending','disabled')),
    total_orders INTEGER DEFAULT 0,
    total_earnings REAL DEFAULT 0,
    rating REAL DEFAULT 5.0,
    level TEXT DEFAULT 'bronze' CHECK(level IN ('bronze','silver','gold','diamond')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    pickup_location TEXT NOT NULL,
    delivery_location TEXT NOT NULL,
    details TEXT,
    phone TEXT NOT NULL,
    price REAL NOT NULL,
    tip REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','running','completed','cancelled')),
    progress INTEGER DEFAULT 10,
    rider_phone TEXT,
    rider_name TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    accepted_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    rating_stars INTEGER,
    rating_comment TEXT,
    rating_at TEXT,
    cancel_reason TEXT,
    cancel_request_status TEXT CHECK(cancel_request_status IS NULL OR cancel_request_status IN ('pending','approved','rejected')),
    cancel_request_reason TEXT,
    cancel_requested_at TEXT,
    cancel_resolved_at TEXT,
    cancel_resolved_by TEXT,
    refund_status TEXT CHECK(refund_status IS NULL OR refund_status IN ('pending','approved_full','approved_partial','rejected')),
    refund_reason TEXT,
    refund_amount REAL,
    refund_requested_at TEXT,
    refund_resolved_at TEXT,
    refund_resolved_by TEXT,
    FOREIGN KEY (phone) REFERENCES users(phone)
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    min_amount REAL DEFAULT 0,
    expire_at TEXT NOT NULL,
    usable INTEGER DEFAULT 1,
    phone TEXT,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    FOREIGN KEY (phone) REFERENCES users(phone)
  );

  CREATE TABLE IF NOT EXISTS point_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    type TEXT CHECK(type IN ('earn','use')),
    amount INTEGER NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK(role IN ('super','admin')),
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    base_price REAL DEFAULT 2
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    type TEXT CHECK(type IN ('order','promo','system','rating')),
    title TEXT NOT NULL,
    content TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// 插入基础数据
const insertServices = db.prepare(`INSERT OR IGNORE INTO services (key, name, icon, base_price) VALUES (?, ?, ?, ?)`);
const services = [
  ['delivery', '代取外卖', '🍱', 2],
  ['express', '代取快递', '📦', 2],
  ['print', '打印复印', '🖨️', 1],
  ['purchase', '代买东西', '🛒', 3],
  ['laundry', '代取洗衣', '👕', 2],
  ['errand', '跑腿办事', '🏃', 5],
  ['other', '其他服务', '💡', 3]
];
const tx = db.transaction(() => { services.forEach(s => insertServices.run(...s)); });
tx();

// 插入示例优惠券
const insertCoupon = db.prepare(`INSERT OR IGNORE INTO coupons (id, name, value, min_amount, expire_at) VALUES (?, ?, ?, ?, ?)`);
insertCoupon.run(1, '新用户专享', 5, 0, '2026-12-31 23:59');
insertCoupon.run(2, '满10减3', 3, 10, '2026-12-31 23:59');

// 插入总管理员
const bcrypt = { hash: (p) => p }; // 简化版，生产环境应使用bcrypt
const insertAdmin = db.prepare(`INSERT OR IGNORE INTO admins (id, username, password, role) VALUES (?, ?, ?, ?)`);
insertAdmin.run(1, 'admin', 'admin123', 'super');

console.log('✅ 数据库初始化完成！');
console.log('📊 已创建表: users, riders, orders, coupons, points, point_logs, admins, services, notifications');
console.log('👤 总管理员: admin / admin123');
db.close();
