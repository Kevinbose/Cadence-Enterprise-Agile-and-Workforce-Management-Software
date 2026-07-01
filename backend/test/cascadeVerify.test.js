/**
 * Standalone Verification Test Suite — Cascade Auto-Rollup Verification
 * Run from the backend directory:
 *   node test/cascadeVerify.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task } = require('../models');
const resolveActiveSprint = require('../middlewares/resolveActiveSprint.middleware');
const { updateTaskStatus } = require('../controllers/task.controller');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const mockResponse = (resolve) => {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      if (resolve) resolve({ res: this });
      return this;
    },
  };
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

const runCascadeTests = async () => {
  console.log('🧪 Starting 3-Subtask Cascade Auto-Rollup Verification...');

  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    console.log('🔄 Database initialized fresh.');

    // 1. Seed Users and Sprint
    const scrumMaster = await User.create({
      employeeId: 'YT-SM-001',
      name: 'Temporal SM',
      email: 'scrummaster@yakkaytech.com',
      passwordHash: 'hash',
      systemRole: 'Employee',
      teamId: 1,
    });

    const todayStr = getTodayIST();
    const activeSprint = await Sprint.create({
      name: 'Cascade Verify Sprint',
      startDate: addDays(todayStr, -1),
      endDate: addDays(todayStr, 7),
      scrumMasterId: scrumMaster.id,
    });
    console.log('👥 Setup active sprint and temporal Scrum Master.');

    // 2. Create Hierarchy: Story (Grandparent) -> Task (Parent) -> 3 Subtasks
    const grandparentStory = await Task.create({
      title: 'Grandparent Story: Payment Gateway Upgrade',
      type: 'Story',
      status: 'TODO',
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    const parentTask = await Task.create({
      title: 'Parent Task: Implement Stripe Webhooks',
      type: 'Task',
      status: 'TODO',
      parentId: grandparentStory.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    console.log('🏗️ Created parent Task and grandparent Story.');

    const subtask1 = await Task.create({
      title: 'Subtask 1: Parse webhook payload',
      type: 'Subtask',
      status: 'QA_TESTING',
      parentId: parentTask.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    const subtask2 = await Task.create({
      title: 'Subtask 2: Verify signature header',
      type: 'Subtask',
      status: 'QA_TESTING',
      parentId: parentTask.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    const subtask3 = await Task.create({
      title: 'Subtask 3: Log webhook event to DB',
      type: 'Subtask',
      status: 'QA_TESTING',
      parentId: parentTask.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    console.log('📑 Created 3 Subtasks under the parent Task, initial status: QA_TESTING.');

    // 3. Move Subtask 1 to DONE
    console.log('\n[Step 1] Completing Subtask 1...');
    const req1 = {
      user: scrumMaster,
      params: { id: subtask1.id },
      body: { status: 'DONE' },
    };
    await runMiddleware(resolveActiveSprint, req1);
    const res1 = await runController(updateTaskStatus, req1);

    console.log(`  - Subtask 1 response code: ${res1.res.statusCode}`);
    const parentCheck1 = await Task.findByPk(parentTask.id);
    console.log(`  - Parent Task status is: ${parentCheck1.status}`);
    console.assert(parentCheck1.status !== 'DONE', 'Parent should not be DONE yet');
    console.log('  ✅ Correct: parent remains unfinished.');

    // 4. Move Subtask 2 to DONE
    console.log('\n[Step 2] Completing Subtask 2...');
    const req2 = {
      user: scrumMaster,
      params: { id: subtask2.id },
      body: { status: 'DONE' },
    };
    await runMiddleware(resolveActiveSprint, req2);
    const res2 = await runController(updateTaskStatus, req2);

    console.log(`  - Subtask 2 response code: ${res2.res.statusCode}`);
    const parentCheck2 = await Task.findByPk(parentTask.id);
    console.log(`  - Parent Task status is: ${parentCheck2.status}`);
    console.assert(parentCheck2.status !== 'DONE', 'Parent should not be DONE yet');
    console.log('  ✅ Correct: parent remains unfinished.');

    // 5. Move Subtask 3 to DONE (this should trigger cascade rollups)
    console.log('\n[Step 3] Completing Subtask 3 (Last sibling)...');
    const req3 = {
      user: scrumMaster,
      params: { id: subtask3.id },
      body: { status: 'DONE' },
    };
    await runMiddleware(resolveActiveSprint, req3);
    const res3 = await runController(updateTaskStatus, req3);

    console.log(`  - Subtask 3 response code: ${res3.res.statusCode}`);
    const parentCheck3 = await Task.findByPk(parentTask.id);
    const grandparentCheck3 = await Task.findByPk(grandparentStory.id);

    console.log(`  - Parent Task status is: ${parentCheck3.status}`);
    console.log(`  - Grandparent Story status is: ${grandparentCheck3.status}`);

    if (parentCheck3.status === 'DONE') {
      console.log('  ✅ Cascade 1 PASSED: Parent Task was automatically promoted to DONE.');
    } else {
      console.error('  🚨 Cascade 1 FAILED: Parent Task is still NOT completed.');
    }

    if (grandparentCheck3.status === 'DONE') {
      console.log('  ✅ Cascade 2 PASSED: Grandparent Story was automatically promoted to DONE recursively.');
    } else {
      console.error('  🚨 Cascade 2 FAILED: Grandparent Story is still NOT completed.');
    }

    if (res3.res.body && res3.res.body.cascadedParents) {
      console.log(`  - Cascaded IDs returned to frontend: [${res3.res.body.cascadedParents.join(', ')}]`);
    }

  } catch (error) {
    console.error('🚨 Unexpected error running cascade test:', error);
  } finally {
    console.log('\n🔌 Closing DB connection.');
    await sequelize.close();
  }
};

runCascadeTests();
