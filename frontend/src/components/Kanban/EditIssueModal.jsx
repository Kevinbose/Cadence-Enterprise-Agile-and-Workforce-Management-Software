import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Lock, Loader2, Users, AlertTriangle, Pencil, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  editIssue,
  clearKanbanError,
  fetchEligibleAssignees,
  fetchBoard,
} from '../../features/kanban/kanbanSlice';
import scrumApi from '../../features/scrum/scrumService';

const ALL_TYPES = ['Epic', 'Story', 'Task', 'Subtask'];

const PARENT_TYPE_FOR = {
  Subtask: 'Task',
  Task: 'Story',
  Story: 'Epic',
  Epic: null,
};

const PARENT_LABEL_FOR = {
  Subtask: 'Task',
  Task: 'Story',
  Story: 'Epic',
};

const TYPE_LOZENGE = {
  Epic: 'bg-[#EAE6FF] text-[#5243AA]',
  Story: 'bg-[#E3FCEF] text-[#006644]',
  Task: 'bg-[#DEEBFF] text-[#0747A6]',
  Subtask: 'bg-[#DFE1E6] text-[#42526E]',
};

const EditIssueModal = ({ task, onClose }) => {
  const dispatch = useDispatch();
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

  const allowedTypes = useMemo(() => {
    if (isManager) return ALL_TYPES;
    if (isSM) return ['Story', 'Task', 'Subtask'];
    return ['Task', 'Subtask'];
  }, [isManager, isSM]);

  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [type, setType] = useState(task.type || allowedTypes[0]);
  const [assigneeId, setAssigneeId] = useState(
    task.assigneeId ? String(task.assigneeId) : isEmployee ? String(user?.id ?? '') : ''
  );
  const [parentId, setParentId] = useState(
    task.parentId ? String(task.parentId) : ''
  );
  const [isConfidential, setIsConfidential] = useState(Boolean(task.isConfidential));
  const [validationError, setValidationError] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [vote, setVote] = useState(null); // 'up' or 'down'

  const fetchComments = async () => {
    try {
      setIsLoadingComments(true);
      const { data } = await scrumApi.get(`/comments/${task.id}/comments`);
      if (data.success) {
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !vote) return;

    try {
      const { data } = await scrumApi.post(`/comments/${task.id}/comments`, {
        content: newComment.trim(),
        evaluationTier: vote === 'up' ? 'Positive' : 'Negative (Simple)'
      });
      if (data.success) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
        setVote(null);
        dispatch(fetchBoard());
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  useEffect(() => {
    dispatch(fetchEligibleAssignees());
    dispatch(clearKanbanError());
    fetchComments();
  }, [dispatch, task.id]);

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setType(newType);
    setParentId('');
  };

  const showParentDropdown = type !== 'Epic';
  const requiredParentType = PARENT_TYPE_FOR[type];

  const parentOptions = useMemo(() => {
    const filterType = PARENT_TYPE_FOR[type];
    if (!filterType) return [];

    const options = flatTasks
      .filter((t) => t.type === filterType && t.id !== task.id)
      .map((t) => ({
        id: t.id,
        label: `${t.issueKey} · ${t.title}`,
      }));

    // Keep the currently linked parent visible even if type filters changed mid-edit.
    if (task.parentId && !options.some((o) => o.id === task.parentId)) {
      const currentParent = flatTasks.find((t) => t.id === task.parentId);
      if (currentParent) {
        options.unshift({
          id: currentParent.id,
          label: `${currentParent.issueKey} · ${currentParent.title}`,
        });
      }
    }

    return options;
  }, [type, flatTasks, task.id, task.parentId]);

  const assigneeOptions = useMemo(() => {
    return eligibleAssignees.map((a) => ({
      id: a.id,
      name: a.id === user?.id ? `${a.name} (You)` : a.name,
      systemRole: a.systemRole,
    }));
  }, [eligibleAssignees, user]);

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
    };

    if (isManager) {
      payload.isConfidential = isConfidential;
    }

    const result = await dispatch(editIssue({ id: task.id, data: payload }));
    if (editIssue.fulfilled.match(result)) {
      onClose();
    }
  };

  const displayError = validationError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-issue-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#DFE1E6] bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[#DFE1E6] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0747A6]/10 to-[#0A89CD]/10 ring-1 ring-[#0747A6]/10">
              <Pencil className="h-4 w-4 text-[#0747A6]" />
            </div>
            <div>
              <h2
                id="edit-issue-title"
                className="text-base font-bold text-[#172B4D]"
              >
                Edit Issue
              </h2>
              <p className="font-mono text-[11px] text-[#97A0AF]">{task.issueKey}</p>
            </div>
          </div>
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
              htmlFor="ei-type"
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
                id="ei-type"
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
              htmlFor="ei-title"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
            >
              Title <span className="text-[#DE350B]">*</span>
            </label>
            <input
              id="ei-title"
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
              htmlFor="ei-desc"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
            >
              Description
            </label>
            <textarea
              id="ei-desc"
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
                htmlFor="ei-assignee"
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
                  id="ei-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={isEmployee}
                  className={`w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2 text-sm text-[#172B4D] outline-none focus:border-[#0A89CD] focus:bg-white ${
                    isEmployee ? 'cursor-not-allowed opacity-70' : ''
                  }`}
                >
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
                  htmlFor="ei-parent"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#6B778C]"
                >
                  Parent{' '}
                  {type === 'Subtask' && (
                    <span className="text-[#DE350B]">*</span>
                  )}
                </label>
                <select
                  id="ei-parent"
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
              Save Changes
            </button>
          </div>
        </form>

        {/* ── Activity Thread (Jira-style comments feed) ── */}
        <div className="border-t border-[#DFE1E6] bg-[#FAFBFC] px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-[#42526E]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B778C]">
              Activity Feed ({comments.length})
            </h3>
          </div>

          {isLoadingComments ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-[#6B778C]" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs italic text-[#97A0AF] mb-4">No comments on this issue yet.</p>
          ) : (
            <div className="space-y-3.5 max-h-48 overflow-y-auto mb-4 pr-1">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3 text-xs">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#EAE6FF] font-bold text-[#5243AA]">
                    {c.Author ? c.Author.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1 rounded-lg border border-[#DFE1E6] bg-white p-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#172B4D]">
                        {c.Author ? c.Author.name : 'Unknown'}
                        {c.Author?.systemRole === 'Admin/Manager' && (
                          <span className="ml-1.5 rounded bg-[#FFEBE6] px-1 py-0.5 text-[9px] font-bold text-[#DE350B]">
                            Manager
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-[#97A0AF]">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[#172B4D] leading-normal whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment Input (Managers & SMs only) */}
          {(isManager || isSM) ? (
            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full resize-none rounded-lg border border-[#DFE1E6] bg-white px-3 py-2 text-xs text-[#172B4D] outline-none placeholder:text-[#A5ADBA] focus:border-[#0A89CD]"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mr-1">
                    Rating *
                  </span>
                  <button
                    type="button"
                    onClick={() => setVote('up')}
                    title="Positive Assessment (Green Thumbs Up)"
                    className={`flex items-center justify-center p-1.5 rounded-lg border transition-all ${
                      vote === 'up'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-sm scale-105'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVote('down')}
                    title="Negative Assessment (Red Thumbs Down)"
                    className={`flex items-center justify-center p-1.5 rounded-lg border transition-all ${
                      vote === 'down'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-600 shadow-sm scale-105'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={!newComment.trim() || !vote}
                  className="rounded-lg bg-[#0747A6] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0A3D8F] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Comment
                </button>
              </div>
            </form>
          ) : (
            <p className="text-[10px] italic text-[#97A0AF] border-t border-[#DFE1E6]/50 pt-2.5">
              Commenting is restricted to Scrum Masters and Managers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditIssueModal;
