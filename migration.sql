-- ========================================
-- Sitoded Anket - Database Migration
-- Run this script to update your database
-- ========================================

-- Add time columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL DEFAULT '15:00';

-- Pazar açılış sistemi: başvuru açılış zamanı (12:00 veya 19:00, 5 saatlik pencere)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS registration_open TIMESTAMP;

-- Eski kayıtlar: açılış = eski deadline (hepsi geçmiş etkinlik, görünürlüğü etkilemez)
UPDATE events SET registration_open = registration_deadline WHERE registration_open IS NULL;

-- O Pazar günü açılacak tüm etkinlikler için TEK ortak rastgele saat (12:00/19:00)
CREATE TABLE IF NOT EXISTS weekly_openings (
  opening_sunday DATE PRIMARY KEY,
  open_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Change event_date from TIMESTAMP to DATE if it was TIMESTAMP
-- PostgreSQL: You may need to do this carefully
-- ALTER TABLE events ALTER COLUMN event_date TYPE DATE;

-- Add constraint for time validation
ALTER TABLE events 
ADD CONSTRAINT check_event_times CHECK (end_time > start_time);

-- Update event_registrations table with new columns
ALTER TABLE event_registrations 
ADD COLUMN IF NOT EXISTS cancelled_after_deadline BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requeued_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

-- Create event_attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marked_by INTEGER NOT NULL REFERENCES users(id),
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- Create point_transactions table
CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  points_change INTEGER NOT NULL,
  reason VARCHAR(50), -- 'ATTENDANCE', 'NO_SHOW', 'MANUAL_EDIT', 'LATE_CANCEL'
  edited_by INTEGER REFERENCES users(id), -- NULL if system
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_event ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON event_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_points_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_event ON point_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_registrations_registered_at ON event_registrations(registered_at);

-- ===================== ANKET MODÜLÜ (Faz 1) =====================
-- Canlı DB'ye migration-surveys.sql dosyasıyla uygulanır (bu blok belge niteliğindedir).

CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  slug VARCHAR(16) UNIQUE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'CLOSED', -- OPEN / CLOSED
  collect_identity BOOLEAN NOT NULL DEFAULT FALSE,
  kvkk_text TEXT NOT NULL DEFAULT '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, bu form aracılığıyla paylaştığım bilgilerin, fotoğraf ve/veya videolarımın SİTODED Erzurum tarafından işlenmesine ve saklanmasına açık rızamla onay veriyorum. Verilerimin üçüncü kişilerle paylaşılmayacağını biliyorum.',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_survey_status CHECK (status IN ('OPEN','CLOSED'))
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(survey_id, position),
  CONSTRAINT check_question_type CHECK (type IN ('TEXT_SHORT','TEXT_LONG','SINGLE_CHOICE','MULTI_CHOICE','DATE','NUMBER','PHOTO','VIDEO'))
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_name VARCHAR(120),
  respondent_email VARCHAR(120),
  kvkk_consent BOOLEAN NOT NULL,
  kvkk_consent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  value TEXT,
  file_path VARCHAR(255),
  file_name VARCHAR(255),
  file_mime VARCHAR(100),
  file_size INTEGER,
  UNIQUE(response_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON survey_answers(question_id);

-- Success message
SELECT 'Migration completed successfully! ✅' as status;
