/**
 * verifyModels.js
 * End-to-end validation script for Yakkay Tech Sequelize models.
 *
 * Validates:
 *   - Database connectivity
 *   - Table creation via sequelize.sync()
 *   - All 5 entity schemas and expected attributes
 *   - 9 association groups defined in models/index.js
 *   - Task afterUpdate audit hook (status / title / description)
 *
 * Usage:
 *   node scripts/verifyModels.js            # sync + verify + cleanup test rows
 *   node scripts/verifyModels.js --force    # drop & recreate all tables (destructive)
 *   node scripts/verifyModels.js --keep-data # leave seeded verification rows in DB
 */

const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';

dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const FORCE_SYNC = process.argv.includes('--force');
const KEEP_DATA = process.argv.includes('--keep-data');

const PASS = [];
const FAIL = [];

const assert = (label, condition, detail = '') => {
  if (condition) {
    PASS.push(label);
    console.log(`  ✓ ${label}`);
  } else {
    FAIL.push({ label, detail });
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const EXPECTED_TABLES = ['users', 'sprints', 'tasks', 'audit_logs', 'comments'];

const EXPECTED_MODEL_ATTRS = {
  User: [
    'id',
    'employeeId',
    'name',
    'email',
    'passwordHash',
    'systemRole',
    'teamId',
    'managerId',
    'createdAt',
    'updatedAt',
  ],
  Sprint: ['id', 'name', 'startDate', 'endDate', 'scrumMasterId', 'createdAt', 'updatedAt'],
  Task: [
    'id',
    'title',
    'description',
    'type',
    'status',
    'boardSortOrder',
    'assigneeId',
    'sprintId',
    'parentId',
    'createdAt',
    'updatedAt',
  ],
  AuditLog: [
    'id',
    'taskId',
    'userId',
    'fieldChanged',
    'oldValue',
    'newValue',
    'changedAt',
  ],
  Comment: [
    'id',
    'taskId',
    'authorId',
    'content',
    'evaluationTier',
    'createdAt',
    'updatedAt',
  ],
};

const verifyModelAttributes = (Model, modelName) => {
  const raw = Object.keys(Model.rawAttributes);
  const expected = EXPECTED_MODEL_ATTRS[modelName];
  const missing = expected.filter((attr) => !raw.includes(attr));
  const extra = raw.filter((attr) => !expected.includes(attr));
  assert(
    `${modelName} model has all expected attributes`,
    missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : extra.length ? `extra: ${extra.join(', ')}` : ''
  );
};

const verifyAssociations = (Model, modelName, checks) => {
  const allAssocs = Object.values(Model.associations);

  for (const { alias, type, target } of checks) {
    const assoc = allAssocs.find(
      (a) =>
        a.associationType === type &&
        a.target.name === target &&
        (alias ? a.as === alias : true)
    );

    assert(
      `${modelName} ${type} association → ${target}${alias ? ` (as: ${alias})` : ''}`,
      Boolean(assoc),
      assoc ? undefined : 'association not registered'
    );
  }
};

const run = async () => {
  console.log('\n========================================');
  console.log(' Yakkay Tech — Sequelize Model Verifier');
  console.log('========================================\n');

  const { sequelize, User, Sprint, Task, AuditLog, Comment } = require('../models');

  const testIds = {
    managerId: null,
    employeeId: null,
    sprintId: null,
    storyId: null,
    subtaskId: null,
    commentId: null,
  };

  try {
    // ── 1. Database connectivity ──────────────────────────────────────────
    console.log('[1/6] Database connectivity');
    await sequelize.authenticate();
    assert('Database connection established', true);

    // ── 2. Schema sync ────────────────────────────────────────────────────
    console.log('\n[2/6] Schema synchronization');
    if (FORCE_SYNC) {
      console.warn('  ⚠ --force flag: dropping and recreating all tables');
      await sequelize.sync({ force: true });
    } else {
      await sequelize.sync({ alter: true });
    }
    assert('sequelize.sync() completed without error', true);

    const tables = await sequelize.getQueryInterface().showAllTables();
    for (const table of EXPECTED_TABLES) {
      assert(`Table "${table}" exists`, tables.includes(table));
    }

    // ── 3. Model attribute definitions ────────────────────────────────────
    console.log('\n[3/6] Model attribute definitions');
    verifyModelAttributes(User, 'User');
    verifyModelAttributes(Sprint, 'Sprint');
    verifyModelAttributes(Task, 'Task');
    verifyModelAttributes(AuditLog, 'AuditLog');
    verifyModelAttributes(Comment, 'Comment');

    assert('User.systemRole ENUM includes Employee', User.rawAttributes.systemRole.values.includes('Employee'));
    assert(
      'User.systemRole ENUM includes Admin/Manager',
      User.rawAttributes.systemRole.values.includes('Admin/Manager')
    );
    assert('Task.type ENUM includes Story', Task.rawAttributes.type.values.includes('Story'));
    assert('Task.status ENUM includes To Do', Task.rawAttributes.status.values.includes('To Do'));
    assert(
      'Comment.evaluationTier ENUM includes Positive',
      Comment.rawAttributes.evaluationTier.values.includes('Positive')
    );

    // ── 4. Association wiring ─────────────────────────────────────────────
    console.log('\n[4/6] Association wiring');
    verifyAssociations(User, 'User', [
      { alias: 'Manager', type: 'BelongsTo', target: 'User' },
      { alias: 'DirectReports', type: 'HasMany', target: 'User' },
      { type: 'HasMany', target: 'Task' },
      { type: 'HasMany', target: 'Sprint' },
      { type: 'HasMany', target: 'Comment' },
      { type: 'HasMany', target: 'AuditLog' },
    ]);
    verifyAssociations(Sprint, 'Sprint', [
      { alias: 'ScrumMaster', type: 'BelongsTo', target: 'User' },
      { type: 'HasMany', target: 'Task' },
    ]);
    verifyAssociations(Task, 'Task', [
      { alias: 'Assignee', type: 'BelongsTo', target: 'User' },
      { type: 'BelongsTo', target: 'Sprint' },
      { alias: 'Subtasks', type: 'HasMany', target: 'Task' },
      { alias: 'Parent', type: 'BelongsTo', target: 'Task' },
      { type: 'HasMany', target: 'Comment' },
      { type: 'HasMany', target: 'AuditLog' },
    ]);
    verifyAssociations(Comment, 'Comment', [
      { type: 'BelongsTo', target: 'Task' },
      { alias: 'Author', type: 'BelongsTo', target: 'User' },
    ]);
    verifyAssociations(AuditLog, 'AuditLog', [
      { type: 'BelongsTo', target: 'Task' },
      { type: 'BelongsTo', target: 'User' },
    ]);

    // ── 5. CRUD + relationship integration tests ──────────────────────────
    console.log('\n[5/6] CRUD and relationship integration');

    const passwordHash = await bcrypt.hash('VerifyTest@2026', 10);

    const manager = await User.create({
      employeeId: `YT-VERIFY-MGR-${Date.now()}`,
      name: 'Verify Manager',
      email: `verify.manager.${Date.now()}@yakkaytech.test`,
      passwordHash,
      systemRole: 'Admin/Manager',
      teamId: 1,
    });
    testIds.managerId = manager.id;
    assert('Created manager User record', !!manager.id);

    const employee = await User.create({
      employeeId: `YT-VERIFY-EMP-${Date.now()}`,
      name: 'Verify Employee',
      email: `verify.employee.${Date.now()}@yakkaytech.test`,
      passwordHash,
      systemRole: 'Employee',
      teamId: 1,
      managerId: manager.id,
    });
    testIds.employeeId = employee.id;
    assert('Created employee User with managerId FK', employee.managerId === manager.id);

    const employeeWithManager = await User.findByPk(employee.id, {
      include: [{ model: User, as: 'Manager' }],
    });
    assert(
      'User → Manager self-referential association resolves',
      employeeWithManager.Manager?.id === manager.id
    );

    const directReports = await manager.getDirectReports();
    assert(
      'User → DirectReports self-referential association resolves',
      directReports.some((u) => u.id === employee.id)
    );

    const sprint = await Sprint.create({
      name: `Verify Sprint ${Date.now()}`,
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      scrumMasterId: manager.id,
    });
    testIds.sprintId = sprint.id;
    assert('Created Sprint with scrumMasterId FK', sprint.scrumMasterId === manager.id);

    const story = await Task.create({
      title: 'Verify Story — Authentication Module',
      description: 'Initial verification story for model integration tests',
      type: 'Story',
      status: 'To Do',
      boardSortOrder: 1,
      assigneeId: employee.id,
      sprintId: sprint.id,
    });
    testIds.storyId = story.id;
    assert('Created Story Task assigned to sprint and employee', !!story.id);

    const subtask = await Task.create({
      title: 'Verify Subtask — Write unit tests',
      description: 'Child subtask under verification story',
      type: 'Subtask',
      status: 'To Do',
      boardSortOrder: 1,
      assigneeId: employee.id,
      sprintId: sprint.id,
      parentId: story.id,
    });
    testIds.subtaskId = subtask.id;
    assert('Created Subtask with parentId self-reference', subtask.parentId === story.id);

    const storyWithChildren = await Task.findByPk(story.id, {
      include: [{ model: Task, as: 'Subtasks' }],
    });
    assert(
      'Task → Subtasks self-referential association resolves',
      storyWithChildren.Subtasks.some((t) => t.id === subtask.id)
    );

    const comment = await Comment.create({
      taskId: story.id,
      authorId: manager.id,
      content: 'Verification comment — solid progress on the story.',
      evaluationTier: 'Positive',
    });
    testIds.commentId = comment.id;
    assert('Created Comment on Task by manager', comment.taskId === story.id);

    const taskWithComments = await Task.findByPk(story.id, {
      include: [
        { model: Comment },
        { model: User, as: 'Assignee' },
        { model: Sprint },
      ],
    });
    assert('Task includes Comment association', taskWithComments.Comments.length >= 1);
    assert('Task includes Assignee association', taskWithComments.Assignee?.id === employee.id);
    assert('Task includes Sprint association', taskWithComments.Sprint?.id === sprint.id);

    // ── 6. Audit hook verification ────────────────────────────────────────
    console.log('\n[6/6] Task afterUpdate audit hook');

    const auditCountBefore = await AuditLog.count({ where: { taskId: story.id } });

    await story.update(
      { status: 'In Progress', title: 'Verify Story — Authentication Module (Updated)' },
      { userId: manager.id }
    );

    const auditLogs = await AuditLog.findAll({
      where: { taskId: story.id },
      order: [['changedAt', 'ASC']],
    });

    assert(
      'Audit hook created entries for status change',
      auditLogs.some((log) => log.fieldChanged === 'status' && log.oldValue === 'To Do' && log.newValue === 'In Progress')
    );
    assert(
      'Audit hook created entries for title change',
      auditLogs.some((log) => log.fieldChanged === 'title' && log.newValue.includes('Updated'))
    );
    assert(
      'Audit log records modifying userId from options context',
      auditLogs.every((log) => log.userId === manager.id)
    );
    assert(
      'Audit log count increased after task update',
      auditLogs.length > auditCountBefore
    );

    const taskWithAudit = await Task.findByPk(story.id, {
      include: [{ model: AuditLog }],
    });
    assert('Task → AuditLog association resolves', taskWithAudit.AuditLogs.length >= 2);

  } catch (error) {
    FAIL.push({ label: 'Unhandled script error', detail: error.message });
    console.error('\n  ✗ Unhandled error:', error.message);
    if (process.env.DEBUG) console.error(error);
  } finally {
    if (!KEEP_DATA) {
      console.log('\n[cleanup] Removing verification test rows...');
      const { sequelize, User, Sprint, Task, AuditLog, Comment } = require('../models');

      try {
        if (testIds.commentId) await Comment.destroy({ where: { id: testIds.commentId }, force: true });
        if (testIds.subtaskId) await Task.destroy({ where: { id: testIds.subtaskId }, force: true });
        if (testIds.storyId) {
          await AuditLog.destroy({ where: { taskId: testIds.storyId }, force: true });
          await Comment.destroy({ where: { taskId: testIds.storyId }, force: true });
          await Task.destroy({ where: { id: testIds.storyId }, force: true });
        }
        if (testIds.sprintId) await Sprint.destroy({ where: { id: testIds.sprintId }, force: true });
        if (testIds.employeeId) await User.destroy({ where: { id: testIds.employeeId }, force: true });
        if (testIds.managerId) await User.destroy({ where: { id: testIds.managerId }, force: true });
        console.log('  ✓ Test data cleaned up');
      } catch (cleanupError) {
        console.warn('  ⚠ Cleanup warning:', cleanupError.message);
      }
    } else {
      console.log('\n[cleanup] Skipped — test rows retained (--keep-data)');
    }

    await sequelize.close();
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    console.error('Failed checks:');
    FAIL.forEach(({ label, detail }) => console.error(`  • ${label}${detail ? `: ${detail}` : ''}`));
    process.exit(1);
  }

  console.log('All model verifications passed.\n');
  process.exit(0);
};

run();
