'use client';

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import '@/styles/admin.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: NavItem[];
}

const getNavItems = (userRole: string): NavItem[] => {
  const items: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard', path: '/admin' },
    {
      id: 'operations', label: 'Operations', icon: 'settings_suggest',
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
        { id: 'vendor-enquiries', label: 'Vendor Enquiries', icon: 'storefront', path: '/admin/vendor-enquiries' },
        { id: 'damage-claims', label: 'Damage Claims', icon: 'warning', path: '/admin/damage-claims' },
        { id: 'maintenance', label: 'Maintenance', icon: 'build', path: '/admin/maintenance' },
        { id: 'notifications', label: 'Notifications', icon: 'notifications', path: '/admin/notifications' },
      ],
    },
  ];
  
  if (userRole === 'super_admin') {
    items.push({ id: 'admins', label: 'Admin Roles', icon: 'shield', path: '/admin/admins' });
    items.push({ id: 'settings', label: 'Settings', icon: 'settings', path: '/admin/settings' });
  }
  
  return items;
};

const quickActions = [
  { id: 'newBooking', label: 'Create Booking', icon: 'event_available' },
  { id: 'addVehicle', label: 'Add Vehicle', icon: 'directions_car' },
  { id: 'addDriver', label: 'Add Driver', icon: 'person_add' },
  { id: 'markMaintenance', label: 'Report Damage', icon: 'car_repair' },
];

