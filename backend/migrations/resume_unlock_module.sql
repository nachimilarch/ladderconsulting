-- Resume Unlock module (company self-serve resume access) + per-company placement fee rate
-- Run on: ladder_consulting
-- Note: MySQL 8.0 — plain ALTER TABLE (no IF NOT EXISTS). Run only once.

-- Per-company contracted placement fee rate (set by admin from the onboarding agreement).
-- NULL = use the platform-wide platform_settings.placement_fee_multiplier default.
-- A non-NULL value here also makes the company "Platinum" — free unlimited resume unlocks.
ALTER TABLE companies
    ADD COLUMN placement_fee_percent DECIMAL(5,2) NULL AFTER assigned_executive_id,
    ADD COLUMN agreement_file_key VARCHAR(500) NULL AFTER placement_fee_percent;

ALTER TABLE invoices
    MODIFY COLUMN invoice_type ENUM('placement_fee','partial_payment','other_fee','training_fee','resume_unlock') NOT NULL;

-- One row per unlock purchase: either a single candidate, or a 5-credit pack.
CREATE TABLE resume_unlock_orders (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id      INT UNSIGNED NOT NULL,
    invoice_id      INT UNSIGNED NOT NULL,
    order_type      ENUM('single', 'pack_5') NOT NULL,
    candidate_id    INT UNSIGNED DEFAULT NULL,
    credits_total   INT NOT NULL,
    credits_used    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ruo_invoice (invoice_id),
    KEY fk_ruo_company (company_id),
    KEY fk_ruo_candidate (candidate_id),
    CONSTRAINT fk_ruo_company   FOREIGN KEY (company_id)   REFERENCES companies (id),
    CONSTRAINT fk_ruo_invoice   FOREIGN KEY (invoice_id)    REFERENCES invoices (id),
    CONSTRAINT fk_ruo_candidate FOREIGN KEY (candidate_id)  REFERENCES candidates (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per candidate a company has ever unlocked — the actual access grant checked
-- at resume-download / full-profile time. granted_via='platinum' rows are written for
-- audit/history only; the live gate is companies.placement_fee_percent IS NOT NULL.
CREATE TABLE resume_unlocks (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id   INT UNSIGNED NOT NULL,
    candidate_id INT UNSIGNED NOT NULL,
    order_id     INT UNSIGNED DEFAULT NULL,
    granted_via  ENUM('single', 'pack', 'platinum') NOT NULL,
    unlocked_by  INT UNSIGNED NOT NULL,
    unlocked_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_unlock (company_id, candidate_id),
    KEY fk_ru_order (order_id),
    CONSTRAINT fk_ru_company   FOREIGN KEY (company_id)   REFERENCES companies (id),
    CONSTRAINT fk_ru_candidate FOREIGN KEY (candidate_id)  REFERENCES candidates (id),
    CONSTRAINT fk_ru_order     FOREIGN KEY (order_id)      REFERENCES resume_unlock_orders (id),
    CONSTRAINT fk_ru_user      FOREIGN KEY (unlocked_by)   REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
