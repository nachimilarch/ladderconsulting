# LadderStep Human Consulting — Standard Operating Procedure (SOP)
### For HR Executives & Support Team
**Version 1.0 · Last updated: 2026-07-03**

---

## 0. How to use this document

This SOP explains **how the LadderStep platform works** and **how you (the HR executive / support team) operate it day-to-day**. Read Sections 1–3 once to understand the big picture, then use Sections 4–12 as a reference for each task.

- Terms in **bold** are features/screens in the app.
- 🔒 marks a rule that is enforced by the system (you cannot bypass it).
- ⚠️ marks a business rule you must follow to protect the company's revenue.

---

## 1. What the platform is

LadderStep Human Consulting is an end-to-end **recruitment + HR outreach platform**. It connects four kinds of users:

| Who | What they do here |
|-----|-------------------|
| **HR Executive** (you) | Source candidates, run cold outreach, manage leads, approve interviews & offers, raise invoices |
| **Hiring Company** (client) | Post jobs, browse talent, unlock resumes, request interviews & offers, pay fees |
| **Candidate** | Build a profile, apply to jobs, attend interviews, accept offers |
| **Admin** | Approves companies, assigns companies to executives, sets fee rates, oversees everything |
| **Trainer** | Manages training courses (limited role) |

The platform earns revenue two ways:
1. **Resume-unlock packages** — companies pre-pay to see candidate contact details (Single / 4-Pack / Platinum).
2. **Placement fees** — when a company hires a candidate, a fee (a % of the annual CTC) is billed.

**Your approvals are what entitle LadderStep to its placement fee.** That is why interviews and offers cannot happen without an executive approving them (see Sections 8 and 9).

---

## 2. The five portals

The app is split into portals. Which one you land in depends on your **role**:

| Portal | URL path | Who can enter |
|--------|----------|----------------|
| **HR Portal** | `/hr` | HR Executive, Admin |
| **Outreach** | `/outreach` | HR Executive, Admin |
| **Company Portal** | `/company` | Hiring Company |
| **Candidate Portal** | `/candidate` | Candidate |
| **Admin Portal** | `/admin` | Admin, Trainer |

> **Note for Admins:** an admin can also open the HR Portal. When they do, they see an "Admin View" banner and a "← Admin Dashboard" link so they can get back.

You (HR Executive) live mainly in the **HR Portal** and the **Outreach** module.

---

## 3. Login types & workflows — ALL roles

Login is **Single Sign-On (SSO)** for almost everyone. Passwords are retired except for Trainers. There is **no "create password" step** for HR staff, candidates, or companies.

### 3.1 Login method by role — quick reference

| Role | How they log in | Account created by | First-login behaviour |
|------|-----------------|--------------------|----------------------|
| **HR Executive** (`hr_staff`) | **"Sign in with Microsoft"** | Admin pre-creates it | Must already exist — see 3.2 |
| **Admin** | **"Sign in with Microsoft"** | Existing admin creates it | Must already exist |
| **Candidate** | **"Sign in with Google"** | Self — created on first login | Account is active immediately |
| **Company** | **"Sign in with Google"** | Self — created on first login | Waits for admin approval |
| **Trainer** | **Email + password** (only role with a password) | Admin creates it | Uses the "Trainer? Sign in here" link |

The login page shows only two big buttons — **Sign in with Microsoft** and **Sign in with Google** — plus a small **"Trainer? Sign in here"** link.

### 3.2 HR Executive & Admin login (Microsoft 365)

**Workflow:**
1. Go to the login page → click **"Sign in with Microsoft"**.
2. Sign in with the Microsoft 365 account **whose email matches the account an admin created for you**.
3. You land on the **HR Dashboard** (`/hr`). Admins land on the **Admin Dashboard** (`/admin`).

🔒 **You cannot self-register.** A Microsoft sign-in with an email that has no matching account will be **rejected** (this prevents strangers from creating privileged accounts). If you get "account not found," an admin must add you first.

**Provisioning a new HR executive (Admin does this):**
- Admin Portal → **HR Staff Management** → **Add Staff** → enter name + the **exact email** the person will use for Microsoft sign-in.
- The system creates a bare account and emails them to sign in with Microsoft.
- The new executive then clicks "Sign in with Microsoft" using that same email — done.

