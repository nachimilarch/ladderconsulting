const fs   = require('fs');
const path = require('path');
const pdfParse  = require('pdf-parse');
const mammoth   = require('mammoth');
const PDFDocument = require('pdfkit');
const { applyPIIPatterns } = require('../utils/maskPII');

// ── Text sanitisation (applied BEFORE PII masking) ───────────────────────────
// Normalises PDF artefacts so the masking regexes see predictable ASCII text.
function sanitizeText(text) {
    return text
        // PDF ligature glyphs → ASCII equivalents
        .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
        .replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬅ/g, 'ft').replace(/ﬆ/g, 'st')

        // Smart quotes and typographic dashes
        .replace(/['']/g, "'").replace(/[""]/g, '"')
        .replace(/[–—]/g, '-').replace(/•/g, '*').replace(/…/g, '...')
        .replace(/ /g, ' ')  // non-breaking space

        // Strip non-printable / binary garbage — keep basic Latin, Extended Latin, Devanagari
        .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code >= 0x00C0 && code <= 0x024F) return char; // Latin Extended-A/B
            if (code >= 0x0900 && code <= 0x097F) return char; // Devanagari
            return ' ';
        })

        // Collapse excessive whitespace / blank lines
        .replace(/\t+/g, ' ')
        .replace(/[ \t]{3,}/g, '  ')
        .replace(/\n{4,}/g, '\n\n\n')

        // Remove zero-width and soft-hyphen characters
        .replace(/[​-‍﻿­]/g, '')

        .trim();
}

