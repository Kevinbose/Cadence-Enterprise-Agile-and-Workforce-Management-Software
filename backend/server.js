const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.local';

dotenv.config({ path: path.resolve(__dirname, envFile) });

// ── Require the full models index to:
//    1. Register all Sequelize associations (FK constraints, hooks)
//    2. Ensure AttendanceRecord + all other models are loaded before any route
//    This must come AFTER dotenv so DB_* env vars are available.
const { sequelize } = require('./models');

// Initialize the Nightly Sweep cron daemon
require('./utils/nightlySweep');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const scrumRoutes = require('./routes/scrum.routes');
const taskRoutes = require('./routes/task.routes');
const userRoutes = require('./routes/user.routes');
const sprintRoutes = require('./routes/sprint.routes');
const auditRoutes = require('./routes/audit.routes');
const intelligenceRoutes = require('./routes/intelligence.routes');
const commentRoutes = require('./routes/comment.routes');
const provisionRoutes = require('./routes/provision.routes');

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Yakkay Tech Agile Platform API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/scrum', scrumRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/sprints', sprintRoutes);
app.use('/api/v1/audits', auditRoutes);
app.use('/api/v1/intelligence', intelligenceRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/provision', provisionRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
// Must be defined AFTER all routes. Catches any error passed via next(error).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled Error:`, err.message);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : err.message || 'Internal Server Error',
  });
});

// ── Team Isolation Migration ──────────────────────────────────────────────────
// Idempotent: adds team_id column if absent, then backfills from scrum_master's
// team_id. Runs once per boot; safe on an already-migrated database.
// ── Team Isolation Migration ──────────────────────────────────────────────────
// Idempotent: adds team_id column if absent, then backfills from scrum_master's
// team_id. Runs once per boot; safe on an already-migrated database.
const runTeamIsolationMigration = async () => {
  try {
    // 1. Check if team_id column already exists
    const [cols] = await sequelize.query(
      "SHOW COLUMNS FROM sprints LIKE 'team_id'"
    );
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE sprints ADD COLUMN team_id INT NULL');
      console.log('🔧 Team isolation migration: team_id column added to sprints.');
    }

    // 2. Backfill: derive team_id from the scrum master's team_id
    const [backfillResult] = await sequelize.query(`
      UPDATE sprints s
      JOIN   users   u ON s.scrum_master_id = u.id
      SET    s.team_id = u.team_id
      WHERE  s.team_id IS NULL
        AND  s.scrum_master_id IS NOT NULL
    `);
    if (backfillResult.affectedRows > 0) {
      console.log(`🔧 Team isolation migration: backfilled ${backfillResult.affectedRows} sprint(s).`);
    }

    // 3. Any sprint still without a team_id (no scrum master) defaults to team 1
    const [fallbackResult] = await sequelize.query(
      'UPDATE sprints SET team_id = 1 WHERE team_id IS NULL'
    );
    if (fallbackResult.affectedRows > 0) {
      console.log(`🔧 Team isolation migration: fallback teamId=1 applied to ${fallbackResult.affectedRows} sprint(s).`);
    }

    console.log('✅ Team isolation migration complete.');
  } catch (err) {
    console.error('❌ Team isolation migration failed:', err.message);
    // Non-fatal: server still starts; sprint filtering will be unrestricted until fixed
  }
};

const runITProvisioningMigration = async () => {
  try {
    // 1. Ensure system_role ENUM supports SuperAdmin
    await sequelize.query(`
      ALTER TABLE users MODIFY COLUMN system_role ENUM('Employee', 'Admin/Manager', 'SuperAdmin') NOT NULL DEFAULT 'Employee'
    `);
    console.log('🔧 IT Provisioning migration: system_role ENUM updated.');

    // 2. Ensure job_title column exists in users
    const [cols] = await sequelize.query(
      "SHOW COLUMNS FROM users LIKE 'job_title'"
    );
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE users ADD COLUMN job_title VARCHAR(255) NULL');
      console.log('🔧 IT Provisioning migration: job_title column added to users.');
    }
    console.log('✅ IT Provisioning migration complete.');
  } catch (err) {
    console.error('❌ IT Provisioning migration failed:', err.message);
  }
};

const runBiometricPhotosMigration = async () => {
  try {
    const [cols] = await sequelize.query(
      "SHOW COLUMNS FROM attendance_records LIKE 'punch_in_photo'"
    );
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE attendance_records ADD COLUMN punch_in_photo LONGTEXT NULL');
      await sequelize.query('ALTER TABLE attendance_records ADD COLUMN punch_out_photo LONGTEXT NULL');
      console.log('🔧 Biometric Attendance migration: punch_in_photo and punch_out_photo columns added.');
    }
    console.log('✅ Biometric Attendance migration complete.');
  } catch (err) {
    console.error('❌ Biometric Attendance migration failed:', err.message);
  }
};

const runAdjudicationAuditMigration = async () => {
  try {
    const [cols] = await sequelize.query(
      "SHOW COLUMNS FROM attendance_records LIKE 'adjudicated_by'"
    );
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE attendance_records ADD COLUMN adjudicated_by INT NULL');
      console.log('🔧 Adjudication Audit migration: adjudicated_by column added.');
    }
    console.log('✅ Adjudication Audit migration complete.');
  } catch (err) {
    console.error('❌ Adjudication Audit migration failed:', err.message);
  }
};

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    await runTeamIsolationMigration();
    await runITProvisioningMigration();
    await runBiometricPhotosMigration();
    await runAdjudicationAuditMigration();

    app.listen(PORT, () => {
      console.log(
        `🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`
      );
    });
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
