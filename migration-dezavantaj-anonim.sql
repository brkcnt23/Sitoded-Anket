-- Dezavantajlılık açıklaması + şikayet/öneri anonim gönderim (2026-10-04)
ALTER TABLE users ADD COLUMN IF NOT EXISTS disadvantaged_note VARCHAR(255);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
