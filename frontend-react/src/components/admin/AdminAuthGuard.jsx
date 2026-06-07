import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import supabase from '../../lib/supabase';

const ALLOWED_ADMIN_ROLES = ['super_admin', 'admin', 'manager', 'staff', 'employee'];

export default function AdminAuthGuard({ children, requiredPermission = null, requiredRole = null }) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, hasPermission, hasHigherRoleThan, profile } = useRole();
  const location = useLocation();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      // Wait for auth to finish loading first
      if (authLoading) {
        return;
      }

      // Not logged in - redirect to admin login
      if (!user) {
        setShouldRedirect(true);
        setChecking(false);
        return;
      }

      // User exists, wait for role to finish loading
      if (roleLoading) {
        return;
      }

      // Role fetch is done but role is still null - user might be a customer
      if (role === null) {
        // This shouldn't happen if user exists, but handle gracefully
        console.warn('Role is null after loading completed for user:', user.id);
        setShouldRedirect(true);
        setChecking(false);
        return;
      }

      // Check if user has admin role
      if (!ALLOWED_ADMIN_ROLES.includes(role)) {
        console.warn(`User ${user.id} with role ${role} attempted to access admin area`);
        // Sign out non-admin users trying to access admin
        await supabase.auth.signOut();
        setShouldRedirect(true);
        setChecking(false);
        return;
      }

      // Check specific permission if required
      if (requiredPermission && !hasPermission(requiredPermission)) {
        console.warn(`User ${user.id} lacks permission: ${requiredPermission}`);
        setChecking(false);
        return;
      }

      // Check specific role requirement if set
      if (requiredRole && !hasHigherRoleThan(requiredRole) && role !== requiredRole) {
        console.warn(`User ${user.id} with role ${role} cannot access ${requiredRole} area`);
        setChecking(false);
        return;
      }

      setVerified(true);
      setChecking(false);
    };

    verifyAccess();
  }, [user, role, authLoading, roleLoading, requiredPermission, requiredRole, hasPermission, hasHigherRoleThan]);

  // Show loading state
  if (authLoading || roleLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f1e8_55%,#ece7dc_100%)]">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-[#1f7668] border-t-transparent"></div>
          <p className="mt-4 text-sm font-semibold text-slate-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to admin login
  if (shouldRedirect) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Not an admin role
  if (!ALLOWED_ADMIN_ROLES.includes(role)) {
    return <Navigate to="/admin/login" state={{ from: location, error: 'Access denied. Admin privileges required.' }} replace />;
  }

  // Missing required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f1e8_55%,#ece7dc_100%)]">
        <div className="text-center max-w-md p-6">
          <span className="material-symbols-outlined text-6xl text-amber-500">lock</span>
          <h2 className="mt-4 text-xl font-bold text-slate-800">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600">
            You don't have permission to access this section. Contact your super administrator if you need access.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return children;
}
