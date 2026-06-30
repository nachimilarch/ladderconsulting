# LadderStep Human Consulting — AWS Deployment Runbook

Target: Ubuntu 24.04 LTS, t3.medium (2 vCPU / 4 GB RAM), 20 GB gp3 EBS.
Stack: Node.js 22 + MySQL 8 + Nginx + PM2 (backend), static Vite build (frontend).

---

## 1. Launch the EC2 instance

1. Go to **EC2 → Launch Instance** in ap-south-1 (or your preferred region).
2. AMI: **Ubuntu Server 24.04 LTS** (64-bit x86).
3. Instance type: **t3.medium**.
4. Storage: **20 GB gp3**.
5. Security group — inbound rules:

   | Type  | Port | Source    |
   |-------|------|-----------|
   | SSH   | 22   | Your IP   |
   | HTTP  | 80   | 0.0.0.0/0 |
   | Custom TCP | 5001 | 0.0.0.0/0 | ← only while testing; remove after Nginx is up |

6. Create or select a key pair. Download the `.pem` file.
7. Launch. Note the **Public IPv4 address** — you'll use it everywhere as `YOUR_EC2_PUBLIC_IP`.

---

## 2. Connect and update the system

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP

sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip build-essential
```

---

## 3. Install Node.js 22 (via nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node -v   # should print v22.x.x
```

---

## 4. Install MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation
# Choose: strong password validation → Y, set root password, remove anonymous users → Y,
# disallow remote root → Y, remove test DB → Y, reload privileges → Y
```

Create the application database and user:

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE ladder_consulting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ladderstep'@'127.0.0.1' IDENTIFIED BY 'STRONG_DB_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON ladder_consulting.* TO 'ladderstep'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

> Replace `STRONG_DB_PASSWORD_HERE` with something like `Lad$erSt3p@2026!` — keep it; you'll need it in the `.env`.
> You can also keep using root (as in dev) — just skip the CREATE USER steps and use `root` in the .env.

---

## 5. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

---

## 6. Install PM2

```bash
npm install -g pm2
```

---

## 7. Clone the repository

```bash
sudo mkdir -p /var/www/ladderstep
sudo chown ubuntu:ubuntu /var/www/ladderstep
cd /var/www/ladderstep
git clone https://github.com/nachimilarch/ladderconsulting.git .
```

---

## 8. Configure backend environment

```bash
cp deploy/.env.production.template backend/.env
nano backend/.env
```

Fill in every value:

| Variable | What to set |
|----------|-------------|
| `DB_USER` | `ladderstep` (or `root`) |
| `DB_PASSWORD` | The MySQL password you set above |
| `FRONTEND_URL` | `http://YOUR_EC2_PUBLIC_IP` (update later when you add a domain) |
| `SMTP_USER` | `crm@theladderconsulting.com` |
| `SMTP_PASS` | (from your dev `backend/.env`) |
| `EMAIL_FROM` | `"LadderStep Human Consulting <crm@theladderconsulting.com>"` |
| `GODADDY_SMTP_USER` | same as SMTP_USER |
| `GODADDY_SMTP_PASS` | same as SMTP_PASS |
| `GODADDY_DEFAULT_FROM_NAME` | `LadderStep Human Consulting` |
| `GODADDY_IMAP_USER` | same as SMTP_USER |
| `GODADDY_IMAP_PASS` | (from your dev `backend/.env`) |
| `CASHFREE_APP_ID` | Your Cashfree production App ID |
| `CASHFREE_SECRET_KEY` | Your Cashfree production Secret Key |
| `CASHFREE_WEBHOOK_SECRET` | Your Cashfree webhook secret |
| `AWS_ACCESS_KEY_ID` | (if using S3 — leave blank to skip) |
| `AWS_SECRET_ACCESS_KEY` | (if using S3 — leave blank to skip) |
| `MICROSOFT_CLIENT_ID` | Leave as placeholder for now (SSO needs HTTPS) |
| `GOOGLE_CLIENT_ID` | Leave as placeholder for now (SSO needs HTTPS) |

The JWT secrets in the template are freshly generated — use them as-is.

---

## 9. Load the database schema and seed data

