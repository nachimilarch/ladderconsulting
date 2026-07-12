# CLAUDE.md — LadderStep Human Consulting Platform
## Complete Codebase Reference — Last Updated: 2026-07-12

---

## Project Overview

LadderStep Human Consulting is a full-stack HR, Recruitment, and Outreach SaaS. It is a monorepo with two independent apps:
- `backend/` — Node.js + Express + MySQL (port 5001)
- `frontend/` — React 19 + Vite + Tailwind CSS (port 5173)

**Completed Modules:**
| Module | Status |
|--------|--------|
| Module 1 — Auth (SSO) | Complete |
| Module 2 — HR Operations | Complete |
| Module 3 — Candidate Portal | Complete |
| Module 4 — Company Portal | Complete |
| Cold Outreach Module (Email + WhatsApp via Vaartabot + Calls) | Complete |
| Admin Panel | Complete |
| Training Services (company-facing subscription) | Complete |
| Payments & Placement Fees | Complete |
| Resume Unlock / Talent Pool monetisation | Complete |
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
    ├── aiParser.js            ← resume parsing API (parseResumeText/parseFullProfile) — delegates to resumeParser (offline)
    ├── auditLog.js            ← logAction (fire-and-forget admin_logs insert)
    ├── email.js               ← sendEmail (transactional, GoDaddy SMTP)
    ├── outreachEmail.js       ← getTransporter, replaceMergeTags, buildReplyToAddress, parseReplyToTag
    ├── maskPII.js             ← PII masking for candidate data shown to companies
    ├── candidateStatus.js     ← isCandidateHired(), hasPendingOffer() — lock helpers
    ├── paginate.js            ← pagination helper
    ├── resumeUnlock.js        ← consumePackCredit(), fulfillResumeUnlockOrder()
    ├── placementFee.js        ← syncPlacementFeeStatus(applicationId)
    ├── msVerify.js            ← Microsoft ID token verification (jwks-rsa, multi-tenant)
    └── s3.js                  ← uploadToS3, getPresignedUrl (AWS SDK v3)
```

### Frontend File Tree

```
frontend/src/
├── main.jsx                   ← ReactDOM.createRoot, BrowserRouter
├── App.jsx                    ← All routes + RoleRedirect + AdminHome
├── context/AuthContext.jsx    ← user, loading, login, logout, setUser, loginWithMicrosoft, loginWithGoogle
├── routes/ProtectedRoute.jsx  ← role guard; redirects to /unauthorized
├── api/
│   ├── axios.js               ← base axios (VITE_API_URL || localhost:5001/api, withCredentials)
│   ├── hr.js                  ← employeeAPI, callAPI, leadAPI, taskAPI, reportAPI
│   ├── outreach.js            ← contactListAPI, emailCampaignAPI, replyAPI, waCampaignAPI,
│   │                             vaartabotAPI, waTemplateAPI, autoReplyAPI, outreachCallAPI, analyticsAPI
│   ├── notifications.js       ← notificationAPI
│   ├── payments.js            ← hrInvoiceAPI, companyInvoiceAPI, adminInvoiceAPI, paymentAPI, interviewRequestAPI
│   ├── interview.js           ← companyInterviewAPI, offerRequestAPI, candidateInterviewAPI
│   ├── candidate.js           ← profileAPI, resumeAPI, jobAPI, applicationAPI, aiAPI, documentAPI
│   ├── company.js             ← companyAPI, companyJobAPI, interviewAPI, offerAPI, talentPoolAPI
│   ├── trainingServices.js    ← trainingServiceAPI (company), adminTrainingServiceAPI (admin)
│   ├── recruitment.js         ← recruitmentAPI (resume sourcing batches)
│   └── admin.js               ← adminAnalyticsAPI, adminAuditAPI, adminCompanyAPI, adminAIAPI, adminSettingsAPI, …
├── components/
│   ├── hr/HRLayout.jsx        ← HR sidebar (Employees, Reports, Sourcing, Interviews, Offer Requests,
│   │                             Profile Unlock, My Companies, Package Requests, Invoices, Tasks, Outreach)
│   │                             role-aware: admin sees "← Admin Dashboard" escape
│   ├── outreach/OutreachLayout.jsx ← Outreach sidebar (Dashboard, Contact Lists, Email Campaigns,
│   │                             WhatsApp, WA Templates, Auto-Replies, Replies, Cold Calls, Leads, Analytics)
│   ├── company/PackagePicker.jsx ← self-contained resume-unlock package picker (Single/4-Pack/Platinum-request)
│   ├── candidate/JobDetailModal.jsx ← job detail modal for candidate job search
│   └── NotificationBell.jsx   ← polls /notifications/unread-count every 30s
└── pages/
    ├── auth/                  ← Login (Microsoft SSO), Register (Google SSO), TrainerLogin (email+pw),
    │                             LadderLogin (internal), VerifyEmail, ForgotPassword, ResetPassword, MaintenancePage
    ├── hr/                    ← HRDashboard, Employees, EmployeeDetail, EmployeeModal,
    │                             LeadPipeline, LeadDetail, Tasks, TaskDetail, ResumeSourcing,
    │                             Reports, OfferRequests, OfferRequestDetail,
    │                             Interviews (tabbed: InterviewRequests + ScheduledInterviews),
    │                             InterviewRequestDetail, HRInvoices, PackageRequests,
    │                             ProfileUnlockRequests, AssignedCompanies, CandidateDocumentsView
    ├── outreach/              ← OutreachDashboard, ContactLists, ContactListDetail,
    │                             EmailCampaigns, EmailCampaignNew, EmailCampaignDetail,
    │                             WhatsAppCampaigns, WhatsAppCampaignNew, WhatsAppCampaignDetail,
    │                             WhatsAppTemplates (sync + approval status), AutoReplyFlows,
    │                             Replies, ReplyDetail, OutreachCalls, OutreachAnalytics
    ├── company/               ← CompanyDashboard, CompanyLayout, JobPostings, ShortlistView,
    │                             InterviewScheduler, OfferManagement, CompanyProfile,
    │                             CompanyRequestsPage, CompanyPayments, PaymentCallback,
    │                             CompanyTraining, TalentPool, ResumeUnlockCallback
    ├── candidate/             ← CandidateDashboard, CandidateProfile, CandidateJobs,
    │                             CandidateApplications, CandidateInterviews, CandidateDocuments,
    │                             CandidateLayout
    ├── admin/                 ← AdminLayout, AdminDashboard, CompanyApprovals, CompanyRequests,
    │                             CandidateManagement, HRStaffManagement, RecruitmentOversight,
    │                             PlatformAnalytics, AuditLog,
    │                             PlatformSettings (env var collapsible sections + Vaartabot Webhook Manager),
    │                             TrainingManager, AdminPayments
    ├── training/              ← TrainingDashboard, CoursePlayer, CertificatePage (no routes — open item)
    └── NotificationsPage.jsx  ← full notifications page (all roles)
