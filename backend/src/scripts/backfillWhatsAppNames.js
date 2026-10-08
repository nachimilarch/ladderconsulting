/**
 * One-off: give existing WhatsApp inbox messages the sender's WhatsApp name.
 * Looks each number up in Vaartabot's contact list and fills `from_name` where it is empty.
 *
 *   node src/scripts/backfillWhatsAppNames.js          # dry run, prints what it would do
 *   node src/scripts/backfillWhatsAppNames.js --apply  # writes the names
 */
require('dotenv').config();
const db = require('../config/db');
const inbox = require('../services/whatsappInbox');

(async () => {
    const apply = process.argv.includes('--apply');
    const [phones] = await db.query(
        `SELECT REPLACE(from_phone, '+', '') AS phone, COUNT(*) AS messages
         FROM outreach_email_replies
         WHERE channel = 'whatsapp' AND deleted_at IS NULL AND (from_name IS NULL OR from_name = '') AND from_phone IS NOT NULL
         GROUP BY REPLACE(from_phone, '+', '')`
    );
    let found = 0, updated = 0;
    for (const { phone, messages } of phones) {
        const name = await inbox.lookupProfileName(phone, { fresh: true });
        if (!name) continue;
        found += 1;
        if (apply) updated += await inbox.saveNameForPhone(phone, name);
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', numbers_without_name: phones.length, names_found: found, messages_updated: updated }));
    process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
