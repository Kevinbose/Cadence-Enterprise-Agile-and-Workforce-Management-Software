import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, AlertTriangle, CheckCircle2, Loader2, GitPullRequestArrow } from 'lucide-react';
import {
  updateStatus,
  rejectTask,
  clearKanbanError,
} from '../../features/kanban/kanbanSlice';

const STATUS_LABEL = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  QA_TESTING: 'QA / Testing',
  DONE: 'Done',
};

/**
 * ReviewAdjudicationModal
 *   mode === 'employee-review' → confirm irreversible "Send to Review"
 *   mode === 'adjudicate'      → SM/Manager approve-advance or reject-with-reason
 */
const ReviewAdjudicationModal = ({ task, mode, onClose }) => {
  const dispatch = useDispatch();
  const { isSubmitting, error } = useSelector((state) => state.kanban);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  const approveStatus = task.status === 'IN_REVIEW' ? 'QA_TESTING' : 'DONE';

  const handleSendToReview = async () => {
    dispatch(clearKanbanError());
    const result = await dispatch(
      updateStatus({ taskId: task.id, status: 'IN_REVIEW' })
    );
    if (updateStatus.fulfilled.match(result)) onClose();
  };

  const handleApprove = async () => {
    dispatch(clearKanbanError());
    const result = await dispatch(
      updateStatus({ taskId: task.id, status: approveStatus })
    );
    if (updateStatus.fulfilled.match(result)) onClose();
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      setValidationError('A rejection reason is required.');
      return;
    }
    setValidationError('');
    dispatch(clearKanbanError());
    const result = await dispatch(
      rejectTask({ taskId: task.id, rejectionReason: reason.trim() })
    );
    if (rejectTask.fulfilled.match(result)) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#DFE1E6] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DFE1E6] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#6B778C]">
              {task.issueKey}
            </span>
            <span className="rounded bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#42526E]">
              {STATUS_LABEL[task.status]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#6B778C] transition-colors hover:bg-[#F4F5F7] hover:text-[#172B4D]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm font-medium leading-snug text-[#172B4D]">
            {task.title}
          </p>

          {(validationError || error) && (
            <div className="rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] px-3 py-2 text-sm text-[#DE350B]">
              {validationError || error}
            </div>
          )}

          {mode === 'employee-review' ? (
            <>
              <div className="flex items-start gap-2.5 rounded-lg border border-[#FFE2BD] bg-[#FFFAE6] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF8B00]" />
                <p className="text-sm text-[#172B4D]">
                  Send this issue to <strong>In Review</strong>? Once submitted you{' '}
                  <strong>cannot revert</strong> this action — only a Scrum Master or
                  Manager can advance or reject it.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-[#42526E] transition-colors hover:bg-[#F4F5F7]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendToReview}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#36A15D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2E8C50] disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitPullRequestArrow className="h-4 w-4" />
                  )}
                  Send to Review
                </button>
              </div>
            </>
          ) : (
            <>
              {!showReject ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B778C]">
                    Approve to advance this issue to{' '}
                    <strong className="text-[#172B4D]">
                      {STATUS_LABEL[approveStatus]}
                    </strong>
                    , or reject it back to In Progress.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#36A15D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2E8C50] disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve &amp; Advance
                    </button>
                    <button
                      onClick={() => setShowReject(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] px-4 py-2.5 text-sm font-semibold text-[#DE350B] transition-colors hover:bg-[#FFDBD2]"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Reject to In Progress
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#DE350B]" />
                    <p className="text-xs text-[#891D04]">
                      Rejecting will move the card back to In Progress and record a{' '}
                      <strong>negative QA flag</strong> on the assignee&apos;s
                      compliance record.
                    </p>
                  </div>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    placeholder="Explain what failed review (required)…"
                    className="w-full resize-none rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none placeholder:text-[#A5ADBA] focus:border-[#DE350B] focus:bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowReject(false)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-[#42526E] transition-colors hover:bg-[#F4F5F7]"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#DE350B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#BF2600] disabled:opacity-70"
                    >
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewAdjudicationModal;
