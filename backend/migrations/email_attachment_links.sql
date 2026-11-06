-- Email campaigns: large files and video/audio are sent as a secure download link instead of an
-- inline attachment. Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
ALTER TABLE outreach_campaign_attachments
    ADD COLUMN delivery ENUM('attach','link') NOT NULL DEFAULT 'attach',
    ADD COLUMN share_token VARCHAR(64) NULL DEFAULT NULL,
    ADD UNIQUE KEY uq_oca_share_token (share_token);