```

---

## Authentication

- JWT stored in **httpOnly cookie** (`token`). Also accepted via `Authorization: Bearer <token>` header.
- `req.user` decoded shape: `{ id, email, role }` — role is the string name from the roles table.
- Always chain: `authenticateToken` → `authorizeRole('role')` on every protected route.
- `GET /auth/me` restores session on page reload via `AuthContext`.

### Login.jsx / Register.jsx (SSO-only since 2026-06-30)
- **Login.jsx** — Microsoft SSO button + Google SSO button. "Trainer? Sign in here" link → `/login/trainer`.
- **Register.jsx** — Candidate/Company toggle + "Sign up with Google". No password fields.
- **TrainerLogin.jsx** — email + password, the only remaining password login form.
- **LadderLogin.jsx** — internal `/ladder` route (unlisted).

### SSO Login

| Roles | Provider | Endpoint | Auto-provisions? |
|-------|----------|----------|------------------|
| `hr_staff`, `admin` | Microsoft 365 (any tenant) | `POST /api/auth/microsoft` | No — account must pre-exist |
| `candidate`, `company` | Google | `POST /api/auth/google` | Yes on first sign-in |
| `trainer` | Email + password | `POST /api/auth/login` | No |

- Frontend SDK obtains ID token; backend verifies via `utils/msVerify.js` (jwks-rsa) / google-auth-library.
- `user_oauth_identities` table links accounts to SSO identities (`provider`, `provider_user_id`).
- Password login for `hr_staff`/`admin`/`candidate`/`company` is blocked server-side (returns 400).

### Role → Home Route Map

| Role | Home |
|------|------|
| `candidate` | `/candidate` |
| `company` | `/company` |
| `hr_staff` | `/hr` |
| `admin` | `/admin` |
| `trainer` | `/admin/training` |

---

## Database

MySQL database: `ladder_consulting`. All tables use soft delete (`deleted_at`).

### Core Tables

| Table | Key Columns |
|-------|-------------|
| `users` | id, role_id (→roles), name, email, password (bcrypt), status, is_email_verified, deleted_at |
| `roles` | id, name (admin/hr_staff/company/candidate/trainer) |
| `user_oauth_identities` | id, user_id, provider ENUM(microsoft/google), provider_user_id, email |
| `employees` | id, user_id, employee_code, department, designation, date_joined, manager_id, outreach_email, outreach_email_name, deleted_at |
| `candidates` | id, user_id — auto-created on first access |
| `candidate_profiles` | candidate_id FK, full_name, bio, linkedin, github, portfolio, etc. |
| `candidate_skills` | candidate_id, skill_name, proficiency |
| `candidate_education` | candidate_id, institution, degree, field, start/end year |
| `candidate_experience` | candidate_id, company, title, start/end date, description |
| `resumes` | candidate_id FK, s3_key, original_name, parsed_text, ai_skills JSON, ai_experience_years, ai_summary, deleted_at |
| `companies` | id, user_id, company_name, industry, location, website, is_approved, assigned_executive_id, placement_fee_percent, agreement_file_key, deleted_at |
| `company_executive_assignments` | company_id, executive_user_id, assigned_by, assigned_at |
| `job_postings` | id, company_id, title, description, location, job_type, salary_min/max, experience_min/max, work_mode, openings, deadline, status, deleted_at |
| `applications` | id, candidate_id, job_id, status, cover_letter, source ENUM(candidate/executive/company), sourced_by, resume_id NOT NULL, deleted_at |
| `shortlists` | id, application_id, status |
| `interview_slots` | id, application_id, slot_time, mode, location, notes, status, scheduled_by |
| `interview_outcomes` | id, slot_id, result, feedback, created_by |
| `offers` | id, application_id, status, offered_ctc (annual), offer_letter_path |
| `match_results` | id, application_id (join through applications for candidate/job), fit_score, matched_skills JSON, missing_skills JSON |
| `leads` | id, assigned_to (→employees.id), company_name, contact_name, contact_email, stage ENUM, source_type, outreach_contact_id, outreach_campaign_id, deleted_at |
| `tasks` | id, assigned_to (user_id), assigned_by, title, priority, status, due_date, deleted_at |
| `task_notes` | id, task_id, author_id, note |
| `notifications` | id, user_id, type, title, body, is_read, metadata JSON, deleted_at |
| `admin_logs` | id, admin_id, action, entity_type, entity_id, old_value JSON, new_value JSON, ip_address |
| `platform_settings` | setting_key PK, value, updated_by, updated_at |
| `company_requests` | id, company_id, request_type ENUM(candidate_profile_access/interview_scheduling/offer_letter_release/profile_unlock/…), status ENUM, metadata JSON, deleted_at |
| `service_invoices` | id, company_id, request_id, fee_type ENUM, amount, status, deleted_at |
| `candidate_access_grants` | id, application_id, company_id, candidate_id, invoice_id, deleted_at |
| `offer_letter_grants` | id, application_id UNIQUE, company_id, candidate_id, invoice_id, deleted_at |
| `placement_fee_invoices` | id, company_id, candidate_id, application_id, fee_type ENUM, offered_ctc, placement_fee_amount, status ENUM, deleted_at |
| `invoices` | id, invoice_number UNIQUE, company_id, invoice_type ENUM(placement_fee/resume_unlock/training_fee/…), amount, status ENUM, deleted_at |
| `payment_transactions` | id, invoice_id, company_id, amount, cashfree_order_id, status ENUM, initiated_at, completed_at |
| `resume_unlock_orders` | id, company_id, invoice_id, order_type ENUM(single/pack_4), credits_total, credits_used |
| `resume_unlocks` | id, company_id, candidate_id, order_id, granted_via ENUM(single/pack/platinum/platinum_approved), granted_at |

### Outreach Tables

| Table | Key Columns |
|-------|-------------|
| `outreach_contact_lists` | id, uploaded_by, list_name, total_contacts, imported_contacts, import_status ENUM, deleted_at |
| `outreach_contacts` | id, list_id, full_name, email, phone, whatsapp_number, company_name, designation, city, tags JSON, is_unsubscribed, lead_id, deleted_at |
| `outreach_campaigns` | id, created_by, campaign_name, campaign_type ENUM(email/whatsapp/call), list_id, subject, message_body, from_email, whatsapp_template_id, variable_mapping JSON, status ENUM, sent_count, reply_count, deleted_at |
| `outreach_campaign_logs` | id, campaign_id, contact_id, channel ENUM, status ENUM(pending/sent/failed/replied/bounced/unsubscribed), sent_at, whatsapp_message_id, email_message_id |
| `outreach_email_replies` | id, campaign_id, contact_id, assigned_to, channel ENUM(email/whatsapp), from_email, from_phone, body_text, received_at, reply_status ENUM(unread/read/replied/converted/ignored), lead_id, deleted_at |
| `outreach_call_logs` | id, campaign_id, contact_id, called_by, outcome ENUM, notes, callback_at, lead_id, deleted_at |
| `whatsapp_templates` | id, created_by, template_name, language_code, category ENUM, body_text, variable_count, is_active (1=APPROVED/0=pending), deleted_at |
| `whatsapp_auto_reply_flows` | id, created_by, flow_name, trigger_type ENUM(keyword/any/first_contact), trigger_keywords JSON, match_type ENUM(exact/contains/starts_with), response_type ENUM(template/text), template_id, is_active, deleted_at |

### Training Tables

| Table | Key Columns |
|-------|-------------|
| `training_catalogue` | id, title, description, category, duration_days, price_per_user, is_active |
| `company_training_requests` | id, company_id, catalogue_id, num_users, status ENUM(pending/approved/rejected/completed), invoice_id, deleted_at |

### Key DB Invariants

- **Soft delete everywhere**: every SELECT must include `WHERE deleted_at IS NULL`.
- **`candidate_profiles`, `resumes`** keyed by `candidate_id` (not user_id).
- **`companies.company_name`** (not `name`).
- **`applications.resume_id` NOT NULL** — always attach a resume when inserting.
- **`match_results`** linked via `application_id` only — never has `job_id`/`candidate_id` directly.
- **`leads.assigned_to`** NOT NULL FK to `employees.id`. Use `getEmployeeId(userId)`.
- **Offered CTC is always ANNUAL** in the offer letter flow.

---

## All API Routes

### Auth — `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Always returns 400 — self-registration is disabled; use SSO |
| POST | `/login` | Email+password login (trainer only) |
| POST | `/microsoft` | Microsoft SSO login (hr_staff, admin) |
| POST | `/google` | Google SSO login/register (candidate, company) |
| POST | `/logout` | Clear cookie |
| GET | `/me` | Get current user |
| POST | `/forgot-password` | Send reset email |
| POST | `/reset-password` | Reset with token |
| POST | `/verify-email` | Verify email token |

