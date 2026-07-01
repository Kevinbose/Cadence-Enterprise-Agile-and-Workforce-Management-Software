const { Op } = require('sequelize');
const { sequelize, Sprint, Task, User } = require('../models');

/**
 * Automated Sprint Rollover Engine
 * ────────────────────────────────
 * When a sprint becomes ACTIVE, every non-DONE task still attached to a
 * COMPLETED sprint of the same team (the "Limbo State") is migrated onto the
 * newly active sprint. Two latch columns record history:
 *   • originalSprintId — the FIRST sprint the task ever lived in (write-once)
 *   • rolloverCount    — number of times the task has been carried forward
 *
 * SAFETY MODEL (why this is deadlock- and race-safe):
 *   1. The whole migration runs inside a single sequelize.transaction().
 *   2. Limbo tasks are processed with a sequential for...of loop (never
 *      Promise.all) in ascending id order — a stable lock-acquisition order
 *      that prevents InnoDB deadlocks between two concurrent rollovers.
 *   3. Every task row is pulled with a row-level lock (SELECT ... FOR UPDATE)
 *      and RE-VALIDATED inside the loop: if a concurrent request already moved
 *      it (its sprintId is no longer a COMPLETED sprint) or it is DONE, it is
 *      skipped. This is the idempotency guard — rolloverCount can never be
 *      double-incremented and tasks can never be moved twice (EC-NEW-2).
 *   4. Callers invoke this AFTER an activation and treat failures as
 *      non-fatal: the flip is already committed, and the next board load will
 *      self-heal, so a transient deadlock never surfaces to the user.
 *
 * SCOPE DECISION (EC-NEW-5): limbo tasks are pulled from ALL COMPLETED sprints
 * of the team, not just the most-recent one — the board always fully self-heals.
 * On a fresh seed every task is DONE, so this is a no-op there.
 */

// Robustly resolve a "system" user id for audit attribution on automated
// (GET / middleware) activation paths. Prefers SuperAdmin, then any Manager,
// then the lowest user id. Cached for the process lifetime to avoid repeated
// lookups on the high-frequency middleware paths (EC-NEW-7).
let _cachedSystemUserId = null;
const resolveSystemUserId = async () => {
  if (_cachedSystemUserId) return _cachedSystemUserId;

  const superAdmin = await User.findOne({
    where: { systemRole: 'SuperAdmin' },
    order: [['id', 'ASC']],
    attributes: ['id'],
  });
  if (superAdmin) {
    _cachedSystemUserId = superAdmin.id;
    return _cachedSystemUserId;
  }

  const manager = await User.findOne({
    where: { systemRole: 'Admin/Manager' },
    order: [['id', 'ASC']],
    attributes: ['id'],
  });
  if (manager) {
    _cachedSystemUserId = manager.id;
    return _cachedSystemUserId;
  }

  const anyUser = await User.findOne({ order: [['id', 'ASC']], attributes: ['id'] });
  _cachedSystemUserId = anyUser ? anyUser.id : 1;
  return _cachedSystemUserId;
};

// Apply the rollover latch to a locked task instance inside the transaction.
// Only touches sprintId / originalSprintId / rolloverCount — never status,
// type, parentId, or any AUDITED_FIELD (Zero-Regression Law).
const migrateTask = async (task, newSprintId, uid, t) => {
  const patch = {
    sprintId: newSprintId,
    rolloverCount: (task.rolloverCount || 0) + 1,
  };
  // EC-3: originalSprintId is a write-once latch — never overwrite it.
  if (task.originalSprintId === null || task.originalSprintId === undefined) {
    patch.originalSprintId = task.sprintId;
  }
  // EC-6: userId MUST be passed to satisfy the afterUpdate audit-hook guard.
  // None of these fields are audited, so the hook produces an empty diff and
  // writes no AuditLog row.
  await task.update(patch, { userId: uid, transaction: t });
};

/**
 * executeRollover — migrate all limbo tasks (and their unfinished ancestor
 * chain) onto `newSprint`. Manages its own transaction internally.
 *
 * @param {Sprint} newSprint - the sprint that just became ACTIVE
 * @param {object} [options]
 * @param {number} [options.systemUserId] - audit actor; resolved if omitted
 * @returns {Promise<{ rolledOverCount: number, ancestorsMoved: number }>}
 */
