import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Clock, AlertCircle } from 'lucide-react';
import { punchOutUser, clearAttendanceError } from '../../features/attendance/attendanceSlice';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Calculate elapsed work duration as a readable string
// e.g. "4 hrs 12 min" from a checkInTime ISO string
// ──────────────────────────────────────────────────────────────────────────────
const formatWorkDuration = (checkInTime) => {
  if (!checkInTime) return '0 min';
  const diffMs = Date.now() - new Date(checkInTime).getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours} hr${hours > 1 ? 's' : ''} ${minutes} min`;
};

const StandupModal = ({ todayRecord, onClose }) => {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.attendance);

  const [workedOn, setWorkedOn] = useState('');
  const [plan, setPlan] = useState('');
  const [blockers, setBlockers] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Clear Redux error when modal mounts so stale errors don't bleed in
  useEffect(() => {
    dispatch(clearAttendanceError());
  }, [dispatch]);

  // ── Close modal on successful punch-out ───────────────────────────────────
  // When isStandupLocked flips to true in Redux, the parent (GlobalHeaderPunch)
  // will switch to STATE 3. We close the modal here.
  useEffect(() => {
    if (todayRecord?.isStandupLocked) {
      onClose();
    }
  }, [todayRecord, onClose]);

  // ── Trap focus inside modal (accessibility) ───────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errors = {};
    if (!workedOn.trim())
      errors.workedOn = 'Please describe what you completed today.';
    if (!plan.trim())
      errors.plan = 'Please describe your plan for tomorrow.';
    if (!blockers.trim())
      errors.blockers = 'Please enter any blockers, or type "None" if none.';
    return errors;
  }, [workedOn, plan, blockers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    dispatch(punchOutUser({ workedOn: workedOn.trim(), plan: plan.trim(), blockers: blockers.trim() }));
  };

  const textareaClass = (field) =>
    `w-full rounded-lg border bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-150 resize-none ${
      validationErrors[field]
        ? 'border-[#DE350B] focus:border-[#DE350B] focus:ring-1 focus:ring-[#DE350B]/20'
        : 'border-[#DFE1E6] focus:border-[#36A15D] focus:ring-1 focus:ring-[#36A15D] focus:bg-white'
    }`;

  const workDuration = formatWorkDuration(todayRecord?.checkInTime);

  return (
    // ── Backdrop ─────────────────────────────────────────────────────────────
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 30, 66, 0.50)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="standup-modal-title"
      onClick={(e) => {
        // Close when clicking the backdrop (not the modal card itself)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Modal Card ────────────────────────────────────────────────────── */}
      <div className="w-full max-w-lg rounded-xl border border-[#DFE1E6] bg-white shadow-2xl shadow-slate-900/20">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b border-[#DFE1E6] px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/Yakkay-logo.png"
              alt="Yakkay Tech"
              className="h-7 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div>
              <h2
                id="standup-modal-title"
                className="text-base font-bold text-[#172B4D]"
              >
                Daily Scrum &amp; Shift Checkout
              </h2>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6B778C]">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>
                  Active shift duration:&nbsp;
                  <span className="font-semibold text-[#36A15D]">
                    {workDuration}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close standup modal"
            className="rounded-md p-1 text-[#6B778C] transition-colors hover:bg-[#F4F5F7] hover:text-[#172B4D] disabled:pointer-events-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Redux Error Banner ───────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="mx-6 mt-4 flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-3 text-sm text-[#DE350B]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-6 py-5">

            {/* Field 1: Worked On */}
            <div>
              <label
                htmlFor="standup-worked-on"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]"
              >
                Deliverables Completed Today
              </label>
              <textarea
                id="standup-worked-on"
                rows={3}
                value={workedOn}
                onChange={(e) => {
                  setWorkedOn(e.target.value);
                  if (validationErrors.workedOn)
                    setValidationErrors((prev) => ({ ...prev, workedOn: undefined }));
                }}
                placeholder="What deliverables did you complete today?"
                className={textareaClass('workedOn')}
                disabled={isLoading}
              />
              {validationErrors.workedOn && (
                <p className="mt-1 text-xs text-[#DE350B]">
                  {validationErrors.workedOn}
                </p>
              )}
            </div>

            {/* Field 2: Plan */}
            <div>
              <label
                htmlFor="standup-plan"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]"
              >
                Tomorrow&apos;s Priority Plan
              </label>
              <textarea
                id="standup-plan"
                rows={3}
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  if (validationErrors.plan)
                    setValidationErrors((prev) => ({ ...prev, plan: undefined }));
                }}
                placeholder="What is your priority plan for tomorrow?"
                className={textareaClass('plan')}
                disabled={isLoading}
              />
              {validationErrors.plan && (
                <p className="mt-1 text-xs text-[#DE350B]">
                  {validationErrors.plan}
                </p>
              )}
            </div>

            {/* Field 3: Blockers */}
            <div>
              <label
                htmlFor="standup-blockers"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]"
              >
                Blockers &amp; Impediments
              </label>
              <textarea
                id="standup-blockers"
                rows={3}
                value={blockers}
                onChange={(e) => {
                  setBlockers(e.target.value);
                  if (validationErrors.blockers)
                    setValidationErrors((prev) => ({ ...prev, blockers: undefined }));
                }}
                placeholder='Are there any technical or organizational blockers? (Type "None" if none)'
                className={textareaClass('blockers')}
                disabled={isLoading}
              />
              {validationErrors.blockers && (
                <p className="mt-1 text-xs text-[#DE350B]">
                  {validationErrors.blockers}
                </p>
              )}
            </div>
          </div>

          {/* ── Footer / Submit ────────────────────────────────────────────── */}
          <div className="border-t border-[#DFE1E6] px-6 py-4">
            <p className="mb-3 text-xs text-[#6B778C]">
              ⚠️ Once submitted, your standup responses will be permanently
              locked and cannot be edited.
            </p>
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#36A15D] py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#2E894E] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
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
                  Locking Standup…
                </>
              ) : (
                '🔒 Clock Out & Lock Standup'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StandupModal;
