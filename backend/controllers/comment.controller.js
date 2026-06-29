const { Task, Sprint, Comment, User } = require('../models');

const getTaskComments = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const numericTaskId = parseInt(taskId, 10);
    if (isNaN(numericTaskId)) {
      return res.status(400).json({ success: false, message: 'Invalid taskId.' });
    }

    const task = await Task.findByPk(numericTaskId, {
      include: [{ model: Sprint, attributes: ['teamId'] }]
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.Sprint && task.Sprint.teamId !== null && task.Sprint.teamId !== req.user.teamId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this task's comments."
      });
    }

    const comments = await Comment.findAll({
      where: { taskId: numericTaskId },
      include: [
        {
          model: User,
          as: 'Author',
          attributes: ['id', 'name', 'employeeId', 'systemRole']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      comments: comments.map(c => c.get({ plain: true }))
    });
  } catch (error) {
    next(error);
  }
};

const createTaskComment = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { content, evaluationTier } = req.body;
    const numericTaskId = parseInt(taskId, 10);

    if (isNaN(numericTaskId)) {
      return res.status(400).json({ success: false, message: 'Invalid taskId.' });
    }

    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required.' });
    }

    if (!evaluationTier || !['Positive', 'Negative (Simple)', 'Negative (Serious)'].includes(evaluationTier)) {
      return res.status(400).json({
        success: false,
        message: 'A valid evaluation rating (thumbs up/down) is mandatory.'
      });
    }

    const task = await Task.findByPk(numericTaskId, {
      include: [{ model: Sprint, attributes: ['teamId', 'scrumMasterId'] }]
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.Sprint && task.Sprint.teamId !== null && task.Sprint.teamId !== req.user.teamId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this task."
      });
    }

    const isManager = req.user.systemRole === 'Admin/Manager';
    const isSM = task.Sprint && task.Sprint.scrumMasterId === req.user.id;

    if (!isManager && !isSM) {
      return res.status(403).json({
        success: false,
        message: 'Only Scrum Masters or Managers can add comments to tasks.'
      });
    }

    const comment = await Comment.create({
      taskId: numericTaskId,
      authorId: req.user.id,
      content: String(content).trim(),
      evaluationTier
    });

    const reloaded = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: 'Author',
          attributes: ['id', 'name', 'employeeId', 'systemRole']
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      comment: reloaded.get({ plain: true })
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTaskComments,
  createTaskComment
};
