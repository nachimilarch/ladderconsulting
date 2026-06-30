const db = require('../config/db');
const trainingService = require('../services/trainingService');

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function ensureSkillTag(name) {
    const normalized = (name || '').trim().toLowerCase().substring(0, 100);
    if (!normalized) return null;
    await db.query('INSERT IGNORE INTO skill_tags (name) VALUES (?)', [normalized]);
    const [[row]] = await db.query('SELECT id FROM skill_tags WHERE name = ?', [normalized]);
    return row?.id || null;
}

// Returns hired_employee id for the logged-in candidate, or null if not hired
async function getHiredEmployeeId(userId) {
    await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
    const [[cand]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);
    if (!cand) return null;
    const [[hire]] = await db.query(
        `SELECT id, candidate_id FROM hired_employees
         WHERE candidate_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [cand.id]
    );
    return hire || null;
}

// Check if all published modules for an assignment are completed → return bool
async function checkAndCompleteAssignment(assignmentId) {
    const [[{ total, done }]] = await db.query(
        `SELECT COUNT(m.id) AS total,
                SUM(CASE WHEN mp.status = 'completed' THEN 1 ELSE 0 END) AS done
         FROM modules m
         JOIN training_assignments ta ON ta.course_id = m.course_id
         LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.assignment_id = ta.id
         WHERE ta.id = ? AND m.is_published = 1 AND m.deleted_at IS NULL`,
        [assignmentId]
    );
    if (total > 0 && Number(done) >= Number(total)) {
        await db.query(
            `UPDATE training_assignments SET status = 'completed', completed_at = NOW()
             WHERE id = ? AND status != 'completed'`,
            [assignmentId]
        );
        return true;
    }
    return false;
}

// Map 'document' to 'pdf' for DB enum compatibility
const normalizeContentType = (t) => t === 'document' ? 'pdf' : t;

// ── COURSE MANAGEMENT ─────────────────────────────────────────────────────────

exports.createCourse = async (req, res) => {
    const { title, description, roleTarget, estimatedHours, level } = req.body;
    if (!title) return res.status(400).json({ message: 'title is required.' });

    try {
        const skillTagId = roleTarget ? await ensureSkillTag(roleTarget) : null;

        const [result] = await db.query(
            `INSERT INTO courses (created_by, title, description, skill_tag_id, duration_hrs, level, is_published)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [req.user.id, title, description || null, skillTagId,
             parseFloat(estimatedHours) || null, level || 'beginner']
        );
        res.status(201).json({ message: 'Course created.', id: result.insertId });
    } catch (err) {
        console.error('createCourse:', err);
        res.status(500).json({ message: 'Failed to create course.' });
    }
};

exports.listCourses = async (req, res) => {
    try {
        const [courses] = await db.query(
            `SELECT c.id, c.title, c.description, c.duration_hrs, c.level, c.is_published, c.created_at,
                    st.name AS skill_tag,
                    COUNT(DISTINCT m.id) AS module_count
             FROM courses c
             LEFT JOIN skill_tags st ON st.id = c.skill_tag_id
             LEFT JOIN modules m ON m.course_id = c.id AND m.is_published = 1 AND m.deleted_at IS NULL
             WHERE c.deleted_at IS NULL
             GROUP BY c.id, c.title, c.description, c.duration_hrs, c.level, c.is_published, c.created_at, st.name
             ORDER BY c.created_at DESC`
        );
        res.json({ courses });
    } catch (err) {
        console.error('listCourses:', err);
        res.status(500).json({ message: 'Failed to fetch courses.' });
    }
};

