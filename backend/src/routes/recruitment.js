const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');
const ctrl = require('../controllers/recruitmentController');
const mgmt = require('../controllers/candidateManagementController');

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

// Talent pool — exec view + direct assign to JD
router.get('/talent',                               ...exec, ctrl.listTalentPoolExec);
router.post('/jobs/:jobId/assign-candidate',        ...exec, ctrl.assignCandidateToJob);

// Full candidate profile for HR executives
// Optional ?jobId= returns fit_score + matched/missing skills for that JD
router.get('/candidates/:candidateId/profile', ...exec, ctrl.getCandidateProfile);

// Direct resume file download for HR/admin (original file)
router.get('/resumes/:resumeId/download', ...exec, ctrl.downloadResume);

// DELETE a sourced candidate profile (soft-delete user + candidate + resumes, removes resume files)
router.delete('/candidates/:candidateId', ...exec, ctrl.deleteCandidate);

// Candidate management (admin: any candidate; hr_staff: only the ones they sourced)
router.get('/jobs/:jobId/applicants',                       ...exec, mgmt.getJobApplicants);
router.get('/my-candidates',                                ...exec, mgmt.listMyCandidates);
router.post('/candidates', ...exec, (req, res, next) => {
    uploadResume.single('resume')(req, res, (err) => err ? res.status(400).json({ success: false, message: err.message }) : next());
}, mgmt.createCandidate);
router.post('/candidates/message-list',                     ...exec, mgmt.createMessageList);
router.get('/candidates/:id/manage',                        ...exec, mgmt.getManagedCandidate);
router.put('/candidates/:id',                               ...exec, mgmt.updateCandidate);
router.post('/candidates/:id/resume', ...exec, (req, res, next) => {
    uploadResume.single('resume')(req, res, (err) => err ? res.status(400).json({ success: false, message: err.message }) : next());
}, mgmt.uploadCandidateResume);
router.delete('/candidates/:id/applications/:appId',        ...exec, mgmt.removeApplication);

// Failed upload review: list, open the original file, delete one / several / all
router.get('/failed-uploads',               ...exec, ctrl.listFailedUploads);
router.get('/upload-items/:id/download',    ...exec, ctrl.downloadUploadItem);
router.post('/upload-items/delete',         ...exec, ctrl.deleteUploadItems);
router.delete('/upload-items/:id',          ...exec, ctrl.deleteUploadItem);

module.exports = router;
