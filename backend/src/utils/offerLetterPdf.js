/**
 * Offer Letter PDF generator — uses pdfkit (already installed).
 * Returns a Buffer containing the A4 PDF.
 */
const PDFDocument = require('pdfkit');

const BRAND  = [106, 71, 212];
const DARK   = [17,  24,  39];
const MID    = [75,  85,  99];
const LIGHT  = [156, 163, 175];
const RULE   = [229, 231, 235];

const fmtINR = (n) =>
    `INR ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

function hRule(doc, y, color = RULE) {
    doc.save()
       .moveTo(50, y).lineTo(545, y)
       .strokeColor(color).lineWidth(0.5).stroke()
       .restore();
}

/**
 * @param {Object} offer   - offer row from DB
 * @param {Object} ctx     - { company_name, headquarters, job_title, job_type,
 *                              candidate_name, candidate_email, issued_by_name }
 * @returns {Promise<Buffer>}
 */
function generateOfferLetterPDF(offer, ctx) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 60, right: 60 },
            bufferPages: true,
            info: {
                Title: `Offer Letter — ${ctx.job_title}`,
                Author: ctx.company_name,
                Subject: 'Letter of Offer',
            },
        });

        const chunks = [];
        doc.on('data',  c  => chunks.push(c));
        doc.on('end',   () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = 475; // 595 - 60 - 60

        // ── Company letterhead ─────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(20).fillColor(DARK)
           .text(ctx.company_name || 'Company', 60, 55);

        if (ctx.headquarters) {
            doc.font('Helvetica').fontSize(9).fillColor(MID)
               .text(ctx.headquarters, 60, 80);
        }

        // Date (right side)
        doc.font('Helvetica').fontSize(9).fillColor(MID)
           .text(fmtDate(offer.created_at || new Date()), 60, 55, { width: W, align: 'right' });

        hRule(doc, 100, BRAND);

        // Ladder facilitator note
        doc.font('Helvetica').fontSize(7.5).fillColor(LIGHT)
           .text('Facilitated by LadderStep Human Consulting · Professional Recruitment & HR Services', 60, 106, { width: W, align: 'right' });

        // ── Addressee ────────────────────────────────────────────────────────────
        let y = 135;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
           .text(ctx.candidate_name || 'Candidate', 60, y);
        y += 16;
        if (ctx.candidate_email) {
            doc.font('Helvetica').fontSize(9).fillColor(MID)
               .text(ctx.candidate_email, 60, y);
            y += 14;
        }

        y += 18;

        // ── Subject line ──────────────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
           .text(`Subject: Offer of Employment — ${ctx.job_title}`, 60, y);
        y += 22;

        // ── Salutation ────────────────────────────────────────────────────────────
        const firstName = (ctx.candidate_name || 'Candidate').split(' ')[0];
        doc.font('Helvetica').fontSize(10).fillColor(DARK)
           .text(`Dear ${firstName},`, 60, y);
        y += 22;

        // ── Opening paragraph ─────────────────────────────────────────────────────
        const openingText =
            `We are pleased to extend an offer of employment to you for the position of ` +
            `${ctx.job_title} at ${ctx.company_name}. After a careful review of your ` +
            `qualifications and interview performance, we are confident that you will be a ` +
            `valuable addition to our team.`;

        doc.font('Helvetica').fontSize(10).fillColor(DARK)
           .text(openingText, 60, y, { width: W, lineGap: 3, align: 'justify' });
        y += doc.heightOfString(openingText, { width: W, lineGap: 3 }) + 20;

        // ── Offer details table ───────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(9).fillColor(LIGHT)
           .text('OFFER DETAILS', 60, y);
        y += 14;

        hRule(doc, y);
        y += 10;

        const rows = [
            { label: 'Position',       value: ctx.job_title },
            { label: 'Company',        value: ctx.company_name },
            offer.ctc       ? { label: 'Annual CTC',      value: fmtINR(offer.ctc), highlight: true } : null,
            offer.joining_date ? { label: 'Joining Date', value: fmtDate(offer.joining_date) } : null,
            offer.valid_until  ? { label: 'Offer Valid Until', value: fmtDate(offer.valid_until) } : null,
            ctx.job_type    ? { label: 'Employment Type', value: ctx.job_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) } : null,
        ].filter(Boolean);

        for (const row of rows) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(MID)
               .text(row.label, 60, y, { width: 160 });
            doc.font(row.highlight ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(9)
               .fillColor(row.highlight ? BRAND : DARK)
               .text(row.value, 230, y, { width: W - 170 });
            y += 18;
        }

        hRule(doc, y);
        y += 18;

        // ── Additional notes ──────────────────────────────────────────────────────
        if (offer.notes && offer.notes.trim()) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(LIGHT)
               .text('ADDITIONAL NOTES', 60, y);
            y += 14;
            doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
               .text(offer.notes.trim(), 60, y, { width: W, lineGap: 3 });
            y += doc.heightOfString(offer.notes.trim(), { width: W, lineGap: 3 }) + 18;
        }

        // ── Standard terms ────────────────────────────────────────────────────────
        const terms = [
            'This offer is subject to satisfactory completion of background verification and reference checks.',
            'This letter constitutes the entire offer and supersedes any previous verbal or written communications.',
            'Please confirm your acceptance by responding through the Candidate Portal before the offer expiry date.',
        ];

        doc.font('Helvetica-Bold').fontSize(9).fillColor(LIGHT)
           .text('TERMS & CONDITIONS', 60, y);
        y += 14;

        for (const term of terms) {
            // bullet
            doc.circle(67, y + 4, 2).fill(LIGHT);
            doc.font('Helvetica').fontSize(8.5).fillColor(MID)
               .text(term, 78, y, { width: W - 18, lineGap: 2 });
            y += doc.heightOfString(term, { width: W - 18, lineGap: 2 }) + 8;
        }

        y += 10;

        // ── Closing ───────────────────────────────────────────────────────────────
        doc.font('Helvetica').fontSize(10).fillColor(DARK)
           .text('We look forward to welcoming you to the team. Please do not hesitate to reach out should you have any questions.', 60, y, { width: W, lineGap: 3, align: 'justify' });
        y += 36;

        doc.font('Helvetica').fontSize(10).fillColor(DARK)
           .text('Yours sincerely,', 60, y);
        y += 40;

        // Signature line
        doc.moveTo(60, y).lineTo(220, y).strokeColor(RULE).lineWidth(0.8).stroke();
        y += 8;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
           .text(ctx.company_name, 60, y);
        y += 14;
        doc.font('Helvetica').fontSize(8.5).fillColor(MID)
           .text('Authorised Signatory', 60, y);
        if (ctx.issued_by_name) {
            y += 13;
            doc.font('Helvetica').fontSize(8.5).fillColor(LIGHT)
               .text(`Offer issued by: ${ctx.issued_by_name}`, 60, y);
        }

        // ── Footer ────────────────────────────────────────────────────────────────
        const footerY = 775;
        hRule(doc, footerY - 8, BRAND);
        doc.font('Helvetica').fontSize(7.5).fillColor(LIGHT)
           .text(
               'Facilitated by LadderStep Human Consulting · contact@ladder-consulting.in · This is a computer-generated offer letter.',
               60, footerY, { width: W, align: 'center' }
           );

        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.font('Helvetica').fontSize(7).fillColor(LIGHT)
               .text(`Page ${i + 1} of ${range.count}`, 60, footerY + 12, { width: W, align: 'right' });
        }

        doc.end();
    });
}

module.exports = { generateOfferLetterPDF };
