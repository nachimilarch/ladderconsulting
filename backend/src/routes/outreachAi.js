const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/outreachAiController');

// Mounted inside the outreach router, which already requires hr_staff or admin.
router.get('/status',                              ctrl.status);

// Contacts (instant, rule-based)
router.get('/lists/:id/analysis',                  ctrl.analyseList);
router.get('/lists/:id/segments/:key/contacts',    ctrl.segmentContacts);
router.post('/lists/:id/segments/:key/save',       ctrl.saveSegment);
router.post('/lists/:id/tags',                     ctrl.applyTags);
router.post('/lists/:id/cleanup',                  ctrl.cleanupList);

// Copy and replies (instant, rule-based)
router.post('/check-copy',                         ctrl.checkCopy);
router.get('/replies/triage',                      ctrl.triageReplies);
router.get('/insights/stats',                      ctrl.insightStats);

// Scheduling
router.post('/schedule-plan',                      ctrl.schedulePlan);
router.post('/schedule-plan/apply',                ctrl.applyPlan);

// Writing tasks (AI model, background)
router.post('/tasks',                              ctrl.startTask);
router.get('/tasks',                               ctrl.listTasks);
router.get('/tasks/:id',                           ctrl.getTask);

module.exports = router;
