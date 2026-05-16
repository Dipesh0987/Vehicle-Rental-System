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
import { renderPricingModule, initializePricingModule } from './modules/pricing.js';
import { renderMaintenanceModule } from './modules/maintenance.js';
import { renderReviewsModule } from './modules/reviews.js';
import { renderAdminsModule } from './modules/admins.js';
import { renderNotificationsModule } from './modules/notifications.js';
import { renderReportsModule } from './modules/reports.js';
import { createCatalogService } from './services/catalog-service.js';
import { createCustomerVerificationService } from './services/customer-verification.service.js';
import { createPaymentsService } from './services/payments.service.js';
import { createDriverService } from './services/driver.service.js';
import { subscribeToChanges as subscribeMaintenanceChanges, mapDbRow as mapMaintenanceDbRow } from './services/maintenance.service.js';

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
  driverService: null,
};

const catalogService = createCatalogService({ data: appState.data });
const paymentsService = createPaymentsService();
const driverService = createDriverService();
let catalogUnsubscribe = null;
let bookingUnsubscribe = null;
let maintenanceUnsubscribe = null;
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
  drivers: 'drivers',
  admins: 'admins',
};

const searchTypeLabels = {
  vehicles: 'Vehicles module',
  bookings: 'Bookings module',
  customers: 'Customers module',
  drivers: 'Drivers module',
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
  appState.driverService = driverService;
  appState.data.bookings = [];
  appState.data.payments = [];
  appState.baseNotifications = Array.isArray(appState.data.notifications)
    ? appState.data.notifications.slice()
    : [];

  updateVerificationNotificationBadge(0);
  initTheme();
  bindShellInteractions(handleNavigate, handleQuickAction, handleGlobalSearch, handleGlobalSearchKeydown);
  document.getElementById('notificationBtn')?.addEventListener('click', openNotificationPanel);
  document.addEventListener('pointerdown', handleGlobalSearchOutsideClick);
  renderActiveModule();
  setActiveNav(appState.activeModule);

  await hydrateVehiclesFromCatalog({ silent: true });
  await hydrateBookingsFromDatabase({ silent: true });
  await hydrateCustomersFromDatabase({ silent: true });
  await hydrateDriversFromDatabase({ silent: true });
  await initializePricingModule();
  renderActiveModule();

  setupCatalogSync();
  setupBookingSync();

  // Load vehicles through the local catalog service (shares same data array
  // and mapper shape as the vehicles module expects).
  try {
    const vehicles = await catalogService.loadVehicles();
    if (Array.isArray(vehicles) && vehicles.length) {
      appState.data.vehicles = vehicles;
    }
  } catch (error) {
    pushToast(`Vehicle DB sync failed: ${error.message}`, 'error');
  }

  renderActiveModule();
}