const executeRollover = async (newSprint, { systemUserId } = {}) => {
  if (!newSprint || !newSprint.id) {
    return { rolledOverCount: 0, ancestorsMoved: 0 };
  }

  const uid = systemUserId || (await resolveSystemUserId());
  const teamId = newSprint.teamId;
  const t = await sequelize.transaction();

  try {
    // 1. All COMPLETED sprints for this team — the limbo source set (team-scoped).
    const completedSprints = await Sprint.findAll({
      where: { teamId, status: 'COMPLETED' },
      attributes: ['id'],
      transaction: t,
    });
    const completedIds = completedSprints.map((s) => s.id);

    if (completedIds.length === 0) {
      await t.commit();
      return { rolledOverCount: 0, ancestorsMoved: 0 };
    }

    const completedIdSet = new Set(completedIds);

    // 2. Limbo tasks: non-DONE, currently attached to a completed sprint.
    //    Ordered by id ASC for a stable lock-acquisition order (deadlock-safe).
    const limboTasks = await Task.findAll({
      where: {
        sprintId: { [Op.in]: completedIds },
        status: { [Op.ne]: 'DONE' },
      },
      attributes: ['id'],
      order: [['id', 'ASC']],
      transaction: t,
    });

    let rolledOverCount = 0;
    const parentQueue = [];

    // 3. Sequential, row-locked migration of each limbo task.
    for (const { id } of limboTasks) {
      const task = await Task.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!task) continue;
      // Re-validate under the lock — a concurrent rollover may have finished first.
      if (task.status === 'DONE') continue;
      if (!completedIdSet.has(task.sprintId)) continue; // already moved elsewhere
      if (task.sprintId === newSprint.id) continue;      // defensive

      await migrateTask(task, newSprint.id, uid, t);
      rolledOverCount += 1;
      if (task.parentId) parentQueue.push(task.parentId);
    }

    // 4. Ancestor Chain Migration (EC-4) — pull unfinished ancestors forward so
    //    the swimlane parent row is present on the new board. DONE ancestors are
    //    intentionally LEFT BEHIND to preserve the completed sprint's velocity
    //    (their DONE children also stay). Strictly team-scoped (EC-NEW-8): an
    //    ancestor is only moved when it currently sits in a COMPLETED sprint of
    //    THIS team, so a shared/mis-parented ancestor can never drag a task
    //    across teams. We still climb past non-movable ancestors to reach a
    //    movable grandparent.
    let ancestorsMoved = 0;
    const visited = new Set();

    while (parentQueue.length > 0) {
      const parentId = parentQueue.shift();
      if (visited.has(parentId)) continue;
      visited.add(parentId);

      const parent = await Task.findByPk(parentId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!parent) continue;

      // Already on the active board — nothing to move, but keep climbing.
      if (parent.sprintId === newSprint.id) {
        if (parent.parentId) parentQueue.push(parent.parentId);
        continue;
      }

      // DONE ancestor stays behind for historical integrity; keep climbing.
      if (parent.status === 'DONE') {
        if (parent.parentId) parentQueue.push(parent.parentId);
        continue;
      }

      // Team-scope guard: only migrate ancestors sitting in THIS team's
      // completed sprints. Anything else (other team, pending, active) is left
      // untouched — but we still climb toward a potentially-movable grandparent.
      if (!completedIdSet.has(parent.sprintId)) {
        if (parent.parentId) parentQueue.push(parent.parentId);
        continue;
      }

      await migrateTask(parent, newSprint.id, uid, t);
      ancestorsMoved += 1;
      if (parent.parentId) parentQueue.push(parent.parentId);
    }

    await t.commit();
    return { rolledOverCount, ancestorsMoved };
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

/**
 * safeExecuteRollover — non-fatal wrapper for the automated activation paths
 * (GET handlers and context middleware). Never throws; logs and returns a
 * zeroed result so a transient rollover failure can never break a board load
 * or an API request. The next activation/board load will self-heal.
 */
const safeExecuteRollover = async (newSprint, options = {}) => {
  try {
    return await executeRollover(newSprint, options);
  } catch (err) {
    console.error(
      `⚠️  Sprint rollover failed for sprint ${newSprint?.id} (non-fatal):`,
      err.message
    );
    return { rolledOverCount: 0, ancestorsMoved: 0 };
  }
};

module.exports = {
  executeRollover,
  safeExecuteRollover,
  resolveSystemUserId,
};