### Employees — `/api/employees` (hr_staff, admin)
GET /stats, GET / (list), GET /:id, POST / (admin), PUT /:id (admin), DELETE /:id (admin),
GET /:id/attendance, POST /:id/attendance

### Calls — `/api/calls` (hr_staff, admin)
GET /, POST /, PUT /:id, DELETE /:id

### Leads — `/api/leads` (hr_staff, admin)
GET /, POST /, GET /:id, PUT /:id, PUT /:id/stage, PUT /:id/assign (admin), DELETE /:id
**Stages**: `new → contacted → interested → proposal → converted → lost`

### Tasks — `/api/tasks` (hr_staff, admin)
GET /, POST / (admin), GET /:id, PATCH /:id/status, POST /:id/notes, GET /:id/notes, DELETE /:id (admin)

### Reports — `/api/reports` (hr_staff, admin)
GET /hr, GET /calls, GET /leads, GET /productivity (admin)

### Recruitment / Resume Sourcing — `/api/recruitment` (hr_staff, admin)
GET /jobs, POST /jobs/:jobId/resumes (bulk upload, background pipeline), GET /batches, GET /batches/:id

### Candidates — `/api/candidates` (candidate)
Profile CRUD, resume upload/download/parse/AI-extract, job browse, applications CRUD, documents CRUD.

