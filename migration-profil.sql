-- ========================================
-- SİTODED - ÜYE PROFİL TAMAMLAMA (2026-09-20)
-- Canlı DB'ye uygulanır: docker exec -i sitoded_postgres psql -U sitoded_user -d sitoded_anket -f - < migration-profil.sql
-- Idempotent.
-- ========================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city VARCHAR(80),
  ADD COLUMN IF NOT EXISTS school VARCHAR(160),
  ADD COLUMN IF NOT EXISTS department_grade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS languages VARCHAR(160),
  ADD COLUMN IF NOT EXISTS hobbies TEXT,
  ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS talents JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS passport_color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS volunteer_experience TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP;

SELECT 'Profil migration tamamlandı ✅' as status;
