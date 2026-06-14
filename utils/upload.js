// utils/upload.js - 上传中间件包装器（自动压缩图片）
const { compressImage } = require('./helpers');

/**
 * 包装 multer 中间件，上传后自动压缩图片（最大1200px）
 * 用法: router.post('/path', requireAuth, withCompress(upload.array('images', 9)), handler)
 */
function withCompress(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, async (err) => {
      if (err) return next(err);
      try {
        const files = req.files || (req.file ? [req.file] : []);
        const images = files.filter(f => f.mimetype && f.mimetype.startsWith('image/'));
        if (images.length > 0) {
          await Promise.all(images.map(f => compressImage(f.path)));
        }
      } catch(e) { /* 压缩失败不影响上传 */ }
      next();
    });
  };
}

module.exports = { withCompress };