### Jobs — `/api/jobs`
- `GET /matched` — candidate: AI-matched jobs with fit_score
- `GET|POST /` — company: list/create
- `GET|PUT|PATCH|DELETE /:id` — company: CRUD
- `GET /:jobId/applications` — company: list applications (PII masked unless unlocked)
- `POST|DELETE /:jobId/applications/:appId/shortlist` — company: shortlist toggle
- `PATCH /:jobId/applications/:appId/status` — company: move status

### Companies — `/api/companies` (company)
Profile, dashboard, interviews, offers, candidate resume download (masked, gated by application).

**Resume Unlock:**
- `GET /package-status` — `{ has_package, platinum }`
- `GET /talent/unlock-status?candidateIds=…` — bulk check unlock state
- `POST /talent/:candidateId/unlock` — purchase/grant unlock; returns payment link if needed
- `GET /talent/:candidateId/profile` — full profile (gated by any unlock)
- `GET /talent/:candidateId/preview` — preview profile (ungated teaser)
- `GET /talent/:candidateId/resume` — original file (Single/Pack) or masked PDF (Platinum)
- `POST /talent/:candidateId/apply` — add to pipeline (Single/Pack only)
- `POST /talent/:candidateId/profile-unlock-request` — Platinum companies request full-profile access
- `POST /talent/buy-pack` — standalone credit purchase (single or pack_4)
- `POST /platinum-request` — notify exec of Platinum interest

