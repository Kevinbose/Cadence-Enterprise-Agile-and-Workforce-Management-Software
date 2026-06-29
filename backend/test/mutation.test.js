/**
 * Integration Test Suite — Module 4.5: The Issue Mutation Engine (Edit & Cascade Delete)
 * Run from the backend directory:
 *   node test/mutation.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task, Comment, AuditLog } = require('../models');
const { editIssue, deleteIssue } = require('../controllers/task.controller');

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

const runTests = async () => {
  console.log('🧪 Starting Issue Mutation Engine (Module 4.5) Test Suite...\n');

  try {
    await sequelize.authenticate();
    console.log('🔗 Connected to MySQL database.');

    await sequelize.sync({ force: true });
    console.log('🔄 Database synced and truncated (force: true).\n');

    // ── Seed Users ────────────────────────────────────────────────────────────
    console.log('👥 Seeding test users...');
    const employee = await User.create({
      employeeId: 'YT-2026-001',
      name: 'Kevin Employee',
      email: 'employee@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee',
      teamId: 1,
    });

    const otherEmployee = await User.create({
      employeeId: 'YT-2026-099',
      name: 'Other Employee',
      email: 'other@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee',
      teamId: 1,
    });

    const scrumMaster = await User.create({
      employeeId: 'YT-2026-003',
      name: 'Kevin ScrumMaster',
      email: 'scrum@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee',
      teamId: 1,
    });

    const manager = await User.create({
      employeeId: 'YT-2026-002',
      name: 'Kevin Manager',
      email: 'manager@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Admin/Manager',
      teamId: 1,
    });

    // ── Seed Active Sprint ────────────────────────────────────────────────────
    const todayStr = getTodayIST();
    const activeSprint = await Sprint.create({
      name: 'Demo Active Sprint',
      startDate: todayStr,
      endDate: addDays(todayStr, 7),
      scrumMasterId: scrumMaster.id,
    });

    // ==========================================================================
    // PILLAR 1: Edit Issue RBAC Gates & Safe Mutation
    // ==========================================================================
    console.log('\n--- Test Phase 1: Edit Issue (RBAC & Constraints) ---');

    // Create a task owned by Employee
    const employeeTask = await Task.create({
      issueKey: 'YT-1',
      title: 'Original Employee Task',
      description: 'Some desc',
      type: 'Task',
      status: 'TODO',
      creatorId: employee.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    // Test Case 1: Unauthorized Employee Edit
    const unauthEditReq = {
      params: { id: employeeTask.id },
      body: { title: 'Hacked Title' },
      user: otherEmployee,
      isTemporalScrumMaster: false,
    };
    const { res: unauthEditRes } = await runController(editIssue, unauthEditReq);
    assert(
      'RBAC Edit: Employee cannot edit issue created by/assigned to someone else',
      unauthEditRes.statusCode === 403,
      `Got status ${unauthEditRes.statusCode}`
    );

    // Test Case 2: Authorized Employee Edit (Creator/Assignee)
    const authEditReq = {
      params: { id: employeeTask.id },
      body: {
        title: 'Updated Employee Task',
        description: 'New desc',
        type: 'Subtask',
        assigneeId: scrumMaster.id,
        // Immutable columns that should be ignored
        issueKey: 'YT-HACK',
        parentId: 9999,
        sprintId: 9999,
        isConfidential: true,
        creatorId: 9999,
      },
      user: employee,
      isTemporalScrumMaster: false,
    };
    const { res: authEditRes } = await runController(editIssue, authEditReq);
    assert(
      'RBAC Edit: Creator/Assignee can edit title, description, type, and assigneeId',
      authEditRes.statusCode === 200 && authEditRes.body.success === true,
      `Got status ${authEditRes.statusCode}`
    );

    const reloadedTask = await Task.findByPk(employeeTask.id);
    assert(
      'Safe Mutation: Mutable fields updated correctly',
      reloadedTask.title === 'Updated Employee Task' &&
      reloadedTask.description === 'New desc' &&
      reloadedTask.type === 'Subtask' &&
      reloadedTask.assigneeId === scrumMaster.id
    );
    assert(
      'Safe Mutation: Immutable fields (issueKey, parentId, sprintId, creatorId) ignored',
      reloadedTask.issueKey === 'YT-1' &&
      reloadedTask.parentId === null &&
      reloadedTask.sprintId === activeSprint.id &&
      reloadedTask.creatorId === employee.id &&
      reloadedTask.isConfidential === false
    );

    // Test Case 3: Title Validation
    const emptyTitleReq = {
      params: { id: employeeTask.id },
      body: { title: '   ' },
      user: employee,
      isTemporalScrumMaster: false,
    };
    const { res: emptyTitleRes } = await runController(editIssue, emptyTitleReq);
    assert(
      'Validation Edit: Reject empty titles with 400',
      emptyTitleRes.statusCode === 400,
      `Got status ${emptyTitleRes.statusCode}`
    );

    // Test Case 4: Employee converts Subtask → Task (parent cleared, no confidentiality error)
    const parentTask = await Task.create({
      issueKey: 'YT-6',
      title: 'Parent Task',
      type: 'Task',
      status: 'TODO',
      creatorId: employee.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });
    const employeeSubtask = await Task.create({
      issueKey: 'YT-7',
      title: 'Employee Subtask',
      type: 'Subtask',
      status: 'TODO',
      parentId: parentTask.id,
      creatorId: employee.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    const subtaskToTaskReq = {
      params: { id: employeeSubtask.id },
      body: {
        title: 'Promoted Task',
        type: 'Task',
        parentId: null,
        isConfidential: false,
      },
      user: employee,
      isTemporalScrumMaster: false,
    };
    const { res: subtaskToTaskRes } = await runController(editIssue, subtaskToTaskReq);
    assert(
      'RBAC Edit: Employee can convert Subtask to Task without confidentiality gate',
      subtaskToTaskRes.statusCode === 200 && subtaskToTaskRes.body.task.type === 'Task',
      `Got status ${subtaskToTaskRes.statusCode} — ${JSON.stringify(subtaskToTaskRes.body)}`
    );

    const promotedTask = await Task.findByPk(employeeSubtask.id);
    assert(
      'Hierarchy Edit: Subtask → Task clears parentId',
      promotedTask.type === 'Task' && promotedTask.parentId === null
    );

    // ==========================================================================
    // PILLAR 2: Delete Issue RBAC Gates & Cascade Delete Recursion
    // ==========================================================================
    console.log('\n--- Test Phase 2: Cascade Delete (RBAC & Recursion) ---');

    // Create a complete parent-child hierarchy:
    // Epic (YT-2) -> Story (YT-3) -> Task (YT-4) -> Subtask (YT-5)
    const epic = await Task.create({
      issueKey: 'YT-2',
      title: 'Epic Payment Gateway',
      type: 'Epic',
      status: 'TODO',
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    });
    const story = await Task.create({
      issueKey: 'YT-3',
      title: 'Stripe Subscriptions Story',
      type: 'Story',
      status: 'TODO',
      parentId: epic.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    });
    const task = await Task.create({
      issueKey: 'YT-4',
      title: 'Webhook Listener Task',
      type: 'Task',
      status: 'TODO',
      parentId: story.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    });
    const subtask = await Task.create({
      issueKey: 'YT-5',
      title: 'Validate Webhook Signature Subtask',
      type: 'Subtask',
      status: 'TODO',
      parentId: task.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    });

    // Create a mock comment on the subtask to test InnoDB FK constraint purging
    await Comment.create({
      taskId: subtask.id,
      authorId: employee.id,
      content: 'This is a test comment.',
      evaluationTier: 'Positive',
    });

    // Test Case 4: Employee attempts to delete a SM-created hierarchy (Unauthorized)
    const unauthDeleteReq = {
      params: { id: epic.id },
      user: employee,
      isTemporalScrumMaster: false,
    };
    const { res: unauthDeleteRes } = await runController(deleteIssue, unauthDeleteReq);
    assert(
      'RBAC Delete: Employees cannot delete issues they did not create',
      unauthDeleteRes.statusCode === 403,
      `Got status ${unauthDeleteRes.statusCode}`
    );

    // Test Case 5: Manager deletes Epic (Authorized Cascade Delete)
    const managerDeleteReq = {
      params: { id: epic.id },
      user: manager,
      isTemporalScrumMaster: false,
    };
    const { res: managerDeleteRes } = await runController(deleteIssue, managerDeleteReq);
    assert(
      'RBAC Delete: Manager can execute deletion hierarchy',
      managerDeleteRes.statusCode === 200,
      `Got status ${managerDeleteRes.statusCode}`
    );

    const deletedIds = managerDeleteRes.body.deletedIds || [];
    assert(
      'Cascade Delete: Mapped deletedIds covers the entire hierarchy correctly',
      deletedIds.includes(epic.id) &&
      deletedIds.includes(story.id) &&
      deletedIds.includes(task.id) &&
      deletedIds.includes(subtask.id)
    );

    // Verify all child rows were deleted from tasks table
    const remainingTasks = await Task.findAll({
      where: { id: [epic.id, story.id, task.id, subtask.id] },
    });
    assert(
      'Cascade Delete: All tasks and subtasks recursively vaporized from MySQL DB',
      remainingTasks.length === 0,
      `Still found ${remainingTasks.length} orphaned issues`
    );

    // Verify the comments on deleted items were purged
    const remainingComments = await Comment.findAll({
      where: { taskId: subtask.id },
    });
    assert(
      'Cascade Delete: Dependent comments purged successfully (InnoDB FK satisfied)',
      remainingComments.length === 0,
      `Found ${remainingComments.length} orphaned comments`
    );

    console.log('\n🔌 Closing database connections...');
    await sequelize.close();

    console.log('\n========================================');
    console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
    console.log('========================================');

    if (FAIL.length > 0) {
      console.error('\n❌ Issue Mutation Engine integration tests failed.');
      process.exit(1);
    } else {
      console.log('\n🎉 All Mutation Engine tests passed successfully.\n');
      // Execute the demo data seeder script at the end to restore state for local checking
      console.log('♻️ Re-running Demo Data Seeder to restore clean UI sandbox state...');
      const { exec } = require('child_process');
      exec('node scripts/seedKanbanDemoData.js', (err, stdout, stderr) => {
        if (err) {
          console.error('Failed to run seedKanbanDemoData.js:', err);
        } else {
          console.log('Demo board successfully repopulated for manual verification.');
        }
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('Unexpected test error occurred:', error);
    process.exit(1);
  }
};

runTests();
