# 发布动态照片修复

## 问题
发布动态时选择了照片，但发布后没有显示。

## 原因
`submitWallPost` 函数没有处理 `wallSelectedFiles`（用户选择的图片/视频文件），只提交了文字内容。

## 修复
修改 `app/js/wall.js` 中的 `submitWallPost` 函数：

1. 在提交前上传所有选中的媒体文件到 `/api/upload`
2. 将上传返回的 URL 列表通过 `images` 参数传给 `API.wallPost`
3. 发布成功后清空已选文件列表

## 代码变更
```javascript
// 上传媒体文件
let imageUrls = [];
if (wallSelectedFiles && wallSelectedFiles.length > 0) {
  const uploadPromises = wallSelectedFiles.map(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', file.type.startsWith('video') ? 'video' : 'image');
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_token') || '') },
      body: formData
    });
    const data = await res.json();
    return data.url || null;
  });
  const results = await Promise.all(uploadPromises);
  imageUrls = results.filter(url => url !== null);
}

// 提交时带上图片URL
const res = await API.wallPost({ 
  phone: currentUser.phone, 
  nickname: currentUser.name, 
  avatar: currentUser.avatar || '', 
  content: content, 
  tags: hashTags.join(','),
  images: imageUrls.join(',')  // 新增
});
```

## 部署
```bash
git pull
node node_modules/.bin/pm2 restart server
```

## 测试
1. 打开发布动态页面
2. 选择1-9张照片/视频
3. 输入内容并发布
4. 确认帖子中显示图片

Commit: 973bfd5
