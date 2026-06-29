import React from 'react';
import { useSelector } from 'react-redux';
import { ShieldAlert, Users, Award, ShieldCheck, HelpCircle, Lock, Play } from 'lucide-react';

const StandupTrackerGrid = () => {
  const { teamMatrix, summary, isLoading } = useSelector((state) => state.scrum);

  // Status badge styles mapping
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT_OFFICE':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#36A15D] px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            <span>PRESENT_OFFICE</span>
          </span>
        );
      case 'WFH_APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#0A89CD] px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            <span>WFH_APPROVED</span>
          </span>
        );
      case 'WFH_PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFAB00] px-2 py-0.5 text-xs font-bold text-[#172B4D] shadow-sm animate-pulse">
            <HelpCircle className="h-3 w-3" />
            <span>WFH_PENDING</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#DE350B] px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            <ShieldAlert className="h-3 w-3" />
            <span>ABSENT</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-[#DFE1E6] bg-white shadow-sm p-6 space-y-6">
      
      {/* ── Title & Description ── */}
      <div className="flex items-center justify-between border-b border-[#F4F5F7] pb-4">
        <div>
          <h2 className="text-sm font-bold text-[#172B4D]">Daily Team Standup Tracker</h2>
          <p className="text-xs text-[#6B778C] mt-0.5">Real-time shift status and standup lock indicators for your team.</p>
        </div>
      </div>

      {/* ── Metrics Summary Bar ── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center text-xs">
          <div className="rounded border border-[#DFE1E6] bg-[#FAFBFC] p-2.5">
            <p className="font-semibold text-[#6B778C] uppercase tracking-wider text-[10px]">Total Members</p>
            <p className="mt-1 text-lg font-bold text-[#172B4D]">{summary.totalMembers}</p>
          </div>
          <div className="rounded border border-[#DFE1E6] bg-[#E3FCEF] p-2.5">
            <p className="font-semibold text-[#006644] uppercase tracking-wider text-[10px]">Office Present</p>
            <p className="mt-1 text-lg font-bold text-[#006644]">{summary.presentOffice}</p>
          </div>
          <div className="rounded border border-[#DFE1E6] bg-[#DEEBFF] p-2.5">
            <p className="font-semibold text-[#0747A6] uppercase tracking-wider text-[10px]">WFH Approved</p>
            <p className="mt-1 text-lg font-bold text-[#0747A6]">{summary.wfhApproved || 0}</p>
          </div>
          <div className="rounded border border-[#DFE1E6] bg-[#FFF4CC] p-2.5">
            <p className="font-semibold text-[#825c00] uppercase tracking-wider text-[10px]">WFH Pending</p>
            <p className="mt-1 text-lg font-bold text-[#825c00]">{summary.wfhPending}</p>
          </div>
          <div className="rounded border border-[#DFE1E6] bg-[#FFEBE6] p-2.5">
            <p className="font-semibold text-[#DE350B] uppercase tracking-wider text-[10px]">Absent</p>
            <p className="mt-1 text-lg font-bold text-[#DE350B]">{summary.absent}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-sm text-[#6B778C]">
          <svg className="mr-2 h-4 w-4 animate-spin text-[#0A89CD]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading team matrix...</span>
        </div>
      )}

      {!isLoading && (!teamMatrix || teamMatrix.length === 0) && (
        <div className="py-8 text-center text-sm text-[#6B778C]">
          No team members currently assigned.
        </div>
      )}

      {/* ── Team Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMatrix && teamMatrix.map((member) => {
          const initials = member.name ? member.name.charAt(0).toUpperCase() : 'U';
          const hasBlockers = member.standupBlockers && member.standupBlockers.trim().length > 0;
          
          return (
            <div
              key={member.userId}
              className={`rounded-xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md bg-white ${
                hasBlockers ? 'border-amber-300 ring-1 ring-amber-100' : 'border-[#DFE1E6]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* User Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0A89CD]/20 to-[#36A15D]/20 text-[#172B4D] font-bold text-sm">
                    {initials}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#172B4D] leading-tight">
                      {member.name}
                    </h3>
                    <p className="text-[11px] text-[#6B778C] mt-0.5">
                      {member.employeeId}
                    </p>
                  </div>
                </div>

                {/* Status Lozenge */}
                {getStatusBadge(member.todayStatus)}
              </div>

              {/* Work Hours Display */}
              <div className="mt-5 flex items-baseline justify-between border-t border-[#F4F5F7] pt-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B778C]">
                    Today&apos;s Hours
                  </p>
                  <p className="text-2xl font-extrabold text-[#172B4D] mt-0.5 tracking-tight">
                    {parseFloat(member.workHours || 0).toFixed(2)}
                    <span className="text-xs font-medium text-[#6B778C] ml-1">hrs</span>
                  </p>
                </div>

                {/* Flags indicator */}
                <div className="flex flex-col items-end gap-1 text-[11px]">
                  {member.isStandupLocked ? (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-[#5E6C84] px-2 py-0.5 font-semibold">
                      <Lock className="h-3 w-3" />
                      <span>Shift Sealed</span>
                    </span>
                  ) : member.isActiveSession ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#E3FCEF] text-[#006644] px-2 py-0.5 font-semibold animate-pulse">
                      <Play className="h-3 w-3 fill-current" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-[#FFFAE6] text-[#FF8B00] px-2 py-0.5 font-semibold">
                      <span>Paused</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Blockers alert banner */}
              {hasBlockers && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 leading-normal">
                  <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Blocker Reported:</span>{' '}
                    {member.standupBlockers}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StandupTrackerGrid;
