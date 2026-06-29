import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-jira-page">
    <div
      className="yakkay-spinner h-10 w-10 rounded-full border-4 border-[#0A89CD] border-t-transparent"
      role="status"
      aria-label="Loading"
    />
  </div>
);

const AccessDenied = () => (
  <div className="flex min-h-screen items-center justify-center bg-jira-page px-4">
    <div className="w-full max-w-md rounded-lg border border-jira-border bg-jira-card p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-alert-bg">
        <ShieldX className="h-7 w-7 text-alert-text" aria-hidden="true" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-jira-text">403 Access Denied</h1>
      <p className="text-sm text-jira-muted">
        You do not have the required system privileges to view this page. Contact
        your Yakkay Tech administrator if you believe this is an error.
      </p>
    </div>
  </div>
);

const ProtectedWrapper = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, isLoading, user } = useSelector((state) => state.auth);

  if (isLoading) {
    return <Spinner />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.systemRole)
  ) {
    return <AccessDenied />;
  }

  return children;
};

export default ProtectedWrapper;
