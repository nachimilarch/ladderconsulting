const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/companyController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('company'));

router.get('/me',          ctrl.getProfile);
router.put('/me',          ctrl.updateProfile);
router.get('/dashboard',   ctrl.getDashboard);

router.get('/interviews',      ctrl.listInterviews);
router.post('/interviews',     ctrl.scheduleInterview);
router.patch('/interviews/:id', ctrl.updateInterview);

router.get('/offers',       ctrl.listOffers);
router.post('/offers',      ctrl.sendOffer);
router.patch('/offers/:id', ctrl.updateOffer);

// Candidate resume & skills (company can access if candidate applied to their job)
router.get('/candidates/:candidateId/resume',  ctrl.downloadCandidateResume);
router.get('/candidates/:candidateId/skills',  ctrl.getCandidateSkills);

// Company requests (Phase 3)
router.post('/requests',  ctrl.createRequest);
router.get('/requests',   ctrl.listRequests);

// Activation status — job posting is priced per-JD (see /api/jobs); this
// reports whether the account is activated (paid, or Platinum).
router.get('/activation-status',  ctrl.getActivationStatus);

// Premium tier — company-requested, executive/admin-approved, replaces the listing fee
router.post('/premium/request',   ctrl.requestPremiumTier);

module.exports = router;
