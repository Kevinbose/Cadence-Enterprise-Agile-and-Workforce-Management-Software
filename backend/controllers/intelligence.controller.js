/**
 * Intelligence Controller — Module 6: Workforce Intelligence Engine
 *
 * Read-only aggregation layer. Zero writes, zero mutations.
 * All routes are gated to Admin/Manager via requireRole middleware.
 * Uses raw sequelize.query() to keep all aggregation inside MySQL;
 * no full-table JS loops.
 *
 * Table reference (matching Sequelize model tableName declarations):
 *   users              — user.model.js
 *   attendance_records — attendanceRecord.model.js
 *   audit_logs         — auditLog.model.js
 *   tasks              — task.model.js
 *   comments           — comment.model.js
 *
 * Temporal query support (v2):
 *   All endpoints now accept optional ?year=YYYY&quarter=QX (for quarterly scope)
 *   or just ?year=YYYY (for yearly appraisal). When absent the endpoints
 *   behave identically to the pre-temporal version (full-history mode).
 */

const { sequelize, Task, Sprint, Comment } = require('../models');
const { Op, QueryTypes } = require('sequelize');

/* ──────────────────────────────────────────────────────────────────────────
   HELPER: deriveKPIs — compute all 6 analytics metrics from a raw SQL row
   ────────────────────────────────────────────────────────────────────────── */
const deriveKPIs = (row) => {
  const shiftDays        = Number(row.shiftDays)        || 0;
  const presentDays      = Number(row.presentDays)      || 0;
  const totalAssigned    = Number(row.totalAssigned)    || 0;
  const totalDone        = Number(row.totalDone)        || 0;
  const rejections       = Number(row.rejections)       || 0;
  const gtp              = Number(row.gtp)              || 0;
  const overdueCount     = Number(row.overdueCount)     || 0;
  const positiveComments = Number(row.positiveComments) || 0;
  const negativeComments = Number(row.negativeComments) || 0;
  const velocity         = Number(row.velocity)         || 0;

  // EC-2: Guard against divide-by-zero — return null (not 0) so frontend
  // can distinguish "N/A" from "0%" which are semantically different.
  const ari  = shiftDays === 0 ? null : Math.round((presentDays / shiftDays) * 1000) / 10;
  const ftpr = totalDone === 0 ? null : Math.round(((totalDone - rejections) / totalDone) * 1000) / 10;

  const totalFeedback   = positiveComments + negativeComments;
  const feedbackRatio   = totalFeedback === 0 ? null
    : Math.round((positiveComments / totalFeedback) * 1000) / 10;

  // Trust Score (legacy composite — preserved for backward compat on Manager Hub grid)
  const ariForScore  = ari  ?? 100;
  const ftprForScore = ftpr ?? 100;
  const trustScore   = Math.min(
    100,
    Math.max(0, Math.round((ariForScore * 0.4) + (ftprForScore * 0.4) - (gtp * 3.5)))
  );

  return {
    ari,
    ftpr,
    trustScore,
    shiftDays,
    presentDays,
    totalAssigned,
    totalDone,
    rejections,
    gtp,
    overdueCount,
    positiveComments,
    negativeComments,
    feedbackRatio,
    velocity,
  };
};

/* ──────────────────────────────────────────────────────────────────────────
   HELPER: resolveTemporalBounds
   Maps a year + optional quarter to SQL-safe date boundary strings.
   - Attendance uses DATEONLY (ar.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD')
   - Audit/comment timestamps use ISO UTC strings for DATETIME columns.
   Returns null when no year is provided → signals full-history mode.
   ────────────────────────────────────────────────────────────────────────── */