exports.getCourseWithModules = async (req, res) => {
    try {
        const [[course]] = await db.query(
            `SELECT c.id, c.title, c.description, c.duration_hrs, c.level, c.is_published,
                    st.name AS skill_tag
             FROM courses c
             LEFT JOIN skill_tags st ON st.id = c.skill_tag_id
             WHERE c.id = ? AND c.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!course) return res.status(404).json({ message: 'Course not found.' });

        const [modules] = await db.query(
            `SELECT id, title, content_type, content_url, content_key, order_index, duration_mins, pass_score, is_published
             FROM modules WHERE course_id = ? AND deleted_at IS NULL ORDER BY order_index ASC`,
            [req.params.id]
        );

        res.json({ course, modules });
    } catch (err) {
        console.error('getCourseWithModules:', err);
        res.status(500).json({ message: 'Failed to fetch course.' });
    }
};

exports.updateCourse = async (req, res) => {
    const { title, description, roleTarget, estimatedHours, level, is_published } = req.body;
    try {
        const skillTagId = roleTarget != null ? await ensureSkillTag(roleTarget) : undefined;

        const fields = [];
        const vals = [];
        if (title !== undefined) { fields.push('title = ?'); vals.push(title); }
        if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
        if (skillTagId !== undefined) { fields.push('skill_tag_id = ?'); vals.push(skillTagId); }
        if (estimatedHours !== undefined) { fields.push('duration_hrs = ?'); vals.push(parseFloat(estimatedHours) || null); }
        if (level !== undefined) { fields.push('level = ?'); vals.push(level); }
        if (is_published !== undefined) { fields.push('is_published = ?'); vals.push(is_published ? 1 : 0); }

        if (!fields.length) return res.status(400).json({ message: 'No fields to update.' });

        vals.push(req.params.id);
        await db.query(
            `UPDATE courses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            vals
        );
        res.json({ message: 'Course updated.' });
    } catch (err) {
        console.error('updateCourse:', err);
        res.status(500).json({ message: 'Failed to update course.' });
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        await db.query(
            'UPDATE courses SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
            [req.params.id]
        );
        res.json({ message: 'Course deleted.' });
    } catch (err) {
        console.error('deleteCourse:', err);
        res.status(500).json({ message: 'Failed to delete course.' });
    }
};

// ── MODULE MANAGEMENT ─────────────────────────────────────────────────────────

exports.addModule = async (req, res) => {
    const { title, type, contentUrl, quizData, order, durationMins, passScore } = req.body;
    if (!title || !type) return res.status(400).json({ message: 'title and type are required.' });

    try {
        const [[course]] = await db.query(
            'SELECT id FROM courses WHERE id = ? AND deleted_at IS NULL',
            [req.params.id]
        );
        if (!course) return res.status(404).json({ message: 'Course not found.' });

        const contentType = normalizeContentType(type);
        const storedUrl = contentType === 'quiz' && quizData
            ? JSON.stringify(quizData)
            : (contentUrl || null);

        const [result] = await db.query(
            `INSERT INTO modules (course_id, title, content_type, content_url, order_index, duration_mins, pass_score, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [req.params.id, title, contentType, storedUrl,
             parseInt(order) || 0, parseInt(durationMins) || 0, parseInt(passScore) || 70]
        );
        res.status(201).json({ message: 'Module added.', id: result.insertId });
    } catch (err) {
        console.error('addModule:', err);
        res.status(500).json({ message: 'Failed to add module.' });
    }
};

exports.updateModule = async (req, res) => {
    const { title, type, contentUrl, quizData, order, durationMins, passScore, is_published } = req.body;
    try {
        const [[mod]] = await db.query(
            'SELECT id, content_type FROM modules WHERE id = ? AND deleted_at IS NULL',
            [req.params.id]
        );
        if (!mod) return res.status(404).json({ message: 'Module not found.' });

        const fields = [];
        const vals = [];
        if (title !== undefined) { fields.push('title = ?'); vals.push(title); }
        if (type !== undefined) {
            const ct = normalizeContentType(type);
            fields.push('content_type = ?'); vals.push(ct);
        }
        if (contentUrl !== undefined || quizData !== undefined) {
            const effectiveType = type ? normalizeContentType(type) : mod.content_type;
            const storedUrl = effectiveType === 'quiz' && quizData
                ? JSON.stringify(quizData)
                : (contentUrl || null);
            fields.push('content_url = ?'); vals.push(storedUrl);
        }
        if (order !== undefined) { fields.push('order_index = ?'); vals.push(parseInt(order) || 0); }
        if (durationMins !== undefined) { fields.push('duration_mins = ?'); vals.push(parseInt(durationMins) || 0); }
        if (passScore !== undefined) { fields.push('pass_score = ?'); vals.push(parseInt(passScore) || 70); }
        if (is_published !== undefined) { fields.push('is_published = ?'); vals.push(is_published ? 1 : 0); }

        if (!fields.length) return res.status(400).json({ message: 'No fields to update.' });

        vals.push(req.params.id);
        await db.query(
            `UPDATE modules SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            vals
        );
        res.json({ message: 'Module updated.' });
    } catch (err) {
        console.error('updateModule:', err);
        res.status(500).json({ message: 'Failed to update module.' });
    }
};

