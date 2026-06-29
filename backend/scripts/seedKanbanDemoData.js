/**
 * Demo Data Seeder for Module 4 Kanban Board
 * Usage: node scripts/seedKanbanDemoData.js
 */

const dotenv = require('dotenv');
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';

dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const { sequelize, User, Sprint, Task } = require('../models');

const seedDemoBoard = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL database.');

    // ── 1. Clear Tasks & Sprints ─────────────────────────────────────────────
    console.log('🧹 Clearing all tasks and sprints...');
    await Task.destroy({ where: {}, truncate: false, force: true });
    await Sprint.destroy({ where: {}, truncate: false, force: true });

    // ── 2. Read existing seeded users ────────────────────────────────────────
    const employee = await User.findOne({ where: { email: 'employee@yakkaytech.com' } });
    const scrumMaster = await User.findOne({ where: { email: 'scrum@yakkaytech.com' } });
    const manager = await User.findOne({ where: { email: 'manager@yakkaytech.com' } });

    if (!employee || !scrumMaster || !manager) {
      throw new Error('Baseline users not found. Run "npm run seed:auth" first.');
    }
    console.log(`👤 Resolved users:
      - Employee: ${employee.name} (ID: ${employee.id})
      - Scrum Master: ${scrumMaster.name} (ID: ${scrumMaster.id})
      - Manager: ${manager.name} (ID: ${manager.id})`);

    // ── 3. Create Active Sprint ──────────────────────────────────────────────
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nextWeekStr = nextWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const activeSprint = await Sprint.create({
      name: 'Demo Active Sprint',
      startDate: yesterdayStr,
      endDate: nextWeekStr,
      scrumMasterId: scrumMaster.id,
    });
    console.log(`📅 Created sprint: "${activeSprint.name}" (${yesterdayStr} → ${nextWeekStr})`);

    // ── 4. Populate Epics, Stories, Tasks & Subtasks ──────────────────────────
    console.log('🏗️ Populating Kanban board tasks...');

    // --- EPIC 1: Payment Gateway Rewrite ---
    const epic1 = await Task.create({
      title: 'Payment Gateway Overhaul',
      type: 'Epic',
      status: 'IN_PROGRESS',
      creatorId: manager.id,
      sprintId: activeSprint.id,
    });

    // Story 1 under Epic 1
    const story1 = await Task.create({
      title: 'Stripe Subscriptions Integration',
      type: 'Story',
      status: 'IN_PROGRESS',
      parentId: epic1.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    });

    // Task 1.1 under Story 1
    const task1_1 = await Task.create({
      title: 'Stripe Webhooks Listener Endpoint',
      type: 'Task',
      status: 'IN_REVIEW',
      parentId: story1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    // Subtasks under Task 1.1 (Verify signature & events)
    await Task.create({
      title: 'Verify Stripe signature header',
      type: 'Subtask',
      status: 'DONE',
      parentId: task1_1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    await Task.create({
      title: 'Validate Webhook event types mapping',
      type: 'Subtask',
      status: 'IN_REVIEW',
      parentId: task1_1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    // Task 1.2 under Story 1 (TODO)
    await Task.create({
      title: 'Generate monthly subscription billing invoice PDF',
      type: 'Task',
      status: 'TODO',
      parentId: story1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });


    // --- STORY 2: Authentication Pipeline (Standalone) ---
    const story2 = await Task.create({
      title: 'User Authentication Pipeline Upgrade',
      type: 'Story',
      status: 'IN_PROGRESS',
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    });

    // Task 2.1 under Story 2 (IN_PROGRESS)
    await Task.create({
      title: 'Setup JWT secure HttpOnly cookies',
      type: 'Task',
      status: 'IN_PROGRESS',
      parentId: story2.id,
      creatorId: scrumMaster.id,
      assigneeId: scrumMaster.id,
      sprintId: activeSprint.id,
    });

    // Task 2.2 under Story 2 (DONE)
    await Task.create({
      title: 'Support multi-tenant corporate SSO redirect login',
      type: 'Task',
      status: 'DONE',
      parentId: story2.id,
      creatorId: scrumMaster.id,
      assigneeId: scrumMaster.id,
      sprintId: activeSprint.id,
    });


    // --- STANDALONE ISSUES ---
    // Standalone Task (QA_TESTING)
    await Task.create({
      title: 'Audit application API access logs',
      type: 'Task',
      status: 'QA_TESTING',
      creatorId: manager.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    // Standalone Epic (TODO)
    await Task.create({
      title: 'Infrastructure Security & Hardening Q3',
      type: 'Epic',
      status: 'TODO',
      creatorId: manager.id,
      sprintId: activeSprint.id,
    });

    // Standalone Story (IN_PROGRESS)
    await Task.create({
      title: 'Implement workspace dark-mode UI toggle switch',
      type: 'Story',
      status: 'IN_PROGRESS',
      creatorId: employee.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });


    // --- CONFIDENTIAL ISSUES ---
    // Confidential task for manager only
    await Task.create({
      title: 'Review executive core salaries audit data',
      type: 'Task',
      isConfidential: true,
      status: 'QA_TESTING',
      creatorId: manager.id,
      assigneeId: manager.id,
      sprintId: activeSprint.id,
    });

    // Confidential task assigned to employee (visible to employee and manager, hidden from scrum master)
    await Task.create({
      title: 'Investigate Kevin Employee logins anomaly report',
      type: 'Task',
      isConfidential: true,
      status: 'TODO',
      creatorId: manager.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    });

    console.log('🎉 Kanban demo data populated successfully.');
  } catch (error) {
    console.error('Demo data seed failed:', error.message);
  } finally {
    await sequelize.close();
  }
};

seedDemoBoard();
