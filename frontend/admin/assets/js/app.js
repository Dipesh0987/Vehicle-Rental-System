import { appConfig } from './config.js';
import { dashboardData } from './data.js';
import { bindShellInteractions, pushToast, renderShell, setActiveNav } from './shell.js';
import { renderOverviewModule } from './modules/overview.js';
import { renderVehiclesModule } from './modules/vehicles.js';
import { renderBookingsModule } from './modules/bookings.js';
import { renderCustomersModule } from './modules/customers.js';
import { renderFleetModule } from './modules/fleet.js';
import { renderDriversModule } from './modules/drivers.js';
import { renderPaymentsModule } from './modules/payments.js';
import { renderPricingModule } from './modules/pricing.js';
import { renderMaintenanceModule } from './modules/maintenance.js';
import { renderReviewsModule } from './modules/reviews.js';
import { renderAdminsModule } from './modules/admins.js';
import { renderNotificationsModule } from './modules/notifications.js';
import { renderReportsModule } from './modules/reports.js';
import { createCatalogService } from './services/catalog-service.js';
import { createCustomerVerificationService } from './services/customer-verification.service.js';
import { createPaymentsService } from './services/payments.service.js';

const modules = {
  overview: renderOverviewModule,
  vehicles: renderVehiclesModule,
  bookings: renderBookingsModule,
  fleet: renderFleetModule,
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
  canWriteCatalog: true,
  data: structuredClone(dashboardData),
  baseNotifications: [],
  knownVerificationSubmissionKeys: [],
  catalogService: null,
  bookingService: null,
  customerVerificationService: null,
  paymentsService: null,
  paymentStats: null,
};

const catalogService = createCatalogService({ data: appState.data });
const paymentsService = createPaymentsService();
let catalogUnsubscribe = null;
let bookingUnsubscribe = null;
const globalSearchState = {
  items: [],
  activeIndex: -1,
  query: '',
  activeType: '',
};

const searchTypeToNavId = {
  vehicles: 'vehicles',
  bookings: 'bookings',
  customers: 'customers',
  admins: 'admins',
};

