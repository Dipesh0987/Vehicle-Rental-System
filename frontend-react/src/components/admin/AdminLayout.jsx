import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useRole } from '../../context/RoleContext';
import supabase from '../../lib/supabase';
import '../../styles/admin.css';

// Helper function to get nav items based on role
const getNavItems = (userRole) => {
  const items = [
    { id: 'overview', label: 'Overview', icon: 'dashboard', path: '/admin' },
    {
      id: 'operations', label: 'Operations',  icon: 'settings_suggest',
      children: [
        { id: 'vehicles', label: 'Vehicles', icon: 'directions_car', path: '/admin/vehicles' },
        { id: 'fleet', label: 'Live Fleet', icon: 'map', path: '/admin/fleet' },
        { id: 'bookings', label: 'Bookings', icon: 'event_note', path: '/admin/bookings' },
        { id: 'customers', label: 'Customers', icon: 'groups', path: '/admin/customers' },
        { id: 'drivers', label: 'Drivers', icon: 'badge', path: '/admin/drivers' },
      ],
    },
    {
      id: 'finance', label: 'Finance', icon: 'payments',
      children: [
        { id: 'payments', label: 'Payments', icon: 'payment', path: '/admin/payments' },
        { id: 'customer-billing', label: 'Customer Billing', icon: 'person_search', path: '/admin/customer-billing' },
        { id: 'expenses', label: 'Expenses', icon: 'receipt_long', path: '/admin/expenses' },
        { id: 'pricing', label: 'Pricing & Promos', icon: 'percent', path: '/admin/pricing' },
        { id: 'reports', label: 'Financial Reports', icon: 'monitoring', path: '/admin/reports' },
      ],
    },
    {
      id: 'quality', label: 'Quality', icon: 'verified',
      children: [
        { id: 'contacts', label: 'Contact Messages', icon: 'mail', path: '/admin/contacts' },
        { id: 'damage-claims', label: 'Damage Claims', icon: 'warning', path: '/admin/damage-claims' },
        { id: 'maintenance', label: 'Maintenance', icon: 'build', path: '/admin/maintenance' },
        { id: 'notifications', label: 'Notifications', icon: 'notifications', path: '/admin/notifications' },
      ],
    },
  ];
  
  // Only super_admin can see Admin Roles tab
  if (userRole === 'super_admin') {
    items.push({ id: 'admins', label: 'Admin Roles', icon: 'shield', path: '/admin/admins' });
  }
  
  return items;
};

const quickActions = [
  { id: 'newBooking', label: 'Create Booking', icon: 'event_available' },
  { id: 'addVehicle', label: 'Add Vehicle', icon: 'directions_car' },
  { id: 'addDriver', label: 'Add Driver', icon: 'person_add' },
  { id: 'markMaintenance', label: 'Report Damage', icon: 'car_repair' },
];

