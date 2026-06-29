const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

/**
 * GET /api/v1/provision/teams
 * Fetches distinct team IDs and manager names currently held by users where systemRole === 'Admin/Manager'
 */
const getTeams = async (req, res, next) => {
  try {
    const managers = await User.findAll({
      where: {
        systemRole: 'Admin/Manager',
      },
      attributes: ['teamId', 'name'],
      order: [['teamId', 'ASC']],
    });

    const teams = [];
    const seenTeams = new Set();
    for (const manager of managers) {
      if (
        manager.teamId !== null &&
        manager.teamId !== undefined &&
        manager.teamId !== 0 &&
        !seenTeams.has(manager.teamId)
      ) {
        seenTeams.add(manager.teamId);
        teams.push({
          teamId: manager.teamId,
          managerName: manager.name,
        });
      }
    }

    return res.status(200).json(teams);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/provision/identity
 * Provision a new user identity (Manager or Employee)
 */
const provisionIdentity = async (req, res, next) => {
  try {
    const { fullName, email, password, systemRole, teamId, jobTitle } = req.body;

    if (!fullName || !email || !password || !systemRole) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if email already exists
    const existingUser = await User.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        normalizedEmail
      ),
    });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Auto-generate unique sequential employeeId
    const maxUser = await User.findOne({ order: [['id', 'DESC']] });
    const nextIndex = maxUser ? maxUser.id + 1 : 1;
    let employeeId = `YT-2026-${String(nextIndex).padStart(3, '0')}`;

    // Fallback to timestamp if employeeId collision occurs
    const existingEmployee = await User.findOne({ where: { employeeId } });
    if (existingEmployee) {
      employeeId = `YT-2026-${Date.now().toString().slice(-4)}`;
    }

    // Parse teamId
    let mappedTeamId = teamId === 'null' || teamId === null || teamId === undefined ? null : parseInt(teamId, 10);
    if (isNaN(mappedTeamId)) {
      mappedTeamId = null;
    }

    let managerId = null;
    if (systemRole === 'Employee' && mappedTeamId !== null) {
      // Find the manager of this team
      const teamManager = await User.findOne({
        where: {
          systemRole: 'Admin/Manager',
          teamId: mappedTeamId,
        },
      });
      if (teamManager) {
        managerId = teamManager.id;
      }
    }

    const newUser = await User.create({
      employeeId,
      name: fullName,
      email: normalizedEmail,
      passwordHash,
      systemRole,
      teamId: mappedTeamId,
      managerId,
      jobTitle: jobTitle || null,
    });

    const sanitized = {
      id: newUser.id,
      employeeId: newUser.employeeId,
      name: newUser.name,
      email: newUser.email,
      systemRole: newUser.systemRole,
      teamId: newUser.teamId,
      managerId: newUser.managerId,
      jobTitle: newUser.jobTitle,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    return res.status(201).json(sanitized);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeams,
  provisionIdentity,
};
