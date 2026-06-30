-- Bulk Resume Sourcing (executive uploads resumes against a company JD)
-- Run on: ladder_consulting
-- Note: MySQL 8.0 — plain ALTER TABLE (no IF NOT EXISTS). Run only once.

-- Track who sourced an application: candidate self-applied vs executive-uploaded
ALTER TABLE applications
    ADD COLUMN source ENUM('candidate', 'executive') NOT NULL DEFAULT 'candidate' AFTER cover_letter,
    ADD COLUMN sourced_by INT UNSIGNED NULL AFTER source,
    ADD CONSTRAINT fk_app_sourced_by FOREIGN KEY (sourced_by) REFERENCES users (id);

-- One row per bulk upload action by an executive
CREATE TABLE resume_upload_batches (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_id          INT UNSIGNED NOT NULL,
    uploaded_by     INT UNSIGNED NOT NULL,
    total_files     INT NOT NULL DEFAULT 0,
    processed_files INT NOT NULL DEFAULT 0,
    created_count   INT NOT NULL DEFAULT 0,
    skipped_count   INT NOT NULL DEFAULT 0,
    failed_count    INT NOT NULL DEFAULT 0,
    status          ENUM('processing', 'done', 'failed') NOT NULL DEFAULT 'processing',
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    KEY fk_rub_job (job_id),
    KEY fk_rub_user (uploaded_by),
    CONSTRAINT fk_rub_job  FOREIGN KEY (job_id)      REFERENCES job_postings (id),
    CONSTRAINT fk_rub_user FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per resume file inside a batch
CREATE TABLE resume_upload_items (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    batch_id        INT UNSIGNED NOT NULL,
    file_name       VARCHAR(255) DEFAULT NULL,
    file_key        VARCHAR(500) DEFAULT NULL,
    file_size       INT DEFAULT NULL,
    mime_type       VARCHAR(100) DEFAULT NULL,
    status          ENUM('pending', 'parsing', 'done', 'skipped', 'failed') NOT NULL DEFAULT 'pending',
    error_message   VARCHAR(500) DEFAULT NULL,
    candidate_id    INT UNSIGNED DEFAULT NULL,
    application_id  INT UNSIGNED DEFAULT NULL,
    extracted_name  VARCHAR(150) DEFAULT NULL,
    extracted_email VARCHAR(191) DEFAULT NULL,
    fit_score       INT DEFAULT NULL,
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_rui_batch (batch_id),
    CONSTRAINT fk_rui_batch FOREIGN KEY (batch_id) REFERENCES resume_upload_batches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
