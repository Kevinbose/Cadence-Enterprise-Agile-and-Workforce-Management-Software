const express = require('express');
const commentController = require('../controllers/comment.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/:taskId/comments', commentController.getTaskComments);
router.post('/:taskId/comments', commentController.createTaskComment);

module.exports = router;
