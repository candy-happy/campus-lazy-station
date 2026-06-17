// utils/upload.js - 上传中间件包装器（自动压缩图片和视频）
const { compressImage, compressVideo } = require('./helpers');

/**
 * 包装 multer 中间件，上传后自动压缩图片（最大1200px）和视频（最大720p）
 * 用法: router.post('/path', requireAuth, withCompress(upload.array('images', 9)), handler)
 */
function withCompress(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, async (err) => {
      if (err) return next(err);
      try {
        const files = req.files || (req.file ? [req.file] : []);
        const tasks = [];
        for (const f of files) {
          if (!f.mimetype) continue;
          if (f.mimetype.startsWith('image/')) tasks.push(compressImage(f.path));
          else if (f.mimetype.startsWith('video/')) tasks.push(compressVideo(f.path));
        }
        if (tasks.length > 0) await Promise.all(tasks);
      } catch(e) { /* 压缩失败不影响上传 */ }
      next();
    });
  };
}

module.exports = { withCompress };
