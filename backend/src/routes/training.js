const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/trainingController');

// ── Candidate routes (specific paths BEFORE /:param routes) ───────────────────
router.get('/my/certificates',   authenticateToken, authorizeRole('candidate'), ctrl.getMyCertificates);
router.get('/my/ai-recommendations', authenticateToken, authorizeRole('candidate'), ctrl.getAIRecommendations);
router.get('/my/:assignmentId',  authenticateToken, authorizeRole('candidate'), ctrl.getAssignmentDetail);
router.get('/my',                authenticateToken, authorizeRole('candidate'), ctrl.getMyAssignments);
router.patch('/my/:assignmentId/modules/:moduleId/complete',
             authenticateToken, authorizeRole('candidate'), ctrl.completeModule);
router.post('/my/:assignmentId/modules/:moduleId/quiz',
            authenticateToken, authorizeRole('candidate'), ctrl.submitQuiz);

// ── Course management (admin, trainer) ────────────────────────────────────────
router.get('/courses',           authenticateToken, authorizeRole('admin', 'trainer', 'hr_staff'), ctrl.listCourses);
router.post('/courses',          authenticateToken, authorizeRole('admin', 'trainer'), ctrl.createCourse);
router.get('/courses/:id',       authenticateToken, authorizeRole('admin', 'trainer', 'hr_staff'), ctrl.getCourseWithModules);
router.put('/courses/:id',       authenticateToken, authorizeRole('admin', 'trainer'), ctrl.updateCourse);
router.delete('/courses/:id',    authenticateToken, authorizeRole('admin', 'trainer'), ctrl.deleteCourse);
router.post('/courses/:id/modules', authenticateToken, authorizeRole('admin', 'trainer'), ctrl.addModule);

// ── Module management ─────────────────────────────────────────────────────────
router.put('/modules/:id',       authenticateToken, authorizeRole('admin', 'trainer'), ctrl.updateModule);
router.delete('/modules/:id',    authenticateToken, authorizeRole('admin', 'trainer'), ctrl.deleteModule);

// ── Role benchmarks ───────────────────────────────────────────────────────────
router.get('/benchmarks',        authenticateToken, authorizeRole('admin', 'trainer', 'hr_staff'), ctrl.listBenchmarks);
router.post('/benchmarks',       authenticateToken, authorizeRole('admin'), ctrl.createBenchmark);
router.put('/benchmarks/:roleTitle', authenticateToken, authorizeRole('admin'), ctrl.updateBenchmark);

// ── Admin/HR/Trainer oversight ────────────────────────────────────────────────
router.get('/assignments',               authenticateToken, authorizeRole('admin', 'hr_staff', 'trainer'), ctrl.getAllAssignments);
router.post('/assignments/manual',       authenticateToken, authorizeRole('admin', 'hr_staff', 'trainer'), ctrl.manualAssign);
router.get('/assignments/:employeeId',   authenticateToken, authorizeRole('admin', 'hr_staff', 'trainer'), ctrl.getEmployeeAssignments);

module.exports = router;
