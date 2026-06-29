const { User } = require('../models');

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/users/assignees
// Returns the set of users who are valid assignees for the requesting role.
//
//   Admin/Manager or Temporal SM  → all users on req.user.teamId
//   Employee                      → strictly [req.user] (self-only)
//
// The resolveActiveSprint middleware must run first so req.isTemporalScrumMaster
// is populated before this handler executes.
// ──────────────────────────────────────────────────────────────────────────────
const getEligibleAssignees = async (req, res, next) => {
  try {
    const { user } = req;
    const isManager = user.systemRole === 'Admin/Manager';
    const isSM = req.isTemporalScrumMaster === true;

    let assignees;

    if (isManager || isSM) {
      assignees = await User.findAll({
        where: { teamId: user.teamId },
        attributes: ['id', 'employeeId', 'name', 'systemRole'],
        order: [['name', 'ASC']],
      });
      // Return plain objects so the response is serialisable.
      assignees = assignees.map((u) => u.get({ plain: true }));
    } else {
      // Employee — they may only assign to themselves.
      assignees = [
        {
          id: user.id,
          employeeId: user.employeeId,
          name: user.name,
          systemRole: user.systemRole,
        },
      ];
    }

    return res.status(200).json({
      success: true,
      assignees,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEligibleAssignees };
