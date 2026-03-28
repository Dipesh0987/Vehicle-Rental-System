import { appConfig } from './config.js';
import { dashboardData } from './data.js';
import { bindShellInteractions, pushToast, renderShell, setActiveNav } from './shell.js';
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
import { openDrawer } from './ui.js';

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
};

bootstrap();

function bootstrap() {
  const root = document.getElementById('adminApp');
  if (!root) return;

  root.innerHTML = renderShell();
  initTheme();
  bindShellInteractions(handleNavigate, handleQuickAction, handleGlobalSearch);
  renderActiveModule();
  setActiveNav(appState.activeModule);
}

function renderActiveModule() {
  const moduleHost = document.getElementById('moduleContent');
  if (!moduleHost) return;

  const renderer = modules[appState.activeModule] || modules.overview;
  moduleHost.innerHTML = `<section class="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">Loading ${appState.activeModule} module...</section>`;

  window.setTimeout(() => {
    try {
      moduleHost.innerHTML = '';
      const section = renderer({
        data: appState.data,
        query: appState.globalSearch,
        notify: pushToast,
      });

      if (typeof section === 'string') {
        moduleHost.innerHTML = section;
      } else if (section instanceof HTMLElement) {
        moduleHost.appendChild(section);
      }
    } catch (error) {
      moduleHost.innerHTML = `<section class="rounded-2xl border border-rose-300 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300">Unable to render module: ${error.message}</section>`;
    }
  }, 80);
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
  openDrawer({
    title: 'Quick Action',
    content: `<p class="font-semibold">${id.replace(/([A-Z])/g, ' $1').trim()} is prefilled and ready.</p><p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Use this drawer pattern for creating records without leaving context.</p>`,
  });
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
  });
}

function applyTheme(mode) {
  document.body.setAttribute('data-theme', mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
}
