import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { fetchBoard } from '../features/kanban/kanbanSlice';
import { fetchTodayStatus } from '../features/attendance/attendanceSlice';
import {
  LayoutGrid,
  ListChecks,
  BarChart3,
  CalendarDays,
  ArrowUpRight,
  Clock,
  Loader2,
  CircleDot,
  LogIn,
  ClipboardList,
} from 'lucide-react';

const STATUS_LABEL = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  QA_TESTING: 'QA / Testing',
  DONE: 'Done',
};

const STATUS_BADGE = {
  TODO: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-[#DEEBFF] text-[#0747A6]',
  IN_REVIEW: 'bg-purple-100 text-purple-700',
  QA_TESTING: 'bg-amber-100 text-amber-700',
  DONE: 'bg-[#E3FCEF] text-[#006644]',
};

const TYPE_LOZENGE = {
  Epic: 'bg-[#EAE6FF] text-[#5243AA]',
  Story: 'bg-[#E3FCEF] text-[#006644]',
  Task: 'bg-[#DEEBFF] text-[#0747A6]',
  Subtask: 'bg-[#DFE1E6] text-[#42526E]',
};

const formatAttendanceStatus = (record) => {
  if (!record?.checkInTime && record?.status === 'ABSENT') {
    return { label: 'Not Clocked In', sub: 'Punch in to start your shift' };
  }
  if (!record) {
    return { label: 'Not Clocked In', sub: 'Punch in to start your shift' };
  }

  const map = {
    PRESENT_OFFICE: { label: 'Office', sub: 'Geofence verified' },
    WFH_APPROVED: { label: 'WFH Approved', sub: 'Remote shift active' },
    WFH_PENDING: { label: 'WFH Pending', sub: 'Awaiting manager approval' },
    ABSENT: { label: 'Absent', sub: 'No punch recorded today' },
  };

  return map[record.status] || { label: record.status, sub: 'Attendance record' };
};

const calcLiveWorkHours = (record) => {
  if (!record) return 0;
  let total = parseFloat(record.workHours || 0);
  if (record.isActiveSession && record.lastResumeTime) {
    total +=
      (Date.now() - new Date(record.lastResumeTime).getTime()) / 3600000;
  }
  return Math.max(0, total);
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatTime = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const EmployeeDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { todayRecord, isLoading: attendanceLoading } = useSelector(
    (state) => state.attendance
  );
  const { flatTasks, sprint, isLoading: boardLoading } = useSelector(
    (state) => state.kanban
  );

  const [liveHours, setLiveHours] = useState(0);

  useEffect(() => {
    dispatch(fetchBoard());
    dispatch(fetchTodayStatus());
  }, [dispatch]);

  /* Live hours ticker — mirrors GlobalHeaderPunch accumulator math */
  useEffect(() => {
    if (!todayRecord) {
      setLiveHours(0);
      return undefined;
    }

    const tick = () => setLiveHours(calcLiveWorkHours(todayRecord));
    tick();

    if (!todayRecord.isActiveSession) return undefined;

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  const myTasks = useMemo(
    () => flatTasks.filter((t) => t.assigneeId === user?.id),
    [flatTasks, user?.id]
  );

  const activeTaskCount = myTasks.filter((t) => t.status !== 'DONE').length;
  const myDoneCount = myTasks.filter((t) => t.status === 'DONE').length;

  const sprintDoneCount = flatTasks.filter((t) => t.status === 'DONE').length;
  const sprintProgress =
    sprint && flatTasks.length > 0
      ? `${Math.round((sprintDoneCount / flatTasks.length) * 100)}%`
      : sprint
        ? '0%'
        : '—';

  const myProgress =
    myTasks.length > 0
      ? `${Math.round((myDoneCount / myTasks.length) * 100)}%`
      : '0%';

  const attendance = formatAttendanceStatus(todayRecord);

  const myTasksByStatus = useMemo(() => {
    const groups = {};
    myTasks.forEach((t) => {
      groups[t.status] = (groups[t.status] || 0) + 1;
    });
    return groups;
  }, [myTasks]);

  const priorityTasks = useMemo(() => {
    const order = ['IN_PROGRESS', 'IN_REVIEW', 'QA_TESTING', 'TODO', 'DONE'];
    return [...myTasks]
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
      .slice(0, 6);
  }, [myTasks]);

  const activityEvents = useMemo(() => {
    const events = [];

    if (todayRecord?.checkInTime) {
      events.push({
        id: 'punch-in',
        icon: LogIn,
        colour: 'text-[#36A15D]',
        bg: 'bg-[#E3FCEF]',
        title: 'Shift started',
        detail: formatTime(todayRecord.checkInTime),
        time: todayRecord.checkInTime,
      });
    }

    if (todayRecord?.isStandupLocked && todayRecord?.standupWorkedOn) {
      events.push({
        id: 'standup',
        icon: ClipboardList,
        colour: 'text-[#0747A6]',
        bg: 'bg-[#DEEBFF]',
        title: 'End-of-day standup submitted',
        detail: todayRecord.standupWorkedOn.slice(0, 80) +
          (todayRecord.standupWorkedOn.length > 80 ? '…' : ''),
        time: todayRecord.checkOutTime || todayRecord.updatedAt,
      });
    }

    priorityTasks
      .filter((t) => t.status !== 'TODO')
      .forEach((t) => {
        events.push({
          id: `task-${t.id}`,
          icon: CircleDot,
          colour: 'text-[#6554C0]',
          bg: 'bg-[#EAE6FF]',
          title: `${t.issueKey} · ${t.title}`,
          detail: STATUS_LABEL[t.status] || t.status,
          time: null,
        });
      });

    return events;
  }, [todayRecord, priorityTasks]);

  const statsLoading = boardLoading || attendanceLoading;

  const stats = [
    {
      label: "Today's Hours",
      value: todayRecord ? `${liveHours.toFixed(1)} hrs` : '—',
      sub: todayRecord?.isActiveSession ? 'Live · shift active' : 'Accumulated',
      color: 'text-[#0A89CD]',
      bgIcon: 'bg-[#0A89CD]/10',
      Icon: Clock,
    },
    {
      label: 'Attendance Status',
      value: attendance.label,
      sub: attendance.sub,
      color: 'text-[#36A15D]',
      bgIcon: 'bg-[#36A15D]/10',
      Icon: CalendarDays,
    },
    {
      label: 'Active Tasks',
      value: boardLoading ? '…' : String(activeTaskCount),
      sub: `${myTasks.length} assigned · ${myProgress} done`,
      color: 'text-[#FF8B00]',
      bgIcon: 'bg-[#FF8B00]/10',
      Icon: ListChecks,
    },
    {
      label: 'Sprint Progress',
      value: boardLoading ? '…' : sprintProgress,
      sub: sprint ? sprint.name : 'No active sprint',
      color: 'text-[#6554C0]',
      bgIcon: 'bg-[#6554C0]/10',
      Icon: BarChart3,
    },
  ];

  return (
    <Layout pageTitle="Employee Dashboard">
      <div className="w-full">

        {/* Welcome hero */}
        <div className="border-b border-[#DFE1E6] bg-white px-6 py-8 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#172B4D]">
                {getGreeting()},{' '}
                <span className="bg-gradient-to-r from-[#0A89CD] to-[#36A15D] bg-clip-text text-transparent">
                  {user?.name?.split(' ')[0] || 'there'}
                </span>
                👋
              </h1>
              <p className="mt-1 text-sm text-[#6B778C]">
                Here&apos;s your workspace overview for today.
                {todayRecord?.isActiveSession && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-[#E3FCEF] px-2 py-0.5 text-xs font-semibold text-[#006644]">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Shift Active
                  </span>
                )}
                {todayRecord?.isStandupLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-[#DEEBFF] px-2 py-0.5 text-xs font-semibold text-[#0747A6]">
                    Day Sealed
                  </span>
                )}
              </p>
            </div>
            <p className="text-sm font-medium text-[#6B778C]">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {stats.map(({ label, value, sub, color, bgIcon, Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-[#DFE1E6] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B778C]">
                    {label}
                  </p>
                  <p className={`mt-1.5 text-2xl font-bold ${color}`}>
                    {statsLoading && value === '…' ? (
                      <Loader2 className="h-6 w-6 animate-spin opacity-60" />
                    ) : (
                      value
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6B778C]">{sub}</p>
                </div>
                <div className={`rounded-lg p-2 ${bgIcon}`}>
                  <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Workspace grid */}
        <div className="grid grid-cols-1 gap-6 px-6 pb-8 lg:grid-cols-3 lg:px-8">

          {/* My Sprint Tasks */}
          <div className="rounded-xl border border-[#DFE1E6] bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#F4F5F7] px-6 py-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-[#0A89CD]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#172B4D]">My Sprint Tasks</h2>
                {sprint && (
                  <span className="rounded-md bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-semibold text-[#6B778C]">
                    {sprint.name}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate(sprint ? `/board/${sprint.id}` : '/board')}
                className="flex items-center gap-1 text-xs font-semibold text-[#0A89CD] transition-colors hover:text-[#0873AB]"
              >
                View Board
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {boardLoading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#0A89CD]" />
              </div>
            ) : !sprint ? (
              <div className="flex min-h-[280px] items-center justify-center p-8">
                <div className="text-center">
                  <LayoutGrid className="mx-auto h-12 w-12 text-[#DFE1E6]" />
                  <p className="mt-3 text-sm font-medium text-[#6B778C]">No active sprint</p>
                  <p className="mt-1 text-xs text-[#97A0AF]">
                    Tasks will appear when a sprint is active
                  </p>
                </div>
              </div>
            ) : myTasks.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center p-8">
                <div className="text-center">
                  <ListChecks className="mx-auto h-12 w-12 text-[#DFE1E6]" />
                  <p className="mt-3 text-sm font-medium text-[#6B778C]">No tasks assigned to you</p>
                  <p className="mt-1 text-xs text-[#97A0AF]">
                    Check the sprint board for unassigned work
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Status breakdown bar */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {Object.entries(myTasksByStatus).map(([status, count]) => (
                    <span
                      key={status}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[status] || 'bg-[#F4F5F7] text-[#42526E]'}`}
                    >
                      {STATUS_LABEL[status] || status}
                      <span className="rounded-full bg-white/60 px-1.5">{count}</span>
                    </span>
                  ))}
                </div>

                {/* Task list */}
                <ul className="divide-y divide-[#F4F5F7]">
                  {priorityTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-[#F4F5F7]/60 -mx-2 px-2 rounded-lg transition-colors"
                      onClick={() => navigate(sprint ? `/board/${sprint.id}` : '/board')}
                    >
                      <span
                        className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${TYPE_LOZENGE[task.type] || 'bg-[#F4F5F7] text-[#42526E]'}`}
                      >
                        {task.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#172B4D]">
                          <span className="text-[#6B778C] font-normal">{task.issueKey}</span>
                          {' · '}
                          {task.title}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[task.status]}`}
                      >
                        {STATUS_LABEL[task.status]}
                      </span>
                    </li>
                  ))}
                </ul>

                {myTasks.length > 6 && (
                  <p className="mt-3 text-center text-xs text-[#6B778C]">
                    +{myTasks.length - 6} more on the board
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Today's Activity */}
          <div className="rounded-xl border border-[#DFE1E6] bg-white shadow-sm">
            <div className="border-b border-[#F4F5F7] px-6 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#172B4D]">
                <BarChart3 className="h-4 w-4 text-[#36A15D]" aria-hidden="true" />
                Today&apos;s Activity
              </h2>
            </div>

            {attendanceLoading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#0A89CD]" />
              </div>
            ) : activityEvents.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center p-6">
                <div className="text-center">
                  <Clock className="mx-auto h-12 w-12 text-[#DFE1E6]" />
                  <p className="mt-3 text-sm font-medium text-[#6B778C]">No activity yet today</p>
                  <p className="mt-1 text-xs text-[#97A0AF]">
                    Punch in and start working on tasks
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto p-4">
                <ul className="space-y-3">
                  {activityEvents.map((event) => {
                    const Icon = event.icon;
                    return (
                      <li key={event.id} className="flex items-start gap-3">
                        <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${event.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${event.colour}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#172B4D] leading-snug">
                            {event.title}
                          </p>
                          {event.detail && (
                            <p className="mt-0.5 text-[11px] text-[#6B778C] leading-snug">
                              {event.detail}
                            </p>
                          )}
                          {event.time && (
                            <p className="mt-0.5 text-[10px] text-[#97A0AF]">
                              {formatTime(event.time)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Standup detail block */}
                {todayRecord?.isStandupLocked && todayRecord?.standupPlan && (
                  <div className="mt-4 rounded-lg border border-[#DFE1E6] bg-[#F4F5F7] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B778C] mb-1">
                      Tomorrow&apos;s Plan
                    </p>
                    <p className="text-xs text-[#172B4D] leading-relaxed">
                      {todayRecord.standupPlan}
                    </p>
                    {todayRecord.standupBlockers && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#DE350B] mt-2 mb-1">
                          Blockers
                        </p>
                        <p className="text-xs text-[#42526E] leading-relaxed">
                          {todayRecord.standupBlockers}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EmployeeDashboard;
