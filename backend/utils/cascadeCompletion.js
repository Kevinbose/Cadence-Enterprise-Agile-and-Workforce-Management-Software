const { Task } = require('../models');

/**
 * checkAndCascadeCompletion — Cascade Auto-Rollup engine.
 *
 * When a child task is marked DONE, this helper checks whether ALL of its
 * siblings (tasks sharing the same parentId) are also DONE. If so, the parent
 * is automatically promoted to DONE, and the check recurses up to the
 * grandparent, and so on to the top of the hierarchy.
 *
 * Each parent update passes `{ userId }` to the Task audit hook so the
 * automated rollup remains fully traceable in the AuditLog.
 *
 * @param {number} parentId - The parentId of the task that just changed.
 * @param {number} userId   - The acting user, recorded in the audit trail.
 * @returns {Promise<number[]>} Array of parent task ids that were auto-completed.
 */
const checkAndCascadeCompletion = async (parentId, userId) => {
  const completedParents = [];

  let currentParentId = parentId;

  while (currentParentId) {
    const siblings = await Task.findAll({
      where: { parentId: currentParentId },
    });

    // No children → nothing to roll up at this level.
    if (siblings.length === 0) {
      break;
    }

    const outstanding = siblings.filter((sibling) => sibling.status !== 'DONE');

    if (outstanding.length > 0) {
      // At least one sibling is unfinished — stop the cascade.
      break;
    }

    const parent = await Task.findByPk(currentParentId);

    if (!parent) {
      break;
    }

    if (parent.status !== 'DONE') {
      await parent.update({ status: 'DONE' }, { userId });
      completedParents.push(parent.id);
    }

    // Continue rolling up to the grandparent.
    currentParentId = parent.parentId;
  }

  return completedParents;
};

module.exports = { checkAndCascadeCompletion };
