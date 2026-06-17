// utils/upload.js - 上传中间件包装器（自动压缩图片和视频）
const path = require('path');
const { compressImage, compressVideo, validateUploadFile } = require('./helpers');

/**
 * 包装 multer 中间件，上传后自动压缩图片（最大1200px）和视频（最大720p）
 * 用法: router.post('/path', requireAuth, withCompress(upload.array('images', 9)), handler)
 *
 * 执行顺序: multer 保存文件 → 魔数校验 → 压缩 → 更新元数据(ext/mimetype)
 * 重要: 必须先校验再压缩，否则 PNG→JPEG 转换后魔数不匹配会误判为伪造文件
 */
function withCompress(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, async (err) => {
      if (err) return next(err);
      try {
        const files = req.files || (req.file ? [req.file] : []);
        for (const f of files) {
          if (!f.mimetype) continue;

          // ⚠️ 先校验魔数（压缩前）—— 防止 PNG 转 JPEG 后魔数不匹配
          const v = validateUploadFile(f);
          if (!v.valid) {
            // 校验失败：删除已保存的文件
            const fs = require('fs');
            try { fs.unlinkSync(f.path); } catch {}
            return next({ status: 400, message: v.error });
          }

          // 压缩
          if (f.mimetype.startsWith('image/')) {
            await compressImage(f.path);
            // compressImage 将 PNG/WebP 重编码为 JPEG progressive
            // 检测文件是否实际被转为 JPEG（sharp 可用 + 文件 >=50KB 时）
            try {
              const fs = require('fs');
              const buf = fs.readFileSync(f.path);
              const isJPEG = buf[0] === 0xFF && buf[1] === 0xD8;
              if (isJPEG && f.mimetype !== 'image/jpeg') {
                // 内容已是 JPEG，同步扩展名和 MIME 避免后续魔数校验误判
                const newExt = '.jpg';
                const oldExt = path.extname(f.path);
                if (oldExt.toLowerCase() !== newExt) {
                  const newPath = f.path.replace(new RegExp(oldExt.replace('.', '\\.') + '$', 'i'), newExt);
                  fs.renameSync(f.path, newPath);
                  f.path = newPath;
                  f.filename = path.basename(newPath);
                }
                f.mimetype = 'image/jpeg';
              }
            } catch { /* 元数据更新失败不阻塞 */ }
          } else if (f.mimetype.startsWith('video/')) {
            await compressVideo(f.path);
          }
        }
      } catch(e) { /* 压缩失败不影响上传 */ }
      next();
    });
  };
}

module.exports = { withCompress };
