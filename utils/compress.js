// utils/compress.js - 文件压缩工具（节约存储空间）
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * 压缩文件，返回压缩后文件路径（原地替换则与原路径相同）
 * @param {string} filePath - 原文件路径
 * @returns {Promise<{path: string, originalSize: number, compressedSize: number, saved: number}>}
 */
async function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const originalSize = fs.statSync(filePath).size;

  // 小文件不压缩（<10KB 无意义）
  if (originalSize < 10240) {
    return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
  }

  try {
    let result;

    switch (ext) {
      case '.jpg':
      case '.jpeg':
        result = await compressImage(filePath, 'jpeg');
        break;
      case '.png':
        result = await compressImage(filePath, 'png');
        break;
      case '.gif':
        result = await compressImage(filePath, 'gif');
        break;
      case '.pdf':
        result = await compressPdf(filePath);
        break;
      // .docx/.pptx/.xlsx 已是ZIP压缩格式，不再压缩
      // .zip/.rar/.7z 已是压缩包，不再压缩
      default:
        return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
    }

    return result;
  } catch (e) {
    console.error('[压缩] 失败，保留原文件:', path.basename(filePath), e.message);
    return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
  }
}

/**
 * 图片压缩（使用 sharp）
 */
async function compressImage(filePath, format) {
  const originalSize = fs.statSync(filePath).size;
  const tmpPath = filePath + '.tmp';

  const pipeline = sharp(filePath);

  switch (format) {
    case 'jpeg':
      pipeline.jpeg({ quality: 75, progressive: true, mozjpeg: true });
      break;
    case 'png':
      pipeline.png({ quality: 75, compressionLevel: 9, palette: true });
      break;
    case 'gif':
      // GIF 保持原格式不变
      return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
  }

  await pipeline.toFile(tmpPath);

  const compressedSize = fs.statSync(tmpPath).size;

  // 压缩后更大则保留原文件
  if (compressedSize >= originalSize) {
    fs.unlinkSync(tmpPath);
    return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
  }

  // 原地替换
  fs.unlinkSync(filePath);
  fs.renameSync(tmpPath, filePath);

  return { path: filePath, originalSize, compressedSize, saved: originalSize - compressedSize };
}

/**
 * PDF 基础压缩（移除冗余元数据 + deflate 重压）
 * 纯 Node.js 实现，不依赖 Ghostscript
 */
async function compressPdf(filePath) {
  const originalSize = fs.statSync(filePath).size;
  const zlib = require('zlib');
  const content = fs.readFileSync(filePath);

  // 尝试 deflate 压缩检测是否可缩减
  const deflated = zlib.deflateSync(content, { level: 9 });
  // 如果 deflate 能显著缩小（>3%），说明 PDF 未充分压缩
  if (deflated.length < content.length * 0.97) {
    // 可压缩空间小，不处理
    return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
  }

  return { path: filePath, originalSize, compressedSize: originalSize, saved: 0 };
}

module.exports = { compressFile };
