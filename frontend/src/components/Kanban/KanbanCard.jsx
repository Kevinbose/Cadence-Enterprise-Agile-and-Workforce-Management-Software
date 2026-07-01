import React from 'react';
import {
  Lock,
  ArrowRight,
  GitPullRequestArrow,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Pencil,
  Trash2,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

// ─── Type lozenges with left-dot accent ──────────────────────────────────────
const TYPE_CONFIG = {
  Epic: {
    lozenge: 'bg-[#EAE6FF]/80 text-[#5243AA] ring-1 ring-[#5243AA]/10',
    dot: 'bg-[#5243AA]',
  },
  Story: {
    lozenge: 'bg-[#E3FCEF]/80 text-[#006644] ring-1 ring-[#006644]/10',
    dot: 'bg-[#006644]',
  },
  Task: {
    lozenge: 'bg-[#DEEBFF]/80 text-[#0747A6] ring-1 ring-[#0747A6]/10',
    dot: 'bg-[#0747A6]',
  },
  Subtask: {
    lozenge: 'bg-[#F4F5F7] text-[#42526E] ring-1 ring-[#42526E]/10',
    dot: 'bg-[#42526E]',
  },
};

const initialsOf = (name) =>
  name
    ? name
      .split(' ')
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('')
    : '–';

/**
 * KanbanCard — a single issue card with glassmorphism styling.
 *
 * Props:
 *   task        — serialized task object
 *   isOwner     — current user is the assignee
 *   isElevated  — current user is SM or Manager (or an active Temp Manager)
 *   isFrozen    — sprint is PENDING or COMPLETED; blocks drag/status progression
 *   isArchived  — sprint is COMPLETED; additionally blocks edit and delete
 *   onAdvance   — (task, nextStatus) => void  (direct forward move)
 *   onReview    — (task, mode) => void        (opens adjudication modal)
 *   onEdit      — (task) => void              (opens edit modal)
 *   onDelete    — (task) => void              (opens delete confirm modal)
 *   isSelected      — this card's id is present in the bulk-adjudication selection set
 *   onToggleSelect  — (taskId) => void; toggles bulk-select checkbox state
 *   isDragging  — injected by Draggable snapshot
 */
const KanbanCard = ({ task, isOwner, isElevated, isFrozen, isArchived, onAdvance, onReview, onEdit, onDelete, isSelected, onToggleSelect, currentUser, isDragging }) => {
  const config = TYPE_CONFIG[task.type] || TYPE_CONFIG.Task;
  const assigneeName = task.assignee?.name;
  const isDone = task.status === 'DONE';
  const isCreator = currentUser && task.creatorId === currentUser.id;

  // Bulk-select checkbox is only offered to Managers/Scrum Masters (or an
  // active Temp Manager — already folded into isElevated on the frontend
  // since JIT elevation patches systemRole to 'Admin/Manager'), on an
  // unfrozen (ACTIVE) board, for cards awaiting adjudication.
  const showBulkCheckbox =
    isElevated &&
    !isFrozen &&
    (task.status === 'IN_REVIEW' || task.status === 'QA_TESTING') &&
    typeof onToggleSelect === 'function';

  // Overdue badge — task has been carried across at least one sprint rollover
  // and is still unfinished. DONE tasks never show it (they don't roll over).
  const isOverdue = (task.rolloverCount || 0) > 0 && task.status !== 'DONE';

  // ── Determine the contextual action button ─────────────────────────────────
  // Suppress all movement actions when the board is frozen (sprint is PENDING).
  let action = null;
  if (!isFrozen && isElevated && task.status === 'IN_REVIEW') {
    action = (
      <button
        onClick={(e) => { e.stopPropagation(); onReview(task, 'adjudicate'); }}
        className="group/btn inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0747A6] to-[#0A3D8F] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.97]"
      >
        <ShieldCheck className="h-3.5 w-3.5 transition-transform group-hover/btn:rotate-6" /> Review
      </button>
    );
  } else if (!isFrozen && isElevated && task.status === 'QA_TESTING') {
    action = (
      <button
        onClick={(e) => { e.stopPropagation(); onReview(task, 'adjudicate'); }}
        className="group/btn inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0747A6] to-[#0A3D8F] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.97]"
      >
        <CheckCircle2 className="h-3.5 w-3.5 transition-transform group-hover/btn:scale-110" /> QA Sign-off
      </button>
    );
  } else if (!isFrozen && isElevated && task.status === 'TODO') {
    action = (
      <button
        onClick={(e) => { e.stopPropagation(); onAdvance(task, 'IN_PROGRESS'); }}
        className="group/btn inline-flex items-center gap-1.5 rounded-lg border border-[#DFE1E6] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#42526E] shadow-sm transition-all duration-200 hover:border-[#0A89CD]/40 hover:bg-blue-50/50 hover:text-[#0747A6] hover:shadow-md active:scale-[0.97]"
      >
        Start <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    );
  } else if (!isFrozen && isElevated && task.status === 'IN_PROGRESS') {
    action = (
      <button
        onClick={(e) => { e.stopPropagation(); onAdvance(task, 'IN_REVIEW'); }}
        className="group/btn inline-flex items-center gap-1.5 rounded-lg border border-[#DFE1E6] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#42526E] shadow-sm transition-all duration-200 hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-700 hover:shadow-md active:scale-[0.97]"
      >
        To Review <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    );
  } else if (!isFrozen && isOwner && task.status === 'TODO') {
    action = (
      <button
        onClick={(e) => { e.stopPropagation(); onAdvance(task, 'IN_PROGRESS'); }}
        className="group/btn inline-flex items-center gap-1.5 rounded-lg border border-[#DFE1E6] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#42526E] shadow-sm transition-all duration-200 hover:border-[#0A89CD]/40 hover:bg-blue-50/50 hover:text-[#0747A6] hover:shadow-md active:scale-[0.97]"
      >
        Start <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    );
  } else if (!isFrozen && isOwner && task.status === 'IN_PROGRESS') {
    action = (
      <button
        onClick={(e) => { e.stopPropagation(); onReview(task, 'employee-review'); }}
        className="group/btn inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#36A15D] to-[#2E8C50] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-green-500/20 transition-all duration-200 hover:shadow-md hover:shadow-green-500/30 hover:brightness-110 active:scale-[0.97]"
      >
        <GitPullRequestArrow className="h-3.5 w-3.5 transition-transform group-hover/btn:rotate-12" /> Send to Review
      </button>
    );
  }

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border bg-white/90 p-3.5
        backdrop-blur-sm transition-all duration-250
        ${isDragging
          ? 'rotate-[2deg] scale-[1.04] border-[#0A89CD]/60 shadow-xl shadow-blue-500/15 ring-2 ring-[#0A89CD]/20'
          : isSelected
            ? 'border-[#0A89CD]/60 shadow-md shadow-blue-500/10 ring-2 ring-[#0A89CD]/40'
            : 'border-[#DFE1E6]/80 shadow-sm hover:border-[#0A89CD]/30 hover:shadow-lg hover:shadow-slate-200/60'
        }
        ${isDone ? 'opacity-75' : ''}
        ${showBulkCheckbox ? 'pl-8' : ''}
      `}
    >
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#0A89CD]/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Bulk-adjudication checkbox — top-left, Manager/SM/Temp-Manager only,
          on unfrozen boards, for IN_REVIEW / QA_TESTING cards only. */}
      {showBulkCheckbox && (
        <label
          onClick={(e) => e.stopPropagation()}
          className="absolute left-2.5 top-2.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center"
          title={isSelected ? 'Deselect card' : 'Select for bulk adjudication'}
        >
          <input
            type="checkbox"
            checked={Boolean(isSelected)}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(task.id);
            }}
            className="h-4 w-4 cursor-pointer rounded border-[#C1C7D0] text-[#0A89CD] focus:ring-2 focus:ring-[#0A89CD]/40 focus:ring-offset-0"
          />
        </label>
      )}

      {/* Top-right action cluster: edit / delete (hover) + lock badge (always) */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5">
        {/* Edit and delete are visible for both ACTIVE and PENDING sprints.
            Only COMPLETED (archived) sprints fully suppress these controls. */}
        {!isArchived && onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            title="Edit issue"
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-5 w-5 items-center justify-center rounded text-[#97A0AF] hover:bg-[#F4F5F7] hover:text-[#172B4D]"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {!isArchived && onDelete && (isElevated || isCreator) && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            title="Delete issue"
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-5 w-5 items-center justify-center rounded text-[#97A0AF] hover:bg-[#FFEBE6] hover:text-[#DE350B]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        {task.isConfidential && (
          <span
            title="Confidential issue"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#FFEBE6] to-[#FFD2CC] ring-1 ring-[#DE350B]/10"
          >
            <Lock className="h-3 w-3 text-[#DE350B]" />
          </span>
        )}
      </div>

      {/* Type lozenge + Issue key */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.lozenge}`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {task.type}
        </span>
        <span className="font-mono text-[11px] font-semibold text-[#97A0AF]">
          {task.issueKey}
        </span>
        {isOverdue && (
          <span
            title={`Rolled over ${task.rolloverCount} time${task.rolloverCount !== 1 ? 's' : ''}`}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-orange-400/30"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Overdue
          </span>
        )}
      </div>

      {/* Title */}
      <p className={`mt-2.5 line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight ${isDone ? 'text-[#97A0AF] line-through decoration-[#C1C7D0]' : 'text-[#172B4D]'}`}>
        {task.title}
      </p>

      {/* Footer: avatar + action */}
      <div className="mt-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2" title={assigneeName || 'Unassigned'}>
          {assigneeName ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0A89CD] to-[#36A15D] text-[10px] font-bold text-white shadow-sm ring-2 ring-white/80">
              {initialsOf(assigneeName)}
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-[#C1C7D0]/60 text-[10px] font-bold text-[#C1C7D0]">
              –
            </span>
          )}
          {task.commentCount > 0 && (
            <span 
              title={`${task.commentCount} comments`}
              className="inline-flex items-center gap-1 rounded bg-[#F4F5F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#42526E]"
            >
              <MessageSquare className="h-3 w-3 text-[#6B778C]" />
              <span>{task.commentCount}</span>
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#36A15D]">
              <Zap className="h-3 w-3" /> Done
            </span>
          )}
        </div>
        {action}
      </div>
    </div>
  );
};

export default KanbanCard;
