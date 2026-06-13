# Git Push 失败日志 (2026-06-13)

## 问题
Git push 到 GitHub 持续失败，错误信息：
```
fatal: unable to access 'https://github.com/candy-happy/campus-lazy-station.git/': 
schannel: failed to receive handshake, SSL/TLS connection failed
```

## 已尝试的解决方案

1. ✅ 取消 sslBackend 设置 → 失败
2. ✅ 设置 sslBackend 为 schannel → 失败
3. ✅ 设置 sslBackend 为 openssl → 失败 (unexpected eof while reading)
4. ✅ 取消 sslVerify → 失败
5. ✅ 设置 http.version HTTP/1.1 → 失败
6. ✅ 使用代理 http://127.0.0.1:7890 → 失败
7. ✅ 取消代理 → 失败
8. ❌ 切换到 SSH 协议 → Host key verification failed

## 网络状态
- curl 访问 GitHub 正常 (HTTP/1.1 301 Moved Permanently)
- 问题仅限于 git 命令的 SSL 握手

## 当前提交
```
commit 7f5ac55 (HEAD -> main)
fix: 前端运行时错误修复
包含: _deploy_to_cloud.md, _frontend_fixes_summary.md, _manual_push.md
```

## 替代方案
1. 使用 GitHub Desktop 推送
2. 使用 VS Code 内置 git 推送
3. 手动上传文件到服务器
4. 等待网络问题解决后重试

## 实际代码修复 (已本地提交)
1. wall.js: 删除 `window.sendShareMessage = sendShareMessage;` (第2549行)
2. teachers.js: 删除 escHtml 包装函数 (第7-8行)
3. market.js: _replyToCommentId/_replyToCommentName 改为 var
