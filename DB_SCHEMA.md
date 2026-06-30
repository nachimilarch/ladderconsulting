# LadderStep Human Consulting — Database Schema Reference

**Database:** `ladder_consulting` (MySQL 8.0, InnoDB, utf8mb4) · **56 tables** · Generated from the live schema 2026-06-13, updated 2026-06-29.

## Conventions & invariants
- **Soft delete:** most tables have `deleted_at datetime NULL`. Every SELECT must include `WHERE deleted_at IS NULL`. (Exceptions with NO `deleted_at`: `candidate_skill_vectors`, `job_skill_vectors`, `match_results`, `module_progress`, `role_benchmarks`, `skill_tags`, `roles`, `payment_transactions`, `admin_logs`, `platform_settings`, `outreach_campaign_logs`.)
- **Roles:** `users.role_id` → `roles.id`. There is **no `users.role` column** — always join `roles` and read `roles.name` (`admin`, `hr_staff`, `company`, `candidate`, `trainer`).
- **JSON columns** are returned **already parsed** by mysql2 — never `JSON.parse()` them unguarded. JSON columns: `admin_logs.old_value/new_value`, `applications`→(none), `candidate_profiles.education`, `company_requests.metadata`, `match_results.matched_skills/missing_skills`, `notifications.metadata`, `outreach_campaigns.variable_mapping`, `outreach_contact_lists.import_errors`, `outreach_contacts.tags`, `skill_tags.aliases`. (`modules.content_url` is a VARCHAR storing JSON — that one IS a string.)
- **Executive ownership:** `companies.assigned_executive_id` → `users.id` is the single source of truth for which hr_staff executive owns a company. Hiring-portal scoping should key off the **current** value here (not snapshots copied onto request rows).

---

## 1. Identity & Org
| Table | Key columns | Notes |
|---|---|---|
| `roles` | id, **name** (admin/hr_staff/company/candidate/trainer), description | No deleted_at. |
| `users` | id, **role_id**→roles, name, email (UNIQUE), phone, password (bcrypt), is_email_verified, status enum(active/pending/suspended), **last_login_at**, deleted_at | `last_login_at` NULL ⇒ never logged in (used to flag executive-sourced candidates). |
| `employees` | id, **user_id**→users, employee_code (UNIQUE), department, designation, date_joined, manager_id→employees, outreach_email, outreach_email_name | The HR-ops "employee" record (calls/leads/tasks FK to `employees.id`, NOT user id). |
| `candidates` | id, **user_id**→users (UNIQUE) | Auto-created `INSERT IGNORE`. |
| `companies` | id, **user_id**→users (UNIQUE), **company_name**, industry, size, website, headquarters, description, is_approved, **assigned_executive_id**→users, executive_assigned_at/by, **placement_fee_percent**, **agreement_file_key**, deleted_at | Name col is `company_name`. assigned_executive_id is the owning hr_staff. `placement_fee_percent` (admin-set, from onboarding agreement) NOT NULL ⇒ company is **Platinum**: free unlimited resume unlocks, and this rate overrides `platform_settings.placement_fee_multiplier` at offer-request submit time. |
| `company_approvals` | id, user_id, status(pending/approved/rejected), reviewed_by, review_note | Company signup approval. |
| `company_executive_assignments` | id, company_id, executive_id→users, assigned_by, assigned_at, unassigned_at, notes | Audit history of exec↔company assignments (current pointer lives on companies.assigned_executive_id). |

