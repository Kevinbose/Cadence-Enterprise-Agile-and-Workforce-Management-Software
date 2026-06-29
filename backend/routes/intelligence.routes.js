const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const { getWorkforceSummary, getEmployeeDossier } = require('../controllers/intelligence.controller');

const managerOnly = [authenticate, requireRole(['Admin/Manager'])];

router.get('/workforce',          managerOnly, getWorkforceSummary);
router.get('/dossier/:userId',    managerOnly, getEmployeeDossier);

module.exports = router;
