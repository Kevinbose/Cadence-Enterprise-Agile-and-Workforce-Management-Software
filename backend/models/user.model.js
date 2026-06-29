const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * User Model
 * Represents employees, managers, and scrum masters in the platform.
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
    comment: 'Primary identifier for the user',
  },
  employeeId: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    field: 'employee_id',
    comment: 'Unique corporate employee ID (e.g. YT-2026-001)',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Full name of the employee',
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
    validate: {
      isEmail: {
        msg: 'Must be a valid email address',
      },
    },
    comment: 'Work email address of the employee',
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
    comment: 'Hashed password for authentication',
  },
  systemRole: {
    type: DataTypes.ENUM('Employee', 'Admin/Manager', 'SuperAdmin'),
    defaultValue: 'Employee',
    allowNull: false,
    field: 'system_role',
    comment: 'Role within the platform for permissions access',
  },
  teamId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'team_id',
    comment: 'Reference identifier for the team assignment',
  },
  managerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'manager_id',
    references: {
      model: 'users',
      key: 'id',
    },
    comment: 'Self-referential link pointing to the user\'s direct manager',
  },
  jobTitle: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'job_title',
    comment: 'Corporate job title or staff designation',
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['employee_id'],
    },
    {
      unique: true,
      fields: ['email'],
    },
    {
      fields: ['manager_id'],
    },
    {
      fields: ['team_id'],
    },
  ],
});

module.exports = User;
