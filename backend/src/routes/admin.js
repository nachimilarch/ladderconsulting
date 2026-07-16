const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');
const ctrl = require('../controllers/adminController');

const admin = [authenticateToken, authorizeRole('admin')];

// Companies
router.get('/companies',                          ...admin, ctrl.listCompanies);
router.get('/companies/unassigned',               ...admin, ctrl.listUnassignedCompanies);
router.get('/companies/:id',                      ...admin, ctrl.getCompanyDetail);
router.patch('/companies/:id/approve',            ...admin, ctrl.approveCompany);
router.patch('/companies/:id/reject',             ...admin, ctrl.rejectCompany);
router.patch('/companies/:id/suspend',            ...admin, ctrl.suspendCompany);
router.patch('/companies/:id/reactivate',         ...admin, ctrl.reactivateCompany);
router.delete('/companies/:id',                   ...admin, ctrl.deleteCompany);

// Executive assignment (Phase 2)
router.patch('/companies/:id/assign-executive',   ...admin, ctrl.assignExecutive);
router.get('/executive-assignments',              ...admin, ctrl.listExecutiveAssignments);

// Manual package activation (offline payment collected by exec/admin)
router.post('/companies/:id/activate-package',    ...admin, ctrl.activatePackage);

// Per-company placement fee rate (Platinum tier) + onboarding agreement upload
router.patch('/companies/:id/placement-fee-rate', ...admin, (req, res, next) => {
    uploadDocument.single('agreement')(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });
}, ctrl.setPlacementFeeRate);
router.get('/companies/:id/agreement', ...admin, ctrl.downloadAgreement);

// Company requests & fee gate (Phase 3)
router.get('/requests',                           ...admin, ctrl.listRequests);
router.patch('/requests/:id',                     ...admin, ctrl.updateRequest);
router.post('/invoices',                          ...admin, ctrl.createInvoice);
router.patch('/invoices/:id/status',              ...admin, ctrl.updateInvoiceStatus);

// Candidates
router.get('/candidates',                  ...admin, ctrl.listCandidates);
router.get('/candidates/:id',              ...admin, ctrl.getCandidateDetail);
router.patch('/candidates/:id/suspend',    ...admin, ctrl.suspendCandidate);
router.patch('/candidates/:id/reactivate', ...admin, ctrl.reactivateCandidate);

// HR Staff
router.get('/staff',                       ...admin, ctrl.listStaff);
router.post('/staff',                      ...admin, ctrl.createStaff);
router.put('/staff/:id',                   ...admin, ctrl.updateStaff);
router.patch('/staff/:id/deactivate',      ...admin, ctrl.deactivateStaff);
router.get('/staff/:id/performance',       ...admin, ctrl.getStaffPerformance);

// Recruitment oversight
router.get('/recruitment/overview',        ...admin, ctrl.getRecruitmentOverview);
router.get('/recruitment/pipeline',        ...admin, ctrl.getRecruitmentPipeline);
router.get('/recruitment/placements',      ...admin, ctrl.getPlacements);

// Analytics
router.get('/analytics/summary',                 ...admin, ctrl.getAnalyticsSummary);
router.get('/analytics/monthly',                 ...admin, ctrl.getMonthlyAnalytics);
router.get('/analytics/conversion',              ...admin, ctrl.getConversionFunnel);
router.get('/analytics/executive-performance',   ...admin, ctrl.getExecutivePerformance);

// AI Matching admin
router.post('/resumes/reparse-skills',     ...admin, ctrl.reparseResumeSkills);
router.post('/match/recompute',            ...admin, ctrl.recomputeMatchScores);
router.post('/jobs/backfill-skills',       ...admin, ctrl.backfillJobSkills);

// Offer letter requests + placement fees
const offerReqCtrl = require('../controllers/offerRequestController');
router.get('/offer-requests',              ...admin, offerReqCtrl.adminListAll);
router.get('/placement-fees',              ...admin, offerReqCtrl.adminListFees);

// General invoices (admin oversight)
const invCtrl = require('../controllers/invoiceController');
router.get('/invoices/summary',            ...admin, invCtrl.adminInvoiceSummary);
router.get('/invoices',                    ...admin, invCtrl.adminListInvoices);

// Interview requests (admin oversight)
const intReqCtrl = require('../controllers/interviewRequestController');
router.get('/interview-requests',          ...admin, intReqCtrl.listExecRequests);

// Audit logs
router.get('/audit-logs',                  ...admin, ctrl.getAuditLogs);

// Platform settings
router.get('/settings',                    ...admin, ctrl.getSettings);
router.patch('/settings',                  ...admin, ctrl.updateSettings);

// Job Postings management
router.get('/jobs',                        ...admin, ctrl.listAllJobs);
router.patch('/jobs/:id/status',           ...admin, ctrl.setJobStatus);
router.delete('/jobs/:id',                 ...admin, ctrl.deleteJob);

// Email Templates
router.get('/email-templates',             ...admin, ctrl.listEmailTemplates);
router.get('/email-templates/:id',         ...admin, ctrl.getEmailTemplate);
router.post('/email-templates',            ...admin, ctrl.createEmailTemplate);
router.put('/email-templates/:id',         ...admin, ctrl.updateEmailTemplate);
router.delete('/email-templates/:id',      ...admin, ctrl.deleteEmailTemplate);

module.exports = router;
