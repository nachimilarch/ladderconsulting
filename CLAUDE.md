# CLAUDE.md — LadderStep Human Consulting Platform
## Complete Codebase Reference — Last Updated: 2026-06-30

---

## Project Overview

LadderStep Human Consulting is a full-stack HR, Recruitment, and Outreach SaaS. It is a monorepo with two independent apps:
- `backend/` — Node.js + Express + MySQL (port 5001)
- `frontend/` — React 19 + Vite + Tailwind CSS (port 5173)

**Completed Modules:**
| Module | Status |
|--------|--------|
| Module 1 — Auth | Complete |
| Module 2 — HR Operations | Complete |
| Module 3 — Candidate Portal | Complete |
| Module 4 — Company Portal | Complete |
| Cold Outreach Module | Complete |
| Admin Panel | Complete |
| Training Services (company-facing subscription) | Complete |
| Payments & Placement Fees | Complete |
| Modules 5–8 (AI Matching advanced, post-hire training advanced) | Partial |

---

## Commands

```bash
# Backend
cd backend && npm run dev        # nodemon hot-reload, port 5001
cd backend && npm start          # production

# Frontend
cd frontend && npm run dev       # Vite dev server, port 5173
cd frontend && npm run build     # production build to dist/
cd frontend && npm run lint      # ESLint

# Load-test a route file without starting server
cd backend && node -e "require('./src/routes/outreach')" && echo OK
```

---

## Architecture

### Backend File Tree

```
backend/src/
├── server.js                  ← Express entry + all route mounts + CORS + mailPoller start
├── config/db.js               ← mysql2/promise pool (10 connections, timezone UTC)
├── middleware/
│   ├── auth.js                ← authenticateToken, authorizeRole(...roles)
│   ├── upload.js              ← uploadResume (disk, 5MB, PDF/DOC/DOCX), uploadDocument (disk, 10MB)
│   └── maintenanceCheck.js   ← 503 gate with 60s TTL cache; admin always passes through
├── routes/                    ← Thin routers — apply middleware, delegate to controllers
├── controllers/               ← All business logic
├── services/
│   ├── cashfreeService.js     ← createOrder, getOrderStatus, getOrderPayments, verifyWebhookSignature
│   ├── leadConverter.js       ← createLeadFromContact() — outreach → lead auto-creation
│   ├── mailPoller.js          ← IMAP poller (setInterval 2min), started on server boot
│   ├── matchingService.js     ← job matching (skill vectors via offline resumeParser)
│   ├── maskedResumeGenerator.js ← PDF with PII redacted
│   ├── skillExtractor.js      ← skill extraction (delegates to utils/resumeParser dictionary)
│   ├── jobSkillExtractor.js   ← job skill extraction (keyword)
│   └── trainingService.js     ← training module service (still uses OpenAI for course recommendations)
└── utils/
    ├── resumeParser.js        ← OFFLINE resume/JD parser: regex contact details + skill dictionary + section/date heuristics. Single source of truth for skills. No API key.
    ├── aiParser.js            ← resume parsing API (parseResumeText/parseFullProfile) — now delegates to resumeParser (offline)
    ├── auditLog.js            ← logAction (fire-and-forget admin_logs insert)
    ├── email.js               ← sendEmail (transactional, GoDaddy SMTP)
    ├── outreachEmail.js       ← getTransporter, replaceMergeTags, buildReplyToAddress, parseReplyToTag
    ├── maskPII.js             ← PII masking for candidate data shown to companies
    ├── candidateStatus.js     ← isCandidateHired() — "off the market" lock helper
    ├── paginate.js            ← pagination helper (currently unused; for future list endpoints)
    └── s3.js                  ← uploadToS3, getPresignedUrl (AWS SDK v3)
```

> **Removed 2026-06-13 (dead/duplicate code):** `server_old.js`, `app.js` + `modules/` (legacy pre-refactor entry/tree), `middleware/errorHandler.js`, `middleware/roleGuard.js`, `utils/sendEmail.js` (unused email alias), `utils/generateToken.js` (empty), frontend `routes/AppRouter.jsx`, `components/ProtectedRoute.jsx` (dup of `routes/ProtectedRoute.jsx`), `pages/hr/ColdCalling.jsx` (cold-calling lives under Outreach), `components/hr/KPICard.jsx`, and empty `components/layout|ui/`.

### Frontend File Tree

```
frontend/src/
├── main.jsx                   ← ReactDOM.createRoot, BrowserRouter
├── App.jsx                    ← All routes + RoleRedirect
├── context/AuthContext.jsx    ← user, loading, login, logout, setUser
├── routes/ProtectedRoute.jsx  ← role guard; redirects to /unauthorized
├── api/
│   ├── axios.js               ← base axios (VITE_API_URL || localhost:5001/api, withCredentials)
│   ├── hr.js                  ← employeeAPI, callAPI, leadAPI, taskAPI, reportAPI
│   ├── outreach.js            ← contactListAPI, emailCampaignAPI, replyAPI, waCampaignAPI, waTemplateAPI, outreachCallAPI, analyticsAPI
│   ├── notifications.js       ← notificationAPI
│   ├── payments.js            ← hrInvoiceAPI, companyInvoiceAPI, adminInvoiceAPI, paymentAPI, interviewRequestAPI
│   ├── interview.js           ← companyInterviewAPI, offerRequestAPI, candidateInterviewAPI
│   ├── candidate.js           ← profileAPI, resumeAPI, jobAPI, applicationAPI, aiAPI, documentAPI
│   ├── company.js             ← companyAPI, companyJobAPI, interviewAPI, offerAPI, talentPoolAPI (browse, express interest, unlock)
│   ├── trainingServices.js    ← trainingServiceAPI (company), adminTrainingServiceAPI (admin)
│   └── admin.js               ← adminAnalyticsAPI (incl. getExecutivePerformance), adminAuditAPI, adminCompanyAPI, ...
├── components/
│   ├── hr/HRLayout.jsx        ← HR sidebar, role-aware: admin sees "← Admin Dashboard" escape
│   ├── outreach/OutreachLayout.jsx ← Outreach sidebar, role-aware back link
│   ├── company/PackagePicker.jsx ← self-contained resume-unlock package picker (Single/4-Pack/Platinum-request); used as the mandatory gate on TalentPool.jsx and standalone on CompanyProfile.jsx
│   ├── NotificationBell.jsx   ← polls /notifications/unread-count every 30s
│   └── ProtectedRoute.jsx     ← (also at routes/ProtectedRoute.jsx)
└── pages/
    ├── auth/                  ← Login, Register, VerifyEmail, ForgotPassword, ResetPassword, MaintenancePage
    ├── hr/                    ← HRDashboard, Employees, EmployeeDetail, EmployeeModal,
    │                             LeadPipeline, LeadDetail, Tasks, TaskDetail, ResumeSourcing,
    │                             Reports, OfferRequests, OfferRequestDetail,
    │                             InterviewRequests, InterviewRequestDetail, ScheduledInterviews, HRInvoices
    ├── outreach/              ← OutreachDashboard, ContactLists, ContactListDetail,
    │                             EmailCampaigns, EmailCampaignNew, EmailCampaignDetail,
    │                             WhatsAppCampaigns, WhatsAppCampaignNew, WhatsAppCampaignDetail,
    │                             WhatsAppTemplates, Replies, ReplyDetail,
    │                             OutreachCalls, OutreachAnalytics
    ├── company/               ← CompanyDashboard, JobPostings, ShortlistView, InterviewScheduler,
    │                             OfferManagement, CompanyProfile, CompanyRequestsPage,
    │                             CompanyPayments, PaymentCallback,
    │                             CompanyTraining (browse catalogue + request training at /company/training),
    │                             TalentPool (browse + unlock resumes), ResumeUnlockCallback
    ├── candidate/             ← CandidateDashboard, CandidateProfile, CandidateJobs,
    │                             CandidateApplications, CandidateInterviews, CandidateDocuments,
    │                             CandidateLayout (Training nav item removed)
    ├── admin/                 ← AdminLayout, AdminDashboard, CompanyApprovals, CompanyRequests,
    │                             CandidateManagement, HRStaffManagement, RecruitmentOversight,
    │                             PlatformAnalytics (financial KPIs + exec performance table),
    │                             AuditLog, PlatformSettings (env var collapsible sections + fee/behaviour controls),
    │                             TrainingManager (6 tabs: Training Catalogue / Company Requests /
    │                               Internal Courses / Benchmarks / Assignments / Progress),
    │                             AdminPayments (merged: Service Invoices + Placement Fees tabs)
    ├── training/              ← TrainingDashboard, CoursePlayer, CertificatePage (no longer exposed in candidate nav)
    └── NotificationsPage.jsx  ← full notifications page (all roles)
```