const resolveTemporalBounds = (year, quarter) => {
  const y = year ? Number(year) : null;
  if (!y || isNaN(y)) return null;

  const quarterMap = {
    Q1: { startDate: `${y}-01-01`, endDate: `${y}-03-31`, startISO: `${y}-01-01T00:00:00.000Z`, endISO: `${y}-03-31T23:59:59.999Z` },
    Q2: { startDate: `${y}-04-01`, endDate: `${y}-06-30`, startISO: `${y}-04-01T00:00:00.000Z`, endISO: `${y}-06-30T23:59:59.999Z` },
    Q3: { startDate: `${y}-07-01`, endDate: `${y}-09-30`, startISO: `${y}-07-01T00:00:00.000Z`, endISO: `${y}-09-30T23:59:59.999Z` },
    Q4: { startDate: `${y}-10-01`, endDate: `${y}-12-31`, startISO: `${y}-10-01T00:00:00.000Z`, endISO: `${y}-12-31T23:59:59.999Z` },
  };

  if (quarter && quarterMap[quarter]) {
    return { ...quarterMap[quarter], year: y, quarter };
  }

  // Full-year bounds
  return {
    startDate: `${y}-01-01`,
    endDate:   `${y}-12-31`,
    startISO:  `${y}-01-01T00:00:00.000Z`,
    endISO:    `${y}-12-31T23:59:59.999Z`,
    year: y,
    quarter: null,
  };
};

/* ──────────────────────────────────────────────────────────────────────────
   HELPER: isFutureQuarter
   Returns true if the quarter's start date is strictly in the future.
   EC-8: Used by getYearlyAppraisal to return null instead of zeros for
   Q3/Q4 when the current year is in progress.
   ────────────────────────────────────────────────────────────────────────── */
const isFutureQuarter = (year, quarter) => {
  const bounds = resolveTemporalBounds(year, quarter);
  if (!bounds) return false;
  const today = new Date();
  const startOfQuarter = new Date(bounds.startISO);
  return startOfQuarter > today;
};

/* ──────────────────────────────────────────────────────────────────────────
   HELPER: buildWorkforceSQL
   Generates the monolithic workforce aggregation SQL. When `bounds` is
   provided, temporal WHERE clauses are injected into every sub-select.
   When `bounds` is null, it returns the full-history query (backward compat).
   ────────────────────────────────────────────────────────────────────────── */
