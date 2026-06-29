import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { X, Lock, Loader2, Users, AlertTriangle } from 'lucide-react';
import {
  createIssue,
  clearKanbanError,
  fetchEligibleAssignees,
} from '../../features/kanban/kanbanSlice';

// The full type list; each role receives a filtered subset.
const ALL_TYPES = ['Epic', 'Story', 'Task', 'Subtask'];

// Which parent type is valid for each issue type.
// null means no parent is applicable (Epic).
const PARENT_TYPE_FOR = {
  Subtask: 'Task',
  Task: 'Story',
  Story: 'Epic',
  Epic: null,
};

// Human-readable parent type labels shown in helper text.
const PARENT_LABEL_FOR = {
  Subtask: 'Task',
  Task: 'Story',
  Story: 'Epic',
};

// Type lozenge colours, mirroring the board card styling.
const TYPE_LOZENGE = {
  Epic: 'bg-[#EAE6FF] text-[#5243AA]',
  Story: 'bg-[#E3FCEF] text-[#006644]',
  Task: 'bg-[#DEEBFF] text-[#0747A6]',
  Subtask: 'bg-[#DFE1E6] text-[#42526E]',
};

const CreateIssueModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { sprintId: sprintIdParam } = useParams(); // reads /board/:sprintId from the URL
  const { user } = useSelector((state) => state.auth);
  const {
    flatTasks,
    isTemporalScrumMaster,
    eligibleAssignees,
    isLoadingAssignees,
    isSubmitting,
    error,
  } = useSelector((state) => state.kanban);

  const isManager = user?.systemRole === 'Admin/Manager';
  const isSM = !isManager && isTemporalScrumMaster;
  const isEmployee = !isManager && !isSM;

  // Role determines the type options visible in the dropdown.
  const allowedTypes = useMemo(() => {
    if (isManager) return ALL_TYPES;
    if (isSM) return ['Story', 'Task', 'Subtask'];
    return ['Task', 'Subtask'];
  }, [isManager, isSM]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(allowedTypes[0]);
  const [assigneeId, setAssigneeId] = useState(
    // Employees always assign to themselves — pre-select their ID.
    isEmployee ? String(user?.id ?? '') : ''
  );
  const [parentId, setParentId] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [validationError, setValidationError] = useState('');

  // ── On mount: fetch the server-derived assignee directory ──────────────────
  useEffect(() => {
    dispatch(fetchEligibleAssignees());
    dispatch(clearKanbanError());
  }, [dispatch]);

  // ── When type changes, reset parentId (valid parents differ by type) ───────
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setType(newType);
    setParentId(''); // stale parent selection becomes invalid
  };

  // ── Smart Parent dropdown ──────────────────────────────────────────────────
  // Filtered to only the legal parent types per hierarchy rules.
  // Epic has no parent — dropdown is hidden entirely for that type.
  const showParentDropdown = type !== 'Epic';
  const requiredParentType = PARENT_TYPE_FOR[type]; // null for Epic

  const parentOptions = useMemo(() => {
    const filterType = PARENT_TYPE_FOR[type];
    if (!filterType) return [];
    return flatTasks
      .filter((t) => t.type === filterType)
      .map((t) => ({
        id: t.id,
        label: `${t.issueKey} · ${t.title}`,
      }));
  }, [type, flatTasks]);

  // ── Assignee options ───────────────────────────────────────────────────────
  // Derived from the server response (eligibleAssignees).
  // Employees see only themselves; the backend enforces this too.
  const assigneeOptions = useMemo(() => {
    return eligibleAssignees.map((a) => ({
      id: a.id,
      name: a.id === user?.id ? `${a.name} (You)` : a.name,
      systemRole: a.systemRole,
    }));
  }, [eligibleAssignees, user]);

  // ── Form submission ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setValidationError('A title is required.');
      return;
    }

    if (type === 'Subtask' && !parentId) {
      setValidationError('Subtasks require a parent Task to be selected.');
      return;
    }

    setValidationError('');
    dispatch(clearKanbanError());

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      assigneeId: assigneeId ? Number(assigneeId) : null,
      parentId: parentId ? Number(parentId) : null,
      isConfidential: isManager ? isConfidential : false,
      // Attach the URL-derived sprint ID so tasks are never orphaned on refresh.
      // Falls back to undefined when on the generic /board route (activeSprint handles it).
      sprintId: sprintIdParam ? parseInt(sprintIdParam, 10) : undefined,
    };

    const result = await dispatch(createIssue(payload));
    if (createIssue.fulfilled.match(result)) {
      onClose();
    }
  };

  const displayError = validationError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#DFE1E6] bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[#DFE1E6] px-6 py-4">
          <h2
            id="create-issue-title"
            className="text-base font-bold text-[#172B4D]"
          >
            Create Issue
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#6B778C] transition-colors hover:bg-[#F4F5F7] hover:text-[#172B4D]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">

          {/* ── Error Banner ── */}
          {displayError && (
            <div className="flex items-start gap-2 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] px-3 py-2 text-sm text-[#DE350B]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* ── Issue Type ── */}
          <div>
            <label
              htmlFor="ci-type"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
            >
              Issue Type
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${TYPE_LOZENGE[type] || TYPE_LOZENGE.Task}`}
              >
                {type}
              </span>
              <select
                id="ci-type"
                value={type}
                onChange={handleTypeChange}
                className="flex-1 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none focus:border-[#0A89CD] focus:bg-white"
              >
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Title ── */}
          <div>
            <label
              htmlFor="ci-title"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
            >
              Title <span className="text-[#DE350B]">*</span>
            </label>
            <input
              id="ci-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize the work to be done"
              className="w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none placeholder:text-[#A5ADBA] focus:border-[#0A89CD] focus:bg-white"
            />
          </div>

          {/* ── Description ── */}
          <div>
            <label
              htmlFor="ci-desc"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
            >
              Description
            </label>
            <textarea
              id="ci-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context, acceptance criteria, links…"
              className="w-full resize-none rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none placeholder:text-[#A5ADBA] focus:border-[#0A89CD] focus:bg-white"
            />
          </div>

          {/* ── Assignee & Parent row ── */}
          <div className={`grid gap-4 ${showParentDropdown ? 'grid-cols-2' : 'grid-cols-1'}`}>

            {/* Assignee */}
            <div>
              <label
                htmlFor="ci-assignee"
                className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#6B778C]"
              >
                <Users className="h-3 w-3" />
                Assignee
                {isEmployee && (
                  <span className="ml-1 rounded bg-[#DEEBFF] px-1 text-[9px] font-bold uppercase tracking-wide text-[#0747A6]">
                    Locked
                  </span>
                )}
              </label>
              {isLoadingAssignees ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B778C]" />
                  <span className="text-sm text-[#A5ADBA]">Loading…</span>
                </div>
              ) : (
                <select
                  id="ci-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={isEmployee}
                  className={`w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none focus:border-[#0A89CD] focus:bg-white ${
                    isEmployee ? 'cursor-not-allowed opacity-70' : ''
                  }`}
                >
                  {/* Only show Unassigned for SM/Manager */}
                  {!isEmployee && <option value="">Unassigned</option>}

                  {assigneeOptions.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                      {a.systemRole === 'Admin/Manager' ? ' · Manager' : ''}
                    </option>
                  ))}
                </select>
              )}
              {isEmployee && (
                <p className="mt-1 text-[10px] text-[#6B778C]">
                  Employees can only assign to themselves.
                </p>
              )}
            </div>

            {/* Parent — hidden for Epics, smart-filtered for all others */}
            {showParentDropdown && (
              <div>
                <label
                  htmlFor="ci-parent"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
                >
                  Parent{' '}
                  {type === 'Subtask' && (
                    <span className="text-[#DE350B]">*</span>
                  )}
                </label>
                <select
                  id="ci-parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none focus:border-[#0A89CD] focus:bg-white"
                >
                  <option value="">
                    {type === 'Subtask' ? '— Select a Task —' : 'None'}
                  </option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {requiredParentType && (
                  <p className="mt-1 text-[10px] text-[#6B778C]">
                    {type === 'Subtask' ? 'Required · ' : 'Optional · '}
                    {`${type}s link to ${PARENT_LABEL_FOR[type]}s`}
                  </p>
                )}
                {showParentDropdown && parentOptions.length === 0 && (
                  <p className="mt-1 text-[10px] text-[#97A0AF]">
                    No {requiredParentType}s found on this sprint.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Confidential toggle (Manager only) ── */}
          {isManager && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2.5 transition-colors hover:bg-[#F4F5F7]">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="h-4 w-4 rounded border-[#C1C7D0] accent-[#DE350B]"
              />
              <Lock className="h-4 w-4 text-[#DE350B]" />
              <span className="text-sm font-medium text-[#172B4D]">
                Mark as confidential
              </span>
              <span className="ml-auto text-[10px] text-[#6B778C]">
                Visible to managers &amp; assignee only
              </span>
            </label>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-2 border-t border-[#F4F5F7] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[#42526E] transition-colors hover:bg-[#F4F5F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0747A6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0A3D8F] disabled:opacity-70"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateIssueModal;
