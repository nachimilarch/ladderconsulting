-- LAILA can answer with Claude (Anthropic) instead of the local Ollama model.
-- Spend log + the settings that control it. Claude stays OFF until an admin adds the API key and
-- switches it on in Platform Settings.

CREATE TABLE IF NOT EXISTS llm_usage (
    id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id            INT UNSIGNED  NULL,
    feature            VARCHAR(40)   NOT NULL DEFAULT 'laila_chat',
    provider           VARCHAR(20)   NOT NULL,
    model              VARCHAR(80)   NOT NULL,
    input_tokens       INT UNSIGNED  NOT NULL DEFAULT 0,
    output_tokens      INT UNSIGNED  NOT NULL DEFAULT 0,
    cache_read_tokens  INT UNSIGNED  NOT NULL DEFAULT 0,
    cache_write_tokens INT UNSIGNED  NOT NULL DEFAULT 0,
    cost_usd           DECIMAL(10,6) NULL,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_llm_usage_created (created_at),
    KEY idx_llm_usage_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO platform_settings (setting_key, value, description) VALUES
    ('laila_use_claude', 'false', 'Answer LAILA chats with Claude (Anthropic). Needs the Anthropic API key. Falls back to the local model if Claude is unavailable.'),
    ('claude_model', 'claude-haiku-5-5', 'Claude model LAILA uses: claude-haiku-5-5 (cheapest) or claude-sonnet-5-5 (better writing, about 20x the cost).'),
    ('claude_effort', 'medium', 'How hard Claude works per reply: low, medium or high. Lower is faster and cheaper.'),
    ('laila_monthly_message_cap', '300', 'Most LAILA messages one person can send per calendar month while Claude is on. Keeps the bill predictable.')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
