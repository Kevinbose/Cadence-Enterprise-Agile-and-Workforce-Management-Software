import React, { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, MapPin, Shield, AlertCircle, Clock, Pause, Flag } from 'lucide-react';
import {
  pauseShiftUser,
  punchOutUser,
  clearAttendanceError,
} from '../../features/attendance/attendanceSlice';
import BiometricCaptureModal from '../modals/BiometricCaptureModal';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: live accumulated hours = stored workHours + current chunk
// ──────────────────────────────────────────────────────────────────────────────
const calcLiveHours = (todayRecord) => {
  if (!todayRecord) return 0;
  let total = parseFloat(todayRecord.workHours || 0);
  if (todayRecord.isActiveSession && todayRecord.lastResumeTime) {
    const chunkMs = Date.now() - new Date(todayRecord.lastResumeTime).getTime();
    total += chunkMs / (1000 * 60 * 60);
  }
  return total;
};

const ShiftActionModal = ({ todayRecord, onClose }) => {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.attendance);
  const { user } = useSelector((state) => state.auth);

  const [liveHours, setLiveHours] = useState(calcLiveHours(todayRecord));
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);

  // Clear stale errors on mount
  useEffect(() => {
    dispatch(clearAttendanceError());
  }, [dispatch]);

  // Live ticking hours display inside modal
  useEffect(() => {
    if (!todayRecord?.isActiveSession) return;
    const interval = setInterval(() => {
      setLiveHours(calcLiveHours(todayRecord));
    }, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  // Close modal when the record state changes (paused or sealed)
  useEffect(() => {
    if (todayRecord && !todayRecord.isActiveSession) {
      onClose();
    }
  }, [todayRecord, onClose]);

  // ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePause = useCallback(() => {
    dispatch(pauseShiftUser());
  }, [dispatch]);

  const handleEndDay = useCallback(() => {
    setIsBiometricOpen(true);
  }, []);

  const isOffice = todayRecord?.status === 'PRESENT_OFFICE';

  // Spinner for loading states
  const LoadingSpinner = () => (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    /* ── Overlay with backdrop blur ─────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-action-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Modal Card ──────────────────────────────────────────────────────── */}
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A89CD]/10">
              <Clock className="h-5 w-5 text-[#0A89CD]" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="shift-action-title"
                className="text-base font-bold text-[#172B4D]"
              >
                Shift Controls
              </h3>
              <p className="text-xs text-[#6B778C]">
                Manage your active work session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close shift panel"
            className="rounded-lg p-1.5 text-[#6B778C] transition-colors hover:bg-slate-200/70 hover:text-[#172B4D] disabled:pointer-events-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="mx-6 mt-4 flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-3 text-sm text-[#DE350B]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="space-y-6 p-6">

          {/* Employee card */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#0A89CD] to-[#36A15D] text-sm font-bold text-white shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#172B4D]">
                {user?.name || 'Employee'}
              </p>
              <p className="text-xs text-[#6B778C]">
                {user?.employeeId || '—'}
              </p>
            </div>
          </div>

          {/* ── Hours Stat Callout ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#DFE1E6] bg-gradient-to-b from-[#F4F5F7] to-white p-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B778C]">
              Current Hours Accumulated
            </p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight text-[#0A89CD]">
              {liveHours.toFixed(2)}
              <span className="ml-1.5 text-lg font-medium text-[#6B778C]">hrs</span>
            </p>
            {/* Mini progress indicator */}
            <div className="mx-auto mt-3 h-1.5 w-32 overflow-hidden rounded-full bg-[#DFE1E6]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#36A15D] to-[#0A89CD] transition-all duration-1000"
                style={{ width: `${Math.min(100, (liveHours / 9) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-[#6B778C]">
              Target: 9.0 hrs
            </p>
          </div>

          {/* ── Geofence Badge ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            {isOffice ? (
              <div className="flex items-center gap-1.5 rounded-md border border-[#36A15D]/20 bg-[#E3FCEF] px-3 py-1.5 text-xs font-semibold text-[#006644]">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Verified Office Worksite
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Remote / WFH Tagged
              </div>
            )}
          </div>

          {/* ── Info notice ────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-4 py-3">
            <p className="text-xs leading-relaxed text-[#6B778C]">
              💡 You can pause your shift to take a break or commute home. Your
              morning worksite verification remains locked for the day and
              cannot be reassigned.
            </p>
          </div>
        </div>

        {/* ── Action Footer ─────────────────────────────────────────────────── */}
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-6 py-5">
          {/* Pause Shift — Secondary Action (outlined) */}
          <button
            onClick={handlePause}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                <span>Pause Shift</span>
              </>
            )}
          </button>

          {/* End Day — Destructive/Final Action */}
          <button
            onClick={handleEndDay}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#DE350B] py-3 text-sm font-semibold text-white shadow-md shadow-red-200/50 transition-all duration-200 hover:bg-[#BF2600] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <Flag className="h-4 w-4" aria-hidden="true" />
                <span>End Day Completely</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Biometric Capture Modal for Punch Out ───────────────────────────── */}
      <BiometricCaptureModal
        isOpen={isBiometricOpen}
        onClose={() => setIsBiometricOpen(false)}
        onSuccess={(photo) => {
          setIsBiometricOpen(false);
          dispatch(punchOutUser({ photoData: photo }));
        }}
      />
    </div>
  );
};

export default ShiftActionModal;
