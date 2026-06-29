const { AuditLog, User, Task, Sprint } = require('../models');

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/audits/sprints/:sprintId
// Retrieves the immutable audit ledger for a sprint, ordered chronologically
// (newest first). Accessible by Admin/Manager and the active temporal SM.
// ──────────────────────────────────────────────────────────────────────────────
const getSprintAudits = async (req, res, next) => {
  try {
    const isManager = req.user.systemRole === 'Admin/Manager';
    const isSM = req.isTemporalScrumMaster === true;

    if (!isManager && !isSM) {
      return res.status(403).json({
        success: false,
        message: 'Audit logs are restricted to Managers and the active Scrum Master.',
      });
    }

    const { sprintId } = req.params;
    const numericSprintId = parseInt(sprintId, 10);

    if (isNaN(numericSprintId)) {
      return res.status(400).json({ success: false, message: 'Invalid sprintId.' });
    }

    const sprint = await Sprint.findByPk(numericSprintId, {
      attributes: ['id', 'name', 'startDate', 'endDate', 'status', 'teamId'],
    });

    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found.' });
    }

    if (sprint.teamId !== null && sprint.teamId !== req.user.teamId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this team's sprint audits.",
      });
    }

    const logs = await AuditLog.findAll({
      where: { sprintId: numericSprintId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'employeeId', 'systemRole'],
          required: false,
        },
        {
          model: Task,
          attributes: ['id', 'issueKey', 'title', 'type', 'status'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      sprint: sprint.get({ plain: true }),
      count: logs.length,
      logs: logs.map((l) => l.get({ plain: true })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSprintAudits };
