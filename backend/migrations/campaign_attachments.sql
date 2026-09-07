CREATE TABLE IF NOT EXISTS outreach_campaign_attachments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    mime_type   VARCHAR(100) NOT NULL,
    file_size   INT NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    KEY idx_campaign (campaign_id)
);
