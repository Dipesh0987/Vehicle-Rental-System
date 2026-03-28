import { quickActions } from './config.js';

export const navItems = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'settings_suggest',
    children: [
      { id: 'vehicles', label: 'Vehicles', icon: 'directions_car' },
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
      { id: 'maintenance', label: 'Maintenance', icon: 'build' },
      { id: 'reviews', label: 'Reviews', icon: 'rate_review' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    ],
  },
  { id: 'admins', label: 'Admin Roles', icon: 'shield' },
];

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
      (action) => `<button data-quick-action="${action.id}" class="quick-action rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/10">
        <span class="material-symbols-outlined mr-1.5 text-[18px] align-middle">${action.icon}</span>
        <span>${action.label}</span>
      </button>`
    )
    .join('');

export function renderShell() {
  return `
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,500,0,0" />
  <aside id="sidebar" class="sticky top-0 hidden h-screen w-[300px] flex-col border-r border-black/10 bg-white/75 p-5 backdrop-blur-xl lg:flex dark:border-white/10 dark:bg-black/20">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Control Center</p>
        <h1 class="text-xl font-extrabold tracking-[-0.03em]">Fleet Admin</h1>
      </div>
      <button id="collapseSidebar" class="rounded-lg p-2 text-slate-600 hover:bg-slate-900/10 dark:text-slate-300 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[20px]">left_panel_close</span>
      </button>
    </div>

    <nav class="scroll-thin flex-1 space-y-2 overflow-y-auto">
      ${renderNavLinks(navItems)}
    </nav>

    <div class="mt-4 rounded-xl border border-brand-100/90 bg-brand-50/80 p-4 dark:border-brand-500/20 dark:bg-brand-900/30">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-100">Live System</p>
      <p class="mt-1 text-sm font-semibold">Realtime Booking Sync</p>
      <p class="mt-2 text-xs text-slate-600 dark:text-slate-300">Latency <span class="font-mono font-bold">41ms</span> <span class="ml-1 inline-block h-2 w-2 animate-pulseDot rounded-full bg-emerald-500"></span></p>
    </div>
  </aside>

  <div class="min-w-0 flex-1">
    <header class="sticky top-0 z-30 border-b border-black/10 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-black/25">
      <div class="flex flex-wrap items-center gap-3">
        <button id="mobileSidebarToggle" class="rounded-lg p-2 text-slate-700 hover:bg-slate-900/10 lg:hidden dark:text-slate-100 dark:hover:bg-white/10">
          <span class="material-symbols-outlined">menu</span>
        </button>

        <label class="relative min-w-[230px] flex-1 max-w-[480px]">
          <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
          <input id="globalSearch" placeholder="Search bookings, customer, invoice, vehicle..." class="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
        </label>

        <div id="quickActions" class="hidden items-center gap-2 xl:flex">${renderQuickActions()}</div>

        <button id="notificationBtn" class="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
          <span class="material-symbols-outlined">notifications</span>
          <span class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-peach px-1 text-[10px] font-bold text-white">3</span>
        </button>

        <button id="themeToggle" class="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
          <span class="material-symbols-outlined">contrast</span>
        </button>

        <button id="profileBtn" class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-xs font-bold text-white">AG</span>
          <span class="hidden text-sm font-semibold sm:inline">Ariana Gray</span>
        </button>
      </div>
    </header>

    <main class="px-4 py-4 sm:px-6 sm:py-5">
      <section id="moduleContent" class="space-y-4"></section>
    </main>
  </div>

  <div id="mobileSidebar" class="fixed inset-0 z-50 hidden lg:hidden">
    <div id="mobileSidebarBackdrop" class="absolute inset-0 bg-black/50"></div>
    <aside class="scroll-thin absolute left-0 top-0 h-full w-[86%] max-w-[320px] overflow-y-auto border-r border-white/10 bg-[#0e171c] p-5 text-white">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-bold tracking-wide">Admin Navigation</h2>
        <button id="mobileSidebarClose" class="rounded-lg p-2 hover:bg-white/10"><span class="material-symbols-outlined">close</span></button>
      </div>
      <nav class="space-y-2">${renderNavLinks(navItems)}</nav>
    </aside>
  </div>

  <div id="toastHost" class="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2"></div>
  `;
}

export function pushToast(message, variant = 'info') {
  const host = document.getElementById('toastHost');
  if (!host) return;

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

export function bindShellInteractions(onNavigate, onQuickAction, onSearch) {
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
      const container = document.querySelector(`[data-nav-children="${group}"]`);
      if (!container) return;
      container.classList.toggle('hidden');
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
  }

  const mobileToggle = document.getElementById('mobileSidebarToggle');
  const mobileClose = document.getElementById('mobileSidebarClose');
  const mobileBackdrop = document.getElementById('mobileSidebarBackdrop');
  mobileToggle?.addEventListener('click', openMobileSidebar);
  mobileClose?.addEventListener('click', closeMobileSidebar);
  mobileBackdrop?.addEventListener('click', closeMobileSidebar);
}

export function setActiveNav(id) {
  document.querySelectorAll('[data-nav-item]').forEach((button) => {
    const active = button.getAttribute('data-nav-item') === id;
    button.classList.toggle('bg-slate-900/10', active);
    button.classList.toggle('text-slate-900', active);
    button.classList.toggle('dark:bg-white/20', active);
    button.classList.toggle('dark:text-white', active);
  });
}

function openMobileSidebar() {
  const sidebar = document.getElementById('mobileSidebar');
  sidebar?.classList.remove('hidden');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('mobileSidebar');
  sidebar?.classList.add('hidden');
}
