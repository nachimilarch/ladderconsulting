-- Resume Unlock repricing + company-initiated applications
-- Run on: ladder_consulting
-- Note: MySQL 8.0 — plain ALTER TABLE (no IF NOT EXISTS). Run only once.

-- Pack tier changes from 5 credits/₹4,000 to 4 credits/₹3,999. 'pack_5' kept for any
-- historical orders already in the table — PRICING in code only ever issues 'pack_4'
-- going forward. The grant-level resume_unlocks.granted_via ('single'/'pack'/'platinum')
-- is unaffected — it doesn't encode pack size, so no change needed there.
ALTER TABLE resume_unlock_orders
    MODIFY COLUMN order_type ENUM('single', 'pack_5', 'pack_4') NOT NULL;

-- A company can now self-initiate an application by moving an already-unlocked
-- (single/pack) Talent Pool candidate into their own hiring pipeline, distinct from
-- candidate self-apply and executive bulk-sourcing.
ALTER TABLE applications
    MODIFY COLUMN source ENUM('candidate', 'executive', 'company') NOT NULL DEFAULT 'candidate';
