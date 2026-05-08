// backend/routes/tasks.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/taskController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.updateStatus);
router.post('/:id/notes', ctrl.addNote);
router.get('/:id/notes', ctrl.getNotes);
router.delete('/:id', ctrl.remove);

module.exports = router;