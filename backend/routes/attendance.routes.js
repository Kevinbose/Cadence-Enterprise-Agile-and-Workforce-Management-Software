const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth.middleware');
const {
  punchIn,
  pauseShift,
  resumeShift,
  punchOut,
  getTodayStatus,
  submitRegularization,
} = require('../controllers/attendance.controller');

// All attendance routes require a valid Bearer JWT.

// POST /api/v1/attendance/punch-in    — Morning geofence lock + start first chunk
router.post('/punch-in', authenticate, punchIn);

// PATCH /api/v1/attendance/pause      — Pause active session (accumulate chunk hours)
router.patch('/pause', authenticate, pauseShift);

// PATCH /api/v1/attendance/resume     — Resume paused session (start new chunk)
router.patch('/resume', authenticate, resumeShift);

// PUT /api/v1/attendance/punch-out    — End Day Completely (seal ledger)
router.put('/punch-out', authenticate, punchOut);

// GET /api/v1/attendance/today        — Rehydration on page refresh
router.get('/today', authenticate, getTodayStatus);

// PATCH /api/v1/attendance/regularize  — Submit justification for auto-closed shifts
router.patch('/regularize', authenticate, submitRegularization);

module.exports = router;
