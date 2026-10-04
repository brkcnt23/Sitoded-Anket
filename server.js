process.env.TZ = 'Europe/Istanbul'; // tüm zaman hesapları TR duvar saatiyle
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const pool = require('./database');
const { lastSundayStrictlyBefore, candidateSlots, closeTime, nextOpeningTime } = require('./lib/opening');
const QRCode = require('qrcode');
const { markAttendance, createAttendanceToken, consumeAttendanceToken } = require('./lib/attendance');
const { getPendingEvaluationEvents, getOpenEvaluationSurveysForUser, evaluationTemplateQuestions } = require('./lib/post-event');

const app = express();

// Trust nginx reverse proxy (HTTPS detection)
app.set('trust proxy', 1);

// ===== SECURITY MIDDLEWARE =====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"]
    }
  }
}));  
app.use(cors());

// ===== VIEW ENGINE =====
app.set('view engine', 'ejs');
app.set('views', './views');

// ===== STATIC FILES =====
app.use(express.static('public'));

// ===== BODY PARSER =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===== SESSION & PASSPORT =====
// Oturumlar Postgres'te tutulur (connect-pg-simple) → deploy/restart'ta oturumlar düşmez.
const pgSession = require('connect-pg-simple')(session);

app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

// ===== ANKET MODÜLÜ =====
app.use(require('./lib/surveys'));

// ===== RAPOR MERKEZİ + DERBİS =====
app.use(require('./lib/reports'));

// ===== YOUTHPASS =====
app.use(require('./lib/youthpass'));

// ===== ŞİKAYET & ÖNERİ (admin) =====
app.use(require('./lib/feedback'));

// ===== PASSPORT STRATEGY =====
passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username, password, done) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];

      if (!user) {
        return done(null, false, { message: 'Kullanıcı bulunamadı' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return done(null, false, { message: 'Şifre yanlış' });
      }

      return done(null, user);
    } catch (err) {
      console.error('Login error:', err.message);
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    console.error('Deserialization error:', err.message);
    done(err);
  }
});

// ===== MIDDLEWARE (lib/auth.js'te ortak) =====
const { isAuthenticated, isAdmin, isSenior, isAdminOrEventLeader } = require('./lib/auth');

// ===== UTILITY FUNCTIONS =====
const isDeadlinePassed = (deadline) => new Date() > new Date(deadline);

// Boş form alanlarını NULL'a çevir (opsiyonel tarih/metin kolonları)
const orNull = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

// UTC kayması olmadan yerel tarih string'i
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Gelecek haftanın menzili: [gelecek Pzt 00:00, gelecek Paz 23:59]
const nextWeekRange = (now = new Date()) => {
  const day = now.getDay(); // 0=Pazar
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + (day === 0 ? 1 : 8 - day));
  nextMonday.setHours(0, 0, 0, 0);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);
  return { nextMonday, nextSunday };
};

// Admin paneli için hesaplanmış etkinlik durumu
const computedEventStatus = (e, now = new Date()) => {
  if (e.status === 'CANCELLED') return 'IPTAL';
  const evEnd = new Date(`${toLocalDateStr(e.event_date)}T23:59:59`);
  if (now > evEnd) return 'GECMIS';
  const open = e.registration_open ? new Date(e.registration_open) : null;
  const close = e.registration_deadline ? new Date(e.registration_deadline) : null;
  if (open && now < open) return 'BEKLIYOR';
  if (close && now <= close) return 'ACIK';
  return 'KAPANDI';
};

// ===== ROUTES =====

// Public home remains accessible to signed-in members too.
app.get('/', (req, res) => {
  res.render('landing', { ...require('./lib/public-site').publicLocals(req, 'home'), surveyUrl: require('./lib/landing').volunteerSurveyUrl() });
});

app.get('/hakkimizda', (req, res) => res.render('public/about', require('./lib/public-site').publicLocals(req, 'about')));
app.get('/cop31', (req, res) => res.render('public/cop31', require('./lib/public-site').publicLocals(req, 'cop31')));
// Public archive is stored locally; rendering never depends on the old website.
const { publicLocals, archive } = require('./lib/public-site');
app.get('/iletisim', (req,res)=>res.render('public/contact',publicLocals(req,'contact')));
app.get('/calisma-alanlari/:area?', (req,res,next)=>{
  const locals=publicLocals(req,'work'); const area=locals.areas.find(a=>a[0]===req.params.area);
  if(req.params.area&&!area) return next();
  res.render('public/work',{...locals,area});
});
app.get('/projeler/:slug?', (req,res,next)=>{
  const locals=publicLocals(req,'projects'); const slug=req.params.slug;
  if(!slug||Object.hasOwn(locals.categories,slug)) return res.render('public/projects',{...locals,category:slug||null});
  const item=archive.projects.find(p=>p.slug===slug); if(!item) return next();
  res.render('public/detail',{...locals,item,isNews:false,title:item.title+' — SİTODED'});
});
app.get('/haberler/:slug?', (req,res,next)=>{
  const locals=publicLocals(req,'news');
  if(!req.params.slug) return res.render('public/news',locals);
  const item=archive.news.find(n=>n.slug===req.params.slug); if(!item) return next();
  res.render('public/detail',{...locals,item,isNews:true,title:item.title+' — SİTODED'});
});


app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error'), next: req.query.next || '' });
});

// Giriş sonrası güvenli geri dönüş: yalnız aynı site içi yol (QR yoklama akışı
// /login?next=/y/<token> için). Açık yönlendirmeyi engelle.
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', (info && info.message) || 'Giriş başarısız');
      return res.redirect('/login');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      const n = req.body.next || req.query.next || '';
      const safe = (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//')) ? n : '/dashboard';
      return res.redirect(safe);
    });
  })(req, res, next);
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return err;
    res.redirect('/');
  });
});

