// ===== ANKET MODÜLÜ ROUTER =====
// server.js'e mount edilir: app.use(require('./lib/surveys'));
// Kamusal form: GET/POST /a/:slug (login'siz)
// Admin: /api/admin/surveys* + /admin/surveys/* sayfaları
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../database');
const { isAdmin, isSenior } = require('./auth');
const { evaluationTemplateQuestions } = require('./post-event');

const router = express.Router();

// Upload kökü: /app/uploads/surveys (compose volume: sitoded_uploads:/app/uploads)
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const SURVEY_UPLOADS_ROOT = path.join(UPLOADS_ROOT, 'surveys');

// Boot'ta dizini oluştur (container yeniden başlasa da garanti olsun)
fs.mkdirSync(SURVEY_UPLOADS_ROOT, { recursive: true });

// Slug üretimi: 8 karakter URL-safe (base64url), UNIQUE çakışmasında retry
async function generateSlug() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = crypto.randomBytes(6).toString('base64url');
    const exists = await pool.query('SELECT 1 FROM surveys WHERE slug = $1', [slug]);
    if (exists.rows.length === 0) return slug;
  }
  throw new Error('Slug üretilemedi, tekrar deneyin');
}

// Anketin diskteki dosya klasörünü sil (anket/yanıt silme sonrası çağrılır)
async function removeSurveyFiles(surveyId) {
  const dir = path.join(SURVEY_UPLOADS_ROOT, String(surveyId));
  fs.rm(dir, { recursive: true, force: true }, (err) => {
    if (err) console.error(`Anket dosyaları silinemedi (survey ${surveyId}):`, err.message);
  });
}

