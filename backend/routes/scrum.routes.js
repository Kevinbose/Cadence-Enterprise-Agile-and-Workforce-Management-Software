const express = require('express');
const scrumController = require('../controllers/scrum.controller');
const authenticate = require('../middlewares/auth.middleware');
const checkTemporalScrumMaster = require('../middlewares/scrum.middleware');

const router = express.Router();

router.use(authenticate);
router.use(checkTemporalScrumMaster);

router.get('/wfh-queue', scrumController.getPendingWFH);
router.patch('/adjudicate/:recordId', scrumController.adjudicateWFH);
router.get('/team-matrix', scrumController.getTeamMatrix);

module.exports = router;
