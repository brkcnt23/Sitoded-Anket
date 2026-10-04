-- ========================================
-- Sitoded Anket - Anket Modülü Migration (Faz 1)
-- Canlı DB'ye uygulanır: docker exec -i sitoded_postgres psql -U sitoded_user -d sitoded_anket -f - < migration-surveys.sql
-- Idempotent: tekrar çalıştırılabilir.
-- ========================================

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

SELECT 'Anket modülü migration tamamlandı ✅' as status;
