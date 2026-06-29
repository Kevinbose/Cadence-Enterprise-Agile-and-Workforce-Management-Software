const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/password', authenticate, authController.changePassword);

module.exports = router;
