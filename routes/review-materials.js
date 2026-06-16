// routes/review-materials.js - 校园期末复习资料
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { error } = require('../utils/response');
const { withCompress } = require('../utils/upload');
const { compressFile } = require('../utils/compress');
const aiChecker = require('./ai');

// ─── 文件上传配置 ────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'review');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'review_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.rar', '.7z', '.txt', '.md', '.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('不支持的文件类型'));
  }
});

// ─── 用户端：获取已审核的复习资料列表 ──────────────
router.get('/', optionalAuth, (req, res) => {
  try {
    const { subject, page = 1, limit = 20, search } = req.query;
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (p - 1) * l;

    let where = "WHERE m.status = 'approved'";
    const params = [];

    if (subject) {
      where += " AND m.subject = ?";
      params.push(subject);
    }
    if (search) {
      where += " AND (m.title LIKE ? OR m.subject LIKE ? OR m.description LIKE ?)";
      const q = '%' + search + '%';
      params.push(q, q, q);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM review_materials m ${where}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const rows = db.prepare(`
      SELECT m.*, u.nickname, u.name, u.avatar
      FROM review_materials m
      LEFT JOIN users u ON m.uploader_phone = u.phone
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, l, offset);

    // 获取所有不重复的科目列表
    const subjects = db.prepare("SELECT DISTINCT subject FROM review_materials WHERE status='approved' ORDER BY subject").all();

    res.json({
      list: rows,
      total,
      page: p,
      hasMore: offset + l < total,
      subjects: subjects.map(s => s.subject)
    });
  } catch (e) {
    console.error('[复习资料] 列表查询失败:', e);
    error(res, 'SERVER_ERROR');
  }
});

// ─── 用户端：上传复习资料（待审核） ──────────────
router.post('/', optionalAuth, withCompress(upload.single('file')), async (req, res) => {
  try {
    const { subject, title, description, uploader_name } = req.body;
    const phone = req.user?.phone || '';
    const nickname = req.user?.nickname || req.user?.name || '';

    if (!subject || !title) {
      // 删除已上传的文件
      if (req.file) fs.unlinkSync(req.file.path);
      return error(res, 'PARAM_MISSING', '请填写科目和标题');
    }

    // AI审核资料标题和描述
    try {
      const aiResult = await aiChecker.checkTextContent(
        `资料标题：${title}\n科目：${subject}\n描述：${description || ''}`,
        '校园复习资料'
      );
      if (aiResult.violation && aiResult.level === 'high') {
        if (req.file) fs.unlinkSync(req.file.path);
        console.log(`[AI审核] 复习资料被拦截: title=${title}, level=${aiResult.level}, reason=${aiResult.reason}`);
        db.prepare(`INSERT INTO ai_review_logs (source, source_id, phone, content_preview, violation, level, category, reason, action)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          'review_material', 0, phone, title.slice(0, 200),
          aiResult.violation ? 1 : 0, aiResult.level, aiResult.category, aiResult.reason, 'block'
        );
        return error(res, 'AI_001', '资料内容不符合平台规范：' + (aiResult.reason || '请修改后重新提交'));
      }
    } catch (e) {
      console.error('[AI审核] 复习资料审核失败(放行):', e.message);
    }

    // 文件上传后自动压缩
    let fileUrl = req.file ? '/uploads/review/' + req.file.filename : '';
    let fileSize = req.file ? req.file.size : 0;
    if (req.file) {
      compressFile(req.file.path).then(r => {
        if (r.saved > 0) {
          console.log(`[复习资料] 压缩完成: ${path.basename(r.path)} -${(r.saved/1024).toFixed(1)}KB (${(r.originalSize/1024).toFixed(1)}→${(r.compressedSize/1024).toFixed(1)}KB)`);
          // 更新数据库中的文件大小
          db.prepare('UPDATE review_materials SET file_size=? WHERE file_url=?').run(r.compressedSize, fileUrl);
        }
      }).catch(e => console.error('[复习资料] 压缩失败:', e.message));
    }

    const result = db.prepare(`
      INSERT INTO review_materials (subject, title, description, file_url, file_size, uploader_name, uploader_phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now','localtime'))
    `).run(
      subject.trim().slice(0, 50),
      title.trim().slice(0, 100),
      (description || '').trim().slice(0, 500),
      fileUrl,
      fileSize,
      (uploader_name || nickname).trim().slice(0, 30),
      phone
    );

    res.json({ success: true, id: result.lastInsertRowid, message: '资料已提交，等待审核' });
  } catch (e) {
    console.error('[复习资料] 上传失败:', e);
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch(_) {} }
    error(res, 'SERVER_ERROR');
  }
});

// ─── 用户端：获取科目列表 ─────────────────────────
router.get('/subjects', optionalAuth, (req, res) => {
  try {
    const subjects = db.prepare("SELECT DISTINCT subject FROM review_materials WHERE status='approved' ORDER BY subject").all();
    res.json({ subjects: subjects.map(s => s.subject) });
  } catch (e) {
    error(res, 'SERVER_ERROR');
  }
});

