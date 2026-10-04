// Ortak yetkilendirme middleware'leri — server.js ve tüm lib/* router'ları buradan kullanır.
const pool = require('../database');

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Giriş yapılmamışsa: API'ye JSON 401, sayfaya login yönlendirmesi (403 yerine)
const handleNotLoggedIn = (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(401).json({ success: false, error: 'Giriş gerekli' });
  }
  res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) return handleNotLoggedIn(req, res);
  if (req.user.role === 'ADMIN') {
    return next();
  }
  res.status(403).render('errors/forbidden', { message: 'Yetkilendirme hatası' });
};

const isSenior = (req, res, next) => {
  if (!req.isAuthenticated()) return handleNotLoggedIn(req, res);
  if (req.user.role === 'ADMIN' || req.user.role === 'SENIOR') {
    return next();
  }
  res.status(403).render('errors/forbidden', { message: 'Yetkilendirme hatası' });
};

const isAdminOrEventLeader = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return handleNotLoggedIn(req, res);
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

module.exports = { isAuthenticated, isAdmin, isSenior, isAdminOrEventLeader };
