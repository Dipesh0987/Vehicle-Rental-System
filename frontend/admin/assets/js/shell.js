import { quickActions } from './config.js';

export const navItems = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'settings_suggest',
    children: [
      { id: 'vehicles', label: 'Vehicles', icon: 'directions_car' },
      { id: 'fleet', label: 'Live Fleet', icon: 'map' },
      { id: 'bookings', label: 'Bookings', icon: 'event_note' },
      { id: 'customers', label: 'Customers', icon: 'groups' },
      { id: 'drivers', label: 'Drivers', icon: 'badge' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'payments',
    children: [
      { id: 'payments', label: 'Payments', icon: 'credit_card' },
      { id: 'pricing', label: 'Pricing & Promos', icon: 'percent' },
      { id: 'reports', label: 'Reporting', icon: 'monitoring' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: 'verified',
    children: [
      { id: 'contacts', label: 'Contact Messages', icon: 'mail' },
      { id: 'maintenance', label: 'Maintenance', icon: 'build' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    ],
  },
  { id: 'admins', label: 'Admin Roles', icon: 'shield' },
];

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'vrs_admin_sidebar_collapsed';
const MOBILE_TRANSITION_MS = 280;
let mobileSidebarHideTimer = null;

const renderNavLinks = (items) =>
  items
    .map((item) => {
      if (item.children) {
        const children = item.children
          .map(
            (child) => `<button data-nav-item="${child.id}" class="nav-link child-link flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
              <span class="material-symbols-outlined text-[18px]">${child.icon}</span>
              <span>${child.label}</span>
            </button>`
          )
          .join('');

        return `<div class="space-y-2">
          <button data-nav-group="${item.id}" class="nav-group flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/10">
            <span class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">${item.icon}</span>
              ${item.label}
            </span>
            <span class="material-symbols-outlined text-[18px]">expand_more</span>
          </button>
          <div data-nav-children="${item.id}" class="space-y-1 pl-2">${children}</div>
        </div>`;
      }

      return `<button data-nav-item="${item.id}" class="nav-link flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white">
        <span class="material-symbols-outlined text-[18px]">${item.icon}</span>
        <span>${item.label}</span>
      </button>`;
    })
    .join('');

const renderQuickActions = () =>
  quickActions
    .map(
      (action) => `<button data-quick-action="${action.id}" class="quick-action whitespace-nowrap rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/10" title="${action.label}">
        <span class="material-symbols-outlined text-[16px] align-middle">${action.icon}</span>
        <span class="ml-1 hidden xl:inline">${action.label}</span>
      </button>`
    )
    .join('');

function getAdminDisplayName() {
  if (window.AdminAuth && typeof window.AdminAuth.getDisplayName === 'function') {
    return window.AdminAuth.getDisplayName();
  }
  return 'Admin';
}

function getAdminInitials() {
  const name = getAdminDisplayName();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || 'AD').toUpperCase();
}

export function renderShell() {
  return `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,500,0,0" />
    
    
    <aside id="sidebar" class="sticky top-0 hidden h-screen w-[300px] flex-col overflow-hidden border-r border-black/10 bg-white/75 p-5 backdrop-blur-xl transition-[width,padding,opacity,border] duration-300 lg:flex dark:border-white/10 dark:bg-black/20">
      <div id="sidebarContent" class="flex h-full flex-col transition-[transform,opacity] duration-300">
        <div class="mb-6">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Control Center</p>
          <h1 class="text-xl font-extrabold tracking-[-0.03em]">Fleet Admin</h1>
        </div>

        <nav class="scroll-thin flex-1 space-y-2 overflow-y-auto">
          ${renderNavLinks(navItems)}
        </nav>

        <div class="mt-4 rounded-xl border border-brand-100/90 bg-brand-50/80 p-4 dark:border-brand-500/20 dark:bg-brand-900/30">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-100">Live System</p>
          <p class="mt-1 text-sm font-semibold">Realtime Booking Sync</p>
          <p class="mt-2 text-xs text-slate-600 dark:text-slate-300">Latency <span class="font-mono font-bold">41ms</span> <span class="ml-1 inline-block h-2 w-2 animate-pulseDot rounded-full bg-emerald-500"></span></p>
        </div>

        <button data-admin-logout class="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/10">Logout</button>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <header class="sticky top-0 z-30 border-b border-black/10 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-black/25">
        <div class="flex flex-nowrap items-center gap-2 sm:gap-3">
          <!-- Sidebar toggle — visible on ALL breakpoints -->
          <button id="sidebarToggleBtn" class="flex-shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-900/10 dark:text-slate-100 dark:hover:bg-white/10" aria-label="Open sidebar">
            <span id="sidebarToggleIcon" class="material-symbols-outlined">menu</span>
          </button>

          <!-- Search + quick actions fill remaining space -->          
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <label class="relative min-w-0 flex-1">
              <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
              <input id="globalSearch" placeholder="Search bookings, vehicles…" class="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-xs font-medium outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
            </label>
            <div id="quickActions" class="hidden items-center gap-2 flex-shrink-0 lg:flex">${renderQuickActions()}</div>
          </div>

          <div class="flex flex-shrink-0 items-center gap-2">
            <button id="notificationBtn" class="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" aria-label="Notifications">
              <span class="material-symbols-outlined text-[20px]">notifications</span>
              <span id="notificationBadgeCount" class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-peach px-1 text-[10px] font-bold text-white">3</span>
            </button>

            <button id="themeToggle" class="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" aria-label="Toggle theme">
              <span class="material-symbols-outlined text-[20px]">contrast</span>
            </button>

            <button id="profileBtn" class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5">
              <span id="profileInitials" class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-[11px] font-bold text-white">${getAdminInitials()}</span>
              <span id="profileDisplayName" class="hidden text-xs font-semibold xl:inline dark:text-slate-100">${escapeHtml(getAdminDisplayName())}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="px-4 py-4 sm:px-6 sm:py-5">
        <section id="moduleContent" class="space-y-4"></section>
      </main>
    </div>

    <div id="mobileSidebar" class="fixed inset-0 z-50 hidden lg:hidden">
      <div id="mobileSidebarBackdrop" class="absolute inset-0 bg-black/50"></div>
      <aside id="mobileSidebarPanel" class="scroll-thin absolute left-0 top-0 h-full w-[86%] max-w-[320px] overflow-y-auto border-r border-white/10 bg-[#0e171c] p-5 text-white">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold tracking-wide">Admin Navigation</h2>
          <button id="mobileSidebarClose" class="rounded-lg p-2 hover:bg-white/10" aria-label="Close sidebar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <nav class="space-y-2">${renderNavLinks(navItems)}</nav>
        <button data-admin-logout class="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">Logout</button>
      </aside>
    </div>

    <div id="toastHost" class="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2"></div>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleCaseWords(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function isReservedAdminLabel(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  return normalized.indexOf('super admin') >= 0 || normalized.indexOf('platform admin') >= 0;
}

function formatAdminLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'Admin';
  }

  const source = raw.includes('@') ? raw.split('@')[0] : raw;
  const cleaned = source.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (isReservedAdminLabel(cleaned)) {
    return 'Admin';
  }

  return cleaned ? titleCaseWords(cleaned) : 'Admin';
}

export function pushToast(message, variant = 'info') {
  const host = document.getElementById('toastHost');
  if (!host) {
    return;
  }

  const colorMap = {
    info: 'bg-slate-900 text-white',
    success: 'bg-emerald-600 text-white',
    warn: 'bg-amber-500 text-slate-900',
    error: 'bg-rose-600 text-white',
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto rounded-xl px-4 py-2 text-sm font-semibold shadow-panel ${colorMap[variant] || colorMap.info} animate-fadeUp`;
  toast.textContent = message;
  host.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}

export function bindShellInteractions(onNavigate, onQuickAction, onSearch, onSearchKeyDown) {
  const navButtons = document.querySelectorAll('[data-nav-item]');
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-nav-item');
      if (!id) return;
      onNavigate(id);
      setActiveNav(id);
      closeMobileSidebar();
    });
  });

  const groupButtons = document.querySelectorAll('[data-nav-group]');
  groupButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.getAttribute('data-nav-group');
      if (!group) return;
      const containers = document.querySelectorAll(`[data-nav-children="${group}"]`);
      containers.forEach((container) => {
        container.classList.toggle('hidden');
      });
    });
  });

  const actionButtons = document.querySelectorAll('[data-quick-action]');
  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-quick-action');
      if (!id) return;
      onQuickAction(id);
    });
  });

  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      onSearch(event.target.value || '');
    });
    searchInput.addEventListener('keydown', (event) => {
      if (typeof onSearchKeyDown === 'function') {
        onSearchKeyDown(event);
      }
    });
  }

  const logoutButtons = document.querySelectorAll('[data-admin-logout]');
  logoutButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeMobileSidebar(true);

      if (window.AdminAuth && typeof window.AdminAuth.signOut === 'function') {
        window.AdminAuth.signOut();
        return;
      }

      window.location.assign('login.html');
    });
  });

  const sidebarToggleButtons = document.querySelectorAll('#sidebarToggleBtn');
  sidebarToggleButtons.forEach((button) => {
    button.addEventListener('click', handleSidebarToggle);
  });

  const mobileClose = document.getElementById('mobileSidebarClose');
  const mobileBackdrop = document.getElementById('mobileSidebarBackdrop');
  mobileClose?.addEventListener('click', () => closeMobileSidebar());
  mobileBackdrop?.addEventListener('click', () => closeMobileSidebar());

  initSidebarBehavior();

  // Profile dropdown
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAdminProfilePanel();
    });
    document.addEventListener('pointerdown', (e) => {
      const panel = document.getElementById('adminProfilePanel');
      if (panel && !panel.contains(e.target) && !profileBtn.contains(e.target)) {
        panel.remove();
      }
    });
  }
}

