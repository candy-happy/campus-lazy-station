// routes/gif.js - GIF/表情搜索路由（纯CSS动画贴纸）
const express = require('express');
const router = express.Router();

const GIF_COLLECTION = [
  { tags: ['hello','hi','wave','greeting','hey'], emoji: '👋', anim: 'wave', title: '打招呼' },
  { tags: ['thanks','thankyou','grateful'], emoji: '🙏', anim: 'bounce', title: '感谢' },
  { tags: ['happy','celebrate','yay','excited'], emoji: '🎉', anim: 'shake', title: '开心' },
  { tags: ['funny','laugh','lol'], emoji: '😂', anim: 'shake', title: '笑死' },
  { tags: ['cool','awesome','swag'], emoji: '😎', anim: 'bounce', title: '酷' },
  { tags: ['love','heart','romantic','kiss'], emoji: '❤️', anim: 'heartbeat', title: '爱' },
  { tags: ['sad','cry','tears'], emoji: '😭', anim: 'wave', title: '难过' },
  { tags: ['food','eating','pizza','hungry'], emoji: '🍔', anim: 'bounce', title: '吃货' },
  { tags: ['thumbsup','good','nice'], emoji: '👍', anim: 'bounce', title: '赞' },
  { tags: ['bye','goodbye','seeyou'], emoji: '👋', anim: 'wave', title: '再见' },
  { tags: ['wow','omg','surprise'], emoji: '🤯', anim: 'shake', title: '哇' },
  { tags: ['angry','mad','rage'], emoji: '😡', anim: 'shake', title: '生气' },
  { tags: ['sleep','tired','zzz'], emoji: '😴', anim: 'wave', title: '困' },
  { tags: ['dance','dancing','party'], emoji: '💃', anim: 'bounce', title: '跳舞' },
  { tags: ['cat','kitten','cute'], emoji: '🐱', anim: 'bounce', title: '喵' },
  { tags: ['dog','puppy','doggy'], emoji: '🐶', anim: 'bounce', title: '汪' },
  { tags: ['ok','yes','agree'], emoji: '👌', anim: 'bounce', title: 'OK' },
  { tags: ['fire','lit','hot'], emoji: '🔥', anim: 'shake', title: '火' },
  { tags: ['star','shine','sparkle'], emoji: '⭐', anim: 'bounce', title: '星' },
  { tags: ['flower','bloom','spring'], emoji: '🌸', anim: 'wave', title: '花' },
];

router.get('/search', (req, res) => {
  const q = (req.query.q || 'hello').toLowerCase();
  const matched = GIF_COLLECTION.filter(g => g.tags.some(t => t.includes(q) || q.includes(t)));
  const gifs = matched.length ? matched : GIF_COLLECTION.slice(0, 8);
  res.json({ gifs: gifs.map(g => ({ emoji: g.emoji, anim: g.anim, title: g.title, code: `[ANIM:${g.emoji}:${g.anim}]` })) });
});

module.exports = router;
