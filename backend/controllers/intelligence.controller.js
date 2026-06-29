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
 */

const { sequelize, Task, Sprint, Comment } = require('../models');
const { QueryTypes } = require('sequelize');

/* ──────────────────────────────────────────────────────────────────────────
   HELPER: compute derived KPIs from raw SQL row
   ────────────────────────────────────────────────────────────────────────── */
const deriveKPIs = (row) => {
  const shiftDays    = Number(row.shiftDays)    || 0;
  const presentDays  = Number(row.presentDays)  || 0;
  const totalAssigned = Number(row.totalAssigned) || 0;
  const rejections   = Number(row.rejections)   || 0;
  const gtp          = Number(row.gtp)          || 0;

  const ari  = shiftDays  === 0 ? 100.0 : Math.round((presentDays  / shiftDays)   * 1000) / 10;
  const ftpr = totalAssigned === 0 ? 100.0 : Math.round(((totalAssigned - rejections) / totalAssigned) * 1000) / 10;

  const trustScore = Math.min(
    100,
    Math.max(0, Math.round((ari * 0.4) + (ftpr * 0.4) - (gtp * 3.5)))
  );

  return { ari, ftpr, trustScore, shiftDays, presentDays, totalAssigned, rejections, gtp };
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/intelligence/workforce
   Returns one aggregated profile row per Employee-role user.
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

    const rows = await sequelize.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.employee_id                                                    AS employeeId,

        /* ── Attendance ─────────────────────────────────────────────── */
        COUNT(DISTINCT ar.date)                                          AS shiftDays,
        SUM(
          CASE WHEN ar.status IN ('PRESENT_OFFICE','WFH_APPROVED') THEN 1 ELSE 0 END
        )                                                                AS presentDays,

        /* ── Goalpost Tamper Count ───────────────────────────────────── */
        (
          SELECT COUNT(*)
          FROM   audit_logs al
          WHERE  al.user_id = u.id
            AND  al.action  = 'UPDATE'
            AND  (
                   JSON_CONTAINS_PATH(al.changes, 'one', '$.title')
                   OR JSON_CONTAINS_PATH(al.changes, 'one', '$.description')
                 )
        )                                                                AS gtp,

        /* ── Task volume ─────────────────────────────────────────────── */
        (
          SELECT COUNT(*)
          FROM   tasks t
          WHERE  t.assignee_id = u.id
        )                                                                AS totalAssigned,

        /* ── Rejections (negative evaluation comments on their tasks) ── */
        (
          SELECT COUNT(*)
          FROM   comments c
          JOIN   tasks    t ON c.task_id = t.id
          WHERE  t.assignee_id      = u.id
            AND  c.evaluation_tier IN ('Negative (Simple)', 'Negative (Serious)')
        )                                                                AS rejections

      FROM  users u
      LEFT  JOIN attendance_records ar ON ar.user_id = u.id
      WHERE u.system_role = 'Employee' AND u.team_id = :teamId
      GROUP BY u.id, u.name, u.email, u.employee_id
      ORDER BY u.name ASC
      `,
      { replacements: { teamId }, type: QueryTypes.SELECT }
    );

    const workforce = rows.map((row) => ({
      id:          row.id,
      name:        row.name,
      email:       row.email,
      employeeId:  row.employeeId,
      ...deriveKPIs(row),
    }));

    return res.status(200).json({ success: true, workforce });
  } catch (error) {
    next(error);
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/intelligence/dossier/:userId
   Deep-dive: audit diffs + timesheet anomalies for one employee.
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

    /* ── 1. Confirm target user exists and is an Employee on the manager's team ── */
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

    /* ── 2. Git-diff audit feed (title / description changes only) ───── */
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
      ORDER BY al.created_at DESC
      LIMIT 100
      `,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );

    /* ── 3. Timesheet anomalies ──────────────────────────────────────── */
    const anomalies = await sequelize.query(
      `
      SELECT
        id,
        date,
        status,
        work_hours        AS workHours,
        system_auto_closed AS systemAutoClosed,
        regularization_reason AS regularizationReason,
        created_at        AS createdAt
      FROM  attendance_records
      WHERE user_id = :uid
        AND (system_auto_closed = 1 OR status = 'ABSENT')
      ORDER BY date DESC
      LIMIT 60
      `,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );

    /* ── 3.5. Attendance History (biometric verify records) ────────────────── */
    const attendanceHistory = await sequelize.query(
      `
      SELECT
        ar.id,
        ar.date,
        ar.status,
        ar.work_hours        AS workHours,
        ar.system_auto_closed AS systemAutoClosed,
        ar.regularization_reason AS regularizationReason,
        ar.created_at        AS createdAt,
        ar.punch_in_photo    AS punchInPhoto,
        ar.punch_out_photo   AS punchOutPhoto,
        ar.adjudicated_by    AS adjudicatedBy,
        u.name               AS adjudicatorName
      FROM  attendance_records ar
      LEFT JOIN users u ON ar.adjudicated_by = u.id
      WHERE ar.user_id = :uid
      ORDER BY ar.date DESC
      LIMIT 60
      `,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );

    /* ── 4. Summary KPIs (same formula as workforce grid) ────────────── */
    const [kpiRow] = await sequelize.query(
      `
      SELECT
        COUNT(DISTINCT ar.date) AS shiftDays,
        SUM(CASE WHEN ar.status IN ('PRESENT_OFFICE','WFH_APPROVED') THEN 1 ELSE 0 END) AS presentDays,
        (
          SELECT COUNT(*)
          FROM   audit_logs al
          WHERE  al.user_id = :uid
            AND  al.action  = 'UPDATE'
            AND  (
                   JSON_CONTAINS_PATH(al.changes, 'one', '$.title')
                   OR JSON_CONTAINS_PATH(al.changes, 'one', '$.description')
                 )
        ) AS gtp,
        (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = :uid) AS totalAssigned,
        (
          SELECT COUNT(*)
          FROM   comments c
          JOIN   tasks t ON c.task_id = t.id
          WHERE  t.assignee_id     = :uid
            AND  c.evaluation_tier IN ('Negative (Simple)', 'Negative (Serious)')
        ) AS rejections
      FROM  attendance_records ar
      WHERE ar.user_id = :uid
      `,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );

    const commentsInCompletedSprints = await Comment.findAll({
      include: [
        {
          model: Task,
          where: { assigneeId: uid },
          include: [
            {
              model: Sprint,
              where: { status: 'COMPLETED' },
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
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
          attributes: ['id', 'title', 'type', 'issueKey', 'parentId']
        });
        if (!parentTask) break;
        lineage.unshift(parentTask.get({ plain: true }));
        currentId = parentTask.parentId;
      }

      previousComments.push({
        id: c.id,
        content: c.content,
        evaluationTier: c.evaluationTier,
        createdAt: c.createdAt,
        sprint: sprintPlain,
        hierarchy: {
          epic: lineage.find(t => t.type === 'Epic') || null,
          story: lineage.find(t => t.type === 'Story') || null,
          task: lineage.find(t => t.type === 'Task') || null,
          subtask: lineage.find(t => t.type === 'Subtask') || null,
        }
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
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWorkforceSummary, getEmployeeDossier };
