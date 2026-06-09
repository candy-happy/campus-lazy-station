// scripts/seed-test-data.js - 插入测试数据
const db = require('../config/database');

console.log('🌱 开始插入测试数据...');

// 插入社团
db.exec(`
  INSERT OR IGNORE INTO clubs (name, category, description, president_phone, status, member_count) VALUES
  ('摄影协会', '文艺', '用镜头记录校园美好瞬间', '13800000001', 'active', 15),
  ('篮球社', '体育', '热爱篮球的同学一起来打球', '13800000002', 'active', 28),
  ('编程俱乐部', '科技', '一起学习编程，参加竞赛', '13800000003', 'active', 42),
  ('吉他社', '音乐', '民谣、流行、古典吉他交流', '13800000004', 'active', 19),
  ('志愿者协会', '志愿', '奉献爱心，服务社会', '13800000005', 'active', 56)
`);

// 插入社团成员（社长）
db.exec(`
  INSERT OR IGNORE INTO club_members (club_id, phone, role) VALUES
  (1, '13800000001', 'owner'),
  (2, '13800000002', 'owner'),
  (3, '13800000003', 'owner'),
  (4, '13800000004', 'owner'),
  (5, '13800000005', 'owner')
`);

// 插入活动
db.exec(`
  INSERT OR IGNORE INTO activities (title, description, location, start_time, end_time, signup_deadline, max_participants, category, publisher_type, publisher_id, publisher_name, phone, status, current_participants) VALUES
  ('校园摄影大赛', '用镜头记录校园最美瞬间', '校园各处', '2026-06-20 09:00', '2026-06-27 18:00', '2026-06-19 23:59', 100, '比赛', 'club', 1, '摄影协会', '13800000001', 'open', 23),
  ('3V3篮球赛', '夏日篮球友谊赛', '篮球场', '2026-06-22 14:00', '2026-06-22 18:00', '2026-06-21 20:00', 24, '运动', 'club', 2, '篮球社', '13800000002', 'open', 18),
  ('Python入门讲座', '零基础学Python编程', '图书馆报告厅', '2026-06-25 19:00', '2026-06-25 21:00', '2026-06-24 12:00', 80, '讲座', 'club', 3, '编程俱乐部', '13800000003', 'open', 56),
  ('草地音乐会', '夏日夜晚的音乐聚会', '操场草坪', '2026-06-28 18:30', '2026-06-28 21:30', NULL, 0, '演出', 'club', 4, '吉他社', '13800000004', 'open', 45),
  ('社区志愿服务', '帮助社区老人打扫卫生', '社区服务中心', '2026-06-23 09:00', '2026-06-23 12:00', '2026-06-22 18:00', 30, '志愿', 'club', 5, '志愿者协会', '13800000005', 'open', 27)
`);

// 验证
const clubs = db.prepare('SELECT COUNT(*) as cnt FROM clubs').get();
const acts = db.prepare('SELECT COUNT(*) as cnt FROM activities').get();

console.log(`✅ 社团数: ${clubs.cnt}`);
console.log(`✅ 活动数: ${acts.cnt}`);
console.log('🎉 测试数据插入完成！');

db.close();
