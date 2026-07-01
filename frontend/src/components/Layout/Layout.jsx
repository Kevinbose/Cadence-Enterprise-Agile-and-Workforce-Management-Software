import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LogOut,
  ChevronDown,
  User,
  KanbanSquare,
  ShieldCheck,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  GitCommitHorizontal,
  Menu,
  ChevronLeft,
  UserCog,
} from 'lucide-react';
import GlobalHeaderPunch from '../Attendance/GlobalHeaderPunch';
import RegularizationModal from '../Attendance/RegularizationModal';
import { logoutUser, syncUserSession } from '../../features/auth/authSlice';
import { resetAttendanceState } from '../../features/attendance/attendanceSlice';

/**
 * sidebarLinkClass — Atlassian sidebar navigation link styles
 */
const sidebarLinkClass = (isActive, isCollapsed) =>
  `group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-150 mb-1.5 ${
    isCollapsed ? 'justify-center' : ''
  } ${
    isActive
      ? 'bg-[#DEEBFF] text-[#0747A6]'
      : 'text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
  }`;

const Layout = ({ children, pageTitle = 'Dashboard' }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { pendingRegularizationRecord } = useSelector((state) => state.attendance);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    dispatch(logoutUser());
    dispatch(resetAttendanceState());
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    dispatch(syncUserSession());
    const interval = setInterval(() => {
      dispatch(syncUserSession());
    }, 10000);
    return () => clearInterval(interval);
  }, [dispatch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const showScrumMasterNav =
    user?.systemRole === 'Admin/Manager' || user?.isTemporalScrumMaster === true;
  const showManagerNav = user?.systemRole === 'Admin/Manager';
  const showTempManagerNav =
    user?.systemRole === 'Admin/Manager' && user?.isTempManager !== true;
  const showAuditNav =
    user?.systemRole === 'Admin/Manager' || user?.isTemporalScrumMaster === true;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F5F7]">

      {/* ════════════════════════════════════════════════════════════════════
          COLLAPSIBLE LIGHT-THEMED SIDEBAR (ATLASSIAN STYLE)
      ════════════════════════════════════════════════════════════════════ */}
      <aside
        className={`h-full flex-shrink-0 flex flex-col bg-[#FAFBFC] border-r border-[#DFE1E6] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
        aria-label="Sidebar navigation"
      >
        {/* Sidebar Header */}
        {isCollapsed ? (
          <div className="flex h-14 items-center justify-center border-b border-[#DFE1E6]">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded-md hover:bg-[#F4F5F7] text-[#0A89CD] transition-colors"
              title="Expand Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex h-14 items-center justify-between px-4 border-b border-[#DFE1E6]">
            <img
              src="/Yakkay-logo.png"
              alt="Yakkay Tech"
              className="h-6 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-md hover:bg-[#F4F5F7] text-[#6B778C] transition-colors"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Sidebar Links */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Employee Workspace */}
          <NavLink
            to="/employee"
            className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
            title={isCollapsed ? 'Employee Board' : undefined}
          >
            <KanbanSquare className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Employee Board</span>}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                Employee Board
              </span>
            )}
          </NavLink>

          {/* Sprint Directory */}
          <NavLink
            to="/sprints"
            className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
            title={isCollapsed ? 'Sprints' : undefined}
          >
            <Layers className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Sprints</span>}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                Sprints
              </span>
            )}
          </NavLink>

          {/* Sprint Board (Kanban — direct shortcut to active sprint) */}
          <NavLink
            to="/board"
            className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
            title={isCollapsed ? 'Sprint Board' : undefined}
          >
            <LayoutGrid className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Sprint Board</span>}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                Sprint Board
              </span>
            )}
          </NavLink>

          {/* Scrum Master Command Center */}
          {showScrumMasterNav && (
            <NavLink
              to="/scrum-master"
              className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
              title={isCollapsed ? 'Scrum Master' : undefined}
            >
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">Scrum Master</span>}
              {user?.isTemporalScrumMaster && user?.systemRole !== 'Admin/Manager' && (
                <span className={`h-2 w-2 rounded-full bg-[#36A15D] flex-shrink-0 ${isCollapsed ? 'absolute top-2 right-2' : ''}`} />
              )}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                  Scrum Master
                </span>
              )}
            </NavLink>
          )}

          {/* Audit Logs — Manager + active SM */}
          {showAuditNav && (
            <NavLink
              to="/audits"
              className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
              title={isCollapsed ? 'Audit Logs' : undefined}
            >
              <GitCommitHorizontal className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">Audit Logs</span>}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                  Audit Logs
                </span>
              )}
            </NavLink>
          )}

          {/* Manager Hub */}
          {showManagerNav && (
            <NavLink
              to="/manager-hub"
              className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
              title={isCollapsed ? 'Manager Hub' : undefined}
            >
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">Manager Hub</span>}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                  Manager Hub
                </span>
              )}
            </NavLink>
          )}

          {showTempManagerNav && (
            <NavLink
              to="/temp-manager-portal"
              className={({ isActive }) => sidebarLinkClass(isActive, isCollapsed)}
              title={isCollapsed ? 'Temp Manager' : undefined}
            >
              <UserCog className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">Temp Manager</span>}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-[#172B4D] px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block z-50">
                  Temp Manager
                </span>
              )}
            </NavLink>
          )}
        </nav>

        {/* Sidebar Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-[#DFE1E6] text-[10px] text-[#6B778C] text-center font-medium">
            v2.0 · Enterprise
          </div>
        )}
      </aside>

      {/* ════════════════════════════════════════════════════════════════════
          MAIN VIEWPORT COLUMN
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        
        {/* Horizontal Header Bar */}
        <header className="z-40 h-14 w-full flex-shrink-0 border-b border-[#DFE1E6] bg-white px-6 shadow-sm">
          <div className="flex h-full w-full items-center justify-between">
            
            {/* Header Title / Breadcrumb */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-[#6B778C]">
                  Yakkay Agile Workspace
                </p>
                <p className="text-sm font-semibold text-[#172B4D] leading-none mt-0.5">
                  {pageTitle}
                </p>
              </div>
              {user?.isTemporalScrumMaster && (
                <span className="hidden rounded bg-[#E3FCEF] border border-[#36A15D]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#006644] sm:inline-flex">
                  Active Scrum Master
                </span>
              )}
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-4">
              {/* Punch-In Clock Widget */}
              <GlobalHeaderPunch />

              {/* Vertical divider */}
              <div className="hidden h-6 w-px bg-[#DFE1E6] sm:block" aria-hidden="true" />

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F4F5F7] focus:outline-none"
                  aria-haspopup="true"
                  aria-expanded={isDropdownOpen}
                  aria-label="Profile menu"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0A89CD] to-[#36A15D] text-xs font-bold text-white shadow-sm ring-2 ring-white">
                    {userInitial}
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold leading-tight text-[#172B4D]">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-[10px] font-medium leading-tight text-[#6B778C]">
                      {user?.systemRole || 'Employee'}
                      {user?.isTemporalScrumMaster ? ' · Scrum Master' : ''}
                    </p>
                  </div>
                  <ChevronDown
                    className={`hidden h-4 w-4 text-[#6B778C] transition-transform duration-200 sm:block ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-[#DFE1E6] bg-white shadow-lg shadow-slate-200/85 z-50">
                    <div className="border-b border-[#F4F5F7] px-4 py-3">
                      <p className="text-sm font-semibold text-[#172B4D]">{user?.name}</p>
                      <p className="mt-0.5 text-xs text-[#6B778C]">{user?.email}</p>
                      <div className="mt-2 inline-flex items-center rounded-md bg-[#E3FCEF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#006644]">
                        {user?.employeeId}
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/profile');
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#172B4D] transition-colors hover:bg-[#F4F5F7]"
                      >
                        <User className="h-4 w-4 text-[#6B778C]" aria-hidden="true" />
                        My Profile
                      </button>
                    </div>

                    <div className="border-t border-[#F4F5F7]">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#DE350B] transition-colors hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="relative flex-1 overflow-y-auto p-6">
          {pendingRegularizationRecord ? (
            <div className="flex min-h-full items-center justify-center bg-slate-900/10 p-6 backdrop-blur-[2px]">
              <RegularizationModal record={pendingRegularizationRecord} />
            </div>
          ) : (
            children
          )}
        </main>

        {/* Footer */}
        <footer className="w-full flex-shrink-0 border-t border-[#DFE1E6] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[#6B778C]">
              © 2026 Yakkay Technologies Pvt. Ltd. All rights reserved.
            </p>
            <p className="text-[11px] text-[#6B778C]">
              Agile Platform v2.0 · Enterprise Tier
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