---

## Authentication

- JWT stored in **httpOnly cookie** (`token`). Also accepted via `Authorization: Bearer <token>` header.
- `req.user` decoded shape: `{ id, email, role }` — role is the string name from the roles table.
- Always chain: `authenticateToken` → `authorizeRole('role')` on every protected route.
- `GET /auth/me` restores session on page reload via `AuthContext`.
- **Login.jsx**: if already authenticated (session cookie active), immediately redirects to role home — does NOT show the login form.

### Role → Home Route Map (used in Login.jsx and RoleRedirect)

| Role | Home |
|------|------|
| `candidate` | `/candidate` |
| `company` | `/company` |
| `hr_staff` | `/hr` |
| `admin` | `/admin` |
| `trainer` | `/admin/training` |

### Role Access by Portal

| Portal | Route | Allowed Roles |
|--------|-------|---------------|
| HR Portal | `/hr/*` | `hr_staff`, `admin` |
| Outreach | `/outreach/*` | `hr_staff`, `admin` |
| Admin | `/admin/*` | `admin`, `trainer` |
| Company | `/company/*` | `company` |
| Candidate | `/candidate/*` | `candidate` |

**Important**: Admin can access `/hr/*` (HRLayout renders an "Admin View" banner + "← Admin Dashboard" escape link in both navbar and sidebar so admin is never stranded in the executive portal).

---

## SSO Login (2026-06-30)

Password-based login is **fully retired** for every role except `trainer`. Login is split by role:

| Roles | Provider | Endpoint | Auto-provisions on first login? |
|-------|----------|----------|----------------------------------|
| `hr_staff`, `admin` | Microsoft 365 (any tenant — not restricted to one organization) | `POST /api/auth/microsoft` | **No.** Account must already exist (see Provisioning below). |
| `candidate`, `company` | Google | `POST /api/auth/google` | **Yes** — first sign-in creates the account (same shape as the old self-registration flow). |
| `trainer` | Email + password (unchanged) | `POST /api/auth/login` | No — admin-created, not self-registered. |

- Both SSO endpoints are **frontend-token-verification** flows, not server-side OAuth redirects: the browser SDK (`@azure/msal-browser` / `@react-oauth/google`) obtains an ID token directly, the frontend POSTs `{ idToken }` (Microsoft) or `{ idToken, role }` (Google) to the backend, and the backend verifies the token's signature against the provider's public keys before trusting any claim. No client secret is needed on either end — only the public client ID, which is why `MICROSOFT_CLIENT_ID`/`GOOGLE_CLIENT_ID` (backend) and `VITE_MICROSOFT_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` (frontend) are the only new config values.
- `utils/msVerify.js` — verifies Microsoft ID tokens via `jwks-rsa` against the `common` (multi-tenant) JWKS endpoint, since login isn't restricted to one Microsoft 365 tenant. Validates signature, audience (`MICROSOFT_CLIENT_ID`), expiry, and that the issuer matches the `https://login.microsoftonline.com/{tenant}/v2.0` pattern (any tenant accepted).
- Google tokens are verified directly in `authController.js` via `google-auth-library`'s `OAuth2Client.verifyIdToken()`.
- `user_oauth_identities` (migration `oauth_login.sql`) — `(user_id, provider, provider_user_id, email)`, `UNIQUE(provider, provider_user_id)`. Linked on every successful SSO login (`INSERT IGNORE`, so repeat logins are a no-op). The very first login for an account links by matching `users.email`, not this table — it exists purely to speed up/audit repeat logins, not as the primary lookup.
- **Role enforcement is server-side**, not just a frontend UI choice: `authController.login()` rejects password attempts for `hr_staff`/`admin`/`candidate`/`company` outright (checked before the bcrypt compare, so it also catches pre-existing password accounts from before this change, not just new ones) — `microsoftLogin`/`googleLogin` each also reject if the matched user's role isn't one of the roles that provider is allowed to serve.

### Provisioning hr_staff / admin (no self-service, by design)
Auto-creating a privileged account from an arbitrary Microsoft sign-in would be a privilege-escalation hole, so `microsoftLogin` never creates a `users` row — it only matches an existing one by email. New staff must be pre-provisioned via the **existing** `POST /api/admin/staff` (`adminController.createStaff`, Admin → HR Staff Management) **before** their first Microsoft login: this creates a bare `users` row (`status='active'`, `is_email_verified=1`, an unusable random password hash) and emails them to sign in with Microsoft using that same email address. `createStaff` defaults `role` to `hr_staff` but accepts any valid role name (including `admin`) — there's just no UI control exposed for picking `admin` today, only the API supports it.

### Provisioning candidate / company (self-service via Google, unchanged business rules)
`googleLogin` auto-creates the `users` row on first sign-in when no existing account matches the email, mirroring the retired `register()` endpoint's behavior exactly: candidates get `status='active'` immediately; companies get `status='pending'` + a `company_approvals` row and must wait for admin approval (Admin → Company Approvals) before they can actually log in — the endpoint links the Google identity either way (so the *next* login after approval just works) but returns a 403 "pending approval" message instead of a session cookie for a brand-new pending company.

### Login.jsx / Register.jsx
- **Login.jsx** — two buttons only: "Sign in with Microsoft" and "Sign in with Google". No password form. A small "Trainer? Sign in here" link routes to `/login/trainer` (`TrainerLogin.jsx`), the one remaining email+password form, for the sole role not covered by either SSO provider.
- **Register.jsx** — a Candidate/Hiring Company toggle + a single "Sign up with Google" button. No name/email/password fields — Google supplies verified name+email. POSTs the same `{ idToken, role }` shape as login; the backend tells new-vs-returning apart by whether `users.email` already matches.
- `POST /api/auth/register` (password self-registration) is **not deleted**, just short-circuited — it now always returns 400 with a message pointing at the correct SSO path, in case anything still links to it.

---

## Database

MySQL database: `ladder_consulting`. All tables use soft delete (`deleted_at`).

### Core Tables

| Table | Key Columns |
|-------|-------------|
| `users` | id, role_id (→roles), name, email, password (bcrypt), status, is_email_verified, deleted_at |
| `roles` | id, name (admin/hr_staff/company/candidate/trainer) |
| `employees` | id, user_id, employee_code, department, designation, date_joined, manager_id, outreach_email, outreach_email_name, deleted_at |
| `candidates` | id, user_id — auto-created on first access |
| `candidate_profiles` | user_id FK, full_name, bio, linkedin, github, portfolio, etc. |
| `candidate_skills` | user_id, skill_name, proficiency |
| `candidate_education` | user_id, institution, degree, field, start/end year |
| `candidate_experience` | user_id, company, title, start/end date, description |
| `resumes` | user_id, s3_key, original_name, parsed_text, ai_skills JSON, ai_experience_years, ai_summary, deleted_at |
| `companies` | id, user_id, name, industry, location, website, is_approved, assigned_executive_id, executive_assigned_at, executive_assigned_by, deleted_at |
| `company_executive_assignments` | company_id, executive_user_id, assigned_by, assigned_at (audit history) |
| `job_postings` | id, company_id, title, description, location, job_type, salary_min/max, experience_min/max, work_mode, openings, deadline, status (draft/active/closed), deleted_at |
| `applications` | id, candidate_id (→candidates.id), job_id, status, cover_letter, deleted_at |
| `shortlists` | id, application_id, status (shortlisted/rejected) |
| `interview_slots` | id, application_id, slot_time, mode (video/phone/in_person), location, notes, status (proposed/confirmed/rescheduled/completed/cancelled), scheduled_by |
| `interview_outcomes` | id, slot_id, result (selected/rejected/hold/no_show), feedback, created_by |
| `offers` | id, application_id, status (sent/accepted/declined/expired/withdrawn), offered_ctc, offer_letter_path |
| `match_results` | id, application_id (NOT job_id/candidate_id directly), fit_score, matched_skills JSON, missing_skills JSON |
| `call_logs` | id, lead_id, employee_id, called_at, duration_secs, outcome, notes, callback_at, deleted_at |
| `leads` | id, assigned_to (→employees.id), company_name, contact_name, contact_email, contact_phone, source, stage ENUM, notes, source_type ENUM, outreach_contact_id, outreach_campaign_id, deleted_at |
| `tasks` | id, assigned_to (user_id), assigned_by (user_id), title, description, priority, status, due_date, completed_at, time_logged_hrs, deleted_at |
| `task_notes` | id, task_id, author_id, note, created_at |
| `attendance` | id, employee_id, date, check_in, check_out, status (present/absent/half_day/leave), notes, deleted_at |
| `notifications` | id, user_id, type, title, body, is_read, metadata JSON, deleted_at |
| `admin_logs` | id, admin_id, action, entity_type, entity_id, old_value JSON, new_value JSON, ip_address, created_at |
| `platform_settings` | setting_key PK, value, updated_by, updated_at |
| `company_requests` | id, company_id, requested_by, assigned_executive_id, request_type ENUM, status ENUM, candidate_id, invoice_id, rejection_reason, metadata JSON, internal_notes, deleted_at |
| `service_invoices` | id, company_id, request_id, fee_type ENUM, amount, status, paid_at, deleted_at |
| `candidate_access_grants` | id, application_id, company_id, candidate_id, invoice_id, request_id, granted_by, granted_at, deleted_at |
| `offer_letter_grants` | id, application_id UNIQUE, company_id, candidate_id, invoice_id, request_id, granted_by, granted_at, deleted_at |
| `placement_fee_invoices` | id, company_id, candidate_id, job_posting_id, application_id, fee_type ENUM, offered_ctc, placement_fee_amount, status ENUM, raised_by, paid_at, deleted_at |
| `invoices` | id, invoice_number UNIQUE, company_id, candidate_id, job_posting_id, application_id, raised_by, invoice_type ENUM, amount, amount_paid, status ENUM, due_date, paid_at, deleted_at |
| `payment_transactions` | id, invoice_id, company_id, amount, payment_method ENUM, transaction_id, cashfree_order_id, cashfree_payment_id, cashfree_signature, status ENUM, initiated_at, completed_at |