const searchTypeLabels = { vehicles: 'Vehicles', bookings: 'Bookings', customers: 'Customers', drivers: 'Drivers' };
const searchTypeRoutes = { vehicles: '/admin/vehicles', bookings: '/admin/bookings', customers: '/admin/customers', drivers: '/admin/drivers' };

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { role, profile, canViewRevenue } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('vrs_admin_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(['operations', 'finance', 'quality']);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIdx, setSearchIdx] = useState(-1);
  const searchRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  // Global search
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    const term = `%${q.trim()}%`;
    const groups = [];
    try {
      const [vRes, bRes, cRes, dRes] = await Promise.all([
        supabase.from('vehicles').select('id, name, brand, category, vehicle_number').ilike('name', term).limit(5),
        supabase.from('vehicle_bookings').select('id, booking_code, customer_name, customer_email, vehicles(name)').or(`booking_code.ilike.${term},customer_name.ilike.${term},customer_email.ilike.${term}`).limit(5),
        supabase.from('user_profiles').select('id, full_name, email, phone, avatar_url').or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`).limit(5),
        supabase.from('drivers').select('id, driver_id, full_name, phone, availability').or(`full_name.ilike.${term},driver_id.ilike.${term},phone.ilike.${term}`).limit(5),
      ]);
      if (vRes.data?.length) groups.push({ type: 'vehicles', items: vRes.data.map((v) => ({ id: v.id, label: v.name || v.id, meta: [v.brand, v.category, v.vehicle_number].filter(Boolean).join(' · ') })) });
      if (bRes.data?.length) groups.push({ type: 'bookings', items: bRes.data.map((b) => ({ id: b.id, label: b.booking_code || b.id?.slice(0, 8), meta: [b.customer_name, b.vehicles?.name].filter(Boolean).join(' — ') })) });
      if (cRes.data?.length) groups.push({ type: 'customers', items: cRes.data.map((c) => ({ id: c.id, label: c.full_name || c.email || c.id?.slice(0, 8), meta: c.email || c.phone || '' })) });
      if (dRes.data?.length) groups.push({ type: 'drivers', items: dRes.data.map((d) => ({ id: d.id, label: d.full_name || d.driver_id || d.id?.slice(0, 8), meta: [d.availability, d.phone].filter(Boolean).join(' · ') })) });
    } catch {}
    setSearchResults(groups);
    setSearchIdx(groups.length ? 0 : -1);
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  const flatResults = searchResults.flatMap((g) => g.items.map((it) => ({ ...it, type: g.type })));

  const handleSearchSelect = (type, id) => {
    setSearchQuery(''); setSearchOpen(false); setSearchResults([]);
    navigate(searchTypeRoutes[type] || '/admin');
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setSearchOpen(false); return; }
    if (!flatResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx((i) => (i + 1) % flatResults.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx((i) => (i - 1 + flatResults.length) % flatResults.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = flatResults[searchIdx] || flatResults[0]; if (item) handleSearchSelect(item.type, item.id); }
  };

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('vrs_admin_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  }, [sidebarCollapsed]);

  // Notification bell: fetch + realtime (admin notifications use is_admin=true)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('notifications').select('*').eq('is_admin', true).order('created_at', { ascending: false }).limit(30);
      setNotifs(data || []);
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_admin', true).eq('read', false);
      setUnreadCount(count || 0);
    })();
    const channel = supabase.channel('admin-notifs-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'is_admin=eq.true' }, (payload) => {
        setNotifs((prev) => [payload.new, ...prev].slice(0, 30));
        setUnreadCount((c) => c + 1);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markNotifRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('is_admin', true).eq('read', false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };
  const notifTimeAgo = (iso) => {
    if (!iso) return '';
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(iso).toLocaleDateString();
  };
  const notifIcon = (type) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('verification') || t.includes('kyc')) return { icon: 'verified_user', color: 'text-amber-500' };
    if (t.includes('contact')) return { icon: 'mail', color: 'text-violet-500' };
    if (t.includes('booking')) return { icon: 'event_note', color: 'text-blue-500' };
    if (t.includes('payment')) return { icon: 'payments', color: 'text-emerald-500' };
    if (t.includes('maintenance')) return { icon: 'build', color: 'text-orange-500' };
    return { icon: 'notifications', color: 'text-slate-500' };
  };
  const notifNavTarget = (type) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('verification') || t.includes('kyc')) return '/admin/customers';
    if (t.includes('contact')) return '/admin/contacts';
    if (t.includes('booking')) return '/admin/bookings';
    if (t.includes('payment')) return '/admin/payments';
    if (t.includes('maintenance')) return '/admin/maintenance';
    return '/admin/notifications';
  };

  // Dynamic user info from profile
  const initials = (() => {
    const fullName = profile?.full_name || user?.email?.split('@')[0] || 'Admin';
    const nameParts = fullName.trim().split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  })();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Admin';
  const roleDisplay = (() => {
    switch(role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'employee': return 'Employee';
      case 'staff': return 'Staff';
      default: return 'Admin';
    }
  })();
  const avatarUrl = profile?.avatar_url;

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]);
  };

  const handleQuickAction = (actionId) => {
    const routes = { newBooking: '/admin/bookings', addVehicle: '/admin/vehicles', addDriver: '/admin/drivers', markMaintenance: '/admin/maintenance' };
    if (routes[actionId]) navigate(routes[actionId]);
  };

  const isActive = (path) => location.pathname === path;

  const renderNavItem = (item) => {
    if (item.children) {
      const isExpanded = expandedGroups.includes(item.id);
      const hasActiveChild = item.children.some((c) => isActive(c.path));
      return (
        <div key={item.id} className="space-y-2">
          <button onClick={() => toggleGroup(item.id)}
            className={`nav-group flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-900/5 dark:hover:bg-white/10 ${hasActiveChild ? 'bg-slate-900/10 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </span>
            <span className={`material-symbols-outlined text-[18px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
          {isExpanded && (
            <div className="space-y-1 pl-2">
              {item.children.map((child) => (
                <NavLink key={child.id} to={child.path}
                  className={`nav-link child-link flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white ${isActive(child.path) ? 'bg-slate-900/10 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                  onClick={() => setMobileOpen(false)}>
                  <span className="material-symbols-outlined text-[18px]">{child.icon}</span>
                  <span>{child.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <NavLink key={item.id} to={item.path}
        className={`nav-link flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white ${isActive(item.path) ? 'bg-slate-900/10 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}
        onClick={() => setMobileOpen(false)}>
        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="relative min-h-full bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f1e8_55%,#ece7dc_100%)] dark:bg-[radial-gradient(circle_at_top_left,#1f2b31_0%,#11181d_52%,#0b1014_100%)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#f08f5f42,transparent_68%)]"></div>
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,#1f766833,transparent_70%)]"></div>
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        {/* Desktop Sidebar */}
        <aside className={`sticky top-0 hidden h-screen flex-col overflow-hidden border-r border-black/10 bg-white/75 backdrop-blur-xl transition-[width,padding,opacity,border] duration-300 lg:flex dark:border-white/10 dark:bg-black/20 ${sidebarCollapsed ? 'lg:w-0 lg:px-0 lg:py-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none' : 'w-[300px] p-5'}`}>
          <div className={`flex h-full flex-col transition-[transform,opacity] duration-300 ${sidebarCollapsed ? 'lg:-translate-x-3 lg:opacity-0 lg:pointer-events-none' : ''}`}>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Control Center</p>
              <h1 className="text-xl font-extrabold tracking-[-0.03em]">Fleet Admin</h1>
            </div>
            <nav className="scroll-thin flex-1 space-y-2 overflow-y-auto">
              {getNavItems(role).map(renderNavItem)}
            </nav>
            <div className="mt-4 rounded-xl border border-brand-100/90 bg-brand-50/80 p-4 dark:border-brand-500/20 dark:bg-brand-900/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-100">Live System</p>
              <p className="mt-1 text-sm font-semibold">Realtime Booking Sync</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Latency <span className="font-mono font-bold">41ms</span> <span className="ml-1 inline-block h-2 w-2 animate-pulseDot rounded-full bg-emerald-500"></span></p>
            </div>
            <button onClick={handleLogout} className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/10">Logout</button>
          </div>
        </aside>

        {/* Main Area */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-black/10 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-black/25">
            <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
              <button onClick={() => { if (window.innerWidth >= 1024) setSidebarCollapsed(!sidebarCollapsed); else setMobileOpen(!mobileOpen); }}
                className="flex-shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-900/10 dark:text-slate-100 dark:hover:bg-white/10">
                <span className="material-symbols-outlined">{sidebarCollapsed && window.innerWidth >= 1024 ? 'menu' : mobileOpen ? 'close' : 'menu'}</span>
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div ref={searchRef} className="relative min-w-0 flex-1">
                  <label className="relative block">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown} onFocus={() => { if (searchResults.length) setSearchOpen(true); }} placeholder="Search vehicles, bookings, customers, drivers…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-xs font-medium outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
                  </label>
                  {searchOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0e1a25]">
                      {flatResults.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-slate-400">No results found</div>
                      ) : searchResults.map((group) => (
                        <div key={group.type} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
                          <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{searchTypeLabels[group.type]}</p>
                          {group.items.map((item) => {
                            const fi = flatResults.findIndex((f) => f.id === item.id && f.type === group.type);
                            const active = fi === searchIdx;
                            return (
                              <button key={item.id} onClick={() => handleSearchSelect(group.type, item.id)} onMouseEnter={() => setSearchIdx(fi)}
                                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition ${active ? 'bg-[#1f7668]/10 dark:bg-[#1f7668]/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[#1f7668] shadow-[0_0_0_3px_rgba(31,118,104,0.15)]' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                                  <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="truncate">{item.meta}</span>
                                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">{searchTypeLabels[group.type]}</span>
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hidden items-center gap-2 flex-shrink-0 lg:flex">
                  {quickActions.map((action) => (
                    <button key={action.id} onClick={() => handleQuickAction(action.id)}
                      className="quick-action whitespace-nowrap rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/10" title={action.label}>
                      <span className="material-symbols-outlined text-[16px] align-middle">{action.icon}</span>
                      <span className="ml-1 hidden xl:inline">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <button onClick={toggleTheme} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" aria-label="Toggle theme" title="Toggle theme">
                  <span className="material-symbols-outlined text-[20px]">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <div ref={notifRef} className="relative">
                  <button onClick={() => setNotifOpen(!notifOpen)} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    {unreadCount > 0 && <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f08f5f] px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#1a2228]">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
                        <span className="text-sm font-extrabold">Notifications {unreadCount > 0 && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f08f5f] px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>}</span>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && <button onClick={markAllRead} title="Mark all read" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined text-[18px]">done_all</span></button>}
                          <button onClick={() => { setNotifOpen(false); navigate('/admin/notifications'); }} title="View all" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined text-[18px]">open_in_new</span></button>
                        </div>
                      </div>
                      <div className="max-h-[380px] overflow-y-auto">
                        {notifs.length === 0 ? (
                          <div className="px-4 py-10 text-center text-sm text-slate-400">No notifications yet.</div>
                        ) : notifs.slice(0, 15).map((n) => {
                          const ic = notifIcon(n.type);
                          return (
                            <button key={n.id} onClick={() => { if (!n.read) markNotifRead(n.id); setNotifOpen(false); navigate(notifNavTarget(n.type)); }}
                              className={`w-full text-left border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 ${!n.read ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                              <div className="flex items-start gap-2.5">
                                <span className={`material-symbols-outlined mt-0.5 shrink-0 text-[18px] ${ic.color}`}>{ic.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title || n.message}</p>
                                  {n.body && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{n.body}</p>}
                                  <div className="mt-1 flex items-center gap-2">
                                    {n.channel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-white/10">{n.channel}</span>}
                                    <span className="text-[10px] text-slate-400">{notifTimeAgo(n.created_at)}</span>
                                  </div>
                                </div>
                                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1f7668]"></span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={() => { setNotifOpen(false); navigate('/admin/notifications'); }} className="block w-full border-t border-slate-200 px-4 py-2.5 text-center text-xs font-semibold text-[#1f7668] hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">View All Notifications</button>
                    </div>
                  )}
                </div>
                <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  ) : null}
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-[11px] font-bold text-white ${avatarUrl ? 'hidden' : ''}`}>{initials}</span>
                  <span className="hidden text-xs font-semibold xl:inline dark:text-slate-100">{displayName}</span>
                  <span className="hidden text-[10px] text-slate-500 xl:inline dark:text-slate-400">({roleDisplay})</span>
                </button>
              </div>
            </div>
          </header>

          <main className="px-4 py-4 sm:px-6 sm:py-5">
            <section className="space-y-4">
              <Outlet />
            </section>
          </main>
        </div>

        {/* Mobile Sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)}></div>
            <aside className="scroll-thin absolute left-0 top-0 h-full w-[86%] max-w-[320px] overflow-y-auto border-r border-white/10 bg-[#0e171c] p-5 text-white">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold tracking-wide">Admin Navigation</h2>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
              </div>
              <nav className="space-y-2">{navItems.map(renderNavItem)}</nav>
              <button onClick={handleLogout} className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">Logout</button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
