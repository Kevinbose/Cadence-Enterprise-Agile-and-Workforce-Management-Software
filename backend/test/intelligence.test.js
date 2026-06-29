/**
 * Integration Test Suite — Module 6: Workforce Intelligence & God-Mode Manager Hub
 * Run from the backend directory:
 *   node test/intelligence.test.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize, User } = require('../models');
const { getWorkforceSummary, getEmployeeDossier } = require('../controllers/intelligence.controller');

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
  console.log('🧪 Starting Module 6: Workforce Intelligence Test Suite...\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.\n');
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }

  // ── Test 1: getWorkforceSummary Controller Function ────────────────────────
  console.log('[1/3] Testing getWorkforceSummary controller...');
  try {
    let responseData = null;
    let responseStatus = null;

    const req = {
      user: {
        id: 3,
        systemRole: 'Admin/Manager',
      }
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

    await getWorkforceSummary(req, res, next);

    assert('Response status is 200', responseStatus === 200);
    assert('Response success is true', responseData && responseData.success === true);
    assert('Response contains workforce array', responseData && Array.isArray(responseData.workforce));

    if (responseData && responseData.workforce.length > 0) {
      const emp = responseData.workforce[0];
      assert('Workforce user has id', emp.id !== undefined);
      assert('Workforce user has name', emp.name !== undefined);
      assert('Workforce user has email', emp.email !== undefined);
      assert('Workforce user has employeeId', emp.employeeId !== undefined);
      assert('Workforce user has ari', typeof emp.ari === 'number');
      assert('Workforce user has ftpr', typeof emp.ftpr === 'number');
      assert('Workforce user has trustScore', typeof emp.trustScore === 'number' && emp.trustScore >= 0 && emp.trustScore <= 100);
    }
  } catch (err) {
    assert('getWorkforceSummary runs without throwing exceptions', false, err.message);
  }

  // ── Test 2: getEmployeeDossier Controller Function ─────────────────────────
  console.log('\n[2/3] Testing getEmployeeDossier controller...');
  try {
    let responseData = null;
    let responseStatus = null;

    const req = {
      params: { userId: '1' },
      user: {
        id: 3,
        systemRole: 'Admin/Manager',
      }
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

    await getEmployeeDossier(req, res, next);

    assert('Dossier response status is 200', responseStatus === 200);
    assert('Dossier response success is true', responseData && responseData.success === true);
    assert('Dossier contains employee object', responseData && responseData.employee !== undefined);
    assert('Dossier contains KPIs object', responseData && responseData.kpis !== undefined);
    assert('Dossier contains auditDiffs array', responseData && Array.isArray(responseData.auditDiffs));
    assert('Dossier contains anomalies array', responseData && Array.isArray(responseData.anomalies));

    if (responseData && responseData.kpis) {
      const k = responseData.kpis;
      assert('KPIs contains ari', typeof k.ari === 'number');
      assert('KPIs contains ftpr', typeof k.ftpr === 'number');
      assert('KPIs contains trustScore', typeof k.trustScore === 'number');
    }
  } catch (err) {
    assert('getEmployeeDossier runs without throwing exceptions', false, err.message);
  }

  // ── Test 3: getEmployeeDossier with invalid ID ─────────────────────────────
  console.log('\n[3/3] Testing getEmployeeDossier error handling...');
  try {
    let responseData = null;
    let responseStatus = null;

    const req = {
      params: { userId: 'invalid_id' },
      user: {
        id: 3,
        systemRole: 'Admin/Manager',
      }
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

    await getEmployeeDossier(req, res, next);

    assert('Dossier returns 400 for non-numeric userId', responseStatus === 400);
    assert('Dossier returns success=false for non-numeric userId', responseData && responseData.success === false);
  } catch (err) {
    assert('getEmployeeDossier handles invalid input without crash', false, err.message);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(` Results: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('========================================\n');

  if (FAIL.length > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All workforce intelligence tests passed successfully.\n');
  }
};

runSuite().finally(() => sequelize.close());
