// ===== ŞİKAYET & ÖNERİ — ADMIN TARAFI =====
const express = require('express');
const pool = require('../database');
const { isAdmin } = require('./auth');

const router = express.Router();

// Liste (opsiyonel ?status= filtresi)
router.get('/api/admin/feedback', isAdmin, async (req, res) => {
  try {
    const status = ['NEW', 'READ', 'DONE'].includes(req.query.status) ? req.query.status : null;
    const result = await pool.query(
      `SELECT f.*, u.full_name, u.username
       FROM feedback f
       LEFT JOIN users u ON u.id = f.user_id
       ${status ? 'WHERE f.status = $1' : ''}
       ORDER BY f.created_at DESC
       LIMIT 200`,
      status ? [status] : []
    );
    res.json({
      success: true,
      // Anonim gönderimlerde kimlik admin'e de görünmez (yalnız "Anonim" ibaresi UI'da çıkar).
      feedback: result.rows.map((f) => f.is_anonymous ? { ...f, full_name: null, username: null } : f)
    });
  } catch (err) {
    console.error('Feedback liste hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// Durum değiştir (NEW → READ → DONE)
router.post('/api/admin/feedback/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['NEW', 'READ', 'DONE'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Geçersiz durum' });
    }
    const result = await pool.query(
      'UPDATE feedback SET status = $1 WHERE id = $2 RETURNING id',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    res.json({ success: true, message: 'Durum güncellendi' });
  } catch (err) {
    console.error('Feedback durum hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// Sil
router.post('/api/admin/feedback/:id/delete', isAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM feedback WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    res.json({ success: true, message: 'Silindi' });
  } catch (err) {
    console.error('Feedback silme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

module.exports = router;
