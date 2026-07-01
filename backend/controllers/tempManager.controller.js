const { Op } = require('sequelize');
const { User, TempManagerGrant } = require('../models');

const resolveTeamId = async (req) => {
  let teamId = req.user.teamId;
  if (teamId === undefined || teamId === null) {
    const dbUser = await User.findByPk(req.user.id, { attributes: ['teamId'] });
    teamId = dbUser?.teamId ?? 1;
  }
  return teamId;
};

const grantStatus = (grant, now = new Date()) => {
  if (!grant || !grant.isActive) return 'revoked';
  if (now < new Date(grant.startTime)) return 'scheduled';
  if (now >= new Date(grant.endTime)) return 'expired';
  return 'active';
};

const serializeGrant = (grant, grantee = null) => {
  if (!grant) return null;
  const status = grantStatus(grant);
  return {
    id: grant.id,
    grantorId: grant.grantorId,
    granteeId: grant.granteeId,
    granteeName: grantee?.name || grant.Grantee?.name || null,
    teamId: grant.teamId,
    startTime: grant.startTime,
    endTime: grant.endTime,
    isActive: grant.isActive,
    status,
  };
};

/**
 * GET /api/v1/temp-manager/team-status
 * Lists all Employees in the manager's team with any linked active grant.
 */
const getTeamStatus = async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const now = new Date();

    const employees = await User.findAll({
      where: {
        teamId,
        systemRole: 'Employee',
      },
      attributes: ['id', 'employeeId', 'name', 'email', 'jobTitle', 'teamId'],
      order: [['name', 'ASC']],
    });

    const activeTeamGrant = await TempManagerGrant.findOne({
      where: {
        teamId,
        isActive: true,
        endTime: { [Op.gt]: now },
      },
      include: [
        {
          model: User,
          as: 'Grantee',
          attributes: ['id', 'name', 'employeeId'],
        },
      ],
      order: [['startTime', 'ASC']],
    });

    const granteeIds = employees.map((e) => e.id);
    const grantsByGrantee = {};

    if (granteeIds.length > 0) {
      const grants = await TempManagerGrant.findAll({
        where: {
          granteeId: { [Op.in]: granteeIds },
          isActive: true,
          endTime: { [Op.gt]: now },
        },
      });
      grants.forEach((g) => {
        grantsByGrantee[g.granteeId] = g;
      });
    }

    const teamList = employees.map((emp) => ({
      id: emp.id,
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      jobTitle: emp.jobTitle,
      teamId: emp.teamId,
      activeGrant: serializeGrant(grantsByGrantee[emp.id], emp),
    }));

    return res.status(200).json({
      success: true,
      teamList,
      activeGrant: serializeGrant(activeTeamGrant, activeTeamGrant?.Grantee),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/temp-manager/grant
 * Creates a time-bounded delegation. One active window per team at a time.
 */
const grantTempManager = async (req, res, next) => {
  try {
    const { granteeId, startTime, endTime } = req.body;
    const teamId = await resolveTeamId(req);

    if (!granteeId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'granteeId, startTime, and endTime are required.',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startTime or endTime.',
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'endTime must be after startTime.',
      });
    }

    const grantee = await User.findOne({
      where: {
        id: granteeId,
        teamId,
        systemRole: 'Employee',
      },
      attributes: ['id', 'name', 'teamId', 'systemRole'],
    });

    if (!grantee) {
      return res.status(404).json({
        success: false,
        message: 'Grantee not found in your team or is not an Employee.',
      });
    }

    const overlapping = await TempManagerGrant.findOne({
      where: {
        teamId,
        isActive: true,
        startTime: { [Op.lt]: end },
        endTime: { [Op.gt]: start },
      },
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'Only one temporary manager is allowed at a time.',
      });
    }

    const grant = await TempManagerGrant.create({
      grantorId: req.user.id,
      granteeId: grantee.id,
      teamId,
      startTime: start,
      endTime: end,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      grant: serializeGrant(grant, grantee),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/temp-manager/revoke/:grantId
 * Early termination — sets isActive = false.
 */
const revokeTempManager = async (req, res, next) => {
  try {
    const grantId = parseInt(req.params.grantId, 10);
    const teamId = await resolveTeamId(req);

    if (Number.isNaN(grantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grantId.',
      });
    }

    const grant = await TempManagerGrant.findOne({
      where: {
        id: grantId,
        grantorId: req.user.id,
        teamId,
      },
      include: [
        {
          model: User,
          as: 'Grantee',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant not found or you are not authorized to revoke it.',
      });
    }

    if (!grant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This delegation has already been revoked.',
      });
    }

    await grant.update({ isActive: false });

    return res.status(200).json({
      success: true,
      grant: serializeGrant(grant, grant.Grantee),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeamStatus,
  grantTempManager,
  revokeTempManager,
};