```bash
cd /var/www/ladderstep

# Load schema (all 57 tables, no test data)
mysql -u ladderstep -p ladder_consulting < production_schema.sql

# Load reference data (roles, platform settings, training catalogue, skill tags)
mysql -u ladderstep -p ladder_consulting < production_seed_data.sql
```

---

## 10. Create the first admin user

The Microsoft SSO login never auto-creates admin accounts (by design). You must insert the first admin before you can log in.

```bash
cd /var/www/ladderstep/backend
npm install
node scripts/createFirstAdmin.js "Your Full Name" "you@yourcompany.com"
```

This creates a `users` row (`status=active`, `is_email_verified=1`, unusable random password).
After Nginx + SSL are up and SSO is configured, log in with "Sign in with Microsoft" using that exact email.

> **For HTTP/IP launch (no SSO yet):** temporarily use the trainer login path to verify the backend is working.
> Run this SQL to create a temporary admin-password account:
> ```sql
> -- Replace hash with: node -e "const b=require('bcryptjs');b.hash('TempPass@123',12).then(console.log)"
> UPDATE users SET password = '$2a$12$...' WHERE email = 'you@yourcompany.com';
> ```
> Log in at `/login/trainer` with that email + password. Delete this after SSO is configured.

---

## 11. Build the frontend

```bash
cd /var/www/ladderstep/frontend
npm install
npm run build
# Output goes to frontend/dist/
```

---

## 12. Configure Nginx

```bash
sudo cp /var/www/ladderstep/deploy/nginx.conf /etc/nginx/sites-available/ladderstep
sudo ln -s /etc/nginx/sites-available/ladderstep /etc/nginx/sites-enabled/ladderstep
sudo rm -f /etc/nginx/sites-enabled/default   # remove the placeholder default site

# Update the root path in the config (it points to /var/www/ladderstep/frontend/dist)
sudo nginx -t   # should say "syntax is ok" and "test is successful"
sudo systemctl reload nginx
```

Test: open `http://YOUR_EC2_PUBLIC_IP` in a browser — the React app should load.

---

## 13. Start the backend with PM2

```bash
# Create the log directory
sudo mkdir -p /var/log/ladderstep
sudo chown ubuntu:ubuntu /var/log/ladderstep

cd /var/www/ladderstep
pm2 start deploy/ecosystem.production.config.cjs

# Verify it started
pm2 status
pm2 logs ladderstep-backend --lines 30

# Save the process list so PM2 restarts on reboot
pm2 save

# Auto-start PM2 on boot (run the printed command with sudo)
pm2 startup
# It will print something like: sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Copy and run that printed command.
```

---

## 14. Health check

```bash
# Backend API directly
curl http://localhost:5001/api/auth/me
# Expected: {"success":false,"message":"No token provided."} — means the backend is up

# Via Nginx proxy (same origin)
curl http://YOUR_EC2_PUBLIC_IP/api/auth/me
# Same expected response
```

Open `http://YOUR_EC2_PUBLIC_IP` — the login page should appear with the LadderStep logo.

At this point, **only the Trainer login** (`/login/trainer`, email + password) is functional.
Microsoft / Google SSO requires HTTPS + a domain — see "Fast-follow" below.

---

## 15. Remove the direct 5001 port from the security group

Now that Nginx is routing `/api/` to the backend, there's no reason to expose port 5001 publicly.

In EC2 → Security Groups → your instance's SG → Inbound rules:
- Delete the `Custom TCP 5001 0.0.0.0/0` rule.

Port 5001 still works locally (PM2 → Nginx → browser) — just not from the public internet.

---

## Fast-follow: Adding a Domain + HTTPS

Once you have a domain pointed at the EC2 IP:

### A. Point your domain
Add an A record: `yourdomain.com → YOUR_EC2_PUBLIC_IP` (and `www.yourdomain.com` if needed).
Allow up to 5 minutes for DNS propagation.

