const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize, User, Sprint } = require('../models');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const sanitizeUser = (user) => ({
  id: user.id,
  employeeId: user.employeeId,
  name: user.name,
  email: user.email,
  systemRole: user.systemRole,
  teamId: user.teamId,
  managerId: user.managerId,
});

const resolveTemporalScrumMaster = async (userId) => {
  const todayIST = getTodayIST();

  const activeSprint = await Sprint.findOne({
    where: {
      scrumMasterId: userId,
      startDate: { [Op.lte]: todayIST },
      endDate: { [Op.gte]: todayIST },
    },
  });

  return !!activeSprint;
};

const buildUserPayload = async (user) => {
  const isTemporalScrumMaster = await resolveTemporalScrumMaster(user.id);

  return {
    ...sanitizeUser(user),
    isTemporalScrumMaster,
  };
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        normalizedEmail
      ),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        systemRole: user.systemRole,
        teamId: user.teamId,
        employeeId: user.employeeId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const userPayload = await buildUserPayload(user);

    return res.status(200).json({
      success: true,
      token,
      user: userPayload,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const userPayload = await buildUserPayload(req.user);

    return res.status(200).json({
      success: true,
      user: userPayload,
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password',
      });
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await user.update({ passwordHash: newHashed });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  changePassword,
};
