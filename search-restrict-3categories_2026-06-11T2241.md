# 主页搜索功能限制 — 仅搜师说/二手/猫狗

**时间**: 2026-06-11 22:41  
**涉及文件**: app/js/core.js (v3.0.39→v3.0.40), app.html

## 背景
用户要求主页全局搜索仅支持3类内容，不搜校园墙用户/帖子/社团/活动/服务。

## 搜索范围变更

| 类别 | 搜索字段 | 状态 |
|------|---------|------|
| 👨‍🏫 师说 | 老师姓名 + 毕业院校 | ✅ 保留 |
| 🛒 二手市场 | 商品标题 + 内容 | ✅ 保留 |
| 🐱 猫狗日记 | 宠物姓名 | ✅ 保留 |
| 👤 用户 | — | ❌ 删除 |
| 📱 校园墙帖子 | — | ❌ 删除 |
| 🏘️ 社团 | — | ❌ 删除 |
| 🎯 活动 | — | ❌ 删除 |
| 🛎️ 服务 | — | ❌ 删除 |

## 后端现状（已确认）
- teachers路由 `search` 条件: `name LIKE ? OR college LIKE ? OR title LIKE ? OR research LIKE ? OR education LIKE ? OR graduate LIKE ? OR courses LIKE ?` — 已覆盖姓名+毕业院校 ✅
- market路由 `search` 条件: `mi.title LIKE ? OR mi.description LIKE ?` — 已覆盖标题+内容 ✅
- pets路由 `search` 条件: `code_name LIKE ? OR species LIKE ? OR bio LIKE ? OR location LIKE ? OR personality LIKE ? OR breed LIKE ?` — 已覆盖姓名 ✅

## 改动明细

### showGlobalSearchHints() — 输入时下拉提示
- 删除6个try/catch块：用户搜索、校园墙帖子、社团、活动、服务关键词
- 保留3个：师说→二手→猫狗
- 分组标题添加字段说明文本（如"老师姓名 · 毕业院校"）

### doGlobalSearch() — Enter键搜索
- 旧：6 API并行→设置wallPosts+_wallSearchMode→switchPage('wallPage')
- 新：3 API并行→直接渲染hints下拉HTML（复用相同样式模板）
- 不再跳转页面，在下拉中展示所有结果

### clearGlobalSearch() — 清除搜索
- 移除 `_wallSearchMode=false`、`_globalSearchClubs/Acts` 重置、`loadWallFeed()` 调用
- 保留 `_globalSearchPets/Teachers/Market/Query` 重置 + `hideGlobalSearchHints()`

## 交互流程
1. 用户输入 → 300ms防抖后并行搜索3个API → 下拉展示各分类结果（每条可点击跳转对应详情页）
2. 按Enter → 立即并行搜索3个API → 下拉展示（5条/类）
3. 点击X → 清空输入框+隐藏下拉+重置状态数组
