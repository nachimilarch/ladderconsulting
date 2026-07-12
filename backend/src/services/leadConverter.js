/**
 * Reusable service: auto-create or update a leads record from an outreach contact.
 * Called by email reply handler, WhatsApp reply handler, and cold call converter.
 *
 * @param {object} opts
 * @param {number} opts.contactId      - outreach_contacts.id
 * @param {string} opts.source         - 'cold_email' | 'cold_call' | 'whatsapp'
 * @param {number|null} opts.campaignId
 * @param {number} opts.executiveUserId - user_id of the assigned executive
 * @param {number|null} opts.replyId    - outreach_email_replies.id (optional)
 * @param {number|null} opts.callLogId  - outreach_call_logs.id (optional)
 * @returns {Promise<number>} leads.id
 */
const db = require('../config/db');

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[notify:leadConverter]', err.message);
    }
};

const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};

const createLeadFromContact = async ({ contactId, source, campaignId, executiveUserId, replyId = null, callLogId = null }) => {
    const [[contact]] = await db.query(
        'SELECT * FROM outreach_contacts WHERE id = ? AND deleted_at IS NULL', [contactId]
    );
    if (!contact) throw new Error(`Contact ${contactId} not found`);

    // Resolve executive's employee_id for leads.assigned_to.
    // If the user has no employee record (e.g., admin without employee), fall back
    // to the first available active hr_staff employee.
    let empId = await getEmployeeId(executiveUserId);
    if (!empId) {
        const [[fallback]] = await db.query(
            `SELECT e.id FROM employees e
             JOIN users u ON u.id = e.user_id
             JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'hr_staff' AND e.deleted_at IS NULL AND u.status = 'active'
             LIMIT 1`
        );
        empId = fallback?.id ?? null;
    }

    // Check if a lead already exists for this outreach contact
    const [[existing]] = await db.query(
        'SELECT id, stage FROM leads WHERE outreach_contact_id = ? AND deleted_at IS NULL LIMIT 1',
        [contactId]
    );

    let leadId;

    if (existing) {
        leadId = existing.id;
        // Advance to 'contacted' if still at 'new'
        if (existing.stage === 'new') {
            await db.query(
                "UPDATE leads SET stage = 'contacted', source_type = ?, outreach_campaign_id = ?, updated_at = NOW() WHERE id = ?",
                [source, campaignId || null, leadId]
            );
        }
    } else {
        // Create new lead
        const [result] = await db.query(
            `INSERT INTO leads
               (company_name, contact_name, contact_email, contact_phone, source, stage,
                assigned_to, source_type, outreach_contact_id, outreach_campaign_id)
             VALUES (?, ?, ?, ?, ?, 'contacted', ?, ?, ?, ?)`,
            [
                contact.company_name || '',
                contact.full_name    || null,
                contact.email        || null,
                contact.phone        || null,
                source,
                empId                || null,
                source,
                contactId,
                campaignId           || null,
            ]
        );
        leadId = result.insertId;

        // Link back to outreach_contacts
        await db.query('UPDATE outreach_contacts SET lead_id = ? WHERE id = ?', [leadId, contactId]);
    }

    // Link back to reply or call log
    if (replyId) {
        await db.query('UPDATE outreach_email_replies SET lead_id = ? WHERE id = ?', [leadId, replyId]);
    }
    if (callLogId) {
        await db.query('UPDATE outreach_call_logs SET lead_id = ? WHERE id = ?', [leadId, callLogId]);
    }

    // Notify executive
    await notify(
        executiveUserId,
        'lead_converted',
        'Contact Added to Leads Pipeline',
        `${contact.full_name || contact.email || 'A contact'} has been added to your leads pipeline from ${source.replace('_', ' ')}.`,
        { lead_id: leadId, contact_id: contactId }
    );

    return leadId;
};

module.exports = { createLeadFromContact };
