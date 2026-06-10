// 校园圈 - 数据库初始化
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

// ─── 性能优化索引 ──────────────────────────────────────────
db.exec(`
  -- 用户表索引
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

  -- 订单表索引（高频查询字段）
  CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
  CREATE INDEX IF NOT EXISTS idx_orders_rider_phone ON orders(rider_phone);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);

  -- 骑手表索引
  CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone);
  CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);

  -- 优惠券表索引
  CREATE INDEX IF NOT EXISTS idx_coupons_phone ON coupons(phone);

  -- 积分表索引
  CREATE INDEX IF NOT EXISTS idx_points_phone ON points(phone);
  CREATE INDEX IF NOT EXISTS idx_point_logs_phone ON point_logs(phone);

  -- 通知表索引
  CREATE INDEX IF NOT EXISTS idx_notifications_phone ON notifications(phone);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(phone, read);

  -- 社团表索引
  CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
  CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
  CREATE INDEX IF NOT EXISTS idx_clubs_president_phone ON clubs(president_phone);

  -- 社团成员表索引
  CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);
  CREATE INDEX IF NOT EXISTS idx_club_members_phone ON club_members(phone);

  -- 活动表索引
  CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
  CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
  CREATE INDEX IF NOT EXISTS idx_activities_phone ON activities(phone);
  CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(start_time);
  CREATE INDEX IF NOT EXISTS idx_activities_publisher ON activities(publisher_type, publisher_id);

  -- 活动报名表索引
  CREATE INDEX IF NOT EXISTS idx_activity_signups_activity_id ON activity_signups(activity_id);
  CREATE INDEX IF NOT EXISTS idx_activity_signups_phone ON activity_signups(phone);
  CREATE INDEX IF NOT EXISTS idx_activity_signups_status ON activity_signups(activity_id, status);
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
const bcrypt = require('bcryptjs');
const insertAdmin = db.prepare(`INSERT OR IGNORE INTO admins (id, username, password, role) VALUES (?, ?, ?, ?)`);
insertAdmin.run(1, 'admin', bcrypt.hashSync('admin123', 10), 'super');

console.log('✅ 数据库初始化完成！');
console.log('📊 已创建表: users, riders, orders, coupons, points, point_logs, admins, services, notifications, clubs, club_members, activities, activity_signups');
console.log('👤 总管理员: admin / admin123');
db.close();