export function setActiveNav(id) {
  const activeButton = document.querySelector(`[data-nav-item="${CSS.escape(String(id || ''))}"]`);
  const activeGroup = activeButton?.closest('[data-nav-children]')?.getAttribute('data-nav-children') || '';

  document.querySelectorAll('[data-nav-item]').forEach((button) => {
    const active = button.getAttribute('data-nav-item') === id;
    button.classList.toggle('bg-slate-900/10', active);
    button.classList.toggle('text-slate-900', active);
    button.classList.toggle('dark:bg-white/20', active);
    button.classList.toggle('dark:text-white', active);
  });

  document.querySelectorAll('[data-nav-group]').forEach((button) => {
    const group = button.getAttribute('data-nav-group');
    const active = Boolean(activeGroup) && group === activeGroup;
    button.classList.toggle('bg-slate-900/10', active);
    button.classList.toggle('text-slate-900', active);
    button.classList.toggle('dark:bg-white/20', active);
    button.classList.toggle('dark:text-white', active);
  });

  if (activeGroup) {
    document.querySelectorAll(`[data-nav-children="${CSS.escape(activeGroup)}"]`).forEach((container) => {
      container.classList.remove('hidden');
    });
    const parentGroupButton = document.querySelector(`[data-nav-group="${CSS.escape(activeGroup)}"]`);
    parentGroupButton?.scrollIntoView({ block: 'nearest' });
  }

  activeButton?.scrollIntoView({ block: 'nearest' });
}

