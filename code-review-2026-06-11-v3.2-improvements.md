# 代码审查与改进 v3.2（2026-06-11 22:09）

## 审查发现

| # | 问题 | 严重度 | 文件 |
|---|------|--------|------|
| 1 | 社团详情+公告列表 N+1 查询（逐条查作者名） | Medium | routes/clubs.js |
| 2 | 教师评价页全量 XSS（20+处 innerHTML 未转义） | High | app/js/teachers.js |
| 3 | 验证码接口无限流（可暴力调用耗尽内存） | Medium | routes/auth.js |
| 4 | tryWallChat 重复定义（旧版引用不存在的 chatConvModal） | Bug | app/js/wall.js |
| 5 | 社团前后端功能其实已完整（MEMORY.md 待办过时） | Info | — |

## 已修复

### 1. clubs.js — N+1 批量加载（2 处）
- `GET /:id` 详情：帖子作者名从逐条查询 → `WHERE phone IN (...)` 批量加载
- `GET /:id/posts` 公告列表：同上
- 影响：社团详情页从 6 次 DB 查询减至 2 次

### 2. teachers.js — XSS 防护（+20 处 escHtml）
- `loadTeacherColleges()`：学院名+数量
- `loadTeachers()`：教师姓名、头衔、学院、课程、研究方向
- `openTeacherDetail()`：姓名、学院、头衔、简介、毕业院校、课程、论文、项目、成果、社会兼职、研究方向标签、评论内容、评论昵称
- 缓存版本 3.0.28 → 3.0.29

### 3. auth.js — 验证码限速
- `GET /api/captcha` 新增 `captchaRateLimit`：每 IP 每分钟最多 10 次
- 防止恶意调用耗尽内存中的验证码缓存

### 4. wall.js — 删除重复 tryWallChat
- 第二个定义（line 814）引用已不存在的 `chatConvModal`（旧版 modal 方案）
- 删除后保留正确的页面切换方案（`chatConversation` div）
- 缓存版本 3.0.55 → 3.0.56

## 确认正常
- ✅ 通知合并对话（openNotifConv/backFromNotifConv/loadNotifMessages）渲染正确
- ✅ 验证码 SVG 生成正常（200 响应）
- ✅ 服务重启成功（PM2 campus-lazy，55.8MB）
- ✅ 社团后端路由已完整（创建/列表/排行/详情/申请/审批/公告/统计/转让/解散/成员管理）

## 文件变更
- routes/clubs.js — N+1 批量加载
- routes/auth.js — 验证码限速
- app/js/teachers.js — 20+ escHtml 注入
- app/js/wall.js — 删除重复函数
- app.html — 缓存版本号 bump