### Outreach Tables

| Table | Key Columns |
|-------|-------------|
| `outreach_contact_lists` | id, uploaded_by (user_id), list_name, file_key (S3), file_name, total_contacts, imported_contacts, failed_rows, import_status ENUM, import_errors JSON, deleted_at |
| `outreach_contacts` | id, list_id, uploaded_by, full_name, email, phone, whatsapp_number, company_name, designation, city, source, tags JSON, is_unsubscribed, unsubscribed_at, lead_id (→leads), deleted_at |
| `outreach_campaigns` | id, created_by, campaign_name, campaign_type ENUM(email/whatsapp/call), list_id, subject, message_body, from_email, from_name, reply_to_tag, whatsapp_template_id, variable_mapping JSON, scheduled_at, sent_at, status ENUM, total_recipients, sent_count, failed_count, reply_count, deleted_at |
| `outreach_campaign_logs` | id, campaign_id, contact_id, channel ENUM, status ENUM, sent_at, replied_at, error_message, whatsapp_message_id, email_message_id |
| `outreach_email_replies` | id, campaign_id, campaign_log_id, contact_id, assigned_to (user_id), channel ENUM(email/whatsapp), from_email, from_name, from_phone, subject, body_text, body_html, received_at, in_reply_to, message_id, thread_id, reply_status ENUM, lead_id, reply_note, deleted_at |
| `outreach_call_logs` | id, campaign_id, contact_id, called_by (user_id), called_at, duration_secs, outcome ENUM, notes, callback_at, lead_id, deleted_at |
| `whatsapp_templates` | id, created_by, template_name, language_code, category ENUM, header_type ENUM, header_content, body_text, footer_text, variable_count, is_active, deleted_at |

### Key DB Invariants

- **Soft delete everywhere**: `UPDATE ... SET deleted_at = NOW()`. Every SELECT must include `WHERE deleted_at IS NULL`.
- **match_results**: linked via `application_id` only — never has `job_id` or `candidate_id` columns directly. Always join through `applications`.
- **leads.assigned_to**: `NOT NULL` FK to `employees.id`. `getEmployeeId(userId)` resolves `user_id → employee.id`.
- **companies**: auto-created on first company portal access via `getOrCreateCompany(userId)`.
- **candidates**: auto-created with `INSERT IGNORE INTO candidates (user_id) VALUES (?)`.
- **roles table**: `admin=1, hr_staff=2, company=3, candidate=4, trainer=5` (IDs may vary; always join for name).

---

## All API Routes

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | public | Register new user |
| POST | `/verify-email` | public | Verify email token |
| POST | `/login` | public | Login, sets httpOnly cookie |
| POST | `/forgot-password` | public | Send reset email |
| POST | `/reset-password` | public | Reset with token |
| POST | `/logout` | any | Clear cookie |
| GET | `/me` | any | Get current user |

### Employees — `/api/employees` (hr_staff, admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stats` | hr_staff, admin | Dashboard KPIs (role-scoped) |
| GET | `/available-users` | admin | hr_staff users without employee record |
| GET | `/` | hr_staff, admin | List employees (search, dept filter) |
| GET | `/:id` | hr_staff, admin | Employee detail |
| POST | `/` | admin | Create employee |
| PUT | `/:id` | admin | Update employee |
| PUT | `/:id/assign-role-department` | admin | Assign role/dept |
| DELETE | `/:id` | admin | Soft delete |
| GET | `/:id/attendance` | hr_staff, admin | Get attendance |
| POST | `/:id/attendance` | admin | Add attendance record |

### Calls — `/api/calls` (hr_staff, admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List call logs (role-scoped to own employee) |
| POST | `/` | Log a call against a lead |
| PUT | `/:id` | Update call |
| DELETE | `/:id` | Soft delete |

### Leads — `/api/leads` (hr_staff, admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | hr_staff, admin | List (hr_staff scoped to own employee) |
| POST | `/` | hr_staff, admin | Create lead |
| GET | `/:id` | hr_staff, admin | Lead detail with call history |
| PUT | `/:id` | hr_staff, admin | Update lead |
| PUT | `/:id/stage` | hr_staff, admin | Move to new stage |
| PUT | `/:id/assign` | admin | Reassign + notify |
| DELETE | `/:id` | hr_staff, admin | Soft delete |

**Lead stages**: `new → contacted → interested → proposal → converted → lost`

### Tasks — `/api/tasks` (hr_staff, admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | hr_staff, admin | List (role-scoped) |
| POST | `/` | admin | Create task + notify assignee |
| GET | `/:id` | hr_staff, admin | Task detail |
| PATCH | `/:id/status` | hr_staff, admin | Update status + log time |
| POST | `/:id/notes` | hr_staff, admin | Add note |
| GET | `/:id/notes` | hr_staff, admin | List notes |
| DELETE | `/:id` | admin | Soft delete |

**Task statuses**: `pending → in_progress → completed → cancelled`
**Task priorities**: `low, medium, high, urgent`

### Recruitment / Resume Sourcing — `/api/recruitment` (hr_staff, admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs` | All active JDs across companies (with applicant + sourced counts) |
| POST | `/jobs/:jobId/resumes` | Bulk resume upload (multipart field `resumes`, max 20 files, 5MB each). Returns 202 + batch_id; background pipeline per file: extract text (pdf-parse/mammoth) → `parseFullProfile` AI (incl. email) → find-or-create candidate user (random password, verified, active) → insert resume + fill empty profile fields → `parseResumeToSkills` → insert application with `source='executive'` + `sourced_by` → `calculateMatchScore` |
| GET | `/batches` | Upload batches (hr_staff scoped to own; admin sees all) |
| GET | `/batches/:id` | Batch detail + per-file items (status, extracted name/email, fit score, errors) |

Tables: `resume_upload_batches`, `resume_upload_items` (migration `bulk_resume_sourcing.sql`, which also adds `applications.source` ENUM(candidate/executive) + `applications.sourced_by`). Frontend page: `/hr/sourcing` (ResumeSourcing.jsx). Companies see a "Sourced by Ladder" badge in ShortlistView when `source='executive'`. Notification type: `bulk_resume_done`.

**Schema corrections**: `resumes` and `candidate_profiles` are keyed by **candidate_id** (not user_id); `applications.resume_id` is NOT NULL; `companies` name column is **company_name**; `uq_application(candidate_id, job_id)` also blocks re-insert for soft-deleted (withdrawn) applications.

