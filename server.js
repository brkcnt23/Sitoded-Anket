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

const app = express();

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
app.use(session({
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

// ===== MIDDLEWARE =====
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'ADMIN') {
    return next();
  }
  res.status(403).render('errors/forbidden', { message: 'Yetkilendirme hatası' });
};

const isSenior = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'ADMIN' || req.user.role === 'SENIOR')) {
    return next();
  }
  res.status(403).render('errors/forbidden', { message: 'Yetkilendirme hatası' });
};

const isAdminOrEventLeader = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).render('errors/forbidden', { message: 'Giriş yapmanız gerekiyor' });
  }

  // Admin her zaman erişebilir
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // Senior her zaman erişebilir
  if (req.user.role === 'SENIOR') {
    return next();
  }

  // Event ID'yi al
  const eventId = req.params.eventId || req.params.id;

  try {
    // Event'i çek ve leader_id'yi kontrol et
    const eventResult = await pool.query('SELECT leader_id FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).render('errors/404');
    }

    const event = eventResult.rows[0];
    if (event.leader_id === req.user.id) {
      return next();
    }

    // Yetki yok
    res.status(403).render('errors/forbidden', { message: 'Bu etkinliğin yoklamasını alma yetkiniz yok' });
  } catch (err) {
    console.error('Yetkilendirme hatası:', err);
    res.status(500).render('errors/500', { message: 'Yetkilendirme hatası' });
  }
};

// ===== UTILITY FUNCTIONS =====
const isDeadlinePassed = (deadline) => new Date() > new Date(deadline);

// UTC kayması olmadan yerel tarih string'i
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const calculateSundayDeadline = () => {
  const today = new Date();
  // Her zaman BU haftanın Pazar 23:59'u (gelecek hafta için kayıt kapanışı)
  const day = today.getDay(); // 0=Pazar
  const daysUntilSunday = day === 0 ? 0 : (7 - day);
  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + daysUntilSunday);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

// ===== ROUTES =====

// HOME / LOGIN
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error') });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return err;
    res.redirect('/login');
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
    const todayForRange = new Date();
    const todayDay = todayForRange.getDay(); // 0=Pazar
    const daysUntilNextMonday = todayDay === 0 ? 1 : (8 - todayDay);
    const nextMondayDate = new Date(todayForRange);
    nextMondayDate.setDate(todayForRange.getDate() + daysUntilNextMonday);
    nextMondayDate.setHours(0, 0, 0, 0);
    const nextSundayDate = new Date(nextMondayDate);
    nextSundayDate.setDate(nextMondayDate.getDate() + 6);
    nextSundayDate.setHours(23, 59, 59, 999);

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

    // Format events response
    const formattedEvents = events.map(event => ({
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
      registration_deadline: event.registration_deadline,
      deadline_passed: isDeadlinePassed(event.registration_deadline),
      user_registration: registrations[event.id] || null
    }));

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
        confirmed_times: confirmedTimes
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
    const teamsResult = await pool.query(
      'SELECT t.* FROM teams t WHERE t.leader_id = $1 OR $2::boolean',
      [req.user.id, req.user.role === 'ADMIN']
    );

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

    // Validate inputs
    if (!title || !location || !event_date || !start_time || !end_time || !capacity || !team_id) {
      return res.status(400).render('events/create', {
        error: 'Tüm alanları doldurunuz',
        led_teams: []
      });
    }

    if (end_time <= start_time) {
      return res.status(400).render('events/create', {
        error: 'Bitiş saati başlangıç saatinden sonra olmalı',
        led_teams: []
      });
    }

    // Calculate deadline (next Sunday 23:59)
    const deadline = calculateSundayDeadline();

    const result = await pool.query(
      `INSERT INTO events (title, description, location, event_date, start_time, end_time, capacity, leader_id, team_id, registration_deadline, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
       RETURNING id`,
      [title, description, location, event_date, start_time, end_time, capacity, req.user.id, team_id, deadline]
    );

    res.redirect('/dashboard');
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