exports.deleteModule = async (req, res) => {
    try {
        await db.query(
            'UPDATE modules SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
            [req.params.id]
        );
        res.json({ message: 'Module deleted.' });
    } catch (err) {
        console.error('deleteModule:', err);
        res.status(500).json({ message: 'Failed to delete module.' });
    }
};

// ── ROLE BENCHMARKS ───────────────────────────────────────────────────────────

exports.createBenchmark = async (req, res) => {
    const { jobTitle, requiredSkills } = req.body;
    if (!jobTitle || !Array.isArray(requiredSkills) || !requiredSkills.length) {
        return res.status(400).json({ message: 'jobTitle and requiredSkills[] are required.' });
    }
    try {
        let inserted = 0;
        for (const skill of requiredSkills) {
            const skillName = typeof skill === 'string' ? skill : skill.name;
            const minLevel = skill.minLevel || 'intermediate';
            const skillTagId = await ensureSkillTag(skillName);
            if (!skillTagId) continue;
            await db.query(
                `INSERT INTO role_benchmarks (role_title, skill_tag_id, min_level) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE min_level = VALUES(min_level)`,
                [jobTitle, skillTagId, minLevel]
            );
            inserted++;
        }
        res.status(201).json({ message: `Benchmark created with ${inserted} skills.` });
    } catch (err) {
        console.error('createBenchmark:', err);
        res.status(500).json({ message: 'Failed to create benchmark.' });
    }
};

