-- Outreach AI: a store for background AI writing tasks, and two platform switches.
-- Run once per database.

CREATE TABLE IF NOT EXISTS ai_tasks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    kind VARCHAR(40) NOT NULL,
    input JSON NULL,
    status ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
    result JSON NULL,
    error VARCHAR(300) NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME NULL,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_ai_tasks_user (user_id, kind, created_at),
    CONSTRAINT fk_ai_tasks_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO platform_settings (setting_key, value, description) VALUES
    ('outreach_ai_enabled', 'true', 'Let outreach staff use the AI writing helpers (campaign copy, subject lines, follow-ups, WhatsApp templates, reply drafts, call scripts, insights).'),
    ('campaign_scheduler_enabled', 'true', 'Automatically send campaigns at their scheduled time. Turn off to hold every scheduled campaign.')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
