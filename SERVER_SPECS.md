# LadderStep Human Consulting — Server Sizing Reference

**Generated:** 2026-06-29, from real measurements on the dev machine (not generic estimates). Re-run the measurement commands below if this drifts far from current reality (e.g., after several months of production traffic).

---

## Methodology — how these numbers were produced

All figures are measured, not guessed:

```bash
# Disk footprint
du -sh backend/node_modules frontend/node_modules backend/src frontend/src backend/uploads frontend/dist

# Database size + row counts
mysql -u root -p ladder_consulting -e "
SELECT table_name, table_rows, ROUND((data_length+index_length)/1024, 1) AS size_kb
FROM information_schema.tables WHERE table_schema = 'ladder_consulting'
ORDER BY (data_length+index_length) DESC;"

# Live CPU/RAM under a synthetic burst
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:5001/api/auth/me & done; wait
ps -o pid,pcpu,pmem,rss,vsz,comm -p <backend_pid>
```

**Baseline measured (dev machine, 2026-06-29):**
- Database: 3.22 MB across 56 tables (32 users, 2 companies, 26 candidates, 1 employee, 3 job postings, 39 applications, 34 resumes, 118 notifications, 4 leads, 44 outreach contacts)
- Resume uploads: 7.1 MB on disk for 34 resumes (~209 KB avg per file)
- Backend `node_modules`: 124 MB · Frontend `node_modules`: 192 MB (build-time only, not needed on the production server)
- Backend RAM under a 30-concurrent-request burst: 58–120 MB, 5.7% of one CPU core
- Backend source: ~15,600 LOC · Frontend source: ~17,300 LOC

A lot of the current "database size" is InnoDB's fixed per-table overhead, not real data weight — tables with 2–4 rows already show 48–144 KB. Real data weight only starts dominating once row counts climb into the hundreds/thousands.

---

## Scenario A — Current production scale: 10 companies / 10 employees / 50 candidates

This is close to the measured baseline (5x companies, 10x employees, ~2x candidates) — not a big jump.

**Concurrency estimate:**
| User group | Realistic peak concurrent sessions |
|---|---|
| 10 employees (full workday use) | 6–9 |
| 10 companies (occasional logins) | 2–5 |
| 50 candidates (sporadic) | 3–10 |
| **Total peak** | **~15–25 concurrent** |

**Projected footprint:** ~65 resumes (~14 MB raw, ~27 MB with masked-PDF cache), ~15–30 job postings, ~75 applications, database still under 10 MB after a year of real activity.

**Recommended spec:**
| Resource | Spec |
|---|---|
| CPU | 1–2 cores |
| RAM | 4 GB |
| Disk | 20 GB SSD |

**AWS instance: `t3.medium`** (2 vCPU, 4 GB RAM) + **20 GB gp3 EBS**.
- `t3.small` (2GB RAM) is too tight — MySQL's baseline overhead alone (~400MB) plus Node plus OS leaves no headroom for a PDF-generation burst.
- `t3.large` (8GB RAM) pays for 2x the RAM this workload will ever touch at this scale.
- `t3` family (burstable) fits because this workload is mostly idle with occasional bursts (PDF generation, resume parsing) — not sustained compute.

**Not urgent at this scale:**
- MySQL connection pool (hardcoded to 10 in `backend/src/config/db.js`) is fine — peak concurrent DB-hitting requests is ~5–8.
- Resumes on local disk (not S3) — ~27MB total, a disk failure would be annoying, not catastrophic.

---

## Scenario B — Future scale: 50 companies / 500 candidates / 50 employees

A much bigger jump (25x companies, ~19x candidates, 50x employees).

**Concurrency estimate:**
| User group | Realistic peak concurrent sessions |
|---|---|
| 50 employees (full workday use) | 30–45 |
| 50 companies (occasional logins) | 5–15 |
| 500 candidates (sporadic) | 10–40 |
| **Total peak** | **~50–100 concurrent** |

**Projected footprint:** ~650 resumes (~135 MB raw, ~270 MB with masked-PDF cache), ~75–150 job postings, ~750–1,500 applications, notifications growing continuously (ongoing employee activity, not just headcount) — likely 5,000–20,000+ rows within months. Database size after 6–12 months of real activity: **50–150 MB**.

**Recommended spec:**
| Resource | Spec |
|---|---|
| CPU | 2 cores (4 if budget allows) |
| RAM | 8 GB |
| Disk | 60–80 GB SSD |

**AWS instance: `t3.large`** (2 vCPU, 8 GB RAM) + **60–80 GB gp3 EBS**. The jump from 4GB→8GB RAM here is about concurrency (more simultaneous Node request handlers + bigger MySQL buffer pool benefit), not data size — the database itself stays small.

**Two things that become real problems at this scale, not optional polish:**
1. **MySQL connection pool (10 connections) needs bumping to ~25–30** in `backend/src/config/db.js` before onboarding this volume — 50 active employees will produce 8–10+ simultaneous DB-hitting requests during peak hours, which will start queuing/timing out against a pool of 10.
2. **Resumes need to move to S3** (`AWS_S3_BUCKET` env var + AWS SDK v3 client already exist in the codebase, just unconfigured) — at 650+ resume files plus masked-PDF cache copies, a single-disk failure becomes a real data-loss risk, not a minor inconvenience.

**Still not necessary at this scale:** splitting MySQL onto its own RDS instance. At a projected 50–150MB database size, one box (app + DB together) handles this comfortably. Revisit RDS only past several hundred companies, or once managed backups become a business-continuity requirement rather than a technical necessity.

---

## General notes that apply to both scenarios

- **CORS is hardcoded to `http://localhost:5173`** in `backend/src/server.js` — must be updated to the production domain before any real deployment, regardless of instance size.
- **Frontend `node_modules` (192MB) is never needed on the production server** — build once (`npm run build`) and deploy only the resulting `dist/` folder (~1.1MB) behind Nginx. Only the backend's `node_modules` (124MB) is a runtime dependency.
- **PM2 + `ecosystem.config.cjs`** (already set up locally) carries directly to production — same process manager, same config shape.
- **`npm audit` flagged 12 vulnerabilities backend-side** (3 moderate, 9 high) and 6 frontend-side (3 low, 1 moderate, 2 high) on the dependency tree as of this measurement — not reviewed in detail yet, worth doing before going live.
- Software stack: Node.js 20 or 22 LTS, MySQL 8.0+, Nginx (static frontend + reverse proxy + TLS termination), Ubuntu 22.04/24.04 LTS.
