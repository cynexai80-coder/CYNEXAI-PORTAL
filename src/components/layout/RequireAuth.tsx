import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser, getModuleAccess, logout } from '../../lib/auth';
import { checkTeacherAssignment } from '../../lib/api/manager';
import { computeAccessiblePortals } from '../../lib/authUtils';
import { logOfficeAttendance } from '../../lib/api/reports';
import { Loader2 } from 'lucide-react';

import { ROUTE_MODULE_MAP } from '../../lib/permissionsRegistry';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedRoles }) => {
  const user = getCurrentUser();
  const location = useLocation();
  const [accessLevels, setAccessLevels] = useState<string[] | null>(() => {
    if (!user) return [];
    if (user.role === 'CEO') return ['CEO', 'Manager', 'Teacher', 'Sales/HR', 'DM', 'Student'];
    return computeAccessiblePortals(user.role, false);
  });

  // Attendance login auto-sync and portal access calculation
  useEffect(() => {
    if (!user) {
      setAccessLevels([]);
      return;
    }

    const checkAccess = async () => {
      if (user.role !== 'Student') {
        logOfficeAttendance(user.id, 'login').catch(() => {});
      }
      const isTeacher = await checkTeacherAssignment(user.id);
      const portals = computeAccessiblePortals(user.role, isTeacher);
      setAccessLevels(portals);
    };

    checkAccess();
  }, [user?.id]);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessLevels === null) {
    return (
      <div className="min-h-screen bg-erp-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-erp-primary animate-spin" />
      </div>
    );
  }

  // Authorization Check:
  // 1. CEO role always has full access
  if (user.role === 'CEO') {
    return <>{children}</>;
  }

  // 2. Check if the current route maps to a system module in ROUTE_MODULE_MAP
  const moduleId = ROUTE_MODULE_MAP[location.pathname];
  if (moduleId) {
    const access = getModuleAccess(user, moduleId);
    if (access === 'none') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-8v4m-6.364 8.364a9 9 0 1112.728 0 9 9 0 01-12.728 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-erp-text mb-2">Access Restricted</h2>
          <p className="text-sm text-erp-text/60 max-w-md mb-6">
            Your account does not have active permission to view the <code className="bg-erp-background border border-erp-border px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> section. Please contact your CEO or administrator to grant module access.
          </p>
          <button
            onClick={() => window.location.href = '/profile'}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-all shadow-md"
          >
            View Profile & System Info
          </button>
        </div>
      );
    }
    return <>{children}</>;
  }

  // 3. Fallback for unmapped routes
  const hasRoleAccess = allowedRoles ? allowedRoles.some(role => accessLevels.includes(role)) : true;
  if (!hasRoleAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-8v4m-6.364 8.364a9 9 0 1112.728 0 9 9 0 01-12.728 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-erp-text mb-2">Access Restricted</h2>
        <p className="text-sm text-erp-text/60 max-w-md mb-6">
          Your account does not have active permission to view the <code className="bg-erp-background border border-erp-border px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> section. Please contact your CEO or administrator to grant module access.
        </p>
        <button
          onClick={() => window.location.href = '/profile'}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-all shadow-md"
        >
          View Profile & System Info
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