const buildWorkforceSQL = (bounds) => {
  const hasTime = !!bounds;

  return `
    SELECT
      u.id,
      u.name,
      u.email,
      u.employee_id                                                        AS employeeId,

      /* ── Metric 3: Pure Attendance Rate ──────────────────────────────── */
      COUNT(DISTINCT CASE
        WHEN ar.date IS NOT NULL ${hasTime ? `AND ar.date BETWEEN :startDate AND :endDate` : ''}
        THEN ar.date END)                                                   AS shiftDays,
      SUM(
        CASE WHEN ar.status IN ('PRESENT_OFFICE','WFH_APPROVED')
             ${hasTime ? `AND ar.date BETWEEN :startDate AND :endDate` : ''}
        THEN 1 ELSE 0 END
      )                                                                     AS presentDays,

      /* ── Metric 5: Tamper Strikes (Scope Creep / Goalpost Shift) ──────── */
      (
        SELECT COUNT(*)
        FROM   audit_logs al
        WHERE  al.user_id = u.id
          AND  al.action  = 'UPDATE'
          AND  (
                 JSON_CONTAINS_PATH(al.changes, 'one', '$.title')
                 OR JSON_CONTAINS_PATH(al.changes, 'one', '$.description')
               )
          ${hasTime ? `AND al.created_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS gtp,

      /* ── Total Tasks Assigned (for reference) ──────────────────────── */
      (
        SELECT COUNT(*)
        FROM   tasks t
        WHERE  t.assignee_id = u.id
          ${hasTime ? `AND t.created_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS totalAssigned,

      /* ── Metric 6: Raw Velocity (tasks reaching DONE) ──────────────── */
      (
        SELECT COUNT(*)
        FROM   tasks t
        WHERE  t.assignee_id = u.id
          AND  t.status      = 'DONE'
          ${hasTime ? `AND t.updated_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS velocity,

      /* ── totalDone (same as velocity, alias for FTPR calc) ─────────── */
      (
        SELECT COUNT(*)
        FROM   tasks t
        WHERE  t.assignee_id = u.id
          AND  t.status      = 'DONE'
          ${hasTime ? `AND t.updated_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS totalDone,

      /* ── Metric 4: FTPR — rejections (negative eval comments) ──────── */
      (
        SELECT COUNT(*)
        FROM   comments c
        JOIN   tasks    t ON c.task_id = t.id
        WHERE  t.assignee_id      = u.id
          AND  c.evaluation_tier IN ('Negative (Simple)', 'Negative (Serious)')
          ${hasTime ? `AND c.created_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS rejections,

      /* ── Metric 2: Positive feedback count (for feedbackRatio) ─────── */
      (
        SELECT COUNT(*)
        FROM   comments c
        JOIN   tasks    t ON c.task_id = t.id
        WHERE  t.assignee_id     = u.id
          AND  c.evaluation_tier = 'Positive'
          ${hasTime ? `AND c.created_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS positiveComments,

      /* ── Negative feedback count (alias of rejections for feedbackRatio) */
      (
        SELECT COUNT(*)
        FROM   comments c
        JOIN   tasks    t ON c.task_id = t.id
        WHERE  t.assignee_id      = u.id
          AND  c.evaluation_tier IN ('Negative (Simple)', 'Negative (Serious)')
          ${hasTime ? `AND c.created_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS negativeComments,

      /* ── Metric 1: Overdue / Rollover Count ────────────────────────── */
      (
        SELECT COUNT(*)
        FROM   tasks t
        WHERE  t.assignee_id    = u.id
          AND  t.rollover_count  > 0
          ${hasTime ? `AND t.updated_at BETWEEN :startISO AND :endISO` : ''}
      )                                                                     AS overdueCount

    FROM  users u
    LEFT  JOIN attendance_records ar ON ar.user_id = u.id
    WHERE u.system_role = 'Employee' AND u.team_id = :teamId
    GROUP BY u.id, u.name, u.email, u.employee_id
    ORDER BY u.name ASC
  `;
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/intelligence/workforce
   Returns one aggregated profile row per Employee-role user.
   Accepts: ?year=YYYY&quarter=QX (optional — omit for full-history mode)
   ────────────────────────────────────────────────────────────────────────── */
const getWorkforceSummary = async (req, res, next) => {
  try {
    let teamId = req.user.teamId;
    if (teamId === undefined || teamId === null) {
      const User = sequelize.models.User;
      if (User) {
        const dbUser = await User.findByPk(req.user.id, { attributes: ['teamId'] });
        teamId = (dbUser && dbUser.teamId !== null && dbUser.teamId !== undefined) ? dbUser.teamId : 1;
      } else {
        teamId = 1;
      }
    }

    const { year, quarter } = req.query || {};
    const bounds = resolveTemporalBounds(year, quarter);
    const sql    = buildWorkforceSQL(bounds);

    const replacements = { teamId };
    if (bounds) {
      replacements.startDate = bounds.startDate;
      replacements.endDate   = bounds.endDate;
      replacements.startISO  = bounds.startISO;
      replacements.endISO    = bounds.endISO;
    }

    const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

    const workforce = rows.map((row) => ({
      id:         row.id,
      name:       row.name,
      email:      row.email,
      employeeId: row.employeeId,
      ...deriveKPIs(row),
    }));

    return res.status(200).json({
      success: true,
      workforce,
      meta: bounds
        ? { year: bounds.year, quarter: bounds.quarter }
        : { year: null, quarter: null },
    });
  } catch (error) {
    next(error);
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/intelligence/dossier/:userId
   Deep-dive: audit diffs + timesheet anomalies for one employee.
   Accepts: ?year=YYYY&quarter=QX (optional — omit for full-history mode)
   ────────────────────────────────────────────────────────────────────────── */
const getEmployeeDossier = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const uid = Number(userId);

    if (!uid || isNaN(uid)) {
      return res.status(400).json({ success: false, message: 'Invalid userId.' });
    }

    let teamId = req.user.teamId;
    if (teamId === undefined || teamId === null) {
      const User = sequelize.models.User;
      if (User) {
        const dbUser = await User.findByPk(req.user.id, { attributes: ['teamId'] });
        teamId = (dbUser && dbUser.teamId !== null && dbUser.teamId !== undefined) ? dbUser.teamId : 1;
      } else {
        teamId = 1;
      }
    }

    const { year, quarter } = req.query;
    const bounds = resolveTemporalBounds(year, quarter);

    /* ── 1. Confirm target user exists and belongs to manager's team ── */
    const [userRow] = await sequelize.query(
      `SELECT id, name, email, employee_id AS employeeId
       FROM users
       WHERE id = :uid AND system_role = 'Employee' AND team_id = :teamId
       LIMIT 1`,
      { replacements: { uid, teamId }, type: QueryTypes.SELECT }
    );

    if (!userRow) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    /* ── 2. Git-diff audit feed — scoped to temporal bounds ───────── */
    const auditDiffs = await sequelize.query(
      `
      SELECT
        al.id,
        al.task_id     AS taskId,
        al.sprint_id   AS sprintId,
        al.changes,
        al.created_at  AS createdAt,
        t.issue_key    AS issueKey,
        t.title        AS taskTitle
      FROM  audit_logs al
      LEFT  JOIN tasks t ON t.id = al.task_id
      WHERE al.user_id = :uid
        AND al.action  = 'UPDATE'
        AND (
              JSON_CONTAINS_PATH(al.changes, 'one', '$.title')
              OR JSON_CONTAINS_PATH(al.changes, 'one', '$.description')
            )
        ${bounds ? `AND al.created_at BETWEEN :startISO AND :endISO` : ''}
      ORDER BY al.created_at DESC
      LIMIT 100
      `,
      {
        replacements: bounds
          ? { uid, startISO: bounds.startISO, endISO: bounds.endISO }
          : { uid },
        type: QueryTypes.SELECT,
      }
    );

    /* ── 3. Timesheet anomalies — scoped ───────────────────────────── */
    const anomalies = await sequelize.query(
      `
      SELECT
        id,
        date,
        status,
        work_hours            AS workHours,
        system_auto_closed    AS systemAutoClosed,
        regularization_reason AS regularizationReason,
        created_at            AS createdAt
      FROM  attendance_records
      WHERE user_id = :uid
        AND (system_auto_closed = 1 OR status = 'ABSENT')
        ${bounds ? `AND date BETWEEN :startDate AND :endDate` : ''}
      ORDER BY date DESC
      LIMIT 60
      `,
      {
        replacements: bounds
          ? { uid, startDate: bounds.startDate, endDate: bounds.endDate }
          : { uid },
        type: QueryTypes.SELECT,
      }
    );

    /* ── 3.5. Full attendance history — scoped ──────────────────────── */
    const attendanceHistory = await sequelize.query(
      `
      SELECT
        ar.id,
        ar.date,
        ar.status,
        ar.work_hours             AS workHours,
        ar.system_auto_closed     AS systemAutoClosed,
        ar.regularization_reason  AS regularizationReason,
        ar.created_at             AS createdAt,
        ar.punch_in_photo         AS punchInPhoto,
        ar.punch_out_photo        AS punchOutPhoto,
        ar.adjudicated_by         AS adjudicatedBy,
        u.name                    AS adjudicatorName
      FROM  attendance_records ar
      LEFT JOIN users u ON ar.adjudicated_by = u.id
      WHERE ar.user_id = :uid
        ${bounds ? `AND ar.date BETWEEN :startDate AND :endDate` : ''}
      ORDER BY ar.date DESC
      LIMIT 60
      `,
      {
        replacements: bounds
          ? { uid, startDate: bounds.startDate, endDate: bounds.endDate }
          : { uid },
        type: QueryTypes.SELECT,
      }
    );

    /* ── 4. Summary KPIs — scoped to period (same 6 metrics) ─────── */
    const [kpiRow] = await sequelize.query(
      `
      SELECT
        COUNT(DISTINCT CASE
          WHEN 1=1 ${bounds ? `AND ar.date BETWEEN :startDate AND :endDate` : ''}
          THEN ar.date END)                                                          AS shiftDays,
        SUM(CASE
          WHEN ar.status IN ('PRESENT_OFFICE','WFH_APPROVED')
               ${bounds ? `AND ar.date BETWEEN :startDate AND :endDate` : ''}
          THEN 1 ELSE 0 END)                                                         AS presentDays,
        (SELECT COUNT(*) FROM audit_logs al
         WHERE al.user_id = :uid AND al.action = 'UPDATE'
           AND (JSON_CONTAINS_PATH(al.changes,'one','$.title')
                OR JSON_CONTAINS_PATH(al.changes,'one','$.description'))
           ${bounds ? `AND al.created_at BETWEEN :startISO AND :endISO` : ''})       AS gtp,
        (SELECT COUNT(*) FROM tasks t
         WHERE t.assignee_id = :uid
           ${bounds ? `AND t.created_at BETWEEN :startISO AND :endISO` : ''})        AS totalAssigned,
        (SELECT COUNT(*) FROM tasks t
         WHERE t.assignee_id = :uid AND t.status = 'DONE'
           ${bounds ? `AND t.updated_at BETWEEN :startISO AND :endISO` : ''})        AS velocity,
        (SELECT COUNT(*) FROM tasks t
         WHERE t.assignee_id = :uid AND t.status = 'DONE'
           ${bounds ? `AND t.updated_at BETWEEN :startISO AND :endISO` : ''})        AS totalDone,
        (SELECT COUNT(*) FROM comments c JOIN tasks t ON c.task_id = t.id
         WHERE t.assignee_id = :uid
           AND c.evaluation_tier IN ('Negative (Simple)', 'Negative (Serious)')
           ${bounds ? `AND c.created_at BETWEEN :startISO AND :endISO` : ''})        AS rejections,
        (SELECT COUNT(*) FROM comments c JOIN tasks t ON c.task_id = t.id
         WHERE t.assignee_id = :uid AND c.evaluation_tier = 'Positive'
           ${bounds ? `AND c.created_at BETWEEN :startISO AND :endISO` : ''})        AS positiveComments,
        (SELECT COUNT(*) FROM comments c JOIN tasks t ON c.task_id = t.id
         WHERE t.assignee_id = :uid
           AND c.evaluation_tier IN ('Negative (Simple)', 'Negative (Serious)')
           ${bounds ? `AND c.created_at BETWEEN :startISO AND :endISO` : ''})        AS negativeComments,
        (SELECT COUNT(*) FROM tasks t
         WHERE t.assignee_id = :uid AND t.rollover_count > 0
           ${bounds ? `AND t.updated_at BETWEEN :startISO AND :endISO` : ''})        AS overdueCount
      FROM  attendance_records ar
      WHERE ar.user_id = :uid
      `,
      {
        replacements: bounds
          ? { uid, startDate: bounds.startDate, endDate: bounds.endDate, startISO: bounds.startISO, endISO: bounds.endISO }
          : { uid },
        type: QueryTypes.SELECT,
      }
    );

    /* ── 5. Previous evaluations (Sequelize ORM — scoped via Op.between) ─ */
    const commentWhere = {};
    if (bounds) {
      commentWhere.createdAt = { [Op.between]: [new Date(bounds.startISO), new Date(bounds.endISO)] };
    }

    const commentsInCompletedSprints = await Comment.findAll({
      where: commentWhere,
      include: [
        {
          model: Task,
          where: { assigneeId: uid },
          include: [
            {
              model: Sprint,
              where: { status: 'COMPLETED' },
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const previousComments = [];
    for (const c of commentsInCompletedSprints) {
      const taskPlain = c.Task;
      if (!taskPlain) continue;
      const sprintPlain = taskPlain.Sprint;

      // Resolve lineage
      const lineage = [];
      let currentId = taskPlain.id;
      const visited = new Set();
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const parentTask = await Task.findByPk(currentId, {
          attributes: ['id', 'title', 'type', 'issueKey', 'parentId'],
        });
        if (!parentTask) break;
        lineage.unshift(parentTask.get({ plain: true }));
        currentId = parentTask.parentId;
      }

      previousComments.push({
        id:             c.id,
        content:        c.content,
        evaluationTier: c.evaluationTier,
        createdAt:      c.createdAt,
        sprint:         sprintPlain,
        hierarchy: {
          epic:    lineage.find(t => t.type === 'Epic')    || null,
          story:   lineage.find(t => t.type === 'Story')   || null,
          task:    lineage.find(t => t.type === 'Task')    || null,
          subtask: lineage.find(t => t.type === 'Subtask') || null,
        },
      });
    }

    const kpis = deriveKPIs(kpiRow || {});

    return res.status(200).json({
      success: true,
      employee: userRow,
      kpis,
      auditDiffs,
      anomalies,
      attendanceHistory,
      previousComments,
      meta: bounds
        ? { year: bounds.year, quarter: bounds.quarter }
        : { year: null, quarter: null },
    });
  } catch (error) {
    next(error);
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/intelligence/appraisal
   Yearly Strategic Appraisal: returns per-employee KPIs for all 4 quarters.
   Future quarters return null (not zeros) — EC-8: Future-Quarter Trap.
   Also returns team averages per quarter for the Radar Chart comparison.

   Required query param: ?year=YYYY
   ────────────────────────────────────────────────────────────────────────── */
const getYearlyAppraisal = async (req, res, next) => {
  try {
    const { year } = req.query || {};
    if (!year || isNaN(Number(year))) {
      return res.status(400).json({
        success: false,
        message: 'year query param is required. Example: ?year=2026',
      });
    }

    let teamId = req.user.teamId;
    if (teamId === undefined || teamId === null) {
      const User = sequelize.models.User;
      if (User) {
        const dbUser = await User.findByPk(req.user.id, { attributes: ['teamId'] });
        teamId = (dbUser && dbUser.teamId !== null && dbUser.teamId !== undefined) ? dbUser.teamId : 1;
      } else {
        teamId = 1;
      }
    }

    // Fetch employee list once — team-isolated
    const employees = await sequelize.query(
      `SELECT id, name, email, employee_id AS employeeId
       FROM users
       WHERE system_role = 'Employee' AND team_id = :teamId
       ORDER BY name ASC`,
      { replacements: { teamId }, type: QueryTypes.SELECT }
    );

    const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

    // Run one SQL query per non-future quarter — collect results keyed by userId
    const quarterResults = {};
    for (const q of QUARTERS) {
      if (isFutureQuarter(year, q)) {
        quarterResults[q] = null; // EC-8: future quarter → null
        continue;
      }

      const bounds = resolveTemporalBounds(year, q);
      const sql    = buildWorkforceSQL(bounds);

      const rows = await sequelize.query(sql, {
        replacements: {
          teamId,
          startDate: bounds.startDate,
          endDate:   bounds.endDate,
          startISO:  bounds.startISO,
          endISO:    bounds.endISO,
        },
        type: QueryTypes.SELECT,
      });

      quarterResults[q] = {};
      for (const row of rows) {
        quarterResults[q][row.id] = deriveKPIs(row);
      }
    }

    // Compute team averages per quarter (used by Radar Chart)
    const avgOfNonNull = (arr, key) => {
      const nonNull = arr.filter(v => v[key] !== null && v[key] !== undefined);
      return nonNull.length === 0 ? null
        : Math.round((nonNull.reduce((s, v) => s + v[key], 0) / nonNull.length) * 10) / 10;
    };

    const teamAverages = {};
    for (const q of QUARTERS) {
      if (!quarterResults[q]) {
        teamAverages[q] = null;
        continue;
      }
      const vals = Object.values(quarterResults[q]);
      teamAverages[q] = {
        ari:           avgOfNonNull(vals, 'ari'),
        ftpr:          avgOfNonNull(vals, 'ftpr'),
        gtp:           avgOfNonNull(vals, 'gtp'),
        overdueCount:  avgOfNonNull(vals, 'overdueCount'),
        feedbackRatio: avgOfNonNull(vals, 'feedbackRatio'),
        velocity:      avgOfNonNull(vals, 'velocity'),
      };
    }

    // Compose per-employee appraisal objects with quarterly breakdown + yearly totals
    const appraisals = employees.map(emp => {
      const quarters = {};
      let yearlyVelocity   = 0;
      let yearlyDone       = 0;
      let yearlyRejections = 0;
      let yearlyGtp        = 0;
      let yearlyOverdue    = 0;
      let totalPresentDays = 0;
      let totalShiftDays   = 0;
      let totalPositive    = 0;
      let totalNegative    = 0;

      for (const q of QUARTERS) {
        if (!quarterResults[q] || !quarterResults[q][emp.id]) {
          quarters[q] = null;
          continue;
        }

        const kpi = quarterResults[q][emp.id];
        quarters[q] = {
          velocity:      kpi.velocity,
          ari:           kpi.ari,
          ftpr:          kpi.ftpr,
          gtp:           kpi.gtp,
          overdueCount:  kpi.overdueCount,
          feedbackRatio: kpi.feedbackRatio,
          shiftDays:     kpi.shiftDays,
          presentDays:   kpi.presentDays,
        };

        yearlyVelocity   += kpi.velocity        || 0;
        yearlyDone       += kpi.totalDone        || 0;
        yearlyRejections += kpi.rejections       || 0;
        yearlyGtp        += kpi.gtp              || 0;
        yearlyOverdue    += kpi.overdueCount     || 0;
        totalPresentDays += kpi.presentDays      || 0;
        totalShiftDays   += kpi.shiftDays        || 0;
        totalPositive    += kpi.positiveComments || 0;
        totalNegative    += kpi.negativeComments || 0;
      }

      const yearlyARI  = totalShiftDays === 0 ? null
        : Math.round((totalPresentDays / totalShiftDays) * 1000) / 10;
      const yearlyFTPR = yearlyDone === 0 ? null
        : Math.round(((yearlyDone - yearlyRejections) / yearlyDone) * 1000) / 10;
      const totalFeedback = totalPositive + totalNegative;
      const yearlyFeedbackRatio = totalFeedback === 0 ? null
        : Math.round((totalPositive / totalFeedback) * 1000) / 10;

      return {
        id:         emp.id,
        name:       emp.name,
        email:      emp.email,
        employeeId: emp.employeeId,
        quarters,
        yearlyTotals: {
          velocity:      yearlyVelocity,
          ari:           yearlyARI,
          ftpr:          yearlyFTPR,
          gtp:           yearlyGtp,
          overdueCount:  yearlyOverdue,
          feedbackRatio: yearlyFeedbackRatio,
        },
      };
    });

    return res.status(200).json({
      success: true,
      year: Number(year),
      teamAverages,
      appraisals,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkforceSummary,
  getEmployeeDossier,
  getYearlyAppraisal,
  // Exported for integration tests only
  resolveTemporalBounds,
  isFutureQuarter,
  deriveKPIs,
};
