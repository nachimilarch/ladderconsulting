-- SSO login: Microsoft 365 for hr_staff/admin, Google for candidate/company
-- Run on: ladder_consulting
-- Note: MySQL 8.0 — plain CREATE TABLE (no IF NOT EXISTS). Run only once.

-- One row per linked external identity. Lookup is by (provider, provider_user_id)
-- on repeat logins; first-time linking falls back to matching users.email.
CREATE TABLE user_oauth_identities (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id             INT UNSIGNED NOT NULL,
    provider            ENUM('microsoft', 'google') NOT NULL,
    provider_user_id    VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    created_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_provider_identity (provider, provider_user_id),
    KEY fk_oauth_user (user_id),
    CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
