/**
 * Integration Test Suite — Module 3: Temporal Leadership & Adjudication
 * Run from the backend directory:
 *   node test/temporalScrum.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, AttendanceRecord } = require('../models');
const checkTemporalScrumMaster = require('../middlewares/scrum.middleware');
const {
  getPendingWFH,
  adjudicateWFH,
  getTeamMatrix,
} = require('../controllers/scrum.controller');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const PASS = [];
const FAIL = [];

const assert = (label, condition, detail = '') => {
  if (condition) {
    PASS.push(label);
    console.log(`  ✓ ${label}`);
  } else {
    FAIL.push({ label, detail });
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
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

const cleanupTestData = async (ids) => {
  if (ids.wfhRecordId) {
    await AttendanceRecord.destroy({ where: { id: ids.wfhRecordId }, force: true });
  }
  if (ids.otherTeamRecordId) {
    await AttendanceRecord.destroy({
      where: { id: ids.otherTeamRecordId },
      force: true,
    });
  }
  if (ids.activeSprintId) {
    await Sprint.destroy({ where: { id: ids.activeSprintId }, force: true });
  }
  if (ids.inactiveSprintId) {
    await Sprint.destroy({ where: { id: ids.inactiveSprintId }, force: true });
  }
  if (ids.teamMemberId) {
    await AttendanceRecord.destroy({ where: { userId: ids.teamMemberId }, force: true });
    await User.destroy({ where: { id: ids.teamMemberId }, force: true });
  }
  if (ids.scrumMasterId) {
    await AttendanceRecord.destroy({ where: { userId: ids.scrumMasterId }, force: true });
    await User.destroy({ where: { id: ids.scrumMasterId }, force: true });
  }
};

const runTests = async () => {
  console.log('\n========================================');
  console.log(' Module 3 — Temporal Scrum Test Suite');
  console.log('========================================\n');

  const ids = {};
  const todayIST = getTodayIST();
  const teamId = 901;

  try {
    await sequelize.authenticate();
    assert('Database connection established', true);
    await sequelize.sync({ alter: true });
    assert('Schema synchronized for WFH_APPROVED enum', true);

    console.log('\n[1/5] Sprint initialization with dynamic date windows');
    const scrumMaster = await User.create({
      employeeId: `YT-SCRUM-SM-${Date.now()}`,
      name: 'Temporal Scrum Master',
      email: `scrum.master.${Date.now()}@yakkaytech.test`,
      passwordHash: 'test-hash',
      systemRole: 'Employee',
      teamId,
    });
    ids.scrumMasterId = scrumMaster.id;

    const teamMember = await User.create({
      employeeId: `YT-SCRUM-TM-${Date.now()}`,
      name: 'Temporal Team Member',
      email: `scrum.member.${Date.now()}@yakkaytech.test`,
      passwordHash: 'test-hash',
      systemRole: 'Employee',
      teamId,
    });
    ids.teamMemberId = teamMember.id;

    const activeSprint = await Sprint.create({
      name: `Verify Sprint ${Date.now()}`,
      startDate: addDays(todayIST, -7),
      endDate: addDays(todayIST, 7),
      scrumMasterId: scrumMaster.id,
    });
    ids.activeSprintId = activeSprint.id;

    const inactiveSprint = await Sprint.create({
      name: `Expired Sprint ${Date.now()}`,
      startDate: addDays(todayIST, -30),
      endDate: addDays(todayIST, -15),
      scrumMasterId: scrumMaster.id,
    });
    ids.inactiveSprintId = inactiveSprint.id;

    assert('Active sprint created with inclusive date window', !!activeSprint.id);
    assert('Inactive sprint created outside current window', !!inactiveSprint.id);

    console.log('\n[2/5] Temporal Scrum Master middleware checks');
    const activeReq = { user: scrumMaster };
    const activeResult = await runMiddleware(checkTemporalScrumMaster, activeReq);
    assert(
      'Middleware allows active sprint Scrum Master',
      activeResult.res.statusCode === 200 || activeResult.req.isTemporalScrumMaster === true,
      `status=${activeResult.res.statusCode}`
    );
    assert(
      'Middleware attaches activeSprintId',
      activeResult.req.activeSprintId === activeSprint.id
    );

    const outsider = await User.create({
      employeeId: `YT-SCRUM-OUT-${Date.now()}`,
      name: 'Non Scrum Master',
      email: `scrum.outsider.${Date.now()}@yakkaytech.test`,
      passwordHash: 'test-hash',
      systemRole: 'Employee',
      teamId,
    });

    const outsiderReq = { user: outsider };
    const outsiderResult = await runMiddleware(checkTemporalScrumMaster, outsiderReq);
    assert(
      'Middleware rejects user without active sprint assignment',
      outsiderResult.res.statusCode === 403
    );

    await User.destroy({ where: { id: outsider.id }, force: true });

    console.log('\n[3/5] WFH queue retrieval with team boundaries');
    const wfhRecord = await AttendanceRecord.create({
      userId: teamMember.id,
      date: todayIST,
      checkInTime: new Date(),
      checkInLat: 12.921,
      checkInLng: 80.121,
      status: 'WFH_PENDING',
      workHours: 0,
      isActiveSession: true,
      lastResumeTime: new Date(),
    });
    ids.wfhRecordId = wfhRecord.id;

    const otherTeamUser = await User.create({
      employeeId: `YT-SCRUM-OTHER-${Date.now()}`,
      name: 'Other Team Member',
      email: `scrum.other.${Date.now()}@yakkaytech.test`,
      passwordHash: 'test-hash',
      systemRole: 'Employee',
      teamId: 902,
    });

    const otherTeamRecord = await AttendanceRecord.create({
      userId: otherTeamUser.id,
      date: todayIST,
      checkInTime: new Date(),
      checkInLat: 12.921,
      checkInLng: 80.121,
      status: 'WFH_PENDING',
      workHours: 0,
      isActiveSession: true,
      lastResumeTime: new Date(),
    });
    ids.otherTeamRecordId = otherTeamRecord.id;

    const queueReq = {
      user: scrumMaster,
      activeSprintId: activeSprint.id,
    };
    const queueResult = await runController(getPendingWFH, queueReq);
    assert('WFH queue endpoint succeeds', queueResult.res.body.success === true);
    assert(
      'WFH queue includes same-team pending record',
      queueResult.res.body.queue.some((row) => row.recordId === wfhRecord.id)
    );
    assert(
      'WFH queue excludes other-team pending record',
      !queueResult.res.body.queue.some((row) => row.recordId === otherTeamRecord.id)
    );

    await User.destroy({ where: { id: otherTeamUser.id }, force: true });

    console.log('\n[4/5] WFH adjudication updates');
    const adjudicateReq = {
      user: scrumMaster,
      params: { recordId: String(wfhRecord.id) },
      body: { newStatus: 'WFH_APPROVED' },
      activeSprintId: activeSprint.id,
    };
    const adjudicateResult = await runController(adjudicateWFH, adjudicateReq);
    assert(
      'Adjudication endpoint succeeds',
      adjudicateResult.res.body.success === true
    );
    assert(
      'Adjudication maps approval input to WFH_APPROVED',
      adjudicateResult.res.body.record.newStatus === 'WFH_APPROVED'
    );

    const reloadedRecord = await AttendanceRecord.findByPk(wfhRecord.id);
    assert(
      'Database reflects adjudicated WFH_APPROVED status',
      reloadedRecord.status === 'WFH_APPROVED'
    );

    const legacyApprovalReq = {
      user: scrumMaster,
      params: { recordId: String(wfhRecord.id) },
      body: { newStatus: 'PRESENT_OFFICE' },
      activeSprintId: activeSprint.id,
    };
    await AttendanceRecord.update(
      { status: 'WFH_PENDING' },
      { where: { id: wfhRecord.id } }
    );
    const legacyResult = await runController(adjudicateWFH, legacyApprovalReq);
    const legacyReloaded = await AttendanceRecord.findByPk(wfhRecord.id);
    assert(
      'Legacy PRESENT_OFFICE approval input maps to WFH_APPROVED',
      legacyResult.res.body.record.newStatus === 'WFH_APPROVED' &&
        legacyReloaded.status === 'WFH_APPROVED'
    );

    console.log('\n[5/5] Team matrix summaries');
    const matrixReq = {
      user: scrumMaster,
      activeSprintId: activeSprint.id,
      activeSprint,
    };
    const matrixResult = await runController(getTeamMatrix, matrixReq);
    assert('Team matrix endpoint succeeds', matrixResult.res.body.success === true);
    assert(
      'Team matrix includes scrum master team member',
      matrixResult.res.body.matrix.some((row) => row.userId === teamMember.id)
    );
    assert(
      'Team matrix summary totals are present',
      matrixResult.res.body.summary.totalMembers >= 2
    );
    assert(
      'Team matrix reflects adjudicated member status',
      matrixResult.res.body.matrix.find((row) => row.userId === teamMember.id)
        ?.todayStatus === 'WFH_APPROVED'
    );
  } catch (error) {
    FAIL.push({ label: 'Unhandled test error', detail: error.message });
    console.error('\n  ✗ Unhandled error:', error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
  } finally {
    console.log('\n[cleanup] Removing temporal scrum test data...');
    await cleanupTestData(ids);
    await sequelize.close();
  }

  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    FAIL.forEach(({ label, detail }) => {
      console.error(`  • ${label}${detail ? `: ${detail}` : ''}`);
    });
    process.exit(1);
  }

  console.log('All temporal scrum tests passed.\n');
  process.exit(0);
};

runTests();
