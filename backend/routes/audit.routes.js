const express = require('express');
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middlewares/auth.middleware');
const resolveActiveSprint = require('../middlewares/resolveActiveSprint.middleware');

const router = express.Router();

router.use(authenticate);
router.use(resolveActiveSprint); // Required to populate req.isTemporalScrumMaster

router.get('/sprints/:sprintId', auditController.getSprintAudits);

module.exports = router;
