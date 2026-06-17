#!/bin/bash
# 部署脚本 - 在服务器上执行

cd /home/ubuntu/campus-lazy-station

echo "=== 拉取最新代码 ==="
git pull origin main

echo "=== 重启 PM2 服务 ==="
npx pm2 restart campus-lazy

echo "=== 检查状态 ==="
npx pm2 status

echo "=== 部署完成 ==="
echo "请让用户在 QQ 浏览器中访问: http://124.221.67.29/app.html?v=999"
