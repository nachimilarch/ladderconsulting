-- Claude now answers every AI feature (LAILA chat, resume enrichment, match notes, outreach writing).
-- Ollama stays the default; Claude is opt-in (laila_use_claude). While Claude is on, a failed call is retried on Ollama unless ollama_fallback = 'false'. Safe to run more than once.
-- llm_usage / laila_claude.sql must already be applied.

INSERT INTO platform_settings (setting_key, value, description) VALUES
    ('ollama_fallback', 'true', 'While Claude is on, retry a failed Claude call on Ollama. Turn off to never contact Ollama when Claude is on.'),
    ('claude_monthly_budget_usd', '0', 'Hard stop for all Claude calls: refused once estimated spend this month reaches this many US dollars. 0 = no limit.')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

UPDATE platform_settings
   SET description = 'Use Claude (Anthropic) for LAILA chat, resume suggestions, match notes and outreach writing. Needs the Anthropic API key.'
 WHERE setting_key = 'laila_use_claude';
