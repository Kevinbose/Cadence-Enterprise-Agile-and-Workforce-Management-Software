/**
 * Integration Test Suite — Module 5: Sprint Gateway & Immutable Audit Engine
 * Run from the backend directory:
 *   node test/audit.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task, AuditLog } = require('../models');
const {
  getAllSprints,
  createSprint,
  startSprint,
  assignScrumMaster,
  editSprint,
} = require('../controllers/sprint.controller');
const { getSprintAudits } = require('../controllers/audit.controller');
const { createIssue, updateTaskStatus, editIssue, deleteIssue } = require('../controllers/task.controller');
const resolveActiveSprint = require('../middlewares/resolveActiveSprint.middleware');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const PASS = [];
const FAIL = [];

const assert = (label, condition, detail = '') => {
  if (condition) {
    PASS.push(label);
    console.log(`  ✅ ${label}`);
  } else {
    FAIL.push({ label, detail });
    console.error(`  🚨 ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const mockRes = (resolve) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; resolve(this); return this; },
  };
  return res;
};

const callController = (controller, req) =>
  new Promise((resolve, reject) => {
    const res = mockRes(resolve);
    controller(req, res, (err) => {
      if (err) reject(err);
      else resolve(res);
    });
  });

// ─── State shared across tests ────────────────────────────────────────────────
let manager, employee, smUser;
let pendingSprint, activeSprint;
let createdTask;

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🧪 Starting Sprint Gateway & Immutable Audit Engine Test Suite...\n');

(async () => {
  // ── 0. Setup ─────────────────────────────────────────────────────────────
  try {
    await sequelize.authenticate();
    console.log('🔗 Connected to MySQL database.');

    // Disable FK checks so the old audit_logs FK on tasks.id doesn't block
    // the table drop when re-syncing to the new schema (soft-ref model).
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🏗  Schema rebuilt with Module 5 models.\n');
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }

  // ── Seed users ─────────────────────────────────────────────────────────────
  const today = getTodayIST();

  manager = await User.create({
    employeeId: 'YT-MGR-001',
    name: 'Alice Manager',
    email: 'alice@yakkay.com',
    passwordHash: 'hash',
    systemRole: 'Admin/Manager',
    teamId: 1,
  });

  employee = await User.create({
    employeeId: 'YT-EMP-001',
    name: 'Bob Employee',
    email: 'bob@yakkay.com',
    passwordHash: 'hash',
    systemRole: 'Employee',
    teamId: 1,
  });

  smUser = await User.create({
    employeeId: 'YT-SM-001',
    name: 'Carol SM',
    email: 'carol@yakkay.com',
    passwordHash: 'hash',
    systemRole: 'Employee',
    teamId: 1,
  });

  // ── Suite 1: Sprint Gateway ───────────────────────────────────────────────
  console.log('── Suite 1: Sprint Gateway\n');

  // 1.1 getAllSprints — empty list
  let res = await callController(getAllSprints, {
    user: manager,
    isTemporalScrumMaster: false,
    activeSprint: null,
  });
  assert('GET /sprints — returns empty array initially', res.statusCode === 200 && Array.isArray(res.body.sprints) && res.body.sprints.length === 0);

  // 1.2 createSprint — employee forbidden
  res = await callController(createSprint, {
    user: employee,
    body: { name: 'Sprint 1', startDate: today, endDate: addDays(today, 14) },
  });
  assert('POST /sprints — Employee is denied (403)', res.statusCode === 403);

  // 1.3 createSprint — Manager success (startDate = today so start is allowed)
  res = await callController(createSprint, {
    user: manager,
    body: { name: 'Sprint Alpha', startDate: today, endDate: addDays(today, 14) },
  });
  assert('POST /sprints — Manager creates PENDING sprint', res.statusCode === 201 && res.body.sprint.status === 'PENDING', JSON.stringify(res.body));
  pendingSprint = res.body.sprint;

  // 1.3b Force Start Now — succeeds regardless of scheduled startDate, pins startDate to today
  const futureStartRes = await callController(createSprint, {
    user: manager,
    body: { name: 'Sprint Future Start', startDate: addDays(today, 7), endDate: addDays(today, 21) },
  });
  const futureStartSprint = futureStartRes.body.sprint;
  res = await callController(startSprint, {
    user: manager,
    params: { id: futureStartSprint.id },
  });
  assert(
    'PATCH /sprints/:id/start — Force Start Now ignores scheduled date → 200, ACTIVE, startDate=today',
    res.statusCode === 200 && res.body.sprint.status === 'ACTIVE' && res.body.sprint.startDate === today,
    JSON.stringify(res.body)
  );
  // futureStartSprint is now ACTIVE (startDate=today). Sprint Alpha stays PENDING.

  // 1.4 createSprint — missing fields
  res = await callController(createSprint, {
    user: manager,
    body: { name: '' },
  });
  assert('POST /sprints — Rejects missing fields (400)', res.statusCode === 400);

  // 1.5 assignScrumMaster — Manager assigns SM
  res = await callController(assignScrumMaster, {
    user: manager,
    params: { id: pendingSprint.id },
    body: { scrumMasterId: smUser.id },
  });
  assert('PATCH /sprints/:id/scrummaster — Manager assigns Carol as SM', res.statusCode === 200 && res.body.sprint.scrumMasterId === smUser.id, JSON.stringify(res.body));

  // 1.6 assignScrumMaster — Employee forbidden
  res = await callController(assignScrumMaster, {
    user: employee,
    params: { id: pendingSprint.id },
    body: { scrumMasterId: smUser.id },
  });
  assert('PATCH /sprints/:id/scrummaster — Employee is denied (403)', res.statusCode === 403);

  // 1.6b editSprint — Manager updates PENDING sprint (future startDate keeps it PENDING)
  res = await callController(editSprint, {
    user: manager,
    params: { id: pendingSprint.id },
    body: { name: 'Sprint Alpha (Revised)', startDate: addDays(today, 3), endDate: addDays(today, 17) },
  });
  assert(
    'PATCH /sprints/:id/edit — Manager edits PENDING sprint, future dates → stays PENDING (200)',
    res.statusCode === 200 && res.body.sprint.name === 'Sprint Alpha (Revised)' && res.body.sprint.status === 'PENDING',
    JSON.stringify(res.body)
  );
  pendingSprint = res.body.sprint;

  // 1.6c editSprint — Employee forbidden
  res = await callController(editSprint, {
    user: employee,
    params: { id: pendingSprint.id },
    body: { name: 'Hacked', startDate: today, endDate: addDays(today, 14) },
  });
  assert('PATCH /sprints/:id/edit — Employee is denied (403)', res.statusCode === 403);

  // 1.7 Force Start Now — PENDING sprint → ACTIVE (auto-completes the other ACTIVE sprint)
  res = await callController(startSprint, {
    user: manager,
    params: { id: pendingSprint.id },
  });
  assert('PATCH /sprints/:id/start — Force Start auto-completes existing ACTIVE, activates PENDING → 200', res.statusCode === 200 && res.body.sprint.status === 'ACTIVE', JSON.stringify(res.body));
  activeSprint = res.body.sprint;

  // 1.8 startSprint — cannot force-start a non-PENDING (already ACTIVE) sprint
  res = await callController(startSprint, {
    user: manager,
    params: { id: activeSprint.id },
  });
  assert('PATCH /sprints/:id/start — Already ACTIVE sprint → 400', res.statusCode === 400, JSON.stringify(res.body));

  // 1.8b editSprint — Manager can edit ACTIVE sprint (valid future endDate keeps it ACTIVE)
  res = await callController(editSprint, {
    user: manager,
    params: { id: activeSprint.id },
    body: { name: 'Sprint Alpha (Active Edit)', startDate: today, endDate: addDays(today, 14) },
  });
  assert(
    'PATCH /sprints/:id/edit — Manager edits ACTIVE sprint → stays ACTIVE (200)',
    res.statusCode === 200 && res.body.sprint.name === 'Sprint Alpha (Active Edit)' && res.body.sprint.status === 'ACTIVE',
    JSON.stringify(res.body)
  );

  // 1.8c editSprint temporal auto-complete — moving endDate to the past completes the sprint
  res = await callController(editSprint, {
    user: manager,
    params: { id: activeSprint.id },
    body: { name: 'Sprint Alpha (Active Edit)', startDate: addDays(today, -7), endDate: addDays(today, -1) },
  });
  assert(
    'PATCH /sprints/:id/edit — endDate in the past → auto-transitions to COMPLETED (200)',
    res.statusCode === 200 && res.body.sprint.status === 'COMPLETED',
    JSON.stringify(res.body)
  );

  // 1.9 Force Start auto-complete — starting a second PENDING sprint auto-completes the current ACTIVE
  //     (Sprint Alpha is now COMPLETED from 1.8c, so this activates cleanly)
  const secondSprintRes = await callController(createSprint, {
    user: manager,
    body: { name: 'Sprint Beta', startDate: addDays(today, 1), endDate: addDays(today, 28) },
  });
  const secondSprint = secondSprintRes.body.sprint;
  res = await callController(startSprint, {
    user: manager,
    params: { id: secondSprint.id },
  });
  assert('PATCH /sprints/:id/start — Force Start on second PENDING → 200, ACTIVE', res.statusCode === 200 && res.body.sprint.status === 'ACTIVE', JSON.stringify(res.body));

  // ── Suite 2: Audit Hook Enforcement ──────────────────────────────────────
  console.log('\n── Suite 2: Audit Hook Enforcement (ORM level)\n');

  // 2.1 Task.create() without userId throws
  let caughtCreate = false;
  try {
    await Task.create({
      title: 'No-actor task',
      type: 'Task',
      status: 'TODO',
      isConfidential: false,
      creatorId: manager.id,
      sprintId: activeSprint.id,
    });
    // If we reach here, hook did NOT throw — fail
  } catch (err) {
    caughtCreate = err.message.includes('[Audit]');
  }
  assert('afterCreate hook throws when userId is missing', caughtCreate);

  // 2.2 Task.create() WITH userId succeeds and logs CREATE audit entry
  const rawTask = await Task.create(
    {
      title: 'Audited Task',
      type: 'Task',
      status: 'TODO',
      isConfidential: false,
      creatorId: manager.id,
      sprintId: activeSprint.id,
    },
    { userId: manager.id }
  );
  createdTask = rawTask;

  const createLog = await AuditLog.findOne({
    where: { taskId: rawTask.id, action: 'CREATE' },
  });
  assert('afterCreate hook writes CREATE audit log', !!createLog, 'no CREATE log found');
  assert('CREATE audit log has correct changes snapshot', createLog?.changes?.title === 'Audited Task' && createLog?.changes?.type === 'Task', JSON.stringify(createLog?.changes));
  assert('CREATE audit log has correct sprintId', createLog?.sprintId === activeSprint.id, `expected ${activeSprint.id}, got ${createLog?.sprintId}`);

  // 2.3 Task.update() without userId throws
  let caughtUpdate = false;
  try {
    await rawTask.update({ status: 'IN_PROGRESS' });
  } catch (err) {
    caughtUpdate = err.message.includes('[Audit]');
  }
  assert('afterUpdate hook throws when userId is missing', caughtUpdate);

  // 2.4 Task.update() WITH userId logs UPDATE audit entry with diff
  await rawTask.update({ status: 'IN_PROGRESS', title: 'Audited Task (revised)' }, { userId: manager.id });
  const updateLog = await AuditLog.findOne({
    where: { taskId: rawTask.id, action: 'UPDATE' },
  });
  assert('afterUpdate hook writes UPDATE audit log with field diff', !!updateLog, 'no UPDATE log found');
  assert('UPDATE diff contains status change', updateLog?.changes?.status?.old === 'TODO' && updateLog?.changes?.status?.new === 'IN_PROGRESS', JSON.stringify(updateLog?.changes));
  assert('UPDATE diff contains title change', updateLog?.changes?.title?.old === 'Audited Task' && updateLog?.changes?.title?.new === 'Audited Task (revised)', JSON.stringify(updateLog?.changes));

  // 2.4b Multi-field edit — type, description, and assigneeId all captured in one diff
  await rawTask.update(
    { type: 'Story', description: 'Updated desc', assigneeId: manager.id },
    { userId: manager.id }
  );
  const multiFieldLog = await AuditLog.findOne({
    where: { taskId: rawTask.id, action: 'UPDATE' },
    order: [['createdAt', 'DESC']],
  });
  assert(
    'afterUpdate hook captures all changed fields in a single UPDATE entry',
    multiFieldLog?.changes?.type?.old === 'Task' &&
      multiFieldLog?.changes?.type?.new === 'Story' &&
      multiFieldLog?.changes?.description?.new === 'Updated desc' &&
      multiFieldLog?.changes?.assigneeId?.new === manager.id,
    JSON.stringify(multiFieldLog?.changes)
  );

  // 2.5 afterUpdate does NOT log if no audited fields changed (boardSortOrder is not audited)
  const logsBeforeNoOp = await AuditLog.count({ where: { taskId: rawTask.id } });
  await rawTask.update({ boardSortOrder: 5 }, { userId: manager.id });
  const logsAfterNoOp = await AuditLog.count({ where: { taskId: rawTask.id } });
  assert('afterUpdate does NOT write log when no audited fields changed', logsBeforeNoOp === logsAfterNoOp, `before=${logsBeforeNoOp} after=${logsAfterNoOp}`);

  // 2.6 Task.destroy() without userId throws (individualHooks: true required for hook to fire)
  const disposableTask = await Task.create(
    { title: 'Disposable', type: 'Subtask', status: 'TODO', isConfidential: false, creatorId: manager.id, sprintId: activeSprint.id },
    { userId: manager.id }
  );
  let caughtDestroy = false;
  try {
    await Task.destroy({ where: { id: disposableTask.id }, individualHooks: true });
  } catch (err) {
    caughtDestroy = err.message.includes('[Audit]');
  }
  // Re-create if destroy succeeded (it shouldn't have, but clean up either way)
  assert('afterDestroy hook throws when userId is missing', caughtDestroy);

  // 2.7 Task.destroy() WITH userId logs DELETE audit entry; taskId is null in the log
  const taskToDelete = await Task.create(
    { title: 'To Be Vaporized', type: 'Task', status: 'TODO', isConfidential: false, creatorId: manager.id, sprintId: activeSprint.id },
    { userId: manager.id }
  );
  const deleteTaskId = taskToDelete.id;
  const deleteIssueKey = taskToDelete.issueKey;

  await Task.destroy({
    where: { id: taskToDelete.id },
    individualHooks: true,
    userId: manager.id,
  });

  const deleteLog = await AuditLog.findOne({
    where: { action: 'DELETE', sprintId: activeSprint.id },
    order: [['createdAt', 'DESC']],
  });
  assert('afterDestroy hook writes DELETE audit log', !!deleteLog, 'no DELETE log found');
  assert('DELETE audit log has taskId = null (soft ref)', deleteLog?.taskId === null, `taskId = ${deleteLog?.taskId}`);
  assert('DELETE audit log preserves issueKey in changes JSON', deleteLog?.changes?.issueKey === deleteIssueKey, `expected ${deleteIssueKey}, got ${deleteLog?.changes?.issueKey}`);
  assert('DELETE audit log preserves task id in changes JSON', deleteLog?.changes?.id === deleteTaskId, `expected ${deleteTaskId}, got ${deleteLog?.changes?.id}`);

  // 2.8 deleteIssue controller — CREATE history must survive cascade deletion
  const cascadeTask = await Task.create(
    {
      title: 'Cascade Preserve Test',
      type: 'Task',
      status: 'TODO',
      isConfidential: false,
      creatorId: manager.id,
      sprintId: activeSprint.id,
    },
    { userId: manager.id }
  );
  const createLogId = (
    await AuditLog.findOne({
      where: { taskId: cascadeTask.id, action: 'CREATE' },
    })
  )?.id;
  assert('CREATE audit log exists before deleteIssue', !!createLogId);

  const deleteRes = await callController(deleteIssue, {
    user: manager,
    params: { id: cascadeTask.id },
    isTemporalScrumMaster: false,
    activeSprint: null,
  });
  assert('deleteIssue controller succeeds (200)', deleteRes.statusCode === 200, JSON.stringify(deleteRes.body));

  const preservedCreateLog = await AuditLog.findByPk(createLogId);
  assert('CREATE audit log survives deleteIssue', !!preservedCreateLog);
  assert(
    'CREATE audit log taskId detached after delete (soft ref)',
    preservedCreateLog?.taskId === null,
    `taskId = ${preservedCreateLog?.taskId}`
  );
  assert(
    'CREATE audit log still grouped by sprintId',
    preservedCreateLog?.sprintId === activeSprint.id,
    `sprintId = ${preservedCreateLog?.sprintId}`
  );

  const deleteLogsForTask = await AuditLog.count({
    where: { sprintId: activeSprint.id, action: 'DELETE' },
  });
  assert('DELETE audit log appended after deleteIssue', deleteLogsForTask >= 1);

  // ── Suite 3: Controller-level createIssue now passes userId ──────────────
  console.log('\n── Suite 3: createIssue controller passes userId to hook\n');

  // Build a mock req for createIssue controller
  const futureDate = addDays(today, 2);
  const futureSprint = await Sprint.create({
    name: 'Sprint Future',
    startDate: futureDate,
    endDate: addDays(today, 16),
    status: 'PENDING',
  });

  const mockActiveSprint = {
    id: futureSprint.id,
    startDate: futureSprint.startDate,
    endDate: futureSprint.endDate,
    status: futureSprint.status,
  };

  const createReq = {
    user: { ...manager.get({ plain: true }), id: manager.id },
    body: { title: 'Controller Epic', type: 'Epic', assigneeId: manager.id, description: 'Epic via controller' },
    activeSprint: mockActiveSprint,
    isTemporalScrumMaster: false,
  };

  const createRes = await callController(createIssue, createReq);
  assert('createIssue controller — creates Epic without throwing (userId passed)', createRes.statusCode === 201, JSON.stringify(createRes.body));

  const controllerLog = await AuditLog.findOne({
    where: { taskId: createRes.body.task?.id, action: 'CREATE' },
  });
  assert('createIssue controller — CREATE audit log written by hook', !!controllerLog, 'no log for controller-created task');

  // ── Suite 4: Audit Ledger API ─────────────────────────────────────────────
  console.log('\n── Suite 4: getSprintAudits API\n');

  // 4.1 Employee is denied
  res = await callController(getSprintAudits, {
    user: employee,
    isTemporalScrumMaster: false,
    params: { sprintId: String(activeSprint.id) },
  });
  assert('GET /audits/sprints/:id — Employee is denied (403)', res.statusCode === 403);

  // 4.2 Manager can fetch audit ledger
  res = await callController(getSprintAudits, {
    user: manager,
    isTemporalScrumMaster: false,
    params: { sprintId: String(activeSprint.id) },
  });
  assert('GET /audits/sprints/:id — Manager retrieves audit ledger (200)', res.statusCode === 200, JSON.stringify(res.body));
  assert('Audit ledger contains log entries', Array.isArray(res.body.logs) && res.body.logs.length > 0, `count=${res.body.count}`);
  assert('Audit ledger includes sprint context', res.body.sprint?.id === activeSprint.id, JSON.stringify(res.body.sprint));

  // 4.3 Active SM (carol) can fetch audit ledger
  res = await callController(getSprintAudits, {
    user: smUser,
    isTemporalScrumMaster: true,
    params: { sprintId: String(activeSprint.id) },
  });
  assert('GET /audits/sprints/:id — Temporal SM retrieves audit ledger (200)', res.statusCode === 200);

  // 4.4 Non-existent sprint returns 404
  res = await callController(getSprintAudits, {
    user: manager,
    isTemporalScrumMaster: false,
    params: { sprintId: '999999' },
  });
  assert('GET /audits/sprints/:id — Non-existent sprint returns 404', res.statusCode === 404);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log('\n🔌 Closing database connections...\n');
  await sequelize.close();

  // ── Results ───────────────────────────────────────────────────────────────
  const total = PASS.length + FAIL.length;
  console.log('========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    console.error('Failed tests:');
    FAIL.forEach(({ label, detail }) => console.error(`  🚨 ${label}${detail ? `\n     ${detail}` : ''}`));
    process.exit(1);
  } else {
    console.log('🎉 All Sprint Gateway & Audit Engine tests passed successfully.\n');
    process.exit(0);
  }
})();
