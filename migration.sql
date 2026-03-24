-- ========================================
-- Sitoded Anket - Database Migration
-- Run this script to update your database
-- ========================================

-- Add time columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL DEFAULT '15:00';

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

-- Success message
SELECT 'Migration completed successfully! ✅' as status;
