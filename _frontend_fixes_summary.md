# 前端问题修复汇总 (2026-06-13)

## 已发现问题

### 1. `sendShareMessage is not defined` (wall.js)
- **位置**: wall.js 第2549行
- **问题**: `window.sendShareMessage = sendShareMessage;` 尝试导出未定义的函数
- **影响**: 阻止 wall.js 后续导出语句执行（如 `sendShareMessageToConv`, `renderWallChannels` 等）
- **修复**: 删除该行导出语句

### 2. `escHtml` 无限递归 (teachers.js)
- **位置**: teachers.js 第7-8行
- **问题**: `var escHtml = function(s) { return window.escHtml(s); }` 覆盖全局 `window.escHtml`，导致自调用无限递归
- **影响**: 调用 escHtml 时触发 RangeError: Maximum call stack size exceeded
- **修复**: 删除该包装函数，依赖 core.js 提供的全局 escHtml

### 3. `_replyToCommentId` / `_replyToCommentName` 作用域 (market.js)
- **位置**: market.js 中这两个变量未声明直接使用
- **问题**: 隐式全局变量，在模块化后可能失效
- **修复**: 改为 `var` 声明

## 修复状态

| 文件 | 问题 | 状态 |
|------|------|------|
| wall.js | sendShareMessage 未定义 | ✅ 已修复 |
| teachers.js | escHtml 无限递归 | ✅ 已修复 |
| market.js | _replyToCommentId 未声明 | ✅ 已修复 |
| core.js | let→var 跨文件变量 | ✅ 已提交 (commit 96a07f7) |
| wall.js | let→var 跨文件变量 | ✅ 已提交 (commit 96a07f7) |

## 测试验证

- 登录页面渲染正常
- 验证码图片显示正常 (120x44px)
- 表单输入框全部可见
- 控制台无 JS 错误（除 rate limit 429）

## 待办

- [ ] 推送修复到云端并重启
- [ ] 用户端清除浏览器缓存后测试
- [ ] 验证登录后数据加载正常