// ===== ADMIN API: ANKET LİSTESİ =====
router.get('/api/admin/surveys', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.slug, s.status, s.collect_identity, s.created_at,
        (SELECT COUNT(*) FROM survey_responses r WHERE r.survey_id = s.id) as response_count,
        (SELECT COUNT(*) FROM survey_questions q WHERE q.survey_id = s.id) as question_count
      FROM surveys s
      ORDER BY s.created_at DESC
    `);
    res.json({ success: true, surveys: result.rows });
  } catch (err) {
    console.error('Anket listesi hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN API: YENİ ANKET =====
router.post('/api/admin/surveys', isAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Anket başlığı zorunludur' });
    }
    if (String(title).trim().length > 200) {
      return res.status(400).json({ success: false, error: 'Başlık en fazla 200 karakter olabilir' });
    }

    const slug = await generateSlug();
    const result = await pool.query(
      `INSERT INTO surveys (title, description, slug, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug`,
      [String(title).trim(), description || null, slug, req.user.id]
    );

    res.json({ success: true, message: 'Anket oluşturuldu', data: result.rows[0] });
  } catch (err) {
    console.error('Anket oluşturma hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN API: AÇ / KAPAT =====
router.post('/api/admin/surveys/:id/toggle', isAdmin, async (req, res) => {
  try {
    const { is_open } = req.body;
    const status = is_open ? 'OPEN' : 'CLOSED';
    const result = await pool.query(
      'UPDATE surveys SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Anket bulunamadı' });
    }
    res.json({ success: true, message: is_open ? 'Anket yayına açıldı' : 'Anket kapatıldı' });
  } catch (err) {
    console.error('Anket durum değiştirme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN API: ANKET SİL =====
router.post('/api/admin/surveys/:id/delete', isAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM surveys WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Anket bulunamadı' });
    }
    await removeSurveyFiles(req.params.id);
    res.json({ success: true, message: 'Anket silindi' });
  } catch (err) {
    console.error('Anket silme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== SORU TİPLERİ =====
const QUESTION_TYPES = ['TEXT_SHORT','TEXT_LONG','SINGLE_CHOICE','MULTI_CHOICE','DATE','NUMBER','PHOTO','VIDEO'];

// Anket + soruları çek (builder ve kamusal form ortak kullanır)
async function getSurveyWithQuestions(surveyId) {
  const surveyResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [surveyId]);
  if (surveyResult.rows.length === 0) return null;
  const questionsResult = await pool.query(
    'SELECT id, position, type, title, required, options FROM survey_questions WHERE survey_id = $1 ORDER BY position ASC',
    [surveyId]
  );
  return { survey: surveyResult.rows[0], questions: questionsResult.rows };
}

// ===== ADMIN: BUILDER SAYFASI =====
router.get('/admin/surveys/:id', isAdmin, async (req, res) => {
  try {
    const data = await getSurveyWithQuestions(req.params.id);
    if (!data) return res.status(404).render('errors/404');

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM survey_responses WHERE survey_id = $1',
      [req.params.id]
    );

    res.render('admin/survey_builder', {
      survey: data.survey,
      questions: data.questions,
      response_count: parseInt(countResult.rows[0].count),
      user: req.user
    });
  } catch (err) {
    console.error('Builder yükleme hatası:', err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== ADMIN API: ANKET + SORULAR (JSON) =====
router.get('/api/admin/surveys/:id/questions', isAdmin, async (req, res) => {
  try {
    const data = await getSurveyWithQuestions(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Anket bulunamadı' });

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM survey_responses WHERE survey_id = $1',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        survey: data.survey,
        questions: data.questions,
        response_count: parseInt(countResult.rows[0].count)
      }
    });
  } catch (err) {
    console.error('Soru yükleme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN API: ANKET KAYDET (başlık + kvkk + sorular) =====
router.post('/api/admin/surveys/:id/save', isAdmin, async (req, res) => {
  try {
    const surveyId = parseInt(req.params.id);
    const { title, description, kvkk_text, collect_identity, questions } = req.body;

    const surveyResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [surveyId]);
    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Anket bulunamadı' });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Anket başlığı zorunludur' });
    }
    if (!kvkk_text || !String(kvkk_text).trim()) {
      return res.status(400).json({ success: false, error: 'KVKK onam metni zorunludur' });
    }

    // Soru listesini doğrula
    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'Sorular listesi gerekli' });
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.type || !QUESTION_TYPES.includes(q.type)) {
        return res.status(400).json({ success: false, error: `Soru ${i + 1}: geçersiz tip` });
      }
      if (!q.title || !String(q.title).trim()) {
        return res.status(400).json({ success: false, error: `Soru ${i + 1}: soru metni zorunludur` });
      }
      if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE')) {
        const opts = Array.isArray(q.options) ? q.options.map(o => String(o).trim()).filter(Boolean) : [];
        if (opts.length < 2) {
          return res.status(400).json({ success: false, error: `Soru ${i + 1}: seçim tipi için en az 2 seçenek gerekli` });
        }
        q.options = opts;
      } else {
        q.options = [];
      }
      q.required = !!q.required;
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM survey_responses WHERE survey_id = $1',
      [surveyId]
    );
    const responseCount = parseInt(countResult.rows[0].count);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE surveys SET title = $1, description = $2, kvkk_text = $3, collect_identity = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
        [String(title).trim(), description || null, String(kvkk_text).trim(), !!collect_identity, surveyId]
      );

      // Yanıt varken sorular kilitli: yalnızca birebir aynı liste kabul edilir
      const existing = await client.query(
        'SELECT position, type, title, required, options FROM survey_questions WHERE survey_id = $1 ORDER BY position ASC',
        [surveyId]
      );

      if (responseCount > 0) {
        const normalizedNew = questions.map((q, i) => ({
          position: i, type: q.type, title: String(q.title).trim(), required: !!q.required, options: q.options
        }));
        const normalizedOld = existing.rows.map(q => ({
          position: q.position, type: q.type, title: q.title, required: q.required, options: q.options
        }));
        if (JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOld)) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: 'Bu ankete yanıt geldiği için sorular değiştirilemez. Yalnızca başlık/açıklama/KVKK metni güncellendi. Yeni sorular için yeni anket oluşturun.'
          });
        }
      } else {
        // Yanıt yok → soruları sil + yeniden ekle
        await client.query('DELETE FROM survey_questions WHERE survey_id = $1', [surveyId]);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await client.query(
            `INSERT INTO survey_questions (survey_id, position, type, title, required, options)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [surveyId, i, q.type, String(q.title).trim(), q.required, JSON.stringify(q.options)]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Anket kaydedildi', response_count: responseCount });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Anket kaydetme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ================================================================
// KAMUSAL ANKET FORMU — GET/POST /a/:slug (login'siz)
// ================================================================
const multer = require('multer');

const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/heic': '.heic', 'image/heif': '.heif',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
  'video/x-matroska': '.mkv'
};

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB (nginx 200M altında)
const MAX_FILES = 10;

// Basit per-IP rate limit (bellekte): 15 dk içinde en fazla 10 gönderim
const rateBuckets = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_MAX) return false;
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  return true;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(SURVEY_UPLOADS_ROOT, String(req.publicSurvey.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, crypto.randomBytes(8).toString('hex') + '.tmp')
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Yalnızca fotoğraf veya video yükleyebilirsiniz'));
  }
});

