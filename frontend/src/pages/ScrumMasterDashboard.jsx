import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCw, Calendar, Users, ShieldAlert, Award } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import WfhApprovalQueue from '../components/ScrumMaster/WfhApprovalQueue';
import StandupTrackerGrid from '../components/ScrumMaster/StandupTrackerGrid';
import {
  fetchWfhQueue,
  fetchTeamMatrix,
  clearScrumError,
} from '../features/scrum/scrumSlice';

const ScrumMasterDashboard = () => {
  const dispatch = useDispatch();
  const { error, sprintId, date, wfhQueue, teamMatrix } = useSelector(
    (state) => state.scrum
  );

  const fetchAllData = () => {
    dispatch(fetchWfhQueue());
    dispatch(fetchTeamMatrix());
  };

  useEffect(() => {
    fetchAllData();

    return () => {
      dispatch(clearScrumError());
    };
  }, [dispatch]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const pendingCount = wfhQueue ? wfhQueue.length : 0;
  const teamCount = teamMatrix ? teamMatrix.length : 0;

  return (
    <Layout pageTitle="Scrum Master Command Center">
      <div className="min-h-screen bg-[#F4F5F7]">

        {/* ── Welcome Hero Section ── */}
        <div className="border-b border-[#DFE1E6] bg-white px-6 py-8 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-[#172B4D]">
                  Scrum Master Command Center
                </h1>
                <div className="flex items-center gap-1 rounded bg-[#E3FCEF] px-2 py-0.5 text-xs font-semibold text-[#006644]">
                  <Award className="h-3.5 w-3.5" />
                  <span>Active SM Privileges</span>
                </div>
              </div>
              <p className="mt-1 text-sm text-[#6B778C]">
                Review WFH requests, evaluate active shifts, and track daily team standup blocker reports.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                className="flex items-center gap-2 rounded-lg border border-[#DFE1E6] bg-white px-4 py-2 text-sm font-semibold text-[#172B4D] shadow-sm transition-all duration-200 hover:bg-[#F4F5F7] active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4 text-[#6B778C]" />
                <span>Refresh Workspace</span>
              </button>
            </div>
          </div>

          {/* Active sprint info bar */}
          {(sprintId || date) && (
            <div className="mt-6 flex flex-wrap gap-4 border-t border-[#F4F5F7] pt-4 text-xs text-[#6B778C]">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#0A89CD]" />
                <span>
                  Active Sprint ID: <strong className="text-[#172B4D]">{sprintId || '—'}</strong>
                </span>
              </div>
              <div className="h-3 w-px bg-[#DFE1E6]" />
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#36A15D]" />
                <span>
                  Team Size: <strong className="text-[#172B4D]">{teamCount} members</strong>
                </span>
              </div>
              <div className="h-3 w-px bg-[#DFE1E6]" />
              <div>
                Date (IST): <strong className="text-[#172B4D]">{date || '—'}</strong>
              </div>
            </div>
          )}
        </div>

        {/* ── Dashboard Grid ── */}
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8 space-y-6">

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-4 text-sm text-[#DE350B] shadow-sm"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* WFH Approval Queue Component */}
          <WfhApprovalQueue />

          {/* Standup Tracker Grid Component */}
          <StandupTrackerGrid />
        </div>
      </div>
    </Layout>
  );
};

export default ScrumMasterDashboard;
