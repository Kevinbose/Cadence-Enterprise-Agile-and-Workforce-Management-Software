const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * AttendanceRecord Model — Accumulator Ledger + Hostage & Sweep Pattern
 */
const AttendanceRecord = sequelize.define(
  'AttendanceRecord',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      comment: 'Primary identifier for the attendance record',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'Foreign key referencing the employee',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'date',
      comment: 'IST calendar date of the shift (YYYY-MM-DD)',
    },
    checkInTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'check_in_time',
      comment: 'UTC timestamp of the first morning punch-in',
    },
    checkOutTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'check_out_time',
      comment: 'UTC timestamp of the most recent pause, sweep, or end-day event',
    },
    checkInLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'check_in_lat',
      comment: 'Latitude captured at morning punch-in for geofence audit',
    },
    checkInLng: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'check_in_lng',
      comment: 'Longitude captured at morning punch-in for geofence audit',
    },
    status: {
      type: DataTypes.ENUM('PRESENT_OFFICE', 'WFH_PENDING', 'WFH_APPROVED', 'ABSENT'),
      allowNull: false,
      defaultValue: 'ABSENT',
      field: 'status',
      comment: 'Geofence-resolved classification — frozen after morning punch-in',
    },
    workHours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'work_hours',
      comment: 'Accumulated decimal hours across all chunks',
    },
    lastResumeTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_resume_time',
      comment: 'Start timestamp of the current active working chunk',
    },
    isActiveSession: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_active_session',
      comment: 'True when actively ticking; False when paused or completed',
    },
    systemAutoClosed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'system_auto_closed',
      comment: 'True if shift was closed automatically by the nightly sweep daemon',
    },
    regularizationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'regularization_reason',
      comment: 'Written explanation provided by employee to unlock their account',
    },
    standupWorkedOn: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'standup_worked_on',
    },
    standupPlan: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'standup_plan',
    },
    standupBlockers: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'standup_blockers',
    },
    isStandupLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_standup_locked',
      comment: 'True after End Day — permanently seals the ledger for today',
    },
    punchInPhoto: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'punch_in_photo',
      comment: 'Base64 image snapshot captured during morning punch-in',
    },
    punchOutPhoto: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'punch_out_photo',
      comment: 'Base64 image snapshot captured during end day punch-out',
    },
    adjudicatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'adjudicated_by',
      comment: 'User ID of the SM or Manager who adjudicated/overrode this attendance status',
    },
  },
  {
    tableName: 'attendance_records',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        name: 'uq_attendance_user_date',
        fields: ['user_id', 'date'],
      },
      {
        name: 'idx_attendance_user_id',
        fields: ['user_id'],
      },
      {
        name: 'idx_attendance_date',
        fields: ['date'],
      },
    ],
  }
);

module.exports = AttendanceRecord;