### HR Package Requests — `/api/hr/package-requests` (hr_staff, admin)
GET /, POST /:id/activate, POST /:id/dismiss

### HR Companies — `/api/hr/companies` (hr_staff, admin)
GET / — list exec's assigned companies

### Interviews — `/api/interviews`
- Candidate: GET /my, GET /offers/my, PATCH /slots/:id/confirm, PATCH /offers/:id/respond
- Company: GET /slots, PATCH /slots/:id/cancel, POST /:id/outcome, POST /:id/offer (gated by offer_letter_grants)
- **POST /slots is DISABLED** (403 APPROVAL_REQUIRED — use interview-requests flow)

### Interview Requests — `/api/interview-requests`
- Company: POST /, GET /?applicationId=, POST /:id/reschedule
- Executive/Admin: GET /executive, GET /executive/:id, PUT /executive/:id/approve, PUT /executive/:id/reject
- GET /executive/scheduled, PATCH /executive/slots/:id/confirm (confirm on behalf of sourced candidate)

### Offer Requests — `/api/offer-requests`
- Company: POST /, GET /:applicationId/status
- Executive/Admin: GET /executive, GET /executive/:id, PUT /executive/:id/approve, PUT /executive/:id/reject

### Notifications — `/api/notifications` (authenticated)
GET /, GET /unread-count, PATCH /read-all, PATCH /:id/read

### Invoices — `/api/invoices`
- Executive: GET|POST /exec, GET /exec/companies, GET /exec/summary, GET|PUT|DELETE /exec/:id, PUT /exec/:id/mark-paid, PUT /exec/:id/mark-partial
- Company: GET /company, GET /company/:id, POST /company/:id/pay, GET /company/placement-fees/summary
- Admin: GET /admin/all, GET /admin/summary

### Payments — `/api/payments`
GET /verify/:cashfreeOrderId, POST /webhook/cashfree (no auth, signature verified)

### Admin — `/api/admin` (admin)
Companies: list, unassigned, detail, approve/reject/suspend/reactivate/delete, assign-executive, placement-fee-rate, agreement.
Requests, Candidates, Staff (create/update/deactivate/performance), Recruitment, Analytics, AI recompute, Invoices, Settings.

### Training Services — `/api/training-services`
GET /catalogue, POST /request (company), GET /my-requests (company), GET /admin, PUT /admin/:id/approve, PUT /admin/:id/reject, POST|PUT|PATCH /admin/catalogue

### Health — `/api/health`
GET / — DB connectivity + env check

### Outreach — `/api/outreach` (hr_staff, admin)

**Contact Lists:** POST /contact-lists/upload, GET /contact-lists, GET /contact-lists/:id, GET /contact-lists/:id/contacts, DELETE /contact-lists/:id, PATCH /contacts/:id/unsubscribe, GET /contacts/:id/call-history

**Email Campaigns:** POST /email-campaigns, GET /email-campaigns, GET /email-campaigns/:id, PUT /email-campaigns/:id, POST /email-campaigns/:id/send, POST /email-campaigns/:id/pause, DELETE /email-campaigns/:id

**Replies:** GET /replies, GET /replies/:id, POST /replies/:id/reply, PATCH /replies/:id/convert, PATCH /replies/:id/ignore, PATCH /replies/:id/assign (admin)

