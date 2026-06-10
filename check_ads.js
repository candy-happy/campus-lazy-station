const db = require('./config/database');

const ads = db.prepare("SELECT id, title, media_url, image, status, end_time FROM ads WHERE status='active' AND (end_time IS NULL OR end_time > datetime('now','localtime')) ORDER BY sort_order ASC").all();

console.log('=== 活跃广告数据 ===');
console.log(JSON.stringify(ads, null, 2));

console.log('\n=== 广告文件列表 ===');
const fs = require('fs');
const path = require('path');
const adsDir = path.join(__dirname, 'uploads', 'ads');
if (fs.existsSync(adsDir)) {
  const files = fs.readdirSync(adsDir);
  files.forEach(f => console.log(f));
} else {
  console.log('目录不存在');
}