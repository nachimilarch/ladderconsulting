-- ============================================================
-- Cold Outreach Module — DB Migrations — 2026-06-04
-- Run once against the ladder_consulting database.
-- ============================================================

-- 3.1 Contact Lists
CREATE TABLE IF NOT EXISTS outreach_contact_lists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uploaded_by INT UNSIGNED NOT NULL,
  list_name VARCHAR(255) NOT NULL,
  description TEXT,
  file_key VARCHAR(500) DEFAULT NULL,
  file_name VARCHAR(255) DEFAULT NULL,
  total_contacts INT DEFAULT 0,
  imported_contacts INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  import_status ENUM('pending','processing','done','failed') DEFAULT 'pending',
  import_errors JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 3.2 Contacts
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  list_id INT UNSIGNED NOT NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  full_name VARCHAR(200) DEFAULT NULL,
  email VARCHAR(191) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  whatsapp_number VARCHAR(20) DEFAULT NULL,
  company_name VARCHAR(200) DEFAULT NULL,
  designation VARCHAR(150) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  source VARCHAR(100) DEFAULT 'excel_upload',
  tags JSON DEFAULT NULL,
  is_unsubscribed TINYINT(1) DEFAULT 0,
  unsubscribed_at DATETIME DEFAULT NULL,
  lead_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (list_id) REFERENCES outreach_contact_lists(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- 3.3 Campaigns
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_by INT UNSIGNED NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type ENUM('email','whatsapp','call') NOT NULL,
  list_id INT UNSIGNED NOT NULL,
  subject VARCHAR(500) DEFAULT NULL,
  message_body TEXT,
  from_email VARCHAR(191) DEFAULT NULL,
  from_name VARCHAR(100) DEFAULT NULL,
  reply_to_tag VARCHAR(100) DEFAULT NULL,
  whatsapp_template_id INT UNSIGNED DEFAULT NULL,
  variable_mapping JSON DEFAULT NULL,
  scheduled_at DATETIME DEFAULT NULL,
  sent_at DATETIME DEFAULT NULL,
  status ENUM('draft','scheduled','sending','sent','paused','failed') DEFAULT 'draft',
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  reply_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (list_id) REFERENCES outreach_contact_lists(id)
);

-- 3.4 Campaign Logs
CREATE TABLE IF NOT EXISTS outreach_campaign_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  contact_id INT UNSIGNED NOT NULL,
  channel ENUM('email','whatsapp','call') NOT NULL,
  status ENUM('pending','sent','failed','replied','bounced','unsubscribed') DEFAULT 'pending',
  sent_at DATETIME DEFAULT NULL,
  replied_at DATETIME DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  whatsapp_message_id VARCHAR(255) DEFAULT NULL,
  email_message_id VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES outreach_campaigns(id),
  FOREIGN KEY (contact_id) REFERENCES outreach_contacts(id)
);

-- 3.5 Email / WhatsApp Replies (unified)
CREATE TABLE IF NOT EXISTS outreach_email_replies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED DEFAULT NULL,
  campaign_log_id INT UNSIGNED DEFAULT NULL,
  contact_id INT UNSIGNED DEFAULT NULL,
  assigned_to INT UNSIGNED DEFAULT NULL,
  channel ENUM('email','whatsapp') DEFAULT 'email',
  from_email VARCHAR(191) DEFAULT NULL,
  from_name VARCHAR(200) DEFAULT NULL,
  from_phone VARCHAR(20) DEFAULT NULL,
  subject VARCHAR(500) DEFAULT NULL,
  body_text TEXT,
  body_html TEXT,
  received_at DATETIME NOT NULL,
  in_reply_to VARCHAR(500) DEFAULT NULL,
  message_id VARCHAR(500) DEFAULT NULL,
  thread_id VARCHAR(500) DEFAULT NULL,
  reply_status ENUM('unread','read','replied','converted','ignored') DEFAULT 'unread',
  lead_id INT UNSIGNED DEFAULT NULL,
  reply_note TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (campaign_id) REFERENCES outreach_campaigns(id),
  FOREIGN KEY (campaign_log_id) REFERENCES outreach_campaign_logs(id),
  FOREIGN KEY (contact_id) REFERENCES outreach_contacts(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- 3.6 Outreach Call Logs (distinct from call_logs which is for existing leads)
CREATE TABLE IF NOT EXISTS outreach_call_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED DEFAULT NULL,
  contact_id INT UNSIGNED NOT NULL,
  called_by INT UNSIGNED NOT NULL,
  called_at DATETIME NOT NULL,
  duration_secs INT DEFAULT 0,
  outcome ENUM('no_answer','voicemail','callback_scheduled','interested','not_interested','converted') NOT NULL,
  notes TEXT,
  callback_at DATETIME DEFAULT NULL,
  lead_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (campaign_id) REFERENCES outreach_campaigns(id),
  FOREIGN KEY (contact_id) REFERENCES outreach_contacts(id),
  FOREIGN KEY (called_by) REFERENCES users(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- 6.1 WhatsApp Templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_by INT UNSIGNED NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  language_code VARCHAR(10) DEFAULT 'en',
  category ENUM('MARKETING','UTILITY','AUTHENTICATION') DEFAULT 'MARKETING',
  header_type ENUM('none','text','image','document') DEFAULT 'none',
  header_content TEXT DEFAULT NULL,
  body_text TEXT NOT NULL,
  footer_text VARCHAR(255) DEFAULT NULL,
  variable_count INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 3.7 Extend leads table with outreach source columns
-- NOTE: ADD COLUMN IF NOT EXISTS is not supported in MySQL 8.0 (MariaDB-only).
-- Run each ALTER only if the column does not already exist.
ALTER TABLE leads
  ADD COLUMN source_type ENUM('manual','cold_email','cold_call','whatsapp','referral','portal','other') DEFAULT 'manual',
  ADD COLUMN outreach_contact_id INT UNSIGNED DEFAULT NULL,
  ADD COLUMN outreach_campaign_id INT UNSIGNED DEFAULT NULL;

-- 5.2 Extend employees table with per-executive outreach email
ALTER TABLE employees
  ADD COLUMN outreach_email VARCHAR(191) DEFAULT NULL,
  ADD COLUMN outreach_email_name VARCHAR(100) DEFAULT NULL;

-- 11 Platform settings for mail poller
INSERT IGNORE INTO platform_settings (setting_key, value, updated_by) VALUES
  ('mail_poller_enabled', 'true', 1),
  ('mail_poller_interval_mins', '2', 1);