## 2. Recruitment core
| Table | Key columns | Notes |
|---|---|---|
| `job_postings` | id, **company_id**→companies, posted_by→users, title, description, requirements, location, job_type(full_time/part_time/contract/internship), work_mode(onsite/remote/hybrid), salary_min/max, experience_min/max, status(draft/active/paused/closed), ai_processed, openings, deadline, deleted_at | |
| `applications` | id, **candidate_id**→candidates, **job_id**→job_postings, **resume_id**→resumes (NOT NULL), cover_letter, **source** enum(candidate/executive/**company**), **sourced_by**→users, status enum(applied/under_review/shortlisted/interview_scheduled/interviewed/offer_sent/hired/rejected/withdrawn), applied_at, deleted_at | UNIQUE(candidate_id, job_id) — blocks re-insert even for soft-deleted (withdrawn) rows. `source='executive'`+`sourced_by` set by bulk sourcing. `source='company'` set when a company self-initiates via `POST /companies/talent/:candidateId/apply` (Single/4-Pack-unlocked Talent Pool candidate moved into their own pipeline). |
| `resumes` | id, **candidate_id**→candidates, file_key (local disk path), file_name, file_size, mime_type, parsed_text (PII-masked) longtext, parse_status(pending/processing/done/failed), is_primary, deleted_at | Keyed by candidate_id, NOT user_id. No S3 columns. |
| `candidate_profiles` | id, **candidate_id**→candidates (UNIQUE), headline, summary, total_experience dec, current_location, preferred_locations, expected_salary, current_salary, notice_period_days, linkedin_url, portfolio_url, **education** JSON, deleted_at | Keyed by candidate_id. |
| `skill_tags` | id, **name** (UNIQUE, lowercase), category, aliases JSON | Shared skill dictionary. No deleted_at. |
| `candidate_skill_vectors` | id, candidate_id, skill_tag_id, proficiency(beginner/intermediate/advanced/expert), years_exp, source(manual/resume_parsed/ai_inferred) | UNIQUE(candidate_id, skill_tag_id). No deleted_at. |
| `job_skill_vectors` | id, job_id, skill_tag_id, weight dec, is_mandatory | UNIQUE(job_id, skill_tag_id). No deleted_at. |
| `match_results` | id, **application_id**→applications (UNIQUE), fit_score dec(5,2), matched_skills JSON, missing_skills JSON, ai_summary, model_version | Linked via application_id ONLY (never job/candidate directly). No deleted_at. model_version now `local-parser-v1`. |
| `shortlists` | id, **application_id**→applications (UNIQUE), shortlisted_by→users, fit_score, notes, status(shortlisted/rejected), deleted_at | |
| `rejection_feedback` | id, application_id, rejected_by→users, reason_code, reason_text | Logged when a company rejects, feeds matching. |

## 3. Bulk resume sourcing (executive)
| Table | Key columns | Notes |
|---|---|---|
| `resume_upload_batches` | id, **job_id**→job_postings, **uploaded_by**→users, total_files, processed_files, created_count, skipped_count, failed_count, status(processing/done/failed), deleted_at | One per bulk upload action. |
| `resume_upload_items` | id, **batch_id**→resume_upload_batches, file_name, file_key, file_size, mime_type, status(pending/parsing/done/skipped/failed), error_message, candidate_id, application_id, extracted_name, extracted_email, fit_score | One per resume file. |

## 4. Interview, Offer & Hire
| Table | Key columns | Notes |
|---|---|---|
| `interview_slots` | id, **application_id**→applications, **scheduled_by**→users, slot_datetime, duration_mins, mode(video/phone/in_person), meeting_link, location_detail, status(proposed/confirmed/rescheduled/completed/cancelled), candidate_confirmed, deleted_at | Created ONLY by `interviewRequestController.approveRequest` (the two direct-create paths are 403'd). scheduled_by = the approving executive. |
| `interview_outcomes` | id, **interview_id**→interview_slots (UNIQUE), recorded_by→users, result(selected/hold/rejected), feedback, rating, deleted_at | result='selected' gates the offer-letter request. |
| `offers` | id, **application_id**→applications (UNIQUE), issued_by→users, offer_letter_key, ctc, joining_date, valid_until, status(sent/accepted/declined/expired/withdrawn), candidate_response_at, deleted_at | Gated by offer_letter_grants. Accept ⇒ application.status='hired'. |
| `hired_employees` | id, **candidate_id**, **company_id**, **application_id** (UNIQUE), **offer_id** (UNIQUE), employee_id, joining_date, role_title, department, onboarding_started, deleted_at | Canonical placement record. Created on offer accept. Drives training + placements. |

## 5. Approval gate, grants & fees
| Table | Key columns | Notes |
|---|---|---|
| `company_requests` | id, **company_id**, **application_id**, candidate_id, **request_type** enum(candidate_profile_access/interview_scheduling/**interview_schedule**/**interview_reschedule**/**offer_letter_release**/general), status(pending/in_progress/approved/resolved/rejected/cancelled), **assigned_executive_id**→users (snapshot at submit), requested_by, company_notes, internal_notes, resolved_at/by, rejection_reason, **invoice_id**→placement_fee_invoices, **metadata** JSON, deleted_at | Polymorphic approval queue. NOTE: `interview_scheduling` (old, from companyController.createRequest) vs `interview_schedule`+`interview_reschedule` (new, interviewRequestController) — two distinct types coexist. metadata holds proposed slot details. |
| `offer_letter_grants` | id, **application_id** (UNIQUE), company_id, candidate_id, invoice_id→placement_fee_invoices, request_id→company_requests, granted_by→users, granted_at, deleted_at | Existence ⇒ company may generate the offer letter. |
| `candidate_access_grants` | id, request_id, invoice_id→service_invoices, company_id, candidate_id, application_id, grant_type(candidate_profile_access/interview_scheduling), granted_by, expires_at, revoked_at | Older profile-access/interview gate (service_invoices). |
| `placement_fee_invoices` | id, company_id, candidate_id, job_posting_id, application_id, fee_type(profile_access/interview_scheduling/placement), offered_ctc, **placement_fee_amount**, status(pending/paid/waived/overdue/rejected), raised_by→users, paid_at, deleted_at | The placement-cut invoice. raised_by = executive at submit. |
| `service_invoices` | id, request_id, company_id, invoice_number (UNIQUE), amount, currency, fee_type(candidate_profile_access/interview_scheduling/other), status(pending/paid/waived/overdue/cancelled), paid_at/by, deleted_at | Older fee model. |
| `invoices` | id, invoice_number (UNIQUE), company_id, candidate_id, job_posting_id, application_id, raised_by, invoice_type(placement_fee/partial_payment/other_fee/training_fee/**resume_unlock**), amount, amount_paid, status(pending/partially_paid/paid/overdue/cancelled/waived), due_date, paid_at, deleted_at | The general HR-executive invoice (HRInvoices page). `resume_unlock` invoices are self-raised by the company (raised_by = the company user), not by an executive. |
| `payment_transactions` | id, invoice_id→invoices, company_id, amount, payment_method(cashfree/manual/bank_transfer/cheque/other), cashfree_order_id/payment_id/signature, status(initiated/success/failed/pending/refunded) | No deleted_at. |
| `resume_unlock_orders` | id, **company_id**→companies, **invoice_id**→invoices (UNIQUE), order_type enum(single/pack_5/**pack_4**), candidate_id→candidates (set only when `single` is bought WITH a target already chosen), credits_total, credits_used, deleted_at | One row per unlock purchase. `pack_5` is legacy (kept for historical rows; code only issues `pack_4` now, ₹3,999/4 credits, since 2026-06-29). A `single` order bought with a target candidate grants instantly on payment (via `fulfillResumeUnlockOrder`); a `single` bought with NO target (package-selection gate / Company Profile) or any pack just goes active with spendable credits, drawn down later by `consumePackCredit()` — which no longer filters by `order_type`, since a targeted `single` is already fully consumed by then regardless. |
| `resume_unlocks` | id, **company_id**→companies, **candidate_id**→candidates, order_id→resume_unlock_orders (NULL for platinum), granted_via enum(single/pack/platinum), unlocked_by→users, unlocked_at | UNIQUE(company_id, candidate_id) — the actual access grant checked by `getFullProfile`/`downloadUnlockedResume`. Platinum rows are written for audit only; the live gate is `companies.placement_fee_percent IS NOT NULL`, checked before this table. |

## 6. Training

### 6a. Post-hire internal training (candidate-facing, assigned after hiring)
| Table | Key columns | Notes |
|---|---|---|
| `courses` | id, created_by→users, title, description, skill_tag_id, level, duration_hrs, is_published, deleted_at | |
| `modules` | id, **course_id**→courses, title, content_type(video/pdf/article/quiz), content_key, **content_url** varchar(1000) (stores JSON quiz as a STRING), order_index, duration_mins, pass_score, is_published, deleted_at | |
| `module_progress` | id, assignment_id→training_assignments, module_id→modules, status(not_started/in_progress/completed/failed), score, attempts, completed_at | UNIQUE(assignment_id, module_id). No deleted_at. |
| `training_assignments` | id, **hired_employee_id**→hired_employees, course_id, assigned_by, assignment_type(onboarding/skill_gap/recommended/mandatory), due_date, status(assigned/in_progress/completed/overdue), completed_at, deleted_at | UNIQUE(hired_employee_id, course_id). |
| `certificates` | id, hired_employee_id, course_id, assignment_id (UNIQUE), certificate_key, issued_at, deleted_at | |
| `role_benchmarks` | id, role_title, skill_tag_id, min_level | No deleted_at. |

### 6b. Training Services (company-facing subscription — migration 4, added 2026-06-16)
| Table | Key columns | Notes |
|---|---|---|
| `training_catalogue` | id, title, description, category, duration_days, price_per_user dec(10,2), is_active | 7 topics seeded: Onboarding, Cultures & Values, Office Etiquette, Presentation Skills, Conflict Management, Sales Basics, Sales Advanced. Managed by admin via TrainingManager → Training Catalogue tab. |
| `company_training_requests` | id, **company_id**→companies, **catalogue_id**→training_catalogue, num_users int, requested_by→users, status enum(pending/approved/rejected/completed), **invoice_id**→invoices, approved_by→users, approved_at, rejection_reason, deleted_at | Company submits from `/company/training`. Admin approves → creates `invoices` row (type=training_fee). Company pays via Cashfree on Payments page. |

## 7. HR Ops & Outreach
| Table | Key columns | Notes |
|---|---|---|
| `leads` | id, **assigned_to**→employees (NOT NULL), company_name, contact_name/email/phone, source, stage(new/contacted/interested/proposal/converted/lost), source_type, outreach_contact_id, outreach_campaign_id, deleted_at | assigned_to FKs employees.id. |
| `call_logs` | id, lead_id→leads, employee_id→employees, called_at, duration_secs, outcome(no_answer/voicemail/callback_scheduled/interested/not_interested/converted), notes, callback_at, deleted_at | |
| `tasks` | id, **assigned_to**→employees, **assigned_by**→employees, title, description, priority(low/medium/high/urgent), status(pending/in_progress/completed/cancelled), due_date, completed_at, time_logged_hrs, deleted_at | FK to employees.id (NOT user id). |
| `task_notes` | id, task_id, author_id→employees, note | |
| `attendance` | id, employee_id, date, check_in/out, status(present/absent/half_day/leave) | |
| `outreach_contact_lists` | id, uploaded_by→users, list_name, file_key, total/imported/failed counts, import_status, import_errors JSON, deleted_at | |
| `outreach_contacts` | id, list_id, uploaded_by, full_name, email, phone, whatsapp_number, company_name, designation, city, tags JSON, is_unsubscribed, lead_id, deleted_at | |
| `outreach_campaigns` | id, created_by, campaign_name, campaign_type(email/whatsapp/call), list_id, subject, message_body, from_email/name, reply_to_tag, whatsapp_template_id, variable_mapping JSON, status(draft/scheduled/sending/sent/paused/failed), counts, deleted_at | |
| `outreach_campaign_logs` | id, campaign_id, contact_id, channel, status(pending/sent/failed/replied/bounced/unsubscribed), sent_at, replied_at, email/whatsapp_message_id | No deleted_at. |
| `outreach_email_replies` | id, campaign_id, campaign_log_id, contact_id, assigned_to→users, channel, from_email/name/phone, subject, body_text/html, received_at, reply_status(unread/read/replied/converted/ignored), lead_id, deleted_at | Inbox; IMAP poller fills it. |
| `outreach_call_logs` | id, campaign_id, contact_id, called_by→users, called_at, outcome, callback_at, lead_id, deleted_at | |
| `whatsapp_templates` | id, created_by, template_name, language_code, category, header_type, body_text, variable_count, is_active, deleted_at | |

## 8. System
| Table | Key columns | Notes |
|---|---|---|
| `notifications` | id, **user_id**→users, type (string), title, body, is_read, **metadata** JSON, deleted_at | In-app bell. |
| `admin_logs` | id, admin_id→users, action, entity_type, entity_id, old_value JSON, new_value JSON, ip_address | No deleted_at. Audit trail. |
| `platform_settings` | id, **setting_key** (UNIQUE), value text, description, updated_by | Key/value config (e.g. placement_fee_multiplier, mail_poller_enabled). No deleted_at. |

---

## Hiring lifecycle (how the tables connect)
`job_postings` → candidate self-applies **or** executive bulk-sources → `applications` (+`resumes`, `match_results`, `candidate_skill_vectors`) → company shortlists (`shortlists`) → company submits interview request (`company_requests` type=interview_schedule) → **executive approves** → `interview_slots` → `interview_outcomes` (selected) → company requests offer-letter release (`company_requests` type=offer_letter_release + `placement_fee_invoices`) → **executive approves payment** → `offer_letter_grants` → company generates `offers` → candidate accepts → `applications.status='hired'` + `hired_employees` → `training_assignments` → `certificates`.

**The assigned executive (`companies.assigned_executive_id`) owns the entire hiring lifecycle for their companies** — interviews, offers, placement fees, and reporting should all scope to it.
