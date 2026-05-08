const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadToS3, getPresignedUrl } = require('../utils/s3');
const { parseResumeText } = require('../utils/aiParser');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF and DOCX allowed'));
    },
});

// ── Helper: recalculate profile completeness ─────────────────────────────────
const updateCompleteness = async (userId) => {
    const [profile] = await db.query(
        'SELECT * FROM candidate_profiles WHERE user_id = ?', [userId]
    );
    const [edu] = await db.query(
        'SELECT COUNT(*) as cnt FROM candidate_education WHERE user_id = ?', [userId]
    );
    const [exp] = await db.query(
        'SELECT COUNT(*) as cnt FROM candidate_experience WHERE user_id = ?', [userId]
    );
    const [skills] = await db.query(
        'SELECT COUNT(*) as cnt FROM candidate_skills WHERE user_id = ?', [userId]
    );
    const [resume] = await db.query(
        'SELECT id FROM resumes WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );

    const p = profile[0] || {};
    let score = 0;
    if (p.full_name) score += 15;
    if (p.phone) score += 10;
    if (p.location) score += 5;
    if (p.summary) score += 10;
    if (edu[0].cnt > 0) score += 15;
    if (exp[0].cnt > 0) score += 20;
    if (skills[0].cnt > 0) score += 15;
    if (resume[0]) score += 10;

    await db.query(
        'UPDATE candidate_profiles SET profile_complete_pct = ? WHERE user_id = ?',
        [score, userId]
    );
    return score;
};

// POST /api/candidates/profile
router.post('/profile', authenticate, authorize('candidate'), async (req, res) => {
    const userId = req.user.id;
    const {
        full_name, phone, location, linkedin_url, portfolio_url, summary,
        total_experience, current_salary, expected_salary, notice_period,
        education, // array
        experience, // array
    } = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
      INSERT INTO candidate_profiles
        (user_id, full_name, phone, location, linkedin_url, portfolio_url,
         summary, total_experience, current_salary, expected_salary, notice_period)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name=VALUES(full_name), phone=VALUES(phone), location=VALUES(location),
        linkedin_url=VALUES(linkedin_url), portfolio_url=VALUES(portfolio_url),
        summary=VALUES(summary), total_experience=VALUES(total_experience),
        current_salary=VALUES(current_salary), expected_salary=VALUES(expected_salary),
        notice_period=VALUES(notice_period)
    `, [userId, full_name, phone, location, linkedin_url, portfolio_url,
            summary, total_experience, current_salary, expected_salary, notice_period]);

        if (Array.isArray(education)) {
            await conn.query('DELETE FROM candidate_education WHERE user_id = ?', [userId]);
            for (const edu of education) {
                await conn.query(
                    `INSERT INTO candidate_education
           (user_id, degree, institution, field, start_year, end_year, grade)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, edu.degree, edu.institution, edu.field,
                        edu.start_year, edu.end_year, edu.grade]
                );
            }
        }

        if (Array.isArray(experience)) {
            await conn.query('DELETE FROM candidate_experience WHERE user_id = ?', [userId]);
            for (const exp of experience) {
                await conn.query(
                    `INSERT INTO candidate_experience
           (user_id, company, title, start_date, end_date, is_current, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, exp.company, exp.title, exp.start_date,
                        exp.end_date || null, exp.is_current ? 1 : 0, exp.description]
                );
            }
        }

        await conn.commit();
        const pct = await updateCompleteness(userId);
        res.json({ message: 'Profile saved', profile_complete_pct: pct });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to save profile' });
    } finally {
        conn.release();
    }
});

// GET /api/candidates/profile
router.get('/profile', authenticate, authorize('candidate'), async (req, res) => {
    const userId = req.user.id;
    const [profile] = await db.query(
        'SELECT * FROM candidate_profiles WHERE user_id = ?', [userId]
    );
    const [education] = await db.query(
        'SELECT * FROM candidate_education WHERE user_id = ?', [userId]
    );
    const [experience] = await db.query(
        'SELECT * FROM candidate_experience WHERE user_id = ?', [userId]
    );
    const [skills] = await db.query(
        `SELECT cs.*, st.name as skill_name FROM candidate_skills cs
     JOIN skill_tags st ON st.id = cs.skill_id WHERE cs.user_id = ?`, [userId]
    );
    const [resume] = await db.query(
        'SELECT id, original_name, created_at, parsed FROM resumes WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );

    res.json({
        profile: profile[0] || null,
        education,
        experience,
        skills,
        resume: resume[0] || null,
    });
});

// POST /api/candidates/resume
router.post('/resume', authenticate, authorize('candidate'), upload.single('resume'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId = req.user.id;
    const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const s3Key = `resumes/${userId}/${uuidv4()}.${ext}`;

    try {
        await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

        await db.query(
            `INSERT INTO resumes (user_id, s3_key, original_name, file_size)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         s3_key=VALUES(s3_key), original_name=VALUES(original_name),
         file_size=VALUES(file_size), parsed=0, parsed_at=NULL, raw_text=NULL, deleted_at=NULL`,
            [userId, s3Key, req.file.originalname, req.file.size]
        );

        await updateCompleteness(userId);
        res.json({ message: 'Resume uploaded', s3_key: s3Key });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// POST /api/candidates/resume/parse
router.post('/resume/parse', authenticate, authorize('candidate'), async (req, res) => {
    const userId = req.user.id;
    const [rows] = await db.query(
        'SELECT * FROM resumes WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No resume found' });

    const resumeRow = rows[0];

    try {
        // Extract raw text from S3 object
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../utils/s3');
        const s3Obj = await s3.send(new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: resumeRow.s3_key,
        }));

        const chunks = [];
        for await (const chunk of s3Obj.Body) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        let rawText = '';
        if (resumeRow.s3_key.endsWith('.pdf')) {
            const parsed = await pdfParse(buffer);
            rawText = parsed.text;
        } else {
            const result = await mammoth.extractRawText({ buffer });
            rawText = result.value;
        }

        const aiResult = await parseResumeText(rawText);

        // Upsert skills from AI
        const insertedSkills = [];
        for (const skillName of aiResult.skills) {
            const normalized = skillName.trim().toLowerCase();
            if (!normalized) continue;

            // Upsert skill_tags
            await db.query(
                'INSERT IGNORE INTO skill_tags (name) VALUES (?)', [normalized]
            );
            const [tagRows] = await db.query(
                'SELECT id FROM skill_tags WHERE name = ?', [normalized]
            );
            const skillId = tagRows[0].id;

            await db.query(
                `INSERT INTO candidate_skills (user_id, skill_id, source)
         VALUES (?, ?, 'parsed')
         ON DUPLICATE KEY UPDATE source='parsed'`,
                [userId, skillId]
            );
            insertedSkills.push({ id: skillId, name: normalized });
        }

        // Save raw text + parsed state
        await db.query(
            'UPDATE resumes SET raw_text = ?, parsed = 1, parsed_at = NOW() WHERE user_id = ?',
            [rawText, userId]
        );

        // Update experience years if extracted
        if (aiResult.experience_years) {
            await db.query(
                'UPDATE candidate_profiles SET total_experience = ?, summary = COALESCE(NULLIF(summary,""), ?) WHERE user_id = ?',
                [aiResult.experience_years, aiResult.summary, userId]
            );
        }

        await updateCompleteness(userId);

        res.json({
            message: 'Resume parsed successfully',
            skills: insertedSkills,
            experience_years: aiResult.experience_years,
            summary: aiResult.summary,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Parsing failed' });
    }
});

module.exports = router;