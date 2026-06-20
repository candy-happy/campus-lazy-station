# Nginx 配置检查与修复

## 问题
QQ浏览器自动将 `http://` 升级为 `https://`，导致 `ERR_CONNECTION_REFUSED`

## 检查步骤

### 1. 在服务器上检查 Nginx 状态
```bash
sudo systemctl status nginx
sudo netstat -tlnp | grep -E ':(80|443|3000)'
```

### 2. 检查 Nginx 配置
```bash
sudo nginx -t
cat /etc/nginx/sites-available/default
```

### 3. 确保 Nginx 监听 80 端口

编辑 `/etc/nginx/sites-available/default`：

```nginx
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

    # 静态文件
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/ubuntu/campus-lazy-station;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. （可选）配置 443 端口重定向到 HTTP

```nginx
server {
    listen 443;
    server_name 124.221.67.29;
    return 301 http://$server_name$request_uri;
}
```

### 5. 重启 Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 验证

在服务器上执行：
```bash
curl -I http://124.221.67.29/app.html
curl -I https://124.221.67.29/app.html  # 应该返回 301 重定向
```

## QQ 浏览器兼容性

如果QQ浏览器仍然强制HTTPS，可以：
1. 让用户清除浏览器缓存和Cookie
2. 或者让用户使用其他浏览器（Chrome、Safari、微信内置浏览器）
3. 或者配置 SSL 证书（Let's Encrypt）
