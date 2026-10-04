-- ========================================
-- Sitoded Anket - Faz 2-5 Migration
-- Canlı DB'ye uygulanır: docker exec -i sitoded_postgres psql -U sitoded_user -d sitoded_anket -f - < migration-faz2-5.sql
-- Idempotent: tekrar çalıştırılabilir.
-- ========================================

-- ---- FAZ 3: Üye yaşam döngüsü + DERBİS ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_since DATE,
  ADD COLUMN IF NOT EXISTS resigned_at DATE,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
  ADD COLUMN IF NOT EXISTS disadvantaged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS passport_no VARCHAR(40),
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS visa_status TEXT,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- ---- FAZ 4: QR yoklama tokenları ----
CREATE TABLE IF NOT EXISTS attendance_tokens (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hex (raw token diskte/DB'de saklanmaz)
  expires_at TIMESTAMP NOT NULL,
  used_count INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attendance_tokens_event ON attendance_tokens(event_id);

-- ---- FAZ 4: Anket ↔ etkinlik bağı (otomatik değerlendirme anketi) ----
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;

-- ---- FAZ 5: Youthpass öğrenme çıktıları ----
CREATE TABLE IF NOT EXISTS youthpass_outcomes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competence_key VARCHAR(30) NOT NULL, -- 8 anahtar yetkinlik anahtarı
  outcome_text TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, competence_key)
);

SELECT 'Faz 2-5 migration tamamlandı ✅' as status;
