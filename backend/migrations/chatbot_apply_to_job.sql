-- Migration: adds 'apply_to_job' to chatbot_pending_actions.action_type — the
-- AI assistant can now propose applying a candidate to a job (still
-- propose->confirm, same as create_job/update_job/update_profile; the model
-- is never given a tool that applies directly).
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/chatbot_apply_to_job.sql

ALTER TABLE chatbot_pending_actions
    MODIFY COLUMN action_type ENUM('create_job','update_job','update_profile','apply_to_job') NOT NULL;
