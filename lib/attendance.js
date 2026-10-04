// ===== YOKLAMA + QR TOKEN YARDIMCISI =====
// Tek puan politikası: katılım +5, gelmedi -10 (canlı attendance akışıyla aynı).
const crypto = require('crypto');
const pool = require('../database');

const ATTEND_POINTS = 5;
const NOSHOW_POINTS = -10;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 dakika

// Yoklamayı işaretle + puanı yaz (idempotent upsert; puan ters çevirme dahil)
async function markAttendance(eventId, userId, markedBy, attended) {
  const pointsChange = attended ? ATTEND_POINTS : NOSHOW_POINTS;

  await pool.query(
    `INSERT INTO event_attendance (event_id, user_id, marked_by, attended, marked_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (event_id, user_id) DO UPDATE SET
       attended = $4, marked_by = $3, marked_at = CURRENT_TIMESTAMP`,
    [eventId, userId, markedBy, attended]
  );

  // Önceki puan işlemini geri al (varsa)
  const existing = await pool.query(
    'SELECT points_change FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3',
    [eventId, userId, 'ATTENDANCE']
  );
  if (existing.rows.length > 0) {
    const oldPoints = existing.rows[0].points_change;
    await pool.query('UPDATE users SET points = points - $1 WHERE id = $2', [oldPoints, userId]);
    await pool.query(
      'DELETE FROM point_transactions WHERE event_id = $1 AND user_id = $2 AND reason = $3',
      [eventId, userId, 'ATTENDANCE']
    );
  }

  await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [pointsChange, userId]);
  await pool.query(
    `INSERT INTO point_transactions (user_id, event_id, points_change, reason, edited_by)
     VALUES ($1, $2, $3, 'ATTENDANCE', $4)`,
    [userId, eventId, pointsChange, markedBy]
  );
}

// Yeni QR token üret: raw token yalnızca URL'de döner, DB'de SHA-256 hash tutulur
async function createAttendanceToken(eventId, userId) {
  const raw = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO attendance_tokens (event_id, token_hash, expires_at, created_by)
     VALUES ($1, $2, $3, $4)`,
    [eventId, hash, expiresAt, userId]
  );
  return { raw, expiresAt };
}

// Geçerli (süresi dolmamış) token bul → {token, event} | null
async function consumeAttendanceToken(raw) {
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const result = await pool.query(
    `SELECT t.id, t.event_id, t.expires_at, t.used_count, e.title as event_title, e.event_date, e.capacity
     FROM attendance_tokens t
     JOIN events e ON e.id = t.event_id
     WHERE t.token_hash = $1`,
    [hash]
  );
  if (result.rows.length === 0) return null;
  const token = result.rows[0];
  if (new Date(token.expires_at) <= new Date()) return { token, event: null, expired: true };
  await pool.query('UPDATE attendance_tokens SET used_count = used_count + 1 WHERE id = $1', [token.id]);
  return { token, event: { id: token.event_id, title: token.event_title }, expired: false };
}

module.exports = { markAttendance, createAttendanceToken, consumeAttendanceToken, ATTEND_POINTS, NOSHOW_POINTS };
