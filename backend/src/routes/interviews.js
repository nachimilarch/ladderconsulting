const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/interviewController');

// Candidate routes (specific paths before param routes)
router.get('/my',                    authenticateToken, authorizeRole('candidate'), ctrl.getCandidateInterviews);
router.get('/offers/my',             authenticateToken, authorizeRole('candidate'), ctrl.getCandidateOffers);
router.patch('/slots/:id/confirm',   authenticateToken, authorizeRole('candidate'), ctrl.confirmSlot);
router.patch('/slots/:id/reschedule',authenticateToken, authorizeRole('candidate'), ctrl.requestReschedule);
router.patch('/offers/:id/respond',  authenticateToken, authorizeRole('candidate'), ctrl.respondToOffer);

// Company routes
router.post('/slots',                authenticateToken, authorizeRole('company'), ctrl.createSlot);
router.get('/slots',                 authenticateToken, authorizeRole('company'), ctrl.listCompanySlots);
router.patch('/slots/:id/cancel',    authenticateToken, authorizeRole('company'), ctrl.cancelSlot);
router.post('/:id/outcome',          authenticateToken, authorizeRole('company'), ctrl.recordOutcome);
router.post('/:id/offer',            authenticateToken, authorizeRole('company'), ctrl.generateOffer);

// Offer letter PDF — company downloads, exec/admin downloads, company sends to candidate
router.get( '/offers/:offerId/pdf',         authenticateToken, authorizeRole('company', 'hr_staff', 'admin'), ctrl.downloadOfferLetterPDF);
router.post('/offers/:offerId/letter/send', authenticateToken, authorizeRole('company'), ctrl.sendOfferLetterEmail);

module.exports = router;
