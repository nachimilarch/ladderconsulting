-- Migration: Platinum profile-unlock approval flow
-- Run once on production with:
--   mysql -u <user> -p <db> < migrations/profile_unlock_flow.sql

-- 1. Add 'profile_unlock' request type to company_requests.
ALTER TABLE company_requests
  MODIFY COLUMN request_type ENUM(
    'candidate_profile_access','interview_scheduling','interview_schedule',
    'interview_reschedule','offer_letter_release','general','profile_unlock'
  ) NOT NULL;

-- 2. Add 'platinum_approved' to resume_unlocks.granted_via.
--    'platinum'          = free unlock but profile stays masked (old Platinum behaviour).
--    'platinum_approved' = exec explicitly approved full-profile access.
ALTER TABLE resume_unlocks
  MODIFY COLUMN granted_via ENUM(
    'single','pack','platinum','platinum_approved'
  ) NOT NULL;
