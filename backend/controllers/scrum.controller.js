const { Op } = require('sequelize');
const { User, AttendanceRecord } = require('../models');

const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const formatAttendanceRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    date: record.date,
    status: record.status,
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime,
    checkInLat: record.checkInLat,
    checkInLng: record.checkInLng,
    workHours: record.workHours,
    isActiveSession: record.isActiveSession,
    isStandupLocked: record.isStandupLocked,
    standupWorkedOn: record.standupWorkedOn,
    standupPlan: record.standupPlan,
    standupBlockers: record.standupBlockers,
  };
};

const formatActiveSprint = (req) => {
  if (!req.activeSprint) {
    return null;
  }

  return {
    id: req.activeSprint.id,
    name: req.activeSprint.name,
    startDate: req.activeSprint.startDate,
    endDate: req.activeSprint.endDate,
  };
};

const getPendingWFH = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();
    const scrumMasterTeamId = req.user.teamId;

    if (scrumMasterTeamId === null || scrumMasterTeamId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Scrum Master is not assigned to a team',
      });
    }

    const pendingRecords = await AttendanceRecord.findAll({
      where: {
        status: 'WFH_PENDING',
        date: todayIST,
      },
      include: [
        {
          model: User,
          as: 'Employee',
          where: { teamId: scrumMasterTeamId },
          attributes: ['id', 'employeeId', 'name', 'email', 'teamId'],
        },
      ],
      order: [['checkInTime', 'ASC']],
    });

    const queue = pendingRecords.map((record) => ({
      recordId: record.id,
      employeeId: record.Employee.employeeId,
      employeeName: record.Employee.name,
      email: record.Employee.email,
      teamId: record.Employee.teamId,
      checkInTime: record.checkInTime,
      checkInLat: record.checkInLat,
      checkInLng: record.checkInLng,
      status: record.status,
      date: record.date,
    }));

    return res.status(200).json({
      success: true,
      sprintId: req.activeSprintId,
      activeSprint: formatActiveSprint(req),
      date: todayIST,
      count: queue.length,
      queue,
    });
  } catch (error) {
    next(error);
  }
};

