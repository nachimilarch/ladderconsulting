-- WhatsApp inbox: media received and sent, a two-way conversation log, and raw webhook capture.
-- Run once (MySQL 8.0 has no ADD COLUMN IF NOT EXISTS).

ALTER TABLE outreach_email_replies
    ADD COLUMN msg_type       VARCHAR(20)  NULL AFTER channel,
    ADD COLUMN media_key      VARCHAR(500) NULL,
    ADD COLUMN media_mime     VARCHAR(120) NULL,
    ADD COLUMN media_filename VARCHAR(255) NULL,
    ADD COLUMN media_size     INT UNSIGNED NULL,
    ADD INDEX idx_replies_phone (channel, from_phone, received_at);

-- Messages WE send from the inbox, so a WhatsApp conversation can be shown in both directions.
CREATE TABLE IF NOT EXISTS whatsapp_outbound_messages (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    phone            VARCHAR(20)  NOT NULL,
    contact_id       INT UNSIGNED NULL,
    reply_id         INT UNSIGNED NULL,
    campaign_id      INT UNSIGNED NULL,
    sent_by          INT UNSIGNED NULL,
    body_text        TEXT         NULL,
    msg_type         VARCHAR(20)  NOT NULL DEFAULT 'text',
    media_key        VARCHAR(500) NULL,
    media_mime       VARCHAR(120) NULL,
    media_filename   VARCHAR(255) NULL,
    media_size       INT UNSIGNED NULL,
    share_token      CHAR(48)     NULL,
    share_expires_at DATETIME     NULL,
    wa_message_id    VARCHAR(200) NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at       DATETIME     NULL,
    UNIQUE KEY uq_wa_out_token (share_token),
    KEY idx_wa_out_phone (phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Short-lived copy of every Vaartabot webhook event, kept 30 days so an unfamiliar payload
-- (for example a media message) can be inspected and re-processed. Pruned automatically.
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event      VARCHAR(60)  NULL,
    payload    JSON         NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wa_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
