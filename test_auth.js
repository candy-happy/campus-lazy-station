// 快速测试认证流程
const captcha = require('./utils/captcha');
const { generateToken, verifyToken } = require('./utils/jwt');
const bcrypt = require('bcryptjs');
const db = require('./config/database');

// 1. 检查数据库
const user = db.prepare('SELECT id, name, phone, student_id, password FROM users WHERE student_id = ?').get('230725116');
console.log('用户数据:', JSON.stringify({ ...user, password: user?.password ? 'HASH_SET' : 'NULL' }, null, 2));

// 2. 测试密码验证
if (user && user.password) {
  const matched = bcrypt.compareSync('shoujihao', user.password);
  console.log('密码验证 shoujihao:', matched ? '✅' : '❌');
}

// 3. 生成 token 并验证
const payload = { type: 'user', student_id: '230725116', phone: user?.phone || '' };
const token = generateToken(payload);
console.log('Token 生成:', token.substring(0, 30) + '...');
console.log('Token 长度:', token.length);

const decoded = verifyToken(token);
console.log('Token 验证结果:', decoded ? JSON.stringify(decoded) : '❌ 失败');

// 4. 模拟前端发送：用 token 调用 API
const http = require('http');
const tokenForApi = token;

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 3000, path, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    http.get(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

// 5. 测试几个需要认证的 API
(async () => {
  console.log('\n--- API 测试 ---');
  
  const r1 = await apiGet('/api/ads', tokenForApi);
  console.log('GET /api/ads:', r1.status, typeof r1.body === 'object' ? (Array.isArray(r1.body) ? `[${r1.body.length} items]` : JSON.stringify(r1.body).substring(0, 80)) : r1.body);
  
  const r2 = await apiGet('/api/orders?phone=' + user.phone, tokenForApi);
  console.log('GET /api/orders:', r2.status, typeof r2.body === 'object' ? JSON.stringify(r2.body).substring(0, 80) : r2.body);
  
  const r3 = await apiGet('/api/notifications/' + user.phone, tokenForApi);
  console.log('GET /api/notifications:', r3.status, typeof r3.body === 'object' ? JSON.stringify(r3.body).substring(0, 80) : r3.body);
  
  const r4 = await apiGet('/api/coupons', tokenForApi);
  console.log('GET /api/coupons:', r4.status, typeof r4.body === 'object' ? JSON.stringify(r4.body).substring(0, 80) : r4.body);
  
  const r5 = await apiGet('/api/points/' + user.phone, tokenForApi);
  console.log('GET /api/points:', r5.status, typeof r5.body === 'object' ? JSON.stringify(r5.body).substring(0, 80) : r5.body);
})();
