-- Free Pool Resume Uploads (executive uploads resumes with no target JD yet)
-- Run on: ladder_consulting
-- Note: MySQL 8.0 — plain ALTER TABLE. Run only once.

-- A bulk upload batch no longer requires a job — NULL job_id means it was
-- uploaded straight into the free talent pool (no application is created).
ALTER TABLE resume_upload_batches
    MODIFY COLUMN job_id INT UNSIGNED NULL;
