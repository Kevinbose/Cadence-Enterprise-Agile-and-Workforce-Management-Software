const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Comment Model
 * Represents user comments/evaluations associated with tasks.
 */
const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
    comment: 'Primary identifier for the comment',
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'task_id',
    references: {
      model: 'tasks',
      key: 'id',
    },
    comment: 'The associated task ID',
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'author_id',
    references: {
      model: 'users',
      key: 'id',
    },
    comment: 'The user who authored the comment',
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Textual content of the comment',
  },
  evaluationTier: {
    type: DataTypes.ENUM('Positive', 'Negative (Simple)', 'Negative (Serious)'),
    allowNull: true,
    field: 'evaluation_tier',
    comment:
      'Optional manager/SM evaluation rating for HR analytics. Null for regular comments.',
  },
}, {
  tableName: 'comments',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['task_id'],
    },
    {
      fields: ['author_id'],
    },
  ],
});

module.exports = Comment;
