const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicController');

// No authentication: these serve the public marketing website.
router.post('/contact', ctrl.submitContact);

module.exports = router;