> The email address used to create the account **must** be the one they sign in to Microsoft with. If they use a different Microsoft email, it won't match.

### 3.3 Candidate login (Google)

**Workflow:**
1. Login page → click **"Sign in with Google"** (or **Register** → Candidate → "Sign up with Google").
2. Google supplies their verified name + email.
3. If it's their first time, the account is **created and activated instantly** — they go straight to the **Candidate Dashboard** (`/candidate`).

Candidates never need approval. Google verifies their identity.

> Executive-sourced candidates (the ones you bulk-upload — Section 7) get an account auto-created for them too, but they **usually never log in**. That is normal and expected; you act on their behalf.

### 3.4 Company login (Google + admin approval)

**Workflow:**
1. Login page → **Register** → **Hiring Company** → **"Sign up with Google"**.
2. The account is created with status **"pending"** and an approval request is raised.
3. 🔒 **The company cannot use the portal until an admin approves them.** On their next login attempt before approval, they see "pending approval," not a dashboard.
4. Admin Portal → **Company Approvals** → approve → the company can now log in and reaches the **Company Dashboard** (`/company`).

⚠️ **At approval time, the admin also decides the company's package terms** — including whether they are a **Platinum** client (a contracted placement-fee %). This % drives all later fee calculations (Section 9).

### 3.5 Trainer login (email + password)

The only role that still uses a password.
1. Login page → **"Trainer? Sign in here"** → the trainer login form (`/login/trainer`).
2. Enter email + password (set by the admin who created the trainer).
3. Lands on the **Training Manager** (`/admin/training`).

### 3.6 Sessions, logout, and troubleshooting

- A login session lasts across page reloads (stored in a secure cookie). If you close the browser and come back, you usually stay logged in.
- **Log out** from the user menu when on a shared machine.
- If already logged in, visiting the login page auto-redirects you to your portal.

**Common login problems:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Microsoft sign-in says "account not found" | You weren't pre-provisioned, or used the wrong Microsoft email | Ask an admin to add your exact work email in HR Staff Management |
| Company says "pending approval" | Not yet approved | Admin approves them in Company Approvals |
| Candidate can't find password field | Candidates use Google only | Use "Sign in with Google" |
| Wrong portal after login | You're on the role that matches that portal | This is correct behaviour — each role has one home portal |

---

## 4. HR Portal at a glance

After logging in you (HR Executive) see the **HR Dashboard** with KPIs scoped to you. The left sidebar gives you:

| Screen | What it's for |
|--------|---------------|
| **Dashboard** | Your KPIs: leads, tasks, calls, conversions |
| **Employees** | HR staff records (mostly admin-managed) |
| **Lead Pipeline** | Your sales leads and their stages |
| **Tasks** | Tasks assigned to you / by you |
| **Resume Sourcing** | Upload resumes, manage the talent pool, assign candidates to jobs |
| **Interview Requests** | Approve/reject interview requests from companies |
| **Scheduled Interviews** | Confirmed interviews; confirm on behalf of sourced candidates |
| **Offer Requests** | Approve/reject offer-letter releases (triggers the placement fee) |
| **Invoices** | Raise and track service invoices for your companies |
| **Reports** | Call, lead, and productivity reports |

The **Outreach** module (separate sidebar) covers cold email, WhatsApp, contact lists, replies, calls, and analytics.

> **Scoping rule:** as an HR Executive you see **your own** leads, calls, replies, and the companies **assigned to you**. Admins see everything.

---

## 5. Cold Outreach (lead generation)

Use the **Outreach** module to reach prospective client companies.

### 5.1 Contact lists
1. **Outreach → Contact Lists → Upload** an Excel/CSV of contacts.
2. Columns are auto-mapped (Name, Email, Phone/WhatsApp, Company, Designation, City…).
3. Rows with **neither an email nor a phone** are skipped and logged in the import report.
4. Duplicates (same email in the same list) are removed automatically.

### 5.2 Email campaigns
1. **Outreach → Email Campaigns → New.** Pick a contact list, write a subject + body.
2. You can personalise with merge tags: `{{first_name}}`, `{{full_name}}`, `{{company_name}}`, `{{designation}}`, `{{city}}`, `{{executive_name}}`.
3. Save as draft → **Send.** Emails go out in batches (20 at a time). You can **Pause** mid-send.
4. Replies are captured automatically (see 5.4).

