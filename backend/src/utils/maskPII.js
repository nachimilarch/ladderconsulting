// Pure PII masking utilities — no DB dependency.
// Single source of truth for all PII patterns used by both the PDF generator
// and the parsed-text storage pipeline.

// ── Shared replacement tokens ─────────────────────────────────────────────────
const CONTACT_TOKEN = '[Contact via LadderStep Human Consulting]';
const PROFILE_TOKEN = '[Profile via LadderStep Human Consulting]';
const REDACT_TOKEN  = '[REDACTED]';

// ── PII pattern definitions ───────────────────────────────────────────────────
// Each entry: { pattern: RegExp, replacement: string | function }
// Applied in order — put broad label-first rules before bare-number rules.
const PII_PATTERNS = [
    // ── Email ─────────────────────────────────────────────────────────────────
    {
        pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
        replacement: CONTACT_TOKEN,
    },

    // ── Phone — label-first (highest priority) ────────────────────────────────
    // Catches: "Mobile: 9876543210", "Ph. +91 98765-43210", "Contact No: 98765 43210"
    // Preserves the label text, replaces only the number value.
    {
        pattern: /((?:phone|mobile|mob|cell|tel|ph|whatsapp|landline|fax|contact\s*(?:no\.?|num(?:ber)?|#)?)\s*[:\-\. ]*)\+?[\d][\d\s\-\.()+]{5,18}\d/gi,
        replacement: (_, label) => label + CONTACT_TOKEN,
    },

    // ── Phone — Indian mobile with +91 prefix ─────────────────────────────────
    // Allows up to 2 chars of separator between digit groups.
    {   // 10-digit with any split: +91 98765 43210 / +91-9876543210 / +91.98765.43210
        pattern: /\+91[\s\-. ]{0,2}[6-9]\d{4}[\s\-. ]{0,2}\d{5}/g,
        replacement: CONTACT_TOKEN,
    },
    {   // +91 9876 543210 (4+6 split)
        pattern: /\+91[\s\-. ]{0,2}[6-9]\d{3}[\s\-. ]{0,2}\d{6}/g,
        replacement: CONTACT_TOKEN,
    },
    {   // +91 987 654 3210 (3+3+4 split)
        pattern: /\+91[\s\-. ]{0,2}[6-9]\d{2}[\s\-. ]{0,2}\d{3}[\s\-. ]{0,2}\d{4}/g,
        replacement: CONTACT_TOKEN,
    },
    {   // +91 followed by 10 contiguous digits
        pattern: /\+91[6-9]\d{9}/g,
        replacement: CONTACT_TOKEN,
    },

    // ── Phone — Indian mobile without prefix (10-digit starting 6-9) ──────────
    {   // No separator — 10 contiguous digits
        pattern: /\b[6-9]\d{9}\b/g,
        replacement: CONTACT_TOKEN,
    },
    {   // 5+5 split: 98765 43210 or 98765-43210 (space after sanitization may be 1-2 chars)
        pattern: /\b[6-9]\d{4}[\s\-. ]{1,2}\d{5}\b/g,
        replacement: CONTACT_TOKEN,
    },
    {   // 3+3+4 split: 987-654-3210 or 987 654 3210
        pattern: /\b[6-9]\d{2}[\s\-. ]{1,2}\d{3}[\s\-. ]{1,2}\d{4}\b/g,
        replacement: CONTACT_TOKEN,
    },
    {   // 4+6 split: 9876 543210
        pattern: /\b[6-9]\d{3}[\s\-. ]{1,2}\d{6}\b/g,
        replacement: CONTACT_TOKEN,
    },
    {   // 4+3+3 split: 9876 543 210
        pattern: /\b[6-9]\d{3}[\s\-. ]{1,2}\d{3}[\s\-. ]{1,2}\d{3}\b/g,
        replacement: CONTACT_TOKEN,
    },
    {   // 2+4+4 split: 98 7654 3210
        pattern: /\b[6-9]\d[\s\-. ]{1,2}\d{4}[\s\-. ]{1,2}\d{4}\b/g,
        replacement: CONTACT_TOKEN,
    },

    // ── Phone — generic international ─────────────────────────────────────────
    {   // (123) 456-7890 / 123-456-7890 / 123.456.7890
        pattern: /\(?\d{3}\)?[\s\-. ]{1,2}\d{3}[\s\-. ]{1,2}\d{4}/g,
        replacement: CONTACT_TOKEN,
    },
    {   // +1-800-555-1234 or +44 20 7946 0958 style
        pattern: /\+\d{1,3}[\s\-. ]?\(?\d{2,4}\)?[\s\-. ]?\d{3,4}[\s\-. ]?\d{3,4}/g,
        replacement: CONTACT_TOKEN,
    },

    // ── Social / web profiles ──────────────────────────────────────────────────
    {
        pattern: /linkedin\.com\/in\/[^\s,)"<\n]*/gi,
        replacement: PROFILE_TOKEN,
    },
    {
        pattern: /github\.com\/[^\s,)"<\n]*/gi,
        replacement: PROFILE_TOKEN,
    },
    {
        pattern: /twitter\.com\/[^\s,)"<\n]*/gi,
        replacement: PROFILE_TOKEN,
    },
    {
        pattern: /instagram\.com\/[^\s,)"<\n]*/gi,
        replacement: PROFILE_TOKEN,
    },
    {   // Any http/https URL not on ladder-consulting domain
        pattern: /https?:\/\/(www\.)?((?!ladder-consulting)[^\s,)"<\n]+)/gi,
        replacement: PROFILE_TOKEN,
    },

    // ── Government IDs ─────────────────────────────────────────────────────────
    {   // Aadhaar: 12 digits in groups of 4
        pattern: /\b\d{4}[\s]?\d{4}[\s]?\d{4}\b/g,
        replacement: REDACT_TOKEN,
    },
    {   // PAN card: ABCDE1234F
        pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
        replacement: REDACT_TOKEN,
    },
];

// ── Core masking function (shared) ────────────────────────────────────────────
function applyPIIPatterns(text) {
    let out = text;
    for (const { pattern, replacement } of PII_PATTERNS) {
        // Reset lastIndex on stateful regexes between calls
        if (pattern.global) pattern.lastIndex = 0;
        out = out.replace(pattern, replacement);
    }
    return out;
}

// ── Candidate name → initials ─────────────────────────────────────────────────
function maskName(fullName) {
    if (!fullName) return 'Candidate';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase() + '.';
    return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}`;
}

// ── Location → city-only ──────────────────────────────────────────────────────
function maskLocation(location) {
    if (!location) return null;
    return location.split(',')[0].trim();
}

// ── Full candidate object masking for company API responses ───────────────────
function maskCandidateForCompany(candidate) {
    const masked = { ...candidate };

    if (masked.candidate_name != null) masked.candidate_name = maskName(masked.candidate_name);
    if (masked.name != null)           masked.name           = maskName(masked.name);

    masked.email           = 'contact@ladder-consulting.in';
    masked.candidate_email = 'contact@ladder-consulting.in';

    if ('phone' in masked)           masked.phone           = CONTACT_TOKEN;
    if ('candidate_phone' in masked) masked.candidate_phone = CONTACT_TOKEN;

    if (masked.linkedin_url)  masked.linkedin_url  = 'Available via LadderStep Human Consulting';
    if (masked.portfolio_url) masked.portfolio_url = 'Available via LadderStep Human Consulting';

    if ('location' in masked)         masked.location         = maskLocation(masked.location);
    if ('current_location' in masked) masked.current_location = maskLocation(masked.current_location);

    delete masked.resume_path;
    delete masked.file_key;
    delete masked.resume_original_name;

    return masked;
}

// ── Resume text masking (used when storing parsed text in DB) ─────────────────
function maskResumeText(rawText) {
    return applyPIIPatterns(rawText);
}

module.exports = {
    applyPIIPatterns,
    maskCandidateForCompany,
    maskName,
    maskLocation,
    maskResumeText,
    // Expose tokens so generator can use them without hardcoding
    CONTACT_TOKEN,
    PROFILE_TOKEN,
    REDACT_TOKEN,
};
