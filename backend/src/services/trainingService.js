const db = require('../config/db');
const { uploadToS3, getPresignedUrl } = require('../utils/s3');
const { sendEmail } = require('../utils/email');
const axios = require('axios');

const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));
const getKey = () => process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
const getModel = () => process.env.AI_MATCH_MODEL || 'gpt-4o-mini';

async function callAI(systemPrompt, userContent) {
    const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: getModel(),
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 800,
        },
        { headers: { Authorization: `Bearer ${getKey()}` }, timeout: 30000 }
    );
    return JSON.parse(res.data.choices[0].message.content);
}

// ── 1. Auto-assign training courses for a new hire ────────────────────────────
async function triggerOnboardingForHire(hiredEmployeeId) {
    const [[hire]] = await db.query(
        `SELECT he.id, he.candidate_id, he.company_id, he.role_title,
                u.name AS candidate_name, u.email AS candidate_email
         FROM hired_employees he
         JOIN candidates c ON c.id = he.candidate_id
         JOIN users u ON u.id = c.user_id
         WHERE he.id = ? AND he.deleted_at IS NULL`,
        [hiredEmployeeId]
    );
    if (!hire) return 0;

    const [candidateSkills] = await db.query(
        'SELECT skill_tag_id FROM candidate_skill_vectors WHERE candidate_id = ?',
        [hire.candidate_id]
    );
    const candidateSkillIds = new Set(candidateSkills.map(s => s.skill_tag_id));

    const [benchmarks] = await db.query(
        'SELECT skill_tag_id FROM role_benchmarks WHERE LOWER(role_title) = LOWER(?)',
        [hire.role_title || '']
    );

    let coursesToAssign = [];

    if (benchmarks.length === 0) {
        // No benchmark: assign the first published onboarding course
        const [defaultCourses] = await db.query(
            `SELECT id FROM courses WHERE is_published = 1 AND deleted_at IS NULL
             ORDER BY created_at ASC LIMIT 3`
        );
        coursesToAssign = defaultCourses.map(c => ({ id: c.id, type: 'onboarding' }));
    } else {
        const gapSkillIds = benchmarks
            .map(b => b.skill_tag_id)
            .filter(id => !candidateSkillIds.has(id));

        const targetIds = gapSkillIds.length > 0 ? gapSkillIds : benchmarks.map(b => b.skill_tag_id).slice(0, 3);
        const placeholders = targetIds.map(() => '?').join(',');

        const [courses] = await db.query(
            `SELECT id FROM courses
             WHERE skill_tag_id IN (${placeholders}) AND is_published = 1 AND deleted_at IS NULL
             LIMIT 5`,
            targetIds
        );
        const assignType = gapSkillIds.length > 0 ? 'skill_gap' : 'onboarding';
        coursesToAssign = courses.map(c => ({ id: c.id, type: assignType }));
    }

    let assignedCount = 0;
    for (const course of coursesToAssign) {
        const [existing] = await db.query(
            `SELECT id FROM training_assignments
             WHERE hired_employee_id = ? AND course_id = ? AND deleted_at IS NULL`,
            [hiredEmployeeId, course.id]
        );
        if (existing.length) continue;

        await db.query(
            `INSERT INTO training_assignments (hired_employee_id, course_id, assignment_type, status)
             VALUES (?, ?, ?, 'assigned')`,
            [hiredEmployeeId, course.id, course.type]
        );
        assignedCount++;
    }

    await db.query(
        'UPDATE hired_employees SET onboarding_started = 1 WHERE id = ?',
        [hiredEmployeeId]
    );

    safeEmail({
        to: hire.candidate_email,
        subject: 'Your Training Plan is Ready — LadderStep Human Consulting',
        html: `
            <p>Hi ${hire.candidate_name},</p>
            <p>Welcome aboard! Your personalized training plan has been set up for your role as <strong>${hire.role_title || 'your new position'}</strong>.</p>
            <p>You have been assigned <strong>${assignedCount} course${assignedCount !== 1 ? 's' : ''}</strong> to complete as part of your onboarding.</p>
            <p>Log in to your <strong>Candidate Portal → Training</strong> to get started.</p>
            <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
        `,
    });

    const [hrUsers] = await db.query(
        `SELECT u.email FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('hr_staff', 'admin') AND u.status = 'active' AND u.deleted_at IS NULL`
    );
    for (const hr of hrUsers) {
        safeEmail({
            to: hr.email,
            subject: `Training Assigned — ${hire.candidate_name}`,
            html: `
                <p>Hi Team,</p>
                <p><strong>${hire.candidate_name}</strong> has been assigned <strong>${assignedCount} training course${assignedCount !== 1 ? 's' : ''}</strong> for the role of <strong>${hire.role_title || 'N/A'}</strong>.</p>
                <p>View progress in <strong>Admin Panel → Training Manager</strong>.</p>
                <br/><p>LadderStep Human Consulting System</p>
            `,
        });
    }

    console.log(`[Training] Assigned ${assignedCount} courses for hire ${hiredEmployeeId}`);
    return assignedCount;
}

