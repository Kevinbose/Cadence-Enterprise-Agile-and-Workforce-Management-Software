import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, Lock, X, PlayCircle } from 'lucide-react';
import {
  punchInUser,
  resumeShiftUser,
  fetchTodayStatus,
} from '../../features/attendance/attendanceSlice';
import ShiftActionModal from './ShiftActionModal';
import BiometricCaptureModal from '../modals/BiometricCaptureModal';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Format total elapsed seconds into "04h : 12m : 08s"
// ──────────────────────────────────────────────────────────────────────────────
const formatElapsed = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
};

const GlobalHeaderPunch = () => {
  const dispatch = useDispatch();
  const { todayRecord, isClockingIn, isLoading } = useSelector(
    (state) => state.attendance
  );

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGpsQuerying, setIsGpsQuerying] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);

  // ── Rehydration on mount (Page Refresh Amnesia fix) ─────────────────────
  useEffect(() => {
    dispatch(fetchTodayStatus());
  }, [dispatch]);

  // ── Live ticking timer (Accumulator Math) ───────────────────────────────
  useEffect(() => {
    if (!todayRecord || !todayRecord.isActiveSession || !todayRecord.lastResumeTime) {
      return;
    }

    const calcTotal = () => {
      const accumulatedSeconds = parseFloat(todayRecord.workHours || 0) * 3600;
      const liveChunkSeconds =
        (Date.now() - new Date(todayRecord.lastResumeTime).getTime()) / 1000;
      return Math.max(0, Math.floor(accumulatedSeconds + liveChunkSeconds));
    };

    setElapsedSeconds(calcTotal());

    const interval = setInterval(() => {
      setElapsedSeconds(calcTotal());
    }, 1000);

    return () => clearInterval(interval);
  }, [todayRecord]);

  // ── GPS punch-in handler ───────────────────────────────────────────────
  const handleStartDay = useCallback(() => {
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsGpsQuerying(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGpsQuerying(false);
        setPendingCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsBiometricOpen(true);
      },
      (geolocationError) => {
        setIsGpsQuerying(false);
        if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
          setGpsError(
            'Location access is required by corporate security policy to verify your worksite perimeter. Please enable location permissions in your browser settings and try again.'
          );
        } else if (geolocationError.code === geolocationError.POSITION_UNAVAILABLE) {
          setGpsError(
            'Your location could not be determined. Please check your GPS signal.'
          );
        } else {
          setGpsError(
            'Location request timed out. Please try again or move to an area with better GPS signal.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [dispatch]);

  // ── Resume handler ─────────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    dispatch(resumeShiftUser());
  }, [dispatch]);

  // ── Spinner SVG ────────────────────────────────────────────────────────
  const Spinner = () => (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STATE 1: No record → Yakkay Blue "Start Day" lozenge
  // ──────────────────────────────────────────────────────────────────────────
  const renderNoRecord = () => (
    <button
      onClick={handleStartDay}
      disabled={isGpsQuerying || isClockingIn}
      aria-label="Start your work day"
      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0A89CD] to-[#0873AB] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 tracking-wide transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isGpsQuerying || isClockingIn ? (
        <>
          <Spinner />
          <span>Locating…</span>
        </>
      ) : (
        <>
          <PlayCircle className="h-4 w-4" />
          <span>Start Day</span>
        </>
      )}
    </button>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STATE 2: Active session → Green ticking lozenge with pulsing dot
  // ──────────────────────────────────────────────────────────────────────────
  const renderActiveSession = () => (
    <button
      onClick={() => setIsModalOpen(true)}
      aria-label="View shift actions"
      className="flex items-center gap-2 rounded-md border border-[#36A15D]/30 bg-[#E3FCEF] px-5 py-2 text-sm font-bold text-[#006644] transition-all duration-200 hover:bg-[#D3F9E4] hover:shadow-sm"
    >
      {/* Pulsing green dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#36A15D] opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#36A15D]" />
      </span>
      <span className="font-mono tracking-tight">
        {formatElapsed(elapsedSeconds)}
      </span>
      <span className="font-medium opacity-60">(Working)</span>
    </button>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STATE 3: Paused → Amber "Continue Work" lozenge
  // ──────────────────────────────────────────────────────────────────────────
  const renderPausedSession = () => (
    <button
      onClick={handleResume}
      disabled={isLoading}
      aria-label="Resume your paused shift"
      className="flex items-center gap-2 rounded-md border border-[#FF8B00]/30 bg-[#FFFAE6] px-5 py-2 text-sm font-bold text-[#FF8B00] transition-all duration-200 hover:bg-[#FFF4CC] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? (
        <>
          <Spinner />
          <span>Resuming…</span>
        </>
      ) : (
        <>
          <PlayCircle className="h-4 w-4" />
          <span>
            Continue Work • {parseFloat(todayRecord.workHours).toFixed(1)} hrs logged
          </span>
        </>
      )}
    </button>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STATE 4: Sealed → Muted gray badge
  // ──────────────────────────────────────────────────────────────────────────
  const renderSealedDay = () => (
    <div
      aria-label="Day completed"
      className="flex items-center gap-2 rounded-md bg-[#EBECF0] px-5 py-2 text-sm font-semibold text-[#5E6C84] cursor-default"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        Day Completed • {parseFloat(todayRecord.workHours).toFixed(1)} hrs
      </span>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STATE 5: ABSENT locked → Red badge with alert
  // ──────────────────────────────────────────────────────────────────────────
  const renderAbsentLocked = () => {
    const leaderName = todayRecord?.Adjudicator?.name || 'Leader';
    return (
      <div
        aria-label="Absent locked"
        className="flex items-center gap-2 rounded-md bg-[#FFEBE6] border border-[#FFBDAD] px-5 py-2 text-sm font-semibold text-[#BF2600] cursor-default"
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          Attendance: ABSENT (Locked by {leaderName})
        </span>
      </div>
    );
  };

  // ── Render decision ───────────────────────────────────────────────────
  const renderWidget = () => {
    if (todayRecord && todayRecord.status === 'ABSENT') return renderAbsentLocked();
    if (!todayRecord) return renderNoRecord();
    if (todayRecord.isStandupLocked) return renderSealedDay();
    if (todayRecord.isActiveSession) return renderActiveSession();
    if (!todayRecord.isActiveSession && todayRecord.checkInTime)
      return renderPausedSession();
    return renderNoRecord();
  };

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        {renderWidget()}

        {/* ── GPS Error Banner ────────────────────────────────────────────── */}
        {gpsError && (
          <div
            role="alert"
            className="absolute right-6 top-[4.5rem] z-50 flex max-w-sm items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 shadow-lg shadow-amber-100/50"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="mb-1 font-semibold text-amber-900">Location Access Required</p>
              <p className="leading-relaxed">{gpsError}</p>
            </div>
            <button
              onClick={() => setGpsError(null)}
              aria-label="Dismiss location error"
              className="flex-shrink-0 rounded-md p-0.5 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Shift Action Modal ────────────────────────────────────────────── */}
      {isModalOpen && todayRecord && (
        <ShiftActionModal
          todayRecord={todayRecord}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* ── Biometric Capture Modal for Punch In ───────────────────────────── */}
      <BiometricCaptureModal
        isOpen={isBiometricOpen}
        onClose={() => {
          setIsBiometricOpen(false);
          setPendingCoords(null);
        }}
        onSuccess={(photo) => {
          setIsBiometricOpen(false);
          if (pendingCoords) {
            dispatch(punchInUser({ ...pendingCoords, photoData: photo }));
          }
          setPendingCoords(null);
        }}
      />
    </>
  );
};

export default GlobalHeaderPunch;
