import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { fetchCurrentUser } from './features/auth/authSlice';
import ProtectedWrapper from './components/Auth/ProtectedWrapper';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ScrumMasterDashboard from './pages/ScrumMasterDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import KanbanBoard from './pages/KanbanBoard';
import SprintDirectory from './pages/SprintDirectory';
import AuditDashboard from './pages/AuditDashboard';
import ManagerHub from './pages/ManagerHub';
import SuperAdminPortal from './pages/SuperAdmin/SuperAdminPortal';
import Profile from './pages/Profile';

const AuthInitializer = ({ children }) => {
  const dispatch = useDispatch();
  const { token, user, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, token, user]);

  if (token && !user && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F5F7]">
        <div
          className="yakkay-spinner h-10 w-10 rounded-full border-4 border-[#0A89CD] border-t-transparent"
          role="status"
          aria-label="Loading session"
        />
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <Toaster
          position="top-right"
          reverseOrder={false}
          gutter={10}
          containerStyle={{ top: 20, right: 20 }}
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '10px',
              padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              animation: 'slide-in-right 0.25s ease',
            },
            error: {
              duration: 4500,
              style: {
                background: '#FFEBE6',
                color: '#DE350B',
                border: '1px solid #FFBDAD',
                fontWeight: 600,
              },
              iconTheme: {
                primary: '#DE350B',
                secondary: '#FFEBE6',
              },
            },
            success: {
              style: {
                background: '#E3FCEF',
                color: '#006644',
                border: '1px solid #ABF5D1',
                fontWeight: 600,
              },
              iconTheme: {
                primary: '#36A15D',
                secondary: '#E3FCEF',
              },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/employee"
            element={
              <ProtectedWrapper allowedRoles={['Employee', 'Admin/Manager']}>
                <EmployeeDashboard />
              </ProtectedWrapper>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedWrapper allowedRoles={['Employee', 'Admin/Manager', 'SuperAdmin']}>
                <Profile />
              </ProtectedWrapper>
            }
          />

          {/* Sprint Directory — lists all sprints, entry point to boards */}
          <Route
            path="/sprints"
            element={
              <ProtectedWrapper allowedRoles={['Employee', 'Admin/Manager']}>
                <SprintDirectory />
              </ProtectedWrapper>
            }
          />

          {/* Kanban board — /board uses active sprint; /board/:sprintId uses a specific sprint */}
          <Route
            path="/board"
            element={
              <ProtectedWrapper allowedRoles={['Employee', 'Admin/Manager']}>
                <KanbanBoard />
              </ProtectedWrapper>
            }
          />
          <Route
            path="/board/:sprintId"
            element={
              <ProtectedWrapper allowedRoles={['Employee', 'Admin/Manager']}>
                <KanbanBoard />
              </ProtectedWrapper>
            }
          />

          {/* Immutable Audit Ledger — Manager and active Scrum Master only */}
          <Route
            path="/audits"
            element={
              <ProtectedWrapper allowedRoles={['Admin/Manager', 'Employee']} requireScrumMaster>
                <AuditDashboard />
              </ProtectedWrapper>
            }
          />

          <Route
            path="/scrum-master"
            element={
              <ProtectedWrapper allowedRoles={['Admin/Manager', 'Employee']} requireScrumMaster>
                <ScrumMasterDashboard />
              </ProtectedWrapper>
            }
          />

          <Route
            path="/manager"
            element={<Navigate to="/manager-hub" replace />}
          />

          <Route
            path="/manager-hub"
            element={
              <ProtectedWrapper allowedRoles={['Admin/Manager']}>
                <ManagerHub />
              </ProtectedWrapper>
            }
          />

          <Route
            path="/create-team"
            element={
              <ProtectedWrapper allowedRoles={['SuperAdmin']}>
                <SuperAdminPortal />
              </ProtectedWrapper>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;
