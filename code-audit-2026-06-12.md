# 校园圈 v3.0 全量代码审计报告
**日期**: 2026-06-12 10:50
**审计范围**: 全项目 JS/HTML/配置/环境

---

## 🔴 Critical (3)

### 1. `.env` 被 git 追踪 — API 密钥泄露
- `.gitignore` 有 `.env`，但 `git ls-files` 显示 `.env` 已被追踪
- 文件含真实 `DEEPSEEK_API_KEY` 和 `DOUBAO_API_KEY`
- **风险**: 推送到公开仓库 = 密钥泄露

### 2. `config/database.js` 缺少 10 张表定义
路由大量引用但表从未创建，**服务启动后对应功能 100% 崩溃**:
| 缺失表 | 引用次数 | 影响功能 |
|--------|---------|---------|
| clubs | 25 | 社团模块全部不可用 |
| club_members | 32 | 社团成员/入社审批不可用 |
| club_posts | 9 | 社团动态墙不可用 |
| club_applications | 12 | 入社申请不可用 |
| activities | 24 | 活动模块全部不可用 |
| activity_signups | 10 | 活动报名不可用 |
| market_orders | 28 | 二手交易全部流程不可用 |
| market_comments | 17 | 商品评论不可用 |
| seller_ratings | 8 | 卖家诚信度不可用 |
| token_blacklist | 5 | 骑手冻结机制失效 |

### 3. `config/database.js` riders 表缺少 `frozen`/`frozen_reason` 列
- middleware/auth.js 和 routes/riders.js 大量引用这两列
- **风险**: 首次部署建表时 SQL 查询崩溃

---

## 🟡 High (3)

### 4. `db-init.js` 与 `config/database.js` 两套初始化不一致
- `db-init.js` 是过时的独立脚本，缺少 wall/market/teacher/AI/chat 表
- `db-init.js` 仍含旧管理员账号 `admin/admin123`
- 两套脚本的表结构重叠但不一致，容易产生混淆数据库

### 5. `server.js` unhandledRejection 不退出
```js
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  // 不立即退出，但记录以便排查
});
```
- Promise rejection 未处理可能导致静默状态损坏
- 应该触发 gracefulShutdown 让 PM2 重启恢复干净状态

### 6. `server.js` uncaughtException 使用 `process.exit(0)`
- 致命错误应使用非零退出码（如 `process.exit(1)`）
- 退出码 0 可能让 PM2 认为正常退出而不自动重启

---

## 🟢 Medium (2)

### 7. 内存限流无持久化
- rateLimit.js 纯内存存储，PM2 重启后所有限流计数器清零
- 重启窗口期可能被暴力调用利用

### 8. `_temp_inline.js`、`_dbs.js` 等临时文件残留
- 项目根目录存在临时/调试文件
- 建议清理

---

## ✅ 已验证正确

- server.js 整体架构清晰，中间件配置合理
- routes/auth.js 登录逻辑健壮，验证码+验证+限速
- utils/jwt.js HMAC-SHA256 + 恒定时间比较，安全
- utils/response.js 统一错误码体系完整
- middleware/auth.js 5 级认证中间件设计合理
- 管理员账号已更新为 `1973344674`
- market_items 表定义正确（在 db.exec() 内）
