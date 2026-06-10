# 校园墙数据丢失根因修复 + 背景颜色删除

**日期**: 2026-06-10  
**版本**: app.html → v3.0.33

## 根因：API 响应格式与前端解析不匹配

### 问题
校园墙显示"没有数据"。排查发现 API 返回正常（37条帖子），但前端解析错误。

### 根因链
`wall.js` `loadWallFeed()` 和 `loadMoreWallPosts()` 使用：
```js
let data = await API.wallFeed(params);
wallPosts = Array.isArray(data) ? data : [];
```

但 `/api/wall/feed` 返回的是 `{posts: [...], hasMore: true}` — 一个**对象**，不是数组。所以 `Array.isArray(data)` 始终为 `false`，`wallPosts` 永远为空 `[]`。

### 同样影响
- **`wall.js` `doWallSearch()`**: API 返回 `{value: [...], Count: N}`，代码用 `Array.isArray(data)` 永远为 false
- **`core.js` `doGlobalSearch()`**: wall search 响应同样解析错误
- **`core.js` `showGlobalSearchHints()`**: wall search 响应同样解析错误

### 修复清单

| 文件 | 函数 | 改前 | 改后 |
|------|------|------|------|
| wall.js | loadWallFeed | `Array.isArray(data) ? data : []` | `Array.isArray(res.posts) ? res.posts : []` |
| wall.js | loadMoreWallPosts | `Array.isArray(data) ? data : []` | `Array.isArray(res.posts) ? res.posts : []` |
| wall.js | doWallSearch | `Array.isArray(data) ? data : []` | `Array.isArray(res.value) ? res.value : (Array.isArray(res) ? res : [])` |
| core.js | doGlobalSearch | `Array.isArray(wallRes.value) ? wallRes.value : []` | `...(wallRes.value && wallRes.value.value \|\| [])` |
| core.js | showGlobalSearchHints | `Array.isArray(data) ? data : []` | `...(data && data.value \|\| [])` |

### 额外修复
- `hasMore` 从响应中正确读取（之前写死为 true）

## 个人资料页删除背景颜色（同批）

移除 8 色块选择器、`bg_color` 保存、`selectProfileBg()` 函数，仅保留封面图上传。