exports.listBenchmarks = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT rb.id, rb.role_title, rb.min_level, st.name AS skill_name, rb.created_at
             FROM role_benchmarks rb
             JOIN skill_tags st ON st.id = rb.skill_tag_id
             ORDER BY rb.role_title, st.name`
        );

        // Group by role_title in JS
        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.role_title]) {
                grouped[row.role_title] = { role_title: row.role_title, skills: [] };
            }
            grouped[row.role_title].skills.push({
                id: row.id, skill_name: row.skill_name, min_level: row.min_level,
            });
        }
        res.json({ benchmarks: Object.values(grouped) });
    } catch (err) {
        console.error('listBenchmarks:', err);
        res.status(500).json({ message: 'Failed to fetch benchmarks.' });
    }
};

exports.updateBenchmark = async (req, res) => {
    const roleTitle = decodeURIComponent(req.params.roleTitle);
    const { requiredSkills } = req.body;
    if (!Array.isArray(requiredSkills)) {
        return res.status(400).json({ message: 'requiredSkills[] is required.' });
    }
    try {
        await db.query('DELETE FROM role_benchmarks WHERE LOWER(role_title) = LOWER(?)', [roleTitle]);
        let inserted = 0;
        for (const skill of requiredSkills) {
            const skillName = typeof skill === 'string' ? skill : skill.name;
            const minLevel = skill.minLevel || 'intermediate';
            const skillTagId = await ensureSkillTag(skillName);
            if (!skillTagId) continue;
            await db.query(
                'INSERT INTO role_benchmarks (role_title, skill_tag_id, min_level) VALUES (?, ?, ?)',
                [roleTitle, skillTagId, minLevel]
            );
            inserted++;
        }
        res.json({ message: `Benchmark updated with ${inserted} skills.` });
    } catch (err) {
        console.error('updateBenchmark:', err);
        res.status(500).json({ message: 'Failed to update benchmark.' });
    }
};

// ── CANDIDATE: MY ASSIGNMENTS ─────────────────────────────────────────────────

exports.getMyAssignments = async (req, res) => {
    try {
        const hire = await getHiredEmployeeId(req.user.id);
        if (!hire) return res.json({ assignments: [], hired: false });

        const [assignments] = await db.query(
            `SELECT ta.id, ta.course_id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at, ta.created_at,
                    c.title AS course_title, c.description, c.duration_hrs, c.level,
                    st.name AS skill_tag,
                    COUNT(DISTINCT m.id) AS total_modules,
                    COALESCE(SUM(CASE WHEN mp.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_modules,
                    CASE WHEN cert.id IS NOT NULL THEN 1 ELSE 0 END AS has_certificate
             FROM training_assignments ta
             JOIN courses c ON c.id = ta.course_id
             LEFT JOIN skill_tags st ON st.id = c.skill_tag_id
             LEFT JOIN modules m ON m.course_id = c.id AND m.is_published = 1 AND m.deleted_at IS NULL
             LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.assignment_id = ta.id
             LEFT JOIN certificates cert ON cert.assignment_id = ta.id AND cert.deleted_at IS NULL
             WHERE ta.hired_employee_id = ? AND ta.deleted_at IS NULL
             GROUP BY ta.id, ta.course_id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at,
                      ta.created_at, c.title, c.description, c.duration_hrs, c.level, st.name, cert.id
             ORDER BY ta.created_at DESC`,
            [hire.id]
        );

        const enriched = assignments.map(a => ({
            ...a,
            progress_pct: a.total_modules > 0
                ? Math.round((a.completed_modules / a.total_modules) * 100)
                : 0,
        }));

        res.json({ assignments: enriched, hired: true });
    } catch (err) {
        console.error('getMyAssignments:', err);
        res.status(500).json({ message: 'Failed to fetch assignments.' });
    }
};

exports.getAssignmentDetail = async (req, res) => {
    try {
        const hire = await getHiredEmployeeId(req.user.id);
        if (!hire) return res.status(403).json({ message: 'Not a hired employee.' });

        const [[assignment]] = await db.query(
            `SELECT ta.id, ta.course_id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at,
                    c.title AS course_title, c.description, c.duration_hrs, c.level, he.role_title
             FROM training_assignments ta
             JOIN courses c ON c.id = ta.course_id
             JOIN hired_employees he ON he.id = ta.hired_employee_id
             WHERE ta.id = ? AND ta.hired_employee_id = ? AND ta.deleted_at IS NULL`,
            [req.params.assignmentId, hire.id]
        );
        if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

        const [modules] = await db.query(
            `SELECT m.id, m.title, m.content_type, m.content_url, m.order_index, m.duration_mins, m.pass_score,
                    mp.status AS progress_status, mp.score AS progress_score, mp.attempts
             FROM modules m
             LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.assignment_id = ?
             WHERE m.course_id = ? AND m.is_published = 1 AND m.deleted_at IS NULL
             ORDER BY m.order_index ASC`,
            [req.params.assignmentId, assignment.course_id]
        );

        // Strip correct answers from quiz modules before serving to candidate
        const sanitizedModules = modules.map(m => {
            if (m.content_type === 'quiz' && m.content_url) {
                try {
                    const questions = JSON.parse(m.content_url);
                    const sanitized = Array.isArray(questions)
                        ? questions.map(({ q, choices }) => ({ q, choices }))
                        : [];
                    return { ...m, quiz_questions: sanitized, content_url: null };
                } catch {
                    return { ...m, quiz_questions: [], content_url: null };
                }
            }
            return m;
        });

        res.json({ assignment, modules: sanitizedModules });
    } catch (err) {
        console.error('getAssignmentDetail:', err);
        res.status(500).json({ message: 'Failed to fetch assignment.' });
    }
};

exports.completeModule = async (req, res) => {
    try {
        const hire = await getHiredEmployeeId(req.user.id);
        if (!hire) return res.status(403).json({ message: 'Not a hired employee.' });

        const { assignmentId, moduleId } = req.params;

        // Verify assignment belongs to this hire
        const [[ta]] = await db.query(
            `SELECT ta.id, ta.course_id, ta.hired_employee_id FROM training_assignments ta
             WHERE ta.id = ? AND ta.hired_employee_id = ? AND ta.deleted_at IS NULL`,
            [assignmentId, hire.id]
        );
        if (!ta) return res.status(404).json({ message: 'Assignment not found.' });

        // Don't allow completing quiz modules this way
        const [[mod]] = await db.query(
            'SELECT content_type FROM modules WHERE id = ? AND deleted_at IS NULL',
            [moduleId]
        );
        if (!mod) return res.status(404).json({ message: 'Module not found.' });
        if (mod.content_type === 'quiz') {
            return res.status(400).json({ message: 'Use the quiz endpoint to complete quiz modules.' });
        }

        await db.query(
            `INSERT INTO module_progress (assignment_id, module_id, status, completed_at)
             VALUES (?, ?, 'completed', NOW())
             ON DUPLICATE KEY UPDATE status = 'completed', completed_at = NOW()`,
            [assignmentId, moduleId]
        );

        // Update assignment status to in_progress if still assigned
        await db.query(
            `UPDATE training_assignments SET status = 'in_progress'
             WHERE id = ? AND status = 'assigned'`,
            [assignmentId]
        );

        const allDone = await checkAndCompleteAssignment(assignmentId);
        let certificate = null;
        if (allDone) {
            setImmediate(() => {
                trainingService.generateCertificate(hire.id, ta.course_id, parseInt(assignmentId))
                    .catch(err => console.error('[Certificate]', err.message));
            });
        }

        res.json({ message: 'Module completed.', assignment_completed: allDone, certificate });
    } catch (err) {
        console.error('completeModule:', err);
        res.status(500).json({ message: 'Failed to complete module.' });
    }
};

exports.submitQuiz = async (req, res) => {
    const { answers } = req.body;
    if (!Array.isArray(answers)) {
        return res.status(400).json({ message: 'answers[] is required.' });
    }

    try {
        const hire = await getHiredEmployeeId(req.user.id);
        if (!hire) return res.status(403).json({ message: 'Not a hired employee.' });

        const { assignmentId, moduleId } = req.params;

        const [[ta]] = await db.query(
            `SELECT ta.id, ta.course_id FROM training_assignments ta
             WHERE ta.id = ? AND ta.hired_employee_id = ? AND ta.deleted_at IS NULL`,
            [assignmentId, hire.id]
        );
        if (!ta) return res.status(404).json({ message: 'Assignment not found.' });

        const [[mod]] = await db.query(
            `SELECT id, content_url, pass_score FROM modules
             WHERE id = ? AND content_type = 'quiz' AND deleted_at IS NULL`,
            [moduleId]
        );
        if (!mod) return res.status(404).json({ message: 'Quiz module not found.' });

        let questions = [];
        try {
            questions = JSON.parse(mod.content_url || '[]');
        } catch {
            return res.status(500).json({ message: 'Quiz data is corrupted.' });
        }

        if (!questions.length) {
            return res.status(400).json({ message: 'This quiz has no questions.' });
        }

        // Evaluate answers
        let correct = 0;
        for (let i = 0; i < questions.length; i++) {
            if (answers[i] === questions[i].correct) correct++;
        }
        const score = Math.round((correct / questions.length) * 100);
        const passed = score >= (mod.pass_score || 70);

        // Get current attempts
        const [[existing]] = await db.query(
            'SELECT attempts FROM module_progress WHERE assignment_id = ? AND module_id = ?',
            [assignmentId, moduleId]
        );
        const attempts = (existing?.attempts || 0) + 1;

        const newStatus = passed ? 'completed' : 'failed';
        const completedAt = passed ? 'NOW()' : 'NULL';

        await db.query(
            `INSERT INTO module_progress (assignment_id, module_id, status, score, attempts, completed_at)
             VALUES (?, ?, ?, ?, ?, ${passed ? 'NOW()' : 'NULL'})
             ON DUPLICATE KEY UPDATE
                 status = VALUES(status), score = VALUES(score),
                 attempts = VALUES(attempts),
                 completed_at = ${passed ? 'NOW()' : 'completed_at'}`,
            [assignmentId, moduleId, newStatus, score, attempts]
        );

        if (passed) {
            await db.query(
                `UPDATE training_assignments SET status = 'in_progress'
                 WHERE id = ? AND status = 'assigned'`,
                [assignmentId]
            );

            const allDone = await checkAndCompleteAssignment(assignmentId);
            if (allDone) {
                setImmediate(() => {
                    trainingService.generateCertificate(hire.id, ta.course_id, parseInt(assignmentId))
                        .catch(err => console.error('[Certificate]', err.message));
                });
            }
        }

        res.json({
            score,
            passed,
            correct,
            total: questions.length,
            attempts,
            pass_score: mod.pass_score || 70,
        });
    } catch (err) {
        console.error('submitQuiz:', err);
        res.status(500).json({ message: 'Failed to submit quiz.' });
    }
};

exports.getMyCertificates = async (req, res) => {
    try {
        const hire = await getHiredEmployeeId(req.user.id);
        if (!hire) return res.json({ certificates: [] });

        const [certs] = await db.query(
            `SELECT cert.id, cert.certificate_key, cert.issued_at,
                    co.title AS course_title, co.level
             FROM certificates cert
             JOIN courses co ON co.id = cert.course_id
             WHERE cert.hired_employee_id = ? AND cert.deleted_at IS NULL
             ORDER BY cert.issued_at DESC`,
            [hire.id]
        );

        const enriched = await Promise.all(
            certs.map(async (c) => ({
                ...c,
                download_url: await getPresignedUrl(c.certificate_key, 7 * 24 * 3600),
            }))
        );

        res.json({ certificates: enriched });
    } catch (err) {
        console.error('getMyCertificates:', err);
        res.status(500).json({ message: 'Failed to fetch certificates.' });
    }
};

exports.getAIRecommendations = async (req, res) => {
    try {
        const hire = await getHiredEmployeeId(req.user.id);
        const candidateId = hire?.candidate_id;
        if (!candidateId) return res.json({ recommendations: [] });

        const [[hireData]] = await db.query(
            'SELECT role_title FROM hired_employees WHERE id = ?', [hire.id]
        );

        const recs = await trainingService.getAITrainingRecommendations(
            candidateId,
            hireData?.role_title
        );
        res.json({ recommendations: recs });
    } catch (err) {
        console.error('getAIRecommendations:', err);
        res.json({ recommendations: [] });
    }
};

// ── ADMIN / HR OVERSIGHT ──────────────────────────────────────────────────────

exports.getAllAssignments = async (req, res) => {
    try {
        const [assignments] = await db.query(
            `SELECT ta.id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at, ta.created_at,
                    c.title AS course_title, c.duration_hrs,
                    u.name AS candidate_name, u.email AS candidate_email,
                    co.company_name, he.role_title,
                    COUNT(DISTINCT m.id) AS total_modules,
                    COALESCE(SUM(CASE WHEN mp.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_modules
             FROM training_assignments ta
             JOIN hired_employees he ON he.id = ta.hired_employee_id
             JOIN candidates cand ON cand.id = he.candidate_id
             JOIN users u ON u.id = cand.user_id
             JOIN companies co ON co.id = he.company_id
             JOIN courses c ON c.id = ta.course_id
             LEFT JOIN modules m ON m.course_id = c.id AND m.is_published = 1 AND m.deleted_at IS NULL
             LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.assignment_id = ta.id
             WHERE ta.deleted_at IS NULL
             GROUP BY ta.id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at, ta.created_at,
                      c.title, c.duration_hrs, u.name, u.email, co.company_name, he.role_title
             ORDER BY ta.created_at DESC`
        );
        res.json({
            assignments: assignments.map(a => ({
                ...a,
                progress_pct: a.total_modules > 0
                    ? Math.round((a.completed_modules / a.total_modules) * 100)
                    : 0,
            })),
        });
    } catch (err) {
        console.error('getAllAssignments:', err);
        res.status(500).json({ message: 'Failed to fetch assignments.' });
    }
};

exports.getEmployeeAssignments = async (req, res) => {
    try {
        const [assignments] = await db.query(
            `SELECT ta.id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at,
                    c.title AS course_title, c.duration_hrs,
                    COUNT(DISTINCT m.id) AS total_modules,
                    COALESCE(SUM(CASE WHEN mp.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_modules
             FROM training_assignments ta
             JOIN courses c ON c.id = ta.course_id
             LEFT JOIN modules m ON m.course_id = c.id AND m.is_published = 1 AND m.deleted_at IS NULL
             LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.assignment_id = ta.id
             WHERE ta.hired_employee_id = ? AND ta.deleted_at IS NULL
             GROUP BY ta.id, ta.status, ta.assignment_type, ta.due_date, ta.completed_at,
                      c.title, c.duration_hrs
             ORDER BY ta.created_at DESC`,
            [req.params.employeeId]
        );
        res.json({
            assignments: assignments.map(a => ({
                ...a,
                progress_pct: a.total_modules > 0
                    ? Math.round((a.completed_modules / a.total_modules) * 100)
                    : 0,
            })),
        });
    } catch (err) {
        console.error('getEmployeeAssignments:', err);
        res.status(500).json({ message: 'Failed to fetch employee assignments.' });
    }
};

exports.manualAssign = async (req, res) => {
    const { hired_employee_id, course_id, assignment_type, due_date } = req.body;
    if (!hired_employee_id || !course_id) {
        return res.status(400).json({ message: 'hired_employee_id and course_id are required.' });
    }
    try {
        const [existing] = await db.query(
            `SELECT id FROM training_assignments
             WHERE hired_employee_id = ? AND course_id = ? AND deleted_at IS NULL`,
            [hired_employee_id, course_id]
        );
        if (existing.length) {
            return res.status(409).json({ message: 'This course is already assigned to this employee.' });
        }
        const [result] = await db.query(
            `INSERT INTO training_assignments
             (hired_employee_id, course_id, assigned_by, assignment_type, due_date, status)
             VALUES (?, ?, ?, ?, ?, 'assigned')`,
            [hired_employee_id, course_id, req.user.id,
             assignment_type || 'mandatory', due_date || null]
        );
        res.status(201).json({ message: 'Course assigned.', id: result.insertId });
    } catch (err) {
        console.error('manualAssign:', err);
        res.status(500).json({ message: 'Failed to assign course.' });
    }
};