**WhatsApp / Vaartabot:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/whatsapp/credits` | Vaartabot credit balance (`creditsBalance`, `totalMessagesSent`) |
| POST | `/whatsapp/templates/sync` | Force-sync approved templates from Meta via Vaartabot |
| GET | `/whatsapp/templates` | List local template cache (is_active=1 means APPROVED) |
| POST | `/whatsapp/templates` | Create local template record |
| PUT | `/whatsapp/templates/:id` | Update local template |
| DELETE | `/whatsapp/templates/:id` | Soft delete |
| GET | `/whatsapp/webhooks` | List Vaartabot webhook subscriptions (admin only) |
| POST | `/whatsapp/webhooks` | Register webhook URL + events with Vaartabot (admin only) |
| PATCH | `/whatsapp/webhooks/:id` | Update/pause webhook (admin only) |
| POST | `/whatsapp/webhooks/:id/test` | Send test ping (admin only) |
| DELETE | `/whatsapp/webhooks/:id` | Remove webhook (admin only) |
| GET | `/whatsapp/auto-replies` | List auto-reply flows |
| POST | `/whatsapp/auto-replies` | Create flow |
| PUT | `/whatsapp/auto-replies/:id` | Update flow |
| DELETE | `/whatsapp/auto-replies/:id` | Soft delete |

**WhatsApp Campaigns:** POST /whatsapp-campaigns, GET /whatsapp-campaigns, GET /whatsapp-campaigns/:id, POST /whatsapp-campaigns/:id/send

**Cold Calls:** GET /calls, POST /calls, PUT /calls/:id

**Analytics:** GET /analytics/campaigns, GET /analytics/conversions

**Webhooks (no auth — mounted directly on app):**
- `GET /api/outreach/webhooks/whatsapp` — Vaartabot verification (hub.challenge)
- `POST /api/outreach/webhooks/whatsapp` — Vaartabot event handler (signature verified with HMAC-SHA256)

**Admin Outreach (admin only):**
GET /api/admin/outreach/campaigns, GET /api/admin/outreach/replies

---

## Vaartabot WhatsApp Integration

**Provider:** Vaartabot CRM API (`https://vaartabot.com/api/v1`)
**Auth:** `X-API-Key: vb_xxxxxx` header (stored in `VAARTABOT_API_KEY` env var)
**Cost:** 1 credit per message sent

### Sending Campaigns
`POST /messages/bulk-send` with `{ templateName, recipients: [{ to, variables: string[] }] }`, max 500 per request.

- `to` — phone number (10-digit or E.164 without `+`, e.g. `919876543210`)
- `variables` — ordered array of values for `{{1}}`, `{{2}}` etc. (NOT keyed, just positional)
- Our `variable_mapping` stores `{ "{{1}}": "first_name", "{{2}}": "company_name" }` — sorted by key to produce the correct positional array

### Templates
- Fetched/synced from Meta via `GET /templates/sync`
- Response shape: `{ success, total, data: [{ id, name, status, category, language, components: [{ type, text }] }] }`
- `is_active = 1` in local `whatsapp_templates` means status=`APPROVED`; 0 means PENDING/REJECTED
- `GET /templates?status=APPROVED` can filter at source
- Auto-reply flows use **templates only** — Vaartabot (like WhatsApp Cloud API) does not support free-text messages outside the 24-hour service window

### Inbound Webhooks
Vaartabot POSTs to `POST /api/outreach/webhooks/whatsapp`:
```json
{
  "event": "message.received",
  "tenant_id": 42,
  "timestamp": "2026-07-12T09:30:00.000Z",
  "data": { "message_id": "wamid.…", "from": "919876543210", "type": "text", "text": "…", "received_at": "…" }
}
```

**Signature verification:** `X-Vaartabot-Signature: sha256=<hex>` using HMAC-SHA256.
- Raw body captured via `express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })` in `server.js`
- Compared with `crypto.timingSafeEqual` against expected HMAC
- Secret stored in `VAARTABOT_WEBHOOK_SECRET` env var (shown once at registration — save from Admin → Platform Settings → Webhook Manager)

**Events handled:** `message.received` (creates reply, auto-fires flows), `message.delivered`, `message.read`, `message.failed` (updates campaign log status)

### Webhook Setup (first time)
1. Admin → Platform Settings → "WhatsApp Webhook Management" → Register
2. Enter `https://api.theladderconsulting.com/api/outreach/webhooks/whatsapp`
3. Select all events
4. Copy the one-time secret → add to backend `.env` as `VAARTABOT_WEBHOOK_SECRET` → restart PM2

### Auto-Reply Flows
Stored in `whatsapp_auto_reply_flows`. After every inbound message, `fireAutoReply()` checks active flows in insertion order and fires the first match. Only `response_type = 'template'` is supported (free-text silently skipped with a warning log).

### Credits
`GET /credits/balance` → `{ data: { creditsBalance, totalMessagesSent } }`. Displayed on Outreach Dashboard, WhatsApp Campaigns, and Templates pages. Credits are purchased on vaartabot.com/billing.

---

## Key Patterns & Invariants

### notify() Pattern
```js
const notify = async (userId, type, title, body, metadata = null) => { … };
```

### getEmployeeId() Pattern
```js
const [[emp]] = await db.query('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]);
return emp?.id ?? null;
```

### Role Scoping Pattern
```js
if (req.user.role === 'hr_staff') { /* add assigned_to filter */ }
// admin sees everything
```

### Transaction Pattern
```js
const conn = await db.getConnection();
try { await conn.beginTransaction(); … await conn.commit(); }
catch (e) { await conn.rollback(); throw e; }
finally { conn.release(); }
```

