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
  catalogService: null,
};

let catalogUnsubscribe = null;

bootstrap();

async function bootstrap() {
  const root = document.getElementById('adminApp');
  if (!root) return;

  root.innerHTML = renderShell();
  appState.catalogService = window.VehicleCatalogService || null;

  await hydrateVehiclesFromCatalog({ silent: true });

  initTheme();
  bindShellInteractions(handleNavigate, handleQuickAction, handleGlobalSearch);
  renderActiveModule();
  setActiveNav(appState.activeModule);
  setupCatalogSync();
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
      catalogService: appState.catalogService,
      reloadVehiclesData: async () => {
        await hydrateVehiclesFromCatalog({ silent: true });
        if (appState.activeModule === 'vehicles' || appState.activeModule === 'overview') {
          renderActiveModule();
        }
      },
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

async function hydrateVehiclesFromCatalog({ silent = false } = {}) {
  if (!appState.catalogService || typeof appState.catalogService.listVehicles !== 'function') {
    return;
  }

  try {
    const catalogRows = await appState.catalogService.listVehicles({ includeInactive: true });
    const normalizedRows = Array.isArray(catalogRows)
      ? catalogRows.map(mapCatalogVehicleToAdminRow)
      : [];

    appState.data.vehicles = normalizedRows;
    appState.data.metrics.totalVehicles = normalizedRows.length;

    if (!silent) {
      pushToast('Vehicle catalog synced from database', 'success');
    }
  } catch (error) {
    console.warn('Failed to sync vehicles from catalog service:', error);
    if (!silent) {
      pushToast('Unable to sync vehicle catalog from database', 'warn');
    }
  }
}

function setupCatalogSync() {
  if (!appState.catalogService || typeof appState.catalogService.subscribeToVehicleCatalogChanges !== 'function') {
    return;
  }

  if (catalogUnsubscribe) {
    catalogUnsubscribe();
  }

  catalogUnsubscribe = appState.catalogService.subscribeToVehicleCatalogChanges(async () => {
    await hydrateVehiclesFromCatalog({ silent: true });
    if (appState.activeModule === 'vehicles' || appState.activeModule === 'overview') {
      renderActiveModule();
    }
  });
}

function mapCatalogVehicleToAdminRow(vehicle) {
  const dailyRate = extractDailyRate(vehicle);
  const imageUrls = Array.isArray(vehicle && vehicle.imageUrls) ? vehicle.imageUrls : [];
  const fallbackImage =
    'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=640&q=80';

  return {
    id: String(vehicle && vehicle.id ? vehicle.id : ''),
    addedAt: String(vehicle && vehicle.addedDate ? vehicle.addedDate : ''),
    name: formatLabel(vehicle && vehicle.name ? vehicle.name : 'Vehicle'),
    brand: formatLabel(vehicle && vehicle.brand ? vehicle.brand : ''),
    category: formatLabel(vehicle && (vehicle.category || vehicle.type) ? (vehicle.category || vehicle.type) : 'Vehicle'),
    status: normalizeStatus(vehicle),
    daily: dailyRate,
    weekly: Math.max(0, Math.round(dailyRate * 6.2)),
    seasonal: Math.max(0, Math.round(dailyRate * 24)),
    image:
      (vehicle && vehicle.primaryImageUrl) ||
      (imageUrls.length ? imageUrls[0] : '') ||
      fallbackImage,
    transmission: formatLabel(vehicle && vehicle.transmission ? vehicle.transmission : 'Automatic'),
    fuelType: formatLabel(vehicle && vehicle.fuelType ? vehicle.fuelType : 'Petrol'),
    seats: Number.isFinite(Number(vehicle && vehicle.seats)) ? Number(vehicle.seats) : 5,
    features: Array.isArray(vehicle && vehicle.features) ? vehicle.features.slice() : [],
    location: formatLabel(vehicle && vehicle.location ? vehicle.location : ''),
    rating: Number.isFinite(Number(vehicle && vehicle.rating)) ? Number(vehicle.rating) : 4.6,
  };
}

function extractDailyRate(vehicle) {
  if (Number.isFinite(Number(vehicle && vehicle.pricePerDay))) {
    return Math.max(0, Math.round(Number(vehicle.pricePerDay)));
  }

  const dailyRateText = String(
    vehicle && vehicle.pricing && vehicle.pricing.dailyRate
      ? vehicle.pricing.dailyRate
      : vehicle && vehicle.daily
      ? vehicle.daily
      : '0'
  );

  const parsed = Number(dailyRateText.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function normalizeStatus(vehicle) {
  const explicit = String(vehicle && vehicle.status ? vehicle.status : '').trim();
  if (explicit) {
    return formatLabel(explicit);
  }

  if (vehicle && vehicle.available === false) {
    return 'Unavailable';
  }

  return 'Available';
}

function formatLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
