const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/auth.middleware');
const resolveActiveSprint = require('../middlewares/resolveActiveSprint.middleware');

const router = express.Router();

router.use(authenticate);
router.use(resolveActiveSprint); // Needed so req.isTemporalScrumMaster is resolved

router.get('/assignees', userController.getEligibleAssignees);

module.exports = router;
