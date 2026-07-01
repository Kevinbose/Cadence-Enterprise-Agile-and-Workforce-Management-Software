import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Zap,
  Clock,
  CheckCircle2,
  PlayCircle,
  UserCheck,
  RefreshCw,
  AlertCircle,
  Loader2,
  CalendarDays,
  ChevronRight,
  X,
  ShieldCheck,
  Pencil,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import EditSprintModal from '../components/Sprints/EditSprintModal';
import { syncUserSession } from '../features/auth/authSlice';
import {
  fetchAllSprints,
  createSprint,
  startSprint,
  assignScrumMaster,
  clearSprintError,
} from '../features/sprints/sprintSlice';
import { fetchEligibleAssignees } from '../features/kanban/kanbanSlice';

// ─── Status badge config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDING: {
    label: 'Planned',
    icon: Clock,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-1 ring-amber-200',
    dot: 'bg-amber-400',
  },
  ACTIVE: {
    label: 'Active',
    icon: Zap,
    bg: 'bg-[#E3FCEF]',
    text: 'text-[#006644]',
    ring: 'ring-1 ring-[#36A15D]/20',
    dot: 'bg-[#36A15D]',
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    ring: 'ring-1 ring-slate-200',
    dot: 'bg-slate-400',
  },
};

// ─── Modal wrapper ────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B4D]/40 p-4 backdrop-blur-sm">
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#DFE1E6]">
      <div className="flex items-center justify-between border-b border-[#DFE1E6] bg-[#F4F5F7]/60 px-6 py-4">
        <h2 className="text-sm font-bold tracking-tight text-[#172B4D]">{title}</h2>
        <button onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#6B778C] hover:bg-[#EBECF0] hover:text-[#172B4D] transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

// ─── Form input helper ────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-wider text-[#6B778C]">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3.5 py-2.5 text-sm text-[#172B4D] placeholder-[#C1C7D0] outline-none transition-all focus:border-[#0A89CD] focus:bg-white focus:ring-2 focus:ring-[#0A89CD]/20';