const searchTypeLabels = {
  vehicles: 'Vehicles module',
  bookings: 'Bookings module',
  customers: 'Customers module',
  admins: 'Admin roles module',
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

bootstrap();

async function bootstrap() {
  const root = document.getElementById('adminApp');
  if (!root) return;

  root.innerHTML = renderShell();
  appState.catalogService = window.VehicleCatalogService || null;
  appState.bookingService = window.VehicleBookingService || null;
  appState.customerVerificationService = createCustomerVerificationService();
  appState.paymentsService = paymentsService;
  appState.data.bookings = [];
  appState.data.payments = [];
  appState.baseNotifications = Array.isArray(appState.data.notifications)
    ? appState.data.notifications.slice()
    : [];

  updateVerificationNotificationBadge(0);
  initTheme();
  bindShellInteractions(handleNavigate, handleQuickAction, handleGlobalSearch, handleGlobalSearchKeydown);
  document.addEventListener('pointerdown', handleGlobalSearchOutsideClick);
  renderActiveModule();
  setActiveNav(appState.activeModule);

  await hydrateVehiclesFromCatalog({ silent: true });
  await hydrateBookingsFromDatabase({ silent: true });
  await hydrateCustomersFromDatabase({ silent: true });
  await hydratePaymentsFromDatabase({ silent: true });
  renderActiveModule();

  setupCatalogSync();
  setupBookingSync();

  try {
    const vehicles = await catalogService.loadVehicles();
    if (Array.isArray(vehicles) && vehicles.length) {
      appState.data.vehicles = vehicles;
      renderActiveModule();
    }
  } catch (error) {
    pushToast(`Vehicle DB sync failed: ${error.message}`, 'error');
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
      catalogService,
      bookingService: appState.bookingService,
      customerVerificationService: appState.customerVerificationService,
      paymentsService: appState.paymentsService,
      paymentStats: appState.paymentStats,
      canWriteCatalog: appState.canWriteCatalog,
      reloadBookingsData: () => hydrateBookingsFromDatabase({ silent: true }),
      reloadCustomersData: () => hydrateCustomersFromDatabase({ silent: true }),
      reloadPaymentsData: () => hydratePaymentsFromDatabase({ silent: true }),
      rerender: renderActiveModule,
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

async function hydrateBookingsFromDatabase({ silent = false } = {}) {
  if (!appState.bookingService || typeof appState.bookingService.listBookings !== 'function') {
    appState.data.bookings = [];
    updateBookingDrivenMetrics([]);
    return;
  }

  try {
    const rows = await appState.bookingService.listBookings();
    const normalizedRows = Array.isArray(rows)
      ? rows.map(mapBookingToAdminRow)
      : [];

    appState.data.bookings = normalizedRows;
    updateBookingDrivenMetrics(normalizedRows);
    syncCustomerTripCounts();

    if (!silent) {
      pushToast('Bookings synced from database', 'success');
    }
  } catch (error) {
    console.warn('Failed to sync bookings from database:', error);
    appState.data.bookings = [];
    updateBookingDrivenMetrics([]);
    syncCustomerTripCounts();

    if (!silent) {
      pushToast('Unable to sync bookings from database', 'warn');
    }
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
  // also render the floating dropdown for immediate results
  try {
    renderGlobalSearchResults(query);
  } catch (e) {
    // non-blocking
  }
}

function closeGlobalSearchResults() {
  document.getElementById('globalSearchResults')?.remove();
  globalSearchState.items = [];
  globalSearchState.activeIndex = -1;
  globalSearchState.query = '';
  globalSearchState.activeType = '';
}

function syncSidebarToSearchType(type) {
  const navId = searchTypeToNavId[type] || '';
  if (!navId) return;
  setActiveNav(navId);
}

function handleGlobalSearchOutsideClick(event) {
  const searchInput = document.getElementById('globalSearch');
  const resultsPanel = document.getElementById('globalSearchResults');

  if (!searchInput || !resultsPanel) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (searchInput.contains(target) || resultsPanel.contains(target)) {
    return;
  }

  closeGlobalSearchResults();
}

// Render dropdown results for global admin search and handle selections
function renderGlobalSearchResults(query) {
  const hostInput = document.getElementById('globalSearch');
  if (!hostInput) return;

  // Remove existing dropdown if empty query or short
  const existing = document.getElementById('globalSearchResults');
  if (!query || String(query).trim().length < 2) {
    closeGlobalSearchResults();
    return;
  }

  const q = String(query || '').toLowerCase().trim();
  globalSearchState.query = q;
  const results = {
    vehicles: [],
    bookings: [],
    customers: [],
    admins: [],
  };

  // Search vehicles
  if (Array.isArray(appState.data.vehicles)) {
    for (const v of appState.data.vehicles) {
      const hay = `${v.id} ${v.name || ''} ${v.brand || ''} ${v.vehicleNumber || ''}`.toLowerCase();
      if (hay.indexOf(q) >= 0) results.vehicles.push({ id: v.id, label: v.name || v.id, meta: v.brand || v.category || '' });
      if (results.vehicles.length >= 6) break;
    }
  }

  // Search bookings
  if (Array.isArray(appState.data.bookings)) {
    for (const b of appState.data.bookings) {
      const hay = `${b.id} ${b.bookingId || ''} ${b.customer || ''} ${b.vehicle || ''}`.toLowerCase();
      if (hay.indexOf(q) >= 0) results.bookings.push({ id: b.bookingId || b.id, label: b.id || b.bookingId, meta: b.customer || '' });
      if (results.bookings.length >= 6) break;
    }
  }

  // Search customers
  if (Array.isArray(appState.data.customers)) {
    for (const c of appState.data.customers) {
      const hay = `${c.id} ${c.name || ''} ${c.email || ''} ${c.phoneNumber || ''}`.toLowerCase();
      if (hay.indexOf(q) >= 0) results.customers.push({ id: c.id, label: c.name || c.id, meta: c.email || c.city || '' });
      if (results.customers.length >= 6) break;
    }
  }

  // Search admins
  if (Array.isArray(appState.data.adminUsers)) {
    for (const a of appState.data.adminUsers) {
      const hay = `${a.id} ${a.name || ''} ${a.role || ''}`.toLowerCase();
      if (hay.indexOf(q) >= 0) results.admins.push({ id: a.id, label: a.name || a.id, meta: a.role || '' });
      if (results.admins.length >= 6) break;
    }
  }

  // Build HTML
  const groups = [];
  if (results.vehicles.length) groups.push({ title: 'Vehicles', key: 'vehicles', items: results.vehicles });
  if (results.bookings.length) groups.push({ title: 'Bookings', key: 'bookings', items: results.bookings });
  if (results.customers.length) groups.push({ title: 'Customers', key: 'customers', items: results.customers });
  if (results.admins.length) groups.push({ title: 'Admins', key: 'admins', items: results.admins });

  globalSearchState.items = groups.flatMap((group) =>
    group.items.map((item) => ({
      type: group.key,
      ...item,
    }))
  );
  globalSearchState.activeIndex = globalSearchState.items.length ? 0 : -1;
  globalSearchState.activeType = groups[0]?.key || '';
  syncSidebarToSearchType(globalSearchState.activeType);

  if (!groups.length) {
    closeGlobalSearchResults();
    const parent = hostInput.closest('label') || hostInput.parentElement;
    if (!parent) return;
    const emptyState = document.createElement('div');
    emptyState.id = 'globalSearchResults';
    emptyState.className = 'absolute left-0 top-full z-40 mt-2 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel dark:border-white/10 dark:bg-black/20';
    emptyState.innerHTML = `
      <div class="p-4 text-sm text-slate-600 dark:text-slate-300">
        <p class="font-semibold text-slate-900 dark:text-white">No matches found</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Try a different keyword or search another record type.</p>
      </div>
    `;
    parent.appendChild(emptyState);
    return;
  }

  const html = [`<div id="globalSearchResults" class="absolute left-0 top-full z-40 mt-2 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel dark:border-white/10 dark:bg-black/20">`];
  for (const g of groups) {
    html.push(`<div class="border-b border-slate-200 p-3 last:border-b-0 dark:border-white/10">`);
    html.push(`<div class="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">${escapeHtml(g.title)}</div>`);
    for (const item of g.items) {
      const flatIndex = globalSearchState.items.findIndex((entry) => entry.type === g.key && entry.id === item.id);
      const isActive = flatIndex === globalSearchState.activeIndex;
      html.push(`<button data-search-type="${g.key}" data-search-id="${escapeHtml(item.id)}" data-search-index="${flatIndex}" aria-label="Open ${escapeHtml(item.label)} in ${escapeHtml(searchTypeLabels[g.key] || g.title)}" class="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition ${isActive ? 'bg-brand-500/10 ring-1 ring-inset ring-brand-500/20 dark:bg-brand-500/20' : 'hover:bg-slate-100 dark:hover:bg-white/5'}">`);
      html.push(`<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? 'bg-brand-600 shadow-[0_0_0_4px_rgba(31,118,104,0.12)]' : 'bg-slate-300 group-hover:bg-brand-400'}"></span>`);
      html.push(`<span class="min-w-0 flex-1">`);
      html.push(`<div class="text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(item.label)}</div>`);
      html.push(`<div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><span>${escapeHtml(item.meta)}</span><span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">${escapeHtml(searchTypeLabels[g.key] || g.title)}</span></div>`);
      html.push(`</span>`);
      html.push(`</button>`);
    }
    html.push(`</div>`);
  }
  html.push(`</div>`);

  // Insert dropdown after input label
  existing?.remove();
  // place next to the input's parent label
  const parent = hostInput.closest('label') || hostInput.parentElement;
  if (!parent) return;
  const container = document.createElement('div');
  container.className = 'relative';
  container.innerHTML = html.join('');
  parent.appendChild(container.firstChild);

  // Attach click handlers
  document.querySelectorAll('#globalSearchResults [data-search-type]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const t = btn.getAttribute('data-search-type');
      const id = btn.getAttribute('data-search-id');
      handleGlobalSearchSelect(t, id);
    });

    btn.addEventListener('mouseenter', () => {
      const nextIndex = Number(btn.getAttribute('data-search-index'));
      const nextType = btn.getAttribute('data-search-type') || '';
      if (!Number.isNaN(nextIndex) && nextIndex !== globalSearchState.activeIndex) {
        globalSearchState.activeIndex = nextIndex;
      }
      if (nextType && nextType !== globalSearchState.activeType) {
        globalSearchState.activeType = nextType;
        syncSidebarToSearchType(nextType);
      }
      renderGlobalSearchResults(globalSearchState.query);
    });
  });
}

function handleGlobalSearchKeydown(event) {
  const key = String(event.key || '');
  const hasResults = Array.isArray(globalSearchState.items) && globalSearchState.items.length > 0;

  if (key === 'Escape') {
    document.getElementById('globalSearchResults')?.remove();
    globalSearchState.items = [];
    globalSearchState.activeIndex = -1;
    return;
  }

  if (!hasResults) {
    return;
  }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    const direction = key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (globalSearchState.activeIndex + direction + globalSearchState.items.length) % globalSearchState.items.length;
    globalSearchState.activeIndex = nextIndex;
    const activeItem = globalSearchState.items[nextIndex];
    if (activeItem?.type && activeItem.type !== globalSearchState.activeType) {
      globalSearchState.activeType = activeItem.type;
      syncSidebarToSearchType(activeItem.type);
    }
    renderGlobalSearchResults(appState.globalSearch);
    const nextButton = document.querySelector(`#globalSearchResults [data-search-index="${nextIndex}"]`);
    nextButton?.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (key === 'Enter') {
    event.preventDefault();
    const active = globalSearchState.items[globalSearchState.activeIndex] || globalSearchState.items[0];
    if (active) {
      syncSidebarToSearchType(active.type);
      handleGlobalSearchSelect(active.type, active.id);
    }
  }
}

function handleGlobalSearchSelect(type, id) {
  if (!type || !id) return;
  const moduleMap = {
    vehicles: 'vehicles',
    bookings: 'bookings',
    customers: 'customers',
    admins: 'admins',
  };

  const targetModule = moduleMap[type] || 'overview';
  appState.activeModule = targetModule;
  setActiveNav(targetModule);
  syncSidebarToSearchType(type);
  if (type === 'customers') {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#customer:${encodeURIComponent(id)}`);
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  appState.globalSearch = '';
  renderActiveModule();

  // Try to open detail in the rendered module by triggering the appropriate control
  window.setTimeout(() => {
    let selectorMap = {
      vehicles: `[data-edit-id="${id}"]`,
      bookings: `[data-edit-booking-id="${id}"]`,
      customers: `[data-open-customer-id="${id}"]`,
      admins: `[data-permission="${id}"]`,
    };

    const sel = selectorMap[type];
    const el = document.querySelector(sel);
    if (el) {
      el.click();
    }
  }, 120);

  // Clear dropdown and input
  closeGlobalSearchResults();
  const input = document.getElementById('globalSearch');
  if (input) {
    input.value = '';
    input.focus();
  }
  globalSearchState.items = [];
  globalSearchState.activeIndex = -1;
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

function setupBookingSync() {
  if (!appState.bookingService || typeof appState.bookingService.subscribeToBookingChanges !== 'function') {
    return;
  }

  if (bookingUnsubscribe) {
    bookingUnsubscribe();
  }

  bookingUnsubscribe = appState.bookingService.subscribeToBookingChanges(async () => {
    await hydrateBookingsFromDatabase({ silent: true });
    await hydratePaymentsFromDatabase({ silent: true });
    if (appState.activeModule === 'bookings' || appState.activeModule === 'customers' || appState.activeModule === 'overview' || appState.activeModule === 'payments') {
      renderActiveModule();
    }
  });
}

async function hydrateCustomersFromDatabase({ silent = false } = {}) {
  if (!appState.customerVerificationService || typeof appState.customerVerificationService.listCustomers !== 'function') {
    syncCustomerTripCounts();
    syncVerificationQueueSignals([], { silent: true });
    return;
  }

  try {
    const rows = await appState.customerVerificationService.listCustomers();
    const mappedRows = Array.isArray(rows) ? rows.map(mapCustomerProfileToAdminRow) : [];
    const orderedRows = sortCustomersForReviewQueue(mappedRows);

    appState.data.customers = orderedRows;
    syncCustomerTripCounts();
    syncVerificationQueueSignals(appState.data.customers, { silent });

    if (!silent) {
      pushToast('Customers synced from verification data', 'success');
    }
  } catch (error) {
    console.warn('Failed to sync customers from verification service:', error);
    syncCustomerTripCounts();

    if (!silent) {
      const message = appState.customerVerificationService && typeof appState.customerVerificationService.toPublicError === 'function'
        ? appState.customerVerificationService.toPublicError(error, 'Unable to sync customers from database')
        : 'Unable to sync customers from database';
      pushToast(message, 'warn');
    }
  }
}

function mapBookingToAdminRow(booking) {
  const paymentDone = Boolean(booking && (booking.paymentDone === true || booking.payment_done === true));
  const totalAmount = Number.isFinite(Number(booking && booking.quote && booking.quote.totalAmount))
    ? Number(booking.quote.totalAmount)
    : 0;
  const paidAmount = Number.isFinite(Number(booking && booking.paidAmount))
    ? Number(booking.paidAmount)
    : 0;
  const remainingAmount = booking && booking.remainingAmount != null && Number.isFinite(Number(booking.remainingAmount))
    ? Number(booking.remainingAmount)
    : Math.max(0, totalAmount - paidAmount);
  const paymentStatus = String(booking && booking.paymentStatus ? booking.paymentStatus : (paymentDone ? 'paid' : 'unpaid')).toLowerCase();

  return {
    id: String(booking && booking.bookingCode ? booking.bookingCode : booking && booking.id ? booking.id : ''),
    bookingId: String(booking && booking.id ? booking.id : ''),
    customer: formatLabel(booking && booking.customerName ? booking.customerName : 'Customer'),
    customerEmail: String(booking && booking.customerEmail ? booking.customerEmail : ''),
    customerUserId: String(booking && booking.customerUserId ? booking.customerUserId : ''),
    customerPhone: String(booking && booking.customerPhone ? booking.customerPhone : ''),
    vehicle: formatLabel(booking && booking.vehicleName ? booking.vehicleName : 'Vehicle'),
    vehicleId: String(booking && booking.vehicleId ? booking.vehicleId : ''),
    pickupLocation: String(booking && booking.pickupLocation ? booking.pickupLocation : ''),
    userMessage: String(booking && booking.userMessage ? booking.userMessage : ''),
    driverOption: String(booking && booking.driverOptionLabel ? booking.driverOptionLabel : booking && booking.driverOption ? booking.driverOption : 'Self Drive'),
    start: String(booking && booking.startDate ? booking.startDate : ''),
    end: String(booking && booking.endDate ? booking.endDate : ''),
    pickupTime: String(booking && booking.pickupTime ? booking.pickupTime : ''),
    type: formatLabel(booking && booking.type ? booking.type : 'Vehicle'),
    status: formatLabel(booking && booking.statusLabel ? booking.statusLabel : booking && booking.status ? booking.status : 'Confirmed'),
    paymentDone,
    paymentLabel: paymentDone ? 'Yes' : 'No',
    paymentStatus,
    paymentStatusLabel: prettyPaymentStatusLabel(paymentStatus),
    paidAmount,
    remainingAmount,
    total: totalAmount,
    createdAt: String(booking && booking.createdAt ? booking.createdAt : ''),
  };
}

function prettyPaymentStatusLabel(statusKey) {
  const key = String(statusKey || '').toLowerCase();
  if (!key) return 'Unpaid';
  if (key === 'partial') return 'Partially Paid';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

async function hydratePaymentsFromDatabase({ silent = false } = {}) {
  if (!appState.paymentsService) return;

  try {
    const result = await appState.paymentsService.loadAdminPayments();
    appState.data.payments = Array.isArray(result && result.rows) ? result.rows : [];
    appState.paymentStats = (result && result.stats) || null;

    if (!silent) {
      pushToast('Payments synced from database', 'success');
    }
  } catch (error) {
    appState.data.payments = [];
    appState.paymentStats = null;
    console.warn('Failed to sync payments from database:', error);
    if (!silent) {
      pushToast(`Payments sync failed: ${error.message}`, 'error');
    }
  }
}

function mapCustomerProfileToAdminRow(profile) {
  const status = String(profile && profile.verificationStatus ? profile.verificationStatus : 'not_submitted').toLowerCase();
  const documentLabel = String(profile && profile.documentTypeLabel ? profile.documentTypeLabel : '').trim();
  const verificationSubmittedAt = String(profile && profile.verificationSubmittedAt ? profile.verificationSubmittedAt : '');
  const hasVerificationSubmission = Boolean(verificationSubmittedAt);
  const isPendingReview = status === 'pending' && hasVerificationSubmission;

  return {
    id: String(profile && profile.userId ? profile.userId : ''),
    name: formatLabel(profile && profile.fullName ? profile.fullName : 'Customer'),
    email: String(profile && profile.email ? profile.email : ''),
    phoneNumber: String(profile && profile.phoneNumber ? profile.phoneNumber : ''),
    trips: 0,
    verified: status === 'approved',
    verificationStatus: status,
    status: String(profile && profile.verificationStatusLabel ? profile.verificationStatusLabel : 'Pending'),
    documents: documentLabel ? [documentLabel] : [],
    gender: formatLabel(profile && profile.gender ? profile.gender : ''),
    city: String(profile && profile.city ? profile.city : ''),
    country: String(profile && profile.country ? profile.country : ''),
    documentNumber: String(profile && profile.documentNumber ? profile.documentNumber : ''),
    documentImageUrl: String(profile && profile.documentImageUrl ? profile.documentImageUrl : ''),
    verificationSubmittedAt,
    verificationReviewedAt: String(profile && profile.verificationReviewedAt ? profile.verificationReviewedAt : ''),
    verificationNote: String(profile && profile.verificationNote ? profile.verificationNote : ''),
    hasVerificationSubmission,
    isPendingReview,
  };
}

function toTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }

  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function customerReviewPriority(customer) {
  const status = String(customer && customer.verificationStatus ? customer.verificationStatus : 'not_submitted').trim().toLowerCase();
  const submittedAt = toTimestamp(customer && customer.verificationSubmittedAt ? customer.verificationSubmittedAt : '');
  const hasSubmission = submittedAt > 0;

  if (status === 'pending' && hasSubmission) return 0;
  if (status === 'rejected' && hasSubmission) return 1;
  if (status === 'not_submitted') return 2;
  if (status === 'approved') return 3;
  return 4;
}

function sortCustomersForReviewQueue(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];

  list.sort((left, right) => {
    const leftPriority = customerReviewPriority(left);
    const rightPriority = customerReviewPriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftSubmitted = toTimestamp(left && left.verificationSubmittedAt ? left.verificationSubmittedAt : '');
    const rightSubmitted = toTimestamp(right && right.verificationSubmittedAt ? right.verificationSubmittedAt : '');
    if (leftSubmitted !== rightSubmitted) {
      return rightSubmitted - leftSubmitted;
    }

    const leftName = String(left && left.name ? left.name : '').toLowerCase();
    const rightName = String(right && right.name ? right.name : '').toLowerCase();
    if (leftName > rightName) return 1;
    if (leftName < rightName) return -1;
    return 0;
  });

  return list;
}

function isPendingReviewCustomer(customer) {
  return Boolean(customer && customer.isPendingReview);
}

function formatRelativeTime(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return 'Awaiting date';
  }

  const diffMs = Date.now() - timestamp;
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function buildVerificationNotifications(customers) {
  const queue = sortCustomersForReviewQueue((Array.isArray(customers) ? customers : []).filter(isPendingReviewCustomer));
  const queueCount = queue.length;

  if (!queueCount) {
    return [];
  }

  const summary = {
    id: `KYC-QUEUE-${queueCount}`,
    title: `${queueCount} profile verification submission${queueCount > 1 ? 's' : ''} awaiting review`,
    channel: 'KYC Queue',
    priority: queueCount > 3 ? 'Critical' : 'High',
    time: 'Live',
    type: 'verification_queue',
  };

  const detailRows = queue.slice(0, 5).map((customer) => ({
    id: `KYC-${String(customer && customer.id ? customer.id : '')}-${String(customer && customer.verificationSubmittedAt ? customer.verificationSubmittedAt : 'pending')}`,
    title: `Verification submitted: ${String(customer && customer.name ? customer.name : 'Customer')}`,
    channel: 'Customer KYC',
    priority: 'High',
    time: formatRelativeTime(customer && customer.verificationSubmittedAt ? customer.verificationSubmittedAt : ''),
    type: 'verification_submission',
    customerId: String(customer && customer.id ? customer.id : ''),
  }));

  return [summary, ...detailRows];
}

function mergeNotifications(baseRows, verificationRows) {
  const base = Array.isArray(baseRows) ? baseRows : [];
  const generated = Array.isArray(verificationRows) ? verificationRows : [];

  const filteredBase = base.filter((row) => {
    const type = String(row && row.type ? row.type : '').trim().toLowerCase();
    return type !== 'verification_queue' && type !== 'verification_submission';
  });

  return [...generated, ...filteredBase];
}

function updateVerificationNotificationBadge(pendingCount) {
  const badge = document.getElementById('notificationBadgeCount');
  if (!badge) {
    return;
  }

  const count = Number.isFinite(Number(pendingCount)) ? Math.max(0, Number(pendingCount)) : 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.classList.toggle('hidden', count <= 0);
  badge.classList.toggle('inline-flex', count > 0);

  const notificationButton = document.getElementById('notificationBtn');
  if (notificationButton) {
    const label = count > 0
      ? `${count} pending profile verification submission${count > 1 ? 's' : ''}`
      : 'No pending profile verification submissions';
    notificationButton.setAttribute('aria-label', label);
  }
}

function syncVerificationQueueSignals(customers, { silent = false } = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const pendingQueue = list.filter(isPendingReviewCustomer);
  const pendingCount = pendingQueue.length;
  const queueKeys = pendingQueue
    .map((customer) => `${String(customer && customer.id ? customer.id : '')}:${String(customer && customer.verificationSubmittedAt ? customer.verificationSubmittedAt : '')}`)
    .filter(Boolean);

  if (!silent) {
    const known = new Set(appState.knownVerificationSubmissionKeys);
    const freshSubmissions = queueKeys.filter((key) => !known.has(key));
    if (freshSubmissions.length) {
      pushToast(
        `${freshSubmissions.length} new profile verification submission${freshSubmissions.length > 1 ? 's' : ''} needs review`,
        'warn'
      );
    }
  }

  appState.knownVerificationSubmissionKeys = queueKeys;

  const generatedNotifications = buildVerificationNotifications(pendingQueue);
  appState.data.notifications = mergeNotifications(appState.baseNotifications, generatedNotifications);
  updateVerificationNotificationBadge(pendingCount);
}

function syncCustomerTripCounts() {
  const bookings = Array.isArray(appState.data.bookings) ? appState.data.bookings : [];
  const customers = Array.isArray(appState.data.customers) ? appState.data.customers : [];

  if (!customers.length) {
    return;
  }

  const lookupByUserId = new Map();
  const lookupByEmail = new Map();
  const tripStatuses = new Set(['pending', 'confirmed', 'completed']);

  bookings.forEach((booking) => {
    const status = String(booking && booking.status ? booking.status : '').trim().toLowerCase();
    if (!tripStatuses.has(status)) {
      return;
    }

    const userId = String(booking && booking.customerUserId ? booking.customerUserId : '').trim();
    const email = String(booking && booking.customerEmail ? booking.customerEmail : '').trim().toLowerCase();

    if (userId) {
      lookupByUserId.set(userId, Number(lookupByUserId.get(userId) || 0) + 1);
    }

    if (email) {
      lookupByEmail.set(email, Number(lookupByEmail.get(email) || 0) + 1);
    }
  });

  appState.data.customers = customers.map((customer) => {
    const userId = String(customer && customer.id ? customer.id : '').trim();
    const email = String(customer && customer.email ? customer.email : '').trim().toLowerCase();

    let trips = 0;
    if (userId && lookupByUserId.has(userId)) {
      trips = Number(lookupByUserId.get(userId) || 0);
    } else if (email && lookupByEmail.has(email)) {
      trips = Number(lookupByEmail.get(email) || 0);
    }

    return {
      ...customer,
      trips,
    };
  });
}

function updateBookingDrivenMetrics(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const activeStatuses = new Set(['confirmed']);
  let activeRentals = 0;
  let dailyBookings = 0;
  let cancellations = 0;

  list.forEach((row) => {
    const status = String(row && row.status ? row.status : '').trim().toLowerCase();
    const start = String(row && row.start ? row.start : '').trim();
    const end = String(row && row.end ? row.end : '').trim();

    if (start === todayIso) {
      dailyBookings += 1;
    }

    if (status === 'cancelled') {
      cancellations += 1;
    }

    if (activeStatuses.has(status) && start && end && start <= todayIso && end >= todayIso) {
      activeRentals += 1;
    }
  });

  appState.data.metrics.dailyBookings = dailyBookings;
  appState.data.metrics.activeRentals = activeRentals;
  appState.data.metrics.cancellations = cancellations;
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
    vehicleNumber: String(vehicle && vehicle.vehicleNumber ? vehicle.vehicleNumber : '').trim().toUpperCase(),
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
