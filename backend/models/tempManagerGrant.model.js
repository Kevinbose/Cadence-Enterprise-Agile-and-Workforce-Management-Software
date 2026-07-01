const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * TempManagerGrant — JIT temporal elevation record.
 * Never mutates users.system_role; consumed by auth middleware per request.
 */
const TempManagerGrant = sequelize.define(
  'TempManagerGrant',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    grantorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'grantor_id',
      references: { model: 'users', key: 'id' },
      comment: 'The actual Admin/Manager who issued the delegation',
    },
    granteeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'grantee_id',
      references: { model: 'users', key: 'id' },
      comment: 'The Employee receiving temporary managerial authority',
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'team_id',
      comment: 'Isolated team context — only one active delegation per team window',
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_time',
      comment: 'Delegation becomes effective at this instant (server time)',
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_time',
      comment: 'Delegation expires at this instant (server time)',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      comment: 'False when manually revoked before endTime',
    },
  },
  {
    tableName: 'temp_manager_grants',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['grantor_id'] },
      { fields: ['grantee_id'] },
      { fields: ['team_id'] },
      { fields: ['team_id', 'is_active'] },
      { fields: ['grantee_id', 'is_active'] },
    ],
  }
);

module.exports = TempManagerGrant;
