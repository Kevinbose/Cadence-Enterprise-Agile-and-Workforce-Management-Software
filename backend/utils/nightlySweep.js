const cron = require('node-cron');
const { Op } = require('sequelize');
const { AttendanceRecord } = require('../models');

// Helper to get current IST date (YYYY-MM-DD)
const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Performs the sweep logic for all open shifts up to and including targetDate.
 * Caps workHours at 8.00 and sets systemAutoClosed flag.
 */
const runSweep = async (targetDate) => {
  try {
    console.log(`[Nightly Sweep] Sweep started for date boundary <= ${targetDate}`);

    // Find any record that is still open (isStandupLocked = false)
    // We check for any record on or before targetDate to catch today's forgotten shifts
    // as well as any older shifts that remained unclosed.
    const openRecords = await AttendanceRecord.findAll({
      where: {
        isStandupLocked: false,
        date: {
          [Op.lte]: targetDate,
        },
      },
    });

    console.log(`[Nightly Sweep] Found ${openRecords.length} open shift record(s) to sweep.`);

    for (const record of openRecords) {
      let totalHours = parseFloat(record.workHours || 0);

      // If the shift is currently active, calculate the final chunk until the sweep execution time
      if (record.isActiveSession && record.lastResumeTime) {
        // Set the sweep cutoff to 11:55 PM IST of the record's date
        const sweepCutoff = new Date(`${record.date}T23:55:00+05:30`);
        const lastResume = new Date(record.lastResumeTime);

        const diffMs = sweepCutoff.getTime() - lastResume.getTime();
        const chunkHours = Math.max(0, diffMs / (1000 * 60 * 60));
        totalHours = parseFloat((totalHours + chunkHours).toFixed(2));
      }

      // Cap at 8.00 hours
      const cappedHours = totalHours > 8.00 ? 8.00 : totalHours;

      // Check-out time is set to 11:55 PM IST of the record's date
      const checkOutTime = new Date(`${record.date}T23:55:00+05:30`);

      await record.update({
        checkOutTime,
        workHours: cappedHours,
        isStandupLocked: true,
        systemAutoClosed: true,
        isActiveSession: false,
      });

      console.log(
        `[Nightly Sweep] Auto-closed record ID ${record.id} for User ${record.userId} on ${record.date}. Hours logged: ${cappedHours}`
      );
    }

    console.log('[Nightly Sweep] Sweep execution completed.');
  } catch (error) {
    console.error('[Nightly Sweep] Error running sweep daemon:', error);
  }
};

// Schedule the daemon to run daily at 11:55 PM IST (23:55 Asia/Kolkata)
const task = cron.schedule(
  '55 23 * * *',
  () => {
    const todayIST = getTodayIST();
    runSweep(todayIST);
  },
  {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  }
);

console.log('⏰ [Nightly Sweep] Daemon initialized. Scheduled for 11:55 PM IST daily.');

module.exports = {
  task,
  runSweep,
};
