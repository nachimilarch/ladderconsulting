-- Local-LLM (Ollama) additions that sit alongside the offline parser and score formula.
-- 1. resumes: the model's suggested profile details, shown to the candidate to accept.
-- 2. match_insights: a cached one-paragraph "why this fit" note per job + candidate.
-- 3. two platform_settings switches so admin can turn either feature off.
-- ADD COLUMN IF NOT EXISTS is not supported in MySQL 8.0: run once per database.

ALTER TABLE resumes
    ADD COLUMN llm_status ENUM('pending','done','failed','skipped') NULL,
    ADD COLUMN llm_extract JSON NULL,
    ADD COLUMN llm_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS match_insights (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_id INT UNSIGNED NOT NULL,
    candidate_id INT UNSIGNED NOT NULL,
    fit_score INT NOT NULL,
    note TEXT NOT NULL,
    model VARCHAR(64) NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_match_insight (job_id, candidate_id),
    CONSTRAINT fk_mi_job FOREIGN KEY (job_id) REFERENCES job_postings(id),
    CONSTRAINT fk_mi_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO platform_settings (setting_key, value, description) VALUES
    ('llm_resume_enrichment', 'true', 'Let the local AI model suggest extra profile details after a candidate uploads a resume.'),
    ('llm_match_insight', 'true', 'Let companies ask the local AI model why a top candidate fits (or not) a job.')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
