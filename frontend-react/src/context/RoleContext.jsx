import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabase';

const RoleContext = createContext({
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  isEmployee: false,
  canViewRevenue: false,
  canManageUsers: false,
  canManageSettings: false,
  loading: true,
  refreshRole: async () => {},
  hasPermission: () => false,
});

const ROLE_HIERARCHY = {
  super_admin: 3,
  admin: 2,
  manager: 1,
  staff: 1,
  employee: 1,
  driver: 0,
  customer: 0,
};

const PERMISSIONS = {
  super_admin: [
    'view_revenue', 'edit_revenue', 'manage_users', 'manage_admins',
    'manage_settings', 'view_bookings', 'edit_bookings', 'delete_bookings',
    'view_vehicles', 'edit_vehicles', 'delete_vehicles', 'view_customers',
    'edit_customers', 'view_reports', 'view_expenses', 'edit_expenses',
    'manage_maintenance', 'view_all_data', 'change_passwords', 'create_accounts'
  ],
  admin: [
    'view_revenue', 'view_bookings', 'edit_bookings', 'view_vehicles',
    'edit_vehicles', 'view_customers', 'edit_customers', 'view_reports',
    'view_expenses', 'edit_expenses', 'manage_maintenance',
    'manage_employees', 'view_all_data'
  ],
  employee: [
    'view_bookings', 'edit_bookings', 'view_vehicles', 'view_customers',
    'view_maintenance'
  ],
  manager: [
    'view_revenue', 'view_bookings', 'edit_bookings', 'view_vehicles',
    'edit_vehicles', 'view_customers', 'view_reports', 'view_expenses',
    'manage_maintenance'
  ],
  staff: [
    'view_bookings', 'view_vehicles', 'view_customers'
  ],
};

export function RoleProvider({ children, user }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchRole = useCallback(async () => {
    if (!user?.id) {
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    // User exists, we need to fetch their role
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, full_name, email, phone, avatar_url, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      const userRole = data?.role || 'customer';
      setRole(userRole);
      setProfile(data);
    } catch (err) {
      console.error('Role fetch error:', err);
      setRole('customer');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  // Realtime updates for role changes - DISABLED due to subscribe timing issues
  // TODO: Re-enable with proper implementation
  // useEffect(() => {
  //   if (!user?.id) return;
  //   const channel = supabase
  //     .channel(`role-changes:${user.id}`)
  //     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
  //       (payload) => { if (payload.new.role !== role) setRole(payload.new.role); setProfile((prev) => prev ? { ...prev, ...payload.new } : payload.new); }
  //     )
  //     .subscribe();
  //   return () => { supabase.removeChannel(channel); };
  // }, [user?.id, role]);

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const isEmployee = role === 'employee' || role === 'staff' || role === 'manager';

  const canViewRevenue = isSuperAdmin || isAdmin || role === 'manager';
  const canManageUsers = isSuperAdmin || role === 'admin';
  const canManageSettings = isSuperAdmin;
  const canChangePasswords = isSuperAdmin;
  const canCreateAccounts = isSuperAdmin;

  const hasPermission = useCallback((permission) => {
    const userPerms = PERMISSIONS[role] || [];
    return userPerms.includes(permission) || userPerms.includes('view_all_data');
  }, [role]);

  const hasHigherRoleThan = useCallback((targetRole) => {
    return (ROLE_HIERARCHY[role] || 0) > (ROLE_HIERARCHY[targetRole] || 0);
  }, [role]);

  const value = {
    role,
    profile,
    isSuperAdmin,
    isAdmin,
    isEmployee,
    canViewRevenue,
    canManageUsers,
    canManageSettings,
    canChangePasswords,
    canCreateAccounts,
    loading,
    refreshRole: fetchRole,
    hasPermission,
    hasHigherRoleThan,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
export default RoleContext;
