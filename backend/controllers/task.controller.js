const { sequelize, Task, User, Comment, AuditLog, Sprint } = require('../models');
const { checkAndCascadeCompletion } = require('../utils/cascadeCompletion');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const TYPES = ['Epic', 'Story', 'Task', 'Subtask'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA_TESTING', 'DONE'];

// Forward-only transitions an employee may perform on their own cards.
const EMPLOYEE_TRANSITIONS = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW'],
};

// Forward adjudication transitions reserved for Scrum Masters / Managers.
const REVIEWER_TRANSITIONS = {
  IN_REVIEW: ['QA_TESTING'],
  QA_TESTING: ['DONE'],
};

// Backward rejection transitions (handled by rejectTask).
const REJECTION_TRANSITIONS = {
  IN_REVIEW: 'IN_PROGRESS',
  QA_TESTING: 'IN_PROGRESS',
};

// Maps backend evaluation constants to the existing DB ENUM string values.
const EVALUATION_TIER = {
  POSITIVE: 'Positive',
  NEGATIVE_SIMPLE: 'Negative (Simple)',
  NEGATIVE_SERIOUS: 'Negative (Serious)',
};

// Pragmatic Parent Hierarchy — defines the legal parent type for each issue type.
// null means no parent is ever valid (Epic).
const REQUIRED_PARENT_TYPE = {
  Subtask: 'Task',
  Task: 'Story',
  Story: 'Epic',
  Epic: null,
};

const isManagerRole = (req) => req.user.systemRole === 'Admin/Manager';
const isScrumMasterContext = (req) => req.isTemporalScrumMaster === true;

const serializeTask = (task) => ({
  id: task.id,
  issueKey: task.issueKey,
  title: task.title,
  description: task.description,
  type: task.type,
  status: task.status,
  isConfidential: task.isConfidential,
  boardSortOrder: task.boardSortOrder,
  creatorId: task.creatorId,
  assigneeId: task.assigneeId,
  sprintId: task.sprintId,
  parentId: task.parentId,
  originalSprintId: task.originalSprintId ?? null,
  rolloverCount: task.rolloverCount ?? 0,
  commentCount: task.Comments ? task.Comments.length : 0,
  assignee: task.Assignee
    ? {
        id: task.Assignee.id,
        name: task.Assignee.name,
        employeeId: task.Assignee.employeeId,
      }
    : null,
  creator: task.Creator
    ? {
        id: task.Creator.id,
        name: task.Creator.name,
        employeeId: task.Creator.employeeId,
      }
    : null,
});

const reloadTaskWithAssociations = (id) =>
  Task.findByPk(id, {
    include: [
      { model: User, as: 'Assignee', attributes: ['id', 'name', 'employeeId'] },
      { model: User, as: 'Creator', attributes: ['id', 'name', 'employeeId'] },
      { model: Comment, attributes: ['id'] },
    ],
  });

/** Walk up the parent chain — true if candidateId is a descendant of ancestorId. */
const isTaskDescendantOf = async (candidateId, ancestorId) => {
  let currentId = candidateId;
  const visited = new Set();

  while (currentId) {
    if (currentId === ancestorId) return true;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const node = await Task.findByPk(currentId, { attributes: ['id', 'parentId'] });
    if (!node || !node.parentId) break;
    currentId = node.parentId;
  }

  return false;
};

