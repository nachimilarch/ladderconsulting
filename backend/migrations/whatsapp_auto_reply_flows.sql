-- WhatsApp auto-reply flows
-- Keyword/event triggers → auto-send a template or free-text reply

CREATE TABLE IF NOT EXISTS whatsapp_auto_reply_flows (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_by    INT UNSIGNED NOT NULL,
    flow_name     VARCHAR(255) NOT NULL,
    trigger_type  ENUM('keyword','any','first_contact') NOT NULL DEFAULT 'keyword',
    trigger_keywords JSON,          -- array of strings; used when trigger_type = 'keyword'
    match_type    ENUM('exact','contains','starts_with') NOT NULL DEFAULT 'contains',
    response_type ENUM('template','text') NOT NULL DEFAULT 'template',
    template_id   INT UNSIGNED DEFAULT NULL,  -- FK whatsapp_templates.id
    response_text TEXT         DEFAULT NULL,  -- free-text reply when response_type = 'text'
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    deleted_at    DATETIME     DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by)  REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES whatsapp_templates(id)
);
