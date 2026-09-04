const express = require('express');
const router = express.Router();
const { getMyCompanies, sendJDReminder } = require('../controllers/companyController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));
router.get('/', getMyCompanies);
router.post('/:id/remind-jd', sendJDReminder);

module.exports = router;
