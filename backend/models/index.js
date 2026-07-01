const { sequelize } = require('../config/database');

// ──────────────────────────────────────────────────────────────────────────────
// Load order: base entities first, then dependents, then Task (registers hooks)
// AttendanceRecord loaded last among new models as it only depends on User.
// ──────────────────────────────────────────────────────────────────────────────
const User = require('./user.model');
const Sprint = require('./sprint.model');
const AuditLog = require('./auditLog.model');
const Comment = require('./comment.model');
const Task = require('./task.model');
const AttendanceRecord = require('./attendanceRecord.model');
const TempManagerGrant = require('./tempManagerGrant.model');

// ==========================================
// 1. User Self-Referential (Manager ↔ Reports)
// ==========================================
User.belongsTo(User, { as: 'Manager', foreignKey: 'managerId' });
User.hasMany(User, { as: 'DirectReports', foreignKey: 'managerId' });

// ==========================================
// 2. User ↔ Task (Assignee)
// ==========================================
User.hasMany(Task, { foreignKey: 'assigneeId' });
Task.belongsTo(User, { as: 'Assignee', foreignKey: 'assigneeId' });

// ==========================================
// 2b. User ↔ Task (Creator)
// ==========================================
User.hasMany(Task, { as: 'CreatedTasks', foreignKey: 'creatorId' });
Task.belongsTo(User, { as: 'Creator', foreignKey: 'creatorId' });

// ==========================================
// 3. User ↔ Sprint (Scrum Master)
// ==========================================
User.hasMany(Sprint, { foreignKey: 'scrumMasterId' });
Sprint.belongsTo(User, { as: 'ScrumMaster', foreignKey: 'scrumMasterId' });

// ==========================================
// 4. Sprint ↔ Task (Sprint Backlog)
// ==========================================
Sprint.hasMany(Task, { foreignKey: 'sprintId' });
Task.belongsTo(Sprint, { foreignKey: 'sprintId' });

// ==========================================
// 4b. Sprint ↔ Task (Original Sprint latch — rollover origin)
// constraints: false — a task's origin sprint may be COMPLETED and must remain
// referenceable without triggering FK cascade side-effects on sprint changes.
// ==========================================
Sprint.hasMany(Task, { as: 'OriginalTasks', foreignKey: 'originalSprintId', constraints: false });
Task.belongsTo(Sprint, { as: 'OriginalSprint', foreignKey: 'originalSprintId', constraints: false });

// ==========================================
// 5. Task Self-Referential (Parent ↔ Subtasks)
// ==========================================
Task.hasMany(Task, { as: 'Subtasks', foreignKey: 'parentId' });
Task.belongsTo(Task, { as: 'Parent', foreignKey: 'parentId' });

// ==========================================
// 6. Task ↔ Comment
// ==========================================
Task.hasMany(Comment, { foreignKey: 'taskId' });
Comment.belongsTo(Task, { foreignKey: 'taskId' });

// ==========================================
// 7. User ↔ Comment (Authorship)
// ==========================================
User.hasMany(Comment, { foreignKey: 'authorId' });
Comment.belongsTo(User, { as: 'Author', foreignKey: 'authorId' });

// ==========================================
// 8. Task ↔ AuditLog
// constraints: false — taskId is a soft reference so DELETE audit entries
// survive the destruction of the task they describe.
// ==========================================
Task.hasMany(AuditLog, { foreignKey: 'taskId', constraints: false });
AuditLog.belongsTo(Task, { foreignKey: 'taskId', constraints: false });

// ==========================================
// 9. User ↔ AuditLog
// ==========================================
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

// ==========================================
// 11. Sprint ↔ AuditLog (Sprint-level audit grouping)
// ==========================================
Sprint.hasMany(AuditLog, { foreignKey: 'sprintId' });
AuditLog.belongsTo(Sprint, { foreignKey: 'sprintId' });

// ==========================================
// 10. User ↔ AttendanceRecord
// ==========================================
User.hasMany(AttendanceRecord, {
  foreignKey: 'userId',
  as: 'AttendanceRecords',
});
AttendanceRecord.belongsTo(User, {
  foreignKey: 'userId',
  as: 'Employee',
});
AttendanceRecord.belongsTo(User, {
  foreignKey: 'adjudicatedBy',
  as: 'Adjudicator',
});

// ==========================================
// 12. User ↔ TempManagerGrant (Temporal Delegation)
// ==========================================
User.hasMany(TempManagerGrant, {
  as: 'GrantsAsGrantor',
  foreignKey: 'grantorId',
});
User.hasMany(TempManagerGrant, {
  as: 'GrantsAsGrantee',
  foreignKey: 'granteeId',
});
TempManagerGrant.belongsTo(User, {
  as: 'Grantor',
  foreignKey: 'grantorId',
});
TempManagerGrant.belongsTo(User, {
  as: 'Grantee',
  foreignKey: 'granteeId',
});

module.exports = {
  sequelize,
  User,
  Sprint,
  Task,
  AuditLog,
  Comment,
  AttendanceRecord,
  TempManagerGrant,
};
