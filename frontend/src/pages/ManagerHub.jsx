import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Search,
  Shield,
  TrendingDown,
  Users,
  X,
  Clock,
  GitCommit,
  Activity,
  Award,
  Sparkles,
  BarChart3,
  Fingerprint,
  RotateCcw,
  CheckCircle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import {
  fetchWorkforceSummary,
  fetchEmployeeDossier,
  clearDossier,
} from '../features/intelligence/intelligenceSlice';

/* ── Trust score colour scheme ─────────────────────────────────────────── */
const trustBadge = (score) => {
  if (score >= 90) return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 shadow-sm shadow-emerald-500/5';
  if (score >= 75) return 'bg-amber-500/10 text-amber-600 border border-amber-500/30 shadow-sm shadow-amber-500/5';
  return 'bg-rose-500/10 text-rose-600 border border-rose-500/30 shadow-sm shadow-rose-500/5 animate-pulse';
};

const trustLabel = (score) => {
  if (score >= 90) return 'Elite Performance';
  if (score >= 75) return 'Optimal Health';
  return 'At Risk / Action Required';
};

/* ── Punctuality dot with premium ping animation ───────────────────────── */
const PunctualityDot = ({ ari }) => {
  const colour =
    ari >= 90 ? 'bg-emerald-500' : ari >= 75 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className="absolute bottom-0 right-0 flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colour}`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 border-2 border-white ${colour}`} />
    </span>
  );
};

