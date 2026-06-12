# 帖子详情评论输入增强：图片/表情包 + 相机图标统一

**时间**: 2026-06-11 22:24  
**涉及文件**: wall.js, market.js, app.html

## 改动概要

### 1. 帖子详情评论输入框新增图片和表情按钮
**文件**: `app/js/wall.js` (v3.0.56 → v3.0.57)

- 评论输入栏布局从 `display:flex` 单行改为结构化的多行组件：
  - `cancelReplyHint`（已有，margin-bottom:6px 调整以适配新布局）
  - `wallCommentEmojiPanel` — 😊 表情面板（50个常用emoji网格）
  - `wallCommentMediaPreview` — 图片/视频缩略预览（带删除按钮）
  - flex行：😊 按钮 + 📷 上传label + 输入框 + 发送按钮

- 新增4个函数：
  - `toggleWallCommentEmoji()` — 切换表情面板显示/隐藏，首次展开时填充emoji网格
  - `insertWallCommentEmoji(emoji)` — 在光标位置插入emoji
  - `uploadWallCommentMedia(input)` — 选择文件后显示缩略预览（5MB上限，仅image/video）
  - `clearWallCommentMedia()` — 清除媒体预览和file input

- `submitWallComment()` 改造：
  - 验证：无文字且无媒体文件时提示"请输入内容或上传图片/视频"
  - 有媒体文件时先通过 `API.chatUpload()` 上传，拿到URL后拼接到content
  - 发送按钮防重复提交（disabled）
  - 成功后调用 `clearWallCommentMedia()` 清理
  - 已有 `_wallCommentMediaFile` 变量追踪当前媒体文件

- 新增变量 `let _wallCommentMediaFile = null;`（与 `_replyContext` 并列）
- 4个新函数已导出到 window

### 2. 统一相机图标 📷
**原则**: 所有图片/视频上传按钮统一使用 📷，不再使用 📎 (回形针) 或 +

| 位置 | 旧图标 | 新图标 |
|------|--------|--------|
| app.html 聊天输入上传按钮 | 📎 | 📷 |
| app.html 发帖媒体添加按钮 | + 添加 | 📷 添加 |
| app.html 发布商品添加按钮 | + | 📷 |
| market.js 商品评论上传按钮 | 📎 | 📷 |
| wall.js 评论上传按钮（新增） | — | 📷 |
| wall.js 代码注释 | 📎 | 📷 |

**保持不变的**: 
- app.html: 宠物评论已使用 📷
- app.html: 商品图片标签已使用 📷
- core.js: 教师评价媒体标签已使用 📷

### 3. 版本号
- wall.js: v3.0.56 → v3.0.57
- market.js: v3.0.38 → v3.0.39

## 经验
- wall_comment 表无 media 字段，采用"先上传获取URL → 拼入 content"策略，复用 chatUpload API（FormData multipart）
- 表情面板首次点击时才初始化内容，避免未使用时的DOM开销
- 用 URL.createObjectURL 做本地预览，无需等待上传