### Response Shape
All controllers return `{ success: true, data: … }` or `{ success: false, message: '…' }`.

---

## Email & SMTP

### Transactional Email (`utils/email.js`)
`sendEmail({ to, subject, html })` — GoDaddy SMTP (smtpout.secureserver.net:465 SSL)

### Outreach Email (`utils/outreachEmail.js`)
- `replaceMergeTags(template, contact, executiveName)` — `{{first_name}}`, `{{full_name}}`, `{{company_name}}`, `{{designation}}`, `{{city}}`, `{{executive_name}}`
- `buildReplyToAddress(campaignId, executiveId)` → `local+lc-{campId}-{execId}@domain.com`

### Mail Poller (`services/mailPoller.js`)
- `setInterval(runPollCycle, 120000)` — auto-starts on boot
- Searches UNSEEN emails, matches to campaigns via Reply-To tag / In-Reply-To header / sender email
- Toggle: `platform_settings.mail_poller_enabled`

---

## Payment System (Cashfree)

- `CASHFREE_ENV`: `TEST` or `PROD`
- Flow: Company → POST /invoices/company/:id/pay → createOrder → redirect → return URL → verify
- Webhook: POST /api/payments/webhook/cashfree (signature verified, idempotent)
- `processSuccessfulPayment` calls `fulfillResumeUnlockOrder` for `resume_unlock` invoices, `syncPlacementFeeStatus` for placement fees

---

## Resume Unlock / Talent Pool

### Tiers
| Tier | Price | What it grants |
|------|-------|----------------|
| Single | ₹999 | 1 credit — original unmasked resume file |
| 4-Pack | ₹3,999 | 4 credits — same as Single |
| Platinum | Per-company % rate | Free unlimited — masked resume only, fee at hire |

### Gate
`GET /api/companies/package-status` checked by TalentPool.jsx before rendering. 403 `PACKAGE_REQUIRED` if no paid order exists. `getJobApplications` nulls `match_score` if no package.

### Placement Fee (Offer Letter Gate)
- Fee computed at offer-request submit: Platinum uses `ctc × (percent / 100)` on annual CTC; default uses `(ctc / 12) × multiplier` months
- Prepaid (Single/Pack) candidates: `placement_fee_invoices.status = 'waived'`, no company-payable invoice
- Company only sees fee info for Platinum / non-prepaid candidates

---

## Offer Letter & Interview Approval Flow

- Company submits interview request → executive approves → slot created → candidate confirms → outcome recorded → company submits offer request (with **annual CTC**) → executive approves → `offer_letter_grants` created → company generates offer → candidate accepts/declines → if accepted: application `status='hired'`
- **POST /api/interviews/slots** is hard-403 — only `approveRequest` creates slots

---

## Environment Variables

```env
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5001

DB_HOST=127.0.0.1 | DB_PORT=3306 | DB_NAME=ladder_consulting | DB_USER=root | DB_PASSWORD=…

JWT_SECRET=… | JWT_EXPIRES_IN=7d

# SSO
MICROSOFT_CLIENT_ID=…
GOOGLE_CLIENT_ID=…
# Frontend (Vite)
VITE_MICROSOFT_CLIENT_ID=…
VITE_GOOGLE_CLIENT_ID=…

# AWS S3
AWS_ACCESS_KEY_ID=… | AWS_SECRET_ACCESS_KEY=… | AWS_REGION=ap-south-1 | AWS_S3_BUCKET=…

# Transactional Email (GoDaddy)
SMTP_HOST=smtpout.secureserver.net | SMTP_PORT=465 | SMTP_SECURE=true
SMTP_USER=info@certifybusiness.com | SMTP_PASS=… | EMAIL_FROM="CertifyBusiness <info@certifybusiness.com>"

# Outreach SMTP + IMAP (same GoDaddy account)
GODADDY_SMTP_HOST=… | GODADDY_SMTP_PORT=465 | GODADDY_SMTP_SECURE=true
GODADDY_SMTP_USER=… | GODADDY_SMTP_PASS=… | GODADDY_DEFAULT_FROM_NAME=CertifyBusiness
GODADDY_IMAP_HOST=imap.secureserver.net | GODADDY_IMAP_PORT=993 | GODADDY_IMAP_SECURE=true
GODADDY_IMAP_USER=… | GODADDY_IMAP_PASS=…

# Vaartabot WhatsApp
VAARTABOT_API_KEY=vb_…                    # X-API-Key for Vaartabot API
VAARTABOT_WEBHOOK_SECRET=…               # HMAC-SHA256 secret from webhook registration

# OpenAI (only for training recommendations — resume/matching is fully offline)
OPENAI_API_KEY=…
AI_MATCH_THRESHOLD=40

# Cashfree
CASHFREE_APP_ID=… | CASHFREE_SECRET_KEY=… | CASHFREE_ENV=TEST
CASHFREE_BASE_URL_TEST=https://sandbox.cashfree.com/pg
CASHFREE_BASE_URL_PROD=https://api.cashfree.com/pg
CASHFREE_WEBHOOK_SECRET=…
```