const searchTypeLabels: Record<string, string> = { vehicles: 'Vehicles', bookings: 'Bookings', customers: 'Customers', drivers: 'Drivers' };
const searchTypeRoutes: Record<string, string> = { vehicles: '/admin/vehicles', bookings: '/admin/bookings', customers: '/admin/customers', drivers: '/admin/drivers' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(['operations', 'finance', 'quality']);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIdx, setSearchIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const collapsed = localStorage.getItem('vrs_admin_sidebar_collapsed') === '1';
      setSidebarCollapsed(collapsed);
    } catch {}
  }, []);

  // Auth check - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [user, authLoading, pathname, router]);

  // If on login page, don't show layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (authLoading || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-[3px] border-[#1f7668] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not authenticated, show nothing (will redirect)
  if (!user) {
    return null;
  }

  const role = profile?.role || 'admin';
  const navItems = getNavItems(role);

  const doSearch = async (q: string) => {
    if (!q || q.trim().length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    const term = `%${q.trim()}%`;
    const groups: any[] = [];
    try {
      const [vRes, bRes, cRes, dRes] = await Promise.all([
        supabase.from('vehicles').select('id, name, brand, category, vehicle_number').ilike('name', term).limit(5),
        supabase.from('bookings').select('id, booking_code, customer_name, customer_email, vehicles(name)').or(`booking_code.ilike.${term},customer_name.ilike.${term},customer_email.ilike.${term}`).limit(5),
        supabase.from('user_profiles').select('id, full_name, email, phone, avatar_url').or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`).limit(5),
        supabase.from('drivers').select('id, driver_id, full_name, phone, availability').or(`full_name.ilike.${term},driver_id.ilike.${term},phone.ilike.${term}`).limit(5),
      ]);
      if (vRes.data?.length) groups.push({ type: 'vehicles', items: vRes.data.map((v: any) => ({ id: v.id, label: v.name || v.id, meta: [v.brand, v.category, v.vehicle_number].filter(Boolean).join(' · ') })) });
      if (bRes.data?.length) groups.push({ type: 'bookings', items: bRes.data.map((b: any) => ({ id: b.id, label: b.booking_code || b.id?.slice(0, 8), meta: [b.customer_name, b.vehicles?.name].filter(Boolean).join(' — ') })) });
      if (cRes.data?.length) groups.push({ type: 'customers', items: cRes.data.map((c: any) => ({ id: c.id, label: c.full_name || c.email || c.id?.slice(0, 8), meta: c.email || c.phone || '' })) });
      if (dRes.data?.length) groups.push({ type: 'drivers', items: dRes.data.map((d: any) => ({ id: d.id, label: d.full_name || d.driver_id || d.id?.slice(0, 8), meta: [d.availability, d.phone].filter(Boolean).join(' · ') })) });
    } catch {}
    setSearchResults(groups);
    setSearchIdx(groups.length ? 0 : -1);
    setSearchOpen(true);
  };

  const flatResults = searchResults.flatMap((g) => g.items.map((it: any) => ({ ...it, type: g.type })));

  const handleSearchSelect = (type: string) => {
    setSearchQuery(''); setSearchOpen(false); setSearchResults([]);
    router.push(searchTypeRoutes[type] || '/admin');
  };

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
      default: return 'Admin';
    }
  })();
  const avatarUrl = profile?.avatar_url || profile?.profile_image_url;

  const handleLogout = async () => {
    await signOut();
    router.push('/admin/login');
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]);
  };

  const handleQuickAction = (actionId: string) => {
    const routes: Record<string, string> = { newBooking: '/admin/bookings', addVehicle: '/admin/vehicles', addDriver: '/admin/drivers', markMaintenance: '/admin/maintenance' };
    if (routes[actionId]) router.push(routes[actionId]);
  };

  const isActive = (path: string) => pathname === path;

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const isExpanded = expandedGroups.includes(item.id);
      const hasActiveChild = item.children.some((c) => c.path && isActive(c.path));
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
                <Link key={child.id} href={child.path || '#'}
                  className={`nav-link child-link flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white ${child.path && isActive(child.path) ? 'bg-slate-900/10 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                  onClick={() => setMobileOpen(false)}>
                  <span className="material-symbols-outlined text-[18px]">{child.icon}</span>
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <Link key={item.id} href={item.path || '#'}
        className={`nav-link flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white ${item.path && isActive(item.path) ? 'bg-slate-900/10 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}
        onClick={() => setMobileOpen(false)}>
        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f1e8_55%,#ece7dc_100%)] dark:bg-[radial-gradient(circle_at_top_left,#1f2b31_0%,#11181d_52%,#0b1014_100%)]">
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
              {navItems.map(renderNavItem)}
            </nav>
            <div className="mt-4 rounded-xl border border-[#1f7668]/20 bg-[#1f7668]/10 p-4 dark:border-[#1f7668]/30 dark:bg-[#1f7668]/20">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1f7668] dark:text-[#5bbfb5]">Live System</p>
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
              <button onClick={() => { if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarCollapsed(!sidebarCollapsed); else setMobileOpen(!mobileOpen); }}
                className="flex-shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-900/10 dark:text-slate-100 dark:hover:bg-white/10">
                <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div ref={searchRef} className="relative min-w-0 flex-1">
                  <label className="relative block">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
                    <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }} placeholder="Search vehicles, bookings, customers…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-xs font-medium outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
                  </label>
                  {searchOpen && flatResults.length > 0 && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0e1a25]">
                      {searchResults.map((group) => (
                        <div key={group.type} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
                          <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{searchTypeLabels[group.type]}</p>
                          {group.items.map((item: any) => (
                            <button key={item.id} onClick={() => handleSearchSelect(group.type)}
                              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/5">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{item.meta}</span>
                              </span>
                            </button>
                          ))}
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
                <button onClick={toggleTheme} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" aria-label="Toggle theme">
                  <span className="material-symbols-outlined text-[20px]">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-[11px] font-bold text-white">{initials}</span>
                  )}
                  <span className="hidden text-xs font-semibold xl:inline dark:text-slate-100">{displayName}</span>
                  <span className="hidden text-[10px] text-slate-500 xl:inline dark:text-slate-400">({roleDisplay})</span>
                </button>
              </div>
            </div>
          </header>

          <main className="px-4 py-4 sm:px-6 sm:py-5">
            <section className="space-y-4">
              {children}
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
              <button onClick={handleLogout} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">Logout</button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
