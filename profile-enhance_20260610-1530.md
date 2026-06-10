# 个人资料增强：背景图 + 联系方式 + 隐私开关

## 目标
在"我的"→个人资料页增加封面背景图、微信/QQ联系方式、校园墙可见性开关。

## 实现范围

### 数据库 (lazy_station.db → users 表)
新增7个字段: bg_image, bg_color, wechat, qq, show_phone_on_wall, show_wechat_on_wall, show_qq_on_wall

### 后端
- `routes/users.js`: PUT端点接受新字段；新增 POST `/:phone/cover` 封面图上传接口（multer, uploads/covers/）
- `routes/wall.js`: `GET /user/:phone` 返回 bg_image/bg_color/wechat/qq/phoneDisplay，按隐私开关过滤

### 前端
- `api.js`: 新增 `API.uploadUserCover(phone, file)` 方法
- `app/js/user.js`:
  - `showUserProfile()` 增强：封面区（背景图预览 + 8色块选择 + 上传按钮）、电话字段、微信/QQ字段、3组隐私开关
  - 新增 `selectProfileBg(el, color)` - 点选背景颜色
  - 新增 `uploadUserBg(input)` - 上传封面图片
  - `saveProfile()` 包含所有新字段
- `app/js/wall.js`:
  - `showWallUser()` 显示渐变背景卡片（支持背景图/纯色+渐变遮罩）、根据隐私显示微信/QQ/电话
- `app/js/core.js`:
  - `updateMePage()` 同步背景到"我的"页资料卡
- `app/css/style.css`:
  - 新增 `.profile-bg-color` 颜色选择器、`.profile-hero-overlay` 遮罩、`.profile-toggle` 开关样式

### 隐私规则
- show_phone_on_wall=0: 校园墙显示 `136****3760`
- show_wechat/qq_on_wall=0: 校园墙完全不显示该字段
- 默认均为false，用户需主动开启

## 版本
app.html → v3.0.28
