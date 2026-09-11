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

// Talent pool — browse candidates (full profiles if activated, masked if not)
router.get('/talent',                        ctrl.getTalentPool);
router.post('/talent/:candidateId/interest', ctrl.expressInterest);

// Listing fee — one-time ₹3,999 activation
router.get('/activation-status',  ctrl.getActivationStatus);
router.post('/pay-listing-fee',   ctrl.payListingFee);

module.exports = router;
