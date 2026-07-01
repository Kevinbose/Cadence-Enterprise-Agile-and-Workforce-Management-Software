/**
 * Seed Module 6 Large Telemetry Data — Wipes database and populates:
 *   - 2 Managers (different team IDs)
 *   - 2 Scrum Masters (one for each manager's team)
 *   - 20 Employees (10 under Manager 1 / Team 1, 10 under Manager 2 / Team 2)
 *   - 8 Sprints (4 per team: 1 active, 2 pending, 1 completed)
 *   - Telemetry-grade Tasks, Comments, Audit logs, and Attendance records to highlight differences in Trust Scores, ARI, FTPR, anomalies, and Git diffs.
 * Usage: node scripts/seedLargeTelemetryData.js
 */

const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const { sequelize, User, Sprint, Task, Comment, AuditLog, AttendanceRecord } = require('../models');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL database.');

    // ── 1. Wipe all database tables ──────────────────────────────────────────
    console.log('🧹 Wiping all tables and rebuilding schema...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🏗️ Database tables created successfully.');

    // ── 2. Create Super Admin, Managers & Scrum Masters ───────────────────────
    console.log('👥 Seeding system roles (Admin, managers, scrum masters)...');
    const hashedAdminPassword = await bcrypt.hash('Y@kk@Y@123$', 10);
    const hashedManagerPassword = await bcrypt.hash('Manager@123', 10);
    const hashedScrumPassword = await bcrypt.hash('Scrum@123', 10);
    const hashedEmployeePassword = await bcrypt.hash('Employee@123', 10);

    // IT Administrator (SuperAdmin)
    await User.create({
      employeeId: 'YT-ADMIN-001',
      name: 'IT Administrator',
      email: 'Yakkay_Admin@yakkaytech.com',
      passwordHash: hashedAdminPassword,
      systemRole: 'SuperAdmin',
      teamId: null,
      jobTitle: 'IT System Architect',
    });

    // Managers (Team 1 and Team 2)
    const manager1 = await User.create({
      employeeId: 'YT-MGR-001',
      name: 'Sarah Executive',
      email: 'manager1@yakkaytech.com',
      passwordHash: hashedManagerPassword,
      systemRole: 'Admin/Manager',
      teamId: 1,
    });

    const manager2 = await User.create({
      employeeId: 'YT-MGR-002',
      name: 'Victor Director',
      email: 'manager2@yakkaytech.com',
      passwordHash: hashedManagerPassword,
      systemRole: 'Admin/Manager',
      teamId: 2,
    });

    // Scrum Masters (Team 1 and Team 2)
    const scrumMaster1 = await User.create({
      employeeId: 'YT-SM-001',
      name: 'Alan ScrumMaster',
      email: 'scrum1@yakkaytech.com',
      passwordHash: hashedScrumPassword,
      systemRole: 'Employee',
      teamId: 1,
      managerId: manager1.id,
    });

    const scrumMaster2 = await User.create({
      employeeId: 'YT-SM-002',
      name: 'Brenda ScrumMaster',
      email: 'scrum2@yakkaytech.com',
      passwordHash: hashedScrumPassword,
      systemRole: 'Employee',
      teamId: 2,
      managerId: manager2.id,
    });

    // ── 3. Create Employees (10 per team) ─────────────────────────────────────
    console.log('👥 Seeding 20 employees with varying performance metrics...');
    
    const team1Data = [
      { name: 'Aaron Elite', email: 'emp1_1@yakkaytech.com', type: 'ELITE' },
      { name: 'Bridget Balanced', email: 'emp1_2@yakkaytech.com', type: 'GOOD' },
      { name: 'Charlie Careless', email: 'emp1_3@yakkaytech.com', type: 'RISK' },
      { name: 'Diana Diligent', email: 'emp1_4@yakkaytech.com', type: 'ELITE' },
      { name: 'Evan Erratic', email: 'emp1_5@yakkaytech.com', type: 'RISK' },
      { name: 'Fiona Focus', email: 'emp1_6@yakkaytech.com', type: 'GOOD' },
      { name: 'Gavin Good', email: 'emp1_7@yakkaytech.com', type: 'GOOD' },
      { name: 'Hannah High', email: 'emp1_8@yakkaytech.com', type: 'ELITE' },
      { name: 'Ian Inconsistent', email: 'emp1_9@yakkaytech.com', type: 'RISK' },
      { name: 'Julia Just', email: 'emp1_10@yakkaytech.com', type: 'GOOD' },
    ];

    const team2Data = [
      { name: 'Kevin Kudos', email: 'emp2_1@yakkaytech.com', type: 'ELITE' },
      { name: 'Liam Lax', email: 'emp2_2@yakkaytech.com', type: 'RISK' },
      { name: 'Mia Model', email: 'emp2_3@yakkaytech.com', type: 'ELITE' },
      { name: 'Noah Normal', email: 'emp2_4@yakkaytech.com', type: 'GOOD' },
      { name: 'Olivia Outstanding', email: 'emp2_5@yakkaytech.com', type: 'ELITE' },
      { name: 'Peter Punctual', email: 'emp2_6@yakkaytech.com', type: 'ELITE' },
      { name: 'Quinn Quiet', email: 'emp2_7@yakkaytech.com', type: 'GOOD' },
      { name: 'Ryan Risky', email: 'emp2_8@yakkaytech.com', type: 'RISK' },
      { name: 'Sophia Standard', email: 'emp2_9@yakkaytech.com', type: 'GOOD' },
      { name: 'Thomas Tardy', email: 'emp2_10@yakkaytech.com', type: 'RISK' },
    ];

    const team1Employees = [];
    for (let i = 0; i < team1Data.length; i++) {
      const emp = await User.create({
        employeeId: `YT-EMP-1${String(i + 1).padStart(2, '0')}`,
        name: team1Data[i].name,
        email: team1Data[i].email,
        passwordHash: hashedEmployeePassword,
        systemRole: 'Employee',
        teamId: 1,
        managerId: manager1.id,
      });
      emp.perfType = team1Data[i].type;
      team1Employees.push(emp);
    }

    const team2Employees = [];
    for (let i = 0; i < team2Data.length; i++) {
      const emp = await User.create({
        employeeId: `YT-EMP-2${String(i + 1).padStart(2, '0')}`,
        name: team2Data[i].name,
        email: team2Data[i].email,
        passwordHash: hashedEmployeePassword,
        systemRole: 'Employee',
        teamId: 2,
        managerId: manager2.id,
      });
      emp.perfType = team2Data[i].type;
      team2Employees.push(emp);
    }

    // ── 4. Create Sprints (4 per team: 1 active, 2 pending, 1 completed) ──────
    console.log('📅 Seeding 8 sprints across both teams...');
    const today = getTodayIST();

    const sprints = [];
    // Team 1 Sprints
    sprints.push(await Sprint.create({
      name: 'T1 Active Sprint 10',
      startDate: addDays(today, -5),
      endDate: addDays(today, 9),
      scrumMasterId: scrumMaster1.id,
      status: 'ACTIVE',
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Planned Sprint 11',
      startDate: addDays(today, 10),
      endDate: addDays(today, 24),
      scrumMasterId: scrumMaster1.id,
      status: 'PENDING',
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Planned Sprint 12',
      startDate: addDays(today, 25),
      endDate: addDays(today, 39),
      scrumMasterId: scrumMaster1.id,
      status: 'PENDING',
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Historic Sprint 9',
      startDate: addDays(today, -20),
      endDate: addDays(today, -6),
      scrumMasterId: scrumMaster1.id,
      status: 'COMPLETED',
    }));

    // Team 2 Sprints
    sprints.push(await Sprint.create({
      name: 'T2 Active Sprint 15',
      startDate: addDays(today, -5),
      endDate: addDays(today, 9),
      scrumMasterId: scrumMaster2.id,
      status: 'ACTIVE',
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Planned Sprint 16',
      startDate: addDays(today, 10),
      endDate: addDays(today, 24),
      scrumMasterId: scrumMaster2.id,
      status: 'PENDING',
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Planned Sprint 17',
      startDate: addDays(today, 25),
      endDate: addDays(today, 39),
      scrumMasterId: scrumMaster2.id,
      status: 'PENDING',
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Historic Sprint 14',
      startDate: addDays(today, -20),
      endDate: addDays(today, -6),
      scrumMasterId: scrumMaster2.id,
      status: 'COMPLETED',
    }));

    const [t1Active, t1Pending1, t1Pending2, t1Completed] = sprints.slice(0, 4);
    const [t2Active, t2Pending1, t2Pending2, t2Completed] = sprints.slice(4, 8);

    // ── 5. Seed Attendance / Timesheets & Anomalies (Last 10 Days) ────────────
    console.log('⏰ Generating 10 days of timesheet & geofence attendance records...');
    const allEmployees = [...team1Employees, ...team2Employees];

    for (let dayOffset = -10; dayOffset <= -1; dayOffset++) {
      const recordDate = addDays(today, dayOffset);
      
      // Skip weekends to look realistic
      const dateObj = new Date(`${recordDate}T00:00:00+05:30`);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (const emp of allEmployees) {
        let status = 'PRESENT_OFFICE';
        let workHours = 8.5;
        let systemAutoClosed = false;
        let regularizationReason = null;

        if (emp.perfType === 'RISK') {
          // 30% chance of WFH, 25% chance of ABSENT, 20% chance of auto-closed anomaly
          const roll = Math.random();
          if (roll < 0.25) {
            status = 'ABSENT';
            workHours = 0;
          } else if (roll < 0.45) {
            status = 'WFH_APPROVED';
            workHours = 8.0;
          } else if (roll < 0.65) {
            status = 'PRESENT_OFFICE';
            workHours = 12.0;
            systemAutoClosed = true; // anomaly!
          }
        } else if (emp.perfType === 'GOOD') {
          // occasional WFH
          if (Math.random() < 0.2) {
            status = 'WFH_APPROVED';
          }
        } else {
          // ELITE performers have perfect attendance
          if (Math.random() < 0.1) {
            status = 'WFH_APPROVED';
          }
        }

        await AttendanceRecord.create({
          userId: emp.id,
          date: recordDate,
          checkInTime: status !== 'ABSENT' ? new Date(`${recordDate}T09:15:00+05:30`) : null,
          checkOutTime: status !== 'ABSENT' ? new Date(`${recordDate}T17:45:00+05:30`) : null,
          status,
          workHours,
          isActiveSession: false,
          systemAutoClosed,
          regularizationReason: systemAutoClosed && Math.random() < 0.5 ? 'Forgot to pause session when leaving office.' : null,
          isStandupLocked: true,
        });
      }
    }

    // ── 6. Seed Tasks, Comments & Diffs (To derive GTP & FTPR) ─────────────────
    console.log('🏗️ Creating deliverables, comments, and audit diff records...');

    // We helper function to populate tasks for a specific team
    const seedTeamTasks = async (teamId, manager, scrumMaster, employees, activeSprint, completedSprint, pendingSprint1, pendingSprint2) => {
      // 1. Epic in active sprint
      const epic = await Task.create({
        title: `Core Module Integration (Team ${teamId})`,
        type: 'Epic',
        status: 'IN_PROGRESS',
        creatorId: manager.id,
        sprintId: activeSprint.id,
      }, { userId: manager.id });

      // SPRINT TASKS
      for (const emp of employees) {
        // Create 2 tasks in active sprint for each employee
        const taskActive = await Task.create({
          title: `Implement feature deliverables for ${emp.name}`,
          type: 'Story',
          status: emp.perfType === 'ELITE' ? 'DONE' : 'IN_PROGRESS',
          parentId: epic.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: activeSprint.id,
        }, { userId: scrumMaster.id });

        // High risk employees get rejections (Negative comments + audit bounces)
        if (emp.perfType === 'RISK') {
          // Rejection 1
          await Comment.create({
            taskId: taskActive.id,
            authorId: scrumMaster.id,
            content: `Rejected: Code structure lacks proper validation rules.`,
            evaluationTier: 'Negative (Simple)',
          });

          // Rejection 2
          await Comment.create({
            taskId: taskActive.id,
            authorId: manager.id,
            content: `Rejected: Memory leak detected during integration tests. Critical fix required.`,
            evaluationTier: 'Negative (Serious)',
          });

          // Seed update diffs in audit_logs to register as GTP (Goalpost Tamper Strikes)
          // Strike 1: Title Change
          await AuditLog.create({
            taskId: taskActive.id,
            sprintId: activeSprint.id,
            userId: emp.id,
            action: 'UPDATE',
            changes: {
              title: { old: `Original title specifications for ${emp.name}`, new: `Implement feature deliverables for ${emp.name}` }
            },
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          });

          // Strike 2: Description Change
          await AuditLog.create({
            taskId: taskActive.id,
            sprintId: activeSprint.id,
            userId: emp.id,
            action: 'UPDATE',
            changes: {
              description: { old: `Deliver backend services and tests.`, new: `Deliver basic services without test code (updated due to lack of time).` }
            },
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          });
        }
      }

      // 2. Completed Sprint Tasks (already finished)
      const oldEpic = await Task.create({
        title: `Sprint Legacy Overhaul (Team ${teamId})`,
        type: 'Epic',
        status: 'DONE',
        creatorId: manager.id,
        sprintId: completedSprint.id,
      }, { userId: manager.id });

      for (const emp of employees) {
        await Task.create({
          title: `Legacy system configuration for ${emp.name}`,
          type: 'Task',
          status: 'DONE',
          parentId: oldEpic.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: completedSprint.id,
        }, { userId: scrumMaster.id });
      }

      // 3. Pending Sprints Tasks (all in TODO status)
      // Pending Sprint 1
      const pendingEpic1 = await Task.create({
        title: `Feature Roadmap Planning Q3 (Team ${teamId})`,
        type: 'Epic',
        status: 'TODO',
        creatorId: manager.id,
        sprintId: pendingSprint1.id,
      }, { userId: manager.id });

      for (const emp of employees) {
        const story = await Task.create({
          title: `Proposed feature specifications for ${emp.name}`,
          type: 'Story',
          status: 'TODO',
          parentId: pendingEpic1.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: pendingSprint1.id,
        }, { userId: scrumMaster.id });

        await Task.create({
          title: `Technical spikes for ${emp.name}'s deliverables`,
          type: 'Task',
          status: 'TODO',
          parentId: story.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: pendingSprint1.id,
        }, { userId: scrumMaster.id });
      }

      // Pending Sprint 2
      const pendingEpic2 = await Task.create({
        title: `Core Scalability & Security (Team ${teamId})`,
        type: 'Epic',
        status: 'TODO',
        creatorId: manager.id,
        sprintId: pendingSprint2.id,
      }, { userId: manager.id });

      for (const emp of employees) {
        const story = await Task.create({
          title: `Security audit scope for ${emp.name}`,
          type: 'Story',
          status: 'TODO',
          parentId: pendingEpic2.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: pendingSprint2.id,
        }, { userId: scrumMaster.id });

        await Task.create({
          title: `Implement security scanning hooks for ${emp.name}`,
          type: 'Task',
          status: 'TODO',
          parentId: story.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: pendingSprint2.id,
        }, { userId: scrumMaster.id });
      }
    };

    await seedTeamTasks(1, manager1, scrumMaster1, team1Employees, t1Active, t1Completed, t1Pending1, t1Pending2);
    await seedTeamTasks(2, manager2, scrumMaster2, team2Employees, t2Active, t2Completed, t2Pending1, t2Pending2);

    console.log('✅ Created tasks and audit trails.');
    console.log('\n======================================================');
    console.log('🎉 Seeding Completed Successfully!');
    console.log('======================================================\n');

  } catch (error) {
    console.error('Migration seed failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

run();
