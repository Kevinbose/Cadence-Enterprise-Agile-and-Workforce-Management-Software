const { Op } = require('sequelize');
const { TempManagerGrant } = require('../models');

/**
 * Resolve an active JIT temp-manager grant for an Employee.
 * Returns the grant row or null. Never mutates the database.
 */
const resolveTempManagerGrant = async (userId) => {
  const now = new Date();

  return TempManagerGrant.findOne({
    where: {
      granteeId: userId,
      isActive: true,
      startTime: { [Op.lte]: now },
      endTime: { [Op.gt]: now },
    },
  });
};

/**
 * Apply request-scoped elevation flags to a user object (Sequelize instance or plain).
 */
const applyTempManagerElevation = (user, grant) => {
  if (!user || !grant) return user;

  user.systemRole = 'Admin/Manager';
  user.isTempManager = true;
  user.tempGrantId = grant.id;
  user.tempTeamId = grant.teamId;

  return user;
};

module.exports = {
  resolveTempManagerGrant,
  applyTempManagerElevation,
};