function initSidebarBehavior() {
  applyDesktopSidebarState(false);
  closeMobileSidebar(true);

  window.addEventListener('resize', handleSidebarViewportChange);
  handleSidebarViewportChange();
}

function handleSidebarToggle() {
  if (isDesktopViewport()) {
    applyDesktopSidebarState(!isDesktopSidebarCollapsed());
    return;
  }

  if (isMobileSidebarVisible()) {
    closeMobileSidebar();
    return;
  }

  openMobileSidebar();
}

function handleSidebarViewportChange() {
  if (isDesktopViewport()) {
    closeMobileSidebar(true);
  }

  updateSidebarToggleVisual(isDesktopSidebarCollapsed(), isMobileSidebarVisible());
}

function isDesktopViewport() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function readDesktopSidebarCollapsedState() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === '1';
  } catch (_error) {
    return false;
  }
}

function writeDesktopSidebarCollapsedState(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');
  } catch (_error) {
    // Ignore localStorage write failures.
  }
}

function isDesktopSidebarCollapsed() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    return readDesktopSidebarCollapsedState();
  }

  return sidebar.classList.contains('lg:w-0');
}

function applyDesktopSidebarState(collapsed) {
  const sidebar = document.getElementById('sidebar');
  const sidebarContent = document.getElementById('sidebarContent');

  if (!sidebar || !sidebarContent) {
    return;
  }

  const shouldCollapse = Boolean(collapsed);
  sidebar.classList.toggle('lg:w-0', shouldCollapse);
  sidebar.classList.toggle('lg:px-0', shouldCollapse);
  sidebar.classList.toggle('lg:py-0', shouldCollapse);
  sidebar.classList.toggle('lg:border-r-0', shouldCollapse);
  sidebar.classList.toggle('lg:opacity-0', shouldCollapse);
  sidebar.classList.toggle('lg:pointer-events-none', shouldCollapse);

  sidebarContent.classList.toggle('lg:-translate-x-3', shouldCollapse);
  sidebarContent.classList.toggle('lg:opacity-0', shouldCollapse);
  sidebarContent.classList.toggle('lg:pointer-events-none', shouldCollapse);

  sidebar.setAttribute('aria-hidden', shouldCollapse ? 'true' : 'false');
  writeDesktopSidebarCollapsedState(shouldCollapse);
  updateSidebarToggleVisual(shouldCollapse, false);
}

