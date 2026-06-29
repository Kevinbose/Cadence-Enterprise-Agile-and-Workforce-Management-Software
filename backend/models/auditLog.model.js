const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * AuditLog Model — Module 5: Immutable Audit Engine
 *
 * Stores an immutable event log for every CREATE, UPDATE, and DELETE performed
 * on a Task. The `taskId` column intentionally carries no DB-level FK constraint
 * (see models/index.js associations with constraints: false) so that DELETE
 * audit entries survive the deletion of the referenced task.
 *
 * Schema contract:
 *   action  CREATE  → changes = full task snapshot at creation time
 *   action  UPDATE  → changes = { field: { old, new } } diff object
 *   action  DELETE  → changes = full task snapshot at deletion time; taskId = null
 */
const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    // Soft reference — no DB FK so the log survives task deletion.
    taskId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'task_id',
      comment: 'Soft reference to the task; null when the task has been deleted',
    },

    // Sprint grouping FK — used to retrieve audit feeds per sprint.
    sprintId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sprint_id',
      references: { model: 'sprints', key: 'id' },
      comment: 'Sprint context for grouping audit entries by sprint',
    },

    // Actor FK — nullable to allow system-generated entries.
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      references: { model: 'users', key: 'id' },
      comment: 'The user who triggered this audit event',
    },

    action: {
      type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE'),
      allowNull: false,
      comment: 'The mutation category that produced this log entry',
    },

    changes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        'Payload for CREATE (full snapshot), diff for UPDATE ({field:{old,new}}), snapshot for DELETE',
    },
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,       // Only createdAt is meaningful for immutable audit records
    underscored: true,
    indexes: [
      { fields: ['task_id'] },
      { fields: ['sprint_id'] },
      { fields: ['user_id'] },
      { fields: ['action'] },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = AuditLog;
