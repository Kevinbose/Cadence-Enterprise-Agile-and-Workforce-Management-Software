/**
 * Integration Test for Module 2: Nightly Sweep & Hostage Protocol
 * Run this from the backend directory:
 *   node test/attendanceRecord.test.js
 */

module.paths.push('c:/Users/Kevin Bose/Desktop/Projects/JIRA/yakkay-tech-platform/backend/node_modules');

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const backendDir = 'c:/Users/Kevin Bose/Desktop/Projects/JIRA/yakkay-tech-platform/backend';
dotenv.config({ path: path.resolve(backendDir, '.env.local') });

const { sequelize, User, AttendanceRecord } = require('../models');
const { runSweep } = require('../utils/nightlySweep');
const { calculateHaversineDistance } = require('../utils/haversine');

// Define helper to get current IST date (YYYY-MM-DD)
const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

async function runTests() {
  console.log('🧪 Starting Nightly Sweep & Hostage Protocol Test Suite...\n');
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    // 1. Get or create a test employee
    let user = await User.findOne({ where: { email: 'employee@yakkaytech.com' } });
    if (!user) {
      console.log('Creating test user employee@yakkaytech.com...');
      user = await User.create({
        employeeId: 'YT-TEST-999',
        name: 'Test Employee',
        email: 'employee@yakkaytech.com',
        passwordHash: 'dummyhash',
        systemRole: 'Employee',
      });
    }
    console.log(`👤 Using Employee: ${user.name} (${user.employeeId})`);

    // Clean up any existing records for this user to ensure clean test state
    await AttendanceRecord.destroy({ where: { userId: user.id } });
    console.log('🧹 Cleaned up existing attendance records for test user.');

    // 2. Test Geofence Math (Haversine Check)
    const officeLat = parseFloat(process.env.OFFICE_LATITUDE) || 12.9249;
    const officeLng = parseFloat(process.env.OFFICE_LONGITUDE) || 80.1243;
    
    // Test point 1: 30m away (Within Geofence)
    const distNear = calculateHaversineDistance(12.9247, 80.1241, officeLat, officeLng);
    console.log(`📍 Geofence test (Near): ${distNear.toFixed(1)}m away (Expected <= 100m)`);
    
    // Test point 2: 500m away (Outside Geofence)
    const distFar = calculateHaversineDistance(12.9210, 80.1210, officeLat, officeLng);
    console.log(`📍 Geofence test (Far): ${distFar.toFixed(1)}m away (Expected > 100m)`);

    // 3. Simulate "Forgotten Shift" from Yesterday
    // Check-in was at 9:00 AM yesterday. Active session, 0 hours logged initially.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateString = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Checked in yesterday at 9:00 AM
    const checkInTimeYesterday = new Date(`${yesterdayDateString}T09:00:00+05:30`);
    
    // Resumed working at 10:00 AM (so lastResumeTime is 10:00 AM)
    const resumeTimeYesterday = new Date(`${yesterdayDateString}T10:00:00+05:30`);

    console.log(`\n🕒 Creating a forgotten active shift for date: ${yesterdayDateString}`);
    const forgottenRecord = await AttendanceRecord.create({
      userId: user.id,
      date: yesterdayDateString,
      checkInTime: checkInTimeYesterday,
      lastResumeTime: resumeTimeYesterday,
      isActiveSession: true,
      workHours: 1.0, // 1 hr already logged from a previous chunk
      status: 'PRESENT_OFFICE',
      isStandupLocked: false,
      systemAutoClosed: false,
    });

    console.log(`✅ Forgotten record created with ID: ${forgottenRecord.id}`);
    console.log(`   - work_hours stored: ${forgottenRecord.workHours}`);
    console.log(`   - is_active_session: ${forgottenRecord.isActiveSession}`);

    // 4. Trigger Nightly Sweep Daemon (Manual invocation for yesterday's date boundary)
    console.log('\n🧹 Triggering Nightly Sweep...');
    // We pass yesterdayDateString to run the sweep up to yesterday.
    await runSweep(yesterdayDateString);

    // Reload record and verify
    await forgottenRecord.reload();
    console.log('\n🔍 Verifying auto-closed record:');
    console.log(`   - is_standup_locked: ${forgottenRecord.isStandupLocked} (Expected: true)`);
    console.log(`   - system_auto_closed: ${forgottenRecord.systemAutoClosed} (Expected: true)`);
    console.log(`   - is_active_session: ${forgottenRecord.isActiveSession} (Expected: false)`);
    console.log(`   - work_hours: ${forgottenRecord.workHours} hrs (Expected: 8.00 - capped since 10am to 11:55pm = ~14hrs + 1hr = 15hrs > 8hrs)`);

    if (
      forgottenRecord.isStandupLocked === true &&
      forgottenRecord.systemAutoClosed === true &&
      forgottenRecord.isActiveSession === false &&
      parseFloat(forgottenRecord.workHours) === 8.00
    ) {
      console.log('🎉 Sweep auto-close & hour-capping logic PASSED.');
    } else {
      throw new Error('❌ Sweep logic FAILED.');
    }

    // 5. Test Hostage Protocol status check
    // When getTodayStatus is called, it should scan and find that there is an unregularized auto-closed record.
    console.log('\n🚨 Running Hostage Rehydration Check...');
    const hostageRecord = await AttendanceRecord.findOne({
      where: {
        userId: user.id,
        systemAutoClosed: true,
        regularizationReason: null,
      },
    });

    if (hostageRecord && hostageRecord.id === forgottenRecord.id) {
      console.log(`✅ Hostage check caught unregularized shift ID ${hostageRecord.id}! Dashboard will lock.`);
    } else {
      throw new Error('❌ Hostage check FAILED to catch outstanding shift.');
    }

    // 6. Test Regularization Submission (Dashboard Unlock)
    console.log('\n🔓 Submitting regularization justification...');
    const reasonText = 'Commuted home late and forgot to punch out due to internet outage.';
    
    await forgottenRecord.update({
      regularizationReason: reasonText,
    });
    console.log(`✅ Submitted reason: "${reasonText}"`);

    // Re-run Hostage status check
    const postRegularizeHostage = await AttendanceRecord.findOne({
      where: {
        userId: user.id,
        systemAutoClosed: true,
        regularizationReason: null,
      },
    });

    if (!postRegularizeHostage) {
      console.log('🎉 No hostage records found. Account is UNLOCKED.');
    } else {
      throw new Error('❌ Account remains locked after regularization.');
    }

    console.log('\n🏆 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runTests();