function updateSidebarToggleVisual(isCollapsed, mobileOpen) {
  const icon = document.getElementById('sidebarToggleIcon');
  const button = document.getElementById('sidebarToggleBtn');
  if (!icon || !button) {
    return;
  }

  if (isDesktopViewport()) {
    icon.textContent = isCollapsed ? 'menu' : 'menu_open';
    button.setAttribute('aria-label', isCollapsed ? 'Open sidebar' : 'Close sidebar');
    return;
  }

  icon.textContent = mobileOpen ? 'close' : 'menu';
  button.setAttribute('aria-label', mobileOpen ? 'Close sidebar' : 'Open sidebar');
}

function isMobileSidebarVisible() {
  const sidebar = document.getElementById('mobileSidebar');
  return Boolean(sidebar && !sidebar.classList.contains('hidden'));
}

function openMobileSidebar() {
  const sidebar = document.getElementById('mobileSidebar');
  const backdrop = document.getElementById('mobileSidebarBackdrop');
  const panel = document.getElementById('mobileSidebarPanel');

  if (!sidebar || !backdrop || !panel) {
    return;
  }

  if (mobileSidebarHideTimer) {
    window.clearTimeout(mobileSidebarHideTimer);
    mobileSidebarHideTimer = null;
  }

  sidebar.classList.remove('hidden');
  sidebar.classList.remove('pointer-events-none');
  sidebar.classList.add('pointer-events-auto');

  window.requestAnimationFrame(() => {
    backdrop.classList.remove('bg-black/0');
    backdrop.classList.add('bg-black/55');
    panel.classList.remove('-translate-x-full');
    panel.classList.add('translate-x-0');
    updateSidebarToggleVisual(isDesktopSidebarCollapsed(), true);
  });
}

