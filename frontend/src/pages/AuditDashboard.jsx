import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  GitCommitHorizontal,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Clock,
  Zap,
  CheckCircle2,
  Loader2,
  CalendarDays,
  Shield,
  ChevronRight,
  FileText,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import { fetchAllSprints } from '../features/sprints/sprintSlice';
import { fetchSprintAudits, clearAuditLogs } from '../features/audits/auditSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  CREATE: {
    icon: Plus,
    label: 'Created',
    bg: 'bg-[#E3FCEF]',
    text: 'text-[#006644]',
    ring: 'ring-1 ring-[#36A15D]/20',
    dot: 'bg-[#36A15D]',
    iconColor: 'text-[#36A15D]',
  },
  UPDATE: {
    icon: Pencil,
    label: 'Updated',
    bg: 'bg-[#DEEBFF]',
    text: 'text-[#0747A6]',
    ring: 'ring-1 ring-[#0747A6]/10',
    dot: 'bg-[#0747A6]',
    iconColor: 'text-[#0747A6]',
  },
  DELETE: {
    icon: Trash2,
    label: 'Deleted',
    bg: 'bg-[#FFEBE6]',
    text: 'text-[#DE350B]',
    ring: 'ring-1 ring-[#DE350B]/10',
    dot: 'bg-[#DE350B]',
    iconColor: 'text-[#DE350B]',
  },
};

const SPRINT_STATUS_ICON = { ACTIVE: Zap, PENDING: Clock, COMPLETED: CheckCircle2 };
const SPRINT_STATUS_COLOR = {
  ACTIVE: 'text-[#006644]',
  PENDING: 'text-amber-600',
  COMPLETED: 'text-slate-400',
};

const formatTs = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ─── Git-style Diff Viewer ────────────────────────────────────────────────────
const FIELD_LABELS = {
  title: 'Title',
  description: 'Description',
  type: 'Issue Type',
  status: 'Status',
  assigneeId: 'Assignee ID',
  parentId: 'Parent ID',
  isConfidential: 'Confidential',
};

