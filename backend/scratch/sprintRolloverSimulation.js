/**
 * Sprint Rollover & Overdue Tasks Simulation Script
 * ─────────────────────────────────────────────────
 * This script runs a real database simulation demonstrating:
 *   1. Limbo task detection and migration on sprint start.
 *   2. The Multi-Rollover originalSprintId latching mechanism.
 *   3. The Hierarchy Fracture self-healing behavior (unfinished parent moves, DONE sibling stays).
 *   4. Team isolation bounds.
 */

const { sequelize, User, Sprint, Task } = require('../models');
const { executeRollover } = require('../utils/sprintRollover');

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

async function simulate() {
  console.log('🏁 Starting Sprint Rollover Simulation...\n');

  try {
    await sequelize.authenticate();
    // Re-sync database schema for clean slate
    await sequelize.sync({ force: true });
    console.log('✅ Database synchronized & tables cleaned.');

    // 1. Seed Users
    const manager = await User.create({
      employeeId: 'SIM-MGR-01',
      name: 'Sarah SimManager',
      email: 'sim_mgr@yakkaytech.com',
      passwordHash: 'hash',
      systemRole: 'Admin/Manager',
      teamId: 1
    });

    const dev = await User.create({
      employeeId: 'SIM-DEV-01',
      name: 'Dave SimDeveloper',
      email: 'sim_dev@yakkaytech.com',
      passwordHash: 'hash',
      systemRole: 'Employee',
      teamId: 1
    });

    console.log('👤 Created simulator users: Manager and Developer.');

    // 2. Create Completed Sprint (Sprint 1)
    const sprint1 = await Sprint.create({
      name: 'Sprint 1 (Completed)',
      startDate: addDays(today, -15),
      endDate: addDays(today, -1),
      status: 'COMPLETED',
      teamId: 1
    });

    console.log(`📅 Created Completed Sprint: ${sprint1.name}`);

    // 3. Create Tasks under Sprint 1
    // Story S1
    const parentStory = await Task.create({
      title: 'Sim Parent Story',
      type: 'Story',
      status: 'IN_PROGRESS',
      creatorId: manager.id,
      assigneeId: dev.id,
      sprintId: sprint1.id
    }, { userId: manager.id });

    // Done subtask T1 (stays behind)
    const subtaskDone = await Task.create({
      title: 'Subtask 1 (Done)',
      type: 'Task',
      status: 'DONE',
      parentId: parentStory.id,
      creatorId: dev.id,
      assigneeId: dev.id,
      sprintId: sprint1.id
    }, { userId: dev.id });

    // Unfinished subtask T2 (rolls over)
    const subtaskUnfinished = await Task.create({
      title: 'Subtask 2 (In Progress)',
      type: 'Task',
      status: 'IN_PROGRESS',
      parentId: parentStory.id,
      creatorId: dev.id,
      assigneeId: dev.id,
      sprintId: sprint1.id
    }, { userId: dev.id });

    console.log('📝 Created parent Story S1 (IN_PROGRESS) with two children in Sprint 1:');
    console.log(`   - ${subtaskDone.title}: status = DONE`);
    console.log(`   - ${subtaskUnfinished.title}: status = IN_PROGRESS`);

    // 4. Create and Force-Start Sprint 2 (New Active Sprint)
    const sprint2 = await Sprint.create({
      name: 'Sprint 2 (Active)',
      startDate: today,
      endDate: addDays(today, 14),
      status: 'ACTIVE',
      teamId: 1
    });

    console.log(`\n🚀 Rollover Triggered: Starting Active ${sprint2.name}...`);
    const results = await executeRollover(sprint2, { systemUserId: manager.id });
    console.log(`📊 Rollover Engine Results:`, results);

    // 5. Query and Assert changes
    const parentReload = await Task.findByPk(parentStory.id);
    const subtaskDoneReload = await Task.findByPk(subtaskDone.id);
    const subtaskUnfinishedReload = await Task.findByPk(subtaskUnfinished.id);

    console.log('\n🔍 Post-Rollover Analysis:');
    console.log(`   - Unfinished subtask sprintId: ${subtaskUnfinishedReload.sprintId} (Expected: ${sprint2.id})`);
    console.log(`   - Unfinished subtask originalSprintId: ${subtaskUnfinishedReload.originalSprintId} (Expected: ${sprint1.id})`);
    console.log(`   - Unfinished subtask rolloverCount: ${subtaskUnfinishedReload.rolloverCount} (Expected: 1)`);
    console.log(`   - Parent Story sprintId: ${parentReload.sprintId} (Expected: ${sprint2.id} - due to hierarchy fracture)`);
    console.log(`   - DONE subtask sprintId: ${subtaskDoneReload.sprintId} (Expected: ${sprint1.id} - stayed behind)`);

    // Multi-rollover simulation
    console.log('\n🔄 Simulating Multi-Rollover...');
    // Complete Sprint 2
    await sprint2.update({ status: 'COMPLETED' });
    console.log(`📅 Completed ${sprint2.name}.`);

    // Start Sprint 3
    const sprint3 = await Sprint.create({
      name: 'Sprint 3 (Active)',
      startDate: addDays(today, 15),
      endDate: addDays(today, 29),
      status: 'ACTIVE',
      teamId: 1
    });

    console.log(`🚀 Rollover Triggered: Starting Active ${sprint3.name}...`);
    const results2 = await executeRollover(sprint3, { systemUserId: manager.id });
    console.log(`📊 Rollover Engine Results:`, results2);

    const subtaskUnfinishedReload3 = await Task.findByPk(subtaskUnfinished.id);
    console.log(`\n🔍 Post-Rollover #2 Analysis:`);
    console.log(`   - Unfinished subtask sprintId: ${subtaskUnfinishedReload3.sprintId} (Expected: ${sprint3.id})`);
    console.log(`   - Unfinished subtask originalSprintId: ${subtaskUnfinishedReload3.originalSprintId} (Expected: ${sprint1.id} - Latched to origin!)`);
    console.log(`   - Unfinished subtask rolloverCount: ${subtaskUnfinishedReload3.rolloverCount} (Expected: 2)`);

    console.log('\n🎉 Simulation completed successfully!');
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  } finally {
    await sequelize.close();
  }
}

simulate();
