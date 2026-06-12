// config/database.js - 数据库初始化与连接
const Database = require('better-sqlite3');
const path = require('path');
const { DB_PATH } = require('./index');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// 性能调优：WAL 自动检查点、内存缓存、内存映射 I/O
db.pragma('synchronous = NORMAL');      // WAL 模式下 NORMAL 足够安全
db.pragma('cache_size = -16000');       // 16MB 页面缓存
db.pragma('mmap_size = 268435456');     // 256MB 内存映射（64位系统）
db.pragma('wal_autocheckpoint = 1000'); // 每 1000 页自动检查点
db.pragma('busy_timeout = 30000');      // 30s 忙等待，避免 SQLITE_BUSY

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
    frozen INTEGER DEFAULT 0,
    frozen_reason TEXT,
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

  CREATE TABLE IF NOT EXISTS market_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_phone TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    original_price REAL,
    category TEXT DEFAULT 'other',
    condition_level INTEGER DEFAULT 1,
    images TEXT DEFAULT '[]',
    contact TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    updated_at DATETIME DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS market_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    buyer_phone TEXT NOT NULL,
    seller_phone TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','paid','completed','cancelled')),
    rating INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS market_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    user_phone TEXT NOT NULL,
    content TEXT,
    parent_id INTEGER,
    media_url TEXT,
    media_type TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS seller_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_phone TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    order_id INTEGER NOT NULL,
    rating REAL NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS token_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT,
    rider_phone TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS club_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT,
    images TEXT DEFAULT '[]',
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS club_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
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

// ─── 核心索引（性能优化，演示前必须添加） ─────────────
db.exec(`
  -- 校园墙核心
  CREATE INDEX IF NOT EXISTS idx_wall_posts_created ON wall_posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_wall_posts_phone ON wall_posts(phone);
  CREATE INDEX IF NOT EXISTS idx_wall_comments_post ON wall_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_wall_likes_post_phone ON wall_likes(post_id, phone);
  CREATE INDEX IF NOT EXISTS idx_wall_follows_follower ON wall_follows(follower_phone);
  CREATE INDEX IF NOT EXISTS idx_wall_follows_following ON wall_follows(following_phone);
  CREATE INDEX IF NOT EXISTS idx_wall_blocks_blocker ON wall_blocks(blocker_phone);
  CREATE INDEX IF NOT EXISTS idx_wall_exposures_post ON wall_exposures(post_id, phone);
  -- 聊天消息
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
  CREATE INDEX IF NOT EXISTS idx_conv_user1 ON conversations(user1_phone);
  CREATE INDEX IF NOT EXISTS idx_conv_user2 ON conversations(user2_phone);
  -- 通知
  CREATE INDEX IF NOT EXISTS idx_notif_phone_time ON notifications(phone, created_at);
  -- 订单
  CREATE INDEX IF NOT EXISTS idx_orders_phone_time ON orders(phone, created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_rider_phone ON orders(rider_phone);
  -- 教师评价
  CREATE INDEX IF NOT EXISTS idx_teacher_reviews_tid ON teacher_reviews(teacher_id);
  CREATE INDEX IF NOT EXISTS idx_teacher_likes_tid ON teacher_likes(teacher_id, phone);
  -- AI审核
  CREATE INDEX IF NOT EXISTS idx_ai_logs_source_id ON ai_review_logs(source, source_id);
  -- 二手市场
  CREATE INDEX IF NOT EXISTS idx_market_items_status ON market_items(status);
  CREATE INDEX IF NOT EXISTS idx_market_orders_buyer ON market_orders(buyer_phone);
  CREATE INDEX IF NOT EXISTS idx_market_orders_seller ON market_orders(seller_phone);
  CREATE INDEX IF NOT EXISTS idx_market_orders_item ON market_orders(item_id);
  CREATE INDEX IF NOT EXISTS idx_market_comments_item ON market_comments(item_id);
  CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller ON seller_ratings(seller_phone);
  -- 社团
  CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
  CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
  CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);
  CREATE INDEX IF NOT EXISTS idx_club_members_phone ON club_members(phone);
  CREATE INDEX IF NOT EXISTS idx_club_posts_club ON club_posts(club_id);
  CREATE INDEX IF NOT EXISTS idx_club_applications_club ON club_applications(club_id);
  -- 活动
  CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
  CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
  CREATE INDEX IF NOT EXISTS idx_activities_phone ON activities(phone);
  CREATE INDEX IF NOT EXISTS idx_activity_signups_act ON activity_signups(activity_id);
  CREATE INDEX IF NOT EXISTS idx_activity_signups_phone ON activity_signups(phone);
  -- 骑手冻结
  CREATE INDEX IF NOT EXISTS idx_token_blacklist_phone ON token_blacklist(rider_phone);
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
  insertAdmin.run(1, '1973344674', bcrypt.hashSync('Dwx52593344@', 10), 'super');
});
initData();

module.exports = db;
