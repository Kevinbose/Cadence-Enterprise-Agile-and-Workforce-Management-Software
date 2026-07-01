import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Search,
  Shield,
  Users,
  X,
  Clock,
  GitCommit,
  Fingerprint,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  ShieldCheck,
  ChevronDown,
  Filter,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import {
  fetchWorkforceSummary,
  fetchEmployeeDossier,
  clearDossier,
  setActiveYear,
  setActiveQuarter,
} from '../features/intelligence/intelligenceSlice';

/* ─── Avatar color palette ────────────────────────────────────────────────── */
const AVATAR_PALETTE = [
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-emerald-600',
  'from-violet-500 to-purple-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
];

const avatarGradient = (name = '') => {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
};

/* ── Available years for the time-machine filter ─────────────────────────── */
const AVAILABLE_YEARS = [
  new Date().getFullYear() - 2,
  new Date().getFullYear() - 1,
  new Date().getFullYear(),
];

const QUARTERS = [
  { value: 'Q1', label: 'Q1 (Jan–Mar)' },
  { value: 'Q2', label: 'Q2 (Apr–Jun)' },
  { value: 'Q3', label: 'Q3 (Jul–Sep)' },
  { value: 'Q4', label: 'Q4 (Oct–Dec)' },
];

/* ── Shared dropdown style ───────────────────────────────────────────────── */
const dropdownCls =
  'appearance-none rounded-xl border border-[#DFE1E6] bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-[#172B4D] focus:border-[#0A89CD] focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-150 cursor-pointer';

