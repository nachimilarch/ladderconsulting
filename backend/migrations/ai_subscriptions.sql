-- Migration: AI chatbot subscription (₹299/month, either payer type — company or
-- candidate — billed via a generated invoice each cycle that the payer manually
-- pays, reusing the existing one-time Cashfree order flow rather than a true
-- auto-recurring charge).
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/ai_subscriptions.sql

CREATE TABLE ai_subscriptions (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id            INT UNSIGNED NULL,
    candidate_id          INT UNSIGNED NULL,
    status                ENUM('active','grace','suspended','cancelled') NOT NULL DEFAULT 'active',
    current_period_start  DATE NOT NULL,
    current_period_end    DATE NOT NULL,
    last_invoice_id       INT UNSIGNED NULL,
    grace_until           DATE NULL,
    created_at            TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at          DATETIME NULL,
    deleted_at            DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ai_sub_company   (company_id),
    UNIQUE KEY uq_ai_sub_candidate (candidate_id),
    CONSTRAINT fk_aisub_company   FOREIGN KEY (company_id)     REFERENCES companies(id),
    CONSTRAINT fk_aisub_candidate FOREIGN KEY (candidate_id)   REFERENCES candidates(id),
    CONSTRAINT fk_aisub_invoice   FOREIGN KEY (last_invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO platform_settings (setting_key, value, description) VALUES
    ('ai_subscription_amount', '299', 'Monthly AI chatbot subscription fee (INR), either payer type'),
    ('ai_subscription_grace_days', '7', 'Days after an unpaid AI-subscription invoice due date before access is suspended');

-- Renewal invoices are generated automatically by subscriptionBiller.js with no
-- human "raiser" — every existing read of raised_by already LEFT JOINs (confirmed
-- across invoiceController.js/offerRequestController.js), so NULL here just shows
-- no exec name, nothing else breaks.
ALTER TABLE invoices
    MODIFY COLUMN raised_by INT UNSIGNED NULL;
