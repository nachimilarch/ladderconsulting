/**
 * Microsoft Graph API mail sender.
 * Replaces nodemailer SMTP for all outbound email since M365 blocks SMTP AUTH.
 * Requires: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 * App registration needs: Mail.Send (Application) with admin consent.
 */
const axios = require('axios');

// ── Token cache (shared with mailPoller) ──────────────────────────────────────
let _token       = null;
let _tokenExpiry = 0;

const getGraphToken = async () => {
    if (_token && Date.now() < _tokenExpiry - 60000) return _token;
    const { data } = await axios.post(
        `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
        new URLSearchParams({
            grant_type:    'client_credentials',
            client_id:     process.env.MICROSOFT_CLIENT_ID,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET,
            scope:         'https://graph.microsoft.com/.default',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    _token       = data.access_token;
    _tokenExpiry = Date.now() + data.expires_in * 1000;
    return _token;
};

// Parse "Display Name <email@domain>" or bare "email@domain"
const parseAddr = (str) => {
    if (!str) return null;
    const m = str.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
    if (m) return { name: m[1].trim(), address: m[2].trim() };
    const clean = str.trim();
    return clean ? { name: '', address: clean } : null;
};

/**
 * Send mail via Graph API.
 * Options mirror nodemailer's sendMail signature so callers need no changes:
 *   from, to, subject, html, text, replyTo,
 *   headers (object), inReplyTo, references,
 *   saveToSent (bool, default false — avoids filling the mailbox for bulk sends)
 */
const sendGraphMail = async ({
    from, to, cc, subject,
    html, text,
    replyTo, headers,
    inReplyTo, references,
    saveToSent = false,
}) => {
    const token = await getGraphToken();

    const fromParsed = parseAddr(typeof from === 'string' ? from : null);
    const senderAddr = fromParsed?.address || process.env.SMTP_USER || process.env.GODADDY_SMTP_USER;

    const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
    const toRecipients = toList.map(addr => {
        const p = parseAddr(addr);
        return { emailAddress: p || { address: addr } };
    });

    const message = {
        subject: subject || '(no subject)',
        body: {
            contentType: html ? 'HTML' : 'Text',
            content:     html  || text || '',
        },
        toRecipients,
        // Do NOT set message.from — Graph API auto-sets it to the sending mailbox.
        // Explicitly overriding it with the same address causes ErrorAccessDenied on
        // accounts where mail != userPrincipalName (shared mailboxes, null-mail accounts).
    };

    if (cc) {
        const ccList = (Array.isArray(cc) ? cc : [cc]).filter(Boolean);
        if (ccList.length > 0) {
            message.ccRecipients = ccList.map(addr => {
                const p = parseAddr(addr);
                return { emailAddress: p || { address: addr } };
            });
        }
    }

    if (replyTo) {
        const rt = parseAddr(typeof replyTo === 'string' ? replyTo : null);
        if (rt) message.replyTo = [{ emailAddress: rt }];
    }

    // Graph API only allows X-prefixed custom headers in internetMessageHeaders.
    // Standard headers (List-Unsubscribe, In-Reply-To, References) must be handled
    // differently: In-Reply-To/References as X- equivalents for threading hints;
    // List-Unsubscribe is simply omitted (reply tracking relies on Reply-To tag instead).
    const extraHeaders = [];
    if (headers && typeof headers === 'object') {
        for (const [name, value] of Object.entries(headers)) {
            if (/^x-/i.test(name)) extraHeaders.push({ name, value: String(value) });
        }
    }
    if (inReplyTo)  extraHeaders.push({ name: 'X-In-Reply-To', value: inReplyTo });
    if (references) {
        const refs = Array.isArray(references) ? references.join(' ') : references;
        extraHeaders.push({ name: 'X-References', value: refs });
    }
    if (extraHeaders.length > 0) message.internetMessageHeaders = extraHeaders;

    await axios.post(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderAddr)}/sendMail`,
        { message, saveToSentItems: saveToSent },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
};

module.exports = { getGraphToken, sendGraphMail };
