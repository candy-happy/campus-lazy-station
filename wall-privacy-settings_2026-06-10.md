# 校园墙隐私设置功能 - 实现总结

**日期**: 2026-06-10  
**版本**: app.html → v3.0.31

## 概述
实现了细粒度的校园墙隐私设置功能，用户可以对每个个人信息字段（电话、QQ、微信、姓名、签名、宿舍）独立设置可见性级别。

## 隐私级别
| 值 | 级别 | 说明 |
|----|------|------|
| 0 | 所有人可见 | 默认 |
| 1 | 仅粉丝可见 | 关注我的人可以看到 |
| 2 | 仅我关注的 | 我关注的人可以看到 |
| 3 | 互相关注 | 互相follow的人可以看到 |
| 4 | 仅自己可见 | 完全私密 |

## 修改的文件

### 1. 数据库 (`lazy_station.db`)
- `users` 表新增 `wall_privacy` TEXT 列，存储 JSON: `{"phone":0,"qq":2,"wechat":3,...}`

### 2. 后端

**`routes/users.js`**:
- PUT `/:phone` 端点新增 `wall_privacy` 字段支持

**`routes/wall.js`**:
- 导入 `optionalAuth` 中间件
- 重写 `GET /user/:phone` 端点，根据 viewer 与目标用户的关系级别过滤字段
- `getRelationLevel(viewerPhone, targetPhone)` 返回 0-4:
  - 0=陌生人, 1=viewer关注了target, 2=target关注了viewer, 3=互相, 4=自己
- 只有 `relationLevel >= privacyLevel` 时才返回该字段

### 3. 前端

**`app/js/user.js`**:
- 新增 `showWallPrivacySettings()` - 隐私设置 UI（6个字段×5个级别选择器）
- 新增 `selectPrivacyLevel()` / `saveWallPrivacy()` - 选择/保存逻辑
- 修改 `showSettings()` - 在隐私设置section添加"👁️ 校园墙隐私设置"入口
- 修改 `showUserProfile()` - 移除旧的独立toggle开关（show_phone_on_wall等）
- 修改 `saveProfile()` - 保存 `wall_privacy` 而非旧的独立字段

**`app/js/wall.js`**:
- `showWallUser()` 新增渐变背景卡片（支持 bg_image/bg_color）
- 新增联系方式显示：👤真实姓名、🏠宿舍（按隐私级别过滤）
- 联系方式布局优化，follow/私信按钮移出卡片区

**`app/css/style.css`**:
- 新增 `.privacy-field`, `.privacy-option` 等隐私选择器样式
- 支持移动端响应式（≤400px 隐藏描述文字）

## 验证结果
- ✅ 所有 JS 文件语法检查通过（user.js, wall.js, core.js）
- ✅ PM2 重启成功
- ✅ wall_privacy API 保存/读取正常
- ✅ wall user profile 按隐私级别正确过滤字段
- ✅ 用户查看自己时显示所有字段

## 待确认
- 前端隐私设置 UI 需要用户实际测试体验
- 跨用户查看时隐私过滤的边界测试
