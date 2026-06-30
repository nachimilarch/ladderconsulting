require('dotenv').config();
const express = require('express');
const { startMailPoller } = require('./services/mailPoller');

// Load DB-stored env overrides into process.env so UI-configured values are
// picked up at startup without needing to edit .env files.
async function loadEnvOverrides() {
  try {
    const db = require('./config/db');
    const ENV_KEYS = [
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'email_from',
      'godaddy_smtp_host', 'godaddy_smtp_port', 'godaddy_smtp_secure',
      'godaddy_smtp_user', 'godaddy_smtp_pass', 'godaddy_default_from_name',
      'godaddy_imap_host', 'godaddy_imap_port', 'godaddy_imap_secure',
      'godaddy_imap_user', 'godaddy_imap_pass',
      'aws_access_key_id', 'aws_secret_access_key', 'aws_region', 'aws_s3_bucket',
      'whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_business_account_id',
      'whatsapp_webhook_verify_token',
      'cashfree_app_id', 'cashfree_secret_key', 'cashfree_env', 'cashfree_webhook_secret',
      'openai_api_key', 'ai_match_threshold',
    ];
    if (!ENV_KEYS.length) return;
    const placeholders = ENV_KEYS.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT setting_key, value FROM platform_settings WHERE setting_key IN (${placeholders})`,
      ENV_KEYS
    );
    for (const { setting_key, value } of rows) {
      if (value !== null && value !== '') {
        process.env[setting_key.toUpperCase()] = value;
      }
    }
    if (rows.length) console.log(`[env-overrides] Applied ${rows.length} setting(s) from DB`);
  } catch (err) {
    console.warn('[env-overrides] Could not load DB settings (DB may not be ready yet):', err.message);
  }
}
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist before any route tries to use them
['uploads/resumes', 'uploads/masked_resumes'].forEach(dir => {
  const full = path.join(__dirname, '..', dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

const app = express();

// Required behind a reverse proxy/load balancer (Nginx, ALB) so req.secure,
// req.ip, and the rate limiter see the real client — not the proxy hop.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());

// FRONTEND_URL supports a comma-separated list (e.g. apex + www, or a staging
// URL alongside production) — no origin is allowed unless explicitly listed.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(cookieParser());
// Uploads directory is NOT served statically — all file access goes through
// authenticated API endpoints to enforce role/access-grant checks.

const maintenanceCheck = require('./middleware/maintenanceCheck');
app.use(maintenanceCheck);

// General defense-in-depth cap across the whole API, keyed by IP (trust proxy
// above makes req.ip the real client address, not the load balancer's).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Auth endpoints are the highest-value brute-force/credential-stuffing target —
// capped tighter on top of the general limit above.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});
app.use('/api/auth', authLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/training', require('./routes/training'));
app.use('/api/training-services', require('./routes/trainingServices'));
app.use('/api/offer-requests', require('./routes/offerRequests'));
app.use('/api/interview-requests', require('./routes/interviewRequests'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/recruitment', require('./routes/recruitment'));
app.use('/api/hr/package-requests', require('./routes/hrPackages'));
app.use('/api/admin', require('./routes/admin'));

// Outreach module — webhooks must be mounted before auth middleware
const whatsappCtrl = require('./controllers/whatsappController');
app.get('/api/outreach/webhooks/whatsapp', whatsappCtrl.verifyWebhook);
app.post('/api/outreach/webhooks/whatsapp', express.json(), whatsappCtrl.handleWebhook);
app.use('/api/outreach', require('./routes/outreach'));

// Admin outreach routes
const analyticsCtrl = require('./controllers/outreachAnalyticsController');
const { authenticateToken, authorizeRole } = require('./middleware/auth');
app.get('/api/admin/outreach/campaigns', authenticateToken, authorizeRole('admin'), analyticsCtrl.adminCampaigns);
app.get('/api/admin/outreach/replies', authenticateToken, authorizeRole('admin'), analyticsCtrl.adminReplies);

app.get('/api/health', async (req, res) => {
  let maintenance = false;
  try {
    const db = require('./config/db');
    const [[row]] = await db.query(
      "SELECT value FROM platform_settings WHERE setting_key = 'maintenance_mode'"
    );
    maintenance = row?.value === 'true';
  } catch { /* ignore */ }
  res.json({ status: 'ok', maintenance });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

const PORT = process.env.PORT || 5001;
module.exports.reloadEnv = loadEnvOverrides;

loadEnvOverrides().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startMailPoller();
  });
});