// ─── Sprint Row (One Below the Other List Layout) ─────────────────────────────
const SprintRow = ({
  sprint,
  isManager,
  onStart,
  onOpenAssignModal,
  onOpenEditModal,
  onOpen,
}) => {
  const cfg = STATUS_CONFIG[sprint.status] || STATUS_CONFIG.PENDING;
  const canEdit = isManager && (sprint.status === 'PENDING' || sprint.status === 'ACTIVE');
  const isPending = sprint.status === 'PENDING';

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F4F5F7]/40 bg-white">
      {/* 1. Name & Status (cols 1-3) */}
      <div className="md:col-span-3 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <span className="font-mono text-[10px] font-bold text-[#8C9BAE]">ID: {sprint.id}</span>
        </div>
        <h3
          onClick={() => onOpen(sprint.id)}
          className="mt-1.5 font-bold text-[#172B4D] text-sm tracking-tight truncate hover:text-[#0A89CD] cursor-pointer"
        >
          {sprint.name}
        </h3>
      </div>

      {/* 2. Dates (cols 4-6) */}
      <div className="md:col-span-3 flex items-center gap-2 text-xs text-[#6B778C]">
        <CalendarDays className="h-4 w-4 text-[#97A0AF] flex-shrink-0" />
        <span>{sprint.startDate} → {sprint.endDate}</span>
      </div>

      {/* 3. Scrum Master (cols 7-8) */}
      <div className="md:col-span-2 flex items-center gap-2 text-xs text-[#6B778C] overflow-hidden">
        <ShieldCheck className={`h-4 w-4 flex-shrink-0 ${sprint.ScrumMaster ? 'text-[#36A15D]' : 'text-[#97A0AF]'}`} />
        <span className="truncate">
          {sprint.ScrumMaster ? (
            <span>
              <strong className="text-[#172B4D]">{sprint.ScrumMaster.name}</strong> (SM)
            </span>
          ) : (
            <span className="text-[#97A0AF] italic">No Scrum Master</span>
          )}
        </span>
      </div>

      {/* 4. Actions (cols 9-12) */}
      <div className="md:col-span-4 flex items-center justify-end gap-2 whitespace-nowrap">

        {isManager && isPending && (
          <>
            {/* ── Assign SM ── */}
            <button
              onClick={() => onOpenAssignModal(sprint)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#EAE6FF] to-[#D6CFFF] px-3 py-1.5 text-xs font-bold text-[#5243AA] ring-1 ring-[#5243AA]/25 shadow-sm transition-all hover:from-[#DFD8FF] hover:to-[#C9BFFF] hover:shadow-md active:scale-[0.97] whitespace-nowrap"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {sprint.ScrumMaster ? 'Change SM' : 'Assign SM'}
            </button>

            {/* thin vertical rule separating planning controls from Start */}
            <div className="h-5 w-px bg-[#DFE1E6] flex-shrink-0" />

            {/* ── Edit icon — right next to Start Sprint ── */}
            {canEdit && (
              <button
                type="button"
                onClick={() => onOpenEditModal(sprint)}
                title="Edit sprint"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#DFE1E6] bg-[#F4F5F7] text-[#6B778C] hover:border-[#0A89CD]/40 hover:bg-[#DEEBFF] hover:text-[#0052CC] shadow-sm active:scale-[0.95] transition-all flex-shrink-0"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}

            {/* ── Force Start Now ── */}
            <button
              onClick={() => onStart(sprint.id)}
              title="Force Start Now — This will update the start date to today."
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all bg-gradient-to-br from-[#36A15D] to-[#257A44] text-white shadow-md shadow-green-600/20 ring-1 ring-green-600/20 hover:shadow-lg hover:shadow-green-600/30 hover:brightness-110 active:scale-[0.97]"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Force Start Now
            </button>
          </>
        )}

        {/* ── Edit button for ACTIVE sprints (no PENDING block above) ── */}
        {canEdit && !isPending && (
          <button
            type="button"
            onClick={() => onOpenEditModal(sprint)}
            title="Edit sprint"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#DFE1E6] bg-[#F4F5F7] text-[#6B778C] hover:border-[#0A89CD]/40 hover:bg-[#DEEBFF] hover:text-[#0052CC] shadow-sm active:scale-[0.95] transition-all flex-shrink-0"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}

        {/* ── Open Board CTA ── */}
        <button
          onClick={() => onOpen(sprint.id)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#0747A6] to-[#0A3D8F] px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:brightness-110 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.97] whitespace-nowrap"
        >
          Open Board
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

      </div>
    </div>
  );
};

// ─── Assign Scrum Master Modal ────────────────────────────────────────────────
const AssignScrumMasterModal = ({ sprint, teamMembers, onClose, onConfirm }) => {
  const { isSubmitting, error } = useSelector((s) => s.sprint);
  const [selectedUserId, setSelectedUserId] = useState(
    sprint?.ScrumMaster?.id ? String(sprint.ScrumMaster.id) : ''
  );
  const [localErr, setLocalErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setLocalErr('Please select a Scrum Master.');
      return;
    }
    const result = await onConfirm(sprint.id, parseInt(selectedUserId, 10));
    if (!result?.error) onClose();
  };

  return (
    <Modal
      title={sprint?.ScrumMaster ? 'Change Scrum Master' : 'Assign Scrum Master'}
      onClose={onClose}
    >
      <div className="mb-4 rounded-lg border border-[#DEEBFF]/60 bg-[#DEEBFF]/30 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B778C]">Sprint</p>
        <p className="mt-0.5 text-sm font-semibold text-[#172B4D]">{sprint?.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6B778C]">
          <CalendarDays className="h-3.5 w-3.5" />
          {sprint?.startDate} → {sprint?.endDate}
        </p>
      </div>

      {(localErr || error) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-3 text-sm text-[#DE350B]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {localErr || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Scrum Master *">
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setLocalErr('');
            }}
            className={inputCls}
            required
          >
            <option value="">Select a team member…</option>
            {teamMembers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.systemRole})
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs leading-relaxed text-[#6B778C]">
          The Scrum Master leads standups, adjudicates WFH requests, and gains temporal
          elevated privileges for this sprint cycle.
        </p>

        <div className="flex items-center justify-end gap-2 border-t border-[#DFE1E6]/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#DFE1E6] bg-white px-4 py-2 text-sm font-semibold text-[#42526E] hover:bg-[#F4F5F7]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedUserId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#36A15D] to-[#2E8C50] px-5 py-2 text-sm font-bold text-white shadow-md shadow-green-500/20 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Assigning…
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                Confirm Assignment
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Create Sprint Modal ──────────────────────────────────────────────────────
const CreateSprintModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { isSubmitting, error } = useSelector((s) => s.sprint);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [localErr, setLocalErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setLocalErr('All fields are required.');
      return;
    }
    const result = await dispatch(createSprint(form));
    if (!result.error) onClose();
  };

  return (
    <Modal title="Create New Sprint" onClose={onClose}>
      {(localErr || error) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-3 text-sm text-[#DE350B]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {localErr || error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Sprint Name *">
          <input
            type="text"
            value={form.name}
            onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setLocalErr(''); }}
            placeholder="e.g. Sprint 32 — Q3 Feature Build"
            className={inputCls}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date *">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              className={inputCls}
              required
            />
          </Field>
          <Field label="End Date *">
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              className={inputCls}
              required
            />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#DFE1E6]/60 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#DFE1E6] bg-white px-4 py-2 text-sm font-semibold text-[#42526E] hover:bg-[#F4F5F7]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0747A6] to-[#0A3D8F] px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</> : <><Plus className="h-3.5 w-3.5" /> Create Sprint</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const SprintDirectory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { sprints, isLoading, error } = useSelector((s) => s.sprint);
  const { eligibleAssignees } = useSelector((s) => s.kanban);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const isManager = user?.systemRole === 'Admin/Manager';

  useEffect(() => {
    dispatch(fetchAllSprints());
    dispatch(fetchEligibleAssignees());
    dispatch(syncUserSession());
  }, [dispatch]);

  const handleStart = async (sprintId) => {
    const result = await dispatch(startSprint(sprintId));
    if (result.error) dispatch(clearSprintError());
  };

  const handleAssignSM = async (sprintId, scrumMasterId) => {
    const result = await dispatch(assignScrumMaster({ sprintId, scrumMasterId }));
    return result;
  };

  const handleOpenAssignModal = (sprint) => {
    dispatch(clearSprintError());
    setAssignTarget(sprint);
  };

  const handleOpenEditModal = (sprint) => {
    dispatch(clearSprintError());
    setEditTarget(sprint);
  };

  const grouped = useMemo(() => ({
    ACTIVE: sprints.filter((s) => s.status === 'ACTIVE'),
    PENDING: sprints.filter((s) => s.status === 'PENDING'),
    COMPLETED: sprints.filter((s) => s.status === 'COMPLETED'),
  }), [sprints]);

  return (
    <Layout pageTitle="Sprint Directory">
      <div className="mx-auto max-w-7xl px-2">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#172B4D]">Sprint Directory</h1>
            <p className="mt-0.5 text-sm text-[#6B778C]">
              {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} · select a board to open the Kanban view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                dispatch(fetchAllSprints());
                dispatch(syncUserSession());
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE1E6] bg-white px-3.5 py-2 text-xs font-semibold text-[#42526E] shadow-sm transition-all hover:border-[#0A89CD]/30 hover:shadow-md"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#0A89CD]' : 'text-[#97A0AF]'}`} />
              Refresh
            </button>
            {isManager && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0747A6] to-[#0A3D8F] px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-110 hover:shadow-lg active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Sprint
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-3 text-sm text-[#DE350B]">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {isLoading && sprints.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-7 w-7 animate-spin text-[#0A89CD]" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* ACTIVE */}
            {grouped.ACTIVE.length > 0 && (
              <section>
                <h2 className="mb-2.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#006644]">
                  <Zap className="h-3.5 w-3.5" /> Active Sprint
                </h2>
                <div className="overflow-hidden rounded-xl border border-[#DFE1E6]/80 shadow-sm divide-y divide-[#DFE1E6]/60">
                  {grouped.ACTIVE.map((s) => (
                    <SprintRow
                      key={s.id}
                      sprint={s}
                      isManager={isManager}
                      onStart={handleStart}
                      onOpenAssignModal={handleOpenAssignModal}
                      onOpenEditModal={handleOpenEditModal}
                      onOpen={(id) => navigate(`/board/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* PLANNED (DB: PENDING) */}
            {grouped.PENDING.length > 0 && (
              <section>
                <h2 className="mb-2.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-600">
                  <Clock className="h-3.5 w-3.5" /> Planned Sprints
                </h2>
                <div className="overflow-hidden rounded-xl border border-[#DFE1E6]/80 shadow-sm divide-y divide-[#DFE1E6]/60">
                  {grouped.PENDING.map((s) => (
                    <SprintRow
                      key={s.id}
                      sprint={s}
                      isManager={isManager}
                      onStart={handleStart}
                      onOpenAssignModal={handleOpenAssignModal}
                      onOpenEditModal={handleOpenEditModal}
                      onOpen={(id) => navigate(`/board/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* COMPLETED */}
            {grouped.COMPLETED.length > 0 && (
              <section>
                <h2 className="mb-2.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#6B778C]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed Sprints
                </h2>
                <div className="overflow-hidden rounded-xl border border-[#DFE1E6]/80 shadow-sm divide-y divide-[#DFE1E6]/60">
                  {grouped.COMPLETED.map((s) => (
                    <SprintRow
                      key={s.id}
                      sprint={s}
                      isManager={isManager}
                      onStart={handleStart}
                      onOpenAssignModal={handleOpenAssignModal}
                      onOpenEditModal={handleOpenEditModal}
                      onOpen={(id) => navigate(`/board/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {sprints.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#DFE1E6] bg-white py-24">
                <CalendarDays className="h-12 w-12 text-[#C1C7D0]" />
                <p className="mt-4 font-semibold text-[#6B778C]">No sprints found</p>
                {isManager && (
                  <p className="mt-1 text-sm text-[#97A0AF]">Click "Create Sprint" to kick off the first sprint.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateSprintModal
          onClose={() => {
            setCreateOpen(false);
            dispatch(clearSprintError());
          }}
        />
      )}

      {assignTarget && (
        <AssignScrumMasterModal
          sprint={assignTarget}
          teamMembers={eligibleAssignees}
          onClose={() => {
            setAssignTarget(null);
            dispatch(clearSprintError());
          }}
          onConfirm={handleAssignSM}
        />
      )}

      <EditSprintModal
        isOpen={!!editTarget}
        sprint={editTarget}
        onClose={() => {
          setEditTarget(null);
          dispatch(clearSprintError());
        }}
      />
    </Layout>
  );
};

export default SprintDirectory;
