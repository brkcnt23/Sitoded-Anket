require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const pool = require('./database');

const app = express();

// ===== SECURITY MIDDLEWARE =====
app.use(helmet());
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
    if (err) return next(err);
    res.redirect('/login');
  });
});

// DASHBOARD
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    // Get user's teams
    const teamsResult = await pool.query(
      'SELECT team_id FROM user_teams WHERE user_id = $1',
      [req.user.id]
    );
    const teamIds = teamsResult.rows.map(row => row.team_id);

    // Get upcoming events
    let eventsQuery = `
      SELECT e.*, t.name as team_name, u.full_name as leader_name
      FROM events e
      JOIN teams t ON e.team_id = t.id
      JOIN users u ON e.leader_id = u.id
      WHERE e.status = 'ACTIVE' AND e.event_date >= NOW()
    `;

    if (teamIds.length > 0) {
      eventsQuery += ` AND e.team_id = ANY($1)`;
    }

    eventsQuery += ` ORDER BY e.event_date ASC`;

    const eventsResult = teamIds.length > 0
      ? await pool.query(eventsQuery, [teamIds])
      : await pool.query(eventsQuery);

    // Get user's registrations
    const registrationsResult = await pool.query(
      `SELECT er.event_id, er.status 
       FROM event_registrations er 
       WHERE er.user_id = $1 AND er.status IN ('REGISTERED', 'CONFIRMED')`,
      [req.user.id]
    );

    const registeredEventIds = registrationsResult.rows.map(row => row.event_id);

    res.render('dashboard', {
      user: req.user,
      events: eventsResult.rows,
      registeredEventIds
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// ADMIN PANEL
app.get('/admin', isAdmin, async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const teamsResult = await pool.query('SELECT * FROM teams');

    res.render('admin/panel', {
      users: usersResult.rows,
      teams: teamsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// CREATE USER (ADMIN)
app.get('/admin/user/new', isAdmin, async (req, res) => {
  try {
    const teamsResult = await pool.query('SELECT * FROM teams');
    const juniorsResult = await pool.query('SELECT * FROM users WHERE hierarchy_level = $1', ['JUNIOR']);

    res.render('admin/create_user', {
      teams: teamsResult.rows,
      juniors: juniorsResult.rows
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
      return res.render('admin/create_user', { 
        error: 'Bu kullanıcı adı zaten kullanılmaktadır',
        teams: [],
        juniors: []
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

// CREATE EVENT
app.get('/events/create', isSenior, async (req, res) => {
  try {
    const teamsResult = await pool.query(
      'SELECT t.* FROM teams t JOIN users u ON t.leader_id = u.id WHERE u.id = $1',
      [req.user.id]
    );

    res.render('events/create', { led_teams: teamsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

app.post('/events/create', isSenior, async (req, res) => {
  try {
    const { title, description, location, event_date, capacity, team_id } = req.body;

    // Calculate deadline (next Sunday midnight)
    const eventDateTime = new Date(event_date);
    const today = new Date();
    const daysUntilSunday = (6 - today.getDay()) % 7 || 7;
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + daysUntilSunday);
    deadline.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `INSERT INTO events (title, description, location, event_date, capacity, leader_id, team_id, registration_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [title, description, location, eventDateTime, capacity, req.user.id, team_id, deadline]
    );

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { message: 'Bir hata oluştu' });
  }
});

// REGISTER FOR EVENT
app.post('/event/:id/register', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Get event
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];

    // Check deadline
    if (new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ error: 'Kayıt süresi sona ermiştir' });
    }

    // Check if already registered
    const existingReg = await pool.query(
      'SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, req.user.id]
    );

    if (existingReg.rows.length > 0) {
      return res.status(400).json({ error: 'Zaten kayıtlısınız' });
    }

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
        'SELECT COUNT(*) FROM event_registrations WHERE event_id = $1 AND status = $2',
        [eventId, 'REGISTERED']
      );
      queuePosition = parseInt(queueResult.rows[0].count) + 1;
    }

    await pool.query(
      'INSERT INTO event_registrations (event_id, user_id, status, queue_position) VALUES ($1, $2, $3, $4)',
      [eventId, req.user.id, status, queuePosition]
    );

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bir hata oluştu' });
  }
});

// UNREGISTER FROM EVENT
app.post('/event/:id/unregister', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;

    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];

    // Check if deadline passed
    if (new Date() > new Date(event.registration_deadline)) {
      // Apply penalty
      await pool.query('UPDATE users SET points = points - 1 WHERE id = $1', [req.user.id]);
    }

    // Cancel registration
    await pool.query(
      'UPDATE event_registrations SET status = $1, cancelled_at = NOW() WHERE event_id = $2 AND user_id = $3',
      ['CANCELLED', eventId, req.user.id]
    );

    // Move queue if necessary
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

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bir hata oluştu' });
  }
});

// VIEW EVENT REGISTRATIONS
app.get('/event/:id/registrations', isAuthenticated, async (req, res) => {
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
      `SELECT er.*, u.full_name, u.email
       FROM event_registrations er
       JOIN users u ON er.user_id = u.id
       WHERE er.event_id = $1
       ORDER BY er.status DESC, er.registered_at ASC`,
      [eventId]
    );

    res.render('events/registrations', {
      event,
      registrations: registrationsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500');
  }
});

// CANCEL EVENT
app.post('/event/:id/cancel', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;

    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Etkinlik bulunamadı' });
    }

    const event = eventResult.rows[0];

    if (req.user.id !== event.leader_id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yetkilendirme hatası' });
    }

    await pool.query('UPDATE events SET status = $1 WHERE id = $2', ['CANCELLED', eventId]);

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bir hata oluştu' });
  }
});

// ERROR HANDLERS
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