### Reports — `/api/reports` (hr_staff, admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/hr` | hr_staff, admin | Combined HR report |
| GET | `/calls` | hr_staff, admin | Call volume report |
| GET | `/leads` | hr_staff, admin | Lead conversion report |
| GET | `/productivity` | admin | Staff productivity report |

### Candidates — `/api/candidates` (candidate)
Key routes: profile CRUD, resume upload/download/parse/AI-extract, job browse, applications CRUD, documents CRUD.

### Jobs — `/api/jobs`
- `GET /matched` — candidate: AI-matched jobs with fit_score
- `GET|POST /` — company: list/create jobs
- `GET|PUT|PATCH|DELETE /:id` — company: job CRUD
- `GET /:jobId/applications` — company: list applications (PII masked)
- `POST|DELETE /:jobId/applications/:appId/shortlist` — company: shortlist toggle
- `PATCH /:jobId/applications/:appId/status` — company: move application status

### Companies — `/api/companies` (company)
Profile, dashboard, interviews (list/create/update), offers (list/create/update), candidate resume download (masked PDF, gated by an existing application), candidate skills, company requests, talent pool (browse + express interest).

**Resume Unlock** (package selection required to even reach the Talent Pool — see "Resume Unlock Module" below):
- `GET /package-status` — `{ has_package, platinum }`. The mandatory gate check.
- `GET /talent/unlock-status?candidateIds=1,2,3` — bulk check: `{ platinum, pack_credits_remaining, statuses: { [id]: { unlocked, via } } }`
- `POST /talent/:candidateId/unlock` — body `{ tier: 'single'|'pack_4' }`. Tier is ignored/unneeded if Platinum, already unlocked, or a credit is available (grants instantly, no payment). Otherwise creates an `invoices` row (type=resume_unlock) + Cashfree order, returns `{ needs_payment: true, payment_session_id, ... }`.
- `GET /talent/:candidateId/profile` — full profile detail (complete skills w/ proficiency, education, links), identical for every tier. 403 if not unlocked.
- `GET /talent/:candidateId/resume` — **original unmasked file** for Single/4-Pack unlocks; masked/parsed PDF for Platinum. 403 if not unlocked.
- `POST /talent/:candidateId/apply` — body `{ job_id }`. Single/4-Pack unlocks only (403 otherwise) — creates an `applications` row (`source='company'`) so the candidate enters the normal shortlist → interview-request → offer-request flow. Not offered for Platinum-only candidates (they stay on Express Interest).
- `POST /talent/buy-pack` — body `{ tier: 'single'|'pack_4' }`, defaults to `pack_4`. Standalone purchase, no target candidate — used from the package-selection gate and Company Profile. 409 if already Platinum.
- `POST /api/companies/platinum-request` — fires a `platinum_interest` notification to the assigned executive (or admin). No invoice — admin still sets `placement_fee_percent` manually once terms are agreed.

### Interviews — `/api/interviews`
- Candidate: GET `/my`, GET `/offers/my`, PATCH `/slots/:id/confirm`, PATCH `/offers/:id/respond`
- Company: GET `/slots`, PATCH `/slots/:id/cancel`, POST `/:id/outcome`, POST `/:id/offer` (gated by offer_letter_grants)
- **POST `/slots` is DISABLED** — returns 403 `APPROVAL_REQUIRED`. Companies cannot create slots directly; they must use the approval flow below. (Same for the old `POST /api/companies/interviews` → also 403.) Interview slots are created ONLY by `interviewRequestController.approveRequest`.

### Interview Requests — `/api/interview-requests` (the ONLY way an interview gets scheduled)
- Company: POST `/`, GET `/?applicationId=`, POST `/:id/reschedule`
- Executive/Admin: GET `/executive`, GET `/executive/:id`, PUT `/executive/:id/approve`, PUT `/executive/:id/reject`
- Executive/Admin scheduled view: GET `/executive/scheduled` (confirmed/upcoming interviews across the exec's assigned companies — admin sees all; `?scope=upcoming|past|all` or `?status=`; returns real candidate contact + `candidate_never_logged_in` + `application_source`), PATCH `/executive/slots/:id/confirm` (confirm a slot **on behalf of** the candidate — for sourced candidates who never log in). Frontend: `/hr/scheduled-interviews` (ScheduledInterviews.jsx).

### Offer Requests — `/api/offer-requests`
- Company: POST `/`, GET `/:applicationId/status`
- Executive/Admin: GET `/executive`, GET `/executive/:id`, PUT `/executive/:id/approve`, PUT `/executive/:id/reject`

### Notifications — `/api/notifications` (any authenticated)
GET `/`, GET `/unread-count`, PATCH `/read-all`, PATCH `/:id/read`

### Invoices — `/api/invoices`
- Executive: GET|POST `/exec`, GET `/exec/companies` (selectable by name — assigned companies for hr_staff, all for admin; used by the HRInvoices company picker), GET `/exec/summary`, GET|PUT|DELETE `/exec/:id`, PUT `/exec/:id/mark-paid`, PUT `/exec/:id/mark-partial`
- Company: GET `/company`, GET `/company/:id`, POST `/company/:id/pay`
- Admin: GET `/admin/all`, GET `/admin/summary`

### Payments — `/api/payments`
GET `/verify/:cashfreeOrderId`, POST `/webhook/cashfree` (signature verified, no auth)

### Admin — `/api/admin` (admin only)
Companies: list, unassigned, detail, approve/reject/suspend/reactivate/delete, assign-executive, executive-assignments.
Requests: list, update.
Candidates: list, detail, suspend/reactivate.
Staff: list, create, update, deactivate, performance.
Recruitment: overview, pipeline, placements.
Analytics: summary, monthly, conversion funnel.
AI: recompute match scores, backfill job skills.
Offer requests + placement fees, invoices, interview requests, audit logs, platform settings.

### Outreach — `/api/outreach` (hr_staff, admin)

**Contact Lists:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/contact-lists/upload` | Upload Excel/CSV (multer memoryStorage → S3 optional → DB import in background) |
| GET | `/contact-lists` | List (hr_staff scoped to own uploads) |
| GET | `/contact-lists/:id` | Detail + import status |
| GET | `/contact-lists/:id/contacts` | Paginated contacts (search, filters) |
| DELETE | `/contact-lists/:id` | Soft delete list + contacts |
| PATCH | `/contacts/:id/unsubscribe` | Mark unsubscribed |
| GET | `/contacts/:id/call-history` | All call logs for contact |

**Email Campaigns:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/email-campaigns` | Create campaign (draft) |
| GET | `/email-campaigns` | List (hr_staff scoped to own) |
| GET | `/email-campaigns/:id` | Detail + stats |
| PUT | `/email-campaigns/:id` | Update draft/scheduled |
| POST | `/email-campaigns/:id/send` | Trigger send (background, 20/batch, 1s delay) |
| POST | `/email-campaigns/:id/pause` | Pause mid-send |
| DELETE | `/email-campaigns/:id` | Soft delete draft |

**Replies:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/replies` | hr_staff, admin | List (hr_staff scoped to assigned_to) |
| GET | `/replies/:id` | hr_staff, admin | Detail (auto-marks as read) |
| POST | `/replies/:id/reply` | hr_staff, admin | Send email reply (proper threading headers) |
| PATCH | `/replies/:id/convert` | hr_staff, admin | Convert to lead |
| PATCH | `/replies/:id/ignore` | hr_staff, admin | Ignore |
| PATCH | `/replies/:id/assign` | admin | Reassign to executive |

**WhatsApp:**
| Method | Path | Description |
|--------|------|-------------|
| GET|POST | `/whatsapp/templates` | List / create templates |
| PUT|DELETE | `/whatsapp/templates/:id` | Update / soft delete |
| POST | `/whatsapp-campaigns` | Create WA campaign |
| GET | `/whatsapp-campaigns` | List |
| GET | `/whatsapp-campaigns/:id` | Detail |
| POST | `/whatsapp-campaigns/:id/send` | Send (WhatsApp Cloud API) |

**Webhooks (no auth — mounted directly on app in server.js):**
- `GET /api/outreach/webhooks/whatsapp` — Meta verification (hub.challenge)
- `POST /api/outreach/webhooks/whatsapp` — Incoming messages + delivery receipts

**Cold Calls:**
GET|POST `/calls`, PUT `/calls/:id`

**Analytics:**
GET `/analytics/campaigns`, GET `/analytics/conversions`

**Admin Outreach (admin only, mounted directly on app):**
GET `/api/admin/outreach/campaigns`, GET `/api/admin/outreach/replies`

---

## Key Patterns & Invariants

### notify() Pattern (used in all controllers)
```js
const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};
```

### getEmployeeId() Pattern (used wherever leads/calls need employee FK)
```js
const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};
```

### Role Scoping Pattern
```js
if (req.user.role === 'hr_staff') {
    const empId = await getEmployeeId(req.user.id);
    filters.push('assigned_to = ?'); params.push(empId);
}
// admin sees everything — no filter added
```

### Transaction Pattern
```js
const conn = await db.getConnection();
try {
    await conn.beginTransaction();
    // ...operations...
    await conn.commit();
} catch (e) {
    await conn.rollback(); throw e;
} finally { conn.release(); }
```

### logAction Pattern (audit trail)
```js
logAction(req.user.id, 'action_name', 'entity_type', entityId, { details }, ip(req));
// ip(req) = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress
```

### Response Shape
All controllers return `{ success: true, data: ... }` or `{ success: false, message: '...' }`.
Frontend reads `r.data.data` for list/detail payloads.

### Auto-create Patterns
```js
// candidates
await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
const [[row]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);

