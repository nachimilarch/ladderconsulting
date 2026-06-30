-- Training Services Module Migration
-- Run after: phase2_executive_assignment_phase3_fee_gate.sql

-- ── 1. Add training_fee to invoices enum ─────────────────────────────────────
ALTER TABLE invoices
    MODIFY COLUMN invoice_type
    ENUM('placement_fee','partial_payment','other_fee','training_fee') NOT NULL;

-- ── 2. Training catalogue (7 fixed topics) ────────────────────────────────────
CREATE TABLE `training_catalogue` (
    `id`              int unsigned NOT NULL AUTO_INCREMENT,
    `title`           varchar(200) NOT NULL,
    `description`     text,
    `category`        varchar(100) DEFAULT NULL,
    `duration_days`   int DEFAULT NULL,
    `price_per_user`  decimal(10,2) NOT NULL DEFAULT 0.00,
    `is_active`       tinyint(1) NOT NULL DEFAULT 1,
    `created_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `training_catalogue` (`title`, `description`, `category`, `duration_days`, `price_per_user`) VALUES
('Onboarding Training',    'Structured onboarding programme to help new hires integrate seamlessly into their role and company culture.',                              'Onboarding',     5, 5000.00),
('Cultures & Values',      'Deep dive into organisational culture, core values, and how they guide everyday decisions and team behaviour.',                            'Culture',         2, 3000.00),
('Office Etiquette',       'Professional workplace behaviour, communication standards, and interpersonal respect in a corporate setting.',                             'Professionalism', 1, 2000.00),
('Presentation Skills',    'Techniques for preparing and delivering compelling presentations to internal and external audiences with confidence.',                      'Communication',   3, 4000.00),
('Conflict Management',    'Frameworks for identifying, addressing, and resolving workplace conflicts constructively to maintain team cohesion.',                       'Leadership',      2, 4000.00),
('Sales Basics',           'Introduction to the sales process — prospecting, qualification, objection handling, and closing fundamentals for new sales hires.',        'Sales',           3, 5000.00),
('Sales Advanced',         'Advanced sales strategies, negotiation tactics, key account management, and revenue growth frameworks for experienced professionals.',     'Sales',           5, 7000.00);

-- ── 3. Company training requests ─────────────────────────────────────────────
CREATE TABLE `company_training_requests` (
    `id`               int unsigned NOT NULL AUTO_INCREMENT,
    `company_id`       int unsigned NOT NULL,
    `catalogue_id`     int unsigned NOT NULL,
    `num_users`        int NOT NULL DEFAULT 1,
    `requested_by`     int unsigned NOT NULL,
    `status`           enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
    `invoice_id`       int unsigned DEFAULT NULL,
    `admin_notes`      text,
    `approved_by`      int unsigned DEFAULT NULL,
    `approved_at`      datetime DEFAULT NULL,
    `rejection_reason` varchar(500) DEFAULT NULL,
    `deleted_at`       datetime DEFAULT NULL,
    `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `fk_ctr_company`   (`company_id`),
    KEY `fk_ctr_catalogue` (`catalogue_id`),
    KEY `fk_ctr_invoice`   (`invoice_id`),
    CONSTRAINT `fk_ctr_company`   FOREIGN KEY (`company_id`)   REFERENCES `companies` (`id`),
    CONSTRAINT `fk_ctr_catalogue` FOREIGN KEY (`catalogue_id`) REFERENCES `training_catalogue` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
