-- Candidate job status ("looking" / "working, open to offers" / "working, not looking")
-- with a timestamp and reminder bookkeeping, plus two admin settings.
-- Run once per database. MySQL 8.0 has no ADD COLUMN IF NOT EXISTS.

ALTER TABLE candidates
    ADD COLUMN employment_status ENUM('looking','open','working') NULL DEFAULT NULL,
    ADD COLUMN employment_status_updated_at DATETIME NULL,
    ADD COLUMN status_reminders_sent TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN status_last_reminder_at DATETIME NULL;

-- Reminders ship switched OFF; an admin turns them on from Platform Settings.
INSERT INTO platform_settings (setting_key, value, description) VALUES
    ('candidate_status_reminders_enabled', 'false', 'Email and notify candidates who have logged in before, asking them to update whether they are working or looking for a job. At most 3 reminders, 14 days apart, sent in business hours (IST).'),
    ('candidate_status_refresh_days', '30', 'Days before a candidate who is looking or open to offers is asked to confirm their job status again. Candidates who are working (not looking) are asked after three times this long.')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
