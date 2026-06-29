import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertOctagon, HelpCircle, Send } from 'lucide-react';
import { regularizeShiftUser, clearAttendanceError } from '../../features/attendance/attendanceSlice';

const RegularizationModal = ({ record }) => {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.attendance);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  // Clear any existing error messages on mount
  useEffect(() => {
    dispatch(clearAttendanceError());
  }, [dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setValidationError('You must provide a valid reason to unlock your account.');
      return;
    }
    setValidationError('');
    dispatch(regularizeShiftUser({ reason: reason.trim() }));
  };

  // Format the date of the swept shift
  const formattedDate = record?.date
    ? new Date(record.date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Previous shift';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hostage-modal-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#FFBDAD] bg-white shadow-2xl shadow-red-950/20">

        {/* ── Red Accent Alert Banner ── */}
        <div className="flex items-center gap-3 bg-[#FFEBE6] border-b border-[#FFBDAD] px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#DE350B]/10">
            <AlertOctagon className="h-6 w-6 text-[#DE350B]" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="hostage-modal-title"
              className="text-lg font-bold text-[#DE350B]"
            >
              MISSING CHECKOUT DETECTED
            </h2>
            <p className="text-xs font-semibold text-[#891D04]">
              Action required to unlock your workspace
            </p>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="p-6 space-y-5">
          <p className="text-sm leading-relaxed text-[#172B4D]">
            Corporate security audits detected that your shift on{' '}
            <strong className="text-[#DE350B]">{formattedDate}</strong> was not checked
            out. The system automatically closed your session at 11:55 PM IST and capped
            logged time at <strong>8.00 hours</strong>.
          </p>

          <div className="rounded-lg bg-[#FAFBFC] border border-[#DFE1E6] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#172B4D]">
              <HelpCircle className="h-4 w-4 text-[#0A89CD]" aria-hidden="true" />
              Why is my account locked?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#6B778C]">
              Under Yakkay Tech internal compliance guidelines, employees must justify any
              system-triggered checkouts. Providing a brief reason unlocks your workspace
              boards and normalizes your timesheet records.
            </p>
          </div>

          {/* ── Redux Error Banner ── */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-3 text-sm text-[#DE350B]"
            >
              <span>{error}</span>
            </div>
          )}

          {/* ── Justification Input Form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="regularization-reason"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#172B4D]"
              >
                Justification / Reason
              </label>
              <textarea
                id="regularization-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError('');
                }}
                disabled={isLoading}
                placeholder="e.g. Completed tasks and forgot to check out before leaving / internet outage..."
                className={`w-full rounded-lg border bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-150 resize-none ${
                  validationError
                    ? 'border-[#DE350B] focus:border-[#DE350B] focus:ring-1 focus:ring-[#DE350B]/20'
                    : 'border-[#DFE1E6] focus:border-[#DE350B] focus:ring-1 focus:ring-[#DE350B]/20 focus:bg-white'
                }`}
              />
              {validationError && (
                <p className="mt-1 text-xs font-semibold text-[#DE350B]">
                  {validationError}
                </p>
              )}
            </div>

            {/* ── Submit Action ── */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#DE350B] py-3 text-sm font-semibold text-white shadow-md shadow-red-200/50 transition-all duration-200 hover:bg-[#BF2600] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting Justification…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Submit &amp; Unlock Account</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegularizationModal;