/** Validate and resolve parentId for create/edit mutations. */
const resolveParentId = async (finalType, parentIdInput, { explicit = false } = {}) => {
  if (finalType === 'Epic') {
    return null;
  }

  if (finalType === 'Subtask') {
    if (!parentIdInput) {
      return {
        error: {
          status: 400,
          message: 'Subtasks must strictly link to a parent Task.',
        },
      };
    }
    const parent = await Task.findByPk(parentIdInput, { attributes: ['id', 'type'] });
    if (!parent || parent.type !== 'Task') {
      return {
        error: {
          status: 400,
          message: 'Subtasks must strictly link to a parent Task.',
        },
      };
    }
    return parentIdInput;
  }

  // Task or Story — parent optional
  if (!parentIdInput) {
    return null;
  }

  const requiredParentType = REQUIRED_PARENT_TYPE[finalType];
  const parent = await Task.findByPk(parentIdInput, { attributes: ['id', 'type'] });
  if (!parent || parent.type !== requiredParentType) {
    if (explicit) {
      return {
        error: {
          status: 400,
          message: `A ${finalType} must be nested under a ${requiredParentType} (found a ${parent?.type || 'missing parent'}).`,
        },
      };
    }
    return null;
  }

  return parentIdInput;
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tasks
// Enterprise creation gate with 4 strict validation pillars.
// ──────────────────────────────────────────────────────────────────────────────
const createIssue = async (req, res, next) => {
  try {
    const { title, description, type } = req.body;
    let { assigneeId, parentId, isConfidential, sprintId } = req.body;

    // ── Basic field validation ────────────────────────────────────────────────
    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required',
      });
    }

    if (!TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Task type must be one of: ${TYPES.join(', ')}`,
      });
    }

    const manager = isManagerRole(req);
    const scrumMaster = !manager && isScrumMasterContext(req);
    const employee = !manager && !scrumMaster;

    // ── Role-to-type gate ─────────────────────────────────────────────────────
    let allowedTypes;
    let canConfidential;

    if (manager) {
      allowedTypes = ['Epic', 'Story', 'Task', 'Subtask'];
      canConfidential = true;
    } else if (scrumMaster) {
      allowedTypes = ['Story', 'Task', 'Subtask'];
      canConfidential = false;
    } else {
      allowedTypes = ['Task', 'Subtask'];
      canConfidential = false;
    }

    if (!allowedTypes.includes(type)) {
      return res.status(403).json({
        success: false,
        message: `Your role is not permitted to create an issue of type "${type}".`,
      });
    }

    // ── PILLAR 1: The Epic Gate ───────────────────────────────────────────────
    // Only Managers can create Epics. If an assigneeId is provided it must
    // also resolve to a Manager. Epics are always root-level (no parent).
    if (type === 'Epic') {
      if (!manager) {
        return res.status(403).json({
          success: false,
          message: 'Only Managers can initialize Epics.',
        });
      }

      if (assigneeId) {
        const epicAssignee = await User.findByPk(Number(assigneeId), {
          attributes: ['id', 'systemRole'],
        });
        if (!epicAssignee) {
          return res.status(400).json({
            success: false,
            message: 'Assignee not found.',
          });
        }
        if (epicAssignee.systemRole !== 'Admin/Manager') {
          return res.status(400).json({
            success: false,
            message: 'Epics can only be assigned to Managers.',
          });
        }
      }

      parentId = null; // Epics are always root-level
    }

    // ── PILLAR 2: Downward Tenancy Gate (Assignee Isolation) ─────────────────
    // Employees can only assign to themselves.
    // SMs and Managers must stay within their own teamId.
    if (assigneeId) {
      const numericAssigneeId = Number(assigneeId);

      if (employee) {
        if (numericAssigneeId !== req.user.id) {
          return res.status(403).json({
            success: false,
            message:
              'Downward tenancy violation. Employees can only assign deliverables to themselves.',
          });
        }
      } else {
        // SM or Manager — assignee must belong to the same team.
        const targetUser = await User.findByPk(numericAssigneeId, {
          attributes: ['id', 'teamId'],
        });
        if (!targetUser) {
          return res.status(400).json({
            success: false,
            message: 'Assignee not found.',
          });
        }
        if (targetUser.teamId !== req.user.teamId) {
          return res.status(403).json({
            success: false,
            message: 'Cross-team assignment isolation violation.',
          });
        }
      }

      assigneeId = numericAssigneeId;
    } else if (employee) {
      // Employee did not provide an assigneeId — auto-assign to themselves.
      assigneeId = req.user.id;
    } else {
      assigneeId = null;
    }

    // ── PILLAR 3: Pragmatic Parent Hierarchy Gate ─────────────────────────────
    // Subtask  → parentId REQUIRED, parent.type must === 'Task'
    // Task     → parentId OPTIONAL, if given parent.type must === 'Story'
    // Story    → parentId OPTIONAL, if given parent.type must === 'Epic'
    // Epic     → parentId always null (enforced above)
    if (type === 'Subtask' && !parentId) {
      return res.status(400).json({
        success: false,
        message: 'Subtasks must strictly link to a parent Task.',
      });
    }

    if (parentId) {
      const numericParentId = Number(parentId);
      const parent = await Task.findByPk(numericParentId, {
        attributes: ['id', 'type'],
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Parent issue not found.',
        });
      }

      const requiredParentType = REQUIRED_PARENT_TYPE[type];

      if (requiredParentType && parent.type !== requiredParentType) {
        return res.status(400).json({
          success: false,
          message: `A ${type} must be nested under a ${requiredParentType} (found a ${parent.type}).`,
        });
      }

      parentId = numericParentId;
    } else {
      parentId = null;
    }

    // ── Coerce confidentiality ────────────────────────────────────────────────
    isConfidential = canConfidential ? Boolean(isConfidential) : false;
    // ── Sprint association ────────────────────────────────────────────────────
    if (parentId) {
      const parentTask = await Task.findByPk(parentId, { attributes: ['sprintId'] });
      if (parentTask) {
        sprintId = parentTask.sprintId;
      }
    } else {
      if (scrumMaster) {
        sprintId = req.activeSprint ? req.activeSprint.id : sprintId || null;
      } else if (manager) {
        sprintId = sprintId || (req.activeSprint ? req.activeSprint.id : null);
      } else {
        // Employee — honour explicit sprintId from the board URL (e.g. PENDING planning sprint).
        sprintId = sprintId ? Number(sprintId) : (req.activeSprint ? req.activeSprint.id : null);
      }
    }

    // ── PILLAR 4: Employee Sprint Planning Lock ───────────────────────────────
    // Evaluates the TARGET sprint being written to — not req.activeSprint context.
    // PENDING (planned) sprints always allow creation; ACTIVE started sprints lock employees.
    if (employee && sprintId) {
      const targetSprint = await Sprint.findByPk(Number(sprintId), {
        attributes: ['id', 'status', 'startDate'],
      });

      if (targetSprint) {
        if (targetSprint.status === 'COMPLETED') {
          return res.status(403).json({
            success: false,
            message: 'Cannot create issues in a completed sprint.',
          });
        }

        if (targetSprint.status === 'ACTIVE') {
          const todayIST = getTodayIST();
          if (targetSprint.startDate <= todayIST) {
            return res.status(403).json({
              success: false,
              message:
                'Sprint planning window is locked. Employees cannot create issues after the sprint start date.',
            });
          }
        }
        // PENDING sprints — planning mode; creation allowed regardless of startDate.
      }
    }

    // ── Create — pass { userId } so the afterCreate audit hook can attribute ──
    const task = await Task.create(
      {
        title: String(title).trim(),
        description: description || null,
        type,
        status: 'TODO',
        isConfidential,
        creatorId: req.user.id,
        assigneeId: assigneeId || null,
        sprintId: sprintId || null,
        parentId: parentId || null,
      },
      { userId: req.user.id }
    );

    const created = await reloadTaskWithAssociations(task.id);

    return res.status(201).json({
      success: true,
      message: `Issue ${task.issueKey} created successfully`,
      task: serializeTask(created),
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tasks/board[?sprintId=N]
// Nested hierarchy for a sprint + Confidentiality Engine.
// If ?sprintId=N is provided, fetches that specific sprint's board.
// Falls back to the team's active sprint (resolved by resolveActiveSprint).
// ──────────────────────────────────────────────────────────────────────────────
const getSprintBoard = async (req, res, next) => {
  try {
    const requestedSprintId = req.query?.sprintId
      ? parseInt(req.query.sprintId, 10)
      : null;

    const where = {};
    let sprintContext = req.activeSprint || null;

    if (requestedSprintId) {
      where.sprintId = requestedSprintId;
      sprintContext = await Sprint.findByPk(requestedSprintId, {
        attributes: ['id', 'name', 'startDate', 'endDate', 'status', 'teamId'],
      });

      // Team isolation: block cross-team board access
      if (sprintContext && sprintContext.teamId !== null && sprintContext.teamId !== req.user.teamId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this team\'s sprint board.',
        });
      }
    } else if (req.activeSprint) {
      where.sprintId = req.activeSprint.id;
    } else {
      where.sprintId = 0;
    }

    const tasks = await Task.findAll({
      where,
      include: [
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'employeeId'] },
        { model: User, as: 'Creator', attributes: ['id', 'name', 'employeeId'] },
        { model: Comment, attributes: ['id'] },
      ],
      order: [
        ['parentId', 'ASC'],
        ['boardSortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    // Confidentiality Engine — strip tasks the requester is not permitted to view.
    const canSee = (task) =>
      !task.isConfidential ||
      req.user.systemRole === 'Admin/Manager' ||
      req.user.id === task.assigneeId;

    const visibleTasks = tasks.filter(canSee);
    const flat = visibleTasks.map(serializeTask);

    // Build nested hierarchy (Epic → Story → Task → Subtask).
    const nodeMap = new Map();
    flat.forEach((task) => {
      nodeMap.set(task.id, { ...task, children: [] });
    });

    const board = [];
    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId).children.push(node);
      } else {
        board.push(node);
      }
    });

    return res.status(200).json({
      success: true,
      sprint: sprintContext
        ? {
            id: sprintContext.id,
            name: sprintContext.name,
            startDate: sprintContext.startDate,
            endDate: sprintContext.endDate,
            status: sprintContext.status || null,
          }
        : null,
      isTemporalScrumMaster: req.isTemporalScrumMaster === true,
      count: flat.length,
      board,
      tasks: flat,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tasks/:id/status
// Forward-only state machine with role gating + cascade on DONE.
// ──────────────────────────────────────────────────────────────────────────────
const updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (req.activeSprint && req.activeSprint.status === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Cannot move tasks until the sprint officially starts.',
      });
    }

    if (!STATUSES.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${STATUSES.join(', ')}`,
      });
    }

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // ── Sprint Lifecycle Freeze ───────────────────────────────────────────────
    // Look up the task's own sprint directly rather than relying on
    // req.activeSprint. resolveActiveSprint only resolves sprints whose
    // date window has already opened, so a PENDING sprint with a future
    // startDate would leave req.activeSprint null and bypass the guard.
    // COMPLETED sprints are also blocked — the board becomes a read-only archive.
    if (task.sprintId) {
      const taskSprint = await Sprint.findByPk(task.sprintId, {
        attributes: ['id', 'status', 'teamId'],
      });
      if (taskSprint) {
        if (taskSprint.teamId !== null && taskSprint.teamId !== req.user.teamId) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this team's tasks.",
          });
        }
        if (taskSprint.status === 'PENDING') {
          return res.status(403).json({
            success: false,
            message: 'Cannot move tasks until the sprint officially starts.',
          });
        }
        if (taskSprint.status === 'COMPLETED') {
          return res.status(403).json({
            success: false,
            message: 'This sprint has been completed. The board is now a read-only archive.',
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const fromStatus = task.status;
    const manager = isManagerRole(req);
    const scrumMaster = !manager && isScrumMasterContext(req);
    const elevated = manager || scrumMaster;

    let allowed = false;

    if (elevated) {
      const reviewerTargets = REVIEWER_TRANSITIONS[fromStatus] || [];
      const employeeTargets = EMPLOYEE_TRANSITIONS[fromStatus] || [];
      allowed =
        reviewerTargets.includes(newStatus) ||
        employeeTargets.includes(newStatus);
    } else {
      // Employee — must own the card and follow forward-only transitions.
      if (task.assigneeId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only move tasks assigned to you.',
        });
      }
      const employeeTargets = EMPLOYEE_TRANSITIONS[fromStatus] || [];
      allowed = employeeTargets.includes(newStatus);
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Transition ${fromStatus} → ${newStatus} is not permitted for your role.`,
      });
    }

    await task.update({ status: newStatus }, { userId: req.user.id });

    let cascadedParents = [];
    if (newStatus === 'DONE' && task.parentId) {
      cascadedParents = await checkAndCascadeCompletion(task.parentId, req.user.id);
    }

    const updated = await reloadTaskWithAssociations(task.id);

    return res.status(200).json({
      success: true,
      message: `Task ${task.issueKey} moved to ${newStatus}`,
      task: serializeTask(updated),
      cascadedParents,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tasks/:id/reject
// SM/Manager rejection — moves card backward + auto negative Comment.
// ──────────────────────────────────────────────────────────────────────────────
const rejectTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (req.activeSprint && req.activeSprint.status === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Cannot move tasks until the sprint officially starts.',
      });
    }

    const manager = isManagerRole(req);
    const scrumMaster = !manager && isScrumMasterContext(req);

    if (!manager && !scrumMaster) {
      return res.status(403).json({
        success: false,
        message: 'Only a Scrum Master or Manager may reject a task.',
      });
    }

    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required.',
      });
    }

    const task = await Task.findByPk(id);

    // ── Post-Sprint Archive Freeze ────────────────────────────────────────────
    // req.activeSprint resolves the *current* team sprint, NOT the sprint being
    // viewed (e.g., a completed sprint opened via ?sprintId=N). We must look up
    // the task's own sprint to correctly block completed-sprint rejections.
    if (task && task.sprintId) {
      const taskSprint = await Sprint.findByPk(task.sprintId, {
        attributes: ['id', 'status', 'teamId'],
      });
      if (taskSprint) {
        if (taskSprint.teamId !== null && taskSprint.teamId !== req.user.teamId) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this team's tasks.",
          });
        }
        if (taskSprint.status === 'COMPLETED') {
          return res.status(403).json({
            success: false,
            message: 'This sprint has been completed. The board is now a read-only archive.',
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // ── Pre-Sprint Board Freeze ───────────────────────────────────────────────
    if (task.sprintId) {
      const taskSprint = await Sprint.findByPk(task.sprintId, {
        attributes: ['id', 'status'],
      });
      if (taskSprint && taskSprint.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Cannot move tasks until the sprint officially starts.',
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const targetStatus = REJECTION_TRANSITIONS[task.status];

    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        message: `Only tasks in IN_REVIEW or QA_TESTING can be rejected (current: ${task.status}).`,
      });
    }

    await task.update({ status: targetStatus }, { userId: req.user.id });

    const comment = await Comment.create({
      taskId: task.id,
      authorId: req.user.id,
      content: `Rejected: ${String(rejectionReason).trim()}`,
      evaluationTier: EVALUATION_TIER.NEGATIVE_SIMPLE,
    });

    const updated = await reloadTaskWithAssociations(task.id);

    return res.status(200).json({
      success: true,
      message: `Task ${task.issueKey} rejected and returned to ${targetStatus}`,
      task: serializeTask(updated),
      comment: {
        id: comment.id,
        taskId: comment.taskId,
        authorId: comment.authorId,
        content: comment.content,
        evaluationTier: comment.evaluationTier,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tasks/:id
// Surgical field-level edit. Immutable columns are stripped server-side.
// ──────────────────────────────────────────────────────────────────────────────
const editIssue = async (req, res, next) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.sprintId) {
      const taskSprint = await Sprint.findByPk(task.sprintId, { attributes: ['teamId'] });
      if (taskSprint && taskSprint.teamId !== null && taskSprint.teamId !== req.user.teamId) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this team's tasks.",
        });
      }
    }

    const manager = isManagerRole(req);
    const scrumMaster = !manager && isScrumMasterContext(req);
    const employee = !manager && !scrumMaster;

    // ── RBAC Edit Gate ────────────────────────────────────────────────────────
    if (employee) {
      const isCreator = task.creatorId === req.user.id;
      const isAssignee = task.assigneeId === req.user.id;
      if (!isCreator && !isAssignee) {
        return res.status(403).json({
          success: false,
          message:
            'Employees may only edit issues they created or are assigned to.',
        });
      }
    }

    // ── Safe Mutation ─────────────────────────────────────────────────────────
    // issueKey, sprintId, creatorId are immutable.
    const { title, description, type, assigneeId, parentId, isConfidential } = req.body;

    const sanitized = {};

    if (title !== undefined) {
      const trimmed = String(title).trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
      }
      sanitized.title = trimmed;
    }

    if (description !== undefined) {
      sanitized.description = description || null;
    }

    if (type !== undefined) {
      if (!TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `type must be one of: ${TYPES.join(', ')}`,
        });
      }
      sanitized.type = type;
    }

    if (assigneeId !== undefined) {
      sanitized.assigneeId = assigneeId ? Number(assigneeId) : null;
    }

    if (isConfidential !== undefined && manager) {
      sanitized.isConfidential = Boolean(isConfidential);
    }

    const finalType = sanitized.type ?? task.type;
    const parentExplicit = parentId !== undefined;
    const typeChanged = sanitized.type !== undefined && sanitized.type !== task.type;

    if (parentExplicit || typeChanged) {
      let newParentId = parentExplicit
        ? (parentId ? Number(parentId) : null)
        : task.parentId;

      const resolved = await resolveParentId(finalType, newParentId, {
        explicit: parentExplicit,
      });

      if (resolved && resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          message: resolved.error.message,
        });
      }

      newParentId = resolved;

      if (newParentId === task.id) {
        return res.status(400).json({
          success: false,
          message: 'An issue cannot be its own parent.',
        });
      }

      if (newParentId && (await isTaskDescendantOf(newParentId, task.id))) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign a descendant issue as the parent.',
        });
      }

      sanitized.parentId = newParentId;
    }

    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No mutable fields were provided (title, description, type, assigneeId, parentId, isConfidential).',
      });
    }

    // Pass userId so the afterUpdate audit hook records the acting user.
    await task.update(sanitized, { userId: req.user.id });

    const updated = await reloadTaskWithAssociations(task.id);

    return res.status(200).json({
      success: true,
      message: `Issue ${task.issueKey} updated successfully`,
      task: serializeTask(updated),
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/tasks/:id
// Recursively gathers all descendant IDs then vaporizes the entire hierarchy
// inside a single atomic transaction.
// ──────────────────────────────────────────────────────────────────────────────
const deleteIssue = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const rootId = parseInt(req.params.id, 10);

    const target = await Task.findByPk(rootId, { transaction: t });
    if (!target) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (target.sprintId) {
      const taskSprint = await Sprint.findByPk(target.sprintId, { transaction: t, attributes: ['teamId'] });
      if (taskSprint && taskSprint.teamId !== null && taskSprint.teamId !== req.user.teamId) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "You do not have access to this team's tasks.",
        });
      }
    }

    // ── RBAC Delete Gate ──────────────────────────────────────────────────────
    const manager = isManagerRole(req);
    const scrumMaster = !manager && isScrumMasterContext(req);
    const employee = !manager && !scrumMaster;

    if (employee && target.creatorId !== req.user.id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message:
          'Employees are strictly restricted to deleting self-initialized deliverables.',
      });
    }

    // ── Recursive Descendant-Gathering Algorithm ──────────────────────────────
    // Collects all descendant task IDs via BFS so the entire hierarchy can be
    // vaporized atomically. idsToDelete begins with the root and accumulates
    // child → grandchild → … levels as gatherChildren recurses.
    const idsToDelete = [rootId];

    const gatherChildren = async (parentIds) => {
      const children = await Task.findAll({
        where: { parentId: parentIds },
        attributes: ['id'],
        transaction: t,
      });
      if (children.length > 0) {
        const childIds = children.map((c) => c.id);
        idsToDelete.push(...childIds);
        await gatherChildren(childIds);
      }
    };

    await gatherChildren([rootId]);

    // ── Preserve immutable audit history ─────────────────────────────────────
    // Detach CREATE/UPDATE logs from the tasks about to be destroyed.
    // Never delete audit rows — the ledger must retain the full sprint timeline.
    if (AuditLog) {
      await AuditLog.update(
        { taskId: null },
        { where: { taskId: idsToDelete }, transaction: t }
      );
    }

    // Comments are ephemeral — safe to remove with the task hierarchy.
    await Comment.destroy({ where: { taskId: idsToDelete }, transaction: t });

    // ── Vaporize the hierarchy ─────────────────────────────────────────────────
    // individualHooks: true ensures afterDestroy fires per task, writing
    // immutable DELETE audit entries for every destroyed node.
    // FK checks are disabled so the bulk IN() deletion can proceed in any order
    // without violating the self-referential parent_id constraint.
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });
    await Task.destroy({
      where: { id: idsToDelete },
      transaction: t,
      individualHooks: true,
      userId: req.user.id,
    });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: `Hierarchy vaporized: ${idsToDelete.length} issue(s) permanently deleted`,
      deletedIds: idsToDelete,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tasks/bulk-adjudicate
// Multi-select bulk Approve / Reject for cards in IN_REVIEW or QA_TESTING.
//
// RACE CONDITION SAFETY:
// If several selected cards share the same parent, updating them concurrently
// (e.g. via Promise.all) would cause multiple connections to UPDATE the same
// parent row at nearly the same millisecond — a classic MySQL deadlock, and a
// window where the parent can fail to roll up to DONE even though every child
// finished. To eliminate this:
//   1. The whole operation runs inside ONE sequelize.transaction().
//   2. taskIds are processed with a sequential `for...of` loop — NEVER
//      Promise.all — so only one task (and therefore one parent-cascade walk)
//      is ever being written at a time.
//   3. Each task row is pulled with a row-level lock (`t.LOCK.UPDATE`) inside
//      the transaction, serializing any other concurrent bulk request that
//      might target the same rows.
//   4. checkAndCascadeCompletion() receives the same transaction object, so
//      the parent/grandparent rollup for task N fully commits (within the
//      transaction) before task N+1 is even read — the cascade always sees
//      the truthful, up-to-date sibling state.
// ──────────────────────────────────────────────────────────────────────────────
const bulkAdjudicate = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { taskIds, action, comment } = req.body;

    // ── RBAC Guard — strictly Manager or active Scrum Master ─────────────────
    const manager = isManagerRole(req);
    const scrumMaster = !manager && isScrumMasterContext(req);

    if (!manager && !scrumMaster) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only a Scrum Master or Manager may bulk-adjudicate tasks.',
      });
    }

    // ── Payload validation ────────────────────────────────────────────────────
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'taskIds must be a non-empty array.',
      });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "action must be either 'APPROVE' or 'REJECT'.",
      });
    }

    if (action === 'REJECT' && (!comment || !String(comment).trim())) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'A mandatory rejection comment is required for bulk reject.',
      });
    }

    const results = [];
    const skipped = [];

    // ── Sequential processing — CRITICAL: for...of, never Promise.all ───────
    for (const rawId of taskIds) {
      const taskId = parseInt(rawId, 10);

      if (Number.isNaN(taskId)) {
        skipped.push({ taskId: rawId, reason: 'Invalid task id.' });
        continue;
      }

      // Row-level lock (SELECT ... FOR UPDATE) — serializes any concurrent
      // bulk request that might touch this exact row inside the transaction.
      const task = await Task.findByPk(taskId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!task) {
        skipped.push({ taskId, reason: 'Task not found.' });
        continue;
      }

      // ── Team isolation + sprint lifecycle guard (mirrors updateTaskStatus) ──
      if (task.sprintId) {
        const taskSprint = await Sprint.findByPk(task.sprintId, {
          attributes: ['id', 'status', 'teamId'],
          transaction: t,
        });

        if (taskSprint) {
          if (taskSprint.teamId !== null && taskSprint.teamId !== req.user.teamId) {
            skipped.push({
              taskId,
              issueKey: task.issueKey,
              reason: "No access to this team's tasks.",
            });
            continue;
          }
          if (taskSprint.status === 'PENDING' || taskSprint.status === 'COMPLETED') {
            skipped.push({
              taskId,
              issueKey: task.issueKey,
              reason: 'Sprint is not in an active, movable state.',
            });
            continue;
          }
        }
      }

      const fromStatus = task.status;

      if (fromStatus !== 'IN_REVIEW' && fromStatus !== 'QA_TESTING') {
        skipped.push({
          taskId,
          issueKey: task.issueKey,
          reason: `Task is in ${fromStatus}, not eligible for adjudication.`,
        });
        continue;
      }

      if (action === 'APPROVE') {
        // REVIEWER_TRANSITIONS[fromStatus] is always a single-entry array:
        // IN_REVIEW → [QA_TESTING], QA_TESTING → [DONE].
        const toStatus = REVIEWER_TRANSITIONS[fromStatus][0];

        await task.update({ status: toStatus }, { userId: req.user.id, transaction: t });

        // Trigger the existing hierarchy cascade — transaction-scoped so the
        // parent/grandparent rollup for THIS task fully resolves before the
        // next taskId in the loop is even read.
        if (toStatus === 'DONE' && task.parentId) {
          await checkAndCascadeCompletion(task.parentId, req.user.id, { transaction: t });
        }

        results.push({ taskId: task.id, issueKey: task.issueKey, fromStatus, toStatus });
      } else {
        // REJECT — always bounces back to IN_PROGRESS (REJECTION_TRANSITIONS).
        const toStatus = REJECTION_TRANSITIONS[fromStatus];

        await task.update({ status: toStatus }, { userId: req.user.id, transaction: t });

        // Module 6 audit trail — one comment per rejected card, same bulk reason.
        await Comment.create(
          {
            taskId: task.id,
            authorId: req.user.id,
            content: `Rejected (bulk): ${String(comment).trim()}`,
            evaluationTier: EVALUATION_TIER.NEGATIVE_SIMPLE,
          },
          { transaction: t }
        );

        results.push({ taskId: task.id, issueKey: task.issueKey, fromStatus, toStatus });
      }
    }

    if (results.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'No eligible tasks were adjudicated.',
        skipped,
      });
    }

    await t.commit();

    return res.status(200).json({
      success: true,
      message: `${results.length} task(s) ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
      processed: results.length,
      results,
      skipped,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

module.exports = {
  createIssue,
  getSprintBoard,
  updateTaskStatus,
  rejectTask,
  editIssue,
  deleteIssue,
  bulkAdjudicate,
};
