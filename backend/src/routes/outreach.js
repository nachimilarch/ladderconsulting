const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const contactCtrl   = require('../controllers/outreachContactController');
const campaignCtrl  = require('../controllers/outreachCampaignController');
const replyCtrl     = require('../controllers/outreachReplyController');
const callCtrl           = require('../controllers/outreachCallController');
const emailAutoReplyCtrl = require('../controllers/emailAutoReplyController');
const whatsappCtrl  = require('../controllers/whatsappController');
const analyticsCtrl = require('../controllers/outreachAnalyticsController');

// Multer memory storage for Excel uploads (passed to S3)
const uploadExcel = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = require('path').extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only .xlsx, .xls, .csv files are allowed'));
    },
});

// All routes require authentication
router.use(authenticateToken);
// All routes require hr_staff or admin role
router.use(authorizeRole('hr_staff', 'admin'));

// ── Webhooks (no auth — before router.use above — mounted separately in server.js) ──

// ── Contact Lists ────────────────────────────────────────────────────────────
router.post('/contact-lists/upload',           uploadExcel.single('file'), contactCtrl.upload);
router.get('/contact-lists',                   contactCtrl.getLists);
router.get('/contact-lists/:id',               contactCtrl.getList);
router.get('/contact-lists/:id/contacts',      contactCtrl.getContacts);
router.delete('/contact-lists/:id',            contactCtrl.deleteList);
router.patch('/contacts/:id/unsubscribe',      contactCtrl.unsubscribeContact);
router.get('/contacts/:id/call-history',       contactCtrl.getContactCallHistory);

// ── Email Campaigns ──────────────────────────────────────────────────────────
router.post('/email-campaigns',                campaignCtrl.createEmailCampaign);
router.get('/email-campaigns',                 campaignCtrl.listEmailCampaigns);
router.get('/email-campaigns/:id',             campaignCtrl.getEmailCampaign);
router.put('/email-campaigns/:id',             campaignCtrl.updateEmailCampaign);
router.post('/email-campaigns/:id/send',       campaignCtrl.sendEmailCampaign);
router.post('/email-campaigns/:id/pause',      campaignCtrl.pauseEmailCampaign);
router.delete('/email-campaigns/:id',          campaignCtrl.deleteEmailCampaign);

// ── Replies ──────────────────────────────────────────────────────────────────
router.get('/replies',                         replyCtrl.listReplies);
router.get('/replies/:id',                     replyCtrl.getReply);
router.post('/replies/:id/reply',              replyCtrl.sendReply);
router.patch('/replies/:id/convert',           replyCtrl.convertToLead);
router.patch('/replies/:id/ignore',            replyCtrl.ignoreReply);
router.patch('/replies/:id/assign',            authorizeRole('admin'), replyCtrl.assignReply);

// ── WhatsApp / Vaartabot ─────────────────────────────────────────────────────
router.get('/whatsapp/credits',                    whatsappCtrl.getCredits);
router.post('/whatsapp/templates/sync',            whatsappCtrl.syncTemplates);
router.get('/whatsapp/templates',                  whatsappCtrl.listTemplates);
// Webhook management (admin only — registers/manages Vaartabot webhook subscriptions)
router.get('/whatsapp/webhooks',                   authorizeRole('admin'), whatsappCtrl.listWebhooks);
router.post('/whatsapp/webhooks',                  authorizeRole('admin'), whatsappCtrl.registerWebhook);
router.patch('/whatsapp/webhooks/:id',             authorizeRole('admin'), whatsappCtrl.updateWebhook);
router.post('/whatsapp/webhooks/:id/test',         authorizeRole('admin'), whatsappCtrl.testWebhook);
router.delete('/whatsapp/webhooks/:id',            authorizeRole('admin'), whatsappCtrl.deleteWebhook);
router.post('/whatsapp/templates',                 whatsappCtrl.createTemplate);
router.put('/whatsapp/templates/:id',              whatsappCtrl.updateTemplate);
router.delete('/whatsapp/templates/:id',           whatsappCtrl.deleteTemplate);
router.get('/whatsapp/auto-replies',               whatsappCtrl.listAutoReplyFlows);
router.post('/whatsapp/auto-replies',              whatsappCtrl.createAutoReplyFlow);
router.put('/whatsapp/auto-replies/:id',           whatsappCtrl.updateAutoReplyFlow);
router.delete('/whatsapp/auto-replies/:id',        whatsappCtrl.deleteAutoReplyFlow);

// ── WhatsApp Campaigns ───────────────────────────────────────────────────────
router.post('/whatsapp-campaigns',             whatsappCtrl.createWACampaign);
router.get('/whatsapp-campaigns',              whatsappCtrl.listWACampaigns);
router.get('/whatsapp-campaigns/:id',          whatsappCtrl.getWACampaign);
router.post('/whatsapp-campaigns/:id/send',    whatsappCtrl.sendWACampaign);

// ── Email Auto-Replies ───────────────────────────────────────────────────────
router.get('/email/auto-replies',              emailAutoReplyCtrl.listFlows);
router.post('/email/auto-replies',             emailAutoReplyCtrl.createFlow);
router.put('/email/auto-replies/:id',          emailAutoReplyCtrl.updateFlow);
router.delete('/email/auto-replies/:id',       emailAutoReplyCtrl.deleteFlow);

// ── Cold Calls ───────────────────────────────────────────────────────────────
router.get('/calls',                           callCtrl.getCalls);
router.post('/calls',                          callCtrl.logCall);
router.put('/calls/:id',                       callCtrl.updateCall);

// ── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/campaigns',             analyticsCtrl.campaignStats);
router.get('/analytics/conversions',           analyticsCtrl.conversionStats);

module.exports = router;
