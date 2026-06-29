const requireRole = (allowedRolesArray) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!allowedRolesArray.includes(req.user.systemRole)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient system privileges',
    });
  }

  next();
};

module.exports = requireRole;
