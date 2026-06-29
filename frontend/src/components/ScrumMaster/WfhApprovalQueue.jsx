import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, ChevronUp, MapPin, Eye, CheckCircle, XCircle } from 'lucide-react';
import { adjudicateWfh } from '../../features/scrum/scrumSlice';

const formatCheckInTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatCoordinates = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return '—';
  }
  return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
};

const WfhApprovalQueue = () => {
  const dispatch = useDispatch();
  const { wfhQueue, isLoading } = useSelector((state) => state.scrum);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleApprove = (recordId) => {
    // Save strictly as WFH_APPROVED in backend adjudication
    dispatch(adjudicateWfh({ recordId, newStatus: 'WFH_APPROVED' }));
  };

  const handleReject = (recordId) => {
    dispatch(adjudicateWfh({ recordId, newStatus: 'ABSENT' }));
  };

  const pendingCount = wfhQueue ? wfhQueue.length : 0;

  return (
    <div className="rounded-xl border border-[#DFE1E6] bg-white shadow-sm overflow-hidden">
      
      {/* ── Collapsible Header ── */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 bg-[#FAFBFC] border-b border-[#DFE1E6] transition-colors hover:bg-slate-50 text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#0A89CD]/10">
            <Eye className="h-4 w-4 text-[#0A89CD]" />
          </div>
          <span className="text-sm font-bold text-[#172B4D]">
            WFH Approval Queue
          </span>

          {/* Pending Notification Badge */}
          {pendingCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#DE350B] px-1 text-[11px] font-bold text-white shadow-sm shadow-red-200/50">
              {pendingCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isExpanded && pendingCount > 0 && (
            <span className="text-xs font-semibold text-[#DE350B] animate-pulse">
              Needs Adjudication
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-[#6B778C]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#6B778C]" />
          )}
        </div>
      </button>

      {/* ── Collapsible Content ── */}
      {isExpanded && (
        <div className="p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-[#6B778C]">
              <svg className="mr-2 h-4 w-4 animate-spin text-[#0A89CD]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading queue...</span>
            </div>
          )}

          {!isLoading && pendingCount === 0 && (
            <div className="py-8 text-center text-sm text-[#6B778C]">
              🎉 No WFH pending records require adjudication. All clean!
            </div>
          )}

          {!isLoading && pendingCount > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#DFE1E6]">
              <table className="w-full border-collapse text-left text-sm text-[#172B4D]">
                <thead>
                  <tr className="bg-[#FAFBFC] border-b border-[#DFE1E6]">
                    <th className="py-3 px-4 text-xs font-semibold uppercase text-[#6B778C] tracking-wider">
                      Employee Name
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase text-[#6B778C] tracking-wider">
                      Employee ID
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase text-[#6B778C] tracking-wider">
                      Check-in (IST)
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase text-[#6B778C] tracking-wider">
                      GPS Location
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase text-[#6B778C] tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase text-[#6B778C] tracking-wider text-right">
                      Adjudicate Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE1E6]">
                  {wfhQueue.map((item) => (
                    <tr key={item.recordId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#172B4D]">
                        {item.employeeName}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B778C]">{item.employeeId}</td>
                      <td className="py-3.5 px-4 text-[#172B4D]">{formatCheckInTime(item.checkInTime)}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-[#4A5568] px-2 py-0.5 rounded border border-[#DFE1E6]">
                          <MapPin className="h-3 w-3 text-[#6B778C]" />
                          {formatCoordinates(item.checkInLat, item.checkInLng)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(item.recordId)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1 bg-[#E3FCEF] text-[#006644] hover:bg-[#D3F9E4] active:bg-[#BFF3D4] px-3 py-1 rounded font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Approve WFH</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(item.recordId)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1 bg-[#FFEBE6] text-[#DE350B] hover:bg-[#FFBDAD] active:bg-[#FDD0C7] px-3 py-1 rounded font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WfhApprovalQueue;
