-- Create Tables for Sitoded Erzurum Volunteer Management System

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  leader_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  hierarchy_level VARCHAR(20) DEFAULT 'VOLUNTEER' NOT NULL, -- VOLUNTEER, JUNIOR, SENIOR, COORDINATOR, PRESIDENT
  role VARCHAR(20) DEFAULT 'VOLUNTEER' NOT NULL, -- ADMIN, SENIOR, JUNIOR, VOLUNTEER
  body_for INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Junior body assignment
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Teams Association (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_teams (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, team_id)
);

-- Events Table (UPDATED - added start_time and end_time)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200) NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '14:00',
  end_time TIME NOT NULL DEFAULT '15:00',
  capacity INTEGER NOT NULL,
  leader_id INTEGER NOT NULL REFERENCES users(id),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, CANCELLED, COMPLETED
  registration_deadline TIMESTAMP NOT NULL,
  registration_open TIMESTAMP, -- Başvuru açılışı (Pazar 12:00 veya 19:00); NULL = eski kayıt
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_event_times CHECK (end_time > start_time)
);

-- Event Registrations Table (UPDATED - added requeue tracking)
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'REGISTERED' NOT NULL, -- REGISTERED, CANCELLED, CONFIRMED, NO_SHOW
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  requeued_at TIMESTAMP,
  cancelled_after_deadline BOOLEAN DEFAULT FALSE,
  queue_position INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- Event Attendance Table (NEW - Yoklama)
CREATE TABLE IF NOT EXISTS event_attendance (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marked_by INTEGER NOT NULL REFERENCES users(id),
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- Weekly Openings Table (NEW - Pazar açılış sistemi)
-- O Pazar günü açılacak tüm etkinlikler TEK ortak rastgele saatte (12:00/19:00) açılır
CREATE TABLE IF NOT EXISTS weekly_openings (
  opening_sunday DATE PRIMARY KEY,
  open_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Point Transactions Table (NEW - Audit Trail)
CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  points_change INTEGER NOT NULL,
  reason VARCHAR(50), -- 'ATTENDANCE', 'NO_SHOW', 'MANUAL_EDIT', 'LATE_CANCEL'
  edited_by INTEGER REFERENCES users(id), -- NULL if system
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_events_team ON events(team_id);
CREATE INDEX IF NOT EXISTS idx_events_leader ON events(leader_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON event_registrations(status);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON event_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_points_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_event ON point_transactions(event_id);

-- Add Foreign Key for teams leader
ALTER TABLE teams ADD CONSTRAINT fk_teams_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;

-- ===================== ANKET MODÜLÜ (Faz 1) =====================

CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  slug VARCHAR(16) UNIQUE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'CLOSED', -- OPEN / CLOSED
  collect_identity BOOLEAN NOT NULL DEFAULT FALSE, -- "isim soyisim iste" → true; "sadece link üret" → false
  kvkk_text TEXT NOT NULL DEFAULT '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, bu form aracılığıyla paylaştığım bilgilerin, fotoğraf ve/veya videolarımın SİTODED Erzurum tarafından işlenmesine ve saklanmasına açık rızamla onay veriyorum. Verilerimin üçüncü kişilerle paylaşılmayacağını biliyorum.',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_survey_status CHECK (status IN ('OPEN','CLOSED'))
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- 0 tabanlı sıra
  type VARCHAR(20) NOT NULL, -- TEXT_SHORT, TEXT_LONG, SINGLE_CHOICE, MULTI_CHOICE, DATE, NUMBER, PHOTO, VIDEO
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
  respondent_name VARCHAR(120), -- yalnızca collect_identity=true iken istenir
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
  value TEXT, -- metin/sayı/tarih/çoktan seçmeli (JSON dizi string)
  file_path VARCHAR(255), -- uploads köküne göreli yol (örn. surveys/3/ab12cd34.jpg)
  file_name VARCHAR(255), -- orijinal dosya adı (yalnızca görüntüleme)
  file_mime VARCHAR(100),
  file_size INTEGER,
  UNIQUE(response_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON survey_answers(question_id);
