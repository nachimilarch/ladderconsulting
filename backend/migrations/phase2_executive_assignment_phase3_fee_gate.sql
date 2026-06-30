-- Phase 2 + Phase 3 migration — resumes from current state
-- companies already has: assigned_executive_id (int), executive_assigned_at, executive_assigned_by
-- Remaining: fix column types, add FK, create 4 new tables, seed settings.

-- Fix column types to UNSIGNED to match users.id
ALTER TABLE companies
    MODIFY COLUMN assigned_executive_id INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN executive_assigned_by  INT UNSIGNED NULL DEFAULT NULL;

-- Add FK (only if not already present)
ALTER TABLE companies
    ADD CONSTRAINT fk_companies_executive
        FOREIGN KEY (assigned_executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- Audit history of executive assignments
CREATE TABLE IF NOT EXISTS company_executive_assignments (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          INT UNSIGNED NOT NULL,
    executive_id        INT UNSIGNED NOT NULL,
    assigned_by         INT UNSIGNED NOT NULL,
    assigned_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at       DATETIME     NULL DEFAULT NULL,
    notes               TEXT         NULL,
    deleted_at          DATETIME     NULL DEFAULT NULL,
    CONSTRAINT fk_cea_company    FOREIGN KEY (company_id)   REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_cea_executive  FOREIGN KEY (executive_id) REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_cea_assigned   FOREIGN KEY (assigned_by)  REFERENCES users(id)     ON DELETE RESTRICT,
    INDEX idx_cea_company   (company_id),
    INDEX idx_cea_executive (executive_id)
);

-- Company access requests (fee-gate workflow)
CREATE TABLE IF NOT EXISTS company_requests (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id              INT UNSIGNED NOT NULL,
    application_id          INT UNSIGNED NOT NULL,
    request_type            ENUM('candidate_profile_access', 'interview_scheduling') NOT NULL,
    status                  ENUM('pending', 'in_progress', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    assigned_executive_id   INT UNSIGNED NULL DEFAULT NULL,
    requested_by            INT UNSIGNED NOT NULL,
    company_notes           TEXT NULL,
    internal_notes          TEXT NULL,
    resolved_at             DATETIME     NULL DEFAULT NULL,
    resolved_by             INT UNSIGNED NULL DEFAULT NULL,
    created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at              DATETIME     NULL DEFAULT NULL,
    CONSTRAINT fk_cr_company     FOREIGN KEY (company_id)            REFERENCES companies(id)    ON DELETE CASCADE,
    CONSTRAINT fk_cr_application FOREIGN KEY (application_id)        REFERENCES applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_executive   FOREIGN KEY (assigned_executive_id) REFERENCES users(id)        ON DELETE SET NULL,
    CONSTRAINT fk_cr_requested   FOREIGN KEY (requested_by)          REFERENCES users(id)        ON DELETE RESTRICT,
    CONSTRAINT fk_cr_resolved    FOREIGN KEY (resolved_by)           REFERENCES users(id)        ON DELETE SET NULL,
    INDEX idx_cr_company     (company_id),
    INDEX idx_cr_application (application_id),
    INDEX idx_cr_status      (status),
    INDEX idx_cr_executive   (assigned_executive_id)
);

-- Service invoices linked to requests
CREATE TABLE IF NOT EXISTS service_invoices (
    id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    request_id      INT UNSIGNED  NOT NULL,
    company_id      INT UNSIGNED  NOT NULL,
    invoice_number  VARCHAR(50)   NOT NULL UNIQUE,
    amount          DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(10)   NOT NULL DEFAULT 'INR',
    fee_type        ENUM('candidate_profile_access', 'interview_scheduling', 'other') NOT NULL,
    status          ENUM('pending', 'paid', 'waived', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
    due_date        DATE          NULL,
    paid_at         DATETIME      NULL DEFAULT NULL,
    paid_by         INT UNSIGNED  NULL DEFAULT NULL,
    notes           TEXT          NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME      NULL DEFAULT NULL,
    CONSTRAINT fk_si_request FOREIGN KEY (request_id) REFERENCES company_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_si_company FOREIGN KEY (company_id) REFERENCES companies(id)        ON DELETE RESTRICT,
    CONSTRAINT fk_si_paid_by FOREIGN KEY (paid_by)    REFERENCES users(id)            ON DELETE SET NULL,
    INDEX idx_si_request (request_id),
    INDEX idx_si_company (company_id),
    INDEX idx_si_status  (status)
);

-- Access grants written when a request is approved and invoice paid/waived
CREATE TABLE IF NOT EXISTS candidate_access_grants (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id      INT UNSIGNED NOT NULL,
    invoice_id      INT UNSIGNED NULL DEFAULT NULL,
    company_id      INT UNSIGNED NOT NULL,
    candidate_id    INT UNSIGNED NOT NULL,
    application_id  INT UNSIGNED NOT NULL,
    grant_type      ENUM('candidate_profile_access', 'interview_scheduling') NOT NULL,
    granted_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by      INT UNSIGNED NOT NULL,
    expires_at      DATETIME     NULL DEFAULT NULL,
    revoked_at      DATETIME     NULL DEFAULT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cag_request   FOREIGN KEY (request_id)    REFERENCES company_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cag_invoice   FOREIGN KEY (invoice_id)    REFERENCES service_invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_cag_company   FOREIGN KEY (company_id)    REFERENCES companies(id)        ON DELETE CASCADE,
    CONSTRAINT fk_cag_candidate FOREIGN KEY (candidate_id)  REFERENCES candidates(id)       ON DELETE CASCADE,
    CONSTRAINT fk_cag_app       FOREIGN KEY (application_id) REFERENCES applications(id)    ON DELETE CASCADE,
    CONSTRAINT fk_cag_granted   FOREIGN KEY (granted_by)    REFERENCES users(id)            ON DELETE RESTRICT,
    INDEX idx_cag_company_app (company_id, application_id),
    INDEX idx_cag_grant_type  (grant_type),
    INDEX idx_cag_revoked     (revoked_at)
);

-- Seed fee defaults (skips if keys already exist)
INSERT INTO platform_settings (setting_key, value, updated_by, updated_at)
VALUES
    ('candidate_profile_access_fee', '5000',  1, NOW()),
    ('interview_scheduling_fee',     '10000', 1, NOW()),
    ('fee_currency',                 'INR',   1, NOW())
ON DUPLICATE KEY UPDATE updated_at = updated_at;
