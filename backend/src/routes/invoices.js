const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const inv = require('../controllers/invoiceController');
const pay = require('../controllers/paymentController');

// Executive routes
router.get('/exec',              authenticateToken, authorizeRole('hr_staff', 'admin'), inv.listExecInvoices);
router.post('/exec',             authenticateToken, authorizeRole('hr_staff', 'admin'), inv.createInvoice);
router.get('/exec/companies',    authenticateToken, authorizeRole('hr_staff', 'admin'), inv.listExecCompanies);
router.get('/exec/summary',      authenticateToken, authorizeRole('admin'),             inv.adminInvoiceSummary);
router.get('/exec/:id',          authenticateToken, authorizeRole('hr_staff', 'admin'), inv.getInvoiceDetail);
router.put('/exec/:id',          authenticateToken, authorizeRole('hr_staff', 'admin'), inv.updateInvoice);
router.delete('/exec/:id',       authenticateToken, authorizeRole('hr_staff', 'admin'), inv.deleteInvoice);
router.put('/exec/:id/mark-paid',   authenticateToken, authorizeRole('hr_staff', 'admin'), inv.markPaid);
router.put('/exec/:id/mark-partial', authenticateToken, authorizeRole('hr_staff', 'admin'), inv.markPartial);
router.get('/exec/:id/pdf',          authenticateToken, authorizeRole('hr_staff', 'admin'), inv.downloadExecInvoicePDF);

// Company routes
router.get('/company',                          authenticateToken, authorizeRole('company'), inv.companyListInvoices);
router.get('/company/placement-fees/summary',   authenticateToken, authorizeRole('company'), inv.companyPlacementFeeSummary);
router.get('/company/:id',                      authenticateToken, authorizeRole('company'), inv.companyGetInvoice);
router.get('/company/:id/pdf',                  authenticateToken, authorizeRole('company'), inv.downloadCompanyInvoicePDF);
router.post('/company/:id/pay',                 authenticateToken, authorizeRole('company'), pay.initiatePayment);

// Admin routes
router.get('/admin/all',         authenticateToken, authorizeRole('admin'), inv.adminListInvoices);
router.get('/admin/summary',     authenticateToken, authorizeRole('admin'), inv.adminInvoiceSummary);

module.exports = router;
