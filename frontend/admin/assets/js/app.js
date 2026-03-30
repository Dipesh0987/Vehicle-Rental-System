import { appConfig } from './config.js';
import { dashboardData } from './data.js';
import { bindShellInteractions, pushToast, renderShell, setActiveNav, setAdminIdentity } from './shell.js';
import { renderOverviewModule } from './modules/overview.js';
import { renderVehiclesModule } from './modules/vehicles.js';
import { renderBookingsModule } from './modules/bookings.js';
import { renderCustomersModule } from './modules/customers.js';
import { renderDriversModule } from './modules/drivers.js';
import { renderPaymentsModule } from './modules/payments.js';
import { renderPricingModule } from './modules/pricing.js';
import { renderMaintenanceModule } from './modules/maintenance.js';
import { renderReviewsModule } from './modules/reviews.js';
import { renderAdminsModule } from './modules/admins.js';
import { renderNotificationsModule } from './modules/notifications.js';
import { renderReportsModule } from './modules/reports.js';

const modules = {
  overview: renderOverviewModule,
  vehicles: renderVehiclesModule,
  bookings: renderBookingsModule,
  customers: renderCustomersModule,
  drivers: renderDriversModule,
  payments: renderPaymentsModule,
  pricing: renderPricingModule,
  maintenance: renderMaintenanceModule,
  reviews: renderReviewsModule,
  admins: renderAdminsModule,
  notifications: renderNotificationsModule,
  reports: renderReportsModule,
};

const appState = {
  activeModule: 'overview',
  globalSearch: '',
  data: structuredClone(dashboardData),
  adminIdentity: null,
};

bootstrap();

async function bootstrap() {
  const root = document.getElementById('adminApp');
  if (!root) return;

  const access = await ensureAdminAccess();
  if (!access.allowed) {
    return;
  }

  appState.adminIdentity = access.identity;

  root.innerHTML = renderShell();
  initTheme();
  bindShellInteractions(handleNavigate, handleQuickAction, handleGlobalSearch, handleAdminLogout);
  setAdminIdentity(appState.adminIdentity || { displayName: 'Admin', role: 'Admin', initials: 'AD' });
  renderActiveModule();
  setActiveNav(appState.activeModule);
}

async function ensureAdminAccess() {
  const auth = window.AdminAuthService;
  if (!auth || typeof auth.requireAdminAccess !== 'function') {
    return {
      allowed: true,
      identity: { displayName: 'Admin', role: 'Admin', initials: 'AD' },
    };
  }

  const access = await auth.requireAdminAccess({
    redirectIfUnauthorized: true,
    nextPath: 'index.html',
  });

  if (!access || !access.allowed) {
    return {
      allowed: false,
      identity: null,
    };
  }

  let identity = null;
  if (typeof auth.getAdminIdentity === 'function') {
    try {
      identity = await auth.getAdminIdentity();
    } catch (_error) {
      identity = null;
    }
  }

  if (!identity) {
    const email = String(access.session?.user?.email || 'admin@vehicle-rental.local');
    identity = {
      displayName: 'Admin',
      role: access.admin?.role === 'super_admin' ? 'Super Admin' : 'Admin',
      initials: 'AD',
      email,
    };
  }

  return {
    allowed: true,
    identity,
  };
}

async function handleAdminLogout() {
  const auth = window.AdminAuthService;
  const loginUrl = auth && typeof auth.buildLoginUrl === 'function' ? auth.buildLoginUrl('index.html') : 'login.html';

  try {
    if (auth && typeof auth.signOut === 'function') {
      await auth.signOut();
    } else if (window.VehicleAuthService && typeof window.VehicleAuthService.signOut === 'function') {
      await window.VehicleAuthService.signOut();
    }
  } catch (error) {
    pushToast(error?.message || 'Unable to sign out cleanly. Redirecting to login.', 'warn');
  } finally {
    window.location.href = loginUrl;
  }
}

function renderActiveModule() {
  const moduleHost = document.getElementById('moduleContent');
  if (!moduleHost) return;

  const renderer = modules[appState.activeModule] || modules.overview;
  try {
    moduleHost.innerHTML = '';
    const section = renderer({
      data: appState.data,
      query: appState.globalSearch,
      notify: pushToast,
      requestRender: renderActiveModule,
    });

    if (typeof section === 'string') {
      moduleHost.innerHTML = section;
    } else if (section instanceof HTMLElement) {
      moduleHost.appendChild(section);
    }
  } catch (error) {
    moduleHost.innerHTML = `<section class="rounded-2xl border border-rose-300 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300">Unable to render module: ${error.message}</section>`;
  }
}

function handleNavigate(id) {
  const normalized = id === 'operations' || id === 'finance' || id === 'quality' ? 'overview' : id;
  appState.activeModule = modules[normalized] ? normalized : 'overview';
  renderActiveModule();
}

function handleQuickAction(id) {
  const actionToModule = {
    newBooking: 'bookings',
    addVehicle: 'vehicles',
    markMaintenance: 'maintenance',
  };

  const target = actionToModule[id] || 'overview';
  appState.activeModule = target;
  setActiveNav(target);
  renderActiveModule();
  pushToast(`${id.replace(/([A-Z])/g, ' $1')} ready`, 'success');
}

function handleGlobalSearch(query) {
  appState.globalSearch = query;
  renderActiveModule();
}

function initTheme() {
  const saved = window.localStorage.getItem(appConfig.storageKeys.theme) || 'light';
  applyTheme(saved);

  const toggle = document.getElementById('themeToggle');
  toggle?.addEventListener('click', () => {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    window.localStorage.setItem(appConfig.storageKeys.theme, next);
    renderActiveModule();
  });
}

function applyTheme(mode) {
  document.body.setAttribute('data-theme', mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
}
