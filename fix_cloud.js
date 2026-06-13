// fix_cloud.js — 老用户迁移：补 student_id + 密码
// 运行: node fix_cloud.js
const db = require('./config/database');
const bcrypt = require('bcryptjs');

db.pragma('foreign_keys = OFF');

console.log('=== 校园圈 v3.2 学号迁移 ===\n');

// 1. 查现状
const all = db.prepare('SELECT id, name, phone, student_id, (password IS NULL) AS pwd_null FROM users ORDER BY id').all();
console.log('当前用户:');
all.forEach(u => console.log(`  id=${u.id} | ${u.name} | phone=${u.phone} | sid=${u.student_id} | pwd=${!u.pwd_null}`));

// 2. 查找需要修复的老用户（student_id IS NULL）
const oldUsers = all.filter(u => u.student_id === null);
console.log(`\n需要修复的老用户: ${oldUsers.length} 个`);

if (oldUsers.length === 0) {
  console.log('无需修复，退出。');
  process.exit(0);
}

// 3. 用 phone 前9位作为临时学号（如果 phone 恰好是9位则直接用）
//    或生成 202312xxx 系列占位号
const existingSids = new Set(all.filter(u => u.student_id).map(u => u.student_id));
let sidCounter = 0;

function genSid(phone) {
  // 如果 phone 本身就是9位数字，先检查是否被占
  if (/^\d{9}$/.test(phone) && !existingSids.has(phone)) {
    existingSids.add(phone);
    return phone;
  }
  // 生成唯一9位占位号
  while (true) {
    sidCounter++;
    const sid = String(138000000 + sidCounter);
    if (!existingSids.has(sid) && sid.length === 9) {
      existingSids.add(sid);
      return sid;
    }
  }
}

// 4. 特殊处理：candy/丁卫星 用真实学号（如果存在）
const special = {
  '13645653760': '230725116',  // candy
};

// 5. 执行迁移
const updateSid = db.prepare('UPDATE users SET student_id = ? WHERE id = ?');
const defaultHash = bcrypt.hashSync('shoujihao', 10);
const updatePwd = db.prepare('UPDATE users SET password = ? WHERE id = ? AND password IS NULL');

for (const u of oldUsers) {
  let sid = special[u.phone];

  // 特殊学号是否被占用
  if (sid && existingSids.has(sid)) {
    console.log(`  ⚠ id=${u.id} phone=${u.phone}: 学号 ${sid} 已被占用，删除冲突记录...`);
    db.prepare('DELETE FROM users WHERE student_id = ?').run(sid);
    existingSids.delete(sid);
  }

  if (!sid) {
    sid = genSid(u.phone);
  }

  updateSid.run(sid, u.id);
  updatePwd.run(defaultHash, u.id);
  existingSids.add(sid);
  console.log(`  ✅ id=${u.id} (${u.name}, ${u.phone}) → sid=${sid}, 默认密码已设`);
}

// 6. 验证
console.log('\n=== 修复后 ===');
const final = db.prepare('SELECT id, name, phone, student_id, (password IS NOT NULL) AS has_pwd FROM users ORDER BY id').all();
final.forEach(u => console.log(`  id=${u.id} | ${u.name} | phone=${u.phone} | sid=${u.student_id} | pwd=${u.has_pwd}`));

db.pragma('foreign_keys = ON');
console.log('\n✅ 迁移完成！');
