#!/bin/bash
# fix-https-redirect.sh - 修复 QQ 浏览器的 HTTPS 强制升级问题

echo "=== 检查 Nginx 状态 ==="
sudo systemctl status nginx --no-pager

echo ""
echo "=== 检查端口监听状态 ==="
sudo netstat -tlnp | grep -E ':(80|443|3000)' || echo "netstat 不可用，尝试 ss 命令"
sudo ss -tlnp | grep -E ':(80|443|3000)'

echo ""
echo "=== 备份 Nginx 配置 ==="
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak.$(date +%Y%m%d_%H%M%S)

echo ""
echo "=== 检查当前 Nginx 配置 ==="
sudo cat /etc/nginx/sites-available/default

echo ""
echo "=== 生成新的 Nginx 配置 ==="
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
    listen 80;
    server_name 124.221.67.29;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|webm)$ {
        root /home/ubuntu/campus-lazy-station;
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}

# HTTPS 访问时重定向到 HTTP
server {
    listen 443;
    server_name 124.221.67.29;
    return 301 http://$server_name$request_uri;
}
EOF

echo ""
echo "=== 测试 Nginx 配置 ==="
sudo nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "=== 重启 Nginx ==="
    sudo systemctl restart nginx
    echo "✅ Nginx 配置已更新并重启"
else
    echo "❌ Nginx 配置测试失败，请检查配置"
    exit 1
fi

echo ""
echo "=== 验证端口监听 ==="
sleep 2
sudo ss -tlnp | grep -E ':(80|443)'

echo ""
echo "=== 测试 HTTP 访问 ==="
curl -I http://124.221.67.29/app.html 2>&1 | head -5

echo ""
echo "=== 测试 HTTPS 重定向 ==="
curl -I https://124.221.67.29/app.html 2>&1 | head -5

echo ""
echo "✅ 修复完成！"
echo "现在用户可以访问："
echo "  - http://124.221.67.29/app.html (正常访问)"
echo "  - https://124.221.67.29/app.html (会自动跳转到 HTTP)"
