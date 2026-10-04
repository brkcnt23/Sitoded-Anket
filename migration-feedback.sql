-- ========================================
-- SİTODED - ŞİKAYET & ÖNERİ (2026-09-20)
-- Canlı DB'ye uygulanır: docker exec -i sitoded_postgres psql -U sitoded_user -d sitoded_anket -f - < migration-feedback.sql
-- ========================================

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL = anonim
  kind VARCHAR(10) NOT NULL, -- SIKAYET / ONERI
  message TEXT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'NEW', -- NEW / READ / DONE
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

SELECT 'Feedback migration tamamlandı ✅' as status;
