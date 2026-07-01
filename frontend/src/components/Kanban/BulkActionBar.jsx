import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { bulkAdjudicate, clearKanbanError } from '../../features/kanban/kanbanSlice';

/**
 * BulkActionBar — sticky floating action bar for multi-select bulk
 * Approve/Reject adjudication, plus its mandatory-reason Reject modal.
 *
 * Props:
 *   selectedCount — number of currently selected cards
 *   selectedIds   — array of selected task ids
 *   onComplete    — () => void; called after a successful bulk operation
 *                    (caller clears its selectedCardIds state)
 *   onClear       — () => void; called when the user dismisses the bar
 */
const BulkActionBar = ({ selectedCount, selectedIds, onComplete, onClear }) => {
  const dispatch = useDispatch();
  const { isSubmitting } = useSelector((state) => state.kanban);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [validationError, setValidationError] = useState('');

  if (selectedCount === 0) return null;

  const handleApprove = async () => {
    dispatch(clearKanbanError());
    const result = await dispatch(
      bulkAdjudicate({ taskIds: selectedIds, action: 'APPROVE' })
    );
    if (bulkAdjudicate.fulfilled.match(result)) {
      toast.success(result.payload?.message || `${selectedCount} item(s) approved.`);
      onComplete();
    }
  };

  const openRejectModal = () => {
    setRejectComment('');
    setValidationError('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectComment.trim()) {
      setValidationError('A rejection reason is mandatory for the audit trail.');
      return;
    }
    setValidationError('');
    dispatch(clearKanbanError());

    const result = await dispatch(
      bulkAdjudicate({
        taskIds: selectedIds,
        action: 'REJECT',
        comment: rejectComment.trim(),
      })
    );

    if (bulkAdjudicate.fulfilled.match(result)) {
      toast.success(result.payload?.message || `${selectedCount} item(s) rejected.`);
      setShowRejectModal(false);
      onComplete();
    }
  };

  return (
    <>
      {/* ── Floating action bar — slides up from the bottom ────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#DFE1E6] bg-white px-4 py-3 shadow-2xl shadow-slate-900/10 animate-fadeInUp">
          <span className="rounded-full bg-[#DEEBFF] px-3 py-1 text-xs font-bold text-[#0747A6]">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>

          <div className="h-5 w-px bg-[#DFE1E6]" />

          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#36A15D] to-[#2E8C50] px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-green-500/20 transition-all hover:shadow-md hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Bulk Approve
          </button>

          <button
            onClick={openRejectModal}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] px-3.5 py-2 text-xs font-semibold text-[#DE350B] transition-all hover:bg-[#FFDBD2] disabled:opacity-60"
          >
            <XCircle className="h-3.5 w-3.5" />
            Bulk Reject
          </button>

          <button
            onClick={onClear}
            title="Clear selection"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#97A0AF] transition-colors hover:bg-[#F4F5F7] hover:text-[#172B4D]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Mandatory-reason Reject modal ───────────────────────────────────── */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#DFE1E6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DFE1E6] px-6 py-4">
              <h2 className="text-base font-bold text-[#172B4D]">
                Reject {selectedCount} Item{selectedCount !== 1 ? 's' : ''} — Mandatory Reason
              </h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded p-1 text-[#6B778C] transition-colors hover:bg-[#F4F5F7] hover:text-[#172B4D]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#DE350B]" />
                <p className="text-xs text-[#891D04]">
                  All {selectedCount} selected card{selectedCount !== 1 ? 's' : ''} will move back
                  to <strong>In Progress</strong>, and this reason will be recorded on every one
                  of them for the audit trail.
                </p>
              </div>

              {validationError && (
                <div className="rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] px-3 py-2 text-sm text-[#DE350B]">
                  {validationError}
                </div>
              )}

              <textarea
                rows={3}
                value={rejectComment}
                onChange={(e) => {
                  setRejectComment(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="Why are these being kicked back? (required)"
                className="w-full resize-none rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none placeholder:text-[#A5ADBA] focus:border-[#DE350B] focus:bg-white"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-[#42526E] transition-colors hover:bg-[#F4F5F7]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#DE350B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#BF2600] disabled:opacity-70"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Bulk Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkActionBar;