/* ── Horizontal gauge bar with glass container and gradient filling ────── */
const GaugeBar = ({ label, value, colorClass, barColorStyle }) => (
  <div className="group/gauge transition-all duration-200">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-bold text-[#42526E] uppercase tracking-widest group-hover/gauge:text-[#0747A6] transition-colors">
        {label}
      </span>
      <span className="text-xs font-extrabold text-[#172B4D] bg-[#FAFBFC] px-1.5 py-0.5 rounded border border-[#DFE1E6]">
        {value}%
      </span>
    </div>
    <div className="h-3 w-full rounded-full bg-slate-100/90 border border-slate-200/50 overflow-hidden p-[2px]">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
        style={{
          width: `${Math.min(100, value)}%`,
          background: barColorStyle || 'linear-gradient(to right, #0A89CD, #0747A6)'
        }}
      />
    </div>
  </div>
);

/* ── Diff entry formatted like a high-end IDE Git diff viewer ──────────── */
const DiffEntry = ({ entry }) => {
  const changes = entry.changes || {};
  const fields = Object.keys(changes).filter((f) => f === 'title' || f === 'description');
  if (fields.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-lg overflow-hidden mb-4">
      {/* Mini Git diff header */}
      <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-b border-slate-800 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <GitCommit className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-semibold text-slate-300">
            {entry.issueKey || `Task #${entry.taskId}`}
          </span>
          <span className="text-slate-500">·</span>
          <span className="truncate max-w-[200px]" title={entry.taskTitle}>
            {entry.taskTitle}
          </span>
        </div>
        <span>
          {new Date(entry.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      {/* Code diff container */}
      <div className="p-3.5 font-mono text-xs space-y-3 leading-relaxed">
        {fields.map((field) => {
          const diff = changes[field] || {};
          return (
            <div key={field} className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#0A89CD] opacity-80 block mb-1">
                diff --git a/{field}
              </span>
              {diff.old !== undefined && (
                <div className="flex items-start bg-red-500/10 border-l-2 border-red-500/80 px-2.5 py-1 text-red-300 rounded-r select-none break-all">
                  <span className="text-red-500 font-bold mr-2">-</span>
                  <span>{String(diff.old || '(empty)')}</span>
                </div>
              )}
              {diff.new !== undefined && (
                <div className="flex items-start bg-emerald-500/10 border-l-2 border-emerald-500/80 px-2.5 py-1 text-emerald-300 rounded-r select-none break-all">
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

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-slate-200/60 bg-[#FAFBFC] p-3.5 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start gap-3.5">
        <div className={`rounded-xl p-2 mt-0.5 ${a.systemAutoClosed ? 'bg-amber-100 text-amber-600' :
          a.status === 'ABSENT' ? 'bg-rose-100 text-rose-600' :
            'bg-emerald-100 text-emerald-600'
          }`}>
          {a.systemAutoClosed || a.status === 'ABSENT' ? (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#172B4D]">
              {new Date(a.date).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a.status === 'ABSENT'
                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                : a.systemAutoClosed
                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
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
                className="inline-flex items-center gap-1 rounded bg-[#EAE6FF] text-[#5243AA] border border-[#C0B6F2] hover:bg-[#DED9FA] px-2 py-0.5 text-[9px] font-extrabold uppercase transition-colors shadow-sm cursor-pointer ml-2"
              >
                <span>📸 Verified</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[#6B778C] font-medium leading-relaxed">
            {Number(a.workHours).toFixed(1)} hrs recorded.
            {a.adjudicatorName && (
              <span className="block mt-0.5 text-[#0747A6] font-bold text-[10px]">
                🛡 Adjudicated by: {a.adjudicatorName}
              </span>
            )}
            {a.systemAutoClosed ? (
              a.regularizationReason ? (
                <span className="block mt-1 bg-white p-2 rounded border border-slate-100 text-[#42526E] italic">
                  "{a.regularizationReason}"
                </span>
              ) : (
                <span className="block mt-0.5 text-rose-500 font-semibold text-[10px]">
                  ⚠ Failed to close workspace shift before midnight.
                </span>
              )
            ) : null}
          </p>
        </div>
      </div>

      {showPhotos && (a.punchInPhoto || a.punchOutPhoto) && (
        <div className="mt-2.5 ml-[42px] border-t border-slate-100 pt-2.5 max-w-sm">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#8993A4] mb-2 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Biometric Gate Record
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {a.punchInPhoto ? (
              <div>
                <img
                  src={a.punchInPhoto}
                  alt="Punch In Biometric"
                  className="w-full aspect-[4/3] rounded-lg border border-slate-200 object-cover shadow-sm bg-slate-950"
                />
                <span className="text-[8px] font-bold text-[#6B778C] uppercase tracking-wider mt-1 block">In Capture</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border border-slate-200 bg-slate-50 text-[8px] text-[#6B778C]">
                No In Photo
              </div>
            )}

            {a.punchOutPhoto ? (
              <div>
                <img
                  src={a.punchOutPhoto}
                  alt="Punch Out Biometric"
                  className="w-full aspect-[4/3] rounded-lg border border-slate-200 object-cover shadow-sm bg-slate-950"
                />
                <span className="text-[8px] font-bold text-[#6B778C] uppercase tracking-wider mt-1 block">Out Capture</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border border-slate-200 bg-slate-50 text-[8px] text-[#6B778C]">
                No Out Photo
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Employee Dossier Slide-over Drawer with gauge overlays ────────────── */
const DossierDrawer = ({ onClose }) => {
  const { selectedDossier, isDossierLoading } = useSelector((s) => s.intelligence);

  if (!selectedDossier && !isDossierLoading) return null;

  const emp = selectedDossier?.employee;
  const kpis = selectedDossier?.kpis || {};
  const diffs = selectedDossier?.auditDiffs || [];
  const anomalies = selectedDossier?.anomalies || [];
  const attendanceHistory = selectedDossier?.attendanceHistory || [];

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden" aria-modal="true">
      {/* smooth blur backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* drawer container */}
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-slide-in-right overflow-hidden border-l border-[#DFE1E6]">
        {/* Profile Card Header */}
        <div className="flex-shrink-0 border-b border-[#DFE1E6] bg-gradient-to-br from-slate-50 to-slate-100/50 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A89CD] to-[#0747A6] text-white font-extrabold text-lg shadow-lg shadow-blue-500/10 ring-2 ring-white">
                {emp?.name?.charAt(0) || '?'}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#172B4D] leading-snug">{emp?.name || '—'}</h2>
                <p className="text-xs text-[#6B778C] font-medium mt-0.5">{emp?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-slate-200/60 text-[#6B778C] transition-all hover:scale-105 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isDossierLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-[#0A89CD]" />
            <p className="text-xs font-semibold text-[#6B778C]">Compiling Profile Dossier...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7 scrollbar-thin">
            {/* KPI gauges section */}
            <section className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/50">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B778C] mb-4 flex items-center gap-1.5">
                <Fingerprint className="h-4 w-4 text-[#0A89CD]" />
                Security Risk & Reliability Index
              </h3>
              <div className="space-y-4">
                <GaugeBar
                  label="Attendance Reliability (ARI)"
                  value={kpis.ari ?? 0}
                  barColorStyle="linear-gradient(to right, #0A89CD, #0747A6)"
                />
                <GaugeBar
                  label="First-Time Pass Rate (FTPR)"
                  value={kpis.ftpr ?? 0}
                  barColorStyle="linear-gradient(to right, #36A15D, #2E8C50)"
                />
                <GaugeBar
                  label="Unified Trust Score"
                  value={kpis.trustScore ?? 0}
                  barColorStyle={kpis.trustScore >= 90 ? 'linear-gradient(to right, #10B981, #059669)' : kpis.trustScore >= 75 ? 'linear-gradient(to right, #F59E0B, #D97706)' : 'linear-gradient(to right, #EF4444, #DC2626)'}
                />
              </div>

              {/* Quick Counter Chips */}
              <div className="mt-5 grid grid-cols-3 gap-3.5">
                {[
                  { label: 'Work Days', value: kpis.shiftDays ?? 0, desc: 'Logged' },
                  { label: 'Present Days', value: kpis.presentDays ?? 0, desc: 'Punched' },
                  { label: 'Tamper Logs', value: kpis.gtp ?? 0, desc: 'Strikes', alert: (kpis.gtp ?? 0) > 0 },
                ].map(({ label, value, desc, alert }) => (
                  <div key={label} className={`rounded-xl border p-3 text-center transition-all bg-white hover:shadow-sm ${alert ? 'border-rose-200/60 bg-rose-50/10' : 'border-slate-200/50'}`}>
                    <p className={`text-xl font-extrabold ${alert ? 'text-rose-600' : 'text-[#172B4D]'}`}>{value}</p>
                    <p className="text-[10px] font-bold text-[#42526E] uppercase tracking-wider mt-0.5">{label}</p>
                    <p className="text-[9px] text-[#6B778C] font-semibold mt-px">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Scope change git-diff feed */}
            <section>
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B778C] mb-3.5 flex items-center gap-1.5">
                <GitCommit className="h-4 w-4 text-[#0747A6]" />
                Git-Diff Audit logs ({diffs.length})
              </h3>
              {diffs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/40 p-6 text-center text-xs text-[#6B778C] font-medium">
                  No title or description changes on record for this user.
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
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B778C] mb-3.5 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-rose-500" />
                Work Anomalies ({anomalies.length})
              </h3>
              {anomalies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/40 p-6 text-center text-xs text-[#6B778C] font-medium">
                  No auto-closed sessions or absent logs on record.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                  {anomalies.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3.5 rounded-xl border border-slate-200/60 bg-[#FAFBFC] p-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className={`rounded-xl p-2 mt-0.5 ${a.systemAutoClosed ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#172B4D]">
                            {new Date(a.date).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a.status === 'ABSENT'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              }`}
                          >
                            {a.systemAutoClosed ? 'AUTO-CLOSED BY SWEEP' : a.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#6B778C] font-medium leading-relaxed">
                          {Number(a.workHours).toFixed(1)} hrs recorded.
                          {a.regularizationReason ? (
                            <span className="block mt-1 bg-white p-2 rounded border border-slate-100 text-[#42526E] italic">
                              "{a.regularizationReason}"
                            </span>
                          ) : (
                            <span className="block mt-0.5 text-rose-500 font-semibold text-[10px]">
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
            <section className="border-t border-slate-100 pt-6">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B778C] mb-3.5 flex items-center gap-1.5">
                <Fingerprint className="h-4 w-4 text-[#0052CC]" />
                Attendance ({attendanceHistory.length})
              </h3>
              {attendanceHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/40 p-6 text-center text-xs text-[#6B778C] font-medium">
                  No attendance history logs found.
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
            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#6B778C] flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-[#0747A6]" />
                Previous Evaluations ({selectedDossier?.previousComments?.length || 0})
              </h3>
              {!selectedDossier?.previousComments || selectedDossier.previousComments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFE1E6] bg-slate-50/40 p-6 text-center text-xs text-[#6B778C] font-medium">
                  No evaluations on record from completed sprints.
                </div>
              ) : (
                <div className="space-y-3">
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
                      className="group/details rounded-2xl border border-slate-200/50 bg-[#FAFBFC] overflow-hidden transition-all duration-300 shadow-sm"
                    >
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none font-extrabold text-xs text-[#172B4D] hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#0A89CD] animate-pulse" />
                          <span>{sprintName}</span>
                          <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[9px] font-bold text-[#42526E]">
                            {sprintComments.length} {sprintComments.length === 1 ? 'eval' : 'evals'}
                          </span>
                        </div>
                        <span className="text-[#6B778C] text-[10px] font-bold transition-transform duration-300 group-open/details:rotate-90">
                          ▶
                        </span>
                      </summary>
                      <div className="border-t border-slate-200/40 bg-white p-4.5 space-y-4 max-h-80 overflow-y-auto scrollbar-thin">
                        {sprintComments.map((c) => {
                          const isPositive = c.evaluationTier === 'Positive';

                          // Dynamically build path to avoid trailing arrows
                          const lineagePath = [];
                          if (c.hierarchy?.epic) lineagePath.push({ ...c.hierarchy.epic, style: 'bg-[#EAE6FF] text-[#5243AA] border-[#5243AA]/10' });
                          if (c.hierarchy?.story) lineagePath.push({ ...c.hierarchy.story, style: 'bg-[#E3FCEF] text-[#006644] border-[#006644]/10' });
                          if (c.hierarchy?.task) lineagePath.push({ ...c.hierarchy.task, style: 'bg-[#DEEBFF] text-[#0747A6] border-[#0747A6]/10' });
                          if (c.hierarchy?.subtask) lineagePath.push({ ...c.hierarchy.subtask, style: 'bg-[#F4F5F7] text-[#42526E] border-[#42526E]/10' });

                          return (
                            <div
                              key={c.id}
                              className={`rounded-2xl border p-4 text-xs transition-all shadow-sm ${isPositive
                                ? 'bg-gradient-to-br from-emerald-500/[0.01] to-emerald-500/[0.03] border-emerald-200/50'
                                : 'bg-gradient-to-br from-rose-500/[0.01] to-rose-500/[0.03] border-rose-200/50'
                                }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  {isPositive ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider">
                                      <ThumbsUp className="h-3 w-3" /> UPVOTE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/80 border border-rose-200 text-rose-800 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider">
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

                              <p className={`font-semibold text-sm leading-relaxed mb-4 tracking-tight ${isPositive ? 'text-[#172B4D]' : 'text-[#DE350B]'}`}>
                                "{c.content}"
                              </p>

                              {lineagePath.length > 0 && (
                                <div className="rounded-xl bg-slate-50/50 border border-slate-100 p-3">
                                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#6B778C] block mb-2">Hierarchy Lineage</span>
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

/* ── Anomaly Ticker item ── */
const TickerItem = ({ event }) => {
  const config = {
    LOW_SCORE: { icon: TrendingDown, colour: 'text-rose-500 border-rose-500/20 bg-rose-500/[0.04]', pulse: 'bg-rose-500' },
    TAMPER: { icon: AlertTriangle, colour: 'text-amber-500 border-amber-500/20 bg-amber-500/[0.04]', pulse: 'bg-amber-500' },
    ATTENDANCE: { icon: Clock, colour: 'text-blue-500 border-blue-500/20 bg-blue-500/[0.04]', pulse: 'bg-blue-500' },
  }[event.type] || { icon: Activity, colour: 'text-slate-500 border-slate-200 bg-slate-50/50', pulse: 'bg-slate-400' };

  const Icon = config.icon;

  return (
    <div className={`group flex items-start gap-3 rounded-xl border p-3.5 mb-3 transition-all duration-300 hover:scale-[1.01] hover:shadow-sm ${config.colour}`}>
      <div className="relative mt-0.5 flex-shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${config.pulse}`} />
        <div className={`relative flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm text-inherit`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">
            {event.label}
          </span>
          <span className="text-[9px] font-bold opacity-60">LIVE</span>
        </div>
        <p className="text-xs font-semibold text-[#172B4D] leading-snug group-hover:text-[#0747A6] transition-colors">
          {event.text}
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT — Glassmorphism Dashboard Cockpit
   ═══════════════════════════════════════════════════════════════════════════ */
const ManagerHub = () => {
  const dispatch = useDispatch();
  const { workforce, tickerFeed, isLoading, selectedDossier, error } =
    useSelector((s) => s.intelligence);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const tickerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchWorkforceSummary());
  }, [dispatch]);

  /* Smooth auto-scroll ticker for active stream look */
  useEffect(() => {
    if (!tickerFeed.length || !tickerRef.current) return;
    const el = tickerRef.current;
    let pos = 0;
    const id = setInterval(() => {
      pos += 0.5;
      if (pos >= el.scrollHeight - el.clientHeight) pos = 0;
      el.scrollTop = pos;
    }, 30);
    return () => clearInterval(id);
  }, [tickerFeed]);

  /* filtered workforce logic */
  const filtered = useMemo(() => {
    let list = workforce;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      );
    }
    if (filter === 'risk') list = list.filter((e) => e.trustScore < 75);
    if (filter === 'elite') list = list.filter((e) => e.trustScore >= 90);
    return list;
  }, [workforce, search, filter]);

  const handleRowClick = (emp) => {
    setSelectedUserId(emp.id);
    dispatch(fetchEmployeeDossier(emp.id));
  };

  const handleCloseDrawer = () => {
    setSelectedUserId(null);
    dispatch(clearDossier());
  };

  return (
    <Layout pageTitle="Manager Hub — Workforce Intelligence Cockpit">
      {/* Global Error Banner */}
      {error && (
        <div className="mx-2 mb-4 flex items-center gap-3 rounded-2xl border border-rose-300/60 bg-rose-50/80 px-4 py-3.5 text-sm font-semibold text-rose-600 backdrop-blur-sm shadow-md shadow-rose-100">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 animate-bounce text-rose-500" />
          {error}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 h-full min-h-0 px-2 pb-4">

        {/* ── LEFT PANE: Master Workforce Grid (75%) ────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Header Dashboard section */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A89CD]/15 to-[#0747A6]/15 ring-1 ring-blue-500/10 shadow-sm">
                <Shield className="h-6 w-6 text-[#0A89CD]" />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#172B4D] tracking-tight leading-none">
                  Workforce Intelligence Cockpit
                </h1>
                <p className="text-xs text-[#6B778C] font-semibold mt-1 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {workforce.length} active employee profiles aggregated in real-time
                </p>
              </div>
            </div>

            {/* search input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#97A0AF]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#DFE1E6]/80 bg-white/70 py-2.5 pl-10 pr-4 text-xs font-semibold text-[#172B4D] placeholder-[#97A0AF] backdrop-blur-sm transition-all focus:border-[#0A89CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A89CD]/10 hover:border-[#97A0AF]/50"
              />
            </div>
          </div>

          {/* filter chips */}
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All Employees', count: workforce.length, icon: Users },
              { key: 'risk', label: 'High Risk Level (<75)', count: workforce.filter((e) => e.trustScore < 75).length, icon: AlertTriangle },
              { key: 'elite', label: 'Elite Performers (≥90)', count: workforce.filter((e) => e.trustScore >= 90).length, icon: Award },
            ].map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 border hover:scale-[1.01] active:scale-[0.98] ${filter === key
                  ? 'bg-gradient-to-r from-[#0747A6] to-[#0A89CD] text-white border-transparent shadow-md shadow-blue-500/10'
                  : 'bg-white text-[#42526E] border-[#DFE1E6]/70 hover:border-[#0A89CD] hover:text-[#0A89CD]'
                  }`}
              >
                <Icon className="h-3.5 w-3.5 opacity-80" />
                {label}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${filter === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#42526E]'
                  }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Main Grid Table Container */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-[#DFE1E6]/60 bg-white shadow-sm flex flex-col">
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center gap-3 py-24">
                <Loader2 className="h-8 w-8 animate-spin text-[#0A89CD]" />
                <span className="text-xs font-semibold text-[#6B778C]">Querying SQL telemetry...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-24 px-4 bg-slate-50/30">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-[#DFE1E6]/60 shadow-sm text-slate-400 mb-3">
                  <Users className="h-6 w-6 opacity-60" />
                </div>
                <p className="text-sm font-bold text-[#172B4D]">No Matching Telemetry</p>
                <p className="text-xs text-[#6B778C] mt-1 max-w-xs">There are no employee profiles matching the selected filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-auto h-full scrollbar-thin">
                <table className="w-full min-w-[700px] text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DFE1E6]/60 bg-[#FAFBFC] sticky top-0 z-10">
                      {[
                        { label: 'Employee', width: '25%' },
                        { label: 'Attendance (ARI)', width: '22%' },
                        { label: 'Pass Rate (FTPR)', width: '22%' },
                        { label: 'Tamper Strikes', width: '13%' },
                        { label: 'Unified Trust Score', width: '18%' }
                      ].map((col) => (
                        <th
                          key={col.label}
                          style={{ width: col.width }}
                          className="px-5 py-3.5 text-[9px] font-extrabold uppercase tracking-widest text-[#6B778C]"
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="px-5 py-3.5 w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((emp) => (
                      <tr
                        key={emp.id}
                        onClick={() => handleRowClick(emp)}
                        className={`group cursor-pointer transition-all duration-200 hover:bg-[#DEEBFF]/30 ${selectedUserId === emp.id ? 'bg-[#DEEBFF]/50' : ''
                          }`}
                      >
                        {/* Profile Details */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A89CD]/10 to-[#0747A6]/10 text-[#0747A6] text-xs font-black ring-1 ring-blue-500/10 shadow-sm group-hover:scale-105 transition-transform">
                                {emp.name.charAt(0)}
                              </div>
                              <PunctualityDot ari={emp.ari} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#172B4D] group-hover:text-[#0747A6] transition-colors truncate text-xs sm:text-sm">
                                {emp.name}
                              </p>
                              <p className="text-[10px] text-[#6B778C] font-semibold mt-0.5 truncate tracking-wide">
                                {emp.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Attendance Index (ARI) */}
                        <td className="px-5 py-4">
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[10px] font-bold">
                              <span className={emp.ari >= 90 ? 'text-emerald-600' : emp.ari >= 75 ? 'text-amber-600' : 'text-rose-600'}>
                                {emp.ari}%
                              </span>
                            </div>
                            <div className="h-2 w-32 rounded-full bg-slate-100 border border-slate-200/50 overflow-hidden p-[1px]">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, emp.ari)}%`,
                                  background: emp.ari >= 90 ? 'linear-gradient(to right, #10B981, #059669)' : emp.ari >= 75 ? 'linear-gradient(to right, #F59E0B, #D97706)' : 'linear-gradient(to right, #EF4444, #DC2626)'
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* First-Time Pass Rate (FTPR) */}
                        <td className="px-5 py-4">
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[10px] font-bold">
                              <span className={emp.ftpr >= 90 ? 'text-emerald-600' : emp.ftpr >= 75 ? 'text-amber-600' : 'text-rose-600'}>
                                {emp.ftpr}%
                              </span>
                            </div>
                            <div className="h-2 w-32 rounded-full bg-slate-100 border border-slate-200/50 overflow-hidden p-[1px]">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, emp.ftpr)}%`,
                                  background: emp.ftpr >= 90 ? 'linear-gradient(to right, #10B981, #059669)' : emp.ftpr >= 75 ? 'linear-gradient(to right, #F59E0B, #D97706)' : 'linear-gradient(to right, #EF4444, #DC2626)'
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Goalpost Strikes */}
                        <td className="px-5 py-4">
                          {emp.gtp > 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[10px] font-extrabold text-rose-600 animate-pulse">
                              <AlertTriangle className="h-3 w-3" /> {emp.gtp} Strikes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200/40 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              <CheckCircle className="h-3 w-3 text-emerald-500" /> Safe
                            </span>
                          )}
                        </td>

                        {/* Trust Score */}
                        <td className="px-5 py-4">
                          <span className={`rounded-xl px-2.5 py-1.5 text-xs font-bold leading-none inline-block ${trustBadge(emp.trustScore)}`}>
                            {emp.trustScore} · {trustLabel(emp.trustScore).split(' ')[0]}
                          </span>
                        </td>

                        {/* CTA Arrow */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:bg-blue-500 group-hover:text-white transition-all duration-200">
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

        {/* ── RIGHT PANE: Real-time Anomaly stream (25%) ────────────────── */}
        <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-rose-500" />
            <h2 className="text-sm font-extrabold text-[#172B4D] tracking-tight">Workforce Anomaly Stream</h2>
            {tickerFeed.length > 0 && (
              <span className="ml-auto rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[9px] font-extrabold text-rose-600">
                {tickerFeed.length} EVENTS
              </span>
            )}
          </div>

          {/* Scrolling Feed Container with gradient mask */}
          <div className="relative flex-1 min-h-[220px]" style={{ maxHeight: 'calc(100vh - 350px)' }}>
            <div
              ref={tickerRef}
              className="w-full h-full overflow-y-auto rounded-2xl border border-slate-200/60 bg-white/60 p-4 scrollbar-none"
            >
              {isLoading ? (
                <div className="flex h-32 items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-[#0A89CD]" />
                  <span className="text-xs font-semibold text-[#6B778C]">Connecting to stream...</span>
                </div>
              ) : tickerFeed.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center text-center text-[#6B778C] px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 mb-3 border border-emerald-100 shadow-sm">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-[#172B4D]">Telemetry Normal</p>
                  <p className="text-[10px] text-[#6B778C] mt-0.5">No anomalies detected in timesheet or Git log histories.</p>
                </div>
              ) : (
                tickerFeed.map((event) => <TickerItem key={event.id} event={event} />)
              )}
            </div>
          </div>

          {/* Quick Metrics KPI cards */}
          {!isLoading && workforce.length > 0 && (
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  label: 'At Risk',
                  value: workforce.filter((e) => e.trustScore < 75).length,
                  icon: AlertTriangle,
                  colorClass: 'text-rose-600',
                  bgClass: 'bg-rose-500/[0.03] border-rose-500/10 hover:border-rose-500/30 shadow-rose-500/5',
                },
                {
                  label: 'Elite Users',
                  value: workforce.filter((e) => e.trustScore >= 90).length,
                  icon: Award,
                  colorClass: 'text-emerald-600',
                  bgClass: 'bg-emerald-500/[0.03] border-emerald-500/10 hover:border-emerald-500/30 shadow-emerald-500/5',
                },
                {
                  label: 'Avg ARI',
                  value: `${Math.round(workforce.reduce((s, e) => s + e.ari, 0) / workforce.length)}%`,
                  icon: Clock,
                  colorClass: 'text-blue-600',
                  bgClass: 'bg-blue-500/[0.03] border-blue-500/10 hover:border-blue-500/30 shadow-blue-500/5',
                },
                {
                  label: 'Avg FTPR',
                  value: `${Math.round(workforce.reduce((s, e) => s + e.ftpr, 0) / workforce.length)}%`,
                  icon: BarChart3,
                  colorClass: 'text-violet-600',
                  bgClass: 'bg-violet-500/[0.03] border-violet-500/10 hover:border-violet-500/30 shadow-violet-500/5',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl border bg-white p-3.5 text-center transition-all duration-300 hover:scale-[1.03] hover:shadow-md cursor-default ${card.bgClass}`}
                >
                  <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-100 shadow-sm mb-1.5 ${card.colorClass}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <p className={`text-base font-black leading-none ${card.colorClass}`}>{card.value}</p>
                  <p className="text-[9px] font-bold text-[#6B778C] uppercase tracking-widest mt-1.5">{card.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-out drawer details page */}
      {(selectedDossier || selectedUserId) && (
        <DossierDrawer onClose={handleCloseDrawer} />
      )}
    </Layout>
  );
};

export default ManagerHub;
