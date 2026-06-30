const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/companyController');
const unlockCtrl = require('../controllers/resumeUnlockController');
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

// Talent pool — browse non-hired candidates
router.get('/talent',                        ctrl.getTalentPool);
router.post('/talent/:candidateId/interest', ctrl.expressInterest);

// Resume unlock — self-serve paid access to a candidate's full resume/profile
router.get('/talent/unlock-status',           unlockCtrl.getUnlockStatus);
router.post('/talent/buy-pack',               unlockCtrl.buyPack);
router.post('/talent/:candidateId/unlock',    unlockCtrl.purchaseUnlock);
router.get('/talent/:candidateId/profile',    unlockCtrl.getFullProfile);
router.get('/talent/:candidateId/resume',     unlockCtrl.downloadUnlockedResume);

// Package selection from the company's own profile page
router.get('/package-status',                 unlockCtrl.getPackageStatus);
router.post('/platinum-request',              unlockCtrl.requestPlatinum);
router.post('/package-request',               unlockCtrl.requestPackage);

// Move an already-unlocked (single/pack) Talent Pool candidate into the company's
// own hiring pipeline — creates the application that feeds the existing
// shortlist → interview-request → offer-request flow.
router.post('/talent/:candidateId/apply',     unlockCtrl.applyToPipeline);

module.exports = router;
