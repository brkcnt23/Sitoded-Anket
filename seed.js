const pool = require('./database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...\n');

    // ===== TEAMS =====
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

    console.log('📚 Creating teams...');
    const teamIds = {};
    for (const team of teams) {
      const result = await pool.query(
        'INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING id',
        [team.name, team.description]
      );
      teamIds[team.name] = result.rows[0].id;
      console.log(`  ✓ ${team.name}`);
    }

    // ===== USERS =====
    console.log('\n👥 Creating users...\n');

    const users = [
      // BAŞKAN
      {
        username: 'nuriye_memisoglu',
        email: 'nuriye@sitoded.org',
        full_name: 'Nuriye Memişoğlu',
        password: 'Sitoded2026!',
        hierarchy_level: 'PRESIDENT',
        role: 'ADMIN',
        teams: []
      },
      // KOORDİNATÖR
      {
        username: 'kadir_ergun',
        email: 'kadir@sitoded.org',
        full_name: 'Kadir Ergün',
        password: 'Sitoded2026!',
        hierarchy_level: 'COORDINATOR',
        role: 'SENIOR',
        teams: ['Organizasyon ve Sponsor Ekibi']
      },
      // SENİORLAR
      {
        username: 'ayberk_oksuz',
        email: 'ayberk@sitoded.org',
        full_name: 'Ayberk Öksüz',
        password: 'Sitoded2026!',
        hierarchy_level: 'SENIOR',
        role: 'SENIOR',
        teams: ['Türkçe Eğitim Ekibi', 'Kültür Sanat Ekibi']
      },
      {
        username: 'bugrahann_enes',
        email: 'bugrahann@sitoded.org',
        full_name: 'Buğrahan Enes Akçielik',
        password: 'Sitoded2026!',
        hierarchy_level: 'SENIOR',
        role: 'SENIOR',
        teams: ['İngilizce Eğitim Ekibi', 'Sosyal Medya Ekibi']
      },
      // JUNİORLAR (Body olacaklar)
      {
        username: 'mehmet_junior_1',
        email: 'mehmet1@sitoded.org',
        full_name: 'Mehmet Yılmaz',
        password: 'Sitoded2026!',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Türkçe Eğitim Ekibi']
      },
      {
        username: 'ayse_junior_2',
        email: 'ayse2@sitoded.org',
        full_name: 'Ayşe Kaya',
        password: 'Sitoded2026!',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['İngilizce Eğitim Ekibi']
      },
      {
        username: 'ahmet_junior_3',
        email: 'ahmet3@sitoded.org',
        full_name: 'Ahmet Demir',
        password: 'Sitoded2026!',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Sosyal Medya Ekibi']
      },
      {
        username: 'zeynep_junior_4',
        email: 'zeynep4@sitoded.org',
        full_name: 'Zeynep Çetin',
        password: 'Sitoded2026!',
        hierarchy_level: 'JUNIOR',
        role: 'JUNIOR',
        teams: ['Kültür Sanat Ekibi']
      },
      // GÖNÜLLÜLER (Volunteer)
      {
        username: 'Can_volunteer',
        email: 'can@sitoded.org',
        full_name: 'Can Arslan',
        password: 'Sitoded2026!',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Türkçe Eğitim Ekibi']
      },
      {
        username: 'fatma_volunteer',
        email: 'fatma@sitosed.org',
        full_name: 'Fatma Öz',
        password: 'Sitoded2026!',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: ['Spor Ekibi']
      },
      {
        username: 'ali_volunteer',
        email: 'ali@sitoded.org',
        full_name: 'Ali Kaliç',
        password: 'Sitoded2026!',
        hierarchy_level: 'VOLUNTEER',
        role: 'VOLUNTEER',
        teams: []
      }
    ];

    const userIds = {};
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const result = await pool.query(
        `INSERT INTO users (username, email, full_name, password_hash, hierarchy_level, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [user.username, user.email, user.full_name, hashedPassword, user.hierarchy_level, user.role]
      );

      const userId = result.rows[0].id;
      userIds[user.username] = { id: userId, full_name: user.full_name };

      // Add teams
      for (const teamName of user.teams) {
        const teamId = teamIds[teamName];
        if (teamId) {
          await pool.query(
            'INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2)',
            [userId, teamId]
          );
        }
      }

      console.log(`  ✓ ${user.full_name} (${user.hierarchy_level})`);
    }

    // ===== UPDATE TEAM LEADERS =====
    console.log('\n🎯 Setting team leaders...');
    await pool.query(
      'UPDATE teams SET leader_id = $1 WHERE name = $2',
      [userIds['ayberk_oksuz'].id, 'Türkçe Eğitim Ekibi']
    );
    console.log('  ✓ Ayberk Öksüz → Türkçe Eğitim Ekibi');

    await pool.query(
      'UPDATE teams SET leader_id = $1 WHERE name = $2',
      [userIds['ayberk_oksuz'].id, 'Kültür Sanat Ekibi']
    );
    console.log('  ✓ Ayberk Öksüz → Kültür Sanat Ekibi');

    await pool.query(
      'UPDATE teams SET leader_id = $1 WHERE name = $2',
      [userIds['bugrahann_enes'].id, 'İngilizce Eğitim Ekibi']
    );
    console.log('  ✓ Buğrahan Enes Akçielik → İngilizce Eğitim Ekibi');

    await pool.query(
      'UPDATE teams SET leader_id = $1 WHERE name = $2',
      [userIds['bugrahann_enes'].id, 'Sosyal Medya Ekibi']
    );
    console.log('  ✓ Buğrahan Enes Akçielik → Sosyal Medya Ekibi');

    await pool.query(
      'UPDATE teams SET leader_id = $1 WHERE name = $2',
      [userIds['kadir_ergun'].id, 'Organizasyon ve Sponsor Ekibi']
    );
    console.log('  ✓ Kadir Ergün → Organizasyon ve Sponsor Ekibi');

    // ===== SAMPLE EVENTS =====
    console.log('\n📅 Creating sample events...');
    
    const now = new Date();
    const nextSunday = new Date(now);
    const daysUntilSunday = (6 - now.getDay()) % 7 || 7;
    nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);

    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 7); // Yarından 7 gün sonra
    eventDate.setHours(14, 0, 0, 0);

    const events = [
      {
        title: 'Türkçe Konuşma Pratiği',
        description: 'Gönüllülerimiz için Türkçe konuşma pratikleri yapılacaktır.',
        location: 'Sitoded Merkez Ofis',
        event_date: eventDate,
        capacity: 15,
        team_id: teamIds['Türkçe Eğitim Ekibi'],
        leader_id: userIds['ayberk_oksuz'].id
      },
      {
        title: 'İngilizce Speaking Club',
        description: 'Günlük İngilizce konuşma pratiği ve tartışma.',
        location: 'Online - Zoom',
        event_date: new Date(eventDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        capacity: 20,
        team_id: teamIds['İngilizce Eğitim Ekibi'],
        leader_id: userIds['bugrahann_enes'].id
      },
      {
        title: 'Kültürel Etkinlik - Geleneksel Sanatlar',
        description: 'Türk geleneksel sanatlarının tanıtılır.',
        location: 'Erzurum Kültür Merkezi',
        event_date: new Date(eventDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        capacity: 30,
        team_id: teamIds['Kültür Sanat Ekibi'],
        leader_id: userIds['ayberk_oksuz'].id
      },
      {
        title: 'Sosyal Medya Eğitimi',
        description: 'Sosyal medya platform yönetimi ve stratejileri hakkında eğitim.',
        location: 'Sitoded Merkez Ofis',
        event_date: new Date(eventDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        capacity: 25,
        team_id: teamIds['Sosyal Medya Ekibi'],
        leader_id: userIds['bugrahann_enes'].id
      }
    ];

    for (const event of events) {
      await pool.query(
        `INSERT INTO events (title, description, location, event_date, capacity, leader_id, team_id, registration_deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')`,
        [event.title, event.description, event.location, event.event_date, event.capacity, event.leader_id, event.team_id, nextSunday]
      );
      console.log(`  ✓ ${event.title}`);
    }

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  • ${Object.keys(teamIds).length} teams created`);
    console.log(`  • ${Object.keys(userIds).length} users created`);
    console.log(`  • ${events.length} sample events created\n`);

    console.log('🔐 Varsayılan Login Bilgileri:');
    console.log('  Başkan: nuriye_memisoglu / Sitoded2026!');
    console.log('  Koordinatör: kadir_ergun / Sitoded2026!');
    console.log('  Senior: ayberk_oksuz / Sitoded2026!');
    console.log('  Senior: bugrahann_enes / Sitoded2026!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

seedDatabase();
