/**
 * Integration Test Suite — Module 6: Bulk Adjudication & Hierarchical Cascade
 * Run from the backend directory:
 *   node test/bulkAdjudicate.test.js
 *
 * Focus areas:
 *   1. RBAC gate (Manager / Scrum Master only)
 *   2. Payload validation (empty taskIds, invalid action, missing reject comment)
 *   3. Bulk approve — independent tasks
 *   4. THE RACE CONDITION TRAP — 4 subtasks sharing one parent, bulk-approved
 *      in a single request. Verifies the sequential for...of + shared
 *      transaction never deadlocks and the parent/grandparent cascade
 *      resolves correctly exactly once.
 *   5. Bulk reject — mandatory comment attached to every rejected card
 *   6. Skip logic — ineligible / not-found / cross-team tasks are skipped,
 *      not fatal to the whole batch
 *   7. All-skipped batch → 400, nothing mutated
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task, Comment } = require('../models');
const { bulkAdjudicate } = require('../controllers/task.controller');

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
  console.log('🧪 Starting Bulk Adjudication & Hierarchical Cascade Test Suite...\n');

  try {
    await sequelize.authenticate();
    console.log('🔗 Connected to MySQL database.');

    await sequelize.sync({ force: true });
    console.log('🔄 Database synced and truncated (force: true).\n');

    // ── Seed Users ────────────────────────────────────────────────────────────
    console.log('👥 Seeding test users...');
    const managerA = await User.create({
      employeeId: 'YT-2026-001',
      name: 'Manager A',
      email: 'managerA@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Admin/Manager',
      teamId: 1,
    });

    const scrumMasterA = await User.create({
      employeeId: 'YT-2026-002',
      name: 'Scrum Master A',
      email: 'scrumA@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee', // temporal SM, elevated only via req.isTemporalScrumMaster
      teamId: 1,
    });

    const employeeA = await User.create({
      employeeId: 'YT-2026-003',
      name: 'Employee A',
      email: 'employeeA@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Employee',
      teamId: 1,
    });

    const managerB = await User.create({
      employeeId: 'YT-2026-004',
      name: 'Manager B (Team 2)',
      email: 'managerB@yakkaytech.com',
      passwordHash: 'hashed123',
      systemRole: 'Admin/Manager',
      teamId: 2,
    });

    // ── Seed Sprints (must be ACTIVE — default model status is PENDING) ─────
    console.log('📅 Seeding active sprints for two isolated teams...');
    const todayStr = getTodayIST();
    const sprintTeam1 = await Sprint.create({
      name: 'Team 1 Active Sprint',
      startDate: addDays(todayStr, -1),
      endDate: addDays(todayStr, 7),
      scrumMasterId: scrumMasterA.id,
      status: 'ACTIVE',
      teamId: 1,
    });

    const sprintTeam2 = await Sprint.create({
      name: 'Team 2 Active Sprint',
      startDate: addDays(todayStr, -1),
      endDate: addDays(todayStr, 7),
      scrumMasterId: managerB.id,
      status: 'ACTIVE',
      teamId: 2,
    });

    console.log('🎉 Seed complete.\n');

    // ══════════════════════════════════════════════════════════════════════
    // [1/6] RBAC Guard
    // ══════════════════════════════════════════════════════════════════════
    console.log('[1/6] Running RBAC Guard Test...');

    const rbacTask = await Task.create(
      {
        title: 'RBAC probe task',
        type: 'Task',
        status: 'IN_REVIEW',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );

    const reqEmployeeAttempt = {
      user: employeeA,
      isTemporalScrumMaster: false,
      body: { taskIds: [rbacTask.id], action: 'APPROVE' },
    };
    const resEmployeeAttempt = await runController(bulkAdjudicate, reqEmployeeAttempt);
    assert(
      'Employee cannot call bulk-adjudicate (403 Forbidden)',
      resEmployeeAttempt.res.statusCode === 403
    );

    const reloadedAfterRbac = await Task.findByPk(rbacTask.id);
    assert(
      'RBAC rejection leaves task status completely untouched',
      reloadedAfterRbac.status === 'IN_REVIEW'
    );

    // ══════════════════════════════════════════════════════════════════════
    // [2/6] Payload Validation
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[2/6] Running Payload Validation Test...');

    const resEmptyIds = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: { taskIds: [], action: 'APPROVE' },
    });
    assert(
      'Empty taskIds array rejected with 400',
      resEmptyIds.res.statusCode === 400
    );

    const resBadAction = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: { taskIds: [rbacTask.id], action: 'DESTROY' },
    });
    assert(
      'Invalid action string rejected with 400',
      resBadAction.res.statusCode === 400
    );

    const resMissingComment = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: { taskIds: [rbacTask.id], action: 'REJECT' }, // no comment
    });
    assert(
      'Bulk reject without a comment rejected with 400',
      resMissingComment.res.statusCode === 400
    );

    // ══════════════════════════════════════════════════════════════════════
    // [3/6] Bulk Approve — Independent Tasks (no shared parent)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[3/6] Running Bulk Approve (independent tasks) Test...');

    const indep1 = await Task.create(
      {
        title: 'Independent card 1',
        type: 'Task',
        status: 'IN_REVIEW',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );
    const indep2 = await Task.create(
      {
        title: 'Independent card 2',
        type: 'Task',
        status: 'QA_TESTING',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );

    const resIndepApprove = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: { taskIds: [indep1.id, indep2.id], action: 'APPROVE' },
    });

    assert(
      'Manager can bulk-approve two independent cards (200)',
      resIndepApprove.res.statusCode === 200 && resIndepApprove.res.body.processed === 2,
      JSON.stringify(resIndepApprove.res.body)
    );

    const indep1Reload = await Task.findByPk(indep1.id);
    const indep2Reload = await Task.findByPk(indep2.id);
    assert(
      'IN_REVIEW card correctly advances to QA_TESTING',
      indep1Reload.status === 'QA_TESTING'
    );
    assert(
      'QA_TESTING card correctly advances to DONE',
      indep2Reload.status === 'DONE'
    );

    // ══════════════════════════════════════════════════════════════════════
    // [4/6] THE RACE CONDITION TRAP — 4 siblings sharing one parent,
    //       bulk-approved in a SINGLE request. Must not deadlock, and the
    //       cascade must resolve the shared parent AND grandparent exactly once.
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[4/6] Running Race-Condition Trap Test (4 shared-parent subtasks)...');

    const grandparentStory = await Task.create(
      {
        title: 'Grandparent Story — Deadlock Trap',
        type: 'Story',
        status: 'TODO',
        creatorId: managerA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );

    const sharedParentTask = await Task.create(
      {
        title: 'Shared Parent Task — 4 subtasks below',
        type: 'Task',
        status: 'TODO',
        parentId: grandparentStory.id,
        creatorId: managerA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );

    const sharedSubtasks = [];
    for (let i = 1; i <= 4; i += 1) {
      const st = await Task.create(
        {
          title: `Shared subtask ${i}/4`,
          type: 'Subtask',
          status: 'QA_TESTING',
          parentId: sharedParentTask.id,
          creatorId: managerA.id,
          assigneeId: employeeA.id,
          sprintId: sprintTeam1.id,
        },
        { userId: managerA.id }
      );
      sharedSubtasks.push(st);
    }

    const raceStart = Date.now();
    const resRaceApprove = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: {
        taskIds: sharedSubtasks.map((t) => t.id),
        action: 'APPROVE',
      },
    });
    const raceElapsedMs = Date.now() - raceStart;

    assert(
      'Bulk-approving 4 shared-parent subtasks in one call succeeds without deadlock (200)',
      resRaceApprove.res.statusCode === 200 && resRaceApprove.res.body.processed === 4,
      JSON.stringify(resRaceApprove.res.body)
    );
    console.log(`  ⏱  Sequential transaction completed in ${raceElapsedMs}ms (no deadlock).`);

    const allSubtasksReload = await Task.findAll({
      where: { id: sharedSubtasks.map((t) => t.id) },
    });
    assert(
      'All 4 shared subtasks individually transitioned to DONE',
      allSubtasksReload.every((t) => t.status === 'DONE')
    );

    const sharedParentReload = await Task.findByPk(sharedParentTask.id);
    assert(
      'Shared parent Task auto-cascades to DONE exactly once (no partial/duplicate state)',
      sharedParentReload.status === 'DONE'
    );

    const grandparentReload = await Task.findByPk(grandparentStory.id);
    assert(
      'Cascade recurses up to the grandparent Story, also promoted to DONE',
      grandparentReload.status === 'DONE'
    );

    // ══════════════════════════════════════════════════════════════════════
    // [5/6] Bulk Reject — mandatory comment attached to every rejected card
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[5/6] Running Bulk Reject (Scrum Master, mandatory comment) Test...');

    const rejectCard1 = await Task.create(
      {
        title: 'Reject candidate 1',
        type: 'Task',
        status: 'IN_REVIEW',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );
    const rejectCard2 = await Task.create(
      {
        title: 'Reject candidate 2',
        type: 'Task',
        status: 'QA_TESTING',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );

    const resBulkReject = await runController(bulkAdjudicate, {
      user: scrumMasterA,
      isTemporalScrumMaster: true, // temporal SM context, no Admin/Manager systemRole needed
      body: {
        taskIds: [rejectCard1.id, rejectCard2.id],
        action: 'REJECT',
        comment: 'Missing edge-case coverage in the test suite',
      },
    });

    assert(
      'Active Scrum Master can bulk-reject with a mandatory comment (200)',
      resBulkReject.res.statusCode === 200 && resBulkReject.res.body.processed === 2,
      JSON.stringify(resBulkReject.res.body)
    );

    const rejectCard1Reload = await Task.findByPk(rejectCard1.id);
    const rejectCard2Reload = await Task.findByPk(rejectCard2.id);
    assert(
      'Both rejected cards bounce back to IN_PROGRESS regardless of origin column',
      rejectCard1Reload.status === 'IN_PROGRESS' && rejectCard2Reload.status === 'IN_PROGRESS'
    );

    const rejectComments = await Comment.findAll({
      where: { taskId: [rejectCard1.id, rejectCard2.id] },
    });
    assert(
      'A Negative (Simple) audit comment is created on EVERY rejected card',
      rejectComments.length === 2 &&
        rejectComments.every(
          (c) =>
            c.evaluationTier === 'Negative (Simple)' &&
            c.content.includes('Missing edge-case coverage')
        )
    );

    // ══════════════════════════════════════════════════════════════════════
    // [6/6] Skip Logic — ineligible / not-found / cross-team tasks are
    //       skipped gracefully rather than failing the whole batch
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[6/6] Running Skip Logic Test (mixed-eligibility batch)...');

    const eligibleCard = await Task.create(
      {
        title: 'Eligible for approval',
        type: 'Task',
        status: 'IN_REVIEW',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );
    const ineligibleTodoCard = await Task.create(
      {
        title: 'Still in TODO — not eligible',
        type: 'Task',
        status: 'TODO',
        creatorId: managerA.id,
        assigneeId: employeeA.id,
        sprintId: sprintTeam1.id,
      },
      { userId: managerA.id }
    );
    const crossTeamCard = await Task.create(
      {
        title: 'Belongs to Team 2 — must be skipped',
        type: 'Task',
        status: 'IN_REVIEW',
        creatorId: managerB.id,
        sprintId: sprintTeam2.id,
      },
      { userId: managerB.id }
    );
    const nonExistentId = 999999;

    const resMixedBatch = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: {
        taskIds: [eligibleCard.id, ineligibleTodoCard.id, crossTeamCard.id, nonExistentId],
        action: 'APPROVE',
      },
    });

    assert(
      'Mixed-eligibility batch still succeeds (200) for the one eligible card',
      resMixedBatch.res.statusCode === 200 && resMixedBatch.res.body.processed === 1,
      JSON.stringify(resMixedBatch.res.body)
    );

    const skipped = resMixedBatch.res.body.skipped || [];
    assert(
      'Ineligible (TODO), cross-team, and not-found tasks are all captured in skipped[]',
      skipped.length === 3 &&
        skipped.some((s) => s.taskId === ineligibleTodoCard.id) &&
        skipped.some((s) => s.taskId === crossTeamCard.id) &&
        skipped.some((s) => s.taskId === nonExistentId)
    );

    const eligibleReload = await Task.findByPk(eligibleCard.id);
    const crossTeamReload = await Task.findByPk(crossTeamCard.id);
    assert(
      'The one eligible card advanced, while the cross-team card was left untouched',
      eligibleReload.status === 'QA_TESTING' && crossTeamReload.status === 'IN_REVIEW'
    );

    // All-skipped batch → hard 400, nothing mutated
    const resAllSkipped = await runController(bulkAdjudicate, {
      user: managerA,
      isTemporalScrumMaster: false,
      body: { taskIds: [nonExistentId], action: 'APPROVE' },
    });
    assert(
      'A batch where every task is skipped returns 400 (no partial success)',
      resAllSkipped.res.statusCode === 400
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

  console.log('🎉 All Bulk Adjudication & Cascade tests passed successfully.\n');
  process.exit(0);
};

runTests();
