# 首页通知迁移到消息界面 - 2026-06-11

## 目标
将首页顶栏的🔔通知铃铛移除，通知功能统一整合到底部导航的"消息"界面中。

## 修改文件

### 1. `app.html`
- **移除** 首页 header 中的🔔铃铛按钮（`openNotifModal()` 入口 + `notifBadge` 徽章）
- **新增** 消息页 Tab 栏：`💬 私信` / `🔔 通知`（带 `msgNotifBadge` 未读徽章）
- **新增** `notifListBody` 通知列表容器
- **移除** 独立的 `notifPage_sub` 子页面

### 2. `app/css/style.css`
- **新增** `.msg-tabs` / `.msg-tab` / `.msg-tab.active` 样式

### 3. `app/js/core.js`
- **新增** `updateMsgBadge()` — 合并通知+私信未读数，更新导航"消息"徽章和页内通知Tab徽章
- **新增** `switchMsgTab()` — 消息页内私信/通知Tab切换
- **新增** `renderNotifList()` — 渲染通知列表（拉取→标已读→渲染）
- **重写** `openNotifModal()` — 不再打开子页面，改为跳转到消息页+通知Tab
- **修改** `pollChatUnread()` — 徽章更新改为调用 `updateMsgBadge()`
- **修改** `pollNotifications()` — 徽章更新改为调用 `updateMsgBadge()`
- **修改** `loadData()` — 初始化时异步获取聊天未读数合并到徽章
- **修改** `switchPage('message')` — 进入消息页自动切到私信Tab
- **移除** `closeModal` map 中的 `notifModal` 映射

### 4. `app/js/wall.js`
- **修改** `initMessagePage()` — 未登录时两个tab都显示"请先登录"；登录后不重复加载（由 `switchMsgTab` 负责）

## 行为变化
- 导航栏"消息"徽章 = 通知未读 + 私信未读（合并显示）
- 点击通知Tab自动拉取最新并标已读
- 轮询（私信15s、通知30s）同时更新合并徽章
