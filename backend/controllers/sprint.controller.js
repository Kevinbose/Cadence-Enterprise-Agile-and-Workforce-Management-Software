const { Op } = require('sequelize');
const { Sprint, User } = require('../models');
const { safeExecuteRollover } = require('../utils/sprintRollover');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ─── Shared association include for ScrumMaster details ──────────────────────
const SCRUM_MASTER_INCLUDE = {
  model: User,
  as: 'ScrumMaster',
  attributes: ['id', 'name', 'employeeId', 'systemRole'],
  required: false,
};

// ─── Internal helper: auto-complete any ACTIVE sprint for a specific team ─────
// teamId is mandatory — never sweep another team's sprint.
const autoCompleteActive = async (teamId, excludeId = null) => {
  const where = { status: 'ACTIVE', teamId };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const active = await Sprint.findOne({ where });
  if (active) {
    await active.update({ status: 'COMPLETED' });
    return active;
  }
  return null;
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/sprints
// Returns sprints for the requesting user's team, ordered by startDate DESC.
//
// JIT Evaluation Engine — runs on every call before returning data:
//   • ACTIVE sprint whose endDate < today  → auto-transition to COMPLETED
//   • PENDING sprint whose startDate <= today AND endDate >= today
//     → auto-transition to ACTIVE (the most recently started one wins;
//       any pre-existing ACTIVE sprint for this team is first completed)
// ──────────────────────────────────────────────────────────────────────────────
const getAllSprints = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();
    const teamId = req.user.teamId;

    // ── Step 1: Complete ACTIVE sprints (this team only) whose window has closed
    const rawSprints = await Sprint.findAll({
      where: { teamId },
      order: [['startDate', 'ASC']],
    });

    for (const s of rawSprints) {
      if (s.status === 'ACTIVE' && s.endDate < todayIST) {
        await s.update({ status: 'COMPLETED' });
      }
    }

    // ── Step 2: Activate PENDING sprints whose window is now open
    const pendingToActivate = rawSprints
      .filter((s) => s.status === 'PENDING' && s.startDate <= todayIST && s.endDate >= todayIST)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    if (pendingToActivate.length > 0) {
      await autoCompleteActive(teamId);
      const activated = pendingToActivate[0];
      await activated.update({ status: 'ACTIVE' });

      for (const s of pendingToActivate.slice(1)) {
        await s.update({ status: 'COMPLETED' });
      }

      // JIT auto-activation just fired → carry forward limbo tasks.
      // Automated (GET) path: system-user attribution, non-fatal on failure.
      await safeExecuteRollover(activated);
    }

    // ── Step 3: Return only this team's sprints
    const sprints = await Sprint.findAll({
      where: { teamId },
      include: [SCRUM_MASTER_INCLUDE],
      order: [['startDate', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      sprints: sprints.map((s) => s.get({ plain: true })),
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/sprints
// Creates a PENDING sprint for the manager's own team. Manager-only.
// Body: { name, startDate, endDate }
// ──────────────────────────────────────────────────────────────────────────────
const createSprint = async (req, res, next) => {
  try {
    if (req.user.systemRole !== 'Admin/Manager') {
      return res.status(403).json({
        success: false,
        message: 'Only Managers can create sprints.',
      });
    }

    const { name, startDate, endDate } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Sprint name is required.' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required.' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'endDate must be after startDate.' });
    }

    const sprint = await Sprint.create({
      name: String(name).trim(),
      startDate,
      endDate,
      status: 'PENDING',
      teamId: req.user.teamId,      // team isolation
    });

    const created = await Sprint.findByPk(sprint.id, { include: [SCRUM_MASTER_INCLUDE] });

    return res.status(201).json({
      success: true,
      message: `Sprint "${sprint.name}" created successfully.`,
      sprint: created.get({ plain: true }),
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/sprints/:id/start  —  "Force Start Now" override
// Manager-only. Only PENDING sprints belonging to the manager's team.
// ──────────────────────────────────────────────────────────────────────────────
const startSprint = async (req, res, next) => {
  try {
    if (req.user.systemRole !== 'Admin/Manager') {
      return res.status(403).json({
        success: false,
        message: 'Only Managers can start sprints.',
      });
    }

    const sprint = await Sprint.findByPk(req.params.id, { include: [SCRUM_MASTER_INCLUDE] });
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found.' });
    }

    // Team isolation: manager can only start their own team's sprints
    if (sprint.teamId !== req.user.teamId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this team\'s sprint.',
      });
    }

    if (sprint.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Only PENDING sprints can be force-started. This sprint is currently ${sprint.status}.`,
      });
    }

    const todayIST = getTodayIST();

    // Enforce single-active-per-team constraint.
    await autoCompleteActive(req.user.teamId, sprint.id);

    await sprint.update({ startDate: todayIST, status: 'ACTIVE' });

    // Force Start → migrate incomplete tasks from the team's completed sprints.
    // Manager-initiated action: attribute the rollover to the acting manager.
    await safeExecuteRollover(sprint, { systemUserId: req.user.id });

    const updated = await Sprint.findByPk(sprint.id, { include: [SCRUM_MASTER_INCLUDE] });

    return res.status(200).json({
      success: true,
      message: `Sprint "${sprint.name}" force-started. Start date set to ${todayIST}.`,
      sprint: updated.get({ plain: true }),
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/sprints/:id/scrummaster
// Assigns or replaces the Scrum Master for a sprint. Manager-only.
// Body: { scrumMasterId }
// ──────────────────────────────────────────────────────────────────────────────
const assignScrumMaster = async (req, res, next) => {
  try {
    if (req.user.systemRole !== 'Admin/Manager') {
      return res.status(403).json({
        success: false,
        message: 'Only Managers can assign Scrum Masters.',
      });
    }

    const sprint = await Sprint.findByPk(req.params.id);
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found.' });
    }

    if (sprint.teamId !== req.user.teamId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this team\'s sprint.',
      });
    }

    const { scrumMasterId } = req.body;
    if (!scrumMasterId) {
      return res.status(400).json({ success: false, message: 'scrumMasterId is required.' });
    }

    const candidate = await User.findByPk(Number(scrumMasterId), {
      attributes: ['id', 'name', 'systemRole'],
    });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await sprint.update({ scrumMasterId: candidate.id });

    const updated = await Sprint.findByPk(sprint.id, { include: [SCRUM_MASTER_INCLUDE] });

    return res.status(200).json({
      success: true,
      message: `${candidate.name} assigned as Scrum Master for "${sprint.name}".`,
      sprint: updated.get({ plain: true }),
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/sprints/:id/edit
// Updates sprint metadata. Manager-only. PENDING and ACTIVE sprints only.
// Body: { name, startDate, endDate }
// ──────────────────────────────────────────────────────────────────────────────
const editSprint = async (req, res, next) => {
  try {
    if (req.user.systemRole !== 'Admin/Manager') {
      return res.status(403).json({
        success: false,
        message: 'Only Managers can edit sprints.',
      });
    }

    const sprint = await Sprint.findByPk(req.params.id);
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found.' });
    }

    if (sprint.teamId !== req.user.teamId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this team\'s sprint.',
      });
    }

    if (sprint.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Completed sprints cannot be edited.',
      });
    }

    if (sprint.status !== 'PENDING' && sprint.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Only PENDING or ACTIVE sprints can be edited.',
      });
    }

    const { name, startDate, endDate } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Sprint name is required.' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required.' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'endDate must be after startDate.' });
    }

    const todayIST = getTodayIST();
    let newStatus = sprint.status;
    // Track a genuine PENDING → ACTIVE transition so rollover fires ONLY on the
    // activation branch, never on the COMPLETE branch (EC-NEW-9).
    let didActivate = false;

    if (endDate < todayIST) {
      newStatus = 'COMPLETED';
    } else if (sprint.status === 'PENDING' && startDate <= todayIST && endDate >= todayIST) {
      await autoCompleteActive(sprint.teamId, sprint.id);
      newStatus = 'ACTIVE';
      didActivate = true;
    }

    await sprint.update({
      name: String(name).trim(),
      startDate,
      endDate,
      status: newStatus,
    });

    // editSprint's silent JIT activation path must also roll over limbo tasks,
    // otherwise a manager could sidestep Force Start by editing dates (EC-1).
    if (didActivate) {
      await safeExecuteRollover(sprint, { systemUserId: req.user.id });
    }

    const updated = await Sprint.findByPk(sprint.id, { include: [SCRUM_MASTER_INCLUDE] });

    return res.status(200).json({
      success: true,
      message: `Sprint "${updated.name}" updated successfully.`,
      sprint: updated.get({ plain: true }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSprints,
  createSprint,
  startSprint,
  assignScrumMaster,
  editSprint,
};
