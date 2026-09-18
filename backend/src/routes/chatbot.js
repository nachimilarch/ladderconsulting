const router = require('express').Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/chatbotController');

router.use(authenticateToken, authorizeRole('company', 'candidate'));

router.get('/conversations',                       ctrl.listConversations);
router.post('/conversations',                      ctrl.createConversation);
router.get('/conversations/:id',                   ctrl.getConversation);
router.post('/conversations/:id/messages',          ctrl.sendMessage);
router.post('/actions/:id/confirm',                ctrl.confirmAction);
router.post('/actions/:id/discard',                ctrl.discardAction);

module.exports = router;