### 5.3 WhatsApp campaigns
- Use **WhatsApp Templates** (must be pre-approved by Meta) then create a **WhatsApp Campaign**.
- Delivery + replies are tracked the same way as email.

### 5.4 Replies → convert to lead
1. Incoming replies appear under **Outreach → Replies** (email + WhatsApp).
2. Open a reply (it auto-marks as read). You can:
   - **Reply** directly (proper email threading is handled for you),
   - **Convert to Lead** — creates a lead in your pipeline and links the contact,
   - **Ignore.**
3. Many replies auto-create a lead already; converting just advances it.

### 5.5 Cold calls
Log calls under **Outreach → Cold Calls** (outcome, notes, callback date). Call history is visible per contact.

### 5.6 Analytics
**Outreach → Analytics** shows campaign performance and conversions.

---

## 6. Lead Pipeline management

Leads represent prospective **client companies** you are trying to sign.

**Lead stages (move left → right as they progress):**
```
new → contacted → interested → proposal → converted → lost
```

1. **HR → Lead Pipeline** lists your leads.
2. Open a lead to see details + full call history; log calls, add notes, change stage.
3. **Reassignment** to another executive is an **Admin** action.

> A lead becomes a real, approved **company** through the login + approval flow in Section 3.4. Converting a lead is your sales milestone; approving the company is the admin's onboarding step.

---

## 7. Resume Sourcing & the Talent Pool

This is the heart of the recruiter's job. Open **HR → Resume Sourcing**. It has **four tabs**.

### 7.1 Tab 1 — Upload Resumes
Two modes:
- **🎯 Target a Job** — pick an active client job (JD), then drag-drop up to **20 resumes** (PDF/DOC/DOCX, 5 MB each). Each resume is parsed and the candidate is **added as an applicant** on that job with a **fit score**.
- **🗂️ Free Talent Pool** — upload resumes with **no job attached**. Candidates are parsed and land in the pool, ready to assign later.