### B. Install Certbot and get a certificate
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow prompts: enter email, agree to TOS, choose redirect HTTP→HTTPS
```
Certbot rewrites `/etc/nginx/sites-available/ladderstep` in place — adds the HTTPS block and the HTTP→HTTPS redirect. Verify:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### C. Update FRONTEND_URL in backend/.env
```bash
nano /var/www/ladderstep/backend/.env
# Change: FRONTEND_URL=https://yourdomain.com
```
```bash
pm2 restart ladderstep-backend
```

### D. Configure Microsoft SSO (Azure AD)

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**.
2. Name: `LadderStep Human Consulting`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (multi-tenant).
4. Redirect URI: Web → `https://yourdomain.com` (just the origin, not a callback path — MSAL uses popup, not redirect).
5. Click **Register**. Copy the **Application (client) ID** — this is `MICROSOFT_CLIENT_ID`.
6. Under **Authentication** → add `https://yourdomain.com` to **Allowed redirect URIs** if not already there. Enable **ID tokens** under Implicit grant.
7. Under **Certificates & secrets**: you don't need a client secret (frontend-token-verification flow, not server-side OAuth).
8. Under **API Permissions**: ensure `openid`, `profile`, and `email` delegated permissions are listed (they're added by default).
9. Update both env files:
   - `backend/.env`: `MICROSOFT_CLIENT_ID=<your-application-client-id>`
   - `frontend/.env` (or rebuild with the var): `VITE_MICROSOFT_CLIENT_ID=<your-application-client-id>`
10. Rebuild the frontend and restart the backend:
    ```bash
    cd /var/www/ladderstep/frontend && npm run build
    pm2 restart ladderstep-backend
    ```

### E. Configure Google SSO (Google Cloud Console)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project or select an existing one.
2. **APIs & Services** → **OAuth consent screen**:
   - User type: **External** (allows any Google account, not just Workspace).
   - App name: `LadderStep Human Consulting`, support email: your admin email.
   - Authorized domains: add `yourdomain.com`.
   - Scopes: add `email`, `profile`, `openid`.
   - Save.
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**:
   - Application type: **Web application**.
   - Name: `LadderStep Web`
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com` (same — Google One Tap / popup doesn't use a separate callback path).
   - Click **Create**. Copy the **Client ID** — this is `GOOGLE_CLIENT_ID`.
4. Update both env files:
   - `backend/.env`: `GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com`
   - `frontend/.env` (or rebuild): `VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com`
5. Rebuild + restart:
   ```bash
   cd /var/www/ladderstep/frontend && npm run build
   pm2 restart ladderstep-backend
   ```

> **Note on frontend env vars:** Vite bakes `VITE_*` variables into the static bundle at build time. Every time you change a `VITE_*` value you must `npm run build` and re-serve the new `dist/` — PM2 restart alone is not enough.

### F. Pre-provision HR staff and admin accounts

Before your team can log in with Microsoft, you must insert their `users` rows:

```bash
cd /var/www/ladderstep/backend
# First admin (if you haven't already done step 10):
node scripts/createFirstAdmin.js "Your Name" "you@yourcompany.com"

# Additional staff — use the Admin panel → HR Staff Management once you're logged in.
# That calls POST /api/admin/staff which creates the row and emails the welcome message.
```

---

## Ongoing maintenance

### Deploying updates
```bash
cd /var/www/ladderstep
git pull origin main
cd backend && npm install   # only if package.json changed
cd ../frontend && npm install && npm run build   # always rebuild frontend
pm2 restart ladderstep-backend
```

### Viewing logs
```bash
pm2 logs ladderstep-backend          # tail live
pm2 logs ladderstep-backend --lines 100   # last 100 lines
tail -f /var/log/ladderstep/backend-error.log
```

### Database backup (add to cron)
```bash
# Add to crontab -e:
0 2 * * * mysqldump -u ladderstep -pSTRONG_DB_PASSWORD_HERE ladder_consulting | gzip > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Certificate renewal (auto, but verify)
```bash
sudo certbot renew --dry-run   # test the renewal process
# Certbot installs a systemd timer automatically; it runs twice daily.
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `502 Bad Gateway` from Nginx | `pm2 status` — is ladderstep-backend running? `pm2 logs` for errors |
| Frontend loads but API returns 404 | Nginx config: `location /api/` block and reload |
| `Cannot find module 'dotenv'` | Run `npm install` in `backend/` |
| Login redirects to `/unauthorized` | Wrong role in DB, or cookie `SameSite`/`Secure` mismatch (use HTTPS) |
| SSO popup says "redirect_uri mismatch" | Azure/Google console authorized origins must match exactly (no trailing slash) |
| Emails not sending | Check SMTP creds in `.env`; `pm2 logs` for `[Email]` errors |
| MySQL connection refused | `sudo systemctl status mysql` — is it running? |
