const fs = require('fs');
const path = require('path');
// Single shared skill dictionary lives in resumeParser — keep one source of truth
const { extractSkills: extractSkillsDict } = require('../utils/resumeParser');

async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    if (ext === '.pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text;
    } else if (ext === '.docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    return '';
}

async function extractSkills(filePath) {
    try {
        const text = await extractTextFromFile(filePath);
        return extractSkillsFromText(text);
    } catch (err) {
        console.error('[SkillExtractor] Error:', err.message);
        return [];
    }
}

function extractSkillsFromText(text) {
    if (!text) return [];
    return extractSkillsDict(text); // canonical lowercase skill names
}

module.exports = { extractSkills, extractSkillsFromText };
