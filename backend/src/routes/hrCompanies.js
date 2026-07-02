const express = require('express');
const router = express.Router();
const { getMyCompanies } = require('../controllers/companyController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));
router.get('/', getMyCompanies);

module.exports = router;
