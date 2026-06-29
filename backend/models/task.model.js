const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Task Model — Atlassian Kanban Engine
 * Represents an Epic, Story, Task, or Subtask in the agile system.
 * Supports issue-key generation, the 5-column compliance workflow,
 * a confidentiality engine, creator tracking, and anti-tampering auditing.
 */
const Task = sequelize.define(
  'Task',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      comment: 'Primary identifier for the task',
    },
    issueKey: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      field: 'issue_key',
      comment: 'Human-readable issue key (e.g. YT-104), auto-generated on create',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Task title',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the task requirements',
    },
    type: {
      type: DataTypes.ENUM('Epic', 'Story', 'Task', 'Subtask'),
      allowNull: false,
      comment: 'The classification of the item',
    },
    status: {
      type: DataTypes.ENUM(
        'TODO',
        'IN_PROGRESS',
        'IN_REVIEW',
        'QA_TESTING',
        'DONE'
      ),
      defaultValue: 'TODO',
      allowNull: false,
      comment: 'Strict 5-column workflow status state',
    },
    isConfidential: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_confidential',
      comment: 'When true, only managers and the assignee may view this task',
    },
    boardSortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      field: 'board_sort_order',
      comment: 'Order value to manage Kanban drag-and-drop hierarchy',
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'creator_id',
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'Reference to the user who created the issue',
    },
    assigneeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'assignee_id',
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'Reference to the assigned employee',
    },
    sprintId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sprint_id',
      references: {
        model: 'sprints',
        key: 'id',
      },
      comment: 'Reference to the sprint (null for backlog items)',
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'parent_id',
      references: {
        model: 'tasks',
        key: 'id',
      },
      comment:
        'Self-referential link pointing to parent Epic/Story/Task for hierarchies',
    },
  },
  {
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        name: 'uq_tasks_issue_key',
        fields: ['issue_key'],
      },
      {
        fields: ['creator_id'],
      },
      {
        fields: ['assignee_id'],
      },
      {
        fields: ['sprint_id'],
      },
      {
        fields: ['parent_id'],
      },
      // Composite index for Kanban board queries to retrieve ordered cards efficiently by status
      {
        name: 'idx_tasks_status_sort_order',
        fields: ['status', 'board_sort_order'],
      },
    ],
    hooks: {
      /**
       * beforeCreate — Auto-generates the human-readable issueKey.
       * Uses MAX(id) + 1; safe for 300–500 employee scope without a
       * dedicated sequence table.
       */
      beforeCreate: async (task) => {
        const maxId = await Task.max('id');
        task.issueKey = `YT-${(maxId || 0) + 1}`;
      },

      /**
       * afterCreate — Immutable CREATE audit entry.
       *
       * CRITICAL: options.userId MUST be provided. Any Task.create() call that
       * omits { userId } in the options block will throw a fatal error, ensuring
       * every task creation is actor-attributable and fully traceable.
       */
      afterCreate: async (task, options) => {
        if (!options.userId) {
          throw new Error(
            '[Audit] Missing userId in Task.create() options. ' +
            'All task creations must pass { userId: req.user.id } for auditability.'
          );
        }

        const AuditLog = task.sequelize.models.AuditLog;
        if (!AuditLog) return;

        await AuditLog.create(
          {
            taskId: task.id,
            sprintId: task.sprintId || null,
            userId: options.userId,
            action: 'CREATE',
            changes: {
              id: task.id,
              issueKey: task.issueKey,
              title: task.title,
              description: task.description,
              type: task.type,
              status: task.status,
              isConfidential: task.isConfidential,
              assigneeId: task.assigneeId,
              parentId: task.parentId,
              sprintId: task.sprintId,
            },
          },
          { transaction: options.transaction }
        );
      },

      /**
       * afterUpdate — Immutable UPDATE audit entry.
       *
       * CRITICAL: options.userId MUST be provided. Diffs all mutable audited
       * fields and records only what changed, producing a Git-style diff stored as JSON.
       */
      afterUpdate: async (task, options) => {
        if (!options.userId) {
          throw new Error(
            '[Audit] Missing userId in Task.update() options. ' +
            'All task updates must pass { userId: req.user.id } for auditability.'
          );
        }

        const AUDITED_FIELDS = [
          'title',
          'description',
          'type',
          'status',
          'assigneeId',
          'parentId',
          'isConfidential',
        ];
        const diff = {};

        for (const field of AUDITED_FIELDS) {
          if (task.changed(field)) {
            diff[field] = {
              old: task.previous(field) ?? null,
              new: task.get(field) ?? null,
            };
          }
        }

        if (Object.keys(diff).length === 0) return; // No auditable fields changed

        const AuditLog = task.sequelize.models.AuditLog;
        if (!AuditLog) return;

        await AuditLog.create(
          {
            taskId: task.id,
            sprintId: task.sprintId || null,
            userId: options.userId,
            action: 'UPDATE',
            changes: diff,
          },
          { transaction: options.transaction }
        );
      },

      /**
       * afterDestroy — Immutable DELETE audit entry.
       *
       * CRITICAL: options.userId MUST be provided. taskId is stored as null
       * because the task no longer exists; the full final snapshot is preserved
       * in the `changes` JSON column so the audit record is self-contained.
       */
      afterDestroy: async (task, options) => {
        if (!options.userId) {
          throw new Error(
            '[Audit] Missing userId in Task.destroy() options. ' +
            'All task deletions must pass { userId: req.user.id } for auditability.'
          );
        }

        const AuditLog = task.sequelize.models.AuditLog;
        if (!AuditLog) return;

        // taskId is intentionally null — the task no longer exists in the DB.
        // The full state snapshot is embedded in changes for permanent reference.
        await AuditLog.create(
          {
            taskId: null,
            sprintId: task.sprintId || null,
            userId: options.userId,
            action: 'DELETE',
            changes: {
              id: task.id,
              issueKey: task.issueKey,
              title: task.title,
              description: task.description,
              type: task.type,
              status: task.status,
              isConfidential: task.isConfidential,
              assigneeId: task.assigneeId,
              parentId: task.parentId,
              sprintId: task.sprintId,
            },
          },
          { transaction: options.transaction }
        );
      },
    },
  }
);

module.exports = Task;
