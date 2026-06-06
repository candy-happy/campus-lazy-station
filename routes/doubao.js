/**
 * routes/doubao.js - 豆包文生图代理路由
 * 
 * POST /api/ai/image/generate
 * Body: { prompt, size='512x512', n=1 }
 * Response: { urls: [...] }
 *
 * 环境变量: DOUBAO_API_KEY
 */

const express = require('express');
const router = express.Router();

const API_KEY = process.env.DOUBAO_API_KEY || '';
const MODEL = 'doubao-image-generation';

router.post('/generate', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'DOUBAO_API_KEY 未配置', code: 'AI_001' });
  }

  const { prompt, size = '512x512', n = 1 } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt 不能为空', code: 'AI_002' });
  }

  const payload = JSON.stringify({ model: MODEL, prompt, size, n, response_format: 'url' });

  try {
    const https = require('https');
    const urls = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'ark.cn-beijing.volces.com',
        path: '/api/v3/images/generations',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.data && Array.isArray(json.data)) {
              resolve(json.data.map(d => d.url).filter(Boolean));
            } else {
              reject(new Error('API返回格式异常: ' + data.substring(0, 200)));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    res.json({ urls });
  } catch (e) {
    console.error('[豆包文生图] 失败:', e.message);
    res.status(500).json({ error: '图片生成失败: ' + e.message, code: 'AI_003' });
  }
});

module.exports = router;
