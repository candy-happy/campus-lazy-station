# 手动推送说明

由于网络问题，git push 暂时无法执行。请手动复制以下文件到服务器：

## 需要上传的文件

1. `app/js/wall.js` - 删除 sendShareMessage 导出
2. `app/js/teachers.js` - 删除 escHtml 包装函数
3. `app/js/market.js` - _replyToCommentId/_replyToCommentName 改为 var

## 文件变更摘要

### wall.js (第2549行附近)
删除：
```javascript
window.sendShareMessage = sendShareMessage;
```

### teachers.js (第7-8行)
删除：
```javascript
// 兜底：防止 escHtml 未定义导致整个模块崩溃
if (typeof window.escHtml !== 'function') { window.escHtml = function(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }; }
var escHtml = function(s) { return window.escHtml(s); };
```
改为：
```javascript
// escHtml 由 core.js 的 function escHtml(){} 声明提供（全局函数，所有脚本共用）
```

### market.js
搜索 `_replyToCommentId` 和 `_replyToCommentName`，确保使用 `var` 声明而非 `let`。

## 云端部署命令
```bash
cd /var/www/campus-lazy-station
git pull  # 如果网络允许
# 或手动替换上述文件

node node_modules/.bin/pm2 restart server
```

## 本地验证
清除浏览器缓存后访问 http://localhost:3000/app.html