// companies
// companyController.getOrCreateCompany(userId) — same pattern
```

---

## Email & SMTP

### Transactional Email (`utils/email.js`)
```js
sendEmail({ to, subject, html })
// Uses: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM
// Current config: GoDaddy smtpout.secureserver.net:465 SSL, info@certifybusiness.com
```

### Outreach Email (`utils/outreachEmail.js`)
- Dedicated GoDaddy transporter for cold outreach (same creds, separate transporter instance)
- `replaceMergeTags(template, contact, executiveName)` — replaces `{{first_name}}`, `{{full_name}}`, `{{company_name}}`, `{{designation}}`, `{{city}}`, `{{executive_name}}`
- `buildReplyToAddress(campaignId, executiveId)` → `local+lc-{campId}-{execId}@domain.com`
- `parseReplyToTag(address)` → `{ campaignId, executiveId }` or null

### Mail Poller (`services/mailPoller.js`)
- Auto-starts on server boot via `startMailPoller()`
- `setInterval(runPollCycle, 120000)` — first run 10s after boot
- Connects to GoDaddy IMAP (`imap.secureserver.net:993`)
- Searches UNSEEN emails, tries 3 matching strategies (tagged Reply-To → In-Reply-To header → sender email lookup)
- On match: updates campaign_logs, increments reply_count, creates outreach_email_replies, auto-creates lead, notifies executive
- On no match: stores reply, notifies admin
- Toggle: `platform_settings.mail_poller_enabled = 'true'|'false'`
- Uses `roles` table join (not `role` column) for admin lookup

---

## Outreach Module — Detailed Flows

### Excel Import Flow
1. POST `/api/outreach/contact-lists/upload` (multipart, field name `file`)
2. Multer memoryStorage → if `S3_BUCKET` set, upload to `outreach/lists/{uuid}.ext`; if not, skip S3
3. Insert `outreach_contact_lists` record with `import_status='processing'`
4. `setImmediate(() => importContacts(...))` — background
5. Column mapping: case-insensitive header matching (Full Name/Name → full_name, Email/Email ID → email, etc.)
6. Skip rows missing both email AND phone/whatsapp → log in `import_errors`
7. Deduplicate by email within same list
8. Batch INSERT into `outreach_contacts`
9. Update list: `import_status='done'`, counts, errors

### Email Send Flow
1. POST `/:id/send` → sets `status='sending'`, counts contacts, returns immediately
2. `setImmediate(() => sendEmailBatch(...))` — background
3. Resolves `from_email` from campaign record (set at creation from `employees.outreach_email` or env default)
4. Per contact: `replaceMergeTags`, compose with custom headers (`X-LC-Campaign-ID`, `X-LC-Executive-ID`, `X-LC-Contact-ID`, `List-Unsubscribe`, `Reply-To: tagged address`)
5. Sends in batches of 20 with 1s delay
6. Checks `pausedCampaigns` Set (in-memory) before each batch
7. On completion: updates `status='sent'|'paused'`, counts, notifies creator

### Lead Conversion (`services/leadConverter.js`)
```js
createLeadFromContact({ contactId, source, campaignId, executiveUserId, replyId, callLogId })
```
- Resolves `employee_id` for the executive; if none (admin), falls back to first active hr_staff employee
- Checks `outreach_contact_id` for existing lead — if found, advances stage from 'new' to 'contacted'
- If not found: creates lead, links `outreach_contacts.lead_id`
- Updates reply/call log `lead_id`
- Notifies executive

---

## Payment System (Cashfree)

- Mode: controlled by `CASHFREE_ENV` env var (`TEST` or `PROD`)
- Flow: Company → POST `/api/invoices/company/:id/pay` → `paymentController.initiatePayment` → `cashfreeService.createOrder` → returns `payment_link` → company redirected → return URL → `GET /api/payments/verify/:cashfreeOrderId` → `cashfreeService.getOrderStatus` → update invoice + transaction
- Webhook: `POST /api/payments/webhook/cashfree` — signature verified with `CASHFREE_WEBHOOK_SECRET`, processes `PAYMENT_SUCCESS` idempotently

---

## Offer Letter Fee Gate (placement fee + Cashfree)

- Company must have an `offer_letter_grants` record for the application before `POST /api/interviews/:id/offer` succeeds
- Flow: outcome=selected → company submits `POST /api/offer-requests` (type=offer_letter_release, with **offered_ctc = the ANNUAL CTC** offered to the candidate — relabeled from "Monthly" to "Annual" everywhere on 2026-06-29, see below) → executive (`co.assigned_executive_id`) reviews → **approves** → creates `offer_letter_grants` **and raises a company-payable `invoices` row** (type=placement_fee, due_date=+14d). The original `placement_fee_invoices` row stays `pending` — it is NOT marked paid on approve.
- The fee itself is computed at **submit** time (`offerRequestController.submitOfferRequest`), not at approve:
  - **Platinum** (`companies.placement_fee_percent` set): `fee = ctc × (percent / 100)` — applied directly to the annual figure. This is the industry-standard framing where 8.33% = 1/12 = exactly one month's salary, 6.5% ≈ 0.78 months. (Fixed 2026-06-29 — this used to multiply by 12 first, a leftover from when the input was monthly; now that the input is annual, no annualizing step is needed.)
  - **Default** (no contracted rate): `fee = (ctc / 12) × platform_settings.placement_fee_multiplier` — the multiplier is expressed in months of CTC (default `1` = exactly one month's salary), so the annual input is first reduced to its monthly equivalent.
- **Annual vs Monthly CTC, 2026-06-29:** the company-facing input (`InterviewScheduler.jsx`, "Request Offer Letter Release") and every downstream display (HR `OfferRequests.jsx`/`OfferRequestDetail.jsx`, admin `AdminPayments.jsx`/`CompanyRequests.jsx`/`PlacementFees.jsx`) now read "Offered Annual CTC" / "Annual CTC", not "Monthly". The actual offer sent to the candidate (`interviewController.generateOffer`, `offers.ctc`) already expected an annual figure — `handleGenerateOffer` used to compute `monthlyCTC × 12` to satisfy that; now it just passes `gs.offered_ctc` straight through since it's already annual. The frontend's live fee preview (`estimatedFee` in `InterviewScheduler.jsx`) mirrors the backend formula and fetches the company's own `placement_fee_percent` via `companyAPI.getProfile()` to estimate correctly for Platinum companies.
- Company is notified + emailed with the invoice number; they pay (partial or full) via Cashfree on `/company/payments` (existing `POST /invoices/company/:id/pay` flow, `payment_transactions` table). The `paymentController.processSuccessfulPayment` and `invoiceController.markPaid` / `markPartial` all call `utils/placementFee.syncPlacementFeeStatus(applicationId)` which mirrors the `invoices.status` → `placement_fee_invoices.status` (paid only when fully paid). So PFI is the executive's bookkeeping; `invoices` is the collection vehicle.
- Endpoint for the company's "X candidates × CTC due" view: `GET /api/invoices/company/placement-fees/summary` → `{ summary, invoices[] }`. Shown as a card on CompanyPayments. The executive's OfferRequests page surfaces the payable invoice's amount_paid / status / due_date as a progress bar.

---

## Resume Unlock Module

Monetization layer on the company **Talent Pool** (`/company/talent`, `TalentPool.jsx`). As of the 2026-06-29 repricing, **package selection is mandatory** — a company cannot browse the Talent Pool or see AI match % on their own applicants until they've selected one of the three tiers below. Job postings and the rest of the company portal are NOT gated — only candidate access.

### Pricing tiers
| Tier | Price | What it grants |
|------|-------|-----------------|
| Single | ₹999 | 1 credit. Spendable on any candidate, instantly. |
| 4-Pack | ₹3,999 | 4 credits, spendable on any candidates over time (no expiry) |
| Platinum | Per-company contracted % (e.g. 8.33% or 6.5%) | **Free, unlimited** unlocks. Not self-serve — admin sets `companies.placement_fee_percent` (from the signed onboarding agreement) via Company Approvals. A non-NULL rate *is* what makes a company Platinum, and it also overrides the platform-wide multiplier at offer-request time (see Offer Letter Fee Gate below). |

### What "unlock" reveals — differs sharply by tier
- **Single / 4-Pack** (prepaid per-resume): the company already paid Ladder upfront, so there's no fee-collection reason to redact anything. `GET /talent/:candidateId/resume` serves the **original, unmasked resume file** straight off disk — real contact info included, exactly as the candidate uploaded it. The company can then call `POST /talent/:candidateId/apply` to add the candidate as an applicant on one of their own job postings (`applications.source = 'company'`), and proceeds through the normal shortlist → interview-request → offer-request flow.
- **Platinum**: unchanged from the original design — `GET /talent/:candidateId/resume` still serves the **masked/parsed PDF** (same redaction as the post-application download). Contact info stays out; reaching the candidate still goes through "Express Interest" → executive. This is intentional: Platinum's revenue comes from the placement fee at hire, so Ladder still needs to control the interview/offer pipeline to collect it.
- `GET /talent/:candidateId/profile` (structured profile detail — skills w/ proficiency, education, links) is identical for every tier; only the resume **file** differs.
- **This extends into the Shortlist view too** (`jobController.getJobApplications` → `ShortlistView.jsx`), for ANY application of that candidate, not just ones created via `applyToPipeline`. The controller looks up `resume_unlocks WHERE company_id=? AND granted_via IN ('single','pack')` for the requesting company and skips `maskCandidateForCompany()` entirely for matching `candidate_id` rows — real name, email, and `candidate_phone` (the field is masking-aware, see below) come through, flagged `contact_unlocked: true`. Every other row (self-applied, executive-sourced, or Platinum-unlocked) stays masked exactly as before.
- `utils/maskPII.js`'s `maskCandidateForCompany()` masks both bare and `candidate_`-prefixed keys (`name`/`candidate_name`, `email`/`candidate_email`, `phone`/`candidate_phone`) — if you add a new PII field to any company-facing query, alias it to one of these recognized key pairs or extend the function, otherwise it'll leak unmasked by default.

### No placement fee for prepaid candidates — and no mention of it either
If a candidate was unlocked via Single or 4-Pack, `offerRequestController.submitOfferRequest` finds the matching `resume_unlocks` row (`granted_via IN ('single','pack')`) and creates the internal `placement_fee_invoices` row with `status='waived'` instead of `'pending'` — the fee amount is still calculated and stored there for admin/exec bookkeeping, just never collected. As of 2026-06-29, this is also kept entirely out of what the **company** sees:
- `InterviewScheduler.jsx`'s "Request Offer Letter Release" modal omits the placement-fee notice and the live fee preview entirely when the slot's `prepaid_unlock` flag is true (`companyController.listInterviews` computes this per-row from `resume_unlocks`).
- At `approveRequest`, the company-payable `invoices` row is **not created at all** for prepaid candidates — not even as a `status='waived'` row — so nothing fee-related ever appears on `CompanyPayments.jsx` / `CompanyRequestsPage.jsx`. The company's only money record for this candidate stays their original resume-unlock invoice from purchase.
- Every company-facing notification, email, and API response message (`submitOfferRequest` and `approveRequest`) omits the fee/waived clause entirely for prepaid candidates rather than stating "no fee due" — silence, not a substitute message.
- Executive- and admin-facing channels are unaffected — `getRequestDetail`'s `pfi_status`/`placement_fee_amount` (from the internal PFI row) still show the real waived state, and the admin notification on approval still says "Placement Fee Waived (Prepaid)" for internal visibility. `payable_invoice_id` simply comes back `null` (LEFT JOIN, no row), which `OfferRequestDetail.jsx` already handles gracefully (`{payable && (...)}`).
- `offerRequestController.getRequestStatus` (powers the company's own "Awaiting Approval"/"Generate Offer Letter" button state in `InterviewScheduler.jsx`) also omits `placement_fee` from its response entirely when the PFI is `'waived'` — the raw `pfi_status` value itself is read server-side only, never serialized into the JSON response.

### Consistency fixes across the rest of the company portal (2026-06-29)
A few spots elsewhere still treated every candidate the same way, pre-dating the package system:
- `companyController.listInterviews` unconditionally masked `candidate_name` to initials. It now reuses the same `prepaid_unlock` check as the Shortlist view — Single/4-Pack candidates show their real name in Interviews and Offers (`OfferManagement.jsx` reuses this same endpoint, so it inherited the fix automatically).
- `InterviewScheduler.jsx`'s "Generate Offer" modal said "Placement fee confirmed" unconditionally — now reads "Offer letter is approved." for prepaid candidates, no fee mention.
- `resumeUnlockController.createUnlockOrder` never set a `description` on the resume-unlock invoice it raises, and `CompanyPayments.jsx`'s `TYPE_LABELS` had no entry for `invoice_type='resume_unlock'` — invoices showed with a blank type badge and no indication of Single vs 4-Pack. Both fixed (also added the pre-existing missing `training_fee` label while in there).
- `CompanyRequestsPage.jsx` and its backend (`companyController.listRequests`) were checked and need no changes — that page is driven entirely by the older `service_invoices`/`candidate_access_grants` mechanism (`candidate_profile_access`/`interview_scheduling` request types), which the package system never touches. `offer_letter_release` requests appear in that list but never carry invoice data there by pre-existing design — their invoice lives in `CompanyPayments.jsx` instead.

Platinum and any candidate with no unlock record at all are unaffected — the existing fee-at-hire model, invoice creation, and messaging continue exactly as before.

### Resolution order (`resumeUnlockController.purchaseUnlock`)
1. **Platinum** (`placement_fee_percent IS NOT NULL`) → grant instantly, no invoice.
2. **Already unlocked** (existing `resume_unlocks` row) → no-op, idempotent.
3. **Spare credit** (`consumePackCredit()` in `utils/resumeUnlock.js`, draws from the oldest paid order — `single` or any pack — with `credits_used < credits_total`) → grant instantly, no new payment.
4. Otherwise → requires `tier` in the request body; creates an `invoices` row (type=`resume_unlock`, **self-raised**: `raised_by` = the company user, not an executive) + a `resume_unlock_orders` row + a Cashfree order, same redirect-based checkout as `CompanyPayments.jsx` (`window.location.href = https://payments.cashfree.com/forms/{payment_session_id}`, return URL → `/company/talent/unlock-callback`, `ResumeUnlockCallback.jsx`).
5. On Cashfree success, `paymentController.processSuccessfulPayment` calls `fulfillResumeUnlockOrder(invoiceId)` (only when `inv.invoice_type === 'resume_unlock'` and the invoice is now fully `paid`) — a `single` order **bought with a target candidate already chosen** (TalentPool paywall) writes the `resume_unlocks` row immediately. A `single` order bought **with no target yet** (the package-selection gate, or Company Profile) behaves exactly like a pack — it just goes spendable, and step 3 handles the actual per-candidate grant later. This is why `consumePackCredit` no longer filters by `order_type` — a targeted `single` order is already fully consumed (`credits_used = credits_total`) by the time payment completes, so it never shows up as a spare credit regardless.

