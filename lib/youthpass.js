// ===== YOUTHPASS MODÜLÜ =====
// Katılımcı öğrenme çıktılarını doldurur (profil), admin PDF sertifika üretir.
// PDF: pdfkit + DroidSans TTF (Türkçe karakter desteği için gömülü font şart).
const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const pool = require('../database');
const { isAdmin } = require('./auth');

const router = express.Router();

// 8 anahtar yeterlik (Youthpass çerçevesi) — TR etiketler
const COMPETENCES = [
  { key: 'communication', label: 'Ana Dilde İletişim' },
  { key: 'multilingual', label: 'Yabancı Dilde İletişim' },
  { key: 'math_science', label: 'Matematik, Fen ve Teknoloji' },
  { key: 'digital', label: 'Dijital Yeterlilik' },
  { key: 'personal', label: 'Kişisel, Sosyal ve Öğrenmeyi Öğrenme' },
  { key: 'citizenship', label: 'Vatandaşlık' },
  { key: 'entrepreneurship', label: 'Girişimcilik' },
  { key: 'cultural', label: 'Kültürel Farkındalık ve İfade' }
];

const FONT_REGULAR = path.join(__dirname, '..', 'public', 'fonts', 'DroidSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'public', 'fonts', 'DroidSans-Bold.ttf');

function toDateStr(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

// ===== KATILIMCI API: çıktıları gör / kaydet =====
router.get('/api/user/youthpass', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Giriş gerekli' });
  try {
    const result = await pool.query(
      'SELECT competence_key, outcome_text FROM youthpass_outcomes WHERE user_id = $1',
      [req.user.id]
    );
    const map = {};
    result.rows.forEach(r => { map[r.competence_key] = r.outcome_text; });
    res.json({ success: true, data: { competences: COMPETENCES, outcomes: map } });
  } catch (err) {
    console.error('Youthpass okuma hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.post('/api/user/youthpass', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Giriş gerekli' });
  try {
    const { outcomes } = req.body;
    if (!outcomes || typeof outcomes !== 'object') {
      return res.status(400).json({ success: false, error: 'Geçersiz veri' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const c of COMPETENCES) {
        const text = String(outcomes[c.key] || '').trim().slice(0, 2000);
        if (text) {
          await client.query(
            `INSERT INTO youthpass_outcomes (user_id, competence_key, outcome_text, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, competence_key) DO UPDATE SET outcome_text = $3, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, c.key, text]
          );
        } else {
          await client.query(
            'DELETE FROM youthpass_outcomes WHERE user_id = $1 AND competence_key = $2',
            [req.user.id, c.key]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'Öğrenme çıktıları kaydedildi' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Youthpass kaydetme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN: PDF ÜRETİMİ =====
router.get('/api/admin/youthpass/:userId.pdf', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userResult = await pool.query(
      'SELECT id, full_name, birth_date FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).render('errors/404');
    const user = userResult.rows[0];

    const outcomesResult = await pool.query(
      'SELECT competence_key, outcome_text FROM youthpass_outcomes WHERE user_id = $1',
      [userId]
    );
    const outcomes = {};
    outcomesResult.rows.forEach(r => { outcomes[r.competence_key] = r.outcome_text; });

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 55, right: 55 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="youthpass-${user.full_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
    doc.pipe(res);

    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold', FONT_BOLD);

    // Başlık bandı
    doc.rect(0, 0, doc.page.width, 110).fill('#f86010');
    doc.fill('#ffffff');
    doc.font('Bold').fontSize(30).text('Youthpass', 55, 38);
    doc.font('Regular').fontSize(11).text('Gençlik Programı Katılım Sertifikası', 55, 76);

    doc.fill('#1a1a22');
    doc.font('Bold').fontSize(18).text(user.full_name, 55, 145);
    doc.font('Regular').fontSize(11).fill('#555566')
      .text(`Doğum Tarihi: ${toDateStr(user.birth_date)}`, 55, 172)
      .text(`Düzenlenme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 55, 188)
      .text('Düzenleyen: SİTODED Erzurum', 55, 204);

    doc.moveDown(2);
    doc.font('Bold').fontSize(14).fill('#1a1a22').text('Öğrenme Çıktıları — 8 Anahtar Yeterlik', 55);
    doc.moveDown(0.5);

    let y = doc.y;
    const printed = COMPETENCES.filter(c => outcomes[c.key]);
    if (printed.length === 0) {
      doc.font('Regular').fontSize(11).fill('#555566')
        .text('Henüz öğrenme çıktısı girilmemiş. Katılımcı profilinden 8 anahtar yeterlik alanını doldurabilir.', 55, y);
    }
    for (const c of printed) {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      doc.font('Bold').fontSize(11).fill('#f86010').text(c.label, 55, y);
      y = doc.y + 4;
      doc.font('Regular').fontSize(10).fill('#333340').text(outcomes[c.key], 60, y, { width: doc.page.width - 115 });
      y = doc.y + 14;
    }

    // Alt imza bölümü
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.moveDown(2);
    doc.font('Regular').fontSize(10).fill('#555566')
      .text('Bu belge Youthpass sertifikasının dijital çıktısıdır. Resmi onay için SİTODED Erzurum yönetim kurulu imzası gereklidir.', 55)
      .moveDown(0.3)
      .text(`Sertifika No: YP-${user.id}-${new Date().getFullYear()}`);

    doc.end();
  } catch (err) {
    console.error('Youthpass PDF hatası:', err);
    res.status(500).render('errors/500', { message: 'PDF üretilirken bir hata oluştu' });
  }
});

module.exports = router;
module.exports.COMPETENCES = COMPETENCES;