**What happens automatically per resume:**
1. Text is extracted and parsed → name, email, phone, experience, education, skills, summary.
2. A candidate account is found or created (they don't need to log in).
3. The resume is stored; empty profile fields are filled in.
4. Skills are extracted and a fit score is computed against the JD.

> 📄 **Naming resumes for accuracy:** the system reads the candidate's **name and total experience from the filename** when you name it like:
> `93_-_Seshu_Adusumilli_-_Manager_HR_&_Admin_-_17_Yrs_0_Month.pdf`
> Keep using this "**Serial - Name - Designation - X Yrs Y Month**" convention — it makes the parsed name and experience far more reliable.

**Upload History** shows each batch, per-file status, extracted name/email, fit score, and result badges ("New profile created", "Pool profile matched", "Already in this JD", "Hired — off market", etc.). Click a candidate's name to open their **full profile**.

### 7.2 Tab 2 — Free Pool
Every sourced + self-registered candidate available for placement, independent of any job. Search/filter by name, skill, experience. **Click any name to open their full profile** (name, email, phone, skills with proficiency, education, experience, résumés on file). Hired candidates are excluded automatically.

### 7.3 Tab 3 — Assign from Pool
1. Pick a client **job** on the left.
2. Browse pool candidates on the right (filter by skill/experience).
3. Click **Assign to JD** to add a candidate as an applicant on that job.
4. Already-assigned candidates show a **fit-score badge** (% match to that JD). Click **View Profile** for full details + matched/missing skills.

### 7.4 Tab 4 — Company Interests
When a company clicks **"Express Interest"** on a pool candidate, it appears here.
1. Review the request. Click **View Profile** to see the candidate.
2. Select one of that company's open jobs → **Assign & Notify** — the candidate is added to their pipeline and the company is notified.
3. 🔒 If the candidate has since been **hired elsewhere**, the card shows "Candidate Hired — Unavailable" and you cannot assign them. Propose an alternative.

### 7.5 What companies see vs what you see
- **You (executive):** full, unmasked candidate details everywhere.
- **Company:** masked by default (initials, no contact). They see full contact only after they **unlock** the candidate (Single/4-Pack) — see Section 11.

---

## 8. Interview Requests (approval flow)

🔒 **Companies cannot schedule interviews directly.** The only way an interview slot is created is through **your approval**. This protects LadderStep's placement fee.

**Workflow:**
1. Company submits an interview request (proposed date/time, mode, notes).
2. It appears in **HR → Interview Requests** (your pending queue).
   - You see a request if the company is **assigned to you** OR you **sourced** that candidate.
3. Open it → **Approve**, **Reject**, or **Reschedule/modify**.
4. On **Approve**, the system creates the interview slot and notifies both the company and the candidate.

After approval the interview appears in **Scheduled Interviews** (Section 8.1).

### 8.1 Scheduled Interviews & confirm-on-behalf
**HR → Scheduled Interviews** shows confirmed/upcoming interviews for your companies (admins see all), with the candidate's real contact details so you can coordinate.

🔒 A candidate normally confirms their own slot by logging in. But **executive-sourced candidates never log in** — so for them, you use **"Confirm on behalf"** to confirm the slot for the candidate. The view flags candidates who have **never logged in** and shows whether they were **executive-sourced**.

---

## 9. Offer Requests & Placement Fees

This is where LadderStep gets paid on a hire.

**Workflow:**
1. After a successful interview outcome, the company submits an **Offer Letter Release** request with the **offered ANNUAL CTC**.
2. It appears in **HR → Offer Requests** (your queue).
3. Open it → **Approve** or **Reject**.
4. On **Approve**, the system:
   - grants the company permission to generate the offer letter, and
   - raises a **company-payable invoice** for the placement fee (due in 14 days).

### 9.1 How the placement fee is calculated
The fee is worked out **when the company submits** (not at approval):

| Company type | Formula |
|--------------|---------|
| **Platinum** (has a contracted %) | `fee = annual CTC × (percent ÷ 100)` — e.g. 8.33 % ≈ one month's salary |
| **Default** (no contracted rate) | `fee = (annual CTC ÷ 12) × platform multiplier` (multiplier is in months, default = 1 month) |

⚠️ **Everything downstream reads the ANNUAL CTC.** The company's input, your Offer Requests screen, and admin screens all say "Annual CTC."

### 9.2 Prepaid candidates — fee is waived (and hidden)
If the candidate was **already unlocked by the company via Single or 4-Pack**, they've effectively pre-paid:
- The placement fee is recorded internally as **"waived"** (kept for bookkeeping) and **no company invoice is created**.
- The company sees **no fee messaging** for that candidate — it stays silent.
- You and the admin still see the real waived status internally.

### 9.3 Collecting the fee
- The company pays the invoice (full or partial) via Cashfree on their **Payments** page.
- You can track amount paid / status / due date on the Offer Requests screen.
- Your **Invoices** screen (`/hr`) lets you raise and track service invoices for your assigned companies.

---

## 10. The "off the market" locks (very important)

🔒 The system protects candidates from being double-worked:

- **Pending offer lock:** once a candidate has an outstanding offer (sent/accepted) from one company, they **disappear from the Talent Pool** and cannot be unlocked or pulled into another company's pipeline.
- **Hired lock:** once any application for a candidate reaches **"hired,"** they are locked out of all further activity everywhere — sourcing, shortlisting, new applications. You'll see "Hired — off market" / "Hired elsewhere — unavailable" badges.

These are automatic. If you can't act on a candidate, check whether one of these locks applies.

---

## 11. Understand what the Company experiences (context)

You'll coordinate with companies, so know their side:

### 11.1 Resume-unlock packages (mandatory gate)
Before a company can browse the Talent Pool or see AI match %, they must pick a package:

| Tier | Price | What it gives |
|------|-------|----------------|
| **Single** | ₹999 | 1 unlock credit |
| **4-Pack** | ₹3,999 | 4 unlock credits (no expiry) |
| **Platinum** | Contracted % (admin-set) | Free, unlimited unlocks |

- **Single / 4-Pack** unlocks reveal the **original résumé + real contact info**, and let the company move the candidate into their own pipeline. **No placement fee later** (prepaid — see 9.2).
- **Platinum** unlocks show a **masked** résumé; the company still reaches the candidate **through you**, and the **placement fee applies at hire**.

### 11.2 Company workflow summary
1. Log in (Google) → approved by admin.
2. Pick a package (or request Platinum).
3. Post jobs / browse Talent Pool / see their applicants.
4. Unlock candidates, or **Express Interest** (which lands in your **Company Interests** tab).
5. Request interviews → **you approve**.
6. Request offer release → **you approve** → pay the placement fee (unless prepaid).

---

## 12. The Candidate journey (context)

1. Signs up with Google (or is sourced by you).
2. Builds a profile, uploads a résumé (auto-parsed).
3. Browses **AI-matched jobs**, applies.
4. Gets shortlisted → interview slot (created only after **your approval**) → confirms.
5. Receives an offer → accepts → becomes **hired** (locks them off the market).

---

## 13. End-to-end placement lifecycle (how it all connects)

```
1. OUTREACH        You email/call prospects (Outreach module)
        │
2. LEAD            Reply → convert to Lead → nurture through stages
        │
3. COMPANY         Lead signs up (Google) → Admin approves → picks a package
        │
4. JOB             Company posts a job (JD)
        │
5. SOURCING        You upload/assign candidates → fit scores computed
        │
6. INTEREST        Company unlocks or Expresses Interest in candidates
        │
7. INTERVIEW       Company requests interview → YOU APPROVE → slot created
        │           (confirm on behalf for sourced candidates)
        │
8. OFFER           Company requests offer release → YOU APPROVE
        │           → placement-fee invoice raised (unless prepaid)
        │
9. HIRE            Candidate accepts → status "hired" → off the market
        │
10. PAYMENT        Company pays the placement fee (Cashfree)
```

Your two **mandatory gates** are steps 7 and 8. Never let a company work around them — they are what secure the fee, and the system blocks the bypass attempts anyway.

---

## 14. Do's & Don'ts

**Do**
- ✅ Name sourced résumés `Serial - Name - Designation - X Yrs Y Month.pdf` for accurate parsing.
- ✅ Approve interview and offer requests promptly — companies and candidates are waiting.
- ✅ Use **Confirm on behalf** for sourced candidates who never log in.
- ✅ Convert genuine outreach replies into leads so nothing is lost.
- ✅ Check the profile (View Profile) before assigning a candidate to a JD.

**Don't**
- ❌ Don't promise a company they can schedule interviews or send offers without your approval — the system won't allow it.
- ❌ Don't try to re-source or re-assign a candidate who is **hired** or has a **pending offer** — they're locked.
- ❌ Don't share candidate contact details with a company that hasn't unlocked them — the app masks them for a reason.
- ❌ Don't quote placement fees from memory — the app calculates them from the **annual CTC** and the company's contracted rate.

---

## 15. Quick FAQ

**Q: A company says they can't schedule an interview.**
A: Correct — they must submit an interview **request** and you approve it. Check your **Interview Requests** queue.

**Q: A sourced candidate can't confirm their interview.**
A: They never log in. Use **Scheduled Interviews → Confirm on behalf.**

**Q: Why did a candidate disappear from the pool?**
A: They likely have a **pending offer** or are **hired** — both remove them from the pool automatically.

**Q: A company hired a candidate but I see no fee.**
A: The candidate was probably **unlocked via Single/4-Pack** (prepaid) — the fee is waived by design.

**Q: I can't see a company's requests.**
A: You only see companies **assigned to you** (plus candidates you sourced). Ask an admin to assign the company or check with the assigned executive. Admins see everything.

**Q: New teammate can't log in with Microsoft.**
A: An admin must first add them in **HR Staff Management** using the **exact** email they'll sign in with.

---

## 16. Glossary

| Term | Meaning |
|------|---------|
| **JD** | Job Description / job posting created by a company |
| **Talent Pool** | The searchable set of available (non-hired) candidates |
| **Fit score** | AI-computed % match between a candidate and a job |
| **Unlock** | A company paying to reveal a candidate's real contact info |
| **Platinum** | A company on a contracted placement-fee %; free unlimited unlocks |
| **Placement fee** | The fee billed to a company when they hire, based on annual CTC |
| **Prepaid candidate** | One unlocked via Single/4-Pack — no placement fee at hire |
| **Confirm on behalf** | Executive confirming an interview slot for a sourced candidate who never logs in |
| **Off the market** | A candidate locked from activity due to a pending offer or a hire |
| **Assigned executive** | The HR executive responsible for a given company |

---

*This SOP reflects the platform as configured for LadderStep Human Consulting. For access changes (new staff, company approvals, fee rates), contact an Admin.*
