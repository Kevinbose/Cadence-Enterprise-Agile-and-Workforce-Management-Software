const express = require('express');
const taskController = require('../controllers/task.controller');
const authenticate = require('../middlewares/auth.middleware');
const resolveActiveSprint = require('../middlewares/resolveActiveSprint.middleware');

const router = express.Router();

router.use(authenticate);
router.use(resolveActiveSprint); // Non-blocking — attaches sprint context

router.post('/', taskController.createIssue);
router.get('/board', taskController.getSprintBoard);
router.post('/bulk-adjudicate', taskController.bulkAdjudicate);
router.patch('/:id/status', taskController.updateTaskStatus);
router.patch('/:id/reject', taskController.rejectTask);
router.patch('/:id', taskController.editIssue);
router.delete('/:id', taskController.deleteIssue);

module.exports = router;
