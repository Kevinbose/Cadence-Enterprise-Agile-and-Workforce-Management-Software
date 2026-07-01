import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertTriangle,
  Clock,
  Loader2,
  Shield,
  UserCog,
  X,
  Zap,
  CalendarClock,
  ShieldOff,
  Users,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import {
  assignTempManager,
  clearTempManagerError,
  fetchTeamGrants,
  revokeTempManager,
} from '../features/tempManager/tempManagerSlice';

/* ─── Pure utility functions — unchanged ──────────────────────────────────── */

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const toDatetimeLocalValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/* ─── Avatar color palette ────────────────────────────────────────────────── */

const AVATAR_PALETTE = [
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-emerald-600',
  'from-violet-500 to-purple-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
];

const avatarGradient = (name = '') => {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
};

/* ═══════════════════════════════════════════════════════════════════════════
   ASSIGNMENT DIALOG — premium light redesign, identical logic surface
═══════════════════════════════════════════════════════════════════════════ */

const AssignmentDialog = ({ employee, isSubmitting, onClose, onSubmit }) => {
  const now = new Date();
  const defaultStart = toDatetimeLocalValue(now);
  const defaultEnd   = toDatetimeLocalValue(new Date(now.getTime() + 60 * 60 * 1000));

  const [startTime, setStartTime]         = useState(defaultStart);
  const [endTime, setEndTime]             = useState(defaultEnd);
  const [validationError, setValidationError] = useState('');

  /* ── Identical submit logic ──────────────────────────────────────────── */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      setValidationError('Start and end date/time are required.');
      return;
    }
    const start = new Date(startTime);
    const end   = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setValidationError('Invalid date/time values.');
      return;
    }
    if (start >= end) {
      setValidationError('End time must be after start time.');
      return;
    }
    setValidationError('');
    onSubmit({
      granteeId: employee.id,
      startTime: start.toISOString(),
      endTime:   end.toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {/* Modal card */}
      <div
        className="w-full max-w-lg overflow-hidden bg-white border border-[#DFE1E6] shadow-2xl rounded-2xl transform transition-all duration-300"
        style={{
          boxShadow: '0 20px 50px rgba(9, 30, 66, 0.15), 0 0 1px rgba(9, 30, 66, 0.31)',
        }}
      >
        {/* Header */}
        <div
          className="bg-gradient-to-r from-[#0747A6] to-[#0A89CD] p-5 px-6 relative overflow-hidden"
        >
          {/* Decorative glow orb */}
          <div
            className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none"
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shadow-inner"
              >
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 leading-none">
                  Authority Delegation
                </p>
                <h2 className="mt-1 text-base font-black text-white leading-tight">
                  {employee.name}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center cursor-pointer transition-all duration-200 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">

          {/* Employee context chip */}
          <div
            className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/70"
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(employee.name)} text-xs font-black text-white shadow-sm`}
            >
              {employee.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-bold text-[#172B4D]">{employee.name}</p>
              <p className="text-xs text-[#5E6C84]">{employee.email}</p>
            </div>
            <div className="ml-auto">
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200/50"
              >
                {employee.employeeId}
              </span>
            </div>
          </div>

          {/* Validation error */}
          {validationError && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <span className="text-xs font-semibold">{validationError}</span>
            </div>
          )}

          {/* Date/time inputs */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'tm-start', label: 'Start Date & Time', value: startTime, onChange: setStartTime },
              { id: 'tm-end',   label: 'End Date & Time',   value: endTime,   onChange: setEndTime },
            ].map(({ id, label, value, onChange }) => (
              <div key={id}>
                <label
                  htmlFor={id}
                  className="block mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#5E6C84]"
                >
                  {label}
                </label>
                <input
                  id={id}
                  type="datetime-local"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DFE1E6] rounded-xl text-xs font-semibold text-[#172B4D] bg-[#FAFBFC] focus:border-[#0A89CD] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-150"
                />
              </div>
            ))}
          </div>

          {/* Amber advisory */}
          <div
            className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900"
          >
            <Shield className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800 font-medium">
              This employee will temporarily inherit full manager-tier capabilities for the selected window. 
              The elevation window expires automatically but can be revoked instantly at any point.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-[#F4F5F7]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#42526E] bg-[#FAFBFC] border border-[#DFE1E6] hover:bg-[#F4F5F7] hover:text-[#172B4D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#0747A6] to-[#0A89CD] hover:opacity-95 shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Authorize Temporary Elevation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TEMP MANAGER PORTAL — main page (light-themed upgrade)
═══════════════════════════════════════════════════════════════════════════ */

const TempManagerPortal = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { teamList, activeGrant, isLoading, isSubmitting, error } =
    useSelector((state) => state.tempManager);

  const [selectedEmployee, setSelectedEmployee] = useState(null);

  /* ── Identical effects / handlers ──────────────────────────────────── */
  useEffect(() => {
    if (user?.isTempManager) return;
    dispatch(fetchTeamGrants());
    dispatch(clearTempManagerError());
  }, [dispatch, user?.isTempManager]);

  const bannerGrant = useMemo(() => {
    if (!activeGrant) return null;
    if (!activeGrant.isActive) return null;
    if (activeGrant.status === 'expired' || activeGrant.status === 'revoked') return null;
    return activeGrant;
  }, [activeGrant]);

  const handleAssign = async (payload) => {
    const result = await dispatch(assignTempManager(payload));
    if (assignTempManager.fulfilled.match(result)) {
      setSelectedEmployee(null);
    }
  };

  const handleRevoke = () => {
    if (!bannerGrant?.id) return;
    dispatch(revokeTempManager(bannerGrant.id));
  };

  /* ── Access-denied block (temp manager guard) ──────────────────────── */
  if (user?.isTempManager) {
    return (
      <Layout pageTitle="Temp Manager — Delegation Portal">
        <div
          className="mx-auto max-w-2xl rounded-2xl px-8 py-12 text-center bg-red-50/50 border border-red-200"
        >
          <div
            className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"
          >
            <ShieldOff className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-base font-bold text-red-800">
            Temporary managers cannot access the delegation portal.
          </p>
          <p className="mt-2 text-xs text-[#5E6C84]">
            Delegating manager privileges to additional users is restricted to permanent manager accounts only.
          </p>
        </div>
      </Layout>
    );
  }

  /* ── Stats derived from teamList ──────────────────────────────────── */
  const elevatedCount = teamList.filter(
    (e) => e.activeGrant?.isActive && e.activeGrant?.status !== 'expired' && e.activeGrant?.status !== 'revoked'
  ).length;

  return (
    <Layout pageTitle="Temp Manager — Delegation Portal">
      <div className="mx-auto max-w-6xl space-y-6 px-1 py-2">

        {/* ── PAGE HEADER: Light gradient dashboard cockpit ────────────────── */}
        <div
          className="relative rounded-2xl border border-[#DFE1E6]/75 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-slate-50/50 p-6 px-8 shadow-sm overflow-hidden"
        >
          {/* Subtle light background highlight circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-100/40 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 left-1/3 w-36 h-36 rounded-full bg-purple-100/30 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {/* Icon badge */}
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br from-[#0A89CD]/15 to-[#0747A6]/15 ring-1 ring-blue-500/10 shadow-sm flex items-center justify-center"
              >
                <UserCog className="h-6 w-6 text-[#0A89CD]" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-[#172B4D] tracking-tight leading-none">
                    Delegation Command Center
                  </h1>
                  <span
                    className="text-[9px] font-black tracking-widest text-[#0052CC] uppercase bg-[#E3FCEF] border border-[#36A15D]/20 px-2 py-0.5 rounded-md"
                  >
                    Enterprise Access Control
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5E6C84] font-medium">
                  Temporarily assign managerial permissions to employees in your team for time-locked intervals.
                </p>
              </div>
            </div>

            {/* Stat indicators */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-[#DFE1E6]/70 shadow-sm"
              >
                <Users className="h-3.5 w-3.5 text-[#5E6C84]" />
                <span className="text-xs font-bold text-[#42526E]">
                  {teamList.length} <span className="font-semibold text-[#5E6C84]">employees</span>
                </span>
              </div>
              {elevatedCount > 0 && (
                <div
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-black text-emerald-800">
                    {elevatedCount} elevated
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ERROR BANNER ────────────────────────────────────────── */}
        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800"
          >
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 text-red-500" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {/* ── ACTIVE DELEGATION BANNER: Upgraded amber-blue light gradient ── */}
        {bannerGrant && (
          <div
            className="relative rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-blue-50/80 p-5 px-6 shadow-sm overflow-hidden"
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-blue-400" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {/* Status icon widget */}
                <div
                  className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    bannerGrant.status === 'scheduled'
                      ? 'bg-blue-100 border border-blue-200 text-blue-600'
                      : 'bg-amber-100 border border-amber-200 text-amber-600'
                  }`}
                >
                  {bannerGrant.status === 'scheduled' ? (
                    <CalendarClock className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 animate-pulse" />
                  )}
                </div>

                <div>
                  {/* Status identifier */}
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-widest ${
                      bannerGrant.status === 'scheduled' ? 'text-blue-700' : 'text-amber-800'
                    }`}
                  >
                    {bannerGrant.status === 'scheduled' ? 'Scheduled Delegation' : 'Active Delegation'}
                  </span>

                  <p className="text-sm font-black text-[#172B4D] mt-0.5 leading-snug">
                    {bannerGrant.granteeName} is acting Manager until{' '}
                    <span className="text-[#0747A6]">{formatDateTime(bannerGrant.endTime)}</span>
                  </p>

                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#5E6C84] font-medium">
                    <Clock className="h-3 w-3" />
                    <span>Window:</span>
                    <span className="font-semibold text-[#172B4D]">{formatDateTime(bannerGrant.startTime)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[#97A0AF]" />
                    <span className="font-semibold text-[#172B4D]">{formatDateTime(bannerGrant.endTime)}</span>
                  </div>
                </div>
              </div>

              {/* Revoke Early trigger */}
              <button
                onClick={handleRevoke}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5" />
                )}
                Revoke Early
              </button>
            </div>
          </div>
        )}

        {/* ── TEAM EMPLOYEES GRID CARD: Light theme card design ───────────── */}
        <div
          className="rounded-2xl border border-[#DFE1E6]/75 bg-white shadow-sm overflow-hidden"
        >
          {/* Card header */}
          <div
            className="p-5 px-6 border-b border-[#DFE1E6]/70 bg-slate-50/50 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200/50 flex items-center justify-center"
                >
                  <UserCog className="h-4.5 w-4.5 text-[#0747A6]" />
                </div>
                <h2 className="text-sm font-extrabold text-[#172B4D]">
                  Team Employees
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#5E6C84] font-medium pl-10">
                Select an employee from the list to assign temporary managerial delegation.
              </p>
            </div>
          </div>

          {/* Table loading / empty / populated state */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-[#0A89CD]" />
              <p className="text-xs font-semibold text-[#5E6C84]">Loading team roster...</p>
            </div>
          ) : teamList.length === 0 ? (
            <div className="py-20 text-center text-xs font-bold text-[#5E6C84]">
              No employees registered on your team roster.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className="border-b border-[#DFE1E6]/70 bg-slate-50/20"
                  >
                    {['Employee', 'Employee ID', 'Job Title', 'Status'].map((col) => (
                      <th
                        key={col}
                        className="p-3.5 px-6 font-extrabold text-[#5E6C84] uppercase tracking-wider text-[10px]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBECF0]">
                  {teamList.map((emp) => {
                    const isElevated =
                      emp.activeGrant &&
                      emp.activeGrant.isActive &&
                      emp.activeGrant.status !== 'expired' &&
                      emp.activeGrant.status !== 'revoked';

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmployee(emp)}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors duration-150"
                      >
                        {/* Employee cell */}
                        <td className="p-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarGradient(emp.name)} text-xs font-extrabold text-white shadow-sm`}
                            >
                              {emp.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-extrabold text-[#172B4D] text-xs leading-none">{emp.name}</p>
                              <p className="text-[11px] text-[#5E6C84] mt-1">{emp.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Employee ID cell */}
                        <td className="p-4 px-6">
                          <span
                            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAFBFC] border border-[#DFE1E6]/80 text-[#42526E]"
                          >
                            {emp.employeeId || '—'}
                          </span>
                        </td>

                        {/* Job title cell */}
                        <td className="p-4 px-6 text-[#42526E] font-medium">
                          {emp.jobTitle || '—'}
                        </td>

                        {/* Status cell */}
                        <td className="p-4 px-6">
                          {isElevated ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200/50"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              {emp.activeGrant.status === 'scheduled' ? 'Scheduled' : 'Elevated'}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FAFBFC] text-[#42526E] border border-[#DFE1E6]/80"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── ASSIGNMENT DIALOG MODAL ────────────────────────────────────── */}
      {selectedEmployee && (
        <AssignmentDialog
          employee={selectedEmployee}
          isSubmitting={isSubmitting}
          onClose={() => setSelectedEmployee(null)}
          onSubmit={handleAssign}
        />
      )}
    </Layout>
  );
};

export default TempManagerPortal;