async function hydrateMainteinanceFromDatabase({ silent = false } = {}) {
  try {
    if (!window.SupabaseClient || !window.SupabaseClient.isConfigured()) return;
    const client = await window.SupabaseClient.init();
    const { data: rows, error } = await client
      .from('maintenance_records')
      .select('*')
      .order('schedule_date', { ascending: false })
      .limit(300);
    if (error) throw error;
    if (!rows || !rows.length) return;
    appState.data.maintenance = rows.map((r) => ({
      dbId:            r.id,
      id:              r.maintenance_id,
      vehicle:         r.vehicle_name,
      vehicleId:       r.vehicle_id || '',
      schedule:        r.schedule_date,
      serviceType:     r.service_type,
      damage:          r.description,
      status:          r.status,
      costEstimate:    r.cost_estimate ? Number(r.cost_estimate) : 0,
      technician:      r.technician || '',
      reportedBy:      r.reported_by || '',
      completedAt:     r.completed_at || '',
      notes:           r.notes || '',
      customerName:    r.customer_name || '',
      customerEmail:   r.customer_email || '',
      customerUserId:  r.customer_user_id || '',
      linkedBookingId: r.linked_booking_id || '',
      bookingRef:      r.booking_ref || '',
    }));
    if (!silent) pushToast('Maintenance records loaded', 'success');
    renderActiveModule();
  } catch (err) {
    if (!silent) pushToast(`Maintenance load failed: ${err.message}`, 'warn');
    console.warn('[maintenance] hydrate failed:', err.message);
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
      driverService: appState.driverService,
      reloadDriversData: () => hydrateDriversFromDatabase({ silent: true }),
      reloadBookingsData: () => hydrateBookingsFromDatabase({ silent: true }),
      reloadCustomersData: () => hydrateCustomersFromDatabase({ silent: true }),
      reloadPaymentsData: () => hydratePaymentsFromDatabase({ silent: true }),
      reloadVehiclesData: async () => {
        await hydrateVehiclesFromCatalog({ silent: true });
        try {
          const vehicles = await catalogService.loadVehicles();
          if (Array.isArray(vehicles) && vehicles.length) {
            appState.data.vehicles = vehicles;
          }
        } catch (_e) { /* fallback to catalog hydration above */ }
        renderActiveModule();
      },
      navigate: handleNavigate,
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
    addDriver: 'drivers',
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
    drivers: [],
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

  // Search drivers
  if (Array.isArray(appState.data.drivers)) {
    for (const d of appState.data.drivers) {
      const hay = `${d.id} ${d.name || ''} ${d.phone || ''} ${d.licenceNumber || ''} ${d.availability || ''}`.toLowerCase();
      if (hay.indexOf(q) >= 0) results.drivers.push({ id: d.id, label: d.name || d.id, meta: `${d.availability || ''} · ${d.licenceStatus || ''}` });
      if (results.drivers.length >= 6) break;
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
  if (results.drivers.length) groups.push({ title: 'Drivers', key: 'drivers', items: results.drivers });
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

  // Detect live dark mode — inline styles bypass pre-built Tailwind CSS limitations
  const isDark = document.documentElement.classList.contains('dark') || document.body.getAttribute('data-theme') === 'dark';
  const clr = {
    bg:          isDark ? '#0e1a25'                    : '#ffffff',
    border:      isDark ? 'rgba(255,255,255,0.10)'     : '#e2e8f0',
    divider:     isDark ? 'rgba(255,255,255,0.08)'     : '#e2e8f0',
    groupTitle:  isDark ? '#94a3b8'                    : '#64748b',
    label:       isDark ? '#f1f5f9'                    : '#0f172a',
    meta:        isDark ? '#94a3b8'                    : '#64748b',
    badgeBg:     isDark ? 'rgba(255,255,255,0.07)'     : '#f8fafc',
    badgeBorder: isDark ? 'rgba(255,255,255,0.12)'     : '#e2e8f0',
    activeBg:    isDark ? 'rgba(31,118,104,0.22)'      : 'rgba(31,118,104,0.08)',
    hoverBg:     isDark ? 'rgba(255,255,255,0.05)'     : '#f1f5f9',
    dotActive:   '#1f7668',
    dotDefault:  isDark ? '#475569'                    : '#cbd5e1',
  };

  const panelStyle = `position:absolute;left:0;top:100%;z-index:40;margin-top:0.5rem;width:min(760px,calc(100vw - 2rem));overflow:hidden;border-radius:0.75rem;border:1px solid ${clr.border};background:${clr.bg};box-shadow:0 4px 24px rgba(0,0,0,0.15);`;

  if (!groups.length) {
    closeGlobalSearchResults();
    const parent = hostInput.closest('label') || hostInput.parentElement;
    if (!parent) return;
    const emptyState = document.createElement('div');
    emptyState.id = 'globalSearchResults';
    emptyState.setAttribute('style', panelStyle);
    emptyState.innerHTML = `
      <div style="padding:1rem;">
        <p style="font-size:0.875rem;font-weight:700;color:${clr.label};">No matches found</p>
        <p style="margin-top:0.25rem;font-size:0.75rem;color:${clr.meta};">Try a different keyword or search another record type.</p>
      </div>
    `;
    parent.appendChild(emptyState);
    return;
  }

  const html = [`<div id="globalSearchResults" style="${panelStyle}">`];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const isLast = gi === groups.length - 1;
    html.push(`<div style="padding:0.75rem;${isLast ? '' : `border-bottom:1px solid ${clr.divider};`}">`);
    html.push(`<div style="margin-bottom:0.5rem;font-size:0.6875rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${clr.groupTitle};">${escapeHtml(g.title)}</div>`);
    for (const item of g.items) {
      const flatIndex = globalSearchState.items.findIndex((entry) => entry.type === g.key && entry.id === item.id);
      const isActive = flatIndex === globalSearchState.activeIndex;
      const btnBg = isActive ? clr.activeBg : 'transparent';
      const btnBorder = isActive ? `1px solid rgba(31,118,104,0.25)` : '1px solid transparent';
      html.push(`<button data-search-type="${g.key}" data-search-id="${escapeHtml(item.id)}" data-search-index="${flatIndex}" aria-label="Open ${escapeHtml(item.label)} in ${escapeHtml(searchTypeLabels[g.key] || g.title)}" style="display:flex;width:100%;align-items:flex-start;gap:0.75rem;border-radius:0.5rem;padding:0.5rem;text-align:left;background:${btnBg};border:${btnBorder};cursor:pointer;transition:background 150ms;" onmouseover="this.style.background='${isActive ? clr.activeBg : clr.hoverBg}'" onmouseout="this.style.background='${btnBg}'">`);
      html.push(`<span style="margin-top:0.25rem;height:0.625rem;width:0.625rem;flex-shrink:0;border-radius:9999px;background:${isActive ? clr.dotActive : clr.dotDefault};${isActive ? 'box-shadow:0 0 0 4px rgba(31,118,104,0.14);' : ''}"></span>`);
      html.push(`<span style="min-width:0;flex:1;">`);
      html.push(`<div style="font-size:0.875rem;font-weight:600;color:${clr.label};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.label)}</div>`);
      html.push(`<div style="margin-top:0.25rem;display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;color:${clr.meta};"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.meta)}</span><span style="flex-shrink:0;border-radius:9999px;border:1px solid ${clr.badgeBorder};background:${clr.badgeBg};padding:0.1rem 0.5rem;font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${clr.meta};">${escapeHtml(searchTypeLabels[g.key] || g.title)}</span></div>`);
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
      if (!Number.isNaN(nextIndex)) globalSearchState.activeIndex = nextIndex;
      if (nextType && nextType !== globalSearchState.activeType) {
        globalSearchState.activeType = nextType;
        syncSidebarToSearchType(nextType);
      }
      // Highlight using inline styles (buttons use inline styles, not Tailwind classes)
      const curDark = document.documentElement.classList.contains('dark') || document.body.getAttribute('data-theme') === 'dark';
      const activeBg  = curDark ? 'rgba(31,118,104,0.22)' : 'rgba(31,118,104,0.08)';
      const inactiveBg = 'transparent';
      const dotActive  = '#1f7668';
      const dotDefault = curDark ? '#475569' : '#cbd5e1';
      document.querySelectorAll('#globalSearchResults [data-search-type]').forEach((b) => {
        const bIdx = Number(b.getAttribute('data-search-index'));
        const isActive = bIdx === nextIndex;
        b.style.background = isActive ? activeBg : inactiveBg;
        b.style.border = isActive ? '1px solid rgba(31,118,104,0.25)' : '1px solid transparent';
        const dot = b.querySelector('span[style*="border-radius:9999px"]');
        if (dot) {
          dot.style.background = isActive ? dotActive : dotDefault;
          dot.style.boxShadow  = isActive ? '0 0 0 4px rgba(31,118,104,0.14)' : 'none';
        }
      });
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
    drivers: 'drivers',
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
      vehicles:  `[data-edit-id="${id}"]`,
      bookings:  `[data-edit-booking-id="${id}"]`,
      customers: `[data-open-customer-id="${id}"]`,
      drivers:   `[data-driver-id="${id}"]`,
      admins:    `[data-permission="${id}"]`,
    };

    const sel = selectorMap[type];
    const el = document.querySelector(sel);
    if (el) {
      el.click();
    }
  }, 200);

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

async function setupMaintenanceSync() {
  if (maintenanceUnsubscribe) {
    maintenanceUnsubscribe();
    maintenanceUnsubscribe = null;
  }

  try {
    maintenanceUnsubscribe = await subscribeMaintenanceChanges((eventType, newRow, oldRow) => {
      const rows = appState.data.maintenance || [];

      if (eventType === 'INSERT' && newRow) {
        // Avoid duplicates
        if (!rows.some((r) => r.dbId === newRow.dbId)) {
          rows.unshift(newRow);
        }
      } else if (eventType === 'UPDATE' && newRow) {
        const idx = rows.findIndex((r) => r.dbId === newRow.dbId);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...newRow };
        } else {
          rows.unshift(newRow);
        }
      } else if (eventType === 'DELETE' && oldRow) {
        appState.data.maintenance = rows.filter((r) => r.dbId !== oldRow.dbId);
      }

      // Re-render if on a module that shows maintenance data
      if (appState.activeModule === 'maintenance' || appState.activeModule === 'overview') {
        renderActiveModule();
      }
    });
  } catch (err) {
    console.warn('[maintenance] realtime setup failed:', err.message);
  }
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
    vehicleName: formatLabel(booking && booking.vehicleName ? booking.vehicleName : 'Vehicle'),
    vehicleType: formatLabel(booking && booking.vehicleType ? booking.vehicleType : booking && booking.type ? booking.type : ''),
    vehicleId: String(booking && booking.vehicleId ? booking.vehicleId : ''),
    pickupLocation: String(booking && booking.pickupLocation ? booking.pickupLocation : ''),
    userMessage: String(booking && booking.userMessage ? booking.userMessage : ''),
    driverOption: String(booking && booking.driverOptionLabel ? booking.driverOptionLabel : booking && booking.driverOption ? booking.driverOption : 'Self Drive'),
    start: String(booking && booking.startDate ? booking.startDate : ''),
    end: String(booking && booking.endDate ? booking.endDate : ''),
    pickupTime: String(booking && booking.pickupTime ? booking.pickupTime : ''),
    type: formatLabel(booking && booking.vehicleType ? booking.vehicleType : booking && booking.type ? booking.type : 'Vehicle'),
    status: formatLabel(booking && booking.statusLabel ? booking.statusLabel : booking && booking.status ? booking.status : 'Confirmed'),
    paymentDone,
    paymentLabel: paymentDone ? 'Yes' : 'No',
    paymentStatus,
    paymentStatusLabel: prettyPaymentStatusLabel(paymentStatus),
    paidAmount,
    remainingAmount,
    total: totalAmount,
    createdAt: String(booking && booking.createdAt ? booking.createdAt : ''),
    paymentId: String(booking && booking.paymentId ? booking.paymentId : ''),
    transactionId: String(booking && booking.transactionId ? booking.transactionId : ''),
    paymentMethod: String(booking && booking.paymentMethod ? booking.paymentMethod : ''),
    paymentDate: String(booking && booking.paymentDate ? booking.paymentDate : ''),
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

async function hydrateDriversFromDatabase({ silent = false } = {}) {
  if (!appState.driverService) return;

  try {
    const rows = await appState.driverService.listDrivers();
    if (Array.isArray(rows) && rows.length) {
      appState.data.drivers = rows;
    }
    if (!silent) {
      pushToast('Drivers synced from database', 'success');
    }
  } catch (error) {
    console.warn('Failed to sync drivers from database:', error);
    if (!silent) {
      pushToast(`Drivers sync failed: ${error.message}`, 'warn');
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

function openNotificationPanel() {
  const existing = document.getElementById('notifPanelPopup');
  if (existing) { existing.remove(); return; }
  const btn = document.getElementById('notificationBtn');
  if (!btn) return;

  const items = [];

  // Recent pending / confirmed bookings
  const recentBookings = (Array.isArray(appState.data.bookings) ? appState.data.bookings : [])
    .filter((b) => ['pending', 'confirmed'].includes(String(b.status || '').toLowerCase()))
    .slice(0, 6);
  for (const b of recentBookings) {
    items.push({
      icon: 'event_note', iconHex: '#1f7668',
      title: `Booking ${b.id}`,
      body: `${b.customer} \u00b7 ${b.status}`,
      time: formatRelativeTime(b.createdAt),
      module: 'bookings', selector: `[data-edit-booking-id="${b.bookingId || b.id}"]`,
    });
  }

  // Pending KYC verifications
  const pendingVerifs = (Array.isArray(appState.data.customers) ? appState.data.customers : [])
    .filter((c) => c.isPendingReview).slice(0, 4);
  for (const c of pendingVerifs) {
    items.push({
      icon: 'verified_user', iconHex: '#f59e0b',
      title: `KYC: ${c.name}`,
      body: 'Profile verification pending review',
      time: formatRelativeTime(c.verificationSubmittedAt),
      module: 'customers', selector: `[data-open-customer-id="${c.id}"]`,
    });
  }

  // Recent payments
  const recentPayments = (Array.isArray(appState.data.payments) ? appState.data.payments : []).slice(0, 3);
  for (const p of recentPayments) {
    items.push({
      icon: 'credit_card', iconHex: '#10b981',
      title: `Payment \u2014 ${p.bookingCode || p.id || ''}`,
      body: `${p.customerName || ''} \u00b7 NPR ${Number(p.amount || 0).toLocaleString()}`,
      time: formatRelativeTime(p.paidAt || p.createdAt || ''),
      module: 'payments', selector: '',
    });
  }

  const panel = document.createElement('div');
  panel.id = 'notifPanelPopup';
  const rect = btn.getBoundingClientRect();
  const panelW = Math.min(400, window.innerWidth - 16);
  panel.style.cssText = `position:fixed;top:${Math.round(rect.bottom + 8)}px;right:${Math.max(8, Math.round(window.innerWidth - rect.right))}px;z-index:200;width:${panelW}px;border-radius:1rem;box-shadow:0 8px 32px rgba(0,0,0,0.22);overflow:hidden;`;

  panel.innerHTML = `
    <div class="notif-header">
      <span class="notif-heading">
        Notifications
        ${items.length > 0 ? `<span class="notif-badge">${items.length}</span>` : ''}
      </span>
      <button id="notifViewAllBtn" class="notif-view-all">View all</button>
    </div>
    <div class="notif-list">
      ${items.length === 0
        ? '<p class="notif-empty">No pending items right now</p>'
        : items.map((item, i) =>
            `<button data-notif-idx="${i}" class="notif-item">
              <span class="material-symbols-outlined notif-icon" style="color:${item.iconHex}">${item.icon}</span>
              <span class="notif-item-body">
                <p class="notif-title">${escapeHtml(item.title)}</p>
                <p class="notif-body">${escapeHtml(item.body)}</p>
                <p class="notif-time">${escapeHtml(item.time)}</p>
              </span>
              <span class="material-symbols-outlined notif-chevron">chevron_right</span>
            </button>`
          ).join('')
      }
    </div>
  `;
  document.body.appendChild(panel);

  panel.querySelectorAll('[data-notif-idx]').forEach((el) => {
    el.addEventListener('click', () => {
      const item = items[Number(el.getAttribute('data-notif-idx'))];
      if (!item) return;
      panel.remove();
      document.removeEventListener('pointerdown', outsideClick);
      appState.activeModule = item.module;
      setActiveNav(item.module);
      renderActiveModule();
      if (item.selector) {
        window.setTimeout(() => { const t = document.querySelector(item.selector); if (t) t.click(); }, 220);
      }
    });
  });

  panel.querySelector('#notifViewAllBtn')?.addEventListener('click', () => {
    panel.remove();
    document.removeEventListener('pointerdown', outsideClick);
    appState.activeModule = 'notifications';
    setActiveNav('notifications');
    renderActiveModule();
  });

  function outsideClick(e) {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.remove();
      document.removeEventListener('pointerdown', outsideClick);
    }
  }
  window.setTimeout(() => document.addEventListener('pointerdown', outsideClick), 60);
}

function buildBookingNotifications(bookings) {
  return (Array.isArray(bookings) ? bookings : [])
    .filter((b) => ['pending', 'confirmed'].includes(String(b.status || '').toLowerCase()))
    .slice(0, 5)
    .map((b) => ({
      id: `BK-NOTIF-${b.id}`,
      title: `Booking ${b.id} — ${b.customer}`,
      channel: 'Bookings',
      priority: String(b.status || '').toLowerCase() === 'pending' ? 'High' : 'Normal',
      time: formatRelativeTime(b.createdAt),
      type: 'booking_created',
      bookingId: b.bookingId || b.id,
    }));
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

function mergeNotifications(baseRows, verificationRows, bookingRows) {
  const base = Array.isArray(baseRows) ? baseRows : [];
  const generated = Array.isArray(verificationRows) ? verificationRows : [];
  const bookings = Array.isArray(bookingRows) ? bookingRows : [];

  const filteredBase = base.filter((row) => {
    const type = String(row && row.type ? row.type : '').trim().toLowerCase();
    return type !== 'verification_queue' && type !== 'verification_submission' && type !== 'booking_created';
  });

  return [...generated, ...bookings, ...filteredBase];
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
  const bookingNotifications = buildBookingNotifications(appState.data.bookings);
  appState.data.notifications = mergeNotifications(appState.baseNotifications, generatedNotifications, bookingNotifications);
  const pendingBookingCount = (Array.isArray(appState.data.bookings) ? appState.data.bookings : [])
    .filter((b) => String(b.status || '').toLowerCase() === 'pending').length;
  updateVerificationNotificationBadge(pendingCount + pendingBookingCount);
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
