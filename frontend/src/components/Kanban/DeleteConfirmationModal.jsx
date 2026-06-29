import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { deleteIssue } from '../../features/kanban/kanbanSlice';

/**
 * Recursively counts the total descendants of `rootId` within `flatTasks`.
 * Used to surface blast-radius information before destructive deletion.
 */
const countDescendants = (rootId, flatTasks) => {
  let count = 0;
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    const children = flatTasks.filter((t) => t.parentId === parentId);
    for (const c of children) {
      count += 1;
      queue.push(c.id);
    }
  }
  return count;
};

const DeleteConfirmationModal = ({ task, onClose }) => {
  const dispatch = useDispatch();
  const { flatTasks, isSubmitting, error } = useSelector((state) => state.kanban);

  const descendantCount = useMemo(
    () => countDescendants(task.id, flatTasks),
    [task.id, flatTasks]
  );

  const handleConfirm = async () => {
    const result = await dispatch(deleteIssue(task.id));
    if (!result.error) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B4D]/50 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#DE350B]/30 bg-white shadow-2xl shadow-red-900/20 ring-1 ring-[#DE350B]/10"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-desc"
      >
        {/* ── Destructive header ──────────────────────────────────────────── */}
        <div className="flex items-start gap-4 border-b border-[#FFBDAD]/60 bg-[#FFEBE6]/70 px-6 py-5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#DE350B]/10 ring-2 ring-[#DE350B]/20">
            <AlertTriangle className="h-5 w-5 text-[#DE350B]" />
          </div>
          <div className="flex-1 pt-0.5">
            <h2
              id="delete-modal-title"
              className="text-sm font-bold tracking-tight text-[#AE2A19]"
            >
              Permanently Delete Hierarchy
            </h2>
            <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#DE350B]/70">
              {task.issueKey} — {task.type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#AE2A19]/60 transition-colors hover:bg-[#FFBDAD]/40 hover:text-[#AE2A19]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-5">
          <p id="delete-modal-desc" className="text-sm leading-relaxed text-[#172B4D]">
            You are about to delete{' '}
            <span className="font-mono font-bold text-[#DE350B]">{task.issueKey}</span>.{' '}
            This will permanently destroy this item
            {descendantCount > 0 ? (
              <>
                {' '}along with{' '}
                <span className="font-bold text-[#DE350B]">
                  {descendantCount} attached child issue{descendantCount !== 1 ? 's' : ''}
                </span>
              </>
            ) : null}
            . <span className="font-semibold">This action cannot be undone.</span>
          </p>

          {descendantCount > 0 && (
            <div className="mt-4 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/50 px-4 py-3">
              <p className="text-xs font-semibold text-[#AE2A19]">Blast radius</p>
              <p className="mt-1 text-xs text-[#DE350B]">
                {task.type} <strong>{task.issueKey}</strong> +{' '}
                {descendantCount} child issue{descendantCount !== 1 ? 's' : ''} will be
                permanently removed from the database.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-3 text-sm text-[#DE350B]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Action row ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 border-t border-[#FFBDAD]/40 bg-[#FFFBFA] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-[#DFE1E6] bg-white px-4 py-2 text-sm font-semibold text-[#42526E] transition-all hover:bg-[#F4F5F7] hover:text-[#172B4D] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#DE350B] px-5 py-2 text-sm font-bold text-white shadow-md shadow-red-600/30 transition-all hover:bg-[#C42B09] hover:shadow-lg hover:shadow-red-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Permanently Delete Hierarchy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