// ─── 管理端：获取所有资料（含待审核） ────────────
router.get('/admin/list', requireAdmin, (req, res) => {
  try {
    const { status, subject, page = 1, limit = 20, search } = req.query;
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (p - 1) * l;

    let where = "WHERE 1=1";
    const params = [];

    if (status === 'pending') {
      where += " AND m.status = 'pending'";
    } else if (status === 'approved') {
      where += " AND m.status = 'approved'";
    } else if (status === 'rejected') {
      where += " AND m.status = 'rejected'";
    }
    if (subject) {
      where += " AND m.subject = ?";
      params.push(subject);
    }
    if (search) {
      where += " AND (m.title LIKE ? OR m.subject LIKE ? OR m.uploader_name LIKE ?)";
      const q = '%' + search + '%';
      params.push(q, q, q);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM review_materials m ${where}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const rows = db.prepare(`
      SELECT m.* 
      FROM review_materials m
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, l, offset);

    // 待审核数量
    const pendingCount = db.prepare("SELECT COUNT(*) as cnt FROM review_materials WHERE status='pending'").get();

    // 科目列表
    const subjects = db.prepare("SELECT DISTINCT subject FROM review_materials ORDER BY subject").all();

    res.json({
      list: rows,
      total,
      page: p,
      hasMore: offset + l < total,
      pendingCount: pendingCount ? pendingCount.cnt : 0,
      subjects: subjects.map(s => s.subject)
    });
  } catch (e) {
    console.error('[复习资料] 管理列表查询失败:', e);
    error(res, 'SERVER_ERROR');
  }
});

// ─── 管理端：直接添加资料（无需审核） ────────────
router.post('/admin', requireAdmin, withCompress(upload.single('file')), (req, res) => {
  try {
    const { subject, title, description } = req.body;

    if (!subject || !title) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch(_) {}
      return error(res, 'PARAM_MISSING', '请填写科目和标题');
    }

    // 管理员上传也自动压缩
    let fileUrl = req.file ? '/uploads/review/' + req.file.filename : '';
    let fileSize = req.file ? req.file.size : 0;
    if (req.file) {
      compressFile(req.file.path).then(r => {
        if (r.saved > 0) {
          console.log(`[复习资料] 压缩完成: ${path.basename(r.path)} -${(r.saved/1024).toFixed(1)}KB`);
          db.prepare('UPDATE review_materials SET file_size=? WHERE file_url=?').run(r.compressedSize, fileUrl);
        }
      }).catch(e => console.error('[复习资料] 压缩失败:', e.message));
    }

    const result = db.prepare(`
      INSERT INTO review_materials (subject, title, description, file_url, file_size, uploader_name, uploader_phone, status, created_at, approved_at)
      VALUES (?, ?, ?, ?, ?, '管理员', 'admin', 'approved', datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      subject.trim().slice(0, 50),
      title.trim().slice(0, 100),
      (description || '').trim().slice(0, 500),
      fileUrl,
      fileSize
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    console.error('[复习资料] 管理员添加失败:', e);
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch(_) {} }
    error(res, 'SERVER_ERROR');
  }
});

// ─── 管理端：审核通过 ─────────────────────────────
router.put('/:id/approve', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE review_materials SET status='approved', approved_at=datetime('now','localtime') WHERE id=?").run(id);
    res.json({ success: true });
  } catch (e) {
    console.error('[复习资料] 审核通过失败:', e);
    error(res, 'SERVER_ERROR');
  }
});

// ─── 管理端：审核拒绝 ─────────────────────────────
router.put('/:id/reject', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    db.prepare("UPDATE review_materials SET status='rejected', admin_remark=? WHERE id=?").run((remark || '').slice(0, 200), id);
    res.json({ success: true });
  } catch (e) {
    console.error('[复习资料] 审核拒绝失败:', e);
    error(res, 'SERVER_ERROR');
  }
});

// ─── 管理端：删除资料 ─────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare("SELECT file_url FROM review_materials WHERE id=?").get(id);
    if (row && row.file_url) {
      const fp = path.join(__dirname, '..', row.file_url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.prepare("DELETE FROM review_materials WHERE id=?").run(id);
    res.json({ success: true });
  } catch (e) {
    console.error('[复习资料] 删除失败:', e);
    error(res, 'SERVER_ERROR');
  }
});

// ─── 用户端：下载文件（触发浏览器下载） ──────────
router.get('/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT file_url, title FROM review_materials WHERE id=? AND status=?').get(id, 'approved');
    if (!row || !row.file_url) return error(res, 'NOT_FOUND', '资料不存在');

    const filePath = path.join(__dirname, '..', row.file_url);
    if (!fs.existsSync(filePath)) return error(res, 'NOT_FOUND', '文件不存在');

    // 增加下载计数
    db.prepare('UPDATE review_materials SET download_count = download_count + 1 WHERE id=?').run(id);

    // 强制下载（Content-Disposition: attachment）
    const ext = path.extname(row.file_url);
    const filename = row.title + ext;
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');
    res.sendFile(filePath);
  } catch (e) {
    console.error('[复习资料] 下载失败:', e);
    error(res, 'SERVER_ERROR');
  }
});

// ─── 用户端：增加下载计数（仅计数，不下载文件） ───
router.post('/:id/download', optionalAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE review_materials SET download_count = download_count + 1 WHERE id=?").run(id);
    res.json({ success: true });
  } catch (e) {
    error(res, 'SERVER_ERROR');
  }
});

module.exports = router;
