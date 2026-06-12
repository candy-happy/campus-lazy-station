# 二手市场私聊卖家修复 - 2026-06-11

## 根因
"💬 私聊卖家" 按钮无响应，涉及3个问题：

### 1. `openChatWithId` 未定义
market.js 的 `chatWithSeller()` 和 `chatWithTrader()` 调用 `openChatWithId(res.id)` 但该函数从未声明。

### 2. 服务端未返回对方信息
`openChatConv(convId, otherPhone, otherName)` 需要对方手机号和昵称，但两个接口都只返回了 conversation_id：
- `POST /items/:id/chat` → 修改返回 `{ok, conversation_id, other_phone, other_name}`
- `POST /chat/conversation` → 原 `return conv` 改为 `return {id, other_phone, other_name}`

### 3. chatConversation 在消息页内
从二手市场详情页调用 `openChatConv` 时，DOM `chatConversation` 虽设为 `display:flex`，但其父级 `messagePage` 未激活，实际不可见。

## 修复内容
- **wall.js**: 新增 `openChatWithId(convId, otherPhone, otherName)` → 调用 `openChatConv`；`openChatConv` 开头添加 `switchPage('message')` 确保切换到消息页
- **routes/market.js**: `/items/:id/chat` 返回增加 other_phone/other_name
- **routes/chat.js**: `/conversation` 返回改为 `{id, other_phone, other_name}`
- **market.js**: 两处调用改用 `openChatWithId(res.id, res.other_phone, res.other_name)`