### Mandatory package-selection gate
- `resumeUnlockController.hasSelectedPackage(companyId, placementFeePercent)` — `true` if Platinum, or at least one `resume_unlock_orders` row has a `status='paid'` invoice. Exported for reuse in other controllers.
- `companyController.getTalentPool` → 403 `{ code: 'PACKAGE_REQUIRED' }` if `!hasSelectedPackage`.
- `jobController.getJobApplications` → when `!hasSelectedPackage`, nulls `match_score`/`match_computed`/`matched_skills`/`missing_skills` server-side (not just hidden in the UI) and sets `package_required: true` per row + top-level. The applicant list itself stays visible — only the AI match % is withheld.
- `GET /api/companies/package-status` → `{ has_package, platinum }`, used by the frontend gate.
- Frontend: `components/company/PackagePicker.jsx` is the single reusable picker (Single/4-Pack/Platinum-request) — rendered inline on `TalentPool.jsx` in place of the candidate grid when gated, and reused as-is on `CompanyProfile.jsx` for re-selecting or topping up later. A company can always buy more credits or request Platinum even after their first selection (point 4 of the repricing spec) — `hasSelectedPackage` only checks "ever paid for something," not "has credits remaining."

### Admin: setting a company's rate
`PATCH /api/admin/companies/:id/placement-fee-rate` (Company Approvals page) — multipart, body `placement_fee_percent` (0–100, or empty to clear/revert to platform default) + optional `agreement` file (reuses `uploadDocument` middleware, stored at `companies.agreement_file_key`). Download via `GET /api/admin/companies/:id/agreement` (blob, authenticated — there is no static file serving in this app, see CORS & Deployment Notes).