// Slug → anket çözümle (kamu ve API rotaları ortak kullanır)
async function loadPublicSurvey(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).render('errors/404');
    }
    req.publicSurvey = result.rows[0];
    next();
  } catch (err) {
    console.error('Anket yükleme hatası:', err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
}

async function loadPublicQuestions(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, position, type, title, required, options FROM survey_questions WHERE survey_id = $1 ORDER BY position ASC',
      [req.publicSurvey.id]
    );
    req.publicQuestions = result.rows;
    next();
  } catch (err) {
    console.error('Soru yükleme hatası:', err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
}

function cleanupFiles(files) {
  (files || []).forEach(f => {
    fs.rm(f.path, { force: true }, () => {});
  });
}

// Yüklenen dosyayı doğru uzantıyla yeniden adlandır
function finalizeFile(file) {
  const ext = MIME_EXT[file.mimetype] || '.bin';
  const finalName = crypto.randomBytes(8).toString('hex') + ext;
  const newPath = path.join(path.dirname(file.path), finalName);
  fs.renameSync(file.path, newPath);
  return { relativePath: 'surveys/' + path.basename(path.dirname(newPath)) + '/' + finalName, newPath };
}

router.get('/a/:slug', loadPublicSurvey, loadPublicQuestions, (req, res) => {
  const { survey, questions } = req.publicSurvey ? { survey: req.publicSurvey, questions: req.publicQuestions } : {};
  res.render('surveys/public', {
    survey,
    questions,
    done: req.query.done === '1',
    error: null,
    values: {}
  });
});

router.post('/a/:slug', loadPublicSurvey, loadPublicQuestions, (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      cleanupFiles(req.files);
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Dosya çok büyük (en fazla 150MB)'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'En fazla 10 dosya yükleyebilirsiniz'
          : (err.message || 'Dosya yükleme hatası');
      return res.render('surveys/public', {
        survey: req.publicSurvey, questions: req.publicQuestions, done: false, error: msg, values: req.body
      });
    }
    next();
  });
}, async (req, res) => {
  const survey = req.publicSurvey;
  const questions = req.publicQuestions;

  const renderError = async (msg) => {
    cleanupFiles(req.files);
    return res.render('surveys/public', {
      survey, questions, done: false, error: msg, values: req.body
    });
  };

  try {
    // Honeypot: botlar gizli alanı doldurur
    if (req.body.website) {
      return res.status(403).render('errors/404');
    }

    if (!checkRateLimit(req.ip)) {
      return await renderError('Çok fazla gönderim yaptınız. Lütfen 15 dakika sonra tekrar deneyin.');
    }

    // Kapalı anket → yanıt kabul edilmez
    if (survey.status !== 'OPEN') {
      return await renderError('Bu anket yanıtlara kapatıldı.');
    }

    // KVKK onamı zorunlu
    if (req.body.kvkk_consent !== 'on') {
      return await renderError('Anketi gönderebilmek için KVKK onam kutusunu işaretlemelisiniz.');
    }

    // Kimlik alanları
    const name = String(req.body.respondent_name || '').trim().slice(0, 120);
    const email = String(req.body.respondent_email || '').trim().slice(0, 120);
    if (survey.collect_identity && !name) {
      return await renderError('İsim soyisim alanı zorunludur.');
    }

    // Soru cevaplarını doğrula
    const answers = []; // {question_id, value, file|null}
    const filesByQuestion = {};
    (req.files || []).forEach(f => { filesByQuestion[f.fieldname] = f; });

    for (const q of questions) {
      const raw = req.body['q_' + q.id];
      const isFileType = q.type === 'PHOTO' || q.type === 'VIDEO';

      if (isFileType) {
        const file = filesByQuestion['q_' + q.id];
        if (q.required && !file) {
          return await renderError(`"${q.title}" sorusu zorunludur — bir dosya yükleyin.`);
        }
        if (file) {
          if (q.type === 'PHOTO' && !file.mimetype.startsWith('image/')) {
            return await renderError(`"${q.title}" için yalnızca fotoğraf yükleyebilirsiniz.`);
          }
          if (q.type === 'VIDEO' && !file.mimetype.startsWith('video/')) {
            return await renderError(`"${q.title}" için yalnızca video yükleyebilirsiniz.`);
          }
          answers.push({ question_id: q.id, value: null, file });
        } else if (!q.required) {
          answers.push({ question_id: q.id, value: null, file: null });
        }
        continue;
      }

      const value = raw == null ? '' : (Array.isArray(raw) ? raw : [String(raw)]).map(v => String(v).trim()).filter(Boolean);

      if (q.required && value.length === 0) {
        return await renderError(`"${q.title}" sorusu zorunludur.`);
      }

      if (value.length === 0) {
        answers.push({ question_id: q.id, value: null, file: null });
        continue;
      }

      switch (q.type) {
        case 'TEXT_SHORT':
          if (value[0].length > 500) return await renderError(`"${q.title}" çok uzun (en fazla 500 karakter).`);
          answers.push({ question_id: q.id, value: value[0], file: null });
          break;
        case 'TEXT_LONG':
          if (value[0].length > 5000) return await renderError(`"${q.title}" çok uzun (en fazla 5000 karakter).`);
          answers.push({ question_id: q.id, value: value[0], file: null });
          break;
        case 'SINGLE_CHOICE':
          if (!q.options.includes(value[0])) return await renderError(`"${q.title}" için geçersiz seçim.`);
          answers.push({ question_id: q.id, value: value[0], file: null });
          break;
        case 'MULTI_CHOICE': {
          const invalid = value.find(v => !q.options.includes(v));
          if (invalid) return await renderError(`"${q.title}" için geçersiz seçim.`);
          answers.push({ question_id: q.id, value: JSON.stringify(value), file: null });
          break;
        }
        case 'DATE':
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value[0]) || isNaN(new Date(value[0]).getTime())) {
            return await renderError(`"${q.title}" için geçerli bir tarih seçin.`);
          }
          answers.push({ question_id: q.id, value: value[0], file: null });
          break;
        case 'NUMBER':
          if (!/^-?\d+([.,]\d+)?$/.test(value[0])) return await renderError(`"${q.title}" için bir sayı girin.`);
          answers.push({ question_id: q.id, value: value[0], file: null });
          break;
        default:
          return await renderError('Geçersiz soru tipi.');
      }
    }

    // Dosyaları sonlandır + kayıtları yaz
    const fileRecords = answers.filter(a => a.file).map(a => {
      const { relativePath } = finalizeFile(a.file);
      return {
        question_id: a.question_id,
        value: null,
        file_path: relativePath,
        file_name: a.file.originalname,
        file_mime: a.file.mimetype,
        file_size: a.file.size
      };
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const respResult = await client.query(
        `INSERT INTO survey_responses (survey_id, respondent_name, respondent_email, kvkk_consent, ip_address)
         VALUES ($1, $2, $3, TRUE, $4)
         RETURNING id`,
        [survey.id, name || null, email || null, req.ip]
      );
      const responseId = respResult.rows[0].id;

      for (const a of answers) {
        if (a.file) {
          const rec = fileRecords.find(f => f.question_id === a.question_id);
          await client.query(
            `INSERT INTO survey_answers (response_id, question_id, value, file_path, file_name, file_mime, file_size)
             VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
            [responseId, a.question_id, rec.file_path, rec.file_name, rec.file_mime, rec.file_size]
          );
        } else {
          await client.query(
            'INSERT INTO survey_answers (response_id, question_id, value) VALUES ($1, $2, $3)',
            [responseId, a.question_id, a.value]
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // PRG: çift gönderimi önler
    res.redirect(`/a/${survey.slug}?done=1`);
  } catch (err) {
    console.error('Anket gönderim hatası:', err);
    cleanupFiles(req.files);
    res.status(500).render('errors/500', { message: 'Anket gönderilirken bir hata oluştu' });
  }
});

// ===== MEDIA: yüklenen dosyayı görüntüle (yalnızca ADMIN/SENIOR) =====
router.get('/api/surveys/media/:answerId', isSenior, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_path, file_mime, file_name FROM survey_answers WHERE id = $1',
      [req.params.answerId]
    );
    if (result.rows.length === 0 || !result.rows[0].file_path) {
      return res.status(404).render('errors/404');
    }
    const { file_path, file_mime, file_name } = result.rows[0];
    const abs = path.resolve(UPLOADS_ROOT, file_path);
    if (!abs.startsWith(UPLOADS_ROOT + path.sep)) {
      return res.status(403).render('errors/forbidden', { message: 'Geçersiz dosya yolu' });
    }
    res.setHeader('Content-Type', file_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file_name.replace(/"/g, '')}"`);
    res.sendFile(abs);
  } catch (err) {
    console.error('Medya görüntüleme hatası:', err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ================================================================
// YANITLAR + EXCEL EXPORT
// ================================================================

// Excel hücresi: formül enjeksiyonuna karşı = + - @ ile başlayan metne ' ön eki
function xl(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

router.get('/admin/surveys/:id/responses', isAdmin, async (req, res) => {
  try {
    const data = await getSurveyWithQuestions(req.params.id);
    if (!data) return res.status(404).render('errors/404');
    res.render('admin/survey_responses', {
      survey: data.survey,
      questions: data.questions,
      user: req.user
    });
  } catch (err) {
    console.error('Yanıtlar sayfası hatası:', err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

router.get('/api/admin/surveys/:id/responses', isAdmin, async (req, res) => {
  try {
    const surveyId = parseInt(req.params.id);
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const PAGE_SIZE = 20;

    const surveyResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [surveyId]);
    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Anket bulunamadı' });
    }

    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM survey_responses WHERE survey_id = $1',
      [surveyId]
    );
    const total = parseInt(totalResult.rows[0].count);

    const responsesResult = await pool.query(
      `SELECT r.*, a.id as answer_id, a.question_id, a.value, a.file_path, a.file_name, a.file_mime, a.file_size
       FROM survey_responses r
       LEFT JOIN survey_answers a ON a.response_id = r.id
       WHERE r.survey_id = $1
       ORDER BY r.submitted_at DESC, r.id DESC
       LIMIT $2 OFFSET $3`,
      [surveyId, PAGE_SIZE, page * PAGE_SIZE]
    );

    // Satırları yanıt bazında grupla
    const grouped = {};
    const order = [];
    for (const row of responsesResult.rows) {
      if (!grouped[row.id]) {
        grouped[row.id] = {
          id: row.id,
          respondent_name: row.respondent_name,
          respondent_email: row.respondent_email,
          kvkk_consent: row.kvkk_consent,
          submitted_at: row.submitted_at,
          answers: {}
        };
        order.push(row.id);
      }
      if (row.answer_id) {
        grouped[row.id].answers[row.question_id] = {
          answer_id: row.answer_id,
          value: row.value,
          file_path: row.file_path,
          file_name: row.file_name,
          file_mime: row.file_mime,
          file_size: row.file_size
        };
      }
    }

    res.json({
      success: true,
      responses: order.map(id => grouped[id]),
      total,
      page,
      page_size: PAGE_SIZE,
      has_more: (page + 1) * PAGE_SIZE < total
    });
  } catch (err) {
    console.error('Yanıt listesi hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.get('/api/admin/responses/:rid', isAdmin, async (req, res) => {
  try {
    const respResult = await pool.query(
      'SELECT * FROM survey_responses WHERE id = $1',
      [req.params.rid]
    );
    if (respResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Yanıt bulunamadı' });
    }
    const answersResult = await pool.query(
      `SELECT a.id, a.question_id, a.value, a.file_path, a.file_name, a.file_mime, a.file_size
       FROM survey_answers a WHERE a.response_id = $1`,
      [req.params.rid]
    );
    res.json({
      success: true,
      data: { response: respResult.rows[0], answers: answersResult.rows }
    });
  } catch (err) {
    console.error('Yanıt detay hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.post('/api/admin/responses/:rid/delete', isAdmin, async (req, res) => {
  try {
    const filesResult = await pool.query(
      'SELECT file_path FROM survey_answers WHERE response_id = $1 AND file_path IS NOT NULL',
      [req.params.rid]
    );
    const result = await pool.query(
      'DELETE FROM survey_responses WHERE id = $1 RETURNING id',
      [req.params.rid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Yanıt bulunamadı' });
    }
    // Dosyaları diskten sil (yol zaten bizim ürettiğimiz göreli yol)
    for (const f of filesResult.rows) {
      const abs = path.resolve(UPLOADS_ROOT, f.file_path);
      if (abs.startsWith(UPLOADS_ROOT + path.sep)) {
        fs.rm(abs, { force: true }, () => {});
      }
    }
    res.json({ success: true, message: 'Yanıt silindi' });
  } catch (err) {
    console.error('Yanıt silme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== EXCEL EXPORT =====
router.get('/api/admin/surveys/:id/export', isAdmin, async (req, res) => {
  try {
    const surveyId = parseInt(req.params.id);
    const data = await getSurveyWithQuestions(surveyId);
    if (!data) return res.status(404).render('errors/404');
    const { survey, questions } = data;

    const responsesResult = await pool.query(
      `SELECT r.*, a.question_id, a.value, a.file_path, a.file_name
       FROM survey_responses r
       LEFT JOIN survey_answers a ON a.response_id = r.id
       WHERE r.survey_id = $1
       ORDER BY r.submitted_at ASC, r.id ASC`,
      [surveyId]
    );

    const grouped = {};
    const order = [];
    for (const row of responsesResult.rows) {
      if (!grouped[row.id]) { grouped[row.id] = { response: row, answers: {} }; order.push(row.id); }
      if (row.question_id) grouped[row.id].answers[row.question_id] = row;
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Yanıtlar');

    const header = ['#', 'Tarih'];
    if (survey.collect_identity) header.push('İsim Soyisim', 'E-posta');
    header.push('KVKK Onayı');
    questions.forEach(q => header.push(q.title));
    sheet.addRow(header);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF86010' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    order.forEach((rid, i) => {
      const g = grouped[rid];
      const row = [i + 1, new Date(g.response.submitted_at).toLocaleString('tr-TR')];
      if (survey.collect_identity) row.push(xl(g.response.respondent_name), xl(g.response.respondent_email));
      row.push(g.response.kvkk_consent ? 'Onaylı' : 'Onaysız');
      questions.forEach(q => {
        const a = g.answers[q.id];
        if (!a) { row.push(''); return; }
        if (q.type === 'MULTI_CHOICE' && a.value) {
          try { row.push(xl(JSON.parse(a.value).join(', '))); } catch (e) { row.push(xl(a.value)); }
        } else if (q.type === 'PHOTO' || q.type === 'VIDEO') {
          row.push(xl(a.file_name || 'Dosya'));
        } else {
          row.push(xl(a.value));
        }
      });
      sheet.addRow(row);
    });

    sheet.columns.forEach(col => { col.width = 24; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="anket-${survey.slug}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export hatası:', err);
    res.status(500).render('errors/500', { message: 'Excel oluşturulurken bir hata oluştu' });
  }
});

// ===== ETKİNLİK DEĞERLENDİRME ANKETİ (hazır şablonla oluştur) =====
router.post('/api/admin/surveys/from-event', isAdmin, async (req, res) => {
  try {
    const { event_id } = req.body;
    const eventResult = await pool.query(
      'SELECT id, title, event_date FROM events WHERE id = $1',
      [event_id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etkinlik bulunamadı' });
    }
    const event = eventResult.rows[0];

    // Aynı etkinlik için zaten anket var mı?
    const dup = await pool.query('SELECT id FROM surveys WHERE event_id = $1', [event_id]);
    if (dup.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Bu etkinlik için değerlendirme anketi zaten var' });
    }

    const slug = await generateSlug();
    const dateStr = new Date(event.event_date).toISOString().slice(0, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const surv = await client.query(
        `INSERT INTO surveys (title, description, slug, status, collect_identity, event_id, created_by)
         VALUES ($1, $2, $3, 'CLOSED', FALSE, $4, $5)
         RETURNING id`,
        [`Etkinlik Değerlendirmesi: ${event.title}`, `${dateStr} tarihli etkinliğin katılımcı değerlendirmesi.`, slug, event_id, req.user.id]
      );
      const questions = evaluationTemplateQuestions();
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `INSERT INTO survey_questions (survey_id, position, type, title, required, options)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [surv.rows[0].id, i, q.type, q.title, q.required, JSON.stringify(q.options)]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'Değerlendirme anketi oluşturuldu', data: { id: surv.rows[0].id, slug } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Değerlendirme anketi oluşturma hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

module.exports = router;
