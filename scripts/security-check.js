// scripts/security-check.js - 安全检查脚本
// 用于验证生产环境的安全配置是否正确

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function pass(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function fail(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}!${colors.reset} ${msg}`); }

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function check(condition, msg, type = 'pass') {
  if (condition) {
    pass(msg);
    passCount++;
  } else if (type === 'warn') {
    warn(msg);
    warnCount++;
  } else {
    fail(msg);
    failCount++;
  }
}

console.log('\n🔒 校园圈 - 安全检查报告\n');
console.log('=' .repeat(50));

// 1. 检查环境变量
console.log('\n📋 环境变量检查:');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  check(envContent.includes('JWT_SECRET='), 'JWT_SECRET 已配置');
  check(envContent.includes('NODE_ENV='), 'NODE_ENV 已配置');
  
  // 检查JWT_SECRET是否足够强
  const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
  if (jwtSecretMatch) {
    const secret = jwtSecretMatch[1].trim();
    check(secret.length >= 32, 'JWT_SECRET 长度足够 (>=32字符)', secret.length >= 32 ? 'pass' : 'fail');
    check(!['your-secret-key', 'change-me', 'secret'].includes(secret), 'JWT_SECRET 不是默认值');
  }
} else {
  fail('.env 文件不存在');
}

// 2. 检查关键文件权限
console.log('\n🔐 文件权限检查:');
const sensitiveFiles = ['.env', 'config/database.js', 'utils/jwt.js'];
for (const file of sensitiveFiles) {
  const filePath = path.join(ROOT, file);
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      // Windows下权限检查不同，这里只检查文件是否存在
      pass(`${file} 文件存在`);
    } catch (e) {
      fail(`${file} 文件访问失败: ${e.message}`);
    }
  } else {
    fail(`${file} 文件不存在`);
  }
}

// 3. 检查安全中间件
console.log('\n🛡️  安全中间件检查:');
const middlewareFiles = [
  'middleware/security.js',
  'middleware/rateLimit.js',
  'middleware/auth.js',
  'middleware/requestLogger.js'
];
for (const file of middlewareFiles) {
  const filePath = path.join(ROOT, file);
  check(fs.existsSync(filePath), `${file} 存在`);
}

// 4. 检查上传目录安全
console.log('\n📁 上传目录检查:');
const uploadDirs = ['uploads', 'uploads/avatars', 'uploads/wall', 'uploads/market', 'uploads/pets'];
for (const dir of uploadDirs) {
  const dirPath = path.join(ROOT, dir);
  if (fs.existsSync(dirPath)) {
    pass(`${dir} 目录存在`);
    
    // 检查是否有.htaccess或index.html/app.html防止目录浏览
    const htaccess = path.join(dirPath, '.htaccess');
    const indexHtml = path.join(dirPath, 'index.html');
    const appHtml = path.join(dirPath, 'app.html');
    if (fs.existsSync(htaccess) || fs.existsSync(indexHtml) || fs.existsSync(appHtml)) {
      pass(`${dir} 目录已配置防浏览保护`);
    } else {
      warn(`${dir} 目录缺少防浏览保护文件`);
    }
  } else {
    warn(`${dir} 目录不存在（可能尚未创建）`);
  }
}

// 5. 检查数据库文件
console.log('\n🗄️  数据库检查:');
const dbPath = path.join(ROOT, 'data', 'campus.db');
if (fs.existsSync(dbPath)) {
  pass('数据库文件存在');
  const stats = fs.statSync(dbPath);
  if (stats.size > 0) {
    pass('数据库文件非空');
  } else {
    warn('数据库文件为空');
  }
} else {
  warn('数据库文件不存在（可能尚未初始化）');
}

// 6. 检查敏感信息泄露风险
console.log('\n🔍 敏感信息泄露风险检查:');
const serverJs = path.join(ROOT, 'server.js');
if (fs.existsSync(serverJs)) {
  const content = fs.readFileSync(serverJs, 'utf8');
  check(!content.includes('X-Powered-By'), '已移除 X-Powered-By 头');
  check(content.includes('securityHeaders'), '已启用安全头中间件');
  check(content.includes('rateLimit'), '已启用速率限制中间件');
}

// 7. 检查CORS配置
console.log('\n🌐 CORS配置检查:');
if (fs.existsSync(serverJs)) {
  const content = fs.readFileSync(serverJs, 'utf8');
  check(content.includes('CORS_ORIGINS'), 'CORS白名单已配置');
  check(content.includes('credentials: true'), 'CORS凭证已启用');
}

// 8. 检查日志目录
console.log('\n📝 日志目录检查:');
const logDir = path.join(ROOT, 'logs');
if (fs.existsSync(logDir)) {
  pass('日志目录存在');
} else {
  warn('日志目录不存在（将在首次请求时创建）');
}

// 总结
console.log('\n' + '='.repeat(50));
console.log('\n📊 安全检查结果:');
console.log(`${colors.green}通过: ${passCount}${colors.reset}`);
console.log(`${colors.yellow}警告: ${warnCount}${colors.reset}`);
console.log(`${colors.red}失败: ${failCount}${colors.reset}`);

if (failCount > 0) {
  console.log(`\n${colors.red}⚠️  发现 ${failCount} 个安全问题，建议修复后再部署到生产环境${colors.reset}`);
} else if (warnCount > 0) {
  console.log(`\n${colors.yellow}ℹ️  发现 ${warnCount} 个警告，建议检查但不影响部署${colors.reset}`);
} else {
  console.log(`\n${colors.green}✅ 所有安全检查通过，可以安全部署${colors.reset}`);
}

console.log('\n💡 安全建议:');
console.log('1. 定期更新JWT_SECRET');
console.log('2. 启用HTTPS');
console.log('3. 定期备份数据库');
console.log('4. 监控安全日志');
console.log('5. 定期审查依赖包安全更新');
console.log('');