/* ── Diff entry formatted like a high-end IDE Git diff viewer ──────────── */
const DiffEntry = ({ entry }) => {
  const changes = entry.changes || {};
  const fields = Object.keys(changes).filter((f) => f === 'title' || f === 'description');
  if (fields.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#DFE1E6]/75 bg-white shadow-sm overflow-hidden mb-3.5">
      {/* Mini Git diff header */}
      <div className="flex items-center justify-between bg-slate-50/75 px-3.5 py-2 border-b border-[#DFE1E6]/60 text-[10px] font-mono text-[#5E6C84]">
        <div className="flex items-center gap-2">
          <GitCommit className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-extrabold text-[#172B4D]">
            {entry.issueKey || `Task #${entry.taskId}`}
          </span>
          <span className="text-slate-300">·</span>
          <span className="truncate max-w-[200px]" title={entry.taskTitle}>
            {entry.taskTitle}
          </span>
        </div>
        <span className="font-semibold">
          {new Date(entry.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      {/* Code diff container */}
      <div className="p-3.5 font-mono text-[11px] space-y-3 leading-relaxed bg-[#FAFBFC]/50">
        {fields.map((field) => {
          const diff = changes[field] || {};
          return (
            <div key={field} className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#0052CC] block mb-1">
                diff --git a/{field}
              </span>
              {diff.old !== undefined && (
                <div className="flex items-start bg-red-50 border-l-2 border-red-500 px-2.5 py-1 text-red-800 rounded-r select-none break-all font-semibold">
                  <span className="text-red-500 font-bold mr-2">-</span>
                  <span>{String(diff.old || '(empty)')}</span>
                </div>
              )}
              {diff.new !== undefined && (
                <div className="flex items-start bg-emerald-50 border-l-2 border-emerald-500 px-2.5 py-1 text-emerald-800 rounded-r select-none break-all font-semibold">
                  <span className="text-emerald-500 font-bold mr-2">+</span>
                  <span>{String(diff.new || '(empty)')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Timesheet Row with Inline Collapsible Biometrics ─────────────────────── */
const AnomalyRow = ({ a }) => {
  const [showPhotos, setShowPhotos] = useState(false);

  const getStatusBadgeStyles = (status, autoClosed) => {
    if (status === 'ABSENT') {
      return 'bg-red-50 text-red-700 border border-red-200/50';
    }
    if (autoClosed) {
      return 'bg-amber-50 text-amber-700 border border-amber-200/50';
    }
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200/50';
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-[#DFE1E6]/75 bg-white p-3.5 hover:bg-slate-50/50 transition-colors"
    >
      <div className="flex items-start gap-3.5">
        <div className={`rounded-xl p-2 mt-0.5 ${
          a.systemAutoClosed ? 'bg-amber-50 text-amber-600 border border-amber-100' :
          a.status === 'ABSENT' ? 'bg-red-50 text-red-600 border border-red-100' :
          'bg-emerald-50 text-emerald-600 border border-emerald-100'
        }`}>
          {a.systemAutoClosed || a.status === 'ABSENT' ? (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-[#172B4D]">
              {new Date(a.date).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                getStatusBadgeStyles(a.status, a.systemAutoClosed)
              }`}
            >
              {a.systemAutoClosed ? 'AUTO-CLOSED BY SWEEP' : a.status}
            </span>

            {(a.punchInPhoto || a.punchOutPhoto) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPhotos(!showPhotos);
                }}
                onMouseEnter={() => setShowPhotos(true)}
                onMouseLeave={() => setShowPhotos(false)}
                className="inline-flex items-center gap-1 rounded-full bg-[#EAE6FF] text-[#5243AA] border border-[#C0B6F2] hover:bg-[#DED9FA] px-2.5 py-0.5 text-[9px] font-extrabold uppercase transition-colors shadow-sm cursor-pointer"
              >
                <span>📸 Verified</span>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-[#5E6C84] font-medium leading-relaxed">
            {Number(a.workHours).toFixed(1)} hrs recorded.
            {a.adjudicatorName && (
              <span className="block mt-1 text-[#0052CC] font-bold text-[10px]">
                🛡 Adjudicated by: {a.adjudicatorName}
              </span>
            )}
            {a.systemAutoClosed ? (
              a.regularizationReason ? (
                <span className="block mt-2 bg-slate-50 p-2.5 rounded-lg border border-[#DFE1E6]/50 text-[#42526E] italic">
                  "{a.regularizationReason}"
                </span>
              ) : (
                <span className="block mt-1 text-red-500 font-bold text-[10px]">
                  ⚠ Failed to close workspace shift before midnight.
                </span>
              )
            ) : null}
          </p>
        </div>
      </div>

      {showPhotos && (a.punchInPhoto || a.punchOutPhoto) && (
        <div className="mt-3 ml-11 border-t border-[#DFE1E6]/60 pt-3 max-w-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#5E6C84] mb-2 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Biometric Gate Record
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-center">
            {a.punchInPhoto ? (
              <div>
                <img
                  src={a.punchInPhoto}
                  alt="Punch In Biometric"
                  className="w-full aspect-[4/3] rounded-lg border border-[#DFE1E6]/80 object-cover shadow-sm bg-slate-100"
                />
                <span className="text-[8px] font-bold text-[#5E6C84] uppercase tracking-wider mt-1 block">In Capture</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border border-[#DFE1E6]/75 bg-slate-50 text-[8px] text-[#5E6C84] font-semibold">
                No In Photo
              </div>
            )}

            {a.punchOutPhoto ? (
              <div>
                <img
                  src={a.punchOutPhoto}
                  alt="Punch Out Biometric"
                  className="w-full aspect-[4/3] rounded-lg border border-[#DFE1E6]/80 object-cover shadow-sm bg-slate-100"
                />
                <span className="text-[8px] font-bold text-[#5E6C84] uppercase tracking-wider mt-1 block">Out Capture</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border border-[#DFE1E6]/75 bg-slate-50 text-[8px] text-[#5E6C84] font-semibold">
                No Out Photo
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Employee Dossier Slide-over Drawer ─────────────────────────────────── */
const DossierDrawer = ({ onClose, activeYear, activeQuarter }) => {
  const { selectedDossier, isDossierLoading } = useSelector((s) => s.intelligence);

  if (!selectedDossier && !isDossierLoading) return null;

  const emp = selectedDossier?.employee;
  const diffs = selectedDossier?.auditDiffs || [];
  const anomalies = selectedDossier?.anomalies || [];
  const attendanceHistory = selectedDossier?.attendanceHistory || [];
  const meta = selectedDossier?.meta;

  const periodLabel = meta?.quarter
    ? `${QUARTERS.find(q => q.value === meta.quarter)?.label || meta.quarter} ${meta.year}`
    : meta?.year
    ? `Full Year ${meta.year}`
    : 'All Time';

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden" aria-modal="true">
      {/* smooth blur backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* drawer container */}
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-slide-in-right overflow-hidden border-l border-[#DFE1E6]">
        {/* Profile Card Header */}
        <div className="flex-shrink-0 border-b border-[#DFE1E6] bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-slate-50/50 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${emp?.name ? avatarGradient(emp.name) : 'from-blue-500 to-indigo-600'} text-white font-extrabold text-sm shadow-md ring-2 ring-white`}>
                {emp?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#172B4D] leading-snug">{emp?.name || '—'}</h2>
                <p className="text-[11px] text-[#5E6C84] font-medium mt-0.5">{emp?.email || ''}</p>
                {/* Period scope badge */}
                <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-[#0052CC] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">
                  <Filter className="h-2.5 w-2.5" />
                  {periodLabel}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-[#F4F5F7] text-[#5E6C84] transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-[#DFE1E6]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {isDossierLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#0A89CD]" />
            <p className="text-xs font-semibold text-[#5E6C84]">Compiling Profile Dossier...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7 scrollbar-thin">

            {/* Scope change git-diff feed */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] mb-3.5 flex items-center gap-2">
                <GitCommit className="h-4.5 w-4.5 text-[#0747A6]" />
                Git-Diff Audit logs
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-[#42526E]">
                  {diffs.length}
                </span>
              </h3>
              {diffs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/30 p-6 text-center text-xs text-[#5E6C84] font-semibold">
                  No title or description changes on record for this period.
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {diffs.map((entry) => (
                    <DiffEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </section>

            {/* Timesheet anomalies */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] mb-3.5 flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-rose-500" />
                Work Anomalies
                <span className="ml-1 rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[9px] font-extrabold">
                  {anomalies.length}
                </span>
              </h3>
              {anomalies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/30 p-6 text-center text-xs text-[#5E6C84] font-semibold">
                  No auto-closed sessions or absent logs in this period.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                  {anomalies.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3.5 rounded-xl border border-[#DFE1E6]/75 bg-white p-3.5 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className={`rounded-xl p-2 mt-0.5 ${a.systemAutoClosed ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#172B4D]">
                            {new Date(a.date).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${a.status === 'ABSENT'
                              ? 'bg-red-50 text-red-700 border border-red-200/50'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/50'
                              }`}
                          >
                            {a.systemAutoClosed ? 'AUTO-CLOSED BY SWEEP' : a.status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-[#5E6C84] font-medium leading-relaxed">
                          {Number(a.workHours).toFixed(1)} hrs recorded.
                          {a.regularizationReason ? (
                            <span className="block mt-2 bg-slate-50 p-2.5 rounded-lg border border-[#DFE1E6]/50 text-[#42526E] italic">
                              "{a.regularizationReason}"
                            </span>
                          ) : (
                            <span className="block mt-1 text-red-500 font-bold text-[10px]">
                              ⚠ Failed to close workspace shift before midnight.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Attendance Section with Biometrics */}
            <section className="border-t border-[#DFE1E6]/60 pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] mb-3.5 flex items-center gap-2">
                <Fingerprint className="h-4.5 w-4.5 text-[#0052CC]" />
                Attendance History
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-[#42526E]">
                  {attendanceHistory.length}
                </span>
              </h3>
              {attendanceHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/30 p-6 text-center text-xs text-[#5E6C84] font-semibold">
                  No attendance history logs found for this period.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                  {attendanceHistory.map((a) => (
                    <AnomalyRow key={a.id} a={a} />
                  ))}
                </div>
              )}
            </section>

            {/* Previous Comments Section */}
            <section className="space-y-4 border-t border-[#DFE1E6]/60 pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] flex items-center gap-2">
                <MessageSquare className="h-4.5 w-4.5 text-[#0747A6]" />
                Previous Evaluations
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-[#42526E]">
                  {selectedDossier?.previousComments?.length || 0}
                </span>
              </h3>
              {!selectedDossier?.previousComments || selectedDossier.previousComments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/30 p-6 text-center text-xs text-[#5E6C84] font-semibold">
                  No evaluations on record from completed sprints in this period.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(
                    selectedDossier.previousComments.reduce((groups, comment) => {
                      const sprintName = comment.sprint?.name || 'Completed Sprint';
                      if (!groups[sprintName]) groups[sprintName] = [];
                      groups[sprintName].push(comment);
                      return groups;
                    }, {})
                  ).map(([sprintName, sprintComments]) => (
                    <details
                      key={sprintName}
                      className="group/details rounded-2xl border border-[#DFE1E6]/75 bg-[#FAFBFC] overflow-hidden transition-all duration-300 shadow-sm"
                    >
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none font-bold text-xs text-[#172B4D] hover:bg-slate-100/40 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0A89CD]" />
                          <span>{sprintName}</span>
                          <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[9px] font-extrabold text-[#42526E]">
                            {sprintComments.length} {sprintComments.length === 1 ? 'eval' : 'evals'}
                          </span>
                        </div>
                        <span className="text-[#6B778C] text-[10px] font-extrabold transition-transform duration-300 group-open/details:rotate-90">
                          ▶
                        </span>
                      </summary>
                      <div className="border-t border-[#DFE1E6]/50 bg-white p-4.5 space-y-4 max-h-80 overflow-y-auto scrollbar-thin">
                        {sprintComments.map((c) => {
                          const isPositive = c.evaluationTier === 'Positive';

                          const lineagePath = [];
                          if (c.hierarchy?.epic) lineagePath.push({ ...c.hierarchy.epic, style: 'bg-[#EAE6FF] text-[#5243AA] border-[#C0B6F2]/30' });
                          if (c.hierarchy?.story) lineagePath.push({ ...c.hierarchy.story, style: 'bg-[#E3FCEF] text-[#006644] border-[#ABF5D1]/30' });
                          if (c.hierarchy?.task) lineagePath.push({ ...c.hierarchy.task, style: 'bg-[#DEEBFF] text-[#0747A6] border-[#B3D4FF]/30' });
                          if (c.hierarchy?.subtask) lineagePath.push({ ...c.hierarchy.subtask, style: 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6]/30' });

                          return (
                            <div
                              key={c.id}
                              className={`rounded-2xl border p-4 text-xs transition-all shadow-sm ${isPositive
                                ? 'bg-gradient-to-br from-emerald-500/[0.01] to-emerald-500/[0.02] border-emerald-200'
                                : 'bg-gradient-to-br from-rose-500/[0.01] to-rose-500/[0.02] border-rose-200'
                                }`}
                            >
                              <div className="flex items-center justify-between mb-3.5">
                                <div className="flex items-center gap-2">
                                  {isPositive ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                      <ThumbsUp className="h-3 w-3" /> UPVOTE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                      <ThumbsDown className="h-3 w-3" /> DOWNVOTE
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[#6B778C] font-semibold text-[10px]">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {new Date(c.createdAt).toLocaleDateString('en-IN', {
                                      day: '2-digit', month: 'short', year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>

                              <p className={`font-bold text-sm leading-relaxed mb-4 tracking-tight ${isPositive ? 'text-[#172B4D]' : 'text-[#DE350B]'}`}>
                                "{c.content}"
                              </p>

                              {lineagePath.length > 0 && (
                                <div className="rounded-xl bg-slate-50/50 border border-[#DFE1E6]/50 p-3">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5E6C84] block mb-2">Hierarchy Lineage</span>
                                  <div className="flex flex-wrap items-center gap-1.5 select-none">
                                    {lineagePath.map((item, idx) => (
                                      <React.Fragment key={item.id}>
                                        {idx > 0 && <span className="text-slate-300 font-bold text-xs">➔</span>}
                                        <span
                                          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold shadow-sm ${item.style}`}
                                          title={`${item.type}: ${item.title}`}
                                        >
                                          {item.issueKey}
                                        </span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT — Manager Hub Quarterly Tactical Cockpit
   ═══════════════════════════════════════════════════════════════════════════ */
const ManagerHub = () => {
  const dispatch = useDispatch();
  const { workforce, isLoading, selectedDossier, error, activeYear, activeQuarter } =
    useSelector((s) => s.intelligence);

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Fetch workforce whenever year or quarter changes
  useEffect(() => {
    dispatch(fetchWorkforceSummary({ year: activeYear, quarter: activeQuarter }));
  }, [dispatch, activeYear, activeQuarter]);

  /* filtered workforce logic */
  const filtered = useMemo(() => {
    let list = workforce;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [workforce, search]);

  const handleRowClick = (emp) => {
    setSelectedUserId(emp.id);
    dispatch(fetchEmployeeDossier({ userId: emp.id, year: activeYear, quarter: activeQuarter }));
  };

  const handleCloseDrawer = () => {
    setSelectedUserId(null);
    dispatch(clearDossier());
  };

  const handleYearChange = (e) => {
    dispatch(setActiveYear(Number(e.target.value)));
  };

  const handleQuarterChange = (e) => {
    dispatch(setActiveQuarter(e.target.value));
  };

  const quarterLabel = QUARTERS.find(q => q.value === activeQuarter)?.label || activeQuarter;

  return (
    <Layout pageTitle="Manager Hub — Workforce Intelligence Cockpit">
      <div className="mx-auto max-w-6xl space-y-6 px-1 py-2">
        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 animate-bounce text-red-500" />
            {error}
          </div>
        )}

        {/* ── COCKPIT HEADER ─────────────────────────────────────────────── */}
        <div
          className="relative rounded-2xl border border-[#DFE1E6]/75 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-slate-50/50 p-6 px-8 shadow-sm overflow-hidden"
        >
          {/* Subtle light background highlight circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-100/40 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 left-1/3 w-36 h-36 rounded-full bg-purple-100/30 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br from-[#0A89CD]/15 to-[#0747A6]/15 ring-1 ring-blue-500/10 shadow-sm flex items-center justify-center"
              >
                <Shield className="h-6 w-6 text-[#0A89CD]" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-[#172B4D] tracking-tight leading-none">
                    Workforce Intelligence Cockpit
                  </h1>
                  <span
                    className="text-[9px] font-black tracking-widest text-[#0052CC] uppercase bg-[#E3FCEF] border border-[#36A15D]/20 px-2 py-0.5 rounded-md"
                  >
                    Active Sync
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5E6C84] font-medium flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  {workforce.length} active employee profiles · {quarterLabel} {activeYear}
                </p>
              </div>
            </div>

            {/* Controls: Year + Quarter + Search */}
            <div className="flex flex-wrap items-center gap-2.5">

              {/* ── TIME MACHINE FILTERS ─────────────────────────────── */}
              <div className="flex items-center gap-1.5 bg-white/60 border border-[#DFE1E6]/80 rounded-xl px-3 py-1.5 shadow-sm">
                <ChevronDown className="h-3 w-3 text-[#5E6C84] flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] mr-1">Period</span>
                <div className="relative">
                  <select
                    id="manager-hub-year"
                    value={activeYear}
                    onChange={handleYearChange}
                    className={dropdownCls}
                    style={{ minWidth: '72px' }}
                  >
                    {AVAILABLE_YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#5E6C84]" />
                </div>

                <div className="relative">
                  <select
                    id="manager-hub-quarter"
                    value={activeQuarter}
                    onChange={handleQuarterChange}
                    className={dropdownCls}
                    style={{ minWidth: '120px' }}
                  >
                    {QUARTERS.map(q => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#5E6C84]" />
                </div>
              </div>

              {/* search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#97A0AF]" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-[#DFE1E6] bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-[#172B4D] placeholder-[#97A0AF] focus:border-[#0A89CD] focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-150"
                  style={{ minWidth: '190px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── WORKFORCE GRID TABLE CARD ─────────────────────────────────── */}
        <div className="rounded-2xl border border-[#DFE1E6]/75 bg-white shadow-sm overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 flex-col gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-[#0A89CD]" />
              <span className="text-xs font-semibold text-[#5E6C84]">Querying SQL telemetry for {quarterLabel} {activeYear}...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-[#DFE1E6]/60 shadow-sm text-slate-400 mb-3">
                <Users className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-xs font-extrabold text-[#172B4D]">No Matching Telemetry</p>
              <p className="text-[11px] text-[#6B778C] mt-1 max-w-xs leading-normal">
                There are no employee profiles matching the search query.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DFE1E6]/70 bg-slate-50/20">
                    <th className="p-4 px-6 font-extrabold text-[#5E6C84] uppercase tracking-wider text-[10px]">
                      Employee Details
                    </th>
                    <th className="p-4 px-6 font-extrabold text-[#5E6C84] uppercase tracking-wider text-[10px]">
                      Corporate ID
                    </th>
                    <th className="p-4 px-6 font-extrabold text-[#5E6C84] uppercase tracking-wider text-[10px] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBECF0]">
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => handleRowClick(emp)}
                      className={`hover:bg-slate-50/60 cursor-pointer transition-colors duration-150 ${
                        selectedUserId === emp.id ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Profile Details */}
                      <td className="p-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarGradient(emp.name)} text-xs font-extrabold text-white shadow-sm`}
                          >
                            {emp.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-extrabold text-[#172B4D] text-xs leading-none">
                              {emp.name}
                            </p>
                            <p className="text-[11px] text-[#5E6C84] mt-1">
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="p-4 px-6">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAFBFC] border border-[#DFE1E6]/80 text-[#42526E]">
                          {emp.employeeId || '—'}
                        </span>
                      </td>

                      {/* CTA Arrow */}
                      <td className="p-4 px-6 text-right">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 hover:bg-[#0747A6] text-slate-400 hover:text-white border border-[#DFE1E6]/50 shadow-sm transition-all duration-150">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide-out drawer details page */}
      {(selectedDossier || selectedUserId) && (
        <DossierDrawer
          onClose={handleCloseDrawer}
          activeYear={activeYear}
          activeQuarter={activeQuarter}
        />
      )}
    </Layout>
  );
};

export default ManagerHub;
