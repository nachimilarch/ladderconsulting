-- Migration: Replace per-candidate unlock packages with a flat ₹3,999 listing fee.
-- Run on prod EC2: mysql -u root -p ladder_consulting < /var/www/ladderstep/backend/migrations/listing_fee.sql

ALTER TABLE companies
    ADD COLUMN listing_fee_paid TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN listing_fee_invoice_id INT NULL;

ALTER TABLE invoices
    MODIFY COLUMN invoice_type ENUM('placement_fee','resume_unlock','training_fee','service_fee','listing_fee') NOT NULL;

-- Migrate existing companies: if they ever paid any resume_unlock invoice, treat them as activated.
UPDATE companies c
SET c.listing_fee_paid = 1
WHERE c.id IN (
    SELECT DISTINCT ruo.company_id
    FROM resume_unlock_orders ruo
    JOIN invoices i ON i.id = ruo.invoice_id AND i.status = 'paid'
);
