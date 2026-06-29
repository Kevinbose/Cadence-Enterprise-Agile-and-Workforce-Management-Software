const { Op } = require('sequelize');
const { Sprint, User } = require('../models');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * resolveActiveSprint — NON-BLOCKING context middleware.
 *
 * Resolves the sprint that is temporally active for the requesting user's team
 * and attaches:
 *   - req.activeSprint            → the Sprint instance (or null)
 *   - req.isTemporalScrumMaster   → true when this user is the sprint's SM
 *
 * Team isolation: queries exclusively filter by sprint.teamId = req.user.teamId.
 * This replaces the prior JOIN-through-ScrumMaster approach which was fragile
 * when a sprint had no Scrum Master assigned yet.
 *
 * Temporal-first matching: uses the IST date range WITHOUT filtering by status.
 * A PENDING sprint whose scheduled window has arrived is treated as active for
 * RBAC purposes even before the JIT engine has run.
 *
 * COMPLETED sprints are explicitly excluded.
 */
const resolveActiveSprint = async (req, res, next) => {
  try {
    req.activeSprint = null;
    req.isTemporalScrumMaster = false;

    if (!req.user) {
      return next();
    }

    const teamId = req.user.teamId;
    if (teamId === null || teamId === undefined) {
      return next();
    }

    const todayIST = getTodayIST();

    // Find the active/temporal sprint for this team directly via teamId on the sprint.
    const activeSprint = await Sprint.findOne({
      where: {
        teamId,
        startDate: { [Op.lte]: todayIST },
        endDate:   { [Op.gte]: todayIST },
        status:    { [Op.ne]: 'COMPLETED' },
      },
      include: [
        {
          model: User,
          as: 'ScrumMaster',
          attributes: ['id', 'name', 'employeeId', 'teamId'],
          required: false,
        },
      ],
    });

    if (activeSprint) {
      // JIT auto-promotion: if the sprint is still PENDING but its window is open,
      // promote it to ACTIVE (complete any other ACTIVE sprint for this team first).
      if (activeSprint.status === 'PENDING') {
        const existingActive = await Sprint.findOne({
          where: {
            status: 'ACTIVE',
            teamId,
            id: { [Op.ne]: activeSprint.id },
          },
        });
        if (existingActive) {
          await existingActive.update({ status: 'COMPLETED' });
        }
        await activeSprint.update({ status: 'ACTIVE' });
      }

      req.activeSprint = activeSprint;
      req.isTemporalScrumMaster = activeSprint.scrumMasterId === req.user.id;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = resolveActiveSprint;
