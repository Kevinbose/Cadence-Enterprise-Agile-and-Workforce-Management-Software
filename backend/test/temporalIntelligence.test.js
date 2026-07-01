/**
 * Integration Test Suite — Two-Tiered Performance Analytics (Temporal Intelligence)
 * Run from the backend directory:
 *   node test/temporalIntelligence.test.js
 *
 * Coverage map:
 *   1. resolveTemporalBounds — Q1–Q4 + full-year boundary math
 *   2. isFutureQuarter — EC-8 future-quarter null guard
 *   3. deriveKPIs — divide-by-zero guards + all 6 metrics
 *   4. getWorkforceSummary — backward compat (no temporal params)
 *   5. getWorkforceSummary — quarterly filter scopes velocity + meta
 *   6. getWorkforceSummary — new metric fields on every employee row
 *   7. getEmployeeDossier — quarterly filter + KPI fields
 *   8. getYearlyAppraisal — requires year param (400 without)
 *   9. getYearlyAppraisal — per-employee quarters + yearlyTotals shape
 *  10. getYearlyAppraisal — future quarters return null (not zeros)
 *  11. Team isolation — Team 2 employee absent from Team 1 appraisal
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User, Sprint, Task, Comment, AuditLog, AttendanceRecord } = require('../models');
const {
  getWorkforceSummary,
  getEmployeeDossier,
  getYearlyAppraisal,
  resolveTemporalBounds,
  isFutureQuarter,
  deriveKPIs,
} = require('../controllers/intelligence.controller');

const PASS = [];
const FAIL = [];

const assert = (label, condition, detail = '') => {
  if (condition) {
    PASS.push(label);
    console.log(`  ✅ ${label}`);
  } else {
    FAIL.push({ label, detail });
    console.error(`  🚨 ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const mockResponse = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const runController = async (handler, req) => {
  const res = mockResponse();
  let forwardedError = null;
  await handler(req, res, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return { res, req };
};

const TEST_YEAR = 2026;

const runTests = async () => {
  console.log('🧪 Starting Two-Tiered Performance Analytics Test Suite...\n');

  try {
    await sequelize.authenticate();
    sequelize.options.logging = false; // keep test output readable
    console.log('🔗 Connected to MySQL database.');

    await sequelize.sync({ force: true });
    console.log('🔄 Database synced (force: true).\n');

    // ── Seed users ─────────────────────────────────────────────────────────
    const managerT1 = await User.create({
      employeeId: 'YT-MGR-T1',
      name: 'Manager Team 1',
      email: 'mgr-t1@yakkaytech.com',
      passwordHash: 'hash',
      systemRole: 'Admin/Manager',
      teamId: 1,
    });

    const empT1 = await User.create({
      employeeId: 'YT-EMP-T1',
      name: 'Analyst Alpha',
      email: 'alpha@yakkaytech.com',
      passwordHash: 'hash',
      systemRole: 'Employee',
      teamId: 1,
    });

    const empT2 = await User.create({
      employeeId: 'YT-EMP-T2',
      name: 'Analyst Beta (Team 2)',
      email: 'beta@yakkaytech.com',
      passwordHash: 'hash',
      systemRole: 'Employee',
      teamId: 2,
    });

    const sprint = await Sprint.create({
      name: 'Analytics Sprint',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      teamId: 1,
    });

    const setTaskDates = async (taskId, createdAt, updatedAt) => {
      await sequelize.query(
        'UPDATE tasks SET created_at = ?, updated_at = ? WHERE id = ?',
        { replacements: [createdAt, updatedAt, taskId] }
      );
    };

    // Q1 DONE task (velocity in Q1 only)
    const q1Done = await Task.create(
      {
        title: 'Q1 Deliverable',
        type: 'Task',
        status: 'DONE',
        creatorId: managerT1.id,
        assigneeId: empT1.id,
        sprintId: sprint.id,
        rolloverCount: 0,
      },
      { userId: managerT1.id }
    );
    await setTaskDates(q1Done.id, '2026-01-15 10:00:00', '2026-02-10 10:00:00');

    // Q2 DONE task
    const q2Done = await Task.create(
      {
        title: 'Q2 Deliverable',
        type: 'Task',
        status: 'DONE',
        creatorId: managerT1.id,
        assigneeId: empT1.id,
        sprintId: sprint.id,
        rolloverCount: 0,
      },
      { userId: managerT1.id }
    );
    await setTaskDates(q2Done.id, '2026-04-05 10:00:00', '2026-05-20 10:00:00');

    // Overdue / rollover task (updated in Q2)
    const overdueTask = await Task.create(
      {
        title: 'Rolled Straggler',
        type: 'Task',
        status: 'IN_PROGRESS',
        creatorId: managerT1.id,
        assigneeId: empT1.id,
        sprintId: sprint.id,
        rolloverCount: 2,
        originalSprintId: sprint.id,
      },
      { userId: managerT1.id }
    );
    await setTaskDates(overdueTask.id, '2026-01-01 10:00:00', '2026-05-01 10:00:00');

    // Team 2 task — must never appear in Team 1 analytics
    const team2Task = await Task.create(
      {
        title: 'Team 2 Secret Task',
        type: 'Task',
        status: 'DONE',
        creatorId: empT2.id,
        assigneeId: empT2.id,
        sprintId: sprint.id,
      },
      { userId: empT2.id }
    );
    await setTaskDates(team2Task.id, '2026-02-01 10:00:00', '2026-02-15 10:00:00');

    // Attendance — 2 present days in Q1, 1 in Q2
    await AttendanceRecord.bulkCreate([
      { userId: empT1.id, date: '2026-01-10', status: 'PRESENT_OFFICE', workHours: 8 },
      { userId: empT1.id, date: '2026-01-11', status: 'WFH_APPROVED', workHours: 7.5 },
      { userId: empT1.id, date: '2026-05-05', status: 'PRESENT_OFFICE', workHours: 8 },
    ]);

    const posComment = await Comment.create({
      taskId: q1Done.id,
      authorId: managerT1.id,
      content: 'Great work',
      evaluationTier: 'Positive',
    });
    await sequelize.query(
      'UPDATE comments SET created_at = ?, updated_at = ? WHERE id = ?',
      { replacements: ['2026-02-12 10:00:00', '2026-02-12 10:00:00', posComment.id] }
    );
    const negComment = await Comment.create({
      taskId: q1Done.id,
      authorId: managerT1.id,
      content: 'Needs polish',
      evaluationTier: 'Negative (Simple)',
    });
    await sequelize.query(
      'UPDATE comments SET created_at = ?, updated_at = ? WHERE id = ?',
      { replacements: ['2026-02-13 10:00:00', '2026-02-13 10:00:00', negComment.id] }
    );

    // Tamper strike — title mutation audit in Q1
    const audit = await AuditLog.create({
      taskId: q1Done.id,
      sprintId: sprint.id,
      userId: empT1.id,
      action: 'UPDATE',
      changes: { title: { old: 'Old Title', new: 'Q1 Deliverable' } },
    });
    await sequelize.query(
      'UPDATE audit_logs SET created_at = ? WHERE id = ?',
      { replacements: ['2026-02-01 10:00:00', audit.id] }
    );

  console.log('👥 Seeded users, tasks, attendance, comments, audit logs.\n');

    // ══════════════════════════════════════════════════════════════════════
    // [1/11] resolveTemporalBounds unit checks
    // ══════════════════════════════════════════════════════════════════════
    console.log('[1/11] resolveTemporalBounds boundary math...');

    const q1 = resolveTemporalBounds(2026, 'Q1');
    assert('Q1 startDate is Jan 1', q1.startDate === '2026-01-01');
    assert('Q1 endDate is Mar 31', q1.endDate === '2026-03-31');
    assert('Q2 startDate is Apr 1', resolveTemporalBounds(2026, 'Q2').startDate === '2026-04-01');
    assert('Q3 endDate is Sep 30', resolveTemporalBounds(2026, 'Q3').endDate === '2026-09-30');
    assert('Q4 endDate is Dec 31', resolveTemporalBounds(2026, 'Q4').endDate === '2026-12-31');
    assert('Full year without quarter spans Jan–Dec', resolveTemporalBounds(2026, null).endDate === '2026-12-31');
    assert('Missing year returns null (full-history mode)', resolveTemporalBounds(null, 'Q1') === null);

    // ══════════════════════════════════════════════════════════════════════
    // [2/11] isFutureQuarter (EC-8)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[2/11] isFutureQuarter guard (EC-8)...');

    assert('Q1 2020 is never future', isFutureQuarter(2020, 'Q1') === false);
    assert('Q4 2099 is future', isFutureQuarter(2099, 'Q4') === true);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentQ = `Q${Math.ceil(currentMonth / 3)}`;

    // Quarters strictly after the current calendar quarter should be future
    const futureQNum = Math.min(4, Math.ceil(currentMonth / 3) + 1);
    if (futureQNum <= 4) {
      const futureQ = `Q${futureQNum}`;
      if (futureQ !== currentQ) {
        assert(`Upcoming quarter ${futureQ} ${currentYear} is flagged future`, isFutureQuarter(currentYear, futureQ) === true);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // [3/11] deriveKPIs divide-by-zero + 6 metrics
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[3/11] deriveKPIs metric derivation...');

    const emptyKpis = deriveKPIs({});
    assert('Zero shift days → ari null (not 0)', emptyKpis.ari === null);
    assert('Zero totalDone → ftpr null', emptyKpis.ftpr === null);
    assert('Zero feedback → feedbackRatio null', emptyKpis.feedbackRatio === null);

    const richKpis = deriveKPIs({
      shiftDays: 10,
      presentDays: 8,
      totalAssigned: 5,
      totalDone: 4,
      rejections: 1,
      gtp: 2,
      overdueCount: 3,
      positiveComments: 3,
      negativeComments: 1,
      velocity: 4,
    });
    assert('ARI computed as 80%', richKpis.ari === 80);
    assert('FTPR computed as 75%', richKpis.ftpr === 75);
    assert('feedbackRatio computed as 75%', richKpis.feedbackRatio === 75);
    assert('velocity surfaced', richKpis.velocity === 4);
    assert('overdueCount surfaced', richKpis.overdueCount === 3);
    assert('gtp (tamper strikes) surfaced', richKpis.gtp === 2);
    assert('trustScore is 0–100', richKpis.trustScore >= 0 && richKpis.trustScore <= 100);

    const managerReq = { user: { id: managerT1.id, systemRole: 'Admin/Manager', teamId: 1 }, query: {} };

    // ══════════════════════════════════════════════════════════════════════
    // [4/11] Backward compatibility — no temporal params
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[4/11] getWorkforceSummary backward compatibility...');

    const resFull = await runController(getWorkforceSummary, { ...managerReq, query: {} });
    assert('Full-history workforce returns 200', resFull.res.statusCode === 200);
    assert('meta.year is null without params', resFull.res.body.meta?.year === null);
    assert('meta.quarter is null without params', resFull.res.body.meta?.quarter === null);
    assert('workforce array present', Array.isArray(resFull.res.body.workforce));

    // ══════════════════════════════════════════════════════════════════════
    // [5/11] Quarterly velocity scoping
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[5/11] Quarterly velocity scoping...');

    const resQ1 = await runController(getWorkforceSummary, {
      user: managerReq.user,
      query: { year: String(TEST_YEAR), quarter: 'Q1' },
    });
    const resQ2 = await runController(getWorkforceSummary, {
      user: managerReq.user,
      query: { year: String(TEST_YEAR), quarter: 'Q2' },
    });

    const alphaQ1 = resQ1.res.body.workforce.find((e) => e.email === 'alpha@yakkaytech.com');
    const alphaQ2 = resQ2.res.body.workforce.find((e) => e.email === 'alpha@yakkaytech.com');

    assert('Q1 filter returns meta Q1', resQ1.res.body.meta?.quarter === 'Q1');
    assert('Q1 velocity counts only Q1 DONE task', alphaQ1 && alphaQ1.velocity === 1, `got ${alphaQ1?.velocity}`);
    assert('Q2 velocity counts only Q2 DONE task', alphaQ2 && alphaQ2.velocity === 1, `got ${alphaQ2?.velocity}`);

    // ══════════════════════════════════════════════════════════════════════
    // [6/11] New metric fields on workforce rows
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[6/11] Six-metric fields on workforce rows...');

    const resQ2Metrics = resQ2.res.body;
    const alpha = resQ2Metrics.workforce.find((e) => e.email === 'alpha@yakkaytech.com');
    assert('overdueCount present on row', alpha && typeof alpha.overdueCount === 'number');
    assert('Q2 overdueCount includes rolled task', alpha && alpha.overdueCount >= 1, `got ${alpha?.overdueCount}`);
    assert('feedbackRatio present', alpha && (alpha.feedbackRatio === null || typeof alpha.feedbackRatio === 'number'));
    assert('positiveComments present', alpha && typeof alpha.positiveComments === 'number');
    assert('gtp (tamper) present', alpha && typeof alpha.gtp === 'number');
    assert('Team 2 employee NOT in Team 1 workforce', !resQ2Metrics.workforce.some((e) => e.email === 'beta@yakkaytech.com'));

    // ══════════════════════════════════════════════════════════════════════
    // [7/11] getEmployeeDossier quarterly scope
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[7/11] getEmployeeDossier quarterly scope...');

    const resDossierQ1 = await runController(getEmployeeDossier, {
      user: managerReq.user,
      params: { userId: String(empT1.id) },
      query: { year: String(TEST_YEAR), quarter: 'Q1' },
    });
    assert('Dossier Q1 returns 200', resDossierQ1.res.statusCode === 200);
    assert('Dossier meta scoped to Q1', resDossierQ1.res.body.meta?.quarter === 'Q1');
    assert('Dossier KPIs include velocity', typeof resDossierQ1.res.body.kpis?.velocity === 'number');
    assert('Dossier KPIs include overdueCount', typeof resDossierQ1.res.body.kpis?.overdueCount === 'number');
    assert('Dossier KPIs include feedbackRatio', resDossierQ1.res.body.kpis?.feedbackRatio === null || typeof resDossierQ1.res.body.kpis?.feedbackRatio === 'number');
    assert('auditDiffs is array', Array.isArray(resDossierQ1.res.body.auditDiffs));
    assert('attendanceHistory is array', Array.isArray(resDossierQ1.res.body.attendanceHistory));
    assert('previousComments is array', Array.isArray(resDossierQ1.res.body.previousComments));

    // Q1 attendance should include Jan records only (2 days)
  const q1Attendance = resDossierQ1.res.body.attendanceHistory || [];
    assert('Q1 attendanceHistory scoped (≤2 seeded days)', q1Attendance.length <= 2, `got ${q1Attendance.length}`);

    // ══════════════════════════════════════════════════════════════════════
    // [8/11] getYearlyAppraisal validation
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[8/11] getYearlyAppraisal validation...');

    const resNoYear = await runController(getYearlyAppraisal, {
      user: managerReq.user,
      query: {},
    });
    assert('Missing year returns 400', resNoYear.res.statusCode === 400);

    // ══════════════════════════════════════════════════════════════════════
    // [9/11] getYearlyAppraisal response shape
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[9/11] getYearlyAppraisal response shape...');

    const resAppraisal = await runController(getYearlyAppraisal, {
      user: managerReq.user,
      query: { year: String(TEST_YEAR) },
    });
    assert('Appraisal returns 200', resAppraisal.res.statusCode === 200);
    assert('Appraisal year echoed', resAppraisal.res.body.year === TEST_YEAR);
    assert('appraisals array present', Array.isArray(resAppraisal.res.body.appraisals));
    assert('teamAverages object present', resAppraisal.res.body.teamAverages !== undefined);

    const alphaAppraisal = resAppraisal.res.body.appraisals.find((a) => a.email === 'alpha@yakkaytech.com');
    assert('Alpha employee in appraisal list', !!alphaAppraisal);
    assert('quarters object on employee', alphaAppraisal && alphaAppraisal.quarters !== undefined);
    assert('yearlyTotals object on employee', alphaAppraisal && alphaAppraisal.yearlyTotals !== undefined);
    assert('yearlyTotals.velocity is number', typeof alphaAppraisal?.yearlyTotals?.velocity === 'number');
    assert('Q1 quarter data is object (not null)', alphaAppraisal?.quarters?.Q1 !== null && typeof alphaAppraisal?.quarters?.Q1 === 'object');
    assert('Q2 quarter data is object', alphaAppraisal?.quarters?.Q2 !== null && typeof alphaAppraisal?.quarters?.Q2 === 'object');

    // ══════════════════════════════════════════════════════════════════════
    // [10/11] Future quarters return null (EC-8)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[10/11] Future quarters return null (EC-8)...');

    const futureYear = currentYear + 5;
    const resFuture = await runController(getYearlyAppraisal, {
      user: managerReq.user,
      query: { year: String(futureYear) },
    });
    const futureEmp = resFuture.res.body.appraisals?.[0];
    if (futureEmp) {
      assert('All quarters null for far-future year', ['Q1', 'Q2', 'Q3', 'Q4'].every((q) => futureEmp.quarters[q] === null));
      assert('teamAverages Q1 null for future year', resFuture.res.body.teamAverages?.Q1 === null);
    } else {
      assert('Far-future year returns appraisals array (may be empty)', Array.isArray(resFuture.res.body.appraisals));
    }

    // For current year: any quarter flagged future by isFutureQuarter must be null in response
    const resCurrentYear = resAppraisal;
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
      if (isFutureQuarter(TEST_YEAR, q) && alphaAppraisal) {
        assert(`${q} ${TEST_YEAR} is null when future`, alphaAppraisal.quarters[q] === null);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // [11/11] Team isolation on appraisal endpoint
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n[11/11] Team isolation on appraisal...');

    assert(
      'Team 2 employee absent from Team 1 appraisal',
      !resAppraisal.res.body.appraisals.some((a) => a.email === 'beta@yakkaytech.com')
    );

    const resCrossTeamDossier = await runController(getEmployeeDossier, {
      user: managerReq.user,
      params: { userId: String(empT2.id) },
      query: { year: String(TEST_YEAR), quarter: 'Q1' },
    });
    assert('Cross-team dossier blocked (404)', resCrossTeamDossier.res.statusCode === 404);
  } catch (error) {
    FAIL.push({ label: 'Unhandled test error', detail: error.message });
    console.error('\n🚨 Unhandled error:', error);
  } finally {
    console.log('\n🔌 Closing database connections...');
    await sequelize.close();
  }

  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    FAIL.forEach(({ label, detail }) => {
      console.error(`  • 🚨 ${label}${detail ? `: ${detail}` : ''}`);
    });
    process.exit(1);
  }

  console.log('🎉 All Two-Tiered Performance Analytics tests passed.\n');
  process.exit(0);
};

runTests();
