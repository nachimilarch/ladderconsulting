const nodemailer = require('nodemailer');

// Dedicated GoDaddy SMTP transporter for cold outreach campaigns.
// Kept separate from the main transactional email transporter (utils/email.js)
// so outreach credentials can be rotated independently.
const getTransporter = () =>
    nodemailer.createTransport({
        host:   process.env.GODADDY_SMTP_HOST   || process.env.SMTP_HOST,
        port:   parseInt(process.env.GODADDY_SMTP_PORT   || process.env.SMTP_PORT)  || 465,
        secure: (process.env.GODADDY_SMTP_SECURE || process.env.SMTP_SECURE) === 'true',
        auth: {
            user: process.env.GODADDY_SMTP_USER || process.env.SMTP_USER,
            pass: process.env.GODADDY_SMTP_PASS || process.env.SMTP_PASS,
        },
    });

const getDefaultFrom = () =>
    process.env.GODADDY_SMTP_USER || process.env.SMTP_USER || '';

const getDomain = () => {
    const user = getDefaultFrom();
    const at = user.indexOf('@');
    return at !== -1 ? user.slice(at + 1) : 'ladder.consulting';
};

/**
 * Replace merge tags in email body / subject:
 * {{first_name}} {{last_name}} {{full_name}} {{company_name}} {{designation}}
 * {{city}} {{executive_name}}
 */
const replaceMergeTags = (template, contact, executiveName = '') => {
    const firstName = (contact.full_name || '').split(' ')[0] || '';
    const lastName  = (contact.full_name || '').split(' ').slice(1).join(' ') || '';
    return template
        .replace(/\{\{first_name\}\}/gi,     firstName)
        .replace(/\{\{last_name\}\}/gi,      lastName)
        .replace(/\{\{full_name\}\}/gi,      contact.full_name  || '')
        .replace(/\{\{company_name\}\}/gi,   contact.company_name || '')
        .replace(/\{\{designation\}\}/gi,    contact.designation  || '')
        .replace(/\{\{city\}\}/gi,           contact.city         || '')
        .replace(/\{\{executive_name\}\}/gi, executiveName);
};

/**
 * Build the campaign-tracking tagged reply-to address.
 * Format: <local+lc-{campaignId}-{executiveId}@domain.com>
 */
const buildReplyToAddress = (campaignId, executiveId) => {
    const user   = getDefaultFrom();
    const domain = getDomain();
    const local  = user.split('@')[0] || 'outreach';
    return `${local}+lc-${campaignId}-${executiveId}@${domain}`;
};

/**
 * Parse the tagged reply-to address to extract campaignId and executiveId.
 * Returns null if the address doesn't match the expected format.
 */
const parseReplyToTag = (address) => {
    if (!address) return null;
    const match = address.match(/\+lc-(\d+)-(\d+)@/);
    if (!match) return null;
    return { campaignId: parseInt(match[1]), executiveId: parseInt(match[2]) };
};

module.exports = { getTransporter, getDefaultFrom, getDomain, replaceMergeTags, buildReplyToAddress, parseReplyToTag };
