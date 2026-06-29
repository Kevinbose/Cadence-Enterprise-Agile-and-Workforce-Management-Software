/**
 * Integration Test Suite — Ubiquitous Card Commenting
 * Run from the backend directory:
 *   node test/comments.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task, Comment } = require('../models');
const { getTaskComments, createTaskComment } = require('../controllers/comment.controller');

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

const runSuite = async () => {
  console.log('🧪 Starting Card Commenting Test Suite...\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.\n');
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }

  // Set up mock data
  const t1Manager = await User.create({
    employeeId: `M-${Date.now()}`,
    name: 'Team 1 Manager',
    email: `m1.${Date.now()}@test.com`,
    passwordHash: 'hash',
    systemRole: 'Admin/Manager',
    teamId: 1
  });

  const t2Manager = await User.create({
    employeeId: `M2-${Date.now()}`,
    name: 'Team 2 Manager',
    email: `m2.${Date.now()}@test.com`,
    passwordHash: 'hash',
    systemRole: 'Admin/Manager',
    teamId: 2
  });

  const t1Employee = await User.create({
    employeeId: `E1-${Date.now()}`,
    name: 'Team 1 Employee',
    email: `e1.${Date.now()}@test.com`,
    passwordHash: 'hash',
    systemRole: 'Employee',
    teamId: 1
  });

  const t1Sprint = await Sprint.create({
    name: 'Test Sprint 1',
    startDate: '2026-06-01',
    endDate: '2026-06-15',
    status: 'ACTIVE',
    teamId: 1
  });

  const t1Task = await Task.create({
    issueKey: `YT-${Date.now()}`,
    title: 'Test Task for Comments',
    type: 'Task',
    status: 'TODO',
    sprintId: t1Sprint.id,
    creatorId: t1Employee.id,
    assigneeId: t1Employee.id
  }, { userId: t1Employee.id });

  // [1/6] Add comment as Manager of same team with Thumbs Up (should succeed)
  console.log('[1/6] Testing comment creation as team Manager with evaluationTier...');
  try {
    const req = {
      params: { taskId: String(t1Task.id) },
      body: { content: 'Initial Manager Comment', evaluationTier: 'Positive' },
      user: t1Manager
    };
    const { res } = await runController(createTaskComment, req);
    assert('Manager can successfully add a comment with evaluationTier', res.statusCode === 201);
    assert('Comment content is correctly saved', res.body.comment.content === 'Initial Manager Comment');
    assert('evaluationTier is Positive', res.body.comment.evaluationTier === 'Positive');
  } catch (err) {
    assert('createTaskComment runs without throwing', false, err.message);
  }

  // [2/6] Add comment as Employee (should fail with 403)
  console.log('\n[2/6] Testing comment creation as standard Employee...');
  try {
    const req = {
      params: { taskId: String(t1Task.id) },
      body: { content: 'Employee comment attempt', evaluationTier: 'Positive' },
      user: t1Employee
    };
    const { res } = await runController(createTaskComment, req);
    assert('Employee commenting is rejected', res.statusCode === 403);
  } catch (err) {
    assert('createTaskComment runs without throwing', false, err.message);
  }

  // [3/6] Add comment with empty string content (should fail with 400)
  console.log('\n[3/6] Testing comment creation with empty content...');
  try {
    const req = {
      params: { taskId: String(t1Task.id) },
      body: { content: '', evaluationTier: 'Positive' },
      user: t1Manager
    };
    const { res } = await runController(createTaskComment, req);
    assert('Empty comment is rejected with 400', res.statusCode === 400);
  } catch (err) {
    assert('createTaskComment runs without throwing', false, err.message);
  }

  // [4/6] Add comment without evaluationTier (should fail with 400)
  console.log('\n[4/6] Testing comment creation without evaluation rating...');
  try {
    const req = {
      params: { taskId: String(t1Task.id) },
      body: { content: 'No rating comment' },
      user: t1Manager
    };
    const { res } = await runController(createTaskComment, req);
    assert('Comment without rating is rejected with 400', res.statusCode === 400);
  } catch (err) {
    assert('createTaskComment runs without throwing', false, err.message);
  }

  // [5/6] Add comment as Manager of another team (should fail with 403 due to team isolation)
  console.log('\n[5/6] Testing cross-team Manager commenting (team isolation)...');
  try {
    const req = {
      params: { taskId: String(t1Task.id) },
      body: { content: 'Cross-team comment attempt', evaluationTier: 'Positive' },
      user: t2Manager
    };
    const { res } = await runController(createTaskComment, req);
    assert('Cross-team Manager commenting is rejected with 403', res.statusCode === 403);
  } catch (err) {
    assert('createTaskComment runs without throwing', false, err.message);
  }

  // [6/6] Get task comments (should return comments)
  console.log('\n[6/6] Testing retrieving comments for a task...');
  try {
    const req = {
      params: { taskId: String(t1Task.id) },
      user: t1Manager
    };
    const { res } = await runController(getTaskComments, req);
    assert('Retrieve comments succeeds with 200', res.statusCode === 200);
    assert('Response returns comments array', Array.isArray(res.body.comments));
    assert('Response contains the comment created by manager', res.body.comments.some(c => c.content === 'Initial Manager Comment'));
  } catch (err) {
    assert('getTaskComments runs without throwing', false, err.message);
  }

  // [7/6] Get employee dossier and check completed sprint comments
  console.log('\n[7/6] Testing employee dossier completed comments retrieval...');
  try {
    // Complete the sprint
    await t1Sprint.update({ status: 'COMPLETED' });

    const { getEmployeeDossier } = require('../controllers/intelligence.controller');
    const req = {
      params: { userId: String(t1Employee.id) },
      user: t1Manager
    };
    const { res } = await runController(getEmployeeDossier, req);
    assert('Dossier retrieval succeeds with 200', res.statusCode === 200);
    assert('Dossier contains previousComments array', Array.isArray(res.body.previousComments));
    assert('previousComments contains the comment we created', res.body.previousComments.some(c => c.content === 'Initial Manager Comment'));
    assert('previousComments resolves hierarchy lineage correctly', res.body.previousComments[0].hierarchy.task.title === 'Test Task for Comments');
  } catch (err) {
    assert('getEmployeeDossier runs without throwing', false, err.message);
  }

  // Cleanup mock test records
  console.log('\n🧹 Cleaning up test database records...');
  await Comment.destroy({ where: { taskId: t1Task.id } });
  await Task.destroy({ where: { id: t1Task.id } });
  await Sprint.destroy({ where: { id: t1Sprint.id } });
  await User.destroy({ where: { id: [t1Manager.id, t2Manager.id, t1Employee.id] } });

  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All card commenting tests passed successfully.\n');
  }
};

runSuite().finally(() => sequelize.close());