function closeMobileSidebar(immediate = false) {
  const sidebar = document.getElementById('mobileSidebar');
  const backdrop = document.getElementById('mobileSidebarBackdrop');
  const panel = document.getElementById('mobileSidebarPanel');

  if (!sidebar || !backdrop || !panel) {
    return;
  }

  if (mobileSidebarHideTimer) {
    window.clearTimeout(mobileSidebarHideTimer);
    mobileSidebarHideTimer = null;
  }

  backdrop.classList.remove('bg-black/55');
  backdrop.classList.add('bg-black/0');
  panel.classList.remove('translate-x-0');
  panel.classList.add('-translate-x-full');
  updateSidebarToggleVisual(isDesktopSidebarCollapsed(), false);

  const finalizeClose = () => {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('pointer-events-auto');
    sidebar.classList.add('pointer-events-none');
  };

  if (immediate) {
    finalizeClose();
    return;
  }

  mobileSidebarHideTimer = window.setTimeout(finalizeClose, MOBILE_TRANSITION_MS);
}

const ADMIN_AVATAR_STORAGE_KEY = 'vrs_admin_avatar_url';

function getStoredAdminAvatar() {
  try { return window.localStorage.getItem(ADMIN_AVATAR_STORAGE_KEY) || ''; } catch (_e) { return ''; }
}

function setStoredAdminAvatar(url) {
  try { window.localStorage.setItem(ADMIN_AVATAR_STORAGE_KEY, url || ''); } catch (_e) { /* ignore */ }
}

function updateHeaderAvatar(avatarUrl) {
  const initialsEl = document.getElementById('profileInitials');
  if (!initialsEl) return;
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = 'Admin';
    img.className = 'h-8 w-8 rounded-full object-cover';
    img.onerror = function () { this.replaceWith(initialsEl.cloneNode(true)); };
    initialsEl.replaceWith(img);
    img.id = 'profileInitials';
  }
}

function initAdminAvatar() {
  const stored = getStoredAdminAvatar();
  if (stored) {
    queueMicrotask(() => updateHeaderAvatar(stored));
  }
  // Also try to fetch from Supabase session
  const auth = window.VehicleAuthService;
  if (auth && typeof auth.getSession === 'function') {
    auth.getSession().then(function (session) {
      if (!session || !session.user) return;
      const meta = session.user.user_metadata || {};
      const avatarUrl = meta.avatar_url || meta.avatarUrl || '';
      if (avatarUrl) {
        setStoredAdminAvatar(avatarUrl);
        updateHeaderAvatar(avatarUrl);
      }
    }).catch(function () { /* ignore */ });
  }
}

// Auto-init avatar when shell loads
queueMicrotask(initAdminAvatar);