// ===== MARK ATTENDANCE (API) =====
app.post('/api/event/:id/attendance/mark', isSenior, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { user_id, attended } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id gerekli' });
    }

    // Check if event exists and user can mark
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];

    // Check authorization
    if (req.user.id !== event.leader_id && req.user.role !== 'ADMIN' && req.user.hierarchy_level !== 'COORDINATOR') {
      return res.status(403).json({ success: false, error: 'Yetkilendirme hatası' });
    }

    // Check if user is registered
    const regResult = await pool.query(
      'SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status = $3',
      [eventId, user_id, 'CONFIRMED']
    );

    if (regResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Kullanıcı bu etkinliğe kayıtlı değil' });
    }

    // Upsert attendance
    const query = `
      INSERT INTO event_attendance (event_id, user_id, marked_by, attended)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (event_id, user_id) DO UPDATE SET
        attended = $4,
        marked_by = $3,
        marked_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [eventId, user_id, req.user.id, attended]);

    // Update points if attendance changed
    if (attended) {
      // Check if already has points transaction
      const pointsCheck = await pool.query(
        'SELECT id FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3',
        [eventId, user_id, 'ATTENDANCE']
      );

      if (pointsCheck.rows.length === 0) {
        await pool.query('UPDATE users SET points = points + 1 WHERE id = $1', [user_id]);
        await pool.query(
          `INSERT INTO point_transactions (user_id, event_id, points_change, reason, edited_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [user_id, eventId, 1, 'ATTENDANCE', req.user.id]
        );
      }
    } else {
      // Remove points if no show
      const pointsCheck = await pool.query(
        'SELECT id FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3',
        [eventId, user_id, 'NO_SHOW']
      );

      if (pointsCheck.rows.length === 0) {
        await pool.query('UPDATE users SET points = points - 1 WHERE id = $1', [user_id]);
        await pool.query(
          `INSERT INTO point_transactions (user_id, event_id, points_change, reason, edited_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [user_id, eventId, -1, 'NO_SHOW', req.user.id]
        );
      }
    }

    res.json({
      success: true,
      message: 'Yoklama kaydedildi',
      data: result.rows[0]
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

    res.render('admin/panel', {
      users: usersResult.rows,
      teams: teamsResult.rows,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ===== CREATE USER (ADMIN) =====
app.get('/admin/user/new', isAdmin, async (req, res) => {
  try {
    const teamsResult = await pool.query('SELECT * FROM teams');
    const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1', ['JUNIOR']);

    res.render('admin/create_user', {
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
    const { username, email, full_name, password, hierarchy_level, teams: teamIds, body_for } = req.body;

    // Check if username exists
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      const teamsResult = await pool.query('SELECT * FROM teams');
      const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1', ['JUNIOR']);
      return res.render('admin/create_user', { 
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
      'COORDINATOR': 'SENIOR',
      'PRESIDENT': 'ADMIN'
    };

    const role = roleMap[hierarchy_level] || 'VOLUNTEER';

    // Insert user
    const userResult = await pool.query(
      `INSERT INTO users (username, email, full_name, password_hash, hierarchy_level, role, body_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [username, email, full_name, hashedPassword, hierarchy_level, role, body_for || null]
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

// ===== ATTENDANCE (YOKLAMA) =====

const isDeadlinePassedForAttendance = (eventDate, eventTime) => {
  const now = new Date();
  const eventDT = new Date(`${eventDate}T${eventTime}`);
  return now > eventDT; // Etkinlik zamanı geçtimi?
};

const isSundayAfterDeadline = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Pazar, 6=Cumartesi
  const currentHour = now.getHours();
  
  // Pazar AND saat >= 12
  return currentDay === 0 && currentHour >= 12;
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
    const eventDateStr = event.event_date.toISOString().split('T')[0];
    const deadlinePassedForEvent = isDeadlinePassedForAttendance(eventDateStr, event.start_time);
    const sundayAfterDeadline = isSundayAfterDeadline();

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
});
