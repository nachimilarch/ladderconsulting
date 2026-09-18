-- Migration: Candidate Premium tier (HR-verified via payslips, ₹999 one-time fee,
-- boosts visibility to Premium-tier companies) + generalizing invoices/payment_transactions
-- so a candidate can be a payer (previously company-only on both tables).
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/candidate_premium_and_payer.sql

ALTER TABLE candidates
    ADD COLUMN premium_activated_at DATETIME NULL,
    ADD COLUMN premium_invoice_id INT UNSIGNED NULL;

-- Durable, auditable payslip-verification queue — deliberately NOT the notifications-table
-- hack used for the company Premium-tier request, because this is a compliance-sensitive
-- (income/payslip) review that needs a real record, not an ephemeral bell notification.
CREATE TABLE candidate_premium_requests (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    candidate_id        INT UNSIGNED NOT NULL,
    declared_annual_ctc DECIMAL(12,2) NOT NULL,
    status              ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by         INT UNSIGNED NULL,
    review_note         TEXT NULL,
    reviewed_at         DATETIME NULL,
    created_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL,
    PRIMARY KEY (id),
    KEY fk_cpr_candidate (candidate_id),
    KEY fk_cpr_reviewer (reviewed_by),
    CONSTRAINT fk_cpr_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id),
    CONSTRAINT fk_cpr_reviewer  FOREIGN KEY (reviewed_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Payer generalization: invoices.candidate_id already exists (previously only a
-- descriptive "who this invoice is about" reference on resume_unlock/placement_fee
-- rows) — repurposed here as the genuine PAYER for candidate-initiated invoice types.
-- company_id becomes nullable. "Exactly one of company_id/candidate_id is set" is
-- enforced in controller code, matching this codebase's existing style of enforcing
-- business invariants outside the DB (soft-delete rules, role checks, etc).
ALTER TABLE invoices
    MODIFY COLUMN company_id INT UNSIGNED NULL,
    MODIFY COLUMN invoice_type ENUM('placement_fee','resume_unlock','training_fee','service_fee','listing_fee','premium_profile_fee','ai_subscription') NOT NULL;

ALTER TABLE payment_transactions
    MODIFY COLUMN company_id INT UNSIGNED NULL,
    ADD COLUMN candidate_id INT UNSIGNED NULL;

ALTER TABLE payment_transactions
    ADD CONSTRAINT fk_pt_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
