const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');
const ctrl = require('../controllers/recruitmentController');

const exec = [authenticateToken, authorizeRole('hr_staff', 'admin')];

// Active JDs executives can source candidates for
router.get('/jobs', ...exec, ctrl.listActiveJobs);

// Full job description / requirements for a single JD
router.get('/jobs/:jobId', ...exec, ctrl.getJobDetail);

// Bulk resume upload against a JD (field name: "resumes", max 20 files, 5MB each)
router.post('/jobs/:jobId/resumes', ...exec, (req, res, next) => {
    uploadResume.array('resumes', 20)(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, ctrl.bulkUploadResumes);

// Bulk resume upload straight into the free talent pool — no JD required
router.post('/resumes', ...exec, (req, res, next) => {
    uploadResume.array('resumes', 20)(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, ctrl.bulkUploadToPool);

// Upload batch tracking
router.get('/batches',     ...exec, ctrl.listBatches);
router.get('/batches/:id', ...exec, ctrl.getBatchDetail);

// Talent pool — exec view (unmasked) + direct assign to JD
router.get('/talent',                               ...exec, ctrl.listTalentPoolExec);
router.post('/jobs/:jobId/assign-candidate',        ...exec, ctrl.assignCandidateToJob);

// Company interest inbox
router.get('/talent-interests',                     ...exec, ctrl.listTalentInterests);
router.post('/talent-interests/:notifId/assign',    ...exec, ctrl.actOnTalentInterest);

// Full candidate profile for HR executives (PII included, no masking)
// Optional ?jobId= returns fit_score + matched/missing skills for that JD
router.get('/candidates/:candidateId/profile', ...exec, ctrl.getCandidateProfile);

// DELETE a sourced candidate profile (soft-delete user + candidate + resumes, removes resume files)
router.delete('/candidates/:candidateId', ...exec, ctrl.deleteCandidate);

module.exports = router;
