# 帖子⋯按钮内联操作 - 垂直排列+文字

## 目标
把 ⋯ 按钮的内联操作从横向纯图标改为纵向 图标+文字 排列。

## 改动
- **core.js** (v3.0.36): action 按钮加文字标签（📤 分享 / 🚫 举报 / 🚷 拉黑 / 🗑️ 删除），font-size 调为 14px，padding 加大到 8px 16px
- **wall.js** (v3.0.40): 详情页同样改为图标+文字
- **style.css**: `.wall-inline-actions.open` 从 `inline-flex` 改为 `flex; flex-direction:column; gap:2px`
- 容器 `padding:6px; min-width:120px`，移除 `white-space:nowrap`

## 效果
点击 ⋯ → 右侧弹出垂直菜单，每行一个操作按钮，左图标右文字。
