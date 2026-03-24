require('dotenv').config();
const pool = require('./database');

const events = [
  // Pazartesi 9 Mart (4 etkinlik)
  { title: 'Türkçe Konuşma Pratiği', desc: 'Günlük Türkçe konuşma pratikleri yapılacaktır', loc: 'Sitoded Merkez Ofis', date: '2026-03-09', start: '14:00', end: '15:30', cap: 15, lead: 2, team: 1 },
  { title: 'İngilizce Speaking Club', desc: 'Günlük İngilizce konuşma pratiği ve tartışma', loc: 'Online - Zoom', date: '2026-03-09', start: '15:00', end: '16:30', cap: 20, lead: 2, team: 2 },
  { title: 'Sosyal Medya Eğitimi', desc: 'Sosyal medya platform yönetimi ve stratejileri', loc: 'Sitoded Merkez Ofis', date: '2026-03-09', start: '17:00', end: '18:30', cap: 25, lead: 3, team: 3 },
  { title: 'Liderlik Geliştirme Atölyesi', desc: 'Liderlik becerilerini geliştirme semineri', loc: 'Erzurum Kültür Merkezi', date: '2026-03-09', start: '10:00', end: '12:00', cap: 30, lead: 4, team: 1 },

  // Salı 10 Mart (4 etkinlik - çakışan)
  { title: 'Grafik Tasarım Temelleri', desc: 'Grafik tasarım temel prensipleri', loc: 'Online - Zoom', date: '2026-03-10', start: '10:00', end: '11:30', cap: 15, lead: 2, team: 2 },
  { title: 'İçerik Yazarlığı Atölyesi', desc: 'Etkili içerik yazarlığı teknikleri', loc: 'Sitoded Merkez Ofis', date: '2026-03-10', start: '10:30', end: '12:00', cap: 12, lead: 3, team: 3 },
  { title: 'Fotoğrafçılık Grundlagen', desc: 'Temel fotoğrafçılık tekniklerini öğrenin', loc: 'Erzurum Merkez', date: '2026-03-10', start: '15:00', end: '16:45', cap: 10, lead: 4, team: 1 },
  { title: 'Web Geliştirme 101', desc: 'Web geliştirmeye giriş', loc: 'Online', date: '2026-03-10', start: '18:00', end: '19:30', cap: 20, lead: 2, team: 2 },

  // Çarşamba 11 Mart (4 etkinlik - çakışan)
  { title: 'Kültürel Etkinlik - Geleneksel Sanatlar', desc: 'Türk geleneksel sanatları tanıtımı', loc: 'Erzurum Kültür Merkezi', date: '2026-03-11', start: '10:00', end: '12:00', cap: 30, lead: 3, team: 3 },
  { title: 'Sağlık ve Wellness Semineri', desc: 'Sağlıklı yaşam prensipleri', loc: 'Sitoded Merkez Ofis', date: '2026-03-11', start: '10:30', end: '11:45', cap: 20, lead: 4, team: 1 },
  { title: 'Proje Yönetimi Kursu', desc: 'Proje yönetimi temel kuralları', loc: 'Online - Zoom', date: '2026-03-11', start: '14:00', end: '15:30', cap: 15, lead: 2, team: 2 },
  { title: 'Sanat Tarihi Sunumu', desc: 'Sanat tarihi ve evrimi', loc: 'Erzurum Müzesi', date: '2026-03-11', start: '16:00', end: '17:30', cap: 25, lead: 3, team: 3 },

  // Perşembe 12 Mart (3 etkinlik)
  { title: 'Pazarlama Stratejileri Atölyesi', desc: 'Etkili pazarlama yöntemleri', loc: 'Sitoded Merkez Ofis', date: '2026-03-12', start: '09:00', end: '10:30', cap: 18, lead: 2, team: 1 },
  { title: 'Yapay Zeka ve Teknoloji Semineri', desc: 'AI ve makine öğrenmesi giriş', loc: 'Online', date: '2026-03-12', start: '13:00', end: '14:45', cap: 22, lead: 4, team: 2 },
  { title: 'Girişimcilik Danışmalığı', desc: 'Kendi işini başlatmanın adımları', loc: 'Erzurum Ticaret Odası', date: '2026-03-12', start: '15:30', end: '17:00', cap: 20, lead: 3, team: 3 },

  // Cuma 13 Mart (3 etkinlik)
  { title: 'Müzik ve Sanat Etkinliği', desc: 'Canlı müzik performansı', loc: 'Sitoded Merkez Ofis', date: '2026-03-13', start: '10:00', end: '11:45', cap: 40, lead: 2, team: 1 },
  { title: 'Çevre Bilinci Kampanyası', desc: 'Çevre koruma ve sürdürülebilirlik', loc: 'Erzurum Şehir Parkı', date: '2026-03-13', start: '14:00', end: '15:30', cap: 35, lead: 3, team: 2 },
  { title: 'Dijital Pazarlama Makinası', desc: 'SEO ve SEM stratejileri', loc: 'Online - Zoom', date: '2026-03-13', start: '18:00', end: '19:30', cap: 16, lead: 4, team: 3 },

  // Cumartesi 14 Mart (2 etkinlik)
  { title: 'Spor ve Fitness Günü', desc: 'Grup antrenmanı ve fitness sesi', loc: 'Erzurum Spor Kompleksi', date: '2026-03-14', start: '09:00', end: '10:30', cap: 50, lead: 2, team: 1 },
  { title: 'Gıda Güvenliği Eğitimi', desc: 'Gıda güvenliği protokolleri', loc: 'Sitoded Merkez Ofis', date: '2026-03-14', start: '15:00', end: '16:30', cap: 12, lead: 3, team: 2 },

  // Pazar 15 Mart (1 etkinlik)
  { title: 'Haftalık Değerlendirme Toplantısı', desc: 'Haftanın değerlendirmesi ve geri bildirim', loc: 'Sitoded Merkez Ofis', date: '2026-03-15', start: '11:00', end: '12:30', cap: 100, lead: 4, team: 1 }
];

async function addEvents() {
  try {
    console.log(`📝 ${events.length} etkinlik ekleniyor...`);
    
    for (const event of events) {
      const deadline = new Date('2026-03-08');
      deadline.setHours(23, 59, 59, 999);
      
      await pool.query(
        `INSERT INTO events (title, description, location, event_date, start_time, end_time, capacity, leader_id, team_id, registration_deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')`,
        [event.title, event.desc, event.loc, event.date, event.start, event.end, event.cap, event.lead, event.team, deadline]
      );
      
      console.log(`✅ ${event.title} (${event.date} ${event.start}-${event.end})`);
    }
    
    console.log(`\n✨ Tüm etkinlikler başarıyla eklendi!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  }
}

addEvents();
