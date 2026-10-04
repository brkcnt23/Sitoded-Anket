// ===== ETKİNLİK SONRASI DEĞERLENDİRME ANKETİ (cron'suz, hesaplanmış) =====
// Etkinlik tarihi geçmiş, hâlâ ACTIVE ve değerlendirme anketi açılmamış etkinlikler = bekleyenler.
const pool = require('../database');

async function getPendingEvaluationEvents() {
  const result = await pool.query(`
    SELECT e.id, e.title, e.event_date, t.name as team_name,
           (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'CONFIRMED') as confirmed_count
    FROM events e
    JOIN teams t ON e.team_id = t.id
    WHERE e.event_date < CURRENT_DATE
      AND e.status = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM surveys s WHERE s.event_id = e.id)
    ORDER BY e.event_date DESC
  `);
  return result.rows;
}

// Kullanıcının katıldığı, değerlendirme anketi AÇIK olan son etkinlikler (dashboard bildirimi)
async function getOpenEvaluationSurveysForUser(userId) {
  const result = await pool.query(`
    SELECT DISTINCT s.id, s.slug, s.title, e.title as event_title, e.event_date
    FROM surveys s
    JOIN events e ON e.id = s.event_id
    JOIN event_registrations er ON er.event_id = e.id
    WHERE er.user_id = $1
      AND s.status = 'OPEN'
      AND e.event_date < CURRENT_DATE
    ORDER BY e.event_date DESC
    LIMIT 3
  `, [userId]);
  return result.rows;
}

// Değerlendirme anketi için hazır soru şablonu
function evaluationTemplateQuestions() {
  return [
    { type: 'SINGLE_CHOICE', title: 'Etkinlikten genel memnuniyetin?', required: true, options: ['Çok memnunum', 'Memnunum', 'Orta', 'Memnun değilim'] },
    { type: 'TEXT_LONG', title: 'Etkinliğin en iyi yanı neydi?', required: false, options: [] },
    { type: 'TEXT_LONG', title: 'Ne geliştirilebilir?', required: false, options: [] },
    { type: 'SINGLE_CHOICE', title: 'Gelecek etkinliklere katılmak ister misin?', required: true, options: ['Evet', 'Hayır', 'Belki'] },
    { type: 'PHOTO', title: 'Etkinlikten bir fotoğraf yükle (opsiyonel)', required: false, options: [] }
  ];
}

module.exports = { getPendingEvaluationEvents, getOpenEvaluationSurveysForUser, evaluationTemplateQuestions };
