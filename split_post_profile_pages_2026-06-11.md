# 帖子详情 & 个人主页 拆分为两个独立子页面

**日期**: 2026-06-11  
**目标**: 点击帖子→帖子详情，点击头像→个人主页，两个不同子页面

## 修改内容

### app.html
- `wallDetailPage_sub` 标题从"个人主页"改为"帖子详情"
- 新增 `wallProfilePage_sub` 子页面：标题"个人主页"，内容区 `wallProfileContent`

### app/js/wall.js
- `showWallUser()` 渲染目标从 `wallDetailContent` → `wallProfileContent`，打开 `wallProfilePage_sub`
- 个人主页内帖子列表点击：关闭 `wallProfilePage_sub`
- `tryWallChat`（两处）：关闭 `wallProfilePage_sub`
- 粉丝列表导航：关闭 `wallProfilePage_sub`

### 保留不变的引用
- `showWallDetail` → 仍使用 `wallDetailPage_sub`
- 帖子详情内标签过滤（filterByTag/aiTagsHtml）→ 仍关闭 `wallDetailPage_sub`
- core.js 中 `wallDetailModal` 映射 → 仍为 `wallDetailPage_sub`

## 交互流程
1. 点击帖子 → `wallDetailPage_sub`（帖子详情 + 评论区）
2. 点击头像/用户名 → `wallProfilePage_sub`（个人资料 + TA的帖子）
3. 个人主页内点击帖子 → 关闭个人主页 → 打开帖子详情
4. 个人主页内点击"私信" → 关闭个人主页 → 进入消息页
