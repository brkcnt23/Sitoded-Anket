// ===== ANASAYFA YARDIMCISI =====
// Gönüllülük başvuru anketi bağlantısı + idempotent anket oluşturma (boot'ta çağrılır).
const VOLUNTEER_SURVEY_SLUG = 'gonulluluk';

function volunteerSurveyUrl() {
  return '/a/' + VOLUNTEER_SURVEY_SLUG;
}

// Anket yoksa oluştur (OPEN + hazır sorular). Birden fazla çalıştırılsa bile tek anket kalır.
async function ensureVolunteerSurvey(pool) {
  try {
    const exists = await pool.query('SELECT 1 FROM surveys WHERE slug = $1', [VOLUNTEER_SURVEY_SLUG]);
    if (exists.rows.length > 0) return;

    const admin = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1");
    if (admin.rows.length === 0) {
      console.warn('[landing] Gönüllülük anketi oluşturulamadı: admin kullanıcı yok');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const surv = await client.query(
        `INSERT INTO surveys (title, description, slug, status, collect_identity, kvkk_text, created_by)
         VALUES ($1, $2, $3, 'OPEN', FALSE, $4, $5)
         RETURNING id`,
        [
          'SİTODED Yerel Gönüllü Başvuru Formu - 2026-27!!!',
          'SİTODED (Sivil Toplum Destekleme Derneği) 2006 Şubat\'ta kurulmuş; Erzurum merkezli, tamamı gönüllülerden oluşan yaklaşık 100 kişiyle faal bir dernektir. Faaliyet alanlarımız: Gençlik, Çocuklar, Engelliler, Kadınlar, Kültür-Turizm, Spor ve Çevre. Lütfen en az 1 yıl boyunca aktif olarak Erzurum\'da gönüllü olabilecekseniz formu doldurunuz! Yalnızca Erzurum\'da öğrenim gören veya ikamet eden kişilerin başvuruları değerlendirilecektir. Başvurular 11.10.2026 tarihine kadar açıktır; uygun adaylar 01.10.2026 tarihinden itibaren mülakata davet edilecektir. www.sitoded.org · @sitodederzurum',
          VOLUNTEER_SURVEY_SLUG,
          'KVKK kapsamında kişisel verilerimin SİTODED (Sivil Toplum Destekleme Derneği) tarafından işlenmesini, saklanmasını ve etkinliklerde alınan fotoğraf ve/veya video kayıtlarımın sosyal medya, rapor ve iletişim materyallerinde kullanılmasını kabul ediyorum.',
          admin.rows[0].id
        ]
      );

      const questions = [
        { type: 'TEXT_SHORT', title: 'Adınız Soyadınız', required: true, options: [] },
        { type: 'TEXT_SHORT', title: 'e-mail', required: true, options: [] },
        { type: 'TEXT_SHORT', title: 'Cep Telefonu', required: true, options: [] },
        { type: 'DATE', title: 'Doğum Tarihi', required: true, options: [] },
        { type: 'SINGLE_CHOICE', title: 'Cinsiyet', required: true, options: ['Kadın', 'Erkek'] },
        { type: 'TEXT_SHORT', title: 'Yaşadığınız Şehir', required: true, options: [] },
        { type: 'TEXT_SHORT', title: 'Mesleğiniz', required: true, options: [] },
        { type: 'TEXT_SHORT', title: 'Okuduğunuz/Bitirdiğiniz Okul (Lütfen devam ettiğiniz yada bitirdiğiniz okul adını tam yazınız!!!)', required: true, options: [] },
        { type: 'TEXT_SHORT', title: 'Bölüm - Sınıf', required: true, options: [] },
        { type: 'TEXT_SHORT', title: 'Yabancı dil bilgisi (Dil - Seviye) (Detaylı bilgi veriniz!!!)', required: true, options: [] },
        { type: 'TEXT_LONG', title: 'Neden SİTODED Yerel Gönüllüsü olmak istiyorsunuz?', required: true, options: [] },
        { type: 'SINGLE_CHOICE', title: 'Daha önce Gönüllülük yaptınız mı?', required: true, options: ['Evet', 'Hayır'] },
        { type: 'TEXT_LONG', title: 'Cevabınız evetse, bizimle deneyiminizi paylaşır mısınız? (Kurum, süre, devam edip etmediği, görevler, vb....)', required: false, options: [] },
        { type: 'MULTI_CHOICE', title: 'SİTODED Yerel Gönüllüsü olarak destek olabileceğiniz faaliyet alanları hangileridir? (En fazla 3 tane seçin)', required: true, options: ['Atölye / Eğitim çalışmaları planlama/uygulama', 'Dil Kursları planlama/uygulama', 'Tanıtım ve iletişim çalışmaları', 'Etkinlik/Organizasyon planlama/uygulama', 'Kaynak geliştirme ve bağış toplama / sponsorluk çalışmaları', 'Spor aktiviteleri planlama/uygulama', 'Diğer'] },
        { type: 'SINGLE_CHOICE', title: 'Bizi nereden duydunuz?', required: true, options: ['Sosyal Medya', 'İnternet Araması', 'Basın (TV, Gazete vb)', 'Arkadaşımdan', 'Diğer'] }
      ];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `INSERT INTO survey_questions (survey_id, position, type, title, required, options)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [surv.rows[0].id, i, q.type, q.title, q.required, JSON.stringify(q.options)]
        );
      }
      await client.query('COMMIT');
      console.log('[landing] Gönüllülük başvuru anketi oluşturuldu (slug: ' + VOLUNTEER_SURVEY_SLUG + ')');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[landing] Gönüllülük anketi oluşturma hatası:', err.message);
  }
}

module.exports = { VOLUNTEER_SURVEY_SLUG, volunteerSurveyUrl, ensureVolunteerSurvey };
