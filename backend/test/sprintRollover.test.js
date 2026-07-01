/**
 * Integration Test Suite — Module 7: Automated Sprint Rollover & Overdue Mgmt
 * Run from the backend directory:
 *   node test/sprintRollover.test.js
 *
 * Focus areas (maps 1:1 to the plan's test matrix):
 *   1  Force-starting a sprint migrates all non-DONE tasks from COMPLETED sprints
 *   2  DONE tasks are NOT migrated (stay in their original completed sprint)
 *   3  originalSprintId is set on first rollover and NOT overwritten later (latch)
 *   4  rolloverCount increments across 3 consecutive sprint rollovers
 *   5  Hierarchy fracture: parent of a rolled-over child is also moved forward
 *   6  DONE siblings of a rolled-over child stay in the completed sprint
 *   7  getAllSprints JIT auto-activation also triggers rollover
 *   8  editSprint JIT activation also triggers rollover
 *   9  Rollover respects team isolation (Team 2 tasks untouched by Team 1 start)
 *   10 Board response includes rolloverCount + originalSprintId on task objects
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task } = require('../models');
const { executeRollover } = require('../utils/sprintRollover');
const {
  startSprint,
  getAllSprints,
  editSprint,
} = require('../controllers/sprint.controller');
const { getSprintBoard } = require('../controllers/task.controller');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
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

const mockResponse = (resolve) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      if (resolve) resolve({ res });
      return this;
    },
  };
  return res;
};

const runController = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = mockResponse(resolve);
    handler(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ res, req });
    });
  });

const mkTask = (overrides, userId) =>
  Task.create(
    {
      title: overrides.title || 'Task',
      type: overrides.type || 'Task',
      status: overrides.status || 'IN_PROGRESS',
      creatorId: userId,
      assigneeId: overrides.assigneeId ?? null,
      sprintId: overrides.sprintId,
      parentId: overrides.parentId ?? null,
    },
    { userId }
  );

const runTests = async () => {
  console.log('🧪 Starting Automated Sprint Rollover Test Suite...\n');

  try {
    await sequelize.authenticate();
    console.log('🔗 Connected to MySQL database.');

    await sequelize.sync({ force: true });
    console.log('🔄 Database synced and truncated (force: true).\n');

    const today = getTodayIST();

    // ── Users ────────────────────────────────────────────────────────────────
    const superAdmin = await User.create({
      employeeId: 'YT-ADMIN-001',
      name: 'IT Administrator',
      email: 'admin@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'SuperAdmin',
      teamId: null,
    });
    const managerA = await User.create({
      employeeId: 'YT-MGR-001',
      name: 'Manager A',
      email: 'managerA@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Admin/Manager',
      teamId: 1,
    });
    const employeeA = await User.create({
      employeeId: 'YT-EMP-001',
      name: 'Employee A',
      email: 'employeeA@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee',
      teamId: 1,
    });
    const managerB = await User.create({
      employeeId: 'YT-MGR-002',
      name: 'Manager B',
      email: 'managerB@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Admin/Manager',
      teamId: 2,
    });
    console.log('👥 Seeded users (incl. SuperAdmin for robust system-user resolution).\n');

    // ══════════════════════════════════════════════════════════════════════
    // [1/10] + [2/10] Force Start migrates non-DONE; DONE tasks stay behind
    // ══════════════════════════════════════════════════════════════════════
    console.log('[1-2/10] Force Start migration + DONE exclusion...');

    const completed1 = await Sprint.create({
      name: 'T1 Completed Sprint',
      startDate: addDays(today, -14),
      endDate: addDays(today, -1),
      status: 'COMPLETED',
      teamId: 1,
    });

    const carriedInProg = await mkTask(
      { title: 'Carried IN_PROGRESS', status: 'IN_PROGRESS', sprintId: completed1.id },
      managerA.id
    );
    const carriedTodo = await mkTask(
      { title: 'Carried TODO', status: 'TODO', sprintId: completed1.id },
      managerA.id
    );
    const stayDone = await mkTask(
      { title: 'Finished DONE', status: 'DONE', sprintId: completed1.id },
      managerA.id
    );

    const pending1 = await Sprint.create({
      name: 'T1 Next Sprint',
      startDate: addDays(today, 3),
      endDate: addDays(today, 17),
      status: 'PENDING',
      teamId: 1,
    });

    const resStart = await runController(startSprint, {
      user: managerA,
      params: { id: String(pending1.id) },
    });
    assert('Force Start returns 200', resStart.res.statusCode === 200, JSON.stringify(resStart.res.body));

    const inProgReload = await Task.findByPk(carriedInProg.id);
    const todoReload = await Task.findByPk(carriedTodo.id);
    const doneReload = await Task.findByPk(stayDone.id);

    assert(
      'IN_PROGRESS task migrated to the newly started sprint',
      inProgReload.sprintId === pending1.id,
      `got sprintId=${inProgReload.sprintId}`
    );
    assert(
      'TODO task migrated to the newly started sprint',
      todoReload.sprintId === pending1.id
    );
    assert(
      'DONE task NOT migrated — stays in the completed sprint',
      doneReload.sprintId === completed1.id
    );
    assert(
      'Migrated tasks latched originalSprintId to the completed sprint',
      inProgReload.originalSprintId === completed1.id &&
        todoReload.originalSprintId === completed1.id
    );
    assert(
      'DONE task keeps null originalSprintId and rolloverCount 0',
      doneReload.originalSprintId === null && doneReload.rolloverCount === 0
    );
    assert(
      'rolloverCount incremented to 1 on first migration',
      inProgReload.rolloverCount === 1 && todoReload.rolloverCount === 1
    );

    // ══════════════════════════════════════════════════════════════════════
    // [3/10] + [4/10] originalSprintId latch + rolloverCount across 3 rollovers
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[3-4/10] Multi-rollover latch idempotency + count increment...');

    const sA = await Sprint.create({
      name: 'Multi A', startDate: addDays(today, -40), endDate: addDays(today, -31),
      status: 'COMPLETED', teamId: 1,
    });
    const multiTask = await mkTask(
      { title: 'Perennial straggler', status: 'IN_PROGRESS', sprintId: sA.id },
      managerA.id
    );

    // Rollover #1 → sB
    const sB = await Sprint.create({
      name: 'Multi B', startDate: addDays(today, 30), endDate: addDays(today, 40),
      status: 'ACTIVE', teamId: 1,
    });
    await executeRollover(sB, { systemUserId: managerA.id });
    let mReload = await Task.findByPk(multiTask.id);
    assert('Rollover #1 → count 1, origin latched to sA', mReload.rolloverCount === 1 && mReload.originalSprintId === sA.id);

    // Complete sB, rollover #2 → sC
    await sB.update({ status: 'COMPLETED' });
    const sC = await Sprint.create({
      name: 'Multi C', startDate: addDays(today, 50), endDate: addDays(today, 60),
      status: 'ACTIVE', teamId: 1,
    });
    await executeRollover(sC, { systemUserId: managerA.id });
    mReload = await Task.findByPk(multiTask.id);
    assert('Rollover #2 → count 2, origin STILL sA (not overwritten)', mReload.rolloverCount === 2 && mReload.originalSprintId === sA.id);

    // Complete sC, rollover #3 → sD
    await sC.update({ status: 'COMPLETED' });
    const sD = await Sprint.create({
      name: 'Multi D', startDate: addDays(today, 70), endDate: addDays(today, 80),
      status: 'ACTIVE', teamId: 1,
    });
    await executeRollover(sD, { systemUserId: managerA.id });
    mReload = await Task.findByPk(multiTask.id);
    assert('Rollover #3 → count 3, origin STILL sA (latch held across 3 hops)', mReload.rolloverCount === 3 && mReload.originalSprintId === sA.id && mReload.sprintId === sD.id);

    // Idempotency: re-running rollover on sD (task already there) does nothing.
    await executeRollover(sD, { systemUserId: managerA.id });
    mReload = await Task.findByPk(multiTask.id);
    assert('Re-running rollover is idempotent (count stays 3)', mReload.rolloverCount === 3);

    // ══════════════════════════════════════════════════════════════════════
    // [5/10] + [6/10] Hierarchy fracture — parent moves, DONE sibling stays
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[5-6/10] Hierarchy fracture: parent moves forward, DONE sibling stays...');

    const fracCompleted = await Sprint.create({
      name: 'Fracture Completed', startDate: addDays(today, -20), endDate: addDays(today, -11),
      status: 'COMPLETED', teamId: 1,
    });
    const parentStory = await mkTask(
      { title: 'Parent Story', type: 'Story', status: 'IN_PROGRESS', sprintId: fracCompleted.id },
      managerA.id
    );
    const childDone = await mkTask(
      { title: 'Child T1 DONE', type: 'Task', status: 'DONE', parentId: parentStory.id, sprintId: fracCompleted.id },
      managerA.id
    );
    const childActive = await mkTask(
      { title: 'Child T2 IN_PROGRESS', type: 'Task', status: 'IN_PROGRESS', parentId: parentStory.id, sprintId: fracCompleted.id },
      managerA.id
    );

    const fracNew = await Sprint.create({
      name: 'Fracture New', startDate: addDays(today, 90), endDate: addDays(today, 100),
      status: 'ACTIVE', teamId: 1,
    });
    await executeRollover(fracNew, { systemUserId: managerA.id });

    const parentReload = await Task.findByPk(parentStory.id);
    const childDoneReload = await Task.findByPk(childDone.id);
    const childActiveReload = await Task.findByPk(childActive.id);

    assert('Unfinished child migrated to the new sprint', childActiveReload.sprintId === fracNew.id);
    assert('Parent Story ALSO migrated so the swimlane parent row exists', parentReload.sprintId === fracNew.id);
    assert('DONE sibling STAYS in the completed sprint (velocity preserved)', childDoneReload.sprintId === fracCompleted.id);
    assert('DONE sibling never rolled over (count 0)', childDoneReload.rolloverCount === 0);

    // ══════════════════════════════════════════════════════════════════════
    // [7/10] getAllSprints JIT auto-activation triggers rollover
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[7/10] getAllSprints JIT auto-activation triggers rollover...');

    const jitCompleted = await Sprint.create({
      name: 'JIT Completed', startDate: addDays(today, -120), endDate: addDays(today, -111),
      status: 'COMPLETED', teamId: 1,
    });
    const jitTask = await mkTask(
      { title: 'JIT straggler', status: 'IN_PROGRESS', sprintId: jitCompleted.id },
      managerA.id
    );
    // A PENDING sprint whose window covers today → getAllSprints will auto-activate it.
    const jitPending = await Sprint.create({
      name: 'JIT Pending (window open)', startDate: today, endDate: addDays(today, 5),
      status: 'PENDING', teamId: 1,
    });

    const resGetAll = await runController(getAllSprints, { user: managerA });
    assert('getAllSprints returns 200', resGetAll.res.statusCode === 200);

    const jitPendingReload = await Sprint.findByPk(jitPending.id);
    const jitTaskReload = await Task.findByPk(jitTask.id);
    assert('PENDING sprint auto-activated by JIT engine', jitPendingReload.status === 'ACTIVE');
    assert('Rollover fired on JIT path → straggler moved to auto-activated sprint', jitTaskReload.sprintId === jitPending.id && jitTaskReload.rolloverCount === 1);

    // ══════════════════════════════════════════════════════════════════════
    // [8/10] editSprint JIT activation triggers rollover (EC-1 bypass fix)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[8/10] editSprint JIT activation triggers rollover...');

    // Reset the active board back to a controllable state:
    // complete everything currently active for team 1 so editSprint can activate cleanly.
    await Sprint.update({ status: 'COMPLETED' }, { where: { teamId: 1, status: 'ACTIVE' } });

    const editCompleted = await Sprint.create({
      name: 'Edit Completed', startDate: addDays(today, -200), endDate: addDays(today, -191),
      status: 'COMPLETED', teamId: 1,
    });
    const editTask = await mkTask(
      { title: 'Edit-path straggler', status: 'IN_PROGRESS', sprintId: editCompleted.id },
      managerA.id
    );
    const editPending = await Sprint.create({
      name: 'Edit Pending', startDate: addDays(today, 10), endDate: addDays(today, 20),
      status: 'PENDING', teamId: 1,
    });

    // Edit its startDate to today → silent JIT activation branch fires.
    const resEdit = await runController(editSprint, {
      user: managerA,
      params: { id: String(editPending.id) },
      body: { name: 'Edit Pending', startDate: today, endDate: addDays(today, 20) },
    });
    assert('editSprint returns 200', resEdit.res.statusCode === 200, JSON.stringify(resEdit.res.body));

    const editPendingReload = await Sprint.findByPk(editPending.id);
    const editTaskReload = await Task.findByPk(editTask.id);
    assert('editSprint activated the PENDING sprint', editPendingReload.status === 'ACTIVE');
    assert('Rollover fired on editSprint path → straggler migrated', editTaskReload.sprintId === editPending.id && editTaskReload.rolloverCount === 1);

    // ══════════════════════════════════════════════════════════════════════
    // [9/10] Team isolation — Team 1 activation never touches Team 2 tasks
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[9/10] Team isolation...');

    const team2Completed = await Sprint.create({
      name: 'T2 Completed', startDate: addDays(today, -14), endDate: addDays(today, -1),
      status: 'COMPLETED', teamId: 2,
    });
    const team2Task = await mkTask(
      { title: 'Team 2 straggler', status: 'IN_PROGRESS', sprintId: team2Completed.id },
      managerB.id
    );
    const team1New = await Sprint.create({
      name: 'T1 Isolation New', startDate: addDays(today, 120), endDate: addDays(today, 130),
      status: 'ACTIVE', teamId: 1,
    });

    await executeRollover(team1New, { systemUserId: managerA.id });
    const team2Reload = await Task.findByPk(team2Task.id);
    assert('Team 2 task untouched by a Team 1 rollover', team2Reload.sprintId === team2Completed.id && team2Reload.rolloverCount === 0);

    // ══════════════════════════════════════════════════════════════════════
    // [10/10] Board serialization emits the new fields
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[10/10] Board response includes rolloverCount + originalSprintId...');

    // carriedInProg may have been legitimately rolled forward again by the
    // later JIT tests, so query the board for its CURRENT sprint and compare
    // against its current persisted values.
    const carriedNow = await Task.findByPk(carriedInProg.id);
    const resBoard = await runController(getSprintBoard, {
      user: managerA,
      query: { sprintId: String(carriedNow.sprintId) },
    });
    assert('getSprintBoard returns 200', resBoard.res.statusCode === 200);

    const boardTasks = resBoard.res.body.tasks || [];
    const carried = boardTasks.find((t) => t.id === carriedInProg.id);
    assert(
      'Serialized task exposes rolloverCount + originalSprintId',
      carried &&
        Object.prototype.hasOwnProperty.call(carried, 'rolloverCount') &&
        Object.prototype.hasOwnProperty.call(carried, 'originalSprintId') &&
        carried.rolloverCount === carriedNow.rolloverCount &&
        carried.originalSprintId === carriedNow.originalSprintId &&
        carried.originalSprintId === completed1.id &&
        carried.rolloverCount >= 1,
      JSON.stringify(carried)
    );
  } catch (error) {
    FAIL.push({ label: 'Unhandled test error', detail: error.message });
    console.error('\n🚨 Unhandled error occurred:', error);
  } finally {
    console.log('\n🔌 Closing database connections...');
    await sequelize.close();
  }

  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    FAIL.forEach(({ label, detail }) => {
      console.error(`  • 🚨 ${label}${detail ? `: ${detail}` : ''}`);
    });
    process.exit(1);
  }

  console.log('🎉 All Sprint Rollover tests passed successfully.\n');
  process.exit(0);
};

runTests();
