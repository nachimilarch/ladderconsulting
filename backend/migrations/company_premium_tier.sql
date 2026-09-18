-- Migration: Company Premium tier (8.33%-of-CTC-per-hire membership, replaces the
-- flat listing fee) + candidate Premium flag (used by Talent Pool visibility/boost).
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/company_premium_tier.sql

ALTER TABLE companies
    ADD COLUMN company_tier ENUM('standard','premium') NOT NULL DEFAULT 'standard',
    ADD COLUMN premium_requested_at DATETIME NULL,
    ADD COLUMN premium_approved_at DATETIME NULL,
    ADD COLUMN premium_approved_by INT UNSIGNED NULL;

ALTER TABLE companies
    ADD CONSTRAINT fk_companies_premium_approved_by
        FOREIGN KEY (premium_approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Added here (not with the rest of the candidate Premium tier, which lands in a later
-- migration) because getTalentPool's WHERE/ORDER BY needs this column to exist now.
-- Nothing sets it to 1 until the candidate Premium flow ships.
ALTER TABLE candidates
    ADD COLUMN is_premium TINYINT(1) NOT NULL DEFAULT 0;
