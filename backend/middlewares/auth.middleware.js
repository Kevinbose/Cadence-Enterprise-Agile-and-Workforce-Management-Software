const jwt = require('jsonwebtoken');
const { User } = require('../models');
const {
  resolveTempManagerGrant,
  applyTempManagerElevation,
} = require('../utils/resolveTempManagerGrant');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        {
          model: User,
          as: 'Manager',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    req.user = user;

    // JIT Temp Manager elevation — request-scoped only, never persists to DB.
    if (user.systemRole === 'Employee') {
      const grant = await resolveTempManagerGrant(user.id);
      if (grant) {
        applyTempManagerElevation(req.user, grant);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
