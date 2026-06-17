# QQ 浏览器登录问题修复方案

## 问题现象
- 电脑浏览器可正常登录
- QQ 浏览器手机端无法登录
- 错误显示：底层链接问题 / ERR_CONNECTION_REFUSED

## 根因分析

### 可能原因 1：缓存问题（最可能）
QQ 浏览器可能缓存了旧版本的 app.html 或 JS 文件（带 BOM 头的版本）

### 可能原因 2：验证码 SVG 兼容性问题
QQ 浏览器对 SVG 验证码的支持可能有问题

### 可能原因 3：HTTPS 强制升级
QQ 浏览器可能尝试将 HTTP 升级为 HTTPS，导致连接失败

## 修复步骤

### 步骤 1：服务器端强制刷新缓存
在服务器上执行：
```bash
cd /home/ubuntu/campus-lazy-station
git pull origin main
pm2 restart campus-lazy
```

### 步骤 2：添加版本号强制破缓存
修改 app.html 中的 JS/CSS 引用，添加版本号参数：
- `api.js?v=3.1.0`
- `app/js/user.js?v=3.1.0`

### 步骤 3：验证码兼容性优化
如果 SVG 验证码在 QQ 浏览器中无法显示，考虑：
1. 使用 Canvas 生成验证码图片（PNG 格式）
2. 或使用第三方验证码服务

### 步骤 4：用户端操作
告诉用户：
1. 清除 QQ 浏览器缓存
2. 或使用地址栏直接访问：`http://124.221.67.29/app.html?v=999`
3. 或尝试使用其他浏览器（Chrome、Safari）

## 快速验证

本地验证 QQ 浏览器兼容性：
```bash
# 检查文件是否有 BOM
for f in api.js app/js/user.js app.html; do
  if head -c 3 "$f" | xxd | grep -q 'efbb bf'; then
    echo "$f: 有 BOM (需要修复)"
  else
    echo "$f: 无 BOM (正常)"
  fi
done
```

## 预防措施

1. 部署时自动检查 BOM
2. 所有静态资源添加版本号
3. 配置 Nginx 缓存控制头
