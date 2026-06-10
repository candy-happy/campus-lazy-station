// config/database.js - 数据库初始化与连接
const Database = require('better-sqlite3');
const path = require('path');
const { DB_PATH } = require('./index');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── 建表脚本 ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    nickname TEXT,
    avatar TEXT,
    bio TEXT,
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
    uid TEXT,
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
    cancel_reason TEXT
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
    total INTEGER DEFAULT 0
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
    type TEXT CHECK(type IN ('order','promo','system','rating','wall_like','wall_comment')),
    title TEXT NOT NULL,
    content TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    media_url TEXT,
    link_url TEXT,
    link_type TEXT DEFAULT 'none',
    link_value TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    start_time TEXT,
    end_time TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS wall_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    nickname TEXT,
    avatar TEXT,
    content TEXT,
    tags TEXT DEFAULT '',
    ai_tags TEXT DEFAULT '',
    images TEXT,
    gif_urls TEXT,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    exposure_count INTEGER DEFAULT 0,
    exposure_done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS wall_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    nickname TEXT,
    avatar TEXT,
    content TEXT,
    parent_id INTEGER,
    reply_to_phone TEXT,
    reply_to_nickname TEXT,
    like_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS wall_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(post_id, phone)
  );

  CREATE TABLE IF NOT EXISTS wall_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_phone TEXT NOT NULL,
    following_phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(follower_phone, following_phone)
  );

  CREATE TABLE IF NOT EXISTS wall_comment_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(comment_id, phone)
  );

  CREATE TABLE IF NOT EXISTS wall_exposures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(post_id, phone)
  );

  CREATE TABLE IF NOT EXISTS wall_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_phone TEXT NOT NULL,
    blocked_phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(blocker_phone, blocked_phone)
  );

  CREATE TABLE IF NOT EXISTS wall_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL DEFAULT 'post',
    target_id INTEGER NOT NULL,
    reporter_phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    detail TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    handled_at TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_phone TEXT NOT NULL,
    user2_phone TEXT NOT NULL,
    item_id TEXT,
    item_title TEXT,
    last_message TEXT,
    last_message_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_phone TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS withdraw_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    college TEXT NOT NULL,
    title TEXT DEFAULT '',
    research TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    like_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS teacher_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    like_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(teacher_id, phone, like_date)
  );

  CREATE TABLE IF NOT EXISTS teacher_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 5 CHECK(rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    ai_reviewed INTEGER DEFAULT 0,
    ai_level TEXT DEFAULT 'none',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ai_review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content_preview TEXT DEFAULT '',
    violation INTEGER DEFAULT 0,
    level TEXT DEFAULT 'none',
    category TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    action TEXT DEFAULT 'pass',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'user',
    ip TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'other',
    content TEXT NOT NULL,
    images TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    reply TEXT DEFAULT '',
    reply_by TEXT DEFAULT '',
    reply_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ─── 数据库迁移 ─────────────────────────────────────────
try { db.exec('ALTER TABLE riders ADD COLUMN avatar TEXT'); } catch(e) { /* 列已存在则忽略 */ }
try { db.exec('ALTER TABLE wall_posts ADD COLUMN is_pinned INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE wall_posts ADD COLUMN is_featured INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN chat_privacy TEXT DEFAULT \'all\''); } catch(e) {}
try { db.exec('ALTER TABLE market_items ADD COLUMN trade_status TEXT DEFAULT \'available\''); } catch(e) {}

// ─── 基础数据初始化 ─────────────────────────────────────
const initData = db.transaction(() => {
  // 服务（仅在表为空时插入，避免旧表无UNIQUE约束导致重复）
  const serviceCount = db.prepare('SELECT COUNT(*) as n FROM services').get().n;
  if (serviceCount === 0) {
    const insertService = db.prepare(`INSERT INTO services (key, name, icon, base_price) VALUES (?, ?, ?, ?)`);
    [
      ['delivery', '代取外卖', '🍱', 2],
      ['express', '代取快递', '📦', 2],
      ['print', '打印复印', '🖨️', 1],
      ['purchase', '代买东西', '🛒', 3],
      ['laundry', '代取洗衣', '👕', 2],
      ['errand', '跑腿办事', '🏃', 5],
      ['other', '其他服务', '💡', 3]
    ].forEach(s => insertService.run(...s));
  }

  // 优惠券（仅在表为空时插入）
  const couponCount = db.prepare('SELECT COUNT(*) as n FROM coupons').get().n;
  if (couponCount === 0) {
    const insertCoupon = db.prepare(`INSERT INTO coupons (id, name, value, min_amount, expire_at) VALUES (?, ?, ?, ?, ?)`);
    insertCoupon.run(1, '新用户专享', 5, 0, '2026-12-31 23:59');
    insertCoupon.run(2, '满10减3', 3, 10, '2026-12-31 23:59');
  }

  // 总管理员
  const bcrypt = require('bcryptjs');
  const insertAdmin = db.prepare(`INSERT OR IGNORE INTO admins (id, username, password, role) VALUES (?, ?, ?, ?)`);
  insertAdmin.run(1, 'admin', bcrypt.hashSync('admin123', 10), 'super');
});
initData();

module.exports = db;
