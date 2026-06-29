const { Op } = require('sequelize');
const { Sprint } = require('../models');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * checkTemporalScrumMaster — BLOCKING privilege middleware.
 *
 * Returns 403 if the requesting user is not the Scrum Master of the sprint
 * whose IST date window covers today. Mirrors the temporal-first matching
 * logic of resolveActiveSprint: a sprint is considered active when
 *   startDate <= todayIST <= endDate
 * regardless of its database status column. COMPLETED sprints are excluded
 * so that past sprints can't be gamed.
 *
 * A PENDING (Planned) sprint whose window has arrived grants full SM
 * privileges even before the JIT engine in getAllSprints has auto-transitioned
 * its status to ACTIVE.
 */
const checkTemporalScrumMaster = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const todayIST = getTodayIST();

    const teamId = req.user.teamId;
    if (teamId === null || teamId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User is not assigned to a team',
      });
    }

    const isManager = req.user.systemRole === 'Admin/Manager';
    let activeSprint;

    if (isManager) {
      activeSprint = await Sprint.findOne({
        where: {
          teamId,
          startDate: { [Op.lte]: todayIST },
          endDate: { [Op.gte]: todayIST },
          status: { [Op.ne]: 'COMPLETED' },
        },
      });
    } else {
      activeSprint = await Sprint.findOne({
        where: {
          scrumMasterId: req.user.id,
          teamId,
          startDate: { [Op.lte]: todayIST },
          endDate: { [Op.gte]: todayIST },
          status: { [Op.ne]: 'COMPLETED' },
        },
      });
    }

    if (!activeSprint) {
      return res.status(403).json({
        success: false,
        message:
          'Temporal Scrum Master privileges are not active for the current sprint window',
      });
    }

    if (activeSprint.status === 'PENDING') {
      const existingActive = await Sprint.findOne({
        where: { status: 'ACTIVE', teamId: activeSprint.teamId, id: { [Op.ne]: activeSprint.id } }
      });
      if (existingActive) {
        await existingActive.update({ status: 'COMPLETED' });
      }
      await activeSprint.update({ status: 'ACTIVE' });
    }

    req.isTemporalScrumMaster = activeSprint.scrumMasterId === req.user.id || req.user.systemRole === 'Admin/Manager';
    req.activeSprintId = activeSprint.id;
    req.activeSprint = activeSprint;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = checkTemporalScrumMaster;