---

## Frontend Theme

Brand theme: "Ladder Violet" `#6a47d4`. `blue`, `indigo`, and `brand` Tailwind palettes all remapped to the same violet scale in `tailwind.config.js`. Headings: `Plus Jakarta Sans` (`font-display`); body: Inter. Shared component classes in `src/index.css` under `@layer components`.

**Logo assets** — `frontend/public/`:
- `logo-icon.png` — 512×512 icon (building/swoosh mark), used in all portal navbars/sidebars
- `logo-full.png` — 1400px lockup with wordmark, used on all auth pages
- `favicon.ico`, `apple-touch-icon.png`, `icon-192.png` — all from logo-icon.png

---

## Migration Files

Located at `backend/migrations/`:
1. `add_extracted_skills_to_candidates.sql` — adds extracted_skills column
2. `phase2_executive_assignment_phase3_fee_gate.sql` — executive assignment, fee gate, company_requests, invoices, payment_transactions
3. `outreach_module.sql` — 7 outreach tables + ALTER TABLE leads/employees + platform_settings seed
4. `training_services_module.sql` — adds training_fee to invoices.invoice_type; creates training_catalogue + company_training_requests
5. `bulk_resume_sourcing.sql` — adds applications.source/sourced_by; creates resume_upload_batches + items
6. `free_pool_resumes.sql` — makes resume_upload_batches.job_id nullable
7. `resume_unlock_module.sql` — adds companies.placement_fee_percent/agreement_file_key; creates resume_unlock_orders + resume_unlocks
8. `resume_unlock_repricing.sql` — resume_unlock_orders.order_type += pack_4; applications.source += company
9. `oauth_login.sql` — creates user_oauth_identities table
10. `whatsapp_auto_reply_flows.sql` — creates whatsapp_auto_reply_flows table
11. `profile_unlock_flow.sql` — adds profile_unlock to company_requests.request_type; adds platinum_approved to resume_unlocks.granted_via

**Note**: `ADD COLUMN IF NOT EXISTS` is NOT supported in MySQL 8.0. Run ALTER statements only on fresh databases.

---

## Production Server

- EC2: `13.203.48.124`, user `ubuntu`, key at `ladder-key.pem`
- Backend: PM2 process `ladderstep-backend`, path `/var/www/ladderstep/backend`
- Frontend static: `/var/www/ladderstep/frontend/dist` (served by nginx)
- Node: v22 via nvm (`source ~/.nvm/nvm.sh && nvm use 22`)

**Standard deploy:**
```bash
ssh -i ladder-key.pem ubuntu@13.203.48.124 "
  cd /var/www/ladderstep && git pull origin main
  cd frontend && source ~/.nvm/nvm.sh && nvm use 22 && npm run build
  pm2 restart ladderstep-backend
"
```

---

## Known Open Items

1. **Scheduled campaign sending** — `scheduled_at` stored but no cron auto-triggers
2. **Overdue invoice cron** — no job to mark invoices `overdue` past `due_date`
3. **Rich text editor** — outreach email composer uses `<textarea>`; react-quill not compatible with React 19
4. **Plus-addressing** — reply tracking uses sub-addressing; verify GoDaddy supports it
5. **Cashfree credentials** — replace placeholders with real TEST-mode credentials before payment testing
6. **Training completion tracking** — no mechanism to mark company_training_requests `completed` after delivery
7. **Training player routes** — `TrainingDashboard`, `CoursePlayer`, `CertificatePage` exist in `pages/training/` but have no routes in App.jsx
8. **`VAARTABOT_WEBHOOK_SECRET`** — must be set in production `.env` after registering webhook via Admin → Platform Settings → Webhook Manager
9. **Auto-reply variable substitution** — `fireAutoReply` sends templates without variable values; only use 0-variable templates for auto-replies

---

## Known Test Accounts (dev)

| Email | Role | Password |
|-------|------|----------|
| admin@theladderconsulting.com | admin | LadderAdmin@milarch |
| test@test.com | hr_staff | Test@123 |