const formatDiffValue = (val) => {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const DiffViewer = ({ changes, action }) => {
  if (!changes) return null;

  if (action === 'CREATE') {
    return (
      <div className="mt-2 rounded-lg border border-[#36A15D]/20 bg-[#E3FCEF]/50 p-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#006644]">
          Initial snapshot
        </p>
        <div className="flex flex-col gap-1">
          {Object.entries(changes)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([key, val]) => (
              <div key={key} className="flex items-baseline gap-2 font-mono text-[11px]">
                <span className="w-20 flex-shrink-0 text-[#6B778C]">{key}</span>
                <span className="rounded px-1 bg-[#E3FCEF] text-[#006644]">+ {String(val)}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (action === 'DELETE') {
    return (
      <div className="mt-2 rounded-lg border border-[#DE350B]/20 bg-[#FFEBE6]/50 p-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#DE350B]">
          Final state before deletion
        </p>
        <div className="flex flex-col gap-1">
          {Object.entries(changes)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([key, val]) => (
              <div key={key} className="flex items-baseline gap-2 font-mono text-[11px]">
                <span className="w-20 flex-shrink-0 text-[#6B778C]">{key}</span>
                <span className="rounded px-1 bg-[#FFEBE6] text-[#DE350B] line-through">
                  − {String(val)}
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (action === 'UPDATE') {
    const entries = Object.entries(changes);
    if (entries.length === 0) return null;
    return (
      <div className="mt-2 rounded-lg border border-[#DFE1E6] bg-[#F4F5F7]/60 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6B778C]">
          Field diff
        </p>
        <div className="flex flex-col gap-2.5">
          {entries.map(([field, { old: oldVal, new: newVal }]) => (
            <div key={field}>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#42526E]">
                {FIELD_LABELS[field] || field}
              </span>
              <div className="flex flex-col gap-1 font-mono text-[11px]">
                <span className="rounded px-2 py-0.5 bg-[#FFEBE6] text-[#DE350B] line-through">
                  − {formatDiffValue(oldVal)}
                </span>
                <span className="rounded px-2 py-0.5 bg-[#E3FCEF] text-[#006644]">
                  + {formatDiffValue(newVal)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

// ─── Audit Log Entry ──────────────────────────────────────────────────────────
const AuditEntry = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
  const ActionIcon = cfg.icon;

  const issueKey = log.Task?.issueKey || log.changes?.issueKey || `#${log.changes?.id || '?'}`;
  const title = log.Task?.title || log.changes?.title || 'Deleted Issue';
  const actor = log.User?.name || 'System';

  return (
    <div className="flex gap-3 py-4">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg} ${cfg.ring}`}>
          <ActionIcon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
        </div>
        <div className="mt-1 flex-1 border-l border-dashed border-[#DFE1E6]" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          {/* Action badge */}
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
            {log.action}
          </span>

          {/* Issue key */}
          <span className="font-mono text-[11px] font-semibold text-[#97A0AF]">{issueKey}</span>

          {/* Title */}
          <span className="truncate text-sm font-semibold text-[#172B4D]">{title}</span>

          {/* Expand */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[#6B778C] hover:text-[#172B4D] transition-colors"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {expanded ? 'Collapse' : 'Show diff'}
          </button>
        </div>

        <div className="mt-1 flex items-center gap-3 text-[11px] text-[#6B778C]">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {actor}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTs(log.createdAt)}
          </span>
        </div>

        {expanded && <DiffViewer changes={log.changes} action={log.action} />}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AuditDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { sprints, isLoading: sprintsLoading } = useSelector((s) => s.sprint);
  const { logs, selectedSprint, isLoading: logsLoading, error } = useSelector((s) => s.audit);
  const isTemporalSM = user?.isTemporalScrumMaster === true;

  const isManager = user?.systemRole === 'Admin/Manager';
  const canAccess = isManager || isTemporalSM;

  const [activeSprint, setActiveSprint] = useState(null);

  useEffect(() => {
    dispatch(fetchAllSprints());
    return () => { dispatch(clearAuditLogs()); };
  }, [dispatch]);

  const handleSelectSprint = (sprint) => {
    setActiveSprint(sprint);
    dispatch(fetchSprintAudits(sprint.id));
  };

  if (!canAccess) {
    return (
      <Layout pageTitle="Audit Logs">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Shield className="h-12 w-12 text-[#C1C7D0]" />
          <p className="font-semibold text-[#6B778C]">Access Restricted</p>
          <p className="text-sm text-[#97A0AF]">Audit logs are only available to Managers and the active Scrum Master.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="Audit Logs">
      <div className="flex h-full gap-6">

        {/* ── Left: Sprint Selector ─────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0">
          <div className="rounded-2xl border border-[#DFE1E6] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#DFE1E6] bg-[#F4F5F7]/60 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B778C]">
                Select Sprint
              </p>
            </div>

            {sprintsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#0A89CD]" />
              </div>
            ) : (
              <nav className="flex flex-col divide-y divide-[#DFE1E6]/60 overflow-y-auto max-h-[70vh]">
                {sprints.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-[#97A0AF]">No sprints yet</p>
                )}
                {sprints.map((s) => {
                  const isSelected = activeSprint?.id === s.id;
                  const StatusIcon = SPRINT_STATUS_ICON[s.status] || Clock;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSprint(s)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${isSelected ? 'bg-[#DEEBFF]' : 'hover:bg-[#F4F5F7]'}`}
                    >
                      <StatusIcon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${SPRINT_STATUS_COLOR[s.status] || 'text-[#6B778C]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isSelected ? 'text-[#0747A6]' : 'text-[#172B4D]'}`}>
                          {s.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#97A0AF]">
                          <CalendarDays className="h-3 w-3" />
                          {s.startDate} → {s.endDate}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </aside>

        {/* ── Right: Audit Ledger ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {!activeSprint ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#DFE1E6] bg-white">
              <FileText className="h-10 w-10 text-[#C1C7D0]" />
              <p className="font-semibold text-[#6B778C]">Select a sprint to view its audit ledger</p>
              <p className="text-sm text-[#97A0AF]">All task creates, updates, and deletions are recorded here.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DFE1E6] bg-white shadow-sm">
              {/* Ledger header */}
              <div className="flex items-center justify-between border-b border-[#DFE1E6] bg-[#F4F5F7]/60 px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <GitCommitHorizontal className="h-4 w-4 text-[#0A89CD]" />
                    <h2 className="text-sm font-bold text-[#172B4D]">
                      {selectedSprint?.name || activeSprint.name}
                    </h2>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B778C]">
                    {logs.length} audit event{logs.length !== 1 ? 's' : ''} recorded
                  </p>
                </div>
                <button
                  onClick={() => dispatch(fetchSprintAudits(activeSprint.id))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE1E6] bg-white px-3 py-1.5 text-xs font-semibold text-[#42526E] transition-all hover:border-[#0A89CD]/30 hover:shadow-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin text-[#0A89CD]' : 'text-[#97A0AF]'}`} />
                  Refresh
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-[#FFBDAD]/60 bg-[#FFEBE6]/80 px-4 py-3 text-sm text-[#DE350B]">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Log list */}
              <div className="px-6 py-2 divide-y divide-[#DFE1E6]/40">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-[#0A89CD]" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <GitCommitHorizontal className="h-10 w-10 text-[#C1C7D0]" />
                    <p className="text-sm font-semibold text-[#6B778C]">No audit events yet</p>
                    <p className="text-xs text-[#97A0AF]">Create, edit, or delete issues on this sprint's board to see events here.</p>
                  </div>
                ) : (
                  logs.map((log) => <AuditEntry key={log.id} log={log} />)
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default AuditDashboard;
