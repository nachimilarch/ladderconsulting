-- Candidate management (HR + Admin): remember who added a candidate by hand,
-- so an HR executive's "Candidates" page can be limited to their own.
-- Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
ALTER TABLE candidates
    ADD COLUMN created_by_user_id INT UNSIGNED NULL DEFAULT NULL AFTER user_id,
    ADD KEY idx_candidates_created_by (created_by_user_id);
