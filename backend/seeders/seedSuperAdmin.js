/**
 * Standalone seeder for IT Administrator (SuperAdmin).
 * Run: node seeders/seedSuperAdmin.js
 */
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const { sequelize, User } = require('../models');

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    // 1. Ensure system_role ENUM supports SuperAdmin
    await sequelize.query(`
      ALTER TABLE users MODIFY COLUMN system_role ENUM('Employee', 'Admin/Manager', 'SuperAdmin') NOT NULL DEFAULT 'Employee'
    `);
    console.log('🔧 Ensured system_role ENUM supports SuperAdmin.');

    // 2. Ensure job_title column exists in users
    const [cols] = await sequelize.query(
      "SHOW COLUMNS FROM users LIKE 'job_title'"
    );
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE users ADD COLUMN job_title VARCHAR(255) NULL');
      console.log('🔧 Added job_title column to users.');
    }

    const passwordHash = await bcrypt.hash('Y@kk@Y@123$', 10);
    const email = 'Yakkay_Admin@yakkaytech.com';

    let user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({
        passwordHash,
        systemRole: 'SuperAdmin',
        teamId: null,
      });
      console.log(`✅ Updated SuperAdmin: ${email}`);
    } else {
      user = await User.create({
        employeeId: 'YT-ADMIN-001',
        name: 'IT Administrator',
        email,
        passwordHash,
        systemRole: 'SuperAdmin',
        teamId: null,
        jobTitle: 'IT System Architect',
      });
      console.log(`✅ Created SuperAdmin: ${email}`);
    }
  } catch (error) {
    console.error('❌ Seeding SuperAdmin failed:', error.message);
  } finally {
    await sequelize.close();
  }
};

seed();
