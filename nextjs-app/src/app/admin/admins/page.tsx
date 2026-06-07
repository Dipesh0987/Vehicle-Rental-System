'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

const ROLES = ['super_admin', 'admin', 'staff'];
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff'
};
const ROLE_PERMS: Record<string, string[]> = {
  super_admin: ['Full Access', 'Manage All Users', 'Edit Passwords', 'Revenue Access', 'All Settings'],
  admin: ['View Bookings', 'Edit Bookings', 'Manage Vehicles', 'Manage Employees', 'View Customers', 'Revenue Access'],
  staff: ['View Bookings', 'Edit Bookings', 'View Vehicles', 'View Customers', 'Maintenance'],
};

const roleColor = (r: string) => {
  if (r === 'super_admin') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
  if (r === 'admin') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
  return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200';
};

export default function AdminRoles() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff'
  });
  const [createForm, setCreateForm] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'staff',
    phone: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').in('role', ['admin', 'super_admin', 'employee', 'staff', 'manager']).order('created_at', { ascending: false });
    setAdmins(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const existingSuperAdmin = admins.find((a: any) => a.role === 'super_admin' && a.id !== currentUser?.id);

  const updateRole = async (id: string, newRole: string) => {
    if (newRole === 'super_admin' && existingSuperAdmin && existingSuperAdmin.id !== id) {
      alert('Only one Super Admin is allowed!');
      return;
    }
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', id);
    await fetch_();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.full_name || !createForm.username || !createForm.password) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (createForm.role === 'super_admin' && admins.some((a: any) => a.role === 'super_admin')) {
      alert('Only one Super Admin is allowed! Please select Admin or Staff role.');
      return;
    }
    
    setSaving(true);
    try {
      const email = `${createForm.username}@selfcarrental.com`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: createForm.password,
        options: {
          data: {
            full_name: createForm.full_name,
            role: createForm.role
          }
        }
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          const { data: existingProfiles } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('email', email)
            .limit(1);
          
          if (existingProfiles && existingProfiles.length > 0) {
            const existingUser = existingProfiles[0];
            await supabase.from('user_profiles').update({
              role: createForm.role,
              full_name: createForm.full_name,
              phone: createForm.phone || null
            }).eq('id', existingUser.id);
            alert('Existing user updated successfully!');
          } else {
            alert('User already exists in auth but could not be found in profiles. Please contact support.');
            return;
          }
        } else {
          throw authError;
        }
      } else {
        let userId = authData?.user?.id;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', email)
          .limit(1);
          
        let profileError;
        
        if (existingProfile && existingProfile.length > 0) {
          userId = existingProfile[0].id;
          const { error } = await supabase.from('user_profiles').update({
            role: createForm.role,
            full_name: createForm.full_name,
            phone: createForm.phone || null
          }).eq('id', userId);
          profileError = error;
        } else {
          const { error } = await supabase.from('user_profiles').insert({
            id: userId || crypto.randomUUID(),
            email: email,
            role: createForm.role,
            full_name: createForm.full_name,
            phone: createForm.phone || null,
            created_at: new Date().toISOString()
          });
          profileError = error;
        }
        
        if (profileError) {
          console.error('Profile creation error:', profileError);
          alert('Profile creation failed: ' + profileError.message);
        } else {
          alert('Account created successfully!');
        }
      }
      
      setShowCreate(false);
      setCreateForm({ full_name: '', username: '', password: '', role: 'staff', phone: '' });
      await fetch_();
    } catch (err: any) {
      alert('Failed to create account: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!passwordForm.new_password || passwordForm.new_password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('Passwords do not match');
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_change_user_password', {
        user_id: selectedUser.id,
        new_password: passwordForm.new_password
      });
      
      if (error) {
        if (error.message?.includes('function') || error.message?.includes('not found')) {
          alert('Please set up the admin_change_user_password function in Supabase. See SQL setup file for instructions.');
        } else {
          throw error;
        }
      } else {
        alert('Password changed successfully!');
        setShowPasswordModal(false);
        setPasswordForm({ new_password: '', confirm_password: '' });
        setSelectedUser(null);
      }
    } catch (err: any) {
      alert('Failed to change password: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Are you sure you want to delete ${user.full_name || user.email}? This cannot be undone.`)) return;
    
    if (user.id === currentUser?.id) {
      alert('You cannot delete your own account!');
      return;
    }
    
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', user.id);
      
      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw new Error('Failed to delete user profile: ' + profileError.message);
      }
      
      const { error: authError } = await supabase.rpc('admin_delete_user', {
        user_id: user.id
      });
      
      if (authError) {
        if (authError.message?.includes('function') || authError.message?.includes('not found')) {
          console.log('admin_delete_user RPC not available, profile deleted but auth user remains');
        } else {
          console.error('Auth delete error:', authError);
        }
      }
      
      alert('User deleted successfully!');
      await fetch_();
    } catch (err: any) {
      alert('Failed to delete user: ' + err.message);
    }
  };

  const openPasswordModal = (user: any) => {
    setSelectedUser(user);
    setShowPasswordModal(true);
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'staff'
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    if (editForm.role === 'super_admin' && existingSuperAdmin && existingSuperAdmin.id !== selectedUser.id) {
      alert('Only one Super Admin is allowed!');
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.from('user_profiles').update({
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role
      }).eq('id', selectedUser.id);
      
      if (error) throw error;
      
      alert('User updated successfully!');
      setShowEditModal(false);
      setSelectedUser(null);
      await fetch_();
    } catch (err: any) {
      alert('Failed to update user: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Security</p>
          <h2 className={heading}>Admin & Staff Management</h2>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]"
        >
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">person_add</span>
          Create Account
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ROLES.map(role => (
          <div key={role} className={`${panel} p-4`}>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColor(role)}`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {ROLE_PERMS[role].join(' • ')}
            </p>
          </div>
        ))}
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : admins.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No admin accounts found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3">User</th>
                  <th className="pb-2 pr-3">Login Email</th>
                  <th className="pb-2 pr-3">Role</th>
                  <th className="pb-2 pr-3">Permissions</th>
                  <th className="pb-2 pr-3">Created</th>
                  <th className="pb-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900 dark:text-white">{a.full_name || 'Admin'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{a.phone || 'No phone'}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-300">{a.email}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select value={a.role} onChange={(e) => updateRole(a.id, e.target.value)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColor(a.role)} cursor-pointer outline-none`}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-600 dark:text-slate-300">
                      {(ROLE_PERMS[a.role] || ROLE_PERMS.employee).join(', ')}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <button 
                          onClick={() => openEditModal(a)}
                          className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:border-blue-500/30 hover:bg-blue-50"
                          title="Edit User"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button 
                          onClick={() => openPasswordModal(a)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-white/10 hover:bg-slate-100"
                          title="Change Password"
                        >
                          <span className="material-symbols-outlined text-[14px]">key</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(a)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-500/30 hover:bg-rose-50"
                          title="Delete User"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a2228]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Create New Account</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="text-xs font-semibold">Full Name *</label>
                <input 
                  type="text" 
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({...createForm, full_name: e.target.value})}
                  className={inp}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Username *</label>
                <input 
                  type="text" 
                  value={createForm.username}
                  onChange={(e) => setCreateForm({...createForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')})}
                  className={inp}
                  placeholder="johndoe"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Login email will be: {createForm.username}@selfcarrental.com
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold">Password *</label>
                <input 
                  type="password" 
                  value={createForm.password}
                  onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                  className={inp}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Phone</label>
                <input 
                  type="tel" 
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
                  className={inp}
                  placeholder="+977 ..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Role *</label>
                <select 
                  value={createForm.role}
                  onChange={(e) => setCreateForm({...createForm, role: e.target.value})}
                  className={inp}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a2228]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Change Password</h3>
              <button onClick={() => { setShowPasswordModal(false); setSelectedUser(null); }} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              Changing password for: <strong>{selectedUser.full_name}</strong>
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold">New Password *</label>
                <input 
                  type="password" 
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                  className={inp}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Confirm Password *</label>
                <input 
                  type="password" 
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                  className={inp}
                  placeholder="Repeat password"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50"
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setSelectedUser(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a2228]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Edit User</h3>
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  className={inp}
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  className={inp}
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Phone</label>
                <input
                  type="tel"
                  className={inp}
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Role</label>
                <select
                  className={inp}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  required
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