const adjudicateWFH = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const { newStatus, userId } = req.body;
    const scrumMasterTeamId = req.user.teamId;

    const isManager = req.user.systemRole === 'Admin/Manager';
    let isSM = false;
    if (req.activeSprint) {
      isSM = req.activeSprint.scrumMasterId === req.user.id;
    } else {
      const { Sprint } = require('../models');
      const todayIST = getTodayIST();
      const activeSprint = await Sprint.findOne({
        where: {
          teamId: req.user.teamId,
          startDate: { [Op.lte]: todayIST },
          endDate: { [Op.gte]: todayIST },
          status: { [Op.ne]: 'COMPLETED' },
        },
      });
      isSM = activeSprint && activeSprint.scrumMasterId === req.user.id;
    }

    if (!isManager && !isSM) {
      return res.status(403).json({
        success: false,
        message: 'Only Scrum Masters or Managers can adjudicate attendance.',
      });
    }

    const ALLOWED_STATUSES = ['PRESENT_OFFICE', 'WFH_APPROVED', 'ABSENT'];
    if (!ALLOWED_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `newStatus must be one of: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    let record;
    if (recordId && recordId !== '0' && recordId !== 'null' && recordId !== 'undefined') {
      record = await AttendanceRecord.findByPk(recordId, {
        include: [
          {
            model: User,
            as: 'Employee',
            attributes: ['id', 'employeeId', 'name', 'email', 'teamId'],
          },
        ],
      });
    }

    // Pre-emptive daily record lookup/creation for users who have not punched in yet
    if (!record) {
      const targetUserId = userId;
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'Record ID or target userId is required.',
        });
      }

      const employee = await User.findByPk(targetUserId, {
        attributes: ['id', 'employeeId', 'name', 'email', 'teamId'],
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found.',
        });
      }

      const todayIST = getTodayIST();
      const [r] = await AttendanceRecord.findOrCreate({
        where: { userId: targetUserId, date: todayIST },
        defaults: {
          status: 'WFH_PENDING',
          workHours: 0.0,
          isActiveSession: false,
          isStandupLocked: false,
        },
      });

      record = r;
      record.Employee = employee;
    }

    if (record.Employee.teamId !== scrumMasterTeamId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot adjudicate attendance for users outside your team',
      });
    }

    const previousStatus = record.status;
    
    // Map PRESENT_OFFICE/WFH_APPROVED to WFH_APPROVED if original status was WFH_PENDING (legacy compatibility)
    let resolvedStatus = newStatus;
    if (record.status === 'WFH_PENDING' && (newStatus === 'PRESENT_OFFICE' || newStatus === 'WFH_APPROVED')) {
      resolvedStatus = 'WFH_APPROVED';
    }

    const isAbsent = resolvedStatus === 'ABSENT';

    let finalWorkHours = record.workHours;
    let finalCheckOutTime = record.checkOutTime;

    if (isAbsent) {
      if (record.isActiveSession && record.lastResumeTime) {
        const now = new Date();
        const chunkMs = now.getTime() - new Date(record.lastResumeTime).getTime();
        const chunkHours = chunkMs / (1000 * 60 * 60);
        finalWorkHours = parseFloat((parseFloat(record.workHours || 0) + chunkHours).toFixed(2));
        finalCheckOutTime = now;
      }
    }

    await record.update({
      status: resolvedStatus,
      adjudicatedBy: req.user.id,
      isStandupLocked: isAbsent,
      isActiveSession: isAbsent ? false : record.isActiveSession,
      workHours: finalWorkHours,
      checkOutTime: finalCheckOutTime,
    });

    return res.status(200).json({
      success: true,
      message: `Attendance record adjudicated to ${resolvedStatus}`,
      record: {
        recordId: record.id,
        employeeId: record.Employee.employeeId,
        employeeName: record.Employee.name,
        previousStatus,
        newStatus: record.status,
        date: record.date,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTeamMatrix = async (req, res, next) => {
  try {
    const todayIST = getTodayIST();
    const scrumMasterTeamId = req.user.teamId;

    if (scrumMasterTeamId === null || scrumMasterTeamId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Scrum Master is not assigned to a team',
      });
    }

    const teamMembers = await User.findAll({
      where: { teamId: scrumMasterTeamId },
      attributes: ['id', 'employeeId', 'name', 'email', 'teamId', 'systemRole'],
      include: [
        {
          model: AttendanceRecord,
          as: 'AttendanceRecords',
          required: false,
          where: { date: todayIST },
        },
      ],
      order: [['name', 'ASC']],
    });

    const matrix = teamMembers.map((member) => {
      const todayRecord =
        member.AttendanceRecords && member.AttendanceRecords.length > 0
          ? member.AttendanceRecords[0]
          : null;

      return {
        userId: member.id,
        employeeId: member.employeeId,
        name: member.name,
        email: member.email,
        teamId: member.teamId,
        systemRole: member.systemRole,
        todayStatus: todayRecord ? todayRecord.status : 'ABSENT',
        workHours: todayRecord ? parseFloat(todayRecord.workHours) : 0,
        isStandupLocked: todayRecord ? todayRecord.isStandupLocked : false,
        isShiftLocked: todayRecord ? todayRecord.isStandupLocked : false,
        isActiveSession: todayRecord ? todayRecord.isActiveSession : false,
        checkInTime: todayRecord ? todayRecord.checkInTime : null,
        standupBlockers: todayRecord ? todayRecord.standupBlockers : null,
        attendance: formatAttendanceRecord(todayRecord),
      };
    });

    const summary = {
      totalMembers: matrix.length,
      presentOffice: matrix.filter((row) => row.todayStatus === 'PRESENT_OFFICE')
        .length,
      wfhApproved: matrix.filter((row) => row.todayStatus === 'WFH_APPROVED')
        .length,
      wfhPending: matrix.filter((row) => row.todayStatus === 'WFH_PENDING').length,
      absent: matrix.filter((row) => row.todayStatus === 'ABSENT').length,
      standupLocked: matrix.filter((row) => row.isStandupLocked).length,
    };

    return res.status(200).json({
      success: true,
      sprintId: req.activeSprintId,
      activeSprint: formatActiveSprint(req),
      date: todayIST,
      summary,
      matrix,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingWFH,
  adjudicateWFH,
  getTeamMatrix,
};
