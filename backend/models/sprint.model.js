const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Sprint Model
 * Represents a 2-week agile development sprint cycle.
 */
const Sprint = sequelize.define('Sprint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
    comment: 'Primary identifier for the sprint',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Sprint name/identifier (e.g. Sprint 32)',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'start_date',
    comment: 'Start date of the sprint cycle',
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'end_date',
    comment: 'End date of the sprint cycle',
  },
  scrumMasterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'scrum_master_id',
    references: {
      model: 'users',
      key: 'id',
    },
    comment: 'Temporal Scrum Master assigned for this sprint duration',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'ACTIVE', 'COMPLETED'),
    allowNull: false,
    defaultValue: 'PENDING',
    comment: 'Lifecycle stage of the sprint',
  },
  teamId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Nullable initially for safety with backfill migrations, backfilled at startup
    field: 'team_id',
    comment: 'Team identifier for the sprint cycle',
  },
}, {
  tableName: 'sprints',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeValidate: async (sprint) => {
      if (sprint.teamId === null || sprint.teamId === undefined) {
        if (sprint.scrumMasterId) {
          const User = sequelize.models.User;
          if (User) {
            const sm = await User.findByPk(sprint.scrumMasterId, { attributes: ['teamId'] });
            if (sm && sm.teamId !== null && sm.teamId !== undefined) {
              sprint.teamId = sm.teamId;
            }
          }
        }
        if (sprint.teamId === null || sprint.teamId === undefined) {
          sprint.teamId = 1;
        }
      }
    },
  },
  indexes: [
    { fields: ['scrum_master_id'] },
    { fields: ['team_id'] },
  ],
});

module.exports = Sprint;
