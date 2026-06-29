/**
 * Seeds demo auth users and an active sprint for Module 3 Scrum Master testing.
 * Usage: npm run seed:auth
 */

const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';

dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const { sequelize, User, Sprint } = require('../models');

const DEMO_USERS = [
  {
    employeeId: 'YT-2026-001',
    name: 'Kevin Employee',
    email: 'employee@yakkaytech.com',
    password: 'Employee@123',
    systemRole: 'Employee',
    teamId: 1,
  },
  {
    employeeId: 'YT-2026-002',
    name: 'Kevin Manager',
    email: 'manager@yakkaytech.com',
    password: 'Manager@123',
    systemRole: 'Admin/Manager',
    teamId: 1,
  },
  {
    employeeId: 'YT-2026-003',
    name: 'Kevin ScrumMaster',
    email: 'scrum@yakkaytech.com',
    password: 'Scrum@123',
    systemRole: 'Employee',
    teamId: 1,
  },
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // ── Create or Update Users ──────────────────────────────────────────────
    const dbUsers = {};

    for (const demoUser of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(demoUser.password, 10);

      let user = await User.findOne({ where: { email: demoUser.email } });

      if (user) {
        await user.update({
          passwordHash,
          systemRole: demoUser.systemRole,
          teamId: demoUser.teamId,
          name: demoUser.name,
        });
        console.log(`Updated: ${demoUser.email} (${demoUser.systemRole})`);
      } else {
        user = await User.findOne({ where: { employeeId: demoUser.employeeId } });

        if (user) {
          await user.update({
            email: demoUser.email,
            passwordHash,
            systemRole: demoUser.systemRole,
            teamId: demoUser.teamId,
            name: demoUser.name,
          });
          console.log(`Updated by employeeId: ${demoUser.email} (${demoUser.systemRole})`);
        } else {
          user = await User.create({
            employeeId: demoUser.employeeId,
            name: demoUser.name,
            email: demoUser.email,
            passwordHash,
            systemRole: demoUser.systemRole,
            teamId: demoUser.teamId,
          });
          console.log(`Created: ${demoUser.email} (${demoUser.systemRole})`);
        }
      }
      dbUsers[demoUser.email] = user;
    }

    // ── Link employee & SM to manager ───────────────────────────────────────
    const manager = dbUsers['manager@yakkaytech.com'];
    const employee = dbUsers['employee@yakkaytech.com'];
    const scrumMaster = dbUsers['scrum@yakkaytech.com'];

    if (manager) {
      if (employee) {
        await employee.update({ managerId: manager.id });
        console.log(`Linked employee → manager (${manager.name})`);
      }
      if (scrumMaster) {
        await scrumMaster.update({ managerId: manager.id });
        console.log(`Linked Scrum Master → manager (${manager.name})`);
      }
    }

    // ── Create Active Sprint with Temporal SM Assignment ────────────────────
    if (scrumMaster) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const nextWeekStr = nextWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      // Clean up previous demo sprints
      await Sprint.destroy({ where: { name: 'Demo Active Sprint' } });

      const activeSprint = await Sprint.create({
        name: 'Demo Active Sprint',
        startDate: yesterdayStr,
        endDate: nextWeekStr,
        scrumMasterId: scrumMaster.id,
      });

      console.log(
        `Created Sprint: "${activeSprint.name}" (${yesterdayStr} to ${nextWeekStr}) assigned to Scrum Master: ${scrumMaster.name}`
      );
    }

    console.log('\nDemo credentials:');
    console.log('  employee@yakkaytech.com / Employee@123  (Normal Employee)');
    console.log('  scrum@yakkaytech.com    / Scrum@123     (Temporal Scrum Master)');
    console.log('  manager@yakkaytech.com  / Manager@123    (Manager)\n');
  } catch (error) {
    console.error('Seed failed:', error.message);
    if (error.errors) {
      error.errors.forEach((entry) => console.error(`  • ${entry.path}: ${entry.message}`));
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

seed();
