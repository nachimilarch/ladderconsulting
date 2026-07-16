/**
 * One-time script: submit all LadderStep notification templates to Meta via Vaartabot.
 * Run once: node src/scripts/createWATemplates.js
 *
 * Templates will be in PENDING status until Meta approves them (usually 24–48 h).
 * After approval, run: POST /api/outreach/whatsapp/templates/sync  (or use Admin UI)
 * to pull approved status into our local DB.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');
const db    = require('../config/db');

const VB_BASE  = 'https://vaartabot.com/api/v1';
const API_KEY  = process.env.VAARTABOT_API_KEY;
const headers  = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

if (!API_KEY) { console.error('VAARTABOT_API_KEY not set'); process.exit(1); }

// ── Template definitions ──────────────────────────────────────────────────────
// category: UTILITY (transactional) | MARKETING
// variables: count of {{N}} placeholders in body
const TEMPLATES = [
    {
        name:     'ladderstep_company_approved',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, great news! Your company account on LadderStep Human Consulting has been approved. You can now log in and start posting jobs and hiring candidates.\n\nLogin: https://theladderconsulting.com/login\n\nWelcome aboard!\n- Team LadderStep',
        variables: 1,
    },
    {
        name:     'ladderstep_interview_req_approved',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi, your interview request for {{1}} ({{2}}) has been approved. The interview is scheduled for {{3}}.\n\nLog in to LadderStep for details: https://theladderconsulting.com/login',
        variables: 3,
    },
    {
        name:     'ladderstep_interview_req_rejected',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi, your interview request for {{1}} ({{2}}) was not approved at this time. Please log in to LadderStep for details or contact your assigned executive.\n\nhttps://theladderconsulting.com/login',
        variables: 2,
    },
    {
        name:     'ladderstep_offer_approved_co',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi, your offer request for {{1}} ({{2}}) has been approved by LadderStep. You can now generate and send the offer letter.\n\nLog in: https://theladderconsulting.com/login',
        variables: 2,
    },
    {
        name:     'ladderstep_offer_rejected_co',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi, your offer request for {{1}} ({{2}}) was not approved at this time. Please log in to LadderStep for details or contact your assigned executive.\n\nhttps://theladderconsulting.com/login',
        variables: 2,
    },
    {
        name:     'ladderstep_interview_confirmed_co',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi, {{1}} has confirmed their interview for {{2}} scheduled on {{3}}. Log in to LadderStep to view details.\n\nhttps://theladderconsulting.com/login',
        variables: 3,
    },
    {
        name:     'ladderstep_interview_scheduled_cand',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, your interview has been scheduled!\n\nRole: {{2}}\nCompany: {{3}}\nDate & Time: {{4}}\nMode: {{5}}\n\nLog in to LadderStep to confirm your slot.\n\nhttps://theladderconsulting.com/login\n\nBest of luck!\n- Team LadderStep',
        variables: 5,
    },
    {
        name:     'ladderstep_interview_cancelled',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, your interview for {{2}} at {{3}} has been cancelled. Our team will reach out shortly to reschedule.\n\nFor details log in: https://theladderconsulting.com/login\n\n- Team LadderStep',
        variables: 3,
    },
    {
        name:     'ladderstep_shortlisted_cand',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, great news! You have been shortlisted for the role of {{2}} at {{3}}.\n\nLog in to LadderStep to view your application status: https://theladderconsulting.com/login\n\n- Team LadderStep',
        variables: 3,
    },
    {
        name:     'ladderstep_offer_received_cand',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, congratulations! You have received a job offer from {{2}} for the role of {{3}}.\n\nLog in to LadderStep Human Consulting to review and respond to your offer: https://theladderconsulting.com/login\n\n- Team LadderStep',
        variables: 3,
    },
    {
        name:     'ladderstep_offer_letter_ready',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, your offer letter for {{2}} at {{3}} is ready!\n\nLog in to LadderStep to download and accept your offer: https://theladderconsulting.com/login\n\n- Team LadderStep',
        variables: 3,
    },
    {
        name:     'ladderstep_app_status_update',
        category: 'UTILITY',
        language: 'en',
        body:     'Hi {{1}}, there is an update on your application for {{2}} at {{3}}.\n\nStatus: {{4}}\n\nLog in to LadderStep for details: https://theladderconsulting.com/login\n\n- Team LadderStep',
        variables: 4,
    },
];

// ── Submit each template ──────────────────────────────────────────────────────
async function run() {
    let created = 0, skipped = 0, failed = 0;

    for (const tpl of TEMPLATES) {
        try {
            // Build Vaartabot create-template payload
            const payload = {
                name:     tpl.name,
                category: tpl.category,
                language: tpl.language,
                components: [
                    { type: 'BODY', text: tpl.body },
                ],
            };

            const res = await axios.post(`${VB_BASE}/templates`, payload, { headers });
            console.log(`✓ Submitted: ${tpl.name} → ${res.data?.data?.status || 'submitted'}`);

            // Also upsert in local DB (inactive until approved)
            await db.query(
                `INSERT INTO whatsapp_templates
                    (created_by, template_name, language_code, category, body_text, variable_count, is_active)
                 VALUES (1, ?, ?, ?, ?, ?, 0)
                 ON DUPLICATE KEY UPDATE
                    body_text = VALUES(body_text),
                    variable_count = VALUES(variable_count),
                    category = VALUES(category)`,
                [tpl.name, tpl.language, tpl.category, tpl.body, tpl.variables]
            );
            created++;
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            if (msg?.includes('already exists') || msg?.includes('duplicate')) {
                console.log(`- Skipped (already exists): ${tpl.name}`);
                // Still ensure it's in local DB
                await db.query(
                    `INSERT IGNORE INTO whatsapp_templates
                        (created_by, template_name, language_code, category, body_text, variable_count, is_active)
                     VALUES (1, ?, ?, ?, ?, ?, 0)`,
                    [tpl.name, tpl.language, tpl.category, tpl.body, tpl.variables]
                ).catch(() => {});
                skipped++;
            } else {
                console.error(`✗ Failed: ${tpl.name} — ${msg}`);
                failed++;
            }
        }
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
    console.log('\nNext steps:');
    console.log('1. Wait 24–48 h for Meta to approve templates');
    console.log('2. In Admin → Platform Settings → WhatsApp, click "Sync Templates"');
    console.log('   This marks approved templates as active in the local DB.');
    console.log('3. WhatsApp notifications will then auto-send alongside emails.');
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
