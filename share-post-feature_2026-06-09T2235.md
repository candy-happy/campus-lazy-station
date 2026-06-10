# 帖子分享功能实现

## 需求
校园墙每个帖子增加分享按钮，用户可以选择好友，以消息卡片形式发送。

## 实现方案

### 修改文件
1. **app/js/wall.js** — 新增 `showShareMenu` / `renderShareList` / `doSharePost` 三个函数，修改 `loadChatMessages` 增加 share_post 渲染
2. **app/js/core.js** — 两个位置添加分享按钮：帖子卡片头部（📤 图标）和底部操作栏（📤 文字按钮）
3. **app/css/style.css** — 新增 `.share-friend-btn` 样式

### 分享流程
1. 点击 📤 → `showShareMenu(postId)` 
2. 并发请求 `API.wallPostDetail(postId)` + `API.wallFollowing(phone)` 
3. 渲染底部弹窗：帖子预览 + 关注好友列表（头像+昵称+发送图标）
4. 选择好友 → `doSharePost(postId, toPhone, toName)`
5. 获取帖子 snippet → `API.wallChat()` 获取/创建会话 → `API.chatSend()` 发送 `type: share_post` 消息
6. Toast 提示「已分享给 XXX」

### 聊天渲染
`loadChatMessages` 中新增 `share_post` 类型处理：
- 解析 JSON 内容获取 post_id + snippet
- 渲染为蓝色边框可点击卡片，显示「📤 分享的帖子」+ 内容片段
- 点击卡片调用 `showWallDetail(postId)` 跳转原帖

### 按钮位置
- **帖子流卡片头部**：📤 图标，在 ⋯ 按钮旁，半透明hover变蓝
- **帖子流卡片底部**：📤 在 🚫 举报前
- **帖子详情页**：📤 分享在 💬 评论数和 🚫 举报之间，带文字标签