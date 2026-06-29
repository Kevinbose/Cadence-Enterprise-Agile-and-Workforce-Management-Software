/**
 * Integration Test Suite — Module 4: The Atlassian Kanban Engine
 * Run from the backend directory:
 *   node test/kanban.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task, Comment } = require('../models');
const resolveActiveSprint = require('../middlewares/resolveActiveSprint.middleware');
const {
  createIssue,
  getSprintBoard,
  updateTaskStatus,
  rejectTask,
} = require('../controllers/task.controller');

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

const runMiddleware = (middleware, req) =>
  new Promise((resolve, reject) => {
    const res = mockResponse(resolve);
    middleware(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ res, req });
    });
  });

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

const runTests = async () => {
  console.log('🧪 Starting Atlassian Kanban Engine Test Suite...\n');

  try {
    // ── 1. Initialize DB & Sync clean state ───────────────────────────────────
    await sequelize.authenticate();
    console.log('🔗 Connected to MySQL database.');
    
    // force: true cleans and recreates tables to ensure pristine test execution
    await sequelize.sync({ force: true });
    console.log('🔄 Database synced and truncated (force: true).\n');

    // ── 2. Seed Users & Sprints ──────────────────────────────────────────────
    console.log('👥 Seeding test users...');
    const employeeA = await User.create({
      employeeId: 'YT-2026-001',
      name: 'Kevin Employee',
      email: 'employee@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee',
      teamId: 1,
    });

    const scrumMasterB = await User.create({
      employeeId: 'YT-2026-003',
      name: 'Kevin ScrumMaster',
      email: 'scrum@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee', // System role is Employee, but SM for team 1 sprint
      teamId: 1,
    });

    const managerC = await User.create({
      employeeId: 'YT-2026-002',
      name: 'Kevin Manager',
      email: 'manager@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Admin/Manager',
      teamId: 1,
    });

    console.log('📅 Seeding test sprints...');
    const todayStr = getTodayIST();
    const yesterdayStr = addDays(todayStr, -1);
    const nextWeekStr = addDays(todayStr, 7);
    const tomorrowStr = addDays(todayStr, 1);
    const twoWeeksStr = addDays(todayStr, 14);

    // Active Sprint (lockdown active for employees once started)
    const activeSprint = await Sprint.create({
      name: 'Active Sprint 1',
      startDate: yesterdayStr,
      endDate: nextWeekStr,
      scrumMasterId: scrumMasterB.id,
      status: 'ACTIVE',
    });

    // Planned Sprint (employee planning allowed even while another sprint is ACTIVE)
    const futureSprint = await Sprint.create({
      name: 'Future Sprint 2',
      startDate: tomorrowStr,
      endDate: twoWeeksStr,
      scrumMasterId: scrumMasterB.id,
      status: 'PENDING',
    });

    console.log('🎉 Seed complete. Users & Sprints prepared.\n');

    // ── Pillar 1: The Sequence Engine Test (MAX(id)) ───────────────────────
    console.log('[1/6] Running Sequence Engine Test...');
    const task1 = await Task.create({
      title: 'Setup Environment',
      type: 'Task',
      creatorId: managerC.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    const task2 = await Task.create({
      title: 'Configure DB Connection',
      type: 'Task',
      creatorId: managerC.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    assert(
      'First task generates issueKey "YT-1"',
      task1.issueKey === 'YT-1',
      `Got issueKey: ${task1.issueKey}`
    );
    assert(
      'Second task generates issueKey "YT-2"',
      task2.issueKey === 'YT-2',
      `Got issueKey: ${task2.issueKey}`
    );

    // ── Pillar 2: The Creation Gate (RBAC & Lockdown) ──────────────────────
    console.log('\n[2/6] Running Creation Gate (RBAC & Lockdown) Test...');

    // Case A: Employee attempts to create an Epic (Should fail with 403)
    const reqCreateEpic = {
      user: employeeA,
      body: {
        title: 'Confidential Core Architecture Upgrade',
        type: 'Epic',
      },
    };
    await runMiddleware(resolveActiveSprint, reqCreateEpic);
    const resCreateEpic = await runController(createIssue, reqCreateEpic);
    assert(
      'Employee cannot create an Epic (403 Forbidden)',
      resCreateEpic.res.statusCode === 403
    );

    // Case B: Scrum Master creates a Story (Should succeed)
    const reqCreateStory = {
      user: scrumMasterB,
      body: {
        title: 'Auth Pipeline Integration',
        type: 'Story',
        sprintId: activeSprint.id,
      },
    };
    await runMiddleware(resolveActiveSprint, reqCreateStory);
    const resCreateStory = await runController(createIssue, reqCreateStory);
    assert(
      'Scrum Master can successfully create a Story',
      resCreateStory.res.statusCode === 201 && resCreateStory.res.body.task.type === 'Story'
    );
    const storyId = resCreateStory.res.body.task.id;

    // Case C: Employee creates task during locked sprint (Should fail with 403)
    const reqCreateLockedTask = {
      user: employeeA,
      body: {
        title: 'Code Refactor task',
        type: 'Task',
      },
    };
    await runMiddleware(resolveActiveSprint, reqCreateLockedTask);
    const resCreateLockedTask = await runController(createIssue, reqCreateLockedTask);
    assert(
      'Employee task creation is blocked (403) when Active Sprint has started',
      resCreateLockedTask.res.statusCode === 403
    );

    // Case C2: Employee creates on a PENDING sprint board while an ACTIVE sprint runs
    const reqCreatePlannedTask = {
      user: employeeA,
      body: {
        title: 'Planned sprint task',
        type: 'Task',
        sprintId: futureSprint.id,
      },
    };
    await runMiddleware(resolveActiveSprint, reqCreatePlannedTask);
    const resCreatePlannedTask = await runController(createIssue, reqCreatePlannedTask);
    assert(
      'Employee can create on PENDING sprint board even when another sprint is ACTIVE',
      resCreatePlannedTask.res.statusCode === 201 &&
        resCreatePlannedTask.res.body.task.sprintId === futureSprint.id,
      JSON.stringify(resCreatePlannedTask.res.body)
    );

    // Case D: Employee creates task during future sprint window (Should succeed)
    // We temp simulate this by modifying active sprint dates to future, or deleting active sprint.
    await activeSprint.update({ startDate: tomorrowStr, endDate: twoWeeksStr });
    const reqCreateFutureTask = {
      user: employeeA,
      body: {
        title: 'Pre-sprint Planning task',
        type: 'Task',
      },
    };
    await runMiddleware(resolveActiveSprint, reqCreateFutureTask);
    const resCreateFutureTask = await runController(createIssue, reqCreateFutureTask);
    assert(
      'Employee task creation succeeds during pre-sprint planning (Active Sprint not started)',
      resCreateFutureTask.res.statusCode === 201
    );

    // Restore active sprint dates for remaining tests
    await activeSprint.update({ startDate: yesterdayStr, endDate: nextWeekStr });

    // ── Pillar 3: The Confidentiality Engine ────────────────────────────────
    console.log('\n[3/6] Running Confidentiality Engine Test...');

    // Case A: Create a confidential task assigned to Employee A (User A)
    const confidentialTask = await Task.create({
      title: 'Encrypted Token Rotation',
      type: 'Task',
      isConfidential: true,
      creatorId: managerC.id,
      assigneeId: employeeA.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    // Case B: Fetch board as User B (Scrum Master - Not Assignee, Not Manager)
    const reqBoardSM = {
      user: scrumMasterB,
    };
    await runMiddleware(resolveActiveSprint, reqBoardSM);
    const resBoardSM = await runController(getSprintBoard, reqBoardSM);
    const smSeesConfidential = resBoardSM.res.body.tasks.some(
      (t) => t.id === confidentialTask.id
    );
    assert(
      'Scrum Master does NOT see confidential tasks assigned to team members',
      !smSeesConfidential
    );

    // Case C: Fetch board as Admin/Manager (Should see confidential)
    const reqBoardManager = {
      user: managerC,
    };
    await runMiddleware(resolveActiveSprint, reqBoardManager);
    const resBoardManager = await runController(getSprintBoard, reqBoardManager);
    const managerSeesConfidential = resBoardManager.res.body.tasks.some(
      (t) => t.id === confidentialTask.id
    );
    assert(
      'Admin/Manager can see all confidential tasks',
      managerSeesConfidential
    );

    // Case D: Fetch board as Employee A (Assignee of confidential - Should see)
    const reqBoardEmployeeA = {
      user: employeeA,
    };
    await runMiddleware(resolveActiveSprint, reqBoardEmployeeA);
    const resBoardEmployeeA = await runController(getSprintBoard, reqBoardEmployeeA);
    const employeeSeesConfidential = resBoardEmployeeA.res.body.tasks.some(
      (t) => t.id === confidentialTask.id
    );
    assert(
      'Assignee can see their own confidential tasks',
      employeeSeesConfidential
    );

    // ── Pillar 4: The State Machine (Forward Transitions) ───────────────────
    console.log('\n[4/6] Running State Machine Transitions Test...');

    // Create a subtask assigned to Employee A
    const subtask = await Task.create({
      title: 'Write API controller unit test',
      type: 'Subtask',
      status: 'IN_REVIEW',
      creatorId: managerC.id,
      assigneeId: employeeA.id,
      sprintId: activeSprint.id,
      parentId: task1.id,
    }, { userId: managerC.id });

    // Case A: Employee attempts to move task from IN_REVIEW to QA_TESTING (Should fail with 403)
    const reqMoveEmployee = {
      user: employeeA,
      params: { id: subtask.id },
      body: { status: 'QA_TESTING' },
    };
    await runMiddleware(resolveActiveSprint, reqMoveEmployee);
    const resMoveEmployee = await runController(updateTaskStatus, reqMoveEmployee);
    assert(
      'Employee cannot transition card from IN_REVIEW to QA_TESTING (403)',
      resMoveEmployee.res.statusCode === 403
    );

    // Case B: Scrum Master moves the card from IN_REVIEW to QA_TESTING (Should succeed)
    const reqMoveSM = {
      user: scrumMasterB,
      params: { id: subtask.id },
      body: { status: 'QA_TESTING' },
    };
    await runMiddleware(resolveActiveSprint, reqMoveSM);
    const resMoveSM = await runController(updateTaskStatus, reqMoveSM);
    assert(
      'Scrum Master can transition card from IN_REVIEW to QA_TESTING (200)',
      resMoveSM.res.statusCode === 200 && resMoveSM.res.body.task.status === 'QA_TESTING'
    );

    // ── Pillar 5: The Rejection Penalty ──────────────────────────────────────
    console.log('\n[5/6] Running Rejection Penalty Test...');

    // Scrum Master rejects task, moving it from QA_TESTING to IN_PROGRESS. Requires reason.
    const reqReject = {
      user: scrumMasterB,
      params: { id: subtask.id },
      body: { rejectionReason: 'Failing tests' },
    };
    await runMiddleware(resolveActiveSprint, reqReject);
    const resReject = await runController(rejectTask, reqReject);
    
    assert(
      'Rejection successfully transitions status back to IN_PROGRESS',
      resReject.res.statusCode === 200 && resReject.res.body.task.status === 'IN_PROGRESS'
    );

    // Verify negative appraisal Comment entry was logged
    const dbComment = await Comment.findOne({
      where: { taskId: subtask.id },
    });
    
    assert(
      'Rejection automatically creates negative comment for appraisal tracking',
      dbComment !== null &&
        dbComment.evaluationTier === 'Negative (Simple)' &&
        dbComment.content.includes('Failing tests')
    );

    // ── Pillar 6: The Cascade Auto-Rollup ───────────────────────────────────
    console.log('\n[6/6] Running Cascade Auto-Rollup Test (3 Subtasks)...');

    // Story (Parent) -> Task (Child) -> Subtask 1, 2 & 3 (Grandchildren)
    const parentStory = await Task.create({
      title: 'Refactor Auth Services',
      type: 'Story',
      status: 'TODO',
      creatorId: managerC.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    const childTask = await Task.create({
      title: 'Update JSON Web Token configuration',
      type: 'Task',
      status: 'TODO',
      parentId: parentStory.id,
      creatorId: managerC.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    const grandchild1 = await Task.create({
      title: 'Configure expiration bounds',
      type: 'Subtask',
      status: 'QA_TESTING',
      parentId: childTask.id,
      creatorId: managerC.id,
      assigneeId: employeeA.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    const grandchild2 = await Task.create({
      title: 'Establish key signing rotation',
      type: 'Subtask',
      status: 'QA_TESTING',
      parentId: childTask.id,
      creatorId: managerC.id,
      assigneeId: employeeA.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    const grandchild3 = await Task.create({
      title: 'Implement verification middleware',
      type: 'Subtask',
      status: 'QA_TESTING',
      parentId: childTask.id,
      creatorId: managerC.id,
      assigneeId: employeeA.id,
      sprintId: activeSprint.id,
    }, { userId: managerC.id });

    // Move grandchild 1 to DONE (elevated SM role so transition completes)
    const reqDoneG1 = {
      user: scrumMasterB,
      params: { id: grandchild1.id },
      body: { status: 'DONE' },
    };
    await runMiddleware(resolveActiveSprint, reqDoneG1);
    await runController(updateTaskStatus, reqDoneG1);

    // Verify childTask parent is still in progress in database
    const childReload1 = await Task.findByPk(childTask.id);
    assert(
      'Database: Completing subtask 1/3 does NOT trigger cascade completion of parent task',
      childReload1.status !== 'DONE'
    );

    // Move grandchild 2 to DONE
    const reqDoneG2 = {
      user: scrumMasterB,
      params: { id: grandchild2.id },
      body: { status: 'DONE' },
    };
    await runMiddleware(resolveActiveSprint, reqDoneG2);
    await runController(updateTaskStatus, reqDoneG2);

    // Verify childTask parent is still in progress in database
    const childReload2 = await Task.findByPk(childTask.id);
    assert(
      'Database: Completing subtask 2/3 does NOT trigger cascade completion of parent task',
      childReload2.status !== 'DONE'
    );

    // Move grandchild 3 to DONE (completes all subtasks under childTask)
    const reqDoneG3 = {
      user: scrumMasterB,
      params: { id: grandchild3.id },
      body: { status: 'DONE' },
    };
    await runMiddleware(resolveActiveSprint, reqDoneG3);
    await runController(updateTaskStatus, reqDoneG3);

    // Verify cascade rolled up in database to parent task and parent story
    const childReload3 = await Task.findByPk(childTask.id);
    const parentStoryReload = await Task.findByPk(parentStory.id);

    assert(
      'Database: Completing the 3rd and final subtask automatically promotes parent task to DONE',
      childReload3.status === 'DONE'
    );
    assert(
      'Database: Parent completion recursively promotes grandparent story to DONE',
      parentStoryReload.status === 'DONE'
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

  console.log('🎉 All Atlassian Kanban Engine tests passed successfully.\n');
  process.exit(0);
};

runTests();
