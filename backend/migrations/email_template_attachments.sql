-- Attachments (PDF / images / Word) saved on an email template.
-- They are copied onto a campaign when the campaign is created from that template.
CREATE TABLE IF NOT EXISTS email_template_attachments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  mime_type   VARCHAR(100) NOT NULL,
  file_size   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP NULL DEFAULT NULL,
  KEY idx_template (template_id)
);
