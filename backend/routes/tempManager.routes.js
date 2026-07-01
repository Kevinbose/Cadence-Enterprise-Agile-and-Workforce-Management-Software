const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const {
  getTeamStatus,
  grantTempManager,
  revokeTempManager,
} = require('../controllers/tempManager.controller');

// Inception guard — temp managers must not create further delegations.
const requireNotTempManager = (req, res, next) => {
  if (req.user.isTempManager) {
    return res.status(403).json({
      success: false,
      message: 'Temporary managers cannot delegate authority.',
    });
  }
  return next();
};

const trueManagerOnly = [
  authenticate,
  requireRole(['Admin/Manager']),
  requireNotTempManager,
];

router.get('/team-status', trueManagerOnly, getTeamStatus);
router.post('/grant', trueManagerOnly, grantTempManager);
router.patch('/revoke/:grantId', trueManagerOnly, revokeTempManager);

module.exports = router;
