// ═══════════════════════════════════════════════════════
// 校园墙帖子分享图片模块 (wall-share.js)
// 生成精美分享图片，支持QQ/微信转发
// ═══════════════════════════════════════════════════════
(function () {

  // ─── Canvas 辅助函数 ──────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    if (!text) return y;
    var words = text.split('');
    var line = '', cy = y, lineCount = 0;
    for (var i = 0; i < words.length; i++) {
      var testLine = line + words[i];
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, cy);
        line = words[i];
        cy += lineHeight;
        lineCount++;
        if (maxLines && lineCount >= maxLines) {
          // 截断加省略号
          var truncated = line + '...';
          if (ctx.measureText(truncated).width > maxWidth) {
            while (ctx.measureText(truncated).width > maxWidth && truncated.length > 3) {
              truncated = truncated.slice(0, -4) + '...';
            }
          }
          if (truncated) ctx.fillText(truncated, x, cy);
          return cy + lineHeight;
        }
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, cy);
    return cy + lineHeight;
  }

  // 转义HTML特殊字符（来自core.js的escHtml）
  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── 生成帖子分享图片 ──────────────────────────────────
  function drawWallShareImage(post) {
    var canvas = document.createElement('canvas');
    var W = 600, H = 700; // 高清画布 (QQ/微信分享推荐600px宽)
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // 白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // ─── 顶部装饰条 ───
    var topGrad = ctx.createLinearGradient(0, 0, W, 0);
    topGrad.addColorStop(0, '#FF6B2B');
    topGrad.addColorStop(0.5, '#FF8C42');
    topGrad.addColorStop(1, '#FF6B2B');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, 5);

    // ─── Header: 头像 + 昵称 + 时间 ───
    var headerY = 30;
    // 头像背景圆
    var avatarColors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#F39C12','#9B59B6','#E74C3C','#1ABC9C','#3498DB','#E67E22'];
    var avatarIdx = (post.phone || '').slice(-2);
    avatarIdx = parseInt(avatarIdx) || 0;
    var avatarBg = avatarColors[avatarIdx % avatarColors.length];

    var avatarX = 30, avatarY = headerY, avatarR = 24;
    ctx.fillStyle = avatarBg;
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fill();

    // 头像文字
    var avatarText = (post.nickname || '用').charAt(0);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(avatarText, avatarX + avatarR, avatarY + avatarR);

    // 昵称
    ctx.fillStyle = '#333';
    ctx.font = 'bold 17px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(post.nickname || '校园圈用户', avatarX + 60, headerY + 16);

    // 时间
    var timeStr = post.created_at ? new Date(post.created_at).toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'}) : '';
    ctx.fillStyle = '#999';
    ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(timeStr, avatarX + 60, headerY + 38);

    // ─── 分隔线 ───
    ctx.strokeStyle = '#F0F0F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, headerY + 65);
    ctx.lineTo(W - 30, headerY + 65);
    ctx.stroke();

    // ─── 标签 ───
    var tagY = headerY + 80;
    if (post.tags && post.tags.length) {
      var tags = Array.isArray(post.tags) ? post.tags : post.tags.split(',').filter(Boolean);
      var tagX = 30;
      tags.forEach(function (t) {
        var tag = t.replace(/^#/, '');
        if (!tag) return;
        ctx.fillStyle = '#FFF5F0';
        roundRect(ctx, tagX, tagY - 9, ctx.measureText(tag).width + 20, 26, 13);
        ctx.fill();
        ctx.strokeStyle = '#FF8C65';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#FF6B2B';
        ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText(tag, tagX + 10, tagY + 8);
        tagX += ctx.measureText(tag).width + 26;
      });
      tagY += 40;
    } else {
      tagY += 10;
    }

    // ─── 正文内容 ───
    var content = post.content || '';
    ctx.fillStyle = '#333';
    ctx.font = '16px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    var textEndY = wrapText(ctx, content, 30, tagY + 10, W - 60, 28, 8);

    // ─── 图片展示 ───
    // 返回 canvas，外部调用 toDataURL
    // NOTE: 图片异步加载，先绘制占位符
    var imgY = textEndY + 15;
    var hasImages = post.images && post.images.length;
    canvas._pendingImages = [];
    if (hasImages) {
      var imgs = Array.isArray(post.images) ? post.images : post.images.split(',').filter(Boolean);
      if (imgs.length > 0) {
        var displayImgs = imgs.slice(0, 3);
        var imgW = (W - 70) / 3;
        var imgH = imgW;
        displayImgs.forEach(function (src, idx) {
          var ix = 30 + idx * (imgW + 5);
          // 占位框
          ctx.strokeStyle = '#E8E8E8';
          ctx.fillStyle = '#F8F8F8';
          ctx.lineWidth = 1;
          roundRect(ctx, ix, imgY, imgW, imgH, 8);
          ctx.fill();
          ctx.stroke();
          // 加载图标
          ctx.fillStyle = '#CCC';
          ctx.font = '28px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🖼️', ix + imgW / 2, imgY + imgH / 2);
          // 异步加载图片
          var img = new Image();
          img.crossOrigin = 'anonymous';
          var sx = ix, sy = imgY, sw = imgW, sh = imgH;
          canvas._pendingImages.push(new Promise(function (resolve) {
            img.onload = function () {
              ctx.save();
              roundRect(ctx, sx, sy, sw, sh, 8);
              ctx.clip();
              ctx.drawImage(this, sx, sy, sw, sh);
              ctx.restore();
              resolve();
            };
            img.onerror = function () { resolve(); };
            img.src = src.startsWith('http') ? src : src.startsWith('/') ? src : '/' + src;
          }));
        });
        imgY += imgW + 15;
      }
    } else {
      imgY += 5;
    }

    // ─── 底部宣传区 ───
    // 底部装饰渐变条
    var footGrad = ctx.createLinearGradient(0, H - 80, 0, H);
    footGrad.addColorStop(0, '#FFF');
    footGrad.addColorStop(0.5, '#FFF8F5');
    footGrad.addColorStop(1, '#FFEEE5');
    ctx.fillStyle = footGrad;
    ctx.fillRect(0, H - 120, W, 120);

    // 分隔线
    ctx.strokeStyle = '#FEE5D5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 30, H - 120);
    ctx.lineTo(W / 2 + 30, H - 120);
    ctx.stroke();

    // 城市名 + slogan
    ctx.fillStyle = '#FF6B2B';
    ctx.font = 'bold 18px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('校园懒人效率站', W / 2, H - 70);

    ctx.fillStyle = '#999';
    ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('发现校园 · 分享生活', W / 2, H - 48);

    ctx.fillStyle = '#BBB';
    ctx.font = '10px "PingFang SC","Microsoft YaHei",sans-serif';
    var shareUrl = window.location.origin + '/share/' + post.id;
    ctx.fillText(shareUrl, W / 2, H - 28);

    return canvas;
  }

  // ─── 图片转Blob ────────────────────────────────────────
  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/png');
    });
  }

  // ─── 原生分享（智能适配QQ/微信）────────────────────────
  async function nativeShare(canvas, post) {
    var pageUrl = window.location.origin + '/share/' + post.id;
    var title = (post.nickname || '校园圈用户') + ' 的帖子';
    var text = (post.content || '').slice(0, 80);
    var ua = navigator.userAgent;
    var isWeChat = /micromessenger/i.test(ua);
    var isQQ = /qq/i.test(ua) && !isWeChat;

    // ── 微信：只分享链接（微信会自动抓取OG标签生成预览卡片）──
    if (isWeChat && navigator.share) {
      try {
        await navigator.share({ title: title, text: text, url: pageUrl });
        return true;
      } catch (e) {
        // 用户取消或失败，不继续尝试文件分享
        return false;
      }
    }

    // ── 非微信：尝试Web Share API ──
    if (navigator.share) {
      // 尝试图片+URL分享（QQ/系统分享面板支持较好）
      var blob = await canvasToBlob(canvas);
      var file = new File([blob], 'wall_post_' + post.id + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: title, url: pageUrl });
          return true;
        } catch (e) {
          if (e.name !== 'AbortError') console.log('Share files failed:', e);
        }
      }
      // 降级：分享文本+链接
      try {
        await navigator.share({ title: title, text: text, url: pageUrl });
        return true;
      } catch (e) {}
    }

    // ── QQ URL Scheme（QQ/TIM内置浏览器降级）──
    if (isQQ) {
      try {
        window.location.href = 'mqqapi://share/to_fri?src_type=app&version=1&share_type=0&title=' +
          encodeURIComponent(title) + '&desc=' + encodeURIComponent((post.content || '').slice(0, 100)) +
          '&share_url=' + encodeURIComponent(pageUrl);
        return true;
      } catch (e) {}
    }

    return false;
  }

  // ─── 显示分享图片弹窗（降级兜底）──────────────────────
  function showShareImageFallback(canvas, post) {
    var old = document.getElementById('wallShareImgOverlay');
    if (old) old.remove();

    var dataUrl = canvas.toDataURL('image/png');
    var overlay = document.createElement('div');
    overlay.id = 'wallShareImgOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:fadeIn 0.2s';
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = [
      '<div style="background:#fff;border-radius:16px;width:90%;max-width:420px;max-height:85vh;overflow-y:auto;padding:16px;display:flex;flex-direction:column;align-items:center">',
      '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:12px">',
      '<span style="font-size:16px;font-weight:bold;color:#333">📤 分享卡片</span>',
      '<button id="wallShareImgClose" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">&times;</button>',
      '</div>',
      '<div style="width:100%;text-align:center;font-size:12px;color:#999;margin-bottom:8px">长按图片保存 / 点击下方按钮</div>',
      '<img id="wallShareImgPreview" src="' + dataUrl + '" style="width:100%;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15)" />',
      '<div style="display:flex;gap:12px;margin-top:16px;width:100%">',
      '<button id="wallShareImgDownload" style="flex:1;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#FF6B2B,#FF8C42);color:#fff;font-size:15px;font-weight:bold;cursor:pointer">💾 保存图片</button>',
      '<button id="wallShareImgCopy" style="flex:1;padding:14px;border:2px solid #FF6B2B;border-radius:12px;background:#fff;color:#FF6B2B;font-size:15px;font-weight:bold;cursor:pointer">📋 复制图片</button>',
      '</div>',
      '<div style="margin-top:8px;font-size:11px;color:#BBB;text-align:center">保存后直接发送到 QQ / 微信 即可</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    document.getElementById('wallShareImgClose').onclick = function () { overlay.remove(); };
    document.getElementById('wallShareImgDownload').onclick = function () {
      var link = document.createElement('a');
      link.download = 'wall_post_' + post.id + '.png';
      link.href = dataUrl;
      link.click();
      if (typeof showToast === 'function') showToast('图片已保存，发送到QQ/微信即可');
    };
    document.getElementById('wallShareImgCopy').onclick = function () {
      try {
        canvas.toBlob(function (blob) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(function () {
              if (typeof showToast === 'function') showToast('图片已复制，粘贴到QQ/微信对话框即可');
            })
            .catch(function () {
              var link = document.createElement('a');
              link.download = 'wall_post_' + post.id + '.png';
              link.href = dataUrl;
              link.click();
              if (typeof showToast === 'function') showToast('已自动保存，请发送到QQ/微信');
            });
        }, 'image/png');
      } catch (e) {
        var link = document.createElement('a');
        link.download = 'wall_post_' + post.id + '.png';
        link.href = dataUrl;
        link.click();
        if (typeof showToast === 'function') showToast('已自动保存，请发送到QQ/微信');
      }
    };
  }

  // ─── 显示分享图片（智能路由：优先原生分享）──────────────
  async function showShareImageOverlay(post) {
    var old = document.getElementById('wallShareImgOverlay');
    if (old) old.remove();

    // 显示加载中
    var loading = document.createElement('div');
    loading.id = 'wallShareImgOverlay';
    loading.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s';
    loading.innerHTML = '<div style="background:#fff;border-radius:20px;padding:40px 60px;text-align:center"><div style="font-size:32px;margin-bottom:12px">🎨</div><div style="color:#333;font-size:15px;font-weight:500">正在生成分享图片...</div></div>';
    document.body.appendChild(loading);

    try {
      // 生成图片
      var canvas = drawWallShareImage(post);

      // 等待图片加载完成
      if (canvas._pendingImages && canvas._pendingImages.length) {
        await Promise.all(canvas._pendingImages);
      }

      // 移除加载中
      loading.remove();

    // 尝试原生分享（手机端一键直达QQ/微信）
      var shared = await nativeShare(canvas, post);
      if (shared) return;

      // 降级：显示弹窗（桌面端或不支持原生分享的手机）
      showShareImageFallback(canvas, post);
    } catch (e) {
      if (loading && loading.parentNode) loading.remove();
      console.error('Share image error:', e);
      if (typeof showToast === 'function') showToast('分享图片生成失败，请重试');
    }
  }

  // ─── 获取帖子数据并展示分享图片 ────────────────────────
  async function generateShareImage(postIdOrData) {
    var post;
    var postId;
    if (typeof postIdOrData === 'object') {
      post = postIdOrData;
      postId = post.id;
    } else {
      postId = postIdOrData;
      try {
        var res = await API.wallPostDetail(postIdOrData);
        post = res.post || res;
      } catch (e) {
        if (typeof showToast === 'function') showToast('获取帖子信息失败');
        return;
      }
    }

    // 计入分享数据
    if (postId && typeof API !== 'undefined' && API.wallSharePost) {
      API.wallSharePost(postId).catch(function () {});
    }

    showShareImageOverlay(post).catch(function(e) {
      console.error('Share overlay error:', e);
      // 降级：直接分享链接
      if (typeof showToast === 'function') showToast('图片生成失败，请重试');
    });
  }

  // ─── Exports ───────────────────────────────────────────
  window.showShareImageOverlay = showShareImageOverlay;
  window.generateShareImage = generateShareImage;
  window.drawWallShareImage = drawWallShareImage;

})();
