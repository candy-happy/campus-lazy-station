// 生成猫狗 paw print 图标 PNG (64x64)
const fs = require('fs');
const zlib = require('zlib');

const W = 64, H = 64;

// 创建 RGBA 像素数组
const pixels = Buffer.alloc(W * H * 4, 0);

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const idx = (y * W + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

// 渐变背景：暖橙色 → 粉色
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = y / H;
    const r = Math.round(255 * (1 - t) + 255 * 0.65 * t);
    const g = Math.round(140 * (1 - t) + 105 * 0.6 * t);
    const b2 = Math.round(50 * (1 - t) + 180 * 0.5 * t);
    setPixel(x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b2), 255);
  }
}

// 圆角遮罩
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = 32, cy = 32, r = 30;
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy > r * r) {
      setPixel(x, y, 0, 0, 0, 0);
    }
  }
}

// 辅助函数：画实心圆
function fillCircle(cx, cy, radius, r, g, b, a) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(H, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(W, Math.ceil(cx + radius)); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }
}

// 画 paw print - 白色
const white = [255, 255, 255, 230];

// 主肉垫（大椭圆在底部）
function fillOval(cx, cy, rx, ry, r, g, b, a) {
  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(H, Math.ceil(cy + ry)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(W, Math.ceil(cx + rx)); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }
}

// 主肉垫 (倒三角/心形)
fillOval(32, 40, 12, 10, ...white);

// 四个脚趾
fillCircle(18, 22, 7, ...white);   // 左上
fillCircle(46, 22, 7, ...white);   // 右上
fillCircle(26, 14, 6, ...white);    // 左中上
fillCircle(38, 14, 6, ...white);    // 右中上

// PNG 编码
function createPNG(width, height, rgba) {
  // 对每行添加 filter byte (0 = None)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend)
  ]);
}

const png = createPNG(W, H, pixels);
fs.writeFileSync('uploads/icons/pet-icon.png', png);
console.log('✅ pet-icon.png generated (' + png.length + ' bytes)');
