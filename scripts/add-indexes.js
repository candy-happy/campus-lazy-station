// scripts/add-indexes.js - 为现有数据库添加性能优化索引
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'lazy_station.db');
const db = new Database(dbPath);

console.log('🔍 检查并添加数据库索引...');

// 添加性能优化索引
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)',
  'CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone)',
  'CREATE INDEX IF NOT EXISTS idx_orders_rider_phone ON orders(rider_phone)',
  'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
  'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no)',
  'CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone)',
  'CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status)',
  'CREATE INDEX IF NOT EXISTS idx_coupons_phone ON coupons(phone)',
  'CREATE INDEX IF NOT EXISTS idx_points_phone ON points(phone)',
  'CREATE INDEX IF NOT EXISTS idx_point_logs_phone ON point_logs(phone)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_phone ON notifications(phone)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(phone, read)',
  'CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status)',
  'CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category)',
  'CREATE INDEX IF NOT EXISTS idx_clubs_president_phone ON clubs(president_phone)',
  'CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id)',
  'CREATE INDEX IF NOT EXISTS idx_club_members_phone ON club_members(phone)',
  'CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status)',
  'CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category)',
  'CREATE INDEX IF NOT EXISTS idx_activities_phone ON activities(phone)',
  'CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(start_time)',
  'CREATE INDEX IF NOT EXISTS idx_activities_publisher ON activities(publisher_type, publisher_id)',
  'CREATE INDEX IF NOT EXISTS idx_activity_signups_activity_id ON activity_signups(activity_id)',
  'CREATE INDEX IF NOT EXISTS idx_activity_signups_phone ON activity_signups(phone)',
  'CREATE INDEX IF NOT EXISTS idx_activity_signups_status ON activity_signups(activity_id, status)',
];

let added = 0;
let skipped = 0;

for (const sql of indexes) {
  try {
    db.exec(sql);
    const idxName = sql.match(/idx_\w+/)?.[0] || 'unknown';
    console.log(`✅ 添加索引: ${idxName}`);
    added++;
  } catch (e) {
    if (e.message.includes('already exists')) {
      skipped++;
    } else {
      console.error(`❌ 索引创建失败: ${e.message}`);
    }
  }
}

console.log(`\n📊 索引迁移完成: 新增 ${added} 个, 已存在 ${skipped} 个`);
db.close();
