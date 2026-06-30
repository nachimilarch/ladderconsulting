const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/trainingCatalogueController');

// ── Catalogue — accessible to company + admin ─────────────────────────────────
router.get('/catalogue', authenticateToken, authorizeRole('company', 'admin'), ctrl.listCatalogue);

// ── Admin catalogue management ────────────────────────────────────────────────
router.post('/admin/catalogue',             authenticateToken, authorizeRole('admin'), ctrl.createCatalogueItem);
router.put('/admin/catalogue/:id',          authenticateToken, authorizeRole('admin'), ctrl.updateCatalogueItem);
router.patch('/admin/catalogue/:id/toggle', authenticateToken, authorizeRole('admin'), ctrl.toggleCatalogueItem);

// ── Company — submit & view own requests ─────────────────────────────────────
router.post('/request',      authenticateToken, authorizeRole('company'), ctrl.requestTraining);
router.get('/my-requests',   authenticateToken, authorizeRole('company'), ctrl.listCompanyRequests);

// ── Admin — list + action requests ───────────────────────────────────────────
router.get('/admin',           authenticateToken, authorizeRole('admin'), ctrl.listAdminRequests);
router.put('/admin/:id/approve', authenticateToken, authorizeRole('admin'), ctrl.approveRequest);
router.put('/admin/:id/reject',  authenticateToken, authorizeRole('admin'), ctrl.rejectRequest);

module.exports = router;
