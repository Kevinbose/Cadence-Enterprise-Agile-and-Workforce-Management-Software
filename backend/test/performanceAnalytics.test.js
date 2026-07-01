/**
 * Integration Test Suite — Module 6: Two-Tiered Performance Analytics System
 * Tests both the Quarterly Tactical view (Manager Hub) and the Yearly Strategic view (Appraisal Engine).
 * Runs from the backend directory:
 *   node test/performanceAnalytics.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User } = require('../models');
const {
  getWorkforceSummary,
  getEmployeeDossier,
  getYearlyAppraisal,
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

const runSuite = async () => {
  console.log('🧪 Starting Module 6: Performance Analytics & Appraisal Engine Test Suite...\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.\n');
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }

  // Resolve a manager to act as the request actor (Sarah Executive, Team 1)
  const manager = await User.findOne({ where: { email: 'manager1@yakkaytech.com' } });
  if (!manager) {
    console.error('❌ Could not find manager Sarah Executive in database. Please seed first: node scripts/seedLargeTelemetryData.js');
    process.exit(1);
  }

  // Resolve a team employee to use in dossier deep dives
  const employee = await User.findOne({ where: { systemRole: 'Employee', teamId: manager.teamId } });
  if (!employee) {
    console.error('❌ Could not find any team employee. Please seed first.');
    process.exit(1);
  }

  // Helper mock helper for Express request/response
  const createMockReqRes = (query = {}, params = {}) => {
    let responseData = null;
    let responseStatus = null;

    const req = {
      user: {
        id: manager.id,
        teamId: manager.teamId,
        systemRole: 'Admin/Manager',
      },
      query,
      params,
    };

    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    const next = (err) => {
      if (err) throw err;
    };

    return { req, res, next, getStatus: () => responseStatus, getData: () => responseData };
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 1: getWorkforceSummary (Tier 1: Manager Hub)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[1/4] Testing getWorkforceSummary (Manager Hub Grid) with temporal filters...');

  try {
    // 1.1 Test without temporal filters (backward compatibility check)
    const { req: req1, res: res1, next: next1, getStatus: status1, getData: data1 } = createMockReqRes();
    await getWorkforceSummary(req1, res1, next1);
    
    assert('Unfiltered workforce returns 200', status1() === 200);
    assert('Unfiltered workforce returns success', data1() && data1().success === true);
    assert('Unfiltered workforce contains meta with null bounds', data1() && data1().meta.year === null);

    // 1.2 Test with Q1 2026 filter
    const { req: req2, res: res2, next: next2, getStatus: status2, getData: data2 } = createMockReqRes({ year: '2026', quarter: 'Q1' });
    await getWorkforceSummary(req2, res2, next2);

    assert('Q1 2026 workforce returns 200', status2() === 200);
    assert('Q1 2026 workforce has metadata mapped', data2() && data2().meta.year === 2026 && data2().meta.quarter === 'Q1');
    assert('Workforce elements contains all 6 core metrics', data2() && data2().workforce.length > 0 && 
      'velocity' in data2().workforce[0] &&
      'ari' in data2().workforce[0] &&
      'ftpr' in data2().workforce[0] &&
      'gtp' in data2().workforce[0] &&
      'overdueCount' in data2().workforce[0] &&
      'feedbackRatio' in data2().workforce[0]
    );

    // 1.3 Verify Team Isolation remains strictly locked
    const firstEmp = data2().workforce[0];
    const dbEmp = await User.findByPk(firstEmp.id);
    assert('Workforce summary strictly respects manager team isolation', dbEmp.teamId === manager.teamId);

  } catch (err) {
    assert('Section 1 runs without crashes', false, err.stack);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 2: getEmployeeDossier (Tier 1: Sidebar Logs)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[2/4] Testing getEmployeeDossier (Quarterly Tactical Side-Drawer)...');

  try {
    // 2.1 Test with Q2 2026 bounds
    const { req, res, next, getStatus, getData } = createMockReqRes({ year: '2026', quarter: 'Q2' }, { userId: String(employee.id) });
    await getEmployeeDossier(req, res, next);

    assert('Q2 Dossier details returns 200', getStatus() === 200);
    assert('Dossier payload includes employee profile', getData() && getData().employee.id === employee.id);
    assert('Dossier includes scoped KPIs', getData() && 'kpis' in getData());
    assert('Dossier includes scoped auditDiffs array', getData() && Array.isArray(getData().auditDiffs));
    assert('Dossier includes scoped anomalies array', getData() && Array.isArray(getData().anomalies));
    assert('Dossier includes scoped attendanceHistory array', getData() && Array.isArray(getData().attendanceHistory));
    assert('Dossier includes scoped previousComments array', getData() && Array.isArray(getData().previousComments));

    // 2.2 Verify dates on returned records belong strictly to Q2 (May 2026 dates)
    const allAnomaliesInQ2 = getData().anomalies.every(a => {
      const month = new Date(a.date).getMonth(); // May = 4
      return month === 4;
    });
    assert('Dossier work anomalies strictly filtered to Q2 bounds', allAnomaliesInQ2);

    const allAttendanceInQ2 = getData().attendanceHistory.every(a => {
      const month = new Date(a.date).getMonth();
      return month === 4;
    });
    assert('Dossier attendance logs strictly filtered to Q2 bounds', allAttendanceInQ2);

  } catch (err) {
    assert('Section 2 runs without crashes', false, err.stack);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 3: getYearlyAppraisal (Tier 2: Yearly Strategic View)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[3/4] Testing getYearlyAppraisal (Appraisal Engine Endpoint)...');

  try {
    // 3.1 Verify year parameter constraint
    const { req: reqErr, res: resErr, next: nextErr, getStatus: statusErr, getData: dataErr } = createMockReqRes();
    await getYearlyAppraisal(reqErr, resErr, nextErr);
    assert('Year parameter is mandatory (returns 400 if missing)', statusErr() === 400);

    // 3.2 Fetch valid 2026 appraisal data
    const { req, res, next, getStatus, getData } = createMockReqRes({ year: '2026' });
    await getYearlyAppraisal(req, res, next);

    assert('2026 Yearly appraisal returns 200', getStatus() === 200);
    assert('Payload reports requested year', getData() && getData().year === 2026);
    assert('Appraisal list populated for team members', getData() && Array.isArray(getData().appraws || getData().appraisals));
    
    const appraisals = getData().appraisals || getData().appraws;
    if (appraisals.length > 0) {
      const app = appraisals[0];
      assert('Appraisal item contains employee metadata', app.id && app.name && app.email);
      assert('Appraisal item contains yearly totals summary', app.yearlyTotals && 'velocity' in app.yearlyTotals);
      assert('Appraisal item contains quarterly breakdown', app.quarters && 'Q1' in app.quarters && 'Q2' in app.quarters);
    }

  } catch (err) {
    assert('Section 3 runs without crashes', false, err.stack);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 4: EDGE CASES (Future Quarters, Divide-by-Zero, Team Isolation)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[4/4] Verifying Module 6 Edge Cases & Compliance rules...');

  try {
    const { req, res, next, getData } = createMockReqRes({ year: '2026' });
    await getYearlyAppraisal(req, res, next);
    const appraisals = getData()?.appraisals;

    if (appraisals && appraisals.length > 0) {
      const app = appraisals[0];
      
      // EC-8: The Future-Quarter Trap (Q4 2026 is in future in simulated July 2026)
      assert(
        'EC-8: Future quarters (e.g. Q4 2026) return null, preventing skew of average consistency trends',
        app.quarters.Q4 === null
      );

      // Verify Q1 and Q2 data are loaded (since we seeded historical timeline)
      assert(
        'Historical timelines successfully read back (Q1 completed data exists)',
        app.quarters.Q1 !== null && typeof app.quarters.Q1.velocity === 'number'
      );
      assert(
        'Historical timelines successfully read back (Q2 completed data exists)',
        app.quarters.Q2 !== null && typeof app.quarters.Q2.velocity === 'number'
      );
    }

    // Verify team averages exist for radar charting
    const teamAverages = getData()?.teamAverages;
    assert('Team averages calculated for radar comparison', teamAverages && teamAverages.Q1 && 'ftpr' in teamAverages.Q1);

  } catch (err) {
    assert('Section 4 runs without crashes', false, err.stack);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    console.error('❌ Some tests failed. Please review execution logs.');
    process.exit(1);
  } else {
    console.log('🎉 All high-level performance analytics tests passed successfully!\n');
  }
};

runSuite().finally(() => sequelize.close());
