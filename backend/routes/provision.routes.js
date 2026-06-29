const express = require('express');
const provisionController = require('../controllers/provision.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authenticate);

// Enforce strict air-gap check requiring SuperAdmin role
router.use((req, res, next) => {
  if (req.user.systemRole !== 'SuperAdmin') {
    return res.status(403).json({
      message: 'Air-gap violation: IT clearance required.',
    });
  }
  next();
});

router.get('/teams', provisionController.getTeams);
router.post('/identity', provisionController.provisionIdentity);

module.exports = router;