// ── Candidate name → initials (for name-based masking in resume body) ─────────
function nameToInitials(fullName) {
    if (!fullName) return null;
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase() + '.';
    return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}`;
}

// ── Mask candidate's own name in the resume text ─────────────────────────────
function maskCandidateName(text, candidateName) {
    if (!candidateName) return text;
    const initials = nameToInitials(candidateName);
    const nameParts = candidateName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
        const escaped = nameParts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(escaped.join('[\\s]+'), 'gi');
        return text.replace(regex, initials);
    }
    return text;
}

// ── Full masking pipeline: sanitise → mask name → apply PII patterns ──────────
function maskText(rawText, candidateName) {
    const sanitized    = sanitizeText(rawText);
    const namesMasked  = maskCandidateName(sanitized, candidateName);
    return applyPIIPatterns(namesMasked);
}

// ── Extract raw text from a resume file (PDF or DOCX) ────────────────────────
async function extractText(filePath) {
    const ext    = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    if (ext === '.pdf') {
        // Custom renderer that preserves line breaks by tracking y-position.
        // item.transform is a 6-element matrix; index 5 is the y-coordinate.
        const data = await pdfParse(buffer, {
            pagerender(pageData) {
                return pageData.getTextContent({
                    normalizeWhitespace: true,
                    disableCombineTextItems: false,
                }).then((tc) => {
                    let text   = '';
                    let lastY  = null;
                    for (const item of tc.items) {
                        const y = item.transform[5];
                        if (lastY !== null && Math.abs(y - lastY) > 5) text += '\n';
                        text  += item.str + ' ';
                        lastY  = y;
                    }
                    return text;
                });
            },
        });
        return data.text;
    }

    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }

    throw new Error(`Unsupported resume format: ${ext}. Only PDF and DOCX are accepted.`);
}

// ── Build a masked PDF with pdfkit ───────────────────────────────────────────
// Uses bufferPages:true so watermarks are stamped after content is written,
// avoiding the infinite-recursion bug that occurs with doc.on('pageAdded').
async function generateMaskedResumePDF(originalFilePath, candidateName) {
    let rawText;
    try {
        rawText = await extractText(originalFilePath);
    } catch (extractErr) {
        throw new Error(`Cannot extract text from resume: ${extractErr.message}`);
    }

    const maskedText = maskText(rawText, candidateName);

    // Sanity-check: if the masked text is suspiciously short the extraction
    // probably failed — block the download rather than serve a blank PDF.
    if (maskedText.trim().length < 50) {
        throw new Error('Extracted text is too short; the resume file may be image-only or corrupted. Download blocked for safety.');
    }

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 55, bottom: 50, left: 50, right: 50 },
            bufferPages: true, // hold all pages in memory so we can revisit them
        });

        const chunks = [];
        doc.on('data',  c  => chunks.push(c));
        doc.on('end',   () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const CONTENT_WIDTH = doc.page.width - 100; // 595 - 100 = 495 pts
        const SECTION_CLR   = '#1F2937';
        const BODY_CLR      = '#333333';
        const WATERMARK_CLR = '#9CA3AF';
        const HEADER_TXT    = 'CONFIDENTIAL — Shared by LadderStep Human Consulting | Contact info has been redacted';
        const FOOTER_PREFIX = 'To contact this candidate, reach LadderStep Human Consulting — contact@ladder-consulting.in';

        // ── Write content (no watermarks yet) ──────────────────────────────────
        const lines = maskedText.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.length === 0) {
                if (doc.y < doc.page.height - 80) doc.moveDown(0.25);
                continue;
            }

            // Heuristic: ALL-CAPS short line without a year → section heading
            const isSectionHead =
                trimmed.length > 2 &&
                trimmed.length < 50 &&
                trimmed === trimmed.toUpperCase() &&
                /[A-Z]/.test(trimmed) &&
                !/\d{4}/.test(trimmed);

            try {
                if (isSectionHead) {
                    doc.moveDown(0.5)
                       .font('Helvetica-Bold').fontSize(11).fillColor(SECTION_CLR)
                       .text(trimmed, { width: CONTENT_WIDTH })
                       .moveDown(0.2);

                    doc.moveTo(50, doc.y).lineTo(545, doc.y)
                       .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
                    doc.moveDown(0.2);
                } else {
                    doc.font('Helvetica').fontSize(9.5).fillColor(BODY_CLR)
                       .text(trimmed, { width: CONTENT_WIDTH, lineGap: 1.5 });
                }
            } catch (lineErr) {
                // Skip lines pdfkit cannot render rather than crashing the whole PDF
                console.warn('[maskedResume] Skipped line:', lineErr.message);
            }
        }

        // ── Stamp header + footer on every buffered page ─────────────────────
        const range      = doc.bufferedPageRange();
        const totalPages = range.count;

        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(range.start + i);

            // Header watermark
            doc.save()
               .font('Helvetica').fontSize(7).fillColor(WATERMARK_CLR)
               .text(HEADER_TXT, 50, 18, { width: CONTENT_WIDTH, align: 'left' })
               .restore();

            // Separator under header
            doc.save()
               .moveTo(50, 30).lineTo(545, 30)
               .strokeColor('#E5E7EB').lineWidth(0.5).stroke()
               .restore();

            // Footer separator
            doc.save()
               .moveTo(50, doc.page.height - 38).lineTo(545, doc.page.height - 38)
               .strokeColor('#E5E7EB').lineWidth(0.5).stroke()
               .restore();

            // Footer text
            const footerTxt = `${FOOTER_PREFIX}  |  Page ${i + 1} of ${totalPages}`;
            doc.save()
               .font('Helvetica').fontSize(7).fillColor(WATERMARK_CLR)
               .text(footerTxt, 50, doc.page.height - 28,
                     { width: CONTENT_WIDTH, align: 'center', lineBreak: false })
               .restore();
        }

        doc.end();
    });
}

// ── Disk-cache: avoid regenerating on every download ─────────────────────────
async function getMaskedResumePath(originalFilePath, candidateName, candidateId) {
    const cacheDir = path.join(process.cwd(), 'uploads', 'masked_resumes');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const cachePath    = path.join(cacheDir, `masked_${candidateId}.pdf`);
    const originalStat = fs.statSync(originalFilePath);
    const cacheExists  = fs.existsSync(cachePath);
    const cacheStat    = cacheExists ? fs.statSync(cachePath) : null;

    if (cacheExists && cacheStat.mtime > originalStat.mtime) {
        return cachePath;
    }

    const maskedPDF = await generateMaskedResumePDF(originalFilePath, candidateName);
    fs.writeFileSync(cachePath, maskedPDF);
    return cachePath;
}

module.exports = { generateMaskedResumePDF, getMaskedResumePath };
