-- Migration: AI chatbot conversation history + the propose->confirm write protocol.
-- The model is never given a tool that can directly mutate job_postings/
-- candidate_profiles — write tools only ever create a chatbot_pending_actions
-- row; a human must separately confirm it before the real action fires.
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/chatbot.sql

CREATE TABLE chatbot_conversations (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    persona     ENUM('company','candidate') NOT NULL,
    title       VARCHAR(200) NULL,
    created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_cc_user (user_id),
    CONSTRAINT fk_cc_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE chatbot_messages (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id INT UNSIGNED NOT NULL,
    role            ENUM('user','assistant','tool') NOT NULL,
    content         MEDIUMTEXT NULL,
    tool_calls      JSON NULL,
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cm_conversation (conversation_id),
    CONSTRAINT fk_cm_conversation FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE chatbot_pending_actions (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    action_type     ENUM('create_job','update_job','update_profile') NOT NULL,
    payload         JSON NOT NULL,
    preview_text    TEXT NOT NULL,
    status          ENUM('pending_confirmation','confirmed','discarded','expired') NOT NULL DEFAULT 'pending_confirmation',
    result_ref_id   INT UNSIGNED NULL,
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_cpa_conversation (conversation_id),
    KEY idx_cpa_user (user_id),
    CONSTRAINT fk_cpa_conversation FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id),
    CONSTRAINT fk_cpa_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