// ===== DASHBOARD (HTML) =====
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    res.render('dashboard', { user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== API: DASHBOARD DATA =====
app.get('/api/dashboard-data', isAuthenticated, async (req, res) => {
  try {
    // Get user's teams
    const teamsResult = await pool.query(
      'SELECT team_id FROM user_teams WHERE user_id = $1',
      [req.user.id]
    );
    const teamIds = teamsResult.rows.map(row => row.team_id);

    // Her zaman bir sonraki haftayı göster (Pzt-Paz)
    const { nextMonday: nextMondayDate, nextSunday: nextSundayDate } = nextWeekRange();

    const upcomingEventsQuery = `
      SELECT e.*, t.name as team_name, u.full_name as leader_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'CONFIRMED') as confirmed_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'REGISTERED') as queued_count
      FROM events e
      JOIN teams t ON e.team_id = t.id
      JOIN users u ON e.leader_id = u.id
      WHERE e.status = 'ACTIVE'
        AND e.event_date >= $1
        AND e.event_date <= $2
      ORDER BY e.event_date ASC, e.start_time ASC
    `;

    const upcomingEventsResult = await pool.query(upcomingEventsQuery, [nextMondayDate, nextSundayDate]);
    const events = upcomingEventsResult.rows;

    // Get user's registrations
    const registrationsQuery = `
      SELECT er.event_id, er.status, er.queue_position
      FROM event_registrations er
      WHERE er.user_id = $1 AND er.status IN ('REGISTERED', 'CONFIRMED')
    `;
    const registrationsResult = await pool.query(registrationsQuery, [req.user.id]);
    const registrations = registrationsResult.rows.reduce((acc, row) => {
      acc[row.event_id] = row;
      return acc;
    }, {});

    // Get user's confirmed events for conflict checking
    const confirmedEventsQuery = `
      SELECT e.event_date, e.start_time, e.end_time
      FROM event_registrations er
      JOIN events e ON er.event_id = e.id
      WHERE er.user_id = $1 AND er.status = 'CONFIRMED'
      ORDER BY e.event_date ASC, e.start_time ASC
    `;
    const confirmedEventsResult = await pool.query(confirmedEventsQuery, [req.user.id]);
    const confirmedTimes = confirmedEventsResult.rows;

    // Görünürlük filtresi: admin her şeyi görür; lider kendi etkinliğini her zaman görür;
    // diğerleri yalnızca penceresi açık etkinlikleri + kendi aktif kaydı olanları görür.
    const now = new Date();
    const visibleEvents = events.filter((e) => {
      if (req.user.role === 'ADMIN') return true;
      if (e.leader_id === req.user.id) return true;
      const open = e.registration_open ? new Date(e.registration_open) : null;
      const close = e.registration_deadline ? new Date(e.registration_deadline) : null;
      if (open && close && now >= open && now <= close) return true;
      return !!registrations[e.id];
    });

    // Sonraki açılış zamanı (boş durum geri sayımı için)
    const upcomingSunday = new Date(now);
    const dow = now.getDay();
    upcomingSunday.setDate(now.getDate() + (dow === 0 ? 0 : 7 - dow));
    upcomingSunday.setHours(0, 0, 0, 0);
    const slotResult = await pool.query(
      'SELECT open_time FROM weekly_openings WHERE opening_sunday = $1',
      [toLocalDateStr(upcomingSunday)]
    );
    const next_opening = nextOpeningTime(
      slotResult.rows.length ? slotResult.rows[0].open_time : null,
      now
    );

    // Format events response
    const formattedEvents = visibleEvents.map(event => {
      const open = event.registration_open ? new Date(event.registration_open) : null;
      const close = event.registration_deadline ? new Date(event.registration_deadline) : null;
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        event_date: toLocalDateStr(event.event_date),
        start_time: event.start_time,
        end_time: event.end_time,
        team: event.team_name,
        capacity: event.capacity,
        confirmed_count: parseInt(event.confirmed_count),
        queued_count: parseInt(event.queued_count),
        registration_open: event.registration_open,
        registration_deadline: event.registration_deadline,
        is_open: !!open && !!close && now >= open && now <= close,
        is_leader: event.leader_id === req.user.id,
        deadline_passed: isDeadlinePassed(event.registration_deadline),
        user_registration: registrations[event.id] || null
      };
    });

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          full_name: req.user.full_name,
          points: req.user.points,
          hierarchy_level: req.user.hierarchy_level,
          role: req.user.role
        },
        events: formattedEvents,
        confirmed_times: confirmedTimes,
        next_opening: next_opening
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// Çakışma kontrolü kaldırıldı — kullanıcı kendi yönetir

// ===== CREATE EVENT =====
app.get('/events/create', isSenior, async (req, res) => {
  try {
    // Tüm seniorlar tüm ekipler için etkinlik oluşturabilir (junior'lar birim başında,
    // etkinlikleri senior ekip yayınlar)
    const teamsResult = await pool.query('SELECT t.* FROM teams t ORDER BY t.name');

    res.render('events/create', {
      led_teams: teamsResult.rows,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

app.post('/events/create', isSenior, async (req, res) => {
  try {
    const { title, description, location, event_date, start_time, end_time, capacity, team_id } = req.body;

    const renderError = async (msg) => {
      const teamsResult = await pool.query('SELECT t.* FROM teams t ORDER BY t.name');
      return res.status(400).render('events/create', {
        error: msg,
        led_teams: teamsResult.rows,
        user: req.user
      });
    };

    // Validate inputs
    if (!title || !location || !event_date || !start_time || !end_time || !capacity || !team_id) {
      return renderError('Tüm alanları doldurunuz');
    }

    if (end_time <= start_time) {
      return renderError('Bitiş saati başlangıç saatinden sonra olmalı');
    }

    // Sunucu tarafı menzil kontrolü: etkinlik tarihi [gelecek Pzt, gelecek Paz] içinde olmalı
    const { nextMonday, nextSunday } = nextWeekRange();
    const evDate = new Date(`${event_date}T12:00:00`);
    if (isNaN(evDate.getTime()) || evDate < nextMonday || evDate > nextSunday) {
      return renderError('Etkinlik tarihi gelecek hafta (Pazartesi–Pazar) içinde olmalı');
    }

    // Açılış slotu: o Pazar için TEK ortak, rastgele 12:00 veya 19:00 (5 saatlik pencere)
    const sunday = lastSundayStrictlyBefore(event_date);
    const sundayStr = toLocalDateStr(sunday);

    const slotResult = await pool.query(
      'SELECT open_time FROM weekly_openings WHERE opening_sunday = $1',
      [sundayStr]
    );

    let open;
    if (slotResult.rows.length > 0) {
      // Bu Pazar için slot zaten çekildi → tüm etkinlikler aynı saatte açılır
      open = new Date(slotResult.rows[0].open_time);
    } else {
      const candidates = candidateSlots(sunday);
      if (candidates.length === 0) {
        return renderError('Bu haftanın başvuru penceresi kapandı (Pazar 12:00/19:00). Etkinliği bir sonraki hafta için oluşturun.');
      }
      open = candidates[Math.floor(Math.random() * candidates.length)];
      await pool.query(
        'INSERT INTO weekly_openings (opening_sunday, open_time) VALUES ($1, $2) ON CONFLICT (opening_sunday) DO NOTHING',
        [sundayStr, open]
      );
      // Yarış durumuna karşı kayıtlı değeri oku
      const finalSlot = await pool.query(
        'SELECT open_time FROM weekly_openings WHERE opening_sunday = $1',
        [sundayStr]
      );
      open = new Date(finalSlot.rows[0].open_time);
    }

    const deadline = closeTime(open);
    if (deadline.getTime() <= new Date().getTime()) {
      return renderError('Bu haftanın başvuru penceresi kapandı (Pazar 12:00/19:00). Etkinliği bir sonraki hafta için oluşturun.');
    }

    const result = await pool.query(
      `INSERT INTO events (title, description, location, event_date, start_time, end_time, capacity, leader_id, team_id, registration_open, registration_deadline, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')
       RETURNING id`,
      [title, description, location, event_date, start_time, end_time, capacity, req.user.id, team_id, open, deadline]
    );

    res.redirect(`/dashboard?event_created=1&open=${encodeURIComponent(open.toISOString())}`);
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== REGISTER FOR EVENT (API) =====
app.post('/api/event/:id/register', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Get event
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];

    // İptal edilmiş etkinliğe kayıt olunamaz
    if (event.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Etkinlik iptal edilmiştir' });
    }

    // Başvurular açılmadan kayıt olunamaz (sunucu tarafı koruma)
    if (!event.registration_open || new Date() < new Date(event.registration_open)) {
      return res.status(400).json({ success: false, error: 'Başvurular henüz açılmadı' });
    }

    // Check deadline
    if (isDeadlinePassed(event.registration_deadline)) {
      return res.status(400).json({ success: false, error: 'Kayıt süresi sona ermiştir' });
    }

    // Check if already registered (AKTIF olarak)
    const existingReg = await pool.query(
      'SELECT id, status FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status IN (\'CONFIRMED\', \'REGISTERED\')',
      [eventId, req.user.id]
    );

    if (existingReg.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Zaten bu etkinliğe katılıyorsunuz' });
    }

    // CANCELLED kaydı sil (varsa)
    await pool.query(
      'DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status = $3',
      [eventId, req.user.id, 'CANCELLED']
    );


    // Get current registration count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM event_registrations WHERE event_id = $1 AND status = $2',
      [eventId, 'CONFIRMED']
    );

    const currentCount = parseInt(countResult.rows[0].count);

    let status, queuePosition = null;
    if (currentCount < event.capacity) {
      status = 'CONFIRMED';
    } else {
      status = 'REGISTERED';
      const queueResult = await pool.query(
        'SELECT COALESCE(MAX(queue_position), 0) as max_pos FROM event_registrations WHERE event_id = $1 AND status = $2',
        [eventId, 'REGISTERED']
      );
      queuePosition = parseInt(queueResult.rows[0].max_pos) + 1;
    }

    await pool.query(
      'INSERT INTO event_registrations (event_id, user_id, status, queue_position) VALUES ($1, $2, $3, $4)',
      [eventId, req.user.id, status, queuePosition]
    );

    res.json({
      success: true,
      message: status === 'CONFIRMED' ? 'Katılım başarıyla kaydedildi' : 'Bekleme listesine eklendi',
      data: {
        status,
        queue_position: queuePosition
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== UNREGISTER FROM EVENT (API) =====
app.post('/api/event/:id/unregister', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;

    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];
    const deadlinePassed = isDeadlinePassed(event.registration_deadline);

    // Get user's registration
    const regResult = await pool.query(
      'SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, req.user.id]
    );

    if (regResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Bu etkinliğe kayıtlı değilsiniz' });
    }

    const wasConfirmed = regResult.rows[0].status === 'CONFIRMED';

    // Apply penalty if after deadline
    if (deadlinePassed) {
      await pool.query('UPDATE users SET points = points - 1 WHERE id = $1', [req.user.id]);
      await pool.query(
        `INSERT INTO point_transactions (user_id, event_id, points_change, reason, edited_by)
         VALUES ($1, $2, $3, $4, NULL)`,
        [req.user.id, eventId, -1, 'LATE_CANCEL']
      );
    }

    // Cancel registration
    await pool.query(
      'UPDATE event_registrations SET status = $1, cancelled_at = NOW(), cancelled_after_deadline = $2 WHERE event_id = $3 AND user_id = $4',
      ['CANCELLED', deadlinePassed, eventId, req.user.id]
    );

    // Move queue if necessary
    if (wasConfirmed) {
      const queuedResult = await pool.query(
        'SELECT id FROM event_registrations WHERE event_id = $1 AND status = $2 ORDER BY registered_at LIMIT 1',
        [eventId, 'REGISTERED']
      );

      if (queuedResult.rows.length > 0) {
        await pool.query(
          'UPDATE event_registrations SET status = $1, queue_position = NULL WHERE id = $2',
          ['CONFIRMED', queuedResult.rows[0].id]
        );
      }
    }

    res.json({
      success: true,
      message: 'Katılım iptal edildi',
      penalty_applied: deadlinePassed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== MARK ATTENDANCE (BATCH) =====
app.post('/api/event/:id/attendance/batch', isAdminOrEventLeader, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { attendances } = req.body;

    if (!Array.isArray(attendances)) {
      return res.status(400).json({ success: false, error: 'attendances array gerekli' });
    }

    // Check event and authorization
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];
    if (req.user.id !== event.leader_id && req.user.role !== 'ADMIN' && req.user.hierarchy_level !== 'COORDINATOR') {
      return res.status(403).json({ success: false, error: 'Yetkilendirme hatası' });
    }

    const results = [];

    for (const att of attendances) {
      try {
        const { user_id, attended } = att;

        // Check registration
        const regCheck = await pool.query(
          'SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status = $3',
          [eventId, user_id, 'CONFIRMED']
        );

        if (regCheck.rows.length === 0) continue;

        // Insert/Update attendance
        await pool.query(
          `INSERT INTO event_attendance (event_id, user_id, marked_by, attended)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (event_id, user_id) DO UPDATE SET
             attended = $4,
             marked_by = $3,
             marked_at = NOW()`,
          [eventId, user_id, req.user.id, attended]
        );

        // Update points
        const pointsChange = attended ? 5 : -10;
        const pointsCheck = await pool.query(
          'SELECT id FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3',
          [eventId, user_id, 'ATTENDANCE']
        );

        if (pointsCheck.rows.length === 0) {
          await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [pointsChange, user_id]);
          await pool.query(
            `INSERT INTO point_transactions (user_id, event_id, points_change, reason, edited_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [user_id, eventId, pointsChange, 'ATTENDANCE', req.user.id]
          );
        }

        results.push({ user_id, success: true });
      } catch (err) {
        results.push({ user_id: att.user_id, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      message: 'Yoklama toplu kaydedildi',
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADJUST POINTS (ADMIN) =====
app.post('/api/admin/points/adjust', isSenior, async (req, res) => {
  try {
    const { user_id, points_change, reason } = req.body;

    if (!user_id || points_change === undefined || !reason) {
      return res.status(400).json({ success: false, error: 'Eksik parametreler' });
    }

    // Admin hesaplarına puan işlenemez
    const targetResult = await pool.query('SELECT role FROM users WHERE id = $1', [user_id]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }
    if (targetResult.rows[0].role === 'ADMIN') {
      return res.status(400).json({ success: false, error: 'Admin hesaplarına puan işlenemez' });
    }

    // Update user points
    const userResult = await pool.query(
      'UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points',
      [points_change, user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    // Log transaction
    await pool.query(
      `INSERT INTO point_transactions (user_id, points_change, reason, edited_by)
       VALUES ($1, $2, $3, $4)`,
      [user_id, points_change, reason, req.user.id]
    );

    res.json({
      success: true,
      message: 'Puan güncellendi',
      new_points: userResult.rows[0].points
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== GET POINTS HISTORY (API) =====
app.get('/api/user/points-history', isAuthenticated, async (req, res) => {
  try {
    const { user_id } = req.query;
    const targetId = user_id ? parseInt(user_id) : req.user.id;

    // Only admin/self can view
    if (req.user.id !== targetId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Yetkilendirme hatası' });
    }

    const query = `
      SELECT pt.*, u.full_name as edited_by_name, e.title as event_title
      FROM point_transactions pt
      LEFT JOIN users u ON pt.edited_by = u.id
      LEFT JOIN events e ON pt.event_id = e.id
      WHERE pt.user_id = $1
      ORDER BY pt.created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, [targetId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== VIEW EVENT REGISTRATIONS =====
app.get('/event/:id/registrations', isSenior, async (req, res) => {
  try {
    const eventId = req.params.id;

    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).render('errors/404');
    }

    const event = eventResult.rows[0];

    // Check authorization
    if (req.user.id !== event.leader_id && req.user.role !== 'ADMIN') {
      return res.status(403).render('errors/forbidden');
    }

    const registrationsResult = await pool.query(
      `SELECT er.*, u.full_name, u.email,
         (SELECT attended FROM event_attendance WHERE event_id = $1 AND user_id = u.id) as attended
       FROM event_registrations er
       JOIN users u ON er.user_id = u.id
       WHERE er.event_id = $1 AND er.status = 'CONFIRMED'
       ORDER BY er.registered_at ASC`,
      [eventId]
    );

    res.render('events/registrations', {
      event,
      registrations: registrationsResult.rows,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500');
  }
});

// ===== ADMIN PANEL =====
app.get('/admin', isAdmin, async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const teamsResult = await pool.query('SELECT * FROM teams');
    const teamCountsResult = await pool.query('SELECT team_id, COUNT(*) as cnt FROM user_teams GROUP BY team_id');
    const eventStatsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_events,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND registration_open IS NOT NULL
          AND registration_open <= NOW() AND registration_deadline > NOW()) AS open_events
      FROM events
    `);

    const teamMemberCounts = {};
    teamCountsResult.rows.forEach(r => { teamMemberCounts[r.team_id] = parseInt(r.cnt); });

    const es = eventStatsResult.rows[0];
    const eventStats = {
      total_events: parseInt(es.total_events),
      active_events: parseInt(es.active_events),
      open_events: parseInt(es.open_events)
    };

    res.render('admin/panel', {
      users: usersResult.rows,
      teams: teamsResult.rows,
      teamMemberCounts,
      eventStats,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== ADMIN: EVENTS LIST (API) =====
app.get('/api/admin/events', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, t.name as team_name, u.full_name as leader_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'CONFIRMED') as confirmed_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'REGISTERED') as queued_count
      FROM events e
      JOIN teams t ON e.team_id = t.id
      JOIN users u ON e.leader_id = u.id
      ORDER BY e.event_date DESC, e.start_time DESC
    `);

    const now = new Date();
    const events = result.rows.map((e) => ({
      ...e,
      computed_status: computedEventStatus(e, now)
    }));

    res.json({ success: true, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN: EVENT STATUS TOGGLE (API) =====
app.post('/api/admin/event/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Geçersiz durum' });
    }

    const result = await pool.query(
      'UPDATE events SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etkinlik bulunamadı' });
    }

    res.json({ success: true, message: status === 'CANCELLED' ? 'Etkinlik iptal edildi' : 'Etkinlik aktifleştirildi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ADMIN: DELETE USER =====
app.post('/admin/user/:id/delete', isAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);

  if (targetId === req.user.id) {
    return res.redirect('/admin?err=' + encodeURIComponent('Kendi hesabınızı silemezsiniz.'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FK kısıtları: events.leader_id ve point_transactions.edited_by RESTRICT
    const leadCheck = await client.query('SELECT COUNT(*) FROM events WHERE leader_id = $1', [targetId]);
    if (parseInt(leadCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.redirect('/admin?err=' + encodeURIComponent('Bu kullanıcı etkinlik lideri olduğu için silinemez.'));
    }

    const editCheck = await client.query('SELECT COUNT(*) FROM point_transactions WHERE edited_by = $1', [targetId]);
    if (parseInt(editCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.redirect('/admin?err=' + encodeURIComponent('Bu kullanıcının puan düzenleme kayıtları olduğu için silinemez.'));
    }

    await client.query('DELETE FROM user_teams WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM users WHERE id = $1', [targetId]);
    await client.query('COMMIT');

    res.redirect('/admin?msg=' + encodeURIComponent('Kullanıcı silindi.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.redirect('/admin?err=' + encodeURIComponent('Silme sırasında bir hata oluştu.'));
  } finally {
    client.release();
  }
});

// ===== CREATE USER (ADMIN) =====
app.get('/admin/user/new', isAdmin, async (req, res) => {
  try {
    const teamsResult = await pool.query('SELECT * FROM teams');
    const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1', ['JUNIOR']);

    res.render('admin/create_user', {
      mode: 'create',
      teams: teamsResult.rows,
      juniors: juniorsResult.rows,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

app.post('/admin/user/new', isAdmin, async (req, res) => {
  try {
    const { username, email, full_name, password, hierarchy_level, teams: teamIds, body_for,
            member_since, resigned_at, birth_date, gender, disadvantaged, disadvantaged_note,
            passport_no, passport_expiry, visa_status, phone } = req.body;

    // Check if username exists
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      const teamsResult = await pool.query('SELECT * FROM teams');
      const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1', ['JUNIOR']);
      return res.render('admin/create_user', {
        mode: 'create',
        error: 'Bu kullanıcı adı zaten kullanılmaktadır',
        teams: teamsResult.rows,
        juniors: juniorsResult.rows,
        user: req.user
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine role based on hierarchy
    const roleMap = {
      'VOLUNTEER': 'VOLUNTEER',
      'JUNIOR': 'JUNIOR',
      'SENIOR': 'SENIOR',
      'COORDINATOR': 'ADMIN', // Koordinatör tam yönetim yetkisindedir
      'PRESIDENT': 'ADMIN'
    };

    const role = roleMap[hierarchy_level] || 'VOLUNTEER';

    // Insert user
    const userResult = await pool.query(
      `INSERT INTO users (username, email, full_name, password_hash, hierarchy_level, role, body_for,
                          member_since, resigned_at, birth_date, gender, disadvantaged, disadvantaged_note,
                          passport_no, passport_expiry, visa_status, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [username, email, full_name, hashedPassword, hierarchy_level, role, body_for || null,
       orNull(member_since), orNull(resigned_at), orNull(birth_date),
       orNull(gender), disadvantaged ? true : false, orNull(disadvantaged_note),
       orNull(passport_no), orNull(passport_expiry), orNull(visa_status), orNull(phone)]
    );

    const userId = userResult.rows[0].id;

    // Add teams
    if (teamIds && teamIds.length > 0) {
      const teamsArray = Array.isArray(teamIds) ? teamIds : [teamIds];
      for (const teamId of teamsArray) {
        await pool.query(
          'INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2)',
          [userId, teamId]
        );
      }
    }

    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== EDIT USER (ADMIN) =====
app.get('/admin/user/:id/edit', isAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
    if (userResult.rows.length === 0) {
      return res.status(404).render('errors/404');
    }

    const teamsResult = await pool.query('SELECT * FROM teams');
    const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1 AND id <> $2', ['JUNIOR', targetId]);
    const utResult = await pool.query('SELECT team_id FROM user_teams WHERE user_id = $1', [targetId]);

    res.render('admin/create_user', {
      mode: 'edit',
      edit_user: userResult.rows[0],
      edit_user_team_ids: utResult.rows.map(r => r.team_id),
      teams: teamsResult.rows,
      juniors: juniorsResult.rows,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

app.post('/admin/user/:id/edit', isAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { full_name, email, password, hierarchy_level, teams: teamIds, body_for, points_delta,
            member_since, resigned_at, birth_date, gender, disadvantaged, disadvantaged_note,
            passport_no, passport_expiry, visa_status, phone } = req.body;

    const renderEditError = async (errorMsg) => {
      const teamsResult = await pool.query('SELECT * FROM teams');
      const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1 AND id <> $2', ['JUNIOR', targetId]);
      const utResult = await pool.query('SELECT team_id FROM user_teams WHERE user_id = $1', [targetId]);
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
      return res.status(400).render('admin/create_user', {
        mode: 'edit',
        edit_user: userResult.rows[0],
        edit_user_team_ids: utResult.rows.map(r => r.team_id),
        teams: teamsResult.rows,
        juniors: juniorsResult.rows,
        user: req.user,
        error: errorMsg
      });
    };

    if (!full_name || !email || !hierarchy_level) {
      return renderEditError('Ad, e-posta ve seviye zorunludur.');
    }

    const roleMap = {
      'VOLUNTEER': 'VOLUNTEER',
      'JUNIOR': 'JUNIOR',
      'SENIOR': 'SENIOR',
      'COORDINATOR': 'ADMIN', // Koordinatör tam yönetim yetkisindedir
      'PRESIDENT': 'ADMIN'
    };
    const role = roleMap[hierarchy_level] || 'VOLUNTEER';
    const bodyFor = body_for ? parseInt(body_for) : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (password && password.length > 0) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, targetId]);
      }

      await client.query(
        `UPDATE users SET full_name = $1, email = $2, hierarchy_level = $3, role = $4, body_for = $5,
           member_since = $6, resigned_at = $7, birth_date = $8, gender = $9, disadvantaged = $10,
           disadvantaged_note = $11,
           passport_no = $12, passport_expiry = $13, visa_status = $14, phone = $15,
           updated_at = CURRENT_TIMESTAMP WHERE id = $16`,
        [full_name, email, hierarchy_level, role, bodyFor,
         orNull(member_since), orNull(resigned_at), orNull(birth_date), orNull(gender), disadvantaged ? true : false,
         orNull(disadvantaged_note),
         orNull(passport_no), orNull(passport_expiry), orNull(visa_status), orNull(phone), targetId]
      );

      // Puan değişimi (delta) — audit trail ile
      const delta = parseInt(points_delta || 0);
      if (delta !== 0) {
        await client.query('UPDATE users SET points = points + $1 WHERE id = $2', [delta, targetId]);
        await client.query(
          `INSERT INTO point_transactions (user_id, points_change, reason, edited_by)
           VALUES ($1, $2, 'MANUAL_EDIT', $3)`,
          [targetId, delta, req.user.id]
        );
      }

      // Ekipler: sil + yeniden ekle
      await client.query('DELETE FROM user_teams WHERE user_id = $1', [targetId]);
      if (teamIds && teamIds.length > 0) {
        const teamsArray = Array.isArray(teamIds) ? teamIds : [teamIds];
        for (const teamId of teamsArray) {
          await client.query('INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2)', [targetId, teamId]);
        }
      }

      await client.query('COMMIT');
      res.redirect('/admin?msg=' + encodeURIComponent('Kullanıcı güncellendi.'));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== ATTENDANCE (YOKLAMA) =====

const isDeadlinePassedForAttendance = (eventDate, eventTime) => {
  const now = new Date();
  const eventDT = new Date(`${eventDate}T${eventTime}`);
  return now > eventDT; // Etkinlik zamanı geçtimi?
};

// GET /attendance/:eventId - Yoklama sayfası
app.get('/attendance/:eventId', isAdminOrEventLeader, async (req, res) => {
  try {
    const eventId = req.params.eventId;

    // Get event
    const eventResult = await pool.query(
      `SELECT e.*, t.name as team_name FROM events e
       JOIN teams t ON e.team_id = t.id
       WHERE e.id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).render('errors/404');
    }

    const event = eventResult.rows[0];
    const eventDateStr = toLocalDateStr(event.event_date);
    const deadlinePassedForEvent = isDeadlinePassedForAttendance(eventDateStr, event.start_time);
    // Başvuru penceresi kapandıysa katılımcı listesi kesinleşir
    const sundayAfterDeadline = isDeadlinePassed(event.registration_deadline);

    // Get registrations (FIFO by registered_at, kapasitesi kadar)
    const registrationsResult = await pool.query(
      `SELECT er.id, er.user_id, er.status, er.queue_position, er.registered_at,
              u.full_name, u.username,
              ea.attended, ea.id as attendance_id
       FROM event_registrations er
       JOIN users u ON er.user_id = u.id
       LEFT JOIN event_attendance ea ON ea.event_id = $1 AND ea.user_id = er.user_id
       WHERE er.event_id = $1 AND er.status IN ('CONFIRMED', 'REGISTERED')
       ORDER BY 
         CASE WHEN er.status = 'CONFIRMED' THEN 0 ELSE 1 END,
         er.registered_at ASC
       LIMIT 1000`,
      [eventId]
    );

    const allRegistrations = registrationsResult.rows;
    
    // Final list: Capacity kadar confirmed kişiler
    const confirmedList = allRegistrations.filter(r => r.status === 'CONFIRMED').slice(0, event.capacity);
    const waitlist = allRegistrations.slice(event.capacity);

    res.render('attendance', {
      event: event,
      eventDateStr: eventDateStr,
      confirmedList: confirmedList,
      waitlist: waitlist,
      deadlinePassedForEvent: deadlinePassedForEvent,
      sundayAfterDeadline: sundayAfterDeadline,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: err.message });
  }
});

// POST /api/event/:id/mark-attendance - Yoklama işaretle
app.post('/api/event/:eventId/mark-attendance', isAdminOrEventLeader, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, attended } = req.body;

    if (!userId || attended === undefined) {
      return res.status(400).json({ success: false, error: 'Missing userId or attended' });
    }

    // Get event
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // UPSERT attendance
    await pool.query(
      `INSERT INTO event_attendance (event_id, user_id, marked_by, attended, marked_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id, user_id) DO UPDATE SET
         attended = $4,
         marked_by = $3,
         marked_at = CURRENT_TIMESTAMP`,
      [eventId, userId, req.user.id, attended]
    );

    // Update points based on attendance
    const pointsChange = attended ? 5 : -10;
    
    // Önceki puan işlemini kontrol et ve geri al
    const existingTransaction = await pool.query(
      'SELECT points_change FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3',
      [eventId, userId, 'ATTENDANCE']
    );

    if (existingTransaction.rows.length > 0) {
      // Önceki puanı geri al
      const oldPoints = existingTransaction.rows[0].points_change;
      await pool.query('UPDATE users SET points = points - $1 WHERE id = $2', [oldPoints, userId]);
      // Transaction'ı sil
      await pool.query('DELETE FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3', 
                      [eventId, userId, 'ATTENDANCE']);
    }

    // Yeni puan işlemini yap
    await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [pointsChange, userId]);

    await pool.query(
      `INSERT INTO point_transactions (user_id, event_id, points_change, reason, edited_by)
       VALUES ($1, $2, $3, 'ATTENDANCE', $4)`,
      [userId, eventId, pointsChange, req.user.id]
    );

    res.json({ success: true, message: attended ? 'Katılım işaretlendi (+5 puan)' : 'Katılmadı işaretlendi (-10 puan)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== GET ATTENDANCE EVENTS FOR ADMIN PANEL =====
app.get('/api/admin/attendance-events', isSenior, async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'ADMIN') {
      // Admin tüm etkinlikleri görebilir
      query = `
        SELECT e.id, e.title, e.event_date, e.start_time, e.capacity,
               t.name as team_name, u.full_name as leader_name,
               COUNT(er.id) as registered_count
        FROM events e
        JOIN teams t ON e.team_id = t.id
        JOIN users u ON e.leader_id = u.id
        LEFT JOIN event_registrations er ON e.id = er.event_id AND er.status IN ('CONFIRMED', 'REGISTERED')
        WHERE e.event_date <= CURRENT_DATE
        GROUP BY e.id, e.title, e.event_date, e.start_time, e.capacity, t.name, u.full_name
        ORDER BY e.event_date DESC, e.start_time DESC
      `;
      params = [];
    } else {
      // Diğer kullanıcılar sadece kendi oluşturduklarını görebilir
      query = `
        SELECT e.id, e.title, e.event_date, e.start_time, e.capacity,
               t.name as team_name, u.full_name as leader_name,
               COUNT(er.id) as registered_count
        FROM events e
        JOIN teams t ON e.team_id = t.id
        JOIN users u ON e.leader_id = u.id
        LEFT JOIN event_registrations er ON e.id = er.event_id AND er.status IN ('CONFIRMED', 'REGISTERED')
        WHERE e.leader_id = $1 AND e.event_date <= CURRENT_DATE
        GROUP BY e.id, e.title, e.event_date, e.start_time, e.capacity, t.name, u.full_name
        ORDER BY e.event_date DESC, e.start_time DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      events: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== QR YOKLAMA =====

// Etkinlik sayfası için QR üret (mevcut geçerli token varsa onu döner)
app.get('/api/attendance/:eventId/qr', isAdminOrEventLeader, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);

    // Her istekte yeni 10 dk'lık token üret (raw token DB'de saklanmaz, yalnızca hash)
    const t = await createAttendanceToken(eventId, req.user.id);
    const raw = t.raw;
    const expiresAt = t.expiresAt;

    const url = `https://${req.get('host')}/y/${raw}`;
    const qrDataUri = await QRCode.toDataURL(url, { width: 320, margin: 1 });

    res.json({
      success: true,
      data: { qr_data_uri: qrDataUri, url, expires_at: expiresAt, ttl_minutes: 10 }
    });
  } catch (err) {
    console.error('QR üretim hatası:', err);
    res.status(500).json({ success: false, error: 'QR üretilemedi' });
  }
});

// Katılımcı QR'ı okutur → yoklama işaretlenir
app.get('/y/:token', async (req, res) => {
  try {
    const result = await consumeAttendanceToken(req.params.token);

    const renderPage = (opts) => res.render('attendance/qr_success', { ...opts, token: req.params.token });

    if (!result) {
      return renderPage({ status: 'invalid', event_title: null });
    }
    if (result.expired || !result.event) {
      return renderPage({ status: 'expired', event_title: null });
    }
    if (!req.isAuthenticated()) {
      return renderPage({ status: 'need_login', event_title: result.event.title });
    }

    // Kayıtlı mı? (CONFIRMED)
    const reg = await pool.query(
      `SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status = 'CONFIRMED'`,
      [result.event.id, req.user.id]
    );
    if (reg.rows.length === 0) {
      return renderPage({ status: 'not_registered', event_title: result.event.title });
    }

    await markAttendance(result.event.id, req.user.id, req.user.id, true);
    return renderPage({ status: 'success', event_title: result.event.title });
  } catch (err) {
    console.error('QR yoklama hatası:', err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== ETKİNLİK SONRASI DEĞERLENDİRME ANKETİ =====

// Katılımcıya açık değerlendirme anketleri (dashboard bildirimi)
app.get('/api/user/evaluation-notices', isAuthenticated, async (req, res) => {
  try {
    const surveys = await getOpenEvaluationSurveysForUser(req.user.id);
    res.json({ success: true, data: surveys });
  } catch (err) {
    console.error('Değerlendirme bildirimi hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// Admin: değerlendirme anketi bekleyen etkinlikler
app.get('/api/admin/pending-evaluations', isAdmin, async (req, res) => {
  try {
    const events = await getPendingEvaluationEvents();
    res.json({ success: true, events });
  } catch (err) {
    console.error('Bekleyen değerlendirme hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ROZET / AYLIK AKTİF İSTATİSTİĞİ =====

// Bu ay en aktif 5 üye (admin overview kartı)
app.get('/api/admin/stats/monthly-active', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.hierarchy_level, COUNT(*) as attended_count
      FROM event_attendance ea
      JOIN users u ON u.id = ea.user_id
      WHERE ea.attended = TRUE
        AND ea.marked_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY u.id
      ORDER BY attended_count DESC, u.full_name ASC
      LIMIT 5
    `);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Aylık aktif istatistik hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== PROFILE & PASSWORD =====
app.get('/profile', isAuthenticated, async (req, res) => {
  try {
    // Rozet: katılım sayısına göre (5+ gümüş, 10+ altın) — puanlar kişiye özel kalır
    const attendedResult = await pool.query(
      'SELECT COUNT(*) FROM event_attendance WHERE user_id = $1 AND attended = TRUE',
      [req.user.id]
    );
    const attendedCount = parseInt(attendedResult.rows[0].count);
    const badges = { attended_count: attendedCount, silver: attendedCount >= 5, gold: attendedCount >= 10 };
    // Güncel kullanıcı verisi (form alanları SELECT * ile req.user'da mevcut)
    const fresh = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.render('profile', {
      user: fresh.rows[0],
      badges,
      message: req.query.msg === '1' ? 'Profilin başarıyla güncellendi!' : null,
      error: null
    });
  } catch (err) {
    console.error('Profil hatası:', err);
    res.render('profile', { user: req.user, badges: { attended_count: 0, silver: false, gold: false }, message: null, error: null });
  }
});

// Profil tamamlama / güncelleme (üye kendi bilgilerini doldurur)
app.post('/profile/update', isAuthenticated, async (req, res) => {
  const { full_name, email, phone, birth_date, gender, city, school, department_grade, occupation,
          languages, hobbies, interests, talents, passport_no, passport_color, passport_expiry,
          visa_status, volunteer_experience } = req.body;

  const renderErr = async (msg) => {
    const badges = { attended_count: 0, silver: false, gold: false };
    const fresh = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    return res.render('profile', { user: fresh.rows[0], badges, message: null, error: msg });
  };

  try {
    if (!full_name || !String(full_name).trim()) return await renderErr('Ad soyad zorunludur.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return await renderErr('Geçerli bir e-posta adresi girin.');
    }

    const emailTaken = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [String(email).trim(), req.user.id]);
    if (emailTaken.rows.length > 0) return await renderErr('Bu e-posta başka bir üye tarafından kullanılıyor.');

    const intArr = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map(x => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 15);
    const orNull = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

    await pool.query(
      `UPDATE users SET
         full_name = $1, email = $2, phone = $3, birth_date = $4, gender = $5,
         city = $6, school = $7, department_grade = $8, occupation = $9,
         languages = $10, hobbies = $11, interests = $12, talents = $13,
         passport_no = $14, passport_color = $15, passport_expiry = $16,
         visa_status = $17, volunteer_experience = $18,
         profile_completed_at = COALESCE(profile_completed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $19`,
      [
        String(full_name).trim(), String(email).trim(),
        orNull(phone), orNull(birth_date), orNull(gender),
        orNull(city), orNull(school), orNull(department_grade), orNull(occupation),
        orNull(languages), orNull(hobbies),
        JSON.stringify(intArr(interests)), JSON.stringify(intArr(talents)),
        orNull(passport_no), orNull(passport_color), orNull(passport_expiry),
        orNull(visa_status), orNull(volunteer_experience),
        req.user.id
      ]
    );

    res.redirect('/profile?msg=1');
  } catch (err) {
    console.error('Profil güncelleme hatası:', err);
    await renderErr('Kaydedilirken bir hata oluştu.');
  }
});

// Profil tamamlanma durumu (dashboard banner'ı)
app.get('/api/user/profile-status', isAuthenticated, async (req, res) => {
  try {
    res.json({ success: true, completed: !!req.user.profile_completed_at });
  } catch (err) {
    console.error('Profil durum hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ETKİNLİKLERİM =====
app.get('/api/user/my-events', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.status as event_status,
              t.name as team_name, er.status as reg_status, er.queue_position,
              ea.attended
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       JOIN teams t ON t.id = e.team_id
       LEFT JOIN event_attendance ea ON ea.event_id = er.event_id AND ea.user_id = er.user_id
       WHERE er.user_id = $1
       ORDER BY e.event_date DESC, e.start_time DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows.map(e => ({ ...e, event_date: toLocalDateStr(e.event_date) })) });
  } catch (err) {
    console.error('Etkinliklerim hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

// ===== ŞİKAYET & ÖNERİ (üye gönderimi) =====
app.post('/api/user/feedback', isAuthenticated, async (req, res) => {
  try {
    const { kind, message, anonim } = req.body;
    if (!['SIKAYET', 'ONERI'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Tür seçin' });
    }
    const msg = String(message || '').trim();
    if (!msg || msg.length < 5) {
      return res.status(400).json({ success: false, error: 'Mesaj en az 5 karakter olmalı' });
    }
    if (msg.length > 3000) {
      return res.status(400).json({ success: false, error: 'Mesaj çok uzun (en fazla 3000 karakter)' });
    }
    await pool.query(
      'INSERT INTO feedback (user_id, kind, message, is_anonymous) VALUES ($1, $2, $3, $4)',
      [req.user.id, kind, msg, anonim === true || anonim === 'true']
    );
    res.json({ success: true, message: 'Gönderildi, teşekkürler! Admin ekibi inceleyecek.' });
  } catch (err) {
    console.error('Feedback hatası:', err);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

app.post('/profile/change-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  let badges = { attended_count: 0, silver: false, gold: false };
  try {
    const attendance = await pool.query('SELECT COUNT(*) FROM event_attendance WHERE user_id=$1 AND attended=TRUE', [req.user.id]);
    const count = Number(attendance.rows[0].count);
    badges = { attended_count: count, silver: count >= 5, gold: count >= 10 };
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render('profile', { user: req.user, badges, message: null, error: 'Tüm alanları doldurun.' });
    }

    if (newPassword.length < 6) {
      return res.render('profile', { user: req.user, badges, message: null, error: 'Yeni şifre en az 6 karakter olmalı.' });
    }

    if (newPassword !== confirmPassword) {
      return res.render('profile', { user: req.user, badges, message: null, error: 'Yeni şifreler eşleşmiyor.' });
    }

    // Verify current password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!valid) {
      return res.render('profile', { user: req.user, badges, message: null, error: 'Mevcut şifre yanlış.' });
    }

    // Hash and update
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, req.user.id]);

    res.render('profile', { user: req.user, badges, message: 'Şifreniz başarıyla güncellendi!', error: null });
  } catch (err) {
    console.error(err);
    res.render('profile', { user: req.user, badges, message: null, error: 'Bir hata oluştu.' });
  }
});

// ===== ERROR HANDLERS =====
app.get('/404', (req, res) => {
  res.status(404).render('errors/404');
});

app.get('/500', (req, res) => {
  res.status(500).render('errors/500');
});

app.use((req, res) => {
  res.status(404).render('errors/404');
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3075;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);

  // Anasayfa "Gönüllü Ol" anketi yoksa oluştur (idempotent, fire-and-forget)
  require('./lib/landing').ensureVolunteerSurvey(pool).catch(() => {});
});
