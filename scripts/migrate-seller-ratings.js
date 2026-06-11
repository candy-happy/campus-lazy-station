// scripts/migrate-seller-ratings.js
const db = require('../config/database');
db.exec(`
  CREATE TABLE IF NOT EXISTS seller_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_phone TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    order_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    UNIQUE(order_id)
  );
`);
console.log('✅ seller_ratings 表已创建（或已存在）');
process.exit(0);
