/**
 * Invoice PDF generator — uses pdfkit (already installed).
 * Returns a Buffer containing the A4 PDF.
 */
const PDFDocument = require('pdfkit');

const BRAND   = [106, 71, 212];   // #6a47d4 — Ladder Violet
const DARK    = [17,  24,  39];   // gray-900
const MID     = [75,  85,  99];   // gray-600
const LIGHT   = [156, 163, 175];  // gray-400
const RULE    = [229, 231, 235];  // gray-200
const SUCCESS = [22, 163, 74];    // green-600
const WARNING = [234, 88, 12];    // orange-600

const fmtINR = (n) =>
    `INR ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const statusLabel = (s) => ({
    pending:        'PENDING',
    partially_paid: 'PARTIALLY PAID',
    paid:           'PAID',
    overdue:        'OVERDUE',
    cancelled:      'CANCELLED',
    waived:         'WAIVED',
}[s] || (s || '').toUpperCase());

const statusColor = (s) => ({
    pending:        WARNING,
    partially_paid: BRAND,
    paid:           SUCCESS,
    overdue:        [220, 38, 38],
    cancelled:      LIGHT,
    waived:         LIGHT,
}[s] || LIGHT);

function hRule(doc, y, color = RULE) {
    doc.save()
       .moveTo(50, y).lineTo(545, y)
       .strokeColor(color).lineWidth(0.5).stroke()
       .restore();
}

/**
 * @param {Object} inv  - invoice row + transactions array from the DB
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF(inv) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            bufferPages: true,
            info: {
                Title: `Invoice ${inv.invoice_number}`,
                Author: 'LadderStep Human Consulting',
                Subject: 'Service Invoice',
            },
        });

        const chunks = [];
        doc.on('data',  c  => chunks.push(c));
        doc.on('end',   () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = 495; // usable width (595 - 50 - 50)

        // ── Header bar ──────────────────────────────────────────────────────────
        doc.rect(50, 50, W, 70).fill(BRAND);

        doc.font('Helvetica-Bold').fontSize(20).fillColor('white')
           .text('LADDER CONSULTING', 65, 65, { width: 280 });

        doc.font('Helvetica').fontSize(8).fillColor([200, 190, 240])
           .text('Professional Recruitment & HR Services', 65, 88);

        doc.font('Helvetica').fontSize(8).fillColor('white')
           .text('contact@ladder-consulting.in', 380, 72, { align: 'right', width: 150 })
           .text('www.ladderconsulting.in',       380, 85, { align: 'right', width: 150 });

        // ── Invoice label + number ──────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(24).fillColor(DARK)
           .text('INVOICE', 50, 138);

        doc.font('Helvetica').fontSize(10).fillColor(MID)
           .text(`# ${inv.invoice_number}`, 50, 168);

        // Dates (right-aligned block)
        const dateColX = 370;
        doc.font('Helvetica').fontSize(9).fillColor(LIGHT)
           .text('Date Issued',  dateColX, 138, { width: 175, align: 'right' })
           .text('Due Date',     dateColX, 153, { width: 175, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
           .text(fmtDate(inv.created_at), dateColX, 138, { width: 175, align: 'right' })
           .text(fmtDate(inv.due_date),   dateColX, 153, { width: 175, align: 'right' });

        // Status badge
        const stColor = statusColor(inv.status);
        const stLabel = statusLabel(inv.status);
        doc.rect(dateColX, 170, 175, 18).fill(stColor);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
           .text(stLabel, dateColX, 175, { width: 175, align: 'center' });

        hRule(doc, 200);

        // ── Bill To ──────────────────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(8).fillColor(LIGHT)
           .text('BILL TO', 50, 212);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
           .text(inv.company_name || 'Company', 50, 224);
        if (inv.company_email) {
            doc.font('Helvetica').fontSize(9).fillColor(MID)
               .text(inv.company_email, 50, 239);
        }

        // ── Invoice type label ────────────────────────────────────────────────────
        const typeLabel = ({
            placement_fee:   'Placement Fee',
            partial_payment: 'Partial Payment',
            other_fee:       'Professional Services',
        })[inv.invoice_type] || 'Service Fee';

        doc.font('Helvetica-Bold').fontSize(8).fillColor(LIGHT)
           .text('INVOICE TYPE', 370, 212, { width: 175, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND)
           .text(typeLabel, 370, 224, { width: 175, align: 'right' });

        // ── Description table ────────────────────────────────────────────────────
        let y = 275;
        hRule(doc, y - 8);

        // Table header
        doc.rect(50, y, W, 22).fill([247, 246, 254]);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND)
           .text('DESCRIPTION', 60, y + 7)
           .text('AMOUNT',      440, y + 7, { width: 95, align: 'right' });

        y += 30;

        // Description row
        let descLine1 = '';
        let descLine2 = '';
        let descLine3 = '';

        if (inv.invoice_type === 'placement_fee' && (inv.candidate_name || inv.job_title)) {
            descLine1 = `Recruitment & Placement Fee`;
            if (inv.candidate_name) descLine2 = `Candidate: ${inv.candidate_name}`;
            if (inv.job_title)      descLine3 = `Position: ${inv.job_title}`;
        } else {
            descLine1 = inv.description || typeLabel;
        }

        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
           .text(descLine1, 60, y);
        y += 15;
        if (descLine2) {
            doc.font('Helvetica').fontSize(9).fillColor(MID).text(descLine2, 60, y);
            y += 13;
        }
        if (descLine3) {
            doc.font('Helvetica').fontSize(9).fillColor(MID).text(descLine3, 60, y);
            y += 13;
        }
        if (inv.notes) {
            doc.font('Helvetica').fontSize(8).fillColor(LIGHT).text(inv.notes, 60, y, { width: 300 });
            y += doc.heightOfString(inv.notes, { width: 300, fontSize: 8 }) + 4;
        }

        // Amount on the right, aligned with first description line
        doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
           .text(fmtINR(inv.amount), 440, y - (descLine2 ? 28 : 15) - (descLine3 ? 13 : 0), { width: 95, align: 'right' });

        y += 15;
        hRule(doc, y);

        // ── Totals block ──────────────────────────────────────────────────────────
        y += 12;
        const outstanding = Math.max(parseFloat(inv.amount || 0) - parseFloat(inv.amount_paid || 0), 0);

        const totals = [
            { label: 'Subtotal',      value: fmtINR(inv.amount),      bold: false },
            { label: 'Amount Paid',   value: fmtINR(inv.amount_paid), bold: false, color: SUCCESS },
        ];
        if (inv.status !== 'paid') {
            totals.push({ label: 'Balance Due', value: fmtINR(outstanding), bold: true, color: outstanding > 0 ? WARNING : SUCCESS });
        }

        for (const row of totals) {
            doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(row.bold ? 11 : 9)
               .fillColor(row.color || MID)
               .text(row.label, 310, y, { width: 135 });
            doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(row.bold ? 11 : 9)
               .fillColor(row.color || DARK)
               .text(row.value, 310, y, { width: 225, align: 'right' });
            y += row.bold ? 18 : 15;
        }

        // ── Payment history ────────────────────────────────────────────────────────
        const txns = Array.isArray(inv.transactions) ? inv.transactions.filter(t => t.status === 'completed') : [];
        if (txns.length > 0) {
            y += 10;
            hRule(doc, y);
            y += 12;

            doc.font('Helvetica-Bold').fontSize(8).fillColor(LIGHT)
               .text('PAYMENT HISTORY', 50, y);
            y += 16;

            for (const t of txns) {
                doc.font('Helvetica').fontSize(8.5).fillColor(MID)
                   .text(fmtDate(t.completed_at || t.initiated_at), 55, y, { width: 130 });
                doc.font('Helvetica').fontSize(8.5).fillColor(DARK)
                   .text(fmtINR(t.amount), 185, y, { width: 110 });
                const method = (t.payment_method || '').toUpperCase().replace('_', ' ');
                doc.font('Helvetica').fontSize(8.5).fillColor(MID)
                   .text(method, 295, y, { width: 100 });
                if (t.transaction_id || t.cashfree_payment_id) {
                    doc.font('Helvetica').fontSize(7.5).fillColor(LIGHT)
                       .text(`Ref: ${t.cashfree_payment_id || t.transaction_id}`, 395, y, { width: 140, align: 'right' });
                }
                y += 14;
            }
        }

        // ── Footer ────────────────────────────────────────────────────────────────
        const footerY = 760;
        hRule(doc, footerY - 8, BRAND);
        doc.font('Helvetica').fontSize(7.5).fillColor(LIGHT)
           .text(
               'LadderStep Human Consulting · contact@ladder-consulting.in · This is a computer-generated invoice.',
               50, footerY, { width: W, align: 'center' }
           );

        // Page numbers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.font('Helvetica').fontSize(7).fillColor(LIGHT)
               .text(`Page ${i + 1} of ${range.count}`, 50, footerY + 12, { width: W, align: 'right' });
        }

        doc.end();
    });
}

module.exports = { generateInvoicePDF };