// ── 2. Generate and store a PDF certificate ───────────────────────────────────
async function generateCertificate(hiredEmployeeId, courseId, assignmentId) {
    const [existing] = await db.query(
        `SELECT id, certificate_key FROM certificates
         WHERE assignment_id = ? AND deleted_at IS NULL`,
        [assignmentId]
    );
    if (existing.length) {
        const url = await getPresignedUrl(existing[0].certificate_key, 7 * 24 * 3600);
        return { certId: existing[0].id, certUrl: url };
    }

    const [[ctx]] = await db.query(
        `SELECT u.name AS candidate_name, co.title AS course_title, he.role_title
         FROM training_assignments ta
         JOIN hired_employees he ON he.id = ta.hired_employee_id
         JOIN candidates c ON c.id = he.candidate_id
         JOIN users u ON u.id = c.user_id
         JOIN courses co ON co.id = ta.course_id
         WHERE ta.id = ?`,
        [assignmentId]
    );
    if (!ctx) return null;

    const PDFDocument = require('pdfkit');
    const certRef = `CERT-${Date.now()}-${assignmentId}`;

    const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = doc.page.width;
        const H = doc.page.height;

        doc.rect(0, 0, W, H).fill('#f8faff');
        doc.rect(30, 30, W - 60, H - 60).lineWidth(3).stroke('#4f46e5');

        doc.fillColor('#4f46e5')
           .fontSize(30).font('Helvetica-Bold')
           .text('LADDER CONSULTING', 0, 65, { align: 'center' });

        doc.fillColor('#6b7280')
           .fontSize(14).font('Helvetica')
           .text('Certificate of Completion', 0, 108, { align: 'center' });

        doc.moveTo(100, 138).lineTo(W - 100, 138).lineWidth(1).stroke('#e5e7eb');

        doc.fillColor('#374151').fontSize(15).font('Helvetica')
           .text('This is to certify that', 0, 168, { align: 'center' });

        doc.fillColor('#111827').fontSize(26).font('Helvetica-Bold')
           .text(ctx.candidate_name, 0, 196, { align: 'center' });

        doc.fillColor('#374151').fontSize(15).font('Helvetica')
           .text('has successfully completed', 0, 238, { align: 'center' });

        doc.fillColor('#4f46e5').fontSize(20).font('Helvetica-Bold')
           .text(ctx.course_title, 0, 264, { align: 'center' });

        const completionDate = new Date().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        });

        doc.fillColor('#6b7280').fontSize(12).font('Helvetica')
           .text(`Completed on: ${completionDate}`, 0, 310, { align: 'center' });

        doc.moveTo(100, 340).lineTo(W - 100, 340).lineWidth(1).stroke('#e5e7eb');

        doc.fillColor('#9ca3af').fontSize(10).font('Helvetica')
           .text(`Certificate ID: ${certRef}`, 0, 354, { align: 'center' });

        doc.end();
    });

    const s3Key = `certificates/${certRef}.pdf`;
    await uploadToS3(pdfBuffer, s3Key, 'application/pdf');

    const [result] = await db.query(
        `INSERT INTO certificates (hired_employee_id, course_id, assignment_id, certificate_key, issued_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [hiredEmployeeId, courseId, assignmentId, s3Key]
    );

    const certUrl = await getPresignedUrl(s3Key, 7 * 24 * 3600);

    const [[candidateInfo]] = await db.query(
        `SELECT u.name, u.email FROM hired_employees he
         JOIN candidates c ON c.id = he.candidate_id
         JOIN users u ON u.id = c.user_id
         WHERE he.id = ?`,
        [hiredEmployeeId]
    );

    if (candidateInfo) {
        safeEmail({
            to: candidateInfo.email,
            subject: `Certificate of Completion — ${ctx.course_title}`,
            html: `
                <p>Hi ${candidateInfo.name},</p>
                <p>Congratulations! You have successfully completed <strong>${ctx.course_title}</strong>.</p>
                <p><a href="${certUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Download Certificate</a></p>
                <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Certificate ID: ${certRef}</p>
                <br/><p>Keep learning!<br/>LadderStep Human Consulting Team</p>
            `,
        });
    }

    return { certId: result.insertId, certUrl };
}

// ── 3. AI training recommendations for a candidate ────────────────────────────
async function getAITrainingRecommendations(candidateId, roleTitle) {
    const [completedCourses] = await db.query(
        `SELECT co.title FROM training_assignments ta
         JOIN courses co ON co.id = ta.course_id
         JOIN hired_employees he ON he.id = ta.hired_employee_id
         WHERE he.candidate_id = ? AND ta.status = 'completed'`,
        [candidateId]
    );

    const [skills] = await db.query(
        `SELECT st.name FROM candidate_skill_vectors csv
         JOIN skill_tags st ON st.id = csv.skill_tag_id
         WHERE csv.candidate_id = ?`,
        [candidateId]
    );

    const [available] = await db.query(
        `SELECT c.id, c.title, c.description FROM courses c
         WHERE c.is_published = 1 AND c.deleted_at IS NULL LIMIT 20`
    );

    if (!available.length) return [];

    const SYSTEM = `You are a training recommendation engine for an HR platform.
Given a professional's role, current skills, and completed courses, recommend up to 3 courses from the available list.
Respond ONLY with valid JSON: { "recommendations": [{"course_id": 1, "reason": "brief reason why this course helps"}] }`;

    const userContent = `Role: ${roleTitle || 'general professional'}
Current skills: ${skills.map(s => s.name).join(', ') || 'none listed'}
Completed courses: ${completedCourses.map(c => c.title).join(', ') || 'none'}
Available courses: ${available.map(c => `[${c.id}] ${c.title}`).join(' | ')}`;

    try {
        const result = await callAI(SYSTEM, userContent);
        const recs = Array.isArray(result.recommendations) ? result.recommendations : [];
        return recs
            .filter(r => r.course_id)
            .map(r => {
                const course = available.find(c => c.id === Number(r.course_id));
                return course ? { ...course, reason: r.reason } : null;
            })
            .filter(Boolean)
            .slice(0, 3);
    } catch (err) {
        console.error('[AI Recommendations]', err.message);
        return [];
    }
}

module.exports = { triggerOnboardingForHire, generateCertificate, getAITrainingRecommendations };
