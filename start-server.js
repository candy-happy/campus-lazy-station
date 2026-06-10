// start-server.js - 安全启动脚本
// 解决修改代码后数据库连接不上的问题
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 校园圈 - 安全启动脚本\n');

// 清理数据库锁文件
console.log('🧹 清理数据库锁文件...');
const dbDir = __dirname;
const walFile = path.join(dbDir, 'lazy_station.db-wal');
const shmFile = path.join(dbDir, 'lazy_station.db-shm');

try {
  if (fs.existsSync(walFile)) {
    fs.unlinkSync(walFile);
    console.log('✅ 已删除 WAL 文件');
  } else {
    console.log('✅ WAL 文件不存在，无需删除');
  }
  if (fs.existsSync(shmFile)) {
    fs.unlinkSync(shmFile);
    console.log('✅ 已删除 SHM 文件');
  } else {
    console.log('✅ SHM 文件不存在，无需删除');
  }
  console.log('✅ 数据库锁文件清理完成');
} catch (e) {
  console.log('⚠️  锁文件清理失败:', e.message);
}

// 启动服务器
console.log('\n🔥 启动服务器...');
const server = spawn('node', ['server.js'], { 
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env }
});

server.on('exit', (code) => {
  console.log(`\n📤 服务器已退出，退出码: ${code}`);
});

server.on('error', (err) => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});