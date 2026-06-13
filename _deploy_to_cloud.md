# 云端部署步骤

## 1. 登录服务器
```bash
ssh root@124.221.67.29
# 或
ssh root@124.221.221.67
```

## 2. 拉取代码
```bash
cd /var/www/campus-lazy-station
git pull origin main
```

## 3. 重启服务
```bash
node node_modules/.bin/pm2 restart server
```

## 4. 验证
```bash
curl http://localhost:3000/api/captcha?phone=test
# 应返回 SVG 验证码
```

## 本地测试
清除浏览器缓存后访问：
- http://localhost:3000/app.html (本地)
- http://124.221.67.29:3000/app.html (云端)

## 修复内容
- wall.js: 删除未定义函数导出
- teachers.js: 删除 escHtml 包装函数（修复无限递归）
- market.js: 修复变量声明
- core.js/wall.js: let→var 跨文件变量修复（已在前次提交）
