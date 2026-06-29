const express = require('express');
const sprintController = require('../controllers/sprint.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', sprintController.getAllSprints);
router.post('/', sprintController.createSprint);
router.patch('/:id/start', sprintController.startSprint);
router.patch('/:id/edit', sprintController.editSprint);
router.patch('/:id/scrummaster', sprintController.assignScrumMaster);

module.exports = router;
