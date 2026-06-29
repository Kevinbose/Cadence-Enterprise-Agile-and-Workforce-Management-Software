/**
 * Seed Module 5 Demo Data — Truncates database and populates 3 users,
 * 3 sprints (COMPLETED, ACTIVE, PENDING), hierarchical tasks, and audit logs.
 * Usage: node scripts/seedSprintAuditData.js
 */

const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';

dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const { sequelize, User, Sprint, Task, Comment, AuditLog, AttendanceRecord } = require('../models');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL database.');

    // ── 1. Force Sync to Truncate All Tables ──────────────────────────────────
    console.log('🧹 Wiping all tables and rebuilding schema...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🏗️ Database tables created successfully.');

    // ── 2. Create the 3 Demo Users ────────────────────────────────────────────
    console.log('👥 Seeding employee, Scrum Master, and Manager...');
    const hashedEmployeePassword = await bcrypt.hash('Employee@123', 10);
    const hashedScrumPassword = await bcrypt.hash('Scrum@123', 10);
    const hashedManagerPassword = await bcrypt.hash('Manager@123', 10);

    const employee = await User.create({
      employeeId: 'YT-2026-001',
      name: 'Kevin Employee',
      email: 'employee@yakkaytech.com',
      passwordHash: hashedEmployeePassword,
      systemRole: 'Employee',
      teamId: 1,
    });

    const scrumMaster = await User.create({
      employeeId: 'YT-2026-003',
      name: 'Kevin ScrumMaster',
      email: 'scrum@yakkaytech.com',
      passwordHash: hashedScrumPassword,
      systemRole: 'Employee',
      teamId: 1,
    });

    const manager = await User.create({
      employeeId: 'YT-2026-002',
      name: 'Kevin Manager',
      email: 'manager@yakkaytech.com',
      passwordHash: hashedManagerPassword,
      systemRole: 'Admin/Manager',
      teamId: 1,
    });

    // Link reports to the Manager
    await employee.update({ managerId: manager.id });
    await scrumMaster.update({ managerId: manager.id });
    console.log('🔗 Linked report relationships.');

    // ── 3. Create the 3 Sprints (Active, Pending, Completed) ───────────────────
    console.log('📅 Seeding sprints with different status lifecycle states...');
    const today = getTodayIST();

    // Active Sprint
    const activeSprint = await Sprint.create({
      name: 'Demo Active Sprint',
      startDate: addDays(today, -3),
      endDate: addDays(today, 11),
      scrumMasterId: scrumMaster.id,
      status: 'ACTIVE',
    });

    // Pending Sprint
    const pendingSprint = await Sprint.create({
      name: 'Q3 Backend Infrastructure Sprint',
      startDate: addDays(today, 12),
      endDate: addDays(today, 26),
      scrumMasterId: null,
      status: 'PENDING',
    });

    // Completed Sprint
    const completedSprint = await Sprint.create({
      name: 'Q2 Payment Gateway Migration Sprint',
      startDate: addDays(today, -20),
      endDate: addDays(today, -6),
      scrumMasterId: scrumMaster.id,
      status: 'COMPLETED',
    });

    console.log(`  ✔ "${activeSprint.name}" is ACTIVE`);
    console.log(`  ✔ "${pendingSprint.name}" is PENDING`);
    console.log(`  ✔ "${completedSprint.name}" is COMPLETED`);

    // ── 4. Populate Tasks for Sprints (Pass userId in options to satisfy hooks) ──
    console.log('🏗️ Populating tasks for each sprint...');

    // SPRINT 1 (ACTIVE) TASKS
    const epic1 = await Task.create({
      title: 'Payment Gateway Overhaul',
      type: 'Epic',
      status: 'IN_PROGRESS',
      creatorId: manager.id,
      sprintId: activeSprint.id,
    }, { userId: manager.id });

    const story1 = await Task.create({
      title: 'Stripe Subscriptions Integration',
      type: 'Story',
      status: 'IN_PROGRESS',
      parentId: epic1.id,
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    const task1 = await Task.create({
      title: 'Stripe Webhooks Listener Endpoint',
      type: 'Task',
      status: 'IN_REVIEW',
      parentId: story1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    const subtask1 = await Task.create({
      title: 'Verify Stripe signature header',
      type: 'Subtask',
      status: 'DONE',
      parentId: task1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    }, { userId: employee.id });

    const subtask2 = await Task.create({
      title: 'Validate Webhook event types mapping',
      type: 'Subtask',
      status: 'IN_REVIEW',
      parentId: task1.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: activeSprint.id,
    }, { userId: employee.id });

    // Standalone story & task in Sprint 1
    const story2 = await Task.create({
      title: 'User Authentication Pipeline Upgrade',
      type: 'Story',
      status: 'IN_PROGRESS',
      creatorId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    const task2 = await Task.create({
      title: 'Setup JWT secure HttpOnly cookies',
      type: 'Task',
      status: 'IN_PROGRESS',
      parentId: story2.id,
      creatorId: scrumMaster.id,
      assigneeId: scrumMaster.id,
      sprintId: activeSprint.id,
    }, { userId: scrumMaster.id });

    // Confidential tasks
    await Task.create({
      title: 'Review executive core salaries audit data',
      type: 'Task',
      isConfidential: true,
      status: 'QA_TESTING',
      creatorId: manager.id,
      assigneeId: manager.id,
      sprintId: activeSprint.id,
    }, { userId: manager.id });

    // SPRINT 2 (PENDING) TASKS
    const pendingEpic = await Task.create({
      title: 'Infrastructure Security & Hardening Q3',
      type: 'Epic',
      status: 'TODO',
      creatorId: manager.id,
      sprintId: pendingSprint.id,
    }, { userId: manager.id });

    await Task.create({
      title: 'Migrate to K8s v1.30',
      type: 'Task',
      status: 'TODO',
      parentId: pendingEpic.id,
      creatorId: manager.id,
      assigneeId: employee.id,
      sprintId: pendingSprint.id,
    }, { userId: manager.id });

    // SPRINT 3 (COMPLETED) TASKS
    const completedStory = await Task.create({
      title: 'Complete Stripe Sandbox Integration',
      type: 'Story',
      status: 'DONE',
      creatorId: scrumMaster.id,
      sprintId: completedSprint.id,
    }, { userId: scrumMaster.id });

    await Task.create({
      title: 'Connect Sandbox API Keys',
      type: 'Task',
      status: 'DONE',
      parentId: completedStory.id,
      creatorId: scrumMaster.id,
      assigneeId: employee.id,
      sprintId: completedSprint.id,
    }, { userId: scrumMaster.id });

    console.log('  ✔ Created all hierarchical deliverables.');

    // ── 5. Seed Audit Logs ────────────────────────────────────────────────────
    console.log('📝 Seeding historical audit records for the Git-style Diff viewer...');

    // Audit logs for Sprint 1
    await AuditLog.bulkCreate([
      {
        taskId: epic1.id,
        sprintId: activeSprint.id,
        userId: manager.id,
        action: 'CREATE',
        changes: { title: 'Payment Gateway Overhaul', type: 'Epic', status: 'IN_PROGRESS' },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        taskId: story1.id,
        sprintId: activeSprint.id,
        userId: scrumMaster.id,
        action: 'CREATE',
        changes: { title: 'Stripe Subscriptions Integration', type: 'Story', status: 'IN_PROGRESS' },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        taskId: task1.id,
        sprintId: activeSprint.id,
        userId: employee.id,
        action: 'UPDATE',
        changes: {
          status: { old: 'TODO', new: 'IN_PROGRESS' }
        },
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        taskId: task1.id,
        sprintId: activeSprint.id,
        userId: employee.id,
        action: 'UPDATE',
        changes: {
          status: { old: 'IN_PROGRESS', new: 'IN_REVIEW' },
          title: { old: 'Stripe Webhooks Listener', new: 'Stripe Webhooks Listener Endpoint' }
        },
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      },
      {
        taskId: subtask1.id,
        sprintId: activeSprint.id,
        userId: employee.id,
        action: 'UPDATE',
        changes: {
          status: { old: 'TODO', new: 'DONE' }
        },
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      },
    ]);

    // Audit logs for Sprint 3 (Completed Sprint)
    await AuditLog.bulkCreate([
      {
        taskId: completedStory.id,
        sprintId: completedSprint.id,
        userId: scrumMaster.id,
        action: 'CREATE',
        changes: { title: 'Complete Stripe Sandbox Integration', type: 'Story', status: 'DONE' },
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        taskId: null, // represents deleted item
        sprintId: completedSprint.id,
        userId: manager.id,
        action: 'DELETE',
        changes: { id: 99, title: 'Obsolete Stripe Legacy Webhook Listener', type: 'Task', status: 'TODO', issueKey: 'YT-99' },
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      }
    ]);

    console.log('  ✔ Created audit log entries.');
    console.log('\n======================================================');
    console.log('🎉 Database fully initialized for manual testing!');
    console.log('======================================================');
    console.log('Demo Accounts:');
    console.log('  Employee:     employee@yakkaytech.com  /  Employee@123');
    console.log('  Scrum Master: scrum@yakkaytech.com     /  Scrum@123');
    console.log('  Manager:      manager@yakkaytech.com    /  Manager@123');
    console.log('======================================================\n');

  } catch (error) {
    console.error('Migration seed failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

seed();
