const pool = require('./database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...\n');

    // ===== TEAMS (upsert) =====
    const teams = [
      { name: 'Türkçe Eğitim Ekibi', description: 'Türkçe dil eğitimi ve kültür aktarımı' },
      { name: 'Organizasyon ve Sponsor Ekibi', description: 'Etkinlik organizasyonu ve sponsor yönetimi' },
      { name: 'Tarih Ekibi', description: 'Tarihsel araştırmalar ve uygulamalar' },
      { name: 'Sosyal Medya Ekibi', description: 'Sosyal medya yönetimi ve halkla iletişim' },
      { name: 'İngilizce Eğitim Ekibi', description: 'İngilizce dil eğitimi' },
      { name: 'Kültür Sanat Ekibi', description: 'Sanatsal aktiviteler ve kültürel etkinlikler' },
      { name: 'Etkinlik ve Sponsorluk', description: 'Etkinlik planlama ve sponsorluk' },
      { name: 'Dergi Ekibi', description: 'Dergi ve yayın yönetimi' },
      { name: 'Mental Sağlık Ekibi', description: 'Ruh sağlığı desteği ve farkındalık' },
      { name: 'Spor Ekibi', description: 'Spor aktiviteleri ve rekreasyon' }
    ];

    console.log('📚 Upserting teams...');
    const teamIds = {};
    for (const team of teams) {
      const result = await pool.query(
        `INSERT INTO teams (name, description) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [team.name, team.description]
      );
      teamIds[team.name] = result.rows[0].id;
      console.log(`  ✓ ${team.name}`);
    }

    // ===== USERS (upsert) =====
    console.log('\n👥 Upserting users...\n');

    const users = [
      {
        username: 'burakcan',
        email: 'burak@sitoded.jamcontest.com',
        full_name: 'Burak Can Tavukcu',
        password: 'asd123',
        hierarchy_level: 'PRESIDENT',
        role: 'ADMIN',
        teams: []
      },
      {
        username: 'ikbalAtaturk',
        email: 'ikbal@sitoded.org',
        full_name: 'Muhammed İkbal Atatürk',
        password: 'asd123',
        hierarchy_level: 'COORDINATOR',
        role: 'ADMIN',
        teams: ['Organizasyon ve Sponsor Ekibi']
      },
      {
        username: 'ayberk_oksuz',
        email: 'ayberk@sitoded.org',
        full_name: 'Ayberk Öksüz',
        password: 'asd123',
        hierarchy_level: 'SENIOR',
        role: 'SENIOR',
        teams: ['Türkçe Eğitim Ekibi', 'Kültür Sanat Ekibi']
      },
      {
        username: 'bugrahann_enes',
        email: 'bugrahann@sitoded.org',
        full_name: 'Buğrahan Enes Akçielik',
        password: 'asd123',
        hierarchy_level: 'SENIOR',
        role: 'SENIOR',
        teams: ['İngilizce Eğitim Ekibi', 'Sosyal Medya Ekibi']
      },
      {
        username: 'mehmet_junior_1',
        email: 'mehmet1@sitoded.org',
        full_name: 'Mehmet Yılmaz',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Türkçe Eğitim Ekibi']
      },
      {
        username: 'ayse_junior_2',
        email: 'ayse2@sitoded.org',
        full_name: 'Ayşe Kaya',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['İngilizce Eğitim Ekibi']
      },
      {
        username: 'ahmet_junior_3',
        email: 'ahmet3@sitoded.org',
        full_name: 'Ahmet Demir',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Sosyal Medya Ekibi']
      },
      {
        username: 'zeynep_junior_4',
        email: 'zeynep4@sitoded.org',
        full_name: 'Zeynep Çetin',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Kültür Sanat Ekibi']
      },
      {
        username: 'Can_volunteer',
        email: 'can@sitoded.org',
        full_name: 'Can Arslan',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Türkçe Eğitim Ekibi']
      },
      {
        username: 'fatma_volunteer',
        email: 'fatma@sitosed.org',
        full_name: 'Fatma Öz',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Spor Ekibi']
      },
      {
        username: 'ali_volunteer',
        email: 'ali@sitoded.org',
        full_name: 'Ali Kaliç',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: []
      },
      // 10 yeni kullanıcı ekleme
      {
        username: 'mehmet_senior_2',
        email: 'mehmet2@sitoded.org',
        full_name: 'Mehmet Yıldız',
        password: 'asd123',
        hierarchy_level: 'SENIOR',
        role: 'SENIOR',
        teams: ['Tarih Ekibi', 'Mental Sağlık Ekibi']
      },
      {
        username: 'aylin_senior_3',
        email: 'aylin3@sitoded.org',
        full_name: 'Aylin Güneş',
        password: 'asd123',
        hierarchy_level: 'SENIOR',
        role: 'SENIOR',
        teams: ['Dergi Ekibi', 'Spor Ekibi']
      },
      {
        username: 'burak_junior_5',
        email: 'burak5@sitoded.org',
        full_name: 'Burak Aydın',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Türkçe Eğitim Ekibi']
      },
      {
        username: 'deniz_junior_6',
        email: 'deniz6@sitoded.org',
        full_name: 'Deniz Akdeniz',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['İngilizce Eğitim Ekibi']
      },
      {
        username: 'elif_junior_7',
        email: 'elif7@sitoded.org',
        full_name: 'Elif Yıldırım',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Sosyal Medya Ekibi']
      },
      {
        username: 'fatih_junior_8',
        email: 'fatih8@sitoded.org',
        full_name: 'Fatih Kara',
        password: 'asd123',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Kültür Sanat Ekibi']
      },
      {
        username: 'gizem_volunteer_2',
        email: 'gizem2@sitoded.org',
        full_name: 'Gizem Beyaz',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Tarih Ekibi']
      },
      {
        username: 'hakan_volunteer_3',
        email: 'hakan3@sitoded.org',
        full_name: 'Hakan Yeşil',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Mental Sağlık Ekibi']
      },
      {
        username: 'irem_volunteer_4',
        email: 'irem4@sitoded.org',
        full_name: 'İrem Mavi',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Dergi Ekibi']
      },
      {
        username: 'jale_volunteer_5',
        email: 'jale5@sitoded.org',
        full_name: 'Jale Kırmızı',
        password: 'asd123',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Spor Ekibi']
      }
    ];

    const userIds = {};
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const result = await pool.query(
        `INSERT INTO users (username, email, full_name, password_hash, hierarchy_level, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           password_hash = EXCLUDED.password_hash,
           hierarchy_level = EXCLUDED.hierarchy_level,
           role = EXCLUDED.role
         RETURNING id`,
        [user.username, user.email, user.full_name, hashedPassword, user.hierarchy_level, user.role]
      );

      const userId = result.rows[0].id;
      userIds[user.username] = { id: userId, full_name: user.full_name };

      // Clear and re-add team memberships
      await pool.query('DELETE FROM user_teams WHERE user_id = $1', [userId]);
      for (const teamName of user.teams) {
        const teamId = teamIds[teamName];
        if (teamId) {
          await pool.query(
            'INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, teamId]
          );
        }
      }

      console.log(`  ✓ ${user.full_name} (${user.hierarchy_level})`);
    }

    // ===== TEAM LEADERS =====
    console.log('\n🎯 Setting team leaders...');
    const leaderMap = [
      ['ayberk_oksuz', 'Türkçe Eğitim Ekibi'],
      ['ayberk_oksuz', 'Kültür Sanat Ekibi'],
      ['bugrahann_enes', 'İngilizce Eğitim Ekibi'],
      ['bugrahann_enes', 'Sosyal Medya Ekibi'],
      ['ikbalAtaturk', 'Organizasyon ve Sponsor Ekibi'],
    ];
    for (const [username, teamName] of leaderMap) {
      await pool.query('UPDATE teams SET leader_id = $1 WHERE name = $2', [userIds[username].id, teamName]);
      console.log(`  ✓ ${userIds[username].full_name} → ${teamName}`);
    }

    // ===== EVENTS (temizle + yeniden ekle) =====
    console.log('\n📅 Refreshing events...');
    await pool.query("DELETE FROM event_registrations WHERE event_id IN (SELECT id FROM events WHERE status = 'ACTIVE')");
    await pool.query("DELETE FROM events WHERE status = 'ACTIVE'");

    const now = new Date();

    // Her zaman BİR SONRAKİ haftanın Pazartesi-Pazar aralığı
    const todayDay = now.getDay(); // 0=Pazar
    const daysUntilNextMonday = todayDay === 0 ? 1 : (8 - todayDay);
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilNextMonday);
    nextMonday.setHours(12, 0, 0, 0);

    // Deadline: bu haftanın Pazar 23:59 (bir sonraki hafta için kayıt kapanışı)
    const daysUntilThisSunday = todayDay === 0 ? 0 : (7 - todayDay);
    const thisSunday = new Date(now);
    thisSunday.setDate(now.getDate() + daysUntilThisSunday);
    thisSunday.setHours(23, 59, 59, 999);

    // Yardımcı: nextMonday'e N gün ekle
    const nextWeekDay = (offset) => {
      const d = new Date(nextMonday);
      d.setDate(nextMonday.getDate() + offset);
      return d;
    };

    const events = [
      // PAZARTESİ
      {
        title: 'Hafta Açılış Toplantısı',
        description: 'Haftanın planlaması ve ekip koordinasyonu.',
        location: 'Sitoded Merkez Ofis',
        event_date: nextWeekDay(0), // Pazartesi
        start_time: '10:00',
        end_time: '11:00',
        capacity: 40,
        team_id: teamIds['Organizasyon ve Sponsor Ekibi'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      {
        title: 'Tarih Semineri',
        description: 'Osmanlı tarihi üzerine sunum ve tartışma.',
        location: 'Erzurum Kongre Merkezi',
        event_date: nextWeekDay(0), // Pazartesi
        start_time: '14:00',
        end_time: '16:00',
        capacity: 20,
        team_id: teamIds['Tarih Ekibi'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      // SALI
      {
        title: 'Türkçe Konuşma Pratiği',
        description: 'Gönüllülerimiz için Türkçe konuşma pratikleri yapılacaktır.',
        location: 'Sitoded Merkez Ofis',
        event_date: nextWeekDay(1), // Salı
        start_time: '14:00',
        end_time: '15:30',
        capacity: 15,
        team_id: teamIds['Türkçe Eğitim Ekibi'],
        leader_id: userIds['ayberk_oksuz'].id
      },
      {
        title: 'Dergi Yazı Atölyesi',
        description: 'Aylık dergi için yazı hazırlama ve düzenleme.',
        location: 'Online - Google Meet',
        event_date: nextWeekDay(1), // Salı - ÇAKIŞAN: 14:30-15:30
        start_time: '14:30',
        end_time: '15:30',
        capacity: 10,
        team_id: teamIds['Dergi Ekibi'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      // ÇARŞAMBA
      {
        title: 'İngilizce Speaking Club',
        description: 'Günlük İngilizce konuşma pratiği ve tartışma.',
        location: 'Online - Zoom',
        event_date: nextWeekDay(2), // Çarşamba
        start_time: '18:00',
        end_time: '19:00',
        capacity: 20,
        team_id: teamIds['İngilizce Eğitim Ekibi'],
        leader_id: userIds['bugrahann_enes'].id
      },
      {
        title: 'Mental Sağlık Atölyesi',
        description: 'Stres yönetimi ve psikolojik dayanıklılık üzerine workshop.',
        location: 'Sitoded Merkez Ofis',
        event_date: nextWeekDay(2), // Çarşamba
        start_time: '15:00',
        end_time: '16:30',
        capacity: 12,
        team_id: teamIds['Mental Sağlık Ekibi'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      // PERŞEMBE
      {
        title: 'Kültürel Etkinlik - Geleneksel Sanatlar',
        description: 'Türk geleneksel sanatları tanıtılacaktır.',
        location: 'Erzurum Kültür Merkezi',
        event_date: nextWeekDay(3), // Perşembe
        start_time: '10:00',
        end_time: '12:00',
        capacity: 30,
        team_id: teamIds['Kültür Sanat Ekibi'],
        leader_id: userIds['ayberk_oksuz'].id
      },
      {
        title: 'Spor Günü - Basketbol',
        description: 'Haftalık spor aktivitesi, basketbol turnuvası.',
        location: 'Erzurum Spor Salonu',
        event_date: nextWeekDay(3), // Perşembe - ÇAKIŞAN: 11:00-13:00
        start_time: '11:00',
        end_time: '13:00',
        capacity: 16,
        team_id: teamIds['Spor Ekibi'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      // CUMA
      {
        title: 'Sosyal Medya Eğitimi',
        description: 'Sosyal medya platform yönetimi ve stratejileri hakkında eğitim.',
        location: 'Sitoded Merkez Ofis',
        event_date: nextWeekDay(4), // Cuma
        start_time: '15:00',
        end_time: '16:30',
        capacity: 25,
        team_id: teamIds['Sosyal Medya Ekibi'],
        leader_id: userIds['bugrahann_enes'].id
      },
      {
        title: 'İngilizce Gramer Çalışması',
        description: 'İleri seviye gramer konuları ve pratik alıştırmalar.',
        location: 'Online - Zoom',
        event_date: nextWeekDay(4), // Cuma - ÇAKIŞAN: 15:30-16:30
        start_time: '15:30',
        end_time: '16:30',
        capacity: 15,
        team_id: teamIds['İngilizce Eğitim Ekibi'],
        leader_id: userIds['bugrahann_enes'].id
      },
      // CUMARTESİ
      {
        title: 'Gönüllü Tanışma Kahvaltısı',
        description: 'Yeni gönüllülerle tanışma ve bilgilendirme etkinliği.',
        location: 'Erzurum Cafe Merkez',
        event_date: nextWeekDay(5), // Cumartesi
        start_time: '10:00',
        end_time: '12:00',
        capacity: 35,
        team_id: teamIds['Organizasyon ve Sponsor Ekibi'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      {
        title: 'Uzun Açıklamalı Demo Etkinlik',
        description: 'Bu etkinliğin amacı, dashboard ekranındaki grid düzeninin ve içerik dışa taşmalarının nasıl davrandığını test etmektir. ' +
                     'Açıklama metni olağanüstü derecede uzundur ve birden fazla satırda gösterilecek şekilde tasarlanmıştır. ' +
                     'Bu açıklamada etkileşim, planlama, metodoloji, sonuçlar, ileriye dönük adımlar, katılımcı sorumlulukları, ' +
                     'zaman çizelgesi, kaynak dağılımı, risk yönetimi, iletişim stratejileri ve geri bildirim döngüsü hakkında ayrıntılara girilecektir. ' +
                     'Bu sadece uzun metin testi için oluşturulmuş dummy bir paragraftır. Amaç: grid kartlarında satır yüksekliği ve taşma etkisini görmek. ' +
                     'Ayrıca, bu metin rüzgarlı bir günde bir dijital kampüste okunabilirlik testine de katkı sağlar. ' +
                     'Eğer bu metin tam görünmüyorsa, kart içeriğini kırparak veya bir ek popup penceresi açarak gösterim yapılabilir.',
        location: 'Sitoded Test Salonu',
        event_date: nextWeekDay(5), // Cumartesi
        start_time: '13:00',
        end_time: '16:00',
        capacity: 50,
        team_id: teamIds['Etkinlik ve Sponsorluk'],
        leader_id: userIds['ikbalAtaturk'].id
      },
      // Geçmiş etkinlik: 24 Mart Salı 19:00 - Yoklama testi için
      {
        title: 'Yoklama Test Etkinliği',
        description: 'Bu etkinlik yoklama sistemi test edilmesi için oluşturulmuştur. Tüm katılımcılar önceden kayıt yaptırmış ve etkinlik gerçekleşmiştir.',
        location: 'Sitoded Ana Salon',
        event_date: new Date('2026-03-24'), // Bugün: 24 Mart 2026 Salı
        start_time: '19:00',
        end_time: '21:00',
        capacity: 25,
        team_id: teamIds['Organizasyon ve Sponsor Ekibi'],
        leader_id: userIds['burakcan'].id // burakcan tarafından oluşturulmuş
      }
      // NOT: Pazar = deadline günü, etkinlik eklenmez
    ];

    const eventIds = [];
    for (const event of events) {
      const result = await pool.query(
        `INSERT INTO events (title, description, location, event_date, start_time, end_time, capacity, leader_id, team_id, registration_deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
         RETURNING id`,
        [event.title, event.description, event.location, event.event_date,
         event.start_time, event.end_time, event.capacity,
         event.leader_id, event.team_id, thisSunday]
      );
      eventIds.push(result.rows[0].id);
      console.log(`  ✓ ${event.title}`);
    }

    // ===== KATILIMCILAR EKLEME =====
    console.log('\n👥 Adding participants to past event...');
    const pastEventId = eventIds[eventIds.length - 1]; // Son etkinlik: Yoklama Test Etkinliği

    // İlk 20 kullanıcıyı al (10 eski + 10 yeni)
    const participantUsernames = [
      'burakcan', 'ikbalAtaturk', 'ayberk_oksuz', 'bugrahann_enes',
      'mehmet_junior_1', 'ayse_junior_2', 'ahmet_junior_3', 'zeynep_junior_4',
      'Can_volunteer', 'fatma_volunteer', 'ali_volunteer',
      'mehmet_senior_2', 'aylin_senior_3', 'burak_junior_5', 'deniz_junior_6',
      'elif_junior_7', 'fatih_junior_8', 'gizem_volunteer_2', 'hakan_volunteer_3',
      'irem_volunteer_4', 'jale_volunteer_5'
    ].slice(0, 20); // 20 kullanıcı

    for (const username of participantUsernames) {
      const userId = userIds[username].id;
      await pool.query(
        `INSERT INTO event_registrations (event_id, user_id, status, registered_at)
         VALUES ($1, $2, 'CONFIRMED', NOW())`,
        [pastEventId, userId]
      );
      console.log(`  ✓ ${userIds[username].full_name} registered for past event`);
    }

    console.log('\n✅ Seed tamamlandı!\n');
    console.log('🔐 Login Bilgileri:');
    console.log('  Başkan:      burakcan / asd123');
    console.log('  Koordinatör: ikbalAtaturk / asd123');
    console.log('  Senior:      ayberk_oksuz / asd123');
    console.log('  Senior:      bugrahann_enes / asd123\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed hatası:', err.message);
    process.exit(1);
  }
};

seedDatabase();
