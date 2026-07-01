/**
 * Seed Module 6 Large Telemetry Data — Wipes database and populates:
 *   - 2 Managers (different team IDs)
 *   - 2 Scrum Masters (one for each manager's team)
 *   - 20 Employees (10 under Manager 1 / Team 1, 10 under Manager 2 / Team 2)
 *   - 12 Sprints (6 per team: Q1 completed, Q2 completed, Q3 completed, Q3 active, and 2 pending)
 *   - Telemetry-grade Tasks, Comments, Audit logs, and Attendance records spanning Q1, Q2, and Q3 2026.
 *   - This highlights the differences in Trust Scores, ARI, FTPR, anomalies, and Git diffs across multiple quarters in Manager Hub & Appraisal Engine.
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

    // ── 4. Create Sprints (6 per team across Q1, Q2, Q3 2026) ──────────────────
    console.log('📅 Seeding 12 sprints spanning Q1, Q2, Q3 2026...');
    const today = getTodayIST();
    const currentYear = new Date(today).getFullYear();

    const sprints = [];
    
    // Team 1 Sprints
    sprints.push(await Sprint.create({
      name: 'T1 Q1 Historic Sprint 7',
      startDate: `${currentYear}-02-01`,
      endDate: `${currentYear}-02-15`,
      scrumMasterId: scrumMaster1.id,
      status: 'COMPLETED',
      teamId: 1,
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Q2 Historic Sprint 8',
      startDate: `${currentYear}-05-01`,
      endDate: `${currentYear}-05-15`,
      scrumMasterId: scrumMaster1.id,
      status: 'COMPLETED',
      teamId: 1,
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Q3 Historic Sprint 9',
      startDate: addDays(today, -20),
      endDate: addDays(today, -6),
      scrumMasterId: scrumMaster1.id,
      status: 'COMPLETED',
      teamId: 1,
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Q3 Active Sprint 10',
      startDate: addDays(today, -5),
      endDate: addDays(today, 9),
      scrumMasterId: scrumMaster1.id,
      status: 'ACTIVE',
      teamId: 1,
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Planned Sprint 11',
      startDate: addDays(today, 10),
      endDate: addDays(today, 24),
      scrumMasterId: scrumMaster1.id,
      status: 'PENDING',
      teamId: 1,
    }));
    sprints.push(await Sprint.create({
      name: 'T1 Planned Sprint 12',
      startDate: addDays(today, 25),
      endDate: addDays(today, 39),
      scrumMasterId: scrumMaster1.id,
      status: 'PENDING',
      teamId: 1,
    }));

    // Team 2 Sprints
    sprints.push(await Sprint.create({
      name: 'T2 Q1 Historic Sprint 12',
      startDate: `${currentYear}-02-01`,
      endDate: `${currentYear}-02-15`,
      scrumMasterId: scrumMaster2.id,
      status: 'COMPLETED',
      teamId: 2,
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Q2 Historic Sprint 13',
      startDate: `${currentYear}-05-01`,
      endDate: `${currentYear}-05-15`,
      scrumMasterId: scrumMaster2.id,
      status: 'COMPLETED',
      teamId: 2,
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Q3 Historic Sprint 14',
      startDate: addDays(today, -20),
      endDate: addDays(today, -6),
      scrumMasterId: scrumMaster2.id,
      status: 'COMPLETED',
      teamId: 2,
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Q3 Active Sprint 15',
      startDate: addDays(today, -5),
      endDate: addDays(today, 9),
      scrumMasterId: scrumMaster2.id,
      status: 'ACTIVE',
      teamId: 2,
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Planned Sprint 16',
      startDate: addDays(today, 10),
      endDate: addDays(today, 24),
      scrumMasterId: scrumMaster2.id,
      status: 'PENDING',
      teamId: 2,
    }));
    sprints.push(await Sprint.create({
      name: 'T2 Planned Sprint 17',
      startDate: addDays(today, 25),
      endDate: addDays(today, 39),
      scrumMasterId: scrumMaster2.id,
      status: 'PENDING',
      teamId: 2,
    }));

    const [t1Q1Comp, t1Q2Comp, t1Q3Comp, t1Active, t1Pending1, t1Pending2] = sprints.slice(0, 6);
    const [t2Q1Comp, t2Q2Comp, t2Q3Comp, t2Active, t2Pending1, t2Pending2] = sprints.slice(6, 12);

    // ── 5. Seed Attendance / Timesheets & Anomalies (Spanning Q1, Q2, Q3) ──────
    console.log('⏰ Generating timesheet & geofence attendance records for Q1, Q2, and Q3...');
    const allEmployees = [...team1Employees, ...team2Employees];

    // Helper to generate 8 working days of attendance within a date range
    const seedAttendancePeriod = async (startBaseDate, prefixLabel) => {
      for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
        const recordDate = addDays(startBaseDate, dayOffset);
        const dateObj = new Date(`${recordDate}T00:00:00+05:30`);
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        for (const emp of allEmployees) {
          let status = 'PRESENT_OFFICE';
          let workHours = 8.5;
          let systemAutoClosed = false;
          let regularizationReason = null;

          // Introduce variation based on performance tier
          if (emp.perfType === 'RISK') {
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
              systemAutoClosed = true; // Auto-closed timesheet anomaly
            }
          } else if (emp.perfType === 'GOOD') {
            if (Math.random() < 0.15) {
              status = 'WFH_APPROVED';
            }
          } else {
            // ELITE performers: perfect check-in record
            if (Math.random() < 0.08) {
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
            regularizationReason: systemAutoClosed && Math.random() < 0.6 ? `Forgot check-out during ${prefixLabel} push.` : null,
            isStandupLocked: true,
          });
        }
      }
    };

    // Seed Q1 Attendance (February 2026)
    await seedAttendancePeriod(`${currentYear}-02-02`, 'Q1');
    // Seed Q2 Attendance (May 2026)
    await seedAttendancePeriod(`${currentYear}-05-02`, 'Q2');
    // Seed Q3 Attendance (Current/Recent weeks)
    await seedAttendancePeriod(addDays(today, -15), 'Q3');

    // ── 6. Seed Tasks, Comments & Diffs (To derive GTP & FTPR per Quarter) ──────
    console.log('🏗️ Creating deliverables, comments, and audit diff records spanning quarters...');

    const seedTeamTasks = async (
      teamId,
      manager,
      scrumMaster,
      employees,
      q1Sprint,
      q2Sprint,
      q3CompletedSprint,
      activeSprint,
      pendingSprint1,
      pendingSprint2
    ) => {
      // Helper to generate comments and audits for a task in a specific quarter
      const addQuarterlyTelemetry = async (task, emp, quarterName, baseDateStr) => {
        const dateOffset = (days) => new Date(addDays(baseDateStr, days) + 'T12:00:00.000Z');

        if (emp.perfType === 'RISK') {
          // Negative feedback causing rejections
          await Comment.create({
            taskId: task.id,
            authorId: scrumMaster.id,
            content: `Rejected in ${quarterName}: Validation fails.`,
            evaluationTier: 'Negative (Simple)',
            createdAt: dateOffset(2),
            updatedAt: dateOffset(2),
          });

          await Comment.create({
            taskId: task.id,
            authorId: manager.id,
            content: `Rejected in ${quarterName}: Unit tests failing on main branch.`,
            evaluationTier: 'Negative (Serious)',
            createdAt: dateOffset(4),
            updatedAt: dateOffset(4),
          });

          // Strike 1: Scope Creep title change
          await AuditLog.create({
            taskId: task.id,
            sprintId: task.sprintId,
            userId: emp.id,
            action: 'UPDATE',
            changes: {
              title: { old: `Setup basic component specifications in ${quarterName}`, new: task.title }
            },
            createdAt: dateOffset(3),
          });

          // Strike 2: Description change
          await AuditLog.create({
            taskId: task.id,
            sprintId: task.sprintId,
            userId: emp.id,
            action: 'UPDATE',
            changes: {
              description: { old: `Full implementation detailing unit test coverage.`, new: `Basic structure only. Tests skipped due to time crunch.` }
            },
            createdAt: dateOffset(5),
          });
        } else {
          // ELITE and GOOD performers get positive evaluations
          await Comment.create({
            taskId: task.id,
            authorId: scrumMaster.id,
            content: `Upvote in ${quarterName}: Excellent implementation and clean API pattern!`,
            evaluationTier: 'Positive',
            createdAt: dateOffset(6),
            updatedAt: dateOffset(6),
          });

          if (emp.perfType === 'ELITE') {
            await Comment.create({
              taskId: task.id,
              authorId: manager.id,
              content: `Upvote in ${quarterName}: Exceeded performance criteria, beautiful architecture!`,
              evaluationTier: 'Positive',
              createdAt: dateOffset(8),
              updatedAt: dateOffset(8),
            });
          }
        }
      };

      // 1. Q1 SPRINT (COMPLETED)
      const q1Epic = await Task.create({
        title: `Q1 Foundation Architecture (Team ${teamId})`,
        type: 'Epic',
        status: 'DONE',
        creatorId: manager.id,
        sprintId: q1Sprint.id,
        createdAt: new Date(`${currentYear}-02-01T09:00:00.000Z`),
        updatedAt: new Date(`${currentYear}-02-15T18:00:00.000Z`),
      }, { userId: manager.id });

      for (const emp of employees) {
        // Vary completion velocity: RISK devs might not finish
        const status = emp.perfType === 'RISK' ? 'IN_REVIEW' : 'DONE';
        const task = await Task.create({
          title: `Q1 Base microservices delivery for ${emp.name}`,
          type: 'Story',
          status,
          parentId: q1Epic.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: q1Sprint.id,
          createdAt: new Date(`${currentYear}-02-02T10:00:00.000Z`),
          updatedAt: new Date(`${currentYear}-02-14T17:00:00.000Z`),
        }, { userId: scrumMaster.id });

        await addQuarterlyTelemetry(task, emp, 'Q1', `${currentYear}-02-02`);
      }

      // 2. Q2 SPRINT (COMPLETED)
      const q2Epic = await Task.create({
        title: `Q2 Security & Data Pipeline (Team ${teamId})`,
        type: 'Epic',
        status: 'DONE',
        creatorId: manager.id,
        sprintId: q2Sprint.id,
        createdAt: new Date(`${currentYear}-05-01T09:00:00.000Z`),
        updatedAt: new Date(`${currentYear}-05-15T18:00:00.000Z`),
      }, { userId: manager.id });

      for (const emp of employees) {
        // RISK developers complete fewer tasks
        const status = emp.perfType === 'RISK' && emp.name.includes('Careless') ? 'TODO' : 'DONE';
        const task = await Task.create({
          title: `Q2 Secure integration and analytics for ${emp.name}`,
          type: 'Story',
          status,
          parentId: q2Epic.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: q2Sprint.id,
          createdAt: new Date(`${currentYear}-05-02T10:00:00.000Z`),
          updatedAt: new Date(`${currentYear}-05-14T17:00:00.000Z`),
        }, { userId: scrumMaster.id });

        await addQuarterlyTelemetry(task, emp, 'Q2', `${currentYear}-05-02`);
      }

      // 3. Q3 SPRINT (COMPLETED)
      const q3Epic = await Task.create({
        title: `Q3 Performance Tuning (Team ${teamId})`,
        type: 'Epic',
        status: 'DONE',
        creatorId: manager.id,
        sprintId: q3CompletedSprint.id,
        createdAt: new Date(addDays(today, -20) + 'T09:00:00.000Z'),
        updatedAt: new Date(addDays(today, -6) + 'T18:00:00.000Z'),
      }, { userId: manager.id });

      for (const emp of employees) {
        const status = 'DONE';
        const task = await Task.create({
          title: `Q3 Telemetry tuning module for ${emp.name}`,
          type: 'Task',
          status,
          parentId: q3Epic.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: q3CompletedSprint.id,
          createdAt: new Date(addDays(today, -19) + 'T10:00:00.000Z'),
          updatedAt: new Date(addDays(today, -7) + 'T17:00:00.000Z'),
        }, { userId: scrumMaster.id });

        await addQuarterlyTelemetry(task, emp, 'Q3', addDays(today, -19));
      }

      // 4. Q3 ACTIVE SPRINT (CURRENT ONGOING WORK)
      const activeEpic = await Task.create({
        title: `Core Module Integration (Team ${teamId})`,
        type: 'Epic',
        status: 'IN_PROGRESS',
        creatorId: manager.id,
        sprintId: activeSprint.id,
      }, { userId: manager.id });

      for (const emp of employees) {
        // Pre-seed overdue tasks that rolled over from Q3 Completed Sprint for visual verification
        const isOverdueDemo = emp.perfType === 'RISK' && (emp.name.includes('Careless') || emp.name.includes('Lax'));
        const taskActive = await Task.create({
          title: `Implement active feature deliverables for ${emp.name}`,
          type: 'Story',
          status: emp.perfType === 'ELITE' ? 'DONE' : 'IN_PROGRESS',
          parentId: activeEpic.id,
          creatorId: scrumMaster.id,
          assigneeId: emp.id,
          sprintId: activeSprint.id,
          originalSprintId: isOverdueDemo ? q3CompletedSprint.id : null,
          rolloverCount: isOverdueDemo ? 1 : 0,
        }, { userId: scrumMaster.id });

        // Add telemetry for active tasks
        if (emp.perfType === 'RISK') {
          await Comment.create({
            taskId: taskActive.id,
            authorId: scrumMaster.id,
            content: `Feedback on active story: Logic looks cluttered. Needs modularization.`,
            evaluationTier: 'Negative (Simple)',
          });

          await AuditLog.create({
            taskId: taskActive.id,
            sprintId: activeSprint.id,
            userId: emp.id,
            action: 'UPDATE',
            changes: {
              title: { old: `Draft specifications for ${emp.name}`, new: taskActive.title }
            },
          });
        }
      }

      // 5. PENDING SPRINT 1
      const pendingEpic1 = await Task.create({
        title: `Feature Roadmap Planning Q4 (Team ${teamId})`,
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

      // 6. PENDING SPRINT 2
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

    await seedTeamTasks(
      1,
      manager1,
      scrumMaster1,
      team1Employees,
      t1Q1Comp,
      t1Q2Comp,
      t1Q3Comp,
      t1Active,
      t1Pending1,
      t1Pending2
    );

    await seedTeamTasks(
      2,
      manager2,
      scrumMaster2,
      team2Employees,
      t2Q1Comp,
      t2Q2Comp,
      t2Q3Comp,
      t2Active,
      t2Pending1,
      t2Pending2
    );

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
