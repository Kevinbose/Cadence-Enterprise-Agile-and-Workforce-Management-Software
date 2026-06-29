const { AttendanceRecord } = require('../models');
const { calculateHaversineDistance } = require('../utils/haversine');

// ──────────────────────────────────────────────────────────────────────────────
// IST Midnight Trap Fix:
// Always derive the calendar date in IST so that late-night punches
// (e.g. 1:15 AM IST = 7:45 PM UTC previous day) resolve correctly.
// ──────────────────────────────────────────────────────────────────────────────
const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/attendance/punch-in
// Body: { lat: Number, lng: Number }
//
// Morning Lock: establishes geofence status for the entire day.
// Sets isActiveSession = true and starts the first working chunk.
// ──────────────────────────────────────────────────────────────────────────────
const punchIn = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates (lat, lng) are required.',
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates must be valid numeric values.',
      });
    }

    const todayIST = getTodayIST();

    // ── Duplicate punch-in guard ─────────────────────────────────────────
    const existingRecord = await AttendanceRecord.findOne({
      where: { userId: req.user.id, date: todayIST },
    });

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message:
          'Active shift already initialized. Use Resume to continue working.',
      });
    }

    // ── Geofence calculation ─────────────────────────────────────────────
    const officeLat = parseFloat(process.env.OFFICE_LATITUDE);
    const officeLng = parseFloat(process.env.OFFICE_LONGITUDE);
    const geofenceRadius =
      parseFloat(process.env.GEOFENCE_RADIUS_METERS) || 100;

    const distanceMeters = calculateHaversineDistance(
      userLat,
      userLng,
      officeLat,
      officeLng
    );

    const attendanceStatus =
      distanceMeters <= geofenceRadius ? 'PRESENT_OFFICE' : 'WFH_PENDING';

    const now = new Date();

    // ── Create record — first chunk begins ───────────────────────────────
    const record = await AttendanceRecord.create({
      userId: req.user.id,
      date: todayIST,
      checkInTime: now,
      lastResumeTime: now,
      isActiveSession: true,
      checkInLat: userLat,
      checkInLng: userLng,
      status: attendanceStatus,
      workHours: 0.0,
      isStandupLocked: false,
    });

    return res.status(201).json({
      success: true,
      message:
        attendanceStatus === 'PRESENT_OFFICE'
          ? 'Punched in. You are within the office perimeter.'
          : 'Punched in as WFH Pending. Location is outside the office geofence.',
      distanceMeters: Math.round(distanceMeters),
      record,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/attendance/pause
//
// Pauses the active session:
//  1. Calculates chunk hours since lastResumeTime.
//  2. Accumulates into workHours.
//  3. Flips isActiveSession = false.
//
// The employee can log off, drive home, etc. Their accumulated hours
// are safely stored in MySQL.
// ──────────────────────────────────────────────────────────────────────────────
const pauseShift = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();

    const record = await AttendanceRecord.findOne({
      where: { userId: req.user.id, date: todayIST },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No active shift found for today. Please punch in first.',
      });
    }

    if (record.isStandupLocked) {
      return res.status(403).json({
        success: false,
        message: 'Shift permanently closed for today. Cannot pause.',
      });
    }

    if (!record.isActiveSession) {
      return res.status(400).json({
        success: false,
        message:
          'Shift is already paused. Use Resume to start a new work chunk.',
      });
    }

    // ── Calculate this chunk's hours ─────────────────────────────────────
    const now = new Date();
    const chunkMs = now.getTime() - new Date(record.lastResumeTime).getTime();
    const chunkHours = chunkMs / (1000 * 60 * 60);
    const newTotal = parseFloat(
      (parseFloat(record.workHours) + chunkHours).toFixed(2)
    );

    await record.update({
      workHours: newTotal,
      checkOutTime: now,
      isActiveSession: false,
    });

    await record.reload();

    return res.status(200).json({
      success: true,
      message: `Shift paused. ${chunkHours.toFixed(2)} hrs added. Total: ${newTotal} hrs.`,
      record,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/attendance/resume
//
// Resumes a paused shift:
//  1. Sets lastResumeTime = NOW (starts a new chunk).
//  2. Flips isActiveSession = true.
//
// Note: The geofence status from the morning is NOT recalculated.
// HR always sees the original morning classification.
// ──────────────────────────────────────────────────────────────────────────────
const resumeShift = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();

    const record = await AttendanceRecord.findOne({
      where: { userId: req.user.id, date: todayIST },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No shift found for today. Please punch in first.',
      });
    }

    if (record.isStandupLocked) {
      return res.status(403).json({
        success: false,
        message:
          'Shift permanently closed for today. Cannot resume a sealed day.',
      });
    }

    if (record.isActiveSession) {
      return res.status(400).json({
        success: false,
        message: 'Shift is already active. Pause it first before resuming.',
      });
    }

    await record.update({
      lastResumeTime: new Date(),
      isActiveSession: true,
    });

    await record.reload();

    return res.status(200).json({
      success: true,
      message: `Shift resumed. Accumulated hours so far: ${parseFloat(record.workHours).toFixed(2)} hrs.`,
      record,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/attendance/punch-out
//
// End Day Completely:
//  1. If session was active, calculates and accumulates the final chunk.
//  2. Seals the ledger: isActiveSession = false, isStandupLocked = true.
//  3. No more pause/resume possible for this IST date.
// ──────────────────────────────────────────────────────────────────────────────
const punchOut = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();

    const record = await AttendanceRecord.findOne({
      where: { userId: req.user.id, date: todayIST },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No shift found for today. Please punch in first.',
      });
    }

    if (record.isStandupLocked) {
      return res.status(403).json({
        success: false,
        message: 'Day has already been sealed. Cannot end day again.',
      });
    }

    const now = new Date();
    let finalTotal = parseFloat(record.workHours);

    // If session was active, accumulate the final running chunk
    if (record.isActiveSession && record.lastResumeTime) {
      const chunkMs =
        now.getTime() - new Date(record.lastResumeTime).getTime();
      const chunkHours = chunkMs / (1000 * 60 * 60);
      finalTotal = parseFloat((finalTotal + chunkHours).toFixed(2));
    }

    await record.update({
      workHours: finalTotal,
      checkOutTime: now,
      isActiveSession: false,
      isStandupLocked: true,
    });

    await record.reload();

    return res.status(200).json({
      success: true,
      message: `Day sealed. Total logged: ${finalTotal} hrs.`,
      record,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/attendance/today
//
// Page-Refresh Rehydration: returns today's record (or null) and checks for
// any outstanding system-auto-closed shifts requiring regularization.
// ──────────────────────────────────────────────────────────────────────────────
const getTodayStatus = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();

    const record = await AttendanceRecord.findOne({
      where: { userId: req.user.id, date: todayIST },
    });

    // Check for ANY past shift that was swept and has no justification reason yet
    const pendingRegularization = await AttendanceRecord.findOne({
      where: {
        userId: req.user.id,
        systemAutoClosed: true,
        regularizationReason: null,
      },
    });

    return res.status(200).json({
      success: true,
      record: record || null,
      pendingRegularization: pendingRegularization || null,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/attendance/regularize
// Body: { reason: String }
//
// Submits a regularization reason for a swept shift to unlock the user's dashboard.
// ──────────────────────────────────────────────────────────────────────────────
const submitRegularization = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A regularization reason is required.',
      });
    }

    // Find the outstanding hostage record
    const record = await AttendanceRecord.findOne({
      where: {
        userId: req.user.id,
        systemAutoClosed: true,
        regularizationReason: null,
      },
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No pending auto-closed shift requires regularization.',
      });
    }

    await record.update({
      regularizationReason: reason.trim(),
    });

    await record.reload();

    return res.status(200).json({
      success: true,
      message: 'Regularization reason submitted. Account unlocked.',
      record,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  punchIn,
  pauseShift,
  resumeShift,
  punchOut,
  getTodayStatus,
  submitRegularization,
};
