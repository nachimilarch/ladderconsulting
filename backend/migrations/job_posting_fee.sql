-- Migration: per-JD posting fee. Standard-tier companies now pay ₹3,999 PER
-- job posted (not a one-time account activation) — the same payment also
-- activates listing_fee_paid (Talent Pool access), so paying for a job still
-- unlocks browsing, it just no longer unlocks *future* job posts for free.
-- Platinum-tier companies (company_tier='premium') are unaffected — still
-- free unlimited posting, 8.33% placement fee per hire instead.
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/job_posting_fee.sql

ALTER TABLE job_postings
    MODIFY COLUMN status ENUM('pending_payment','draft','active','paused','closed') NOT NULL DEFAULT 'draft';

ALTER TABLE invoices
    MODIFY COLUMN invoice_type ENUM('placement_fee','resume_unlock','training_fee','service_fee','listing_fee','premium_profile_fee','ai_subscription','job_posting_fee') NOT NULL;