function toggleAdminProfilePanel() {
  const existing = document.getElementById('adminProfilePanel');
  if (existing) {
    existing.remove();
    return;
  }

  const name = getAdminDisplayName();
  const initials = getAdminInitials();
  const storedAvatar = getStoredAdminAvatar();
  let email = '';
  let role = 'Admin';
  if (window.AdminAuth && typeof window.AdminAuth.getSession === 'function') {
    const session = window.AdminAuth.getSession();
    if (session) {
      email = session.email || '';
      role = (session.role || 'admin').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  const avatarHtml = storedAvatar
    ? `<img id="adminPanelAvatar" src="${escapeHtml(storedAvatar)}" alt="Admin" class="h-14 w-14 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-md" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';" />
       <span class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-base font-bold text-white" style="display:none">${escapeHtml(initials)}</span>`
    : `<span class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-base font-bold text-white">${escapeHtml(initials)}</span>`;

  const panel = document.createElement('div');
  panel.id = 'adminProfilePanel';
  panel.className = 'absolute right-4 top-[60px] z-[100] w-80 origin-top-right rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#1a2228]';
  panel.innerHTML = `
    <div class="flex flex-col items-center gap-2 mb-4">
      <div class="relative group cursor-pointer" id="adminAvatarWrapper">
        ${avatarHtml}
        <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition pointer-events-none">
          <span class="material-symbols-outlined text-white text-[20px]">photo_camera</span>
        </div>
        <input id="adminAvatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" title="Upload profile image" />
      </div>
      <p id="adminAvatarStatus" class="text-[11px] font-medium text-slate-400 dark:text-slate-500 h-4"></p>
      <p class="text-sm font-bold truncate dark:text-slate-100">${escapeHtml(name)}</p>
      <p class="text-xs text-slate-500 truncate dark:text-slate-400">${escapeHtml(email || 'admin@system')}</p>
    </div>
    <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Role</p>
      <p class="mt-0.5 text-sm font-semibold dark:text-slate-200">${escapeHtml(role)}</p>
    </div>
    ${storedAvatar ? `<button id="adminRemoveAvatar" class="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-amber-400/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-300">Remove Photo</button>` : ''}
    <button id="adminProfileLogout" class="w-full rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300">Logout</button>
  `;

  const header = document.querySelector('header.sticky');
  if (header) {
    header.style.position = 'relative';
    header.appendChild(panel);
  } else {
    document.body.appendChild(panel);
  }

  // Handle avatar upload
  const avatarInput = panel.querySelector('#adminAvatarInput');
  const statusEl = panel.querySelector('#adminAvatarStatus');
  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;

      const auth = window.VehicleAuthService;
      if (!auth || typeof auth.uploadProfileImage !== 'function' || typeof auth.upsertProfile !== 'function') {
        if (statusEl) { statusEl.textContent = 'Upload service unavailable'; statusEl.className = 'text-[11px] font-medium text-rose-500 h-4'; }
        return;
      }

      if (statusEl) { statusEl.textContent = 'Uploading...'; statusEl.className = 'text-[11px] font-medium text-brand-600 dark:text-brand-400 h-4 animate-pulse'; }

      try {
        const uploadedUrl = await auth.uploadProfileImage(file);
        await auth.upsertProfile({ fullName: name, avatarUrl: uploadedUrl });

        setStoredAdminAvatar(uploadedUrl);
        updateHeaderAvatar(uploadedUrl);

        // Update panel avatar
        const wrapper = panel.querySelector('#adminAvatarWrapper');
        if (wrapper) {
          const existingImg = wrapper.querySelector('#adminPanelAvatar');
          if (existingImg) {
            existingImg.src = uploadedUrl;
          } else {
            const newImg = document.createElement('img');
            newImg.id = 'adminPanelAvatar';
            newImg.src = uploadedUrl;
            newImg.alt = 'Admin';
            newImg.className = 'h-14 w-14 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-md';
            const fallbackSpan = wrapper.querySelector('span');
            if (fallbackSpan) fallbackSpan.style.display = 'none';
            wrapper.insertBefore(newImg, wrapper.firstChild);
          }
        }

        if (statusEl) { statusEl.textContent = 'Photo updated!'; statusEl.className = 'text-[11px] font-medium text-emerald-600 dark:text-emerald-400 h-4'; }
        pushToast('Profile image updated', 'success');
      } catch (err) {
        const msg = (err && err.message) || 'Upload failed';
        if (statusEl) { statusEl.textContent = msg; statusEl.className = 'text-[11px] font-medium text-rose-500 h-4'; }
        pushToast('Image upload failed: ' + msg, 'error');
      }

      avatarInput.value = '';
    });
  }

  // Handle remove avatar
  panel.querySelector('#adminRemoveAvatar')?.addEventListener('click', async () => {
    const auth = window.VehicleAuthService;
    if (auth && typeof auth.upsertProfile === 'function') {
      try {
        await auth.upsertProfile({ fullName: name, avatarUrl: '' });
      } catch (_e) { /* best effort */ }
    }
    setStoredAdminAvatar('');
    // Restore initials in header
    const headerAvatarEl = document.getElementById('profileInitials');
    if (headerAvatarEl) {
      const span = document.createElement('span');
      span.id = 'profileInitials';
      span.className = 'inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-[11px] font-bold text-white';
      span.textContent = getAdminInitials();
      headerAvatarEl.replaceWith(span);
    }
    panel.remove();
    pushToast('Profile image removed', 'success');
  });

  panel.querySelector('#adminProfileLogout')?.addEventListener('click', () => {
    panel.remove();
    if (window.AdminAuth && typeof window.AdminAuth.signOut === 'function') {
      window.AdminAuth.signOut();
    } else {
      window.location.assign('login.html');
    }
  });
}
