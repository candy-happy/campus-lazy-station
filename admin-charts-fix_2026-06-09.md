# 管理端折线图不显示 - 修复记录

## 日期
2026-06-09

## 问题
管理端数据概览页面所有折线图（订单趋势、用户增长、校园墙、二手市场、AI审核、服务分布）均不显示。

## 根因分析

### 原因1：Chart.js CDN 加载不稳定
- `admin.html` 引用 `https://cdn.jsdelivr.net/npm/chart.js`
- jsdelivr 在国内经常被拦截/超时
- 加载失败时 `window.Chart` 为 `undefined`
- `charts.js` 的所有 `new Chart(...)` 被 `try/catch` 静默吞掉
- 页面无报错提示，但图表区域空白

### 原因2：部分图表容器缺少高度
- `ordersChart`、`usersChart`、`servicesChart` 的容器 `.chart-container` 无高度定义
- CSS 中也没有 `.chart-container` 样式
- canvas 默认高度为 0，即使 Chart.js 正常也无法渲染
- 其他三个（`wallActivityChart`、`marketTrendOverviewChart`、`aiTrendChart`）有内联 `height:200px`

### 数据验证
- `/api/stats` 返回的 `daily_stats` 数据正常（30天，其中7天有非零值）
- `date(created_at)` 函数工作正常
- 排除数据问题

## 修复

1. **Chart.js 本地托管**：下载 `chart.js@4.4.7` UMD 版本（205KB）到 `admin/js/chart.min.js`
   - 将 HTML 引用从 `<script src="https://cdn.jsdelivr.net/npm/chart.js">` 改为 `<script src="admin/js/chart.min.js">`

2. **补充容器高度**：三个缺失的 `.chart-container` 加上 `style="height:260px"`

## 验证
- `admin/js/chart.min.js` 通过 `http://127.0.0.1:3000/admin/js/chart.min.js` 正常访问（200，205KB）
- `admin.html` 正常访问（200，76KB）
- 无需重启 PM2（静态文件）