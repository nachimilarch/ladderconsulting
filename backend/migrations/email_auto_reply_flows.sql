-- Email Auto-Reply Flows
-- Triggered by mailPoller after saving an inbound email reply.
-- Unlike WA, email supports free-text responses (no template restriction).

CREATE TABLE IF NOT EXISTS email_auto_reply_flows (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    created_by        INT UNSIGNED NOT NULL,
    flow_name         VARCHAR(255) NOT NULL,
    trigger_type      ENUM('keyword','any','first_contact') NOT NULL DEFAULT 'keyword',
    trigger_keywords  JSON,
    match_type        ENUM('exact','contains','starts_with') NOT NULL DEFAULT 'contains',
    response_subject  VARCHAR(500),
    response_body     TEXT NOT NULL,
    is_active         TINYINT(1) NOT NULL DEFAULT 1,
    deleted_at        DATETIME DEFAULT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_earf_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Track whether mailPoller already fired an auto-reply for an inbound email
-- (prevents duplicate auto-replies if the poller re-processes a message)
ALTER TABLE outreach_email_replies
    ADD COLUMN IF NOT EXISTS auto_reply_sent TINYINT(1) NOT NULL DEFAULT 0;