### Picking a package from Company Profile (no candidate context yet)
`CompanyProfile.jsx` renders `<PackagePicker />` standalone — useful for a company that wants to set up billing before they've found anyone, or to top up after exhausting credits. Unlike the original design, **Single is now offered here too** (`POST /talent/buy-pack` body `{ tier: 'single' | 'pack_4' }`, defaults to `pack_4`) — since it has no candidate target at purchase time, it's mechanically just a 1-credit pack, spent later exactly like a 4-pack credit (see Resolution order step 5). **Request Platinum** (`POST /platinum-request`) remains just a notification — no invoice; admin still sets the rate manually.

---

## Hired Candidate Lock ("off the market")

Once any application for a candidate reaches `status='hired'`, the candidate is locked from all further activity. Set by two paths: `interviewController.respondToOffer` (candidate accepts) and `companyController.updateOffer` (company marks accepted).

- Single source of truth: `utils/candidateStatus.js` → `isCandidateHired(candidateId)` (true if any non-deleted application has `status='hired'`).
- Guards enforcing it:
  - Candidate self-apply — `candidates.js` `POST /applications/:jobId` → 403
  - Executive bulk sourcing — `recruitmentController.processResumeItem` → item marked `skipped`
  - Company shortlist — `jobController.shortlistApplication` → 409
  - Company status bypass — `jobController.updateApplicationStatus` blocks forward states (shortlisted/interview_scheduled/interviewed/offer_sent) → 409; `rejected` still allowed
