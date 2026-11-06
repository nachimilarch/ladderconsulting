-- WhatsApp campaigns: an image / video / PDF that goes in the template's header.
-- NOT VERIFIED against Vaartabot (no public documentation found): the feature is OFF by default.
-- Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
ALTER TABLE outreach_campaigns
    ADD COLUMN header_media_path  VARCHAR(500) NULL DEFAULT NULL,
    ADD COLUMN header_media_mime  VARCHAR(100) NULL DEFAULT NULL,
    ADD COLUMN header_media_name  VARCHAR(255) NULL DEFAULT NULL,
    ADD COLUMN header_media_token VARCHAR(64)  NULL DEFAULT NULL,
    ADD UNIQUE KEY uq_oc_header_media_token (header_media_token);

INSERT IGNORE INTO platform_settings (setting_key, value) VALUES
    ('whatsapp_media_header_enabled', 'false'),
    ('vaartabot_media_param', 'headerMediaUrl');