- UI signals: company `getJobApplications` returns `hired_elsewhere` (count of the candidate's hired apps on *other* applications) → ShortlistView shows "Hired elsewhere — unavailable" and disables shortlist/status. Candidate `GET /candidates/jobs` returns `is_hired` → CandidateJobs shows a banner and disables Apply.

### Earlier lock: candidates with a pending offer are kept out of the Talent Pool
A candidate can hold an active `offers` row (`status IN ('sent','accepted')`) well before `applications.status` reaches `'hired'` — `'sent'` means a company already has an outstanding offer letter with them, awaiting their response. This is a *narrower* lock than the full Hired Candidate Lock above: it only matters for the Talent Pool / resume-unlock surfaces, so a second company can't discover, unlock, or pull a candidate into their own pipeline while another company's offer is pending.

- Helper: `utils/candidateStatus.js` → `hasPendingOffer(candidateId)` (true if any non-deleted application has an `offers` row with `status IN ('sent','accepted')`).
- Guards enforcing it (all in addition to the existing `isCandidateHired` checks at the same call sites):
  - `companyController.getTalentPool` — listing + count queries both `NOT EXISTS` a `sent`/`accepted` offer, so the candidate simply doesn't appear in the browse/search grid for anyone.
  - `resumeUnlockController.purchaseUnlock` — 409 if the company tries to unlock a candidate by direct `candidateId` anyway (covers a stale page, bookmarked URL, or anyone who unlocked them *before* the offer existed).
  - `resumeUnlockController.applyToPipeline` — 409, same reasoning — prevents adding an already-offered candidate to a *different* company's job pipeline.

---

## Interview Approval Flow

- Company cannot directly create interview slots — must submit `POST /api/interview-requests` (type=interview_schedule). The two old direct paths (`POST /api/interviews/slots`, `POST /api/companies/interviews`) now hard-403 `APPROVAL_REQUIRED`. **The executive approval is what entitles Ladder to its placement cut at hire** — so it is mandatory, enforced server-side, and the ONLY way a slot gets created.
- Request stored in `company_requests` with `metadata JSON` (proposed datetime, mode, notes). `assigned_executive_id` is copied from `companies.assigned_executive_id` at submit time, and the sourcing executive (`applications.sourced_by`) is also notified if different.
- Executive sees pending queue at `/hr/interview-requests`, approves/rejects/modifies. **Visibility/authorization rule (all interview-request endpoints):** an hr_staff executive sees/acts on a request when `cr.assigned_executive_id = me` **OR** `applications.sourced_by = me` (the candidate they bulk-sourced); admin sees all. This is because bulk sourcing is open to any executive, so the sourcing exec must not be locked out of follow-up even when the company is assigned to a different exec.
- Approval (`approveRequest`): creates `interview_slots` record (status `proposed`), notifies company + candidate
- After approval the interview appears in the executive **Scheduled Interviews** view (`/hr/scheduled-interviews`, GET `/api/interview-requests/executive/scheduled`) — scoped to the exec's assigned companies (admin all), showing real candidate contact so the exec can notify them.
- **Confirm-on-behalf**: candidate slot confirmation (`PATCH /api/interviews/slots/:id/confirm`) requires the candidate to log in. Executive-sourced candidates never log in, so the executive can confirm on their behalf via `PATCH /api/interview-requests/executive/slots/:id/confirm` (sets `candidate_confirmed=1`, status `confirmed`). The scheduled view flags `candidate_never_logged_in` (users.last_login_at IS NULL) and `application_source='executive'`.
- Company can reschedule via `POST /api/interview-requests/:id/reschedule`

---

## Notification Types (in use)

`lead_assigned`, `task_assigned`, `task_completed`, `offer_request`, `offer_approved`, `offer_rejected`, `reply_assigned`, `outreach_reply`, `whatsapp_reply`, `outreach_unmatched`, `lead_converted`, `campaign_sent`, `callback_scheduled`, `talent_interest`, `platinum_interest`

---

## Environment Variables

```env
# App
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5001

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ladder_consulting
DB_USER=root
DB_PASSWORD=...

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=30d

# SSO Login (backend) — see "SSO Login" section below
MICROSOFT_CLIENT_ID=...
GOOGLE_CLIENT_ID=...
# SSO Login (frontend/.env, Vite) — same client IDs, VITE_-prefixed
# VITE_MICROSOFT_CLIENT_ID=...
# VITE_GOOGLE_CLIENT_ID=...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=ladder-consulting-files

# Transactional Email (GoDaddy)
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@certifybusiness.com
SMTP_PASS=...
EMAIL_FROM="CertifyBusiness <info@certifybusiness.com>"

# Outreach SMTP (same GoDaddy account)
GODADDY_SMTP_HOST=smtpout.secureserver.net
GODADDY_SMTP_PORT=465
GODADDY_SMTP_SECURE=true
GODADDY_SMTP_USER=info@certifybusiness.com
GODADDY_SMTP_PASS=...
GODADDY_DEFAULT_FROM_NAME=CertifyBusiness

# Outreach IMAP (reply polling)
GODADDY_IMAP_HOST=imap.secureserver.net
GODADDY_IMAP_PORT=993
GODADDY_IMAP_SECURE=true
GODADDY_IMAP_USER=info@certifybusiness.com
GODADDY_IMAP_PASS=...

# OpenAI — NO LONGER needed for resume parsing or job matching (both fully offline
# via utils/resumeParser.js). Only trainingService.js (AI course recommendations)
# still uses this key; leave unset if you don't use training recommendations.
OPENAI_API_KEY=...
AI_MATCH_THRESHOLD=40

# Cashfree Payments
CASHFREE_APP_ID=...
CASHFREE_SECRET_KEY=...
CASHFREE_ENV=TEST
CASHFREE_BASE_URL_TEST=https://sandbox.cashfree.com/pg
CASHFREE_BASE_URL_PROD=https://api.cashfree.com/pg
CASHFREE_WEBHOOK_SECRET=...

# WhatsApp Cloud API
WHATSAPP_API_URL=https://graph.facebook.com/v19.0
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

---

## Frontend Theme

Brand theme is defined entirely in `frontend/tailwind.config.js` ("Ladder Violet" `#6a47d4`): the `blue`, `indigo`, and `brand` Tailwind palettes are ALL remapped to the same custom violet scale, and `gray` is remapped to slate. This means every `bg-blue-600`/`text-indigo-700` etc. across all portals renders in brand colors — restyle the app by editing the palette in one place, never by find-replacing classes in pages. Headings use `Plus Jakarta Sans` (`font-display`, applied to h1–h6 in `index.css`); body text is Inter. Shared component classes (.btn-primary, .card, .form-input, .auth-*, .navbar-*, .table, .badge-*) live in `src/index.css` under `@layer components`.

**Logo assets (added 2026-06-30, rebrand to "LadderStep Human Consulting")** — source file `frontend/public/Logo.png` (3508×2482, white background, no alpha) is never used directly in the UI; two derivatives generated from it instead:
- `frontend/public/logo-icon.png` — square crop of just the building/swoosh mark (no wordmark), white background, 512×512. Used in every portal navbar/sidebar next to the "LadderStep Human Consulting" text (HRLayout, CompanyLayout, OutreachLayout, CandidateLayout). AdminLayout's sidebar is dark, so there the icon sits inside a small `bg-white rounded-lg` chip rather than directly on the background — the source PNG has no transparency, and a true alpha cutout isn't viable because the icon's growth-arrow shapes are themselves white-on-color (not just background), so a naive "make white transparent" pass turns them into holes. A border-aware flood-fill (connected-component analysis keying off which white regions touch the image edge) was attempted and abandoned — the arrows' tails merge into the outer background through the gap under the buildings at every threshold tried, so there's no clean topological separation between "background white" and "foreground white" in this asset.
- `frontend/public/logo-full.png` — tightly trimmed full lockup (icon + "LADDERSTEP HUMAN CONSULTING" wordmark), white background, 1400px wide. Used on every auth page (Login, Register, ForgotPassword, ResetPassword, VerifyEmail, MaintenancePage), centered above the card heading.
- `favicon.ico` (16/32/48px) + `apple-touch-icon.png` (180px) + `icon-192.png`, all generated from `logo-icon.png`, wired up in `index.html`.

## Frontend Dependency Summary

```json
{
  "react": "^19.2.5",
  "react-router-dom": "^7.15.0",
  "axios": "^1.16.0",
  "react-hot-toast": "^2.6.0",
  "chart.js": "^4.5.1",
  "react-chartjs-2": "^5.3.1",
  "@headlessui/react": "^2.2.10",
  "@heroicons/react": "^2.2.0",
  "react-hook-form": "^7.75.0",
  "@hookform/resolvers": "^5.2.2",
  "zod": "^4.4.3",
  "zustand": "^5.0.13"
}
```

---

## CORS & Deployment Notes

- CORS hardcoded to `http://localhost:5173` in `server.js`. Update for production.
- No static file serving — all file access (resumes, masked PDFs) goes through authenticated API endpoints.
- `uploads/resumes/` and `uploads/masked_resumes/` created automatically on server start.
- WhatsApp webhook URL to register with Meta: `https://{backend-domain}/api/outreach/webhooks/whatsapp`

---

## Migration Files

Located at `backend/migrations/`:
1. `add_extracted_skills_to_candidates.sql`
2. `phase2_executive_assignment_phase3_fee_gate.sql` — executive assignment, fee gate tables, company_requests, service_invoices, candidate_access_grants, offer_letter_grants, placement_fee_invoices, invoices, payment_transactions
3. `outreach_module.sql` — 7 outreach tables + ALTER TABLE leads + ALTER TABLE employees + platform_settings seed
4. `training_services_module.sql` — adds `training_fee` to `invoices.invoice_type` enum; creates `training_catalogue` (7 seeded topics) + `company_training_requests` table
5. `bulk_resume_sourcing.sql` — adds `applications.source`/`sourced_by`; creates `resume_upload_batches` + `resume_upload_items`
6. `free_pool_resumes.sql` — makes `resume_upload_batches.job_id` nullable (a NULL job_id batch was uploaded straight into the free talent pool, no JD)
7. `resume_unlock_module.sql` — adds `companies.placement_fee_percent`/`agreement_file_key`; adds `resume_unlock` to `invoices.invoice_type` enum; creates `resume_unlock_orders` + `resume_unlocks`
8. `resume_unlock_repricing.sql` — `resume_unlock_orders.order_type` enum += `pack_4` (kept legacy `pack_5` for historical rows); `applications.source` enum += `company` (self-initiated applications when a company moves a Single/4-Pack-unlocked Talent Pool candidate into their pipeline)

**Note**: `ADD COLUMN IF NOT EXISTS` is **not** supported in MySQL 8.0 (MariaDB-only). Run ALTER TABLE statements only on fresh databases where the columns don't exist yet.

---

## Training Services Module

### New Tables (migration 4)
| Table | Key Columns |
|-------|-------------|
| `training_catalogue` | id, title, description, category, duration_days, price_per_user, is_active |
| `company_training_requests` | id, company_id, catalogue_id, num_users, requested_by, status(pending/approved/rejected/completed), invoice_id, approved_by, rejection_reason, deleted_at |

### API Routes — `/api/training-services`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalogue` | company, admin | List all active training topics |
| POST | `/request` | company | Submit training subscription request |
| GET | `/my-requests` | company | Company's own request history with invoice status |
| GET | `/admin` | admin | All requests (filterable by status) |
| PUT | `/admin/:id/approve` | admin | Approve → create `training_fee` invoice + email company |
| PUT | `/admin/:id/reject` | admin | Reject with optional reason |
| POST | `/admin/catalogue` | admin | Add new training topic |
| PUT | `/admin/catalogue/:id` | admin | Update topic title/price/duration/description |
| PATCH | `/admin/catalogue/:id/toggle` | admin | Toggle is_active |

### Workflow
1. Admin manages catalogue via **Training Manager → Training Catalogue** tab (card view, add/edit/toggle)
2. Company browses catalogue at `/company/training`, picks topic, enters num_users, submits request
3. Admin sees pending requests under **Training Manager → Company Requests** tab
4. Admin approves → `training_fee` invoice auto-created, company notified by email + in-app
5. Company pays the invoice via **Payments** page (same Cashfree flow as placement fees)
6. Company's request history shows invoice status in real-time

### `invoices.invoice_type` enum (updated)
`placement_fee | partial_payment | other_fee | training_fee`

---

## Known Test Accounts (dev environment)

| Email | Role | Password |
|-------|------|----------|
| admin@ladder.com | admin | Admin@123 |
| test@test.com | hr_staff | Test@123 |
| mahua@test.com | hr_staff | (not set) |
| nachichintu@gmail.com | candidate | (original) |

`test@test.com` (user id=2) has an employee record (id=1, EMP001, HR dept) created for outreach testing.

---

## Open Items

1. **WhatsApp credentials** — `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` not yet configured
2. **S3_BUCKET** — not configured in dev; outreach Excel upload skips S3 and still imports contacts
3. **Scheduled campaign sending** — `scheduled_at` stored but no cron job auto-triggers scheduled campaigns
4. **Overdue invoice cron** — no scheduled job to mark invoices `overdue` past `due_date` (affects both `invoices` and `company_training_requests` approved invoices)
5. **Rich text editor** — outreach email composer uses `<textarea>` (HTML-capable); react-quill not compatible with React 19
6. **Plus-addressing** — reply tracking uses `user+lc-{campaignId}-{execId}@domain.com`; verify GoDaddy supports sub-addressing
7. **WhatsApp template approval** — templates must be pre-approved by Meta before use
8. **Cashfree credentials** — placeholder values; replace with real TEST-mode credentials before payment testing
9. **Training completion tracking** — `company_training_requests.status` stays `approved` after payment; no mechanism yet to mark `completed` after delivery
10. **Post-hire training routes** — `TrainingDashboard`/`CoursePlayer`/`CertificatePage` still exist under `/training` but candidate nav no longer links to them; no role currently has a direct nav path (trainer role via `/admin/training` sees the manager, not the player)
