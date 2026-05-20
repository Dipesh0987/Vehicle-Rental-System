import { classMap } from '../config.js';
import { escapeHtml, formatNpr, formatDateTime, formatDate } from '../utils.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';
import { openModal, renderEmptyState } from '../ui.js';

const STATUS_OPTIONS = ['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Billed'];
const SERVICE_TYPES  = ['Damage', 'Scheduled Service', 'Inspection', 'Repair'];

function generateMaintenanceId(existing) {
  const rows = Array.isArray(existing) ? existing : [];
  const nums = rows
    .map((r) => {
      const m = String(r.id || '').match(/^M-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `M-${String(next).padStart(3, '0')}`;
}

// Workshop summary card group IDs (used for click-to-filter)
const CARD_UPCOMING       = 'upcoming';
const CARD_IN_WORKSHOP    = 'inWorkshop';
const CARD_DAMAGE_OPEN    = 'damageOpen';
const CARD_COMPLETED      = 'completed';

const maintenanceUiState = {
  selectedId: '',
  statusFilter: 'All',
  workshopCardGroup: '',  // '' | 'upcoming' | 'inWorkshop' | 'damageOpen' | 'completed'
  page: 1,
  mode: 'list', // list | detail | add | edit | billing
};

/**
 * Returns live workshop summary counts from the current data.
 * Can be called by the overview module to display workshop stats.
 */
export function getWorkshopSummaryCounts(data) {
  const rows = Array.isArray(data?.maintenance) ? data.maintenance : [];
  return {
    upcoming:         rows.filter((r) => r.status === 'Scheduled').length,
    inWorkshop:       rows.filter((r) => r.status === 'In Progress').length,
    damageClaimsOpen: rows.filter((r) => r.serviceType === 'Damage' && r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Billed').length,
  };
}

export function renderMaintenanceModule({ data, query, notify, rerender, reloadMaintenanceData }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const sourceRows = Array.isArray(data?.maintenance) ? data.maintenance : [];

  if (maintenanceUiState.mode === 'detail' && maintenanceUiState.selectedId) {
    const record = sourceRows.find((r) => r.id === maintenanceUiState.selectedId);
    if (record) {
      renderDetailView(host, record, data, notify, rerender);
      return host;
    }
    maintenanceUiState.mode = 'list';
    maintenanceUiState.selectedId = '';
  }

  if (maintenanceUiState.mode === 'billing' && maintenanceUiState.selectedId) {
    const record = sourceRows.find((r) => r.id === maintenanceUiState.selectedId);
    if (record) {
      renderBillingForm(host, record, data, notify, rerender);
      return host;
    }
    maintenanceUiState.mode = 'detail';
  }

  if (maintenanceUiState.mode === 'add' || maintenanceUiState.mode === 'edit') {
    const editRecord = maintenanceUiState.mode === 'edit'
      ? sourceRows.find((r) => r.id === maintenanceUiState.selectedId)
      : null;
    renderMaintenanceForm(host, editRecord, data, notify, rerender);
    return host;
  }

  // ── List View ──────────────────────────────────────────────

  // live summary counts from full source (not affected by any filter)
  const scheduled   = sourceRows.filter((r) => r.status === 'Scheduled').length;
  const inProgress  = sourceRows.filter((r) => r.status === 'In Progress').length;
  const completed   = sourceRows.filter((r) => r.status === 'Completed').length;
  const billed      = sourceRows.filter((r) => r.status === 'Billed').length;
  const damageOpen  = sourceRows.filter((r) => r.serviceType === 'Damage' && r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Billed').length;

  let filtered = filterRows(sourceRows, query, ['id', 'vehicle', 'damage', 'status', 'serviceType', 'technician']);

  // Apply workshop card group filter
  if (maintenanceUiState.workshopCardGroup === CARD_UPCOMING) {
    filtered = filtered.filter((r) => r.status === 'Scheduled');
  } else if (maintenanceUiState.workshopCardGroup === CARD_IN_WORKSHOP) {
    filtered = filtered.filter((r) => r.status === 'In Progress');
  } else if (maintenanceUiState.workshopCardGroup === CARD_DAMAGE_OPEN) {
    filtered = filtered.filter((r) => r.serviceType === 'Damage' && r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Billed');
  } else if (maintenanceUiState.workshopCardGroup === CARD_COMPLETED) {
    filtered = filtered.filter((r) => r.status === 'Completed');
  }

  // Apply status pill filter on top
  if (maintenanceUiState.statusFilter !== 'All') {
    filtered = filtered.filter((r) => r.status === maintenanceUiState.statusFilter);
  }

  const paged = paginateRows(filtered, maintenanceUiState.page, 8);

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quality</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">Maintenance &amp; Damage</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button id="refreshMaintenanceBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
        <button id="reportDamageBtn" class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">car_crash</span> Report Damage
        </button>
      </div>
    </header>

    <!-- Workshop Summary Cards -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      ${workshopCard({
        id: CARD_UPCOMING,
        label: 'Upcoming Services',
        count: scheduled,
        icon: 'schedule',
        color: 'amber',
        subtitle: 'Awaiting workshop slot',
        active: maintenanceUiState.workshopCardGroup === CARD_UPCOMING,
      })}
      ${workshopCard({
        id: CARD_IN_WORKSHOP,
        label: 'In Workshop',
        count: inProgress,
        icon: 'build',
        color: 'blue',
        subtitle: 'Currently being serviced',
        active: maintenanceUiState.workshopCardGroup === CARD_IN_WORKSHOP,
      })}
      ${workshopCard({
        id: CARD_DAMAGE_OPEN,
        label: 'Damage Claims Open',
        count: damageOpen,
        icon: 'warning',
        color: 'rose',
        subtitle: 'Pending resolution',
        active: maintenanceUiState.workshopCardGroup === CARD_DAMAGE_OPEN,
      })}
      ${workshopCard({
        id: CARD_COMPLETED,
        label: 'Completed',
        count: completed,
        icon: 'check_circle',
        color: 'emerald',
        subtitle: 'Services finished',
        active: maintenanceUiState.workshopCardGroup === CARD_COMPLETED,
      })}
    </div>

    <!-- Active card filter banner -->
    ${maintenanceUiState.workshopCardGroup
      ? `<div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
           <span class="material-symbols-outlined text-[16px]">filter_alt</span>
           Showing: <strong>${workshopCardLabel(maintenanceUiState.workshopCardGroup)}</strong>
           <span class="text-slate-400 dark:text-slate-500">(${filtered.length} record${filtered.length !== 1 ? 's' : ''})</span>
           <button id="clearCardFilter" class="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10">Clear</button>
         </div>`
      : ''}

    <!-- Status Filter -->
    <div class="flex flex-wrap items-center gap-2">
      ${STATUS_OPTIONS.map((opt) =>
        `<button data-filter-status="${opt}" class="rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          maintenanceUiState.statusFilter === opt
            ? 'bg-brand-500 text-white'
            : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
        }">${opt}</button>`
      ).join('')}
    </div>

    ${paged.rows.length === 0
      ? renderEmptyState({
          title: maintenanceUiState.workshopCardGroup ? `No ${workshopCardLabel(maintenanceUiState.workshopCardGroup).toLowerCase()} records` : 'No records found',
          message: maintenanceUiState.workshopCardGroup
            ? 'All items in this category have been resolved or none exist yet.'
            : (maintenanceUiState.statusFilter !== 'All' ? 'Try a different status filter.' : 'No maintenance records yet.'),
          actionLabel: maintenanceUiState.workshopCardGroup ? 'Show All Records' : 'Schedule Service',
          actionId: maintenanceUiState.workshopCardGroup ? 'clearCardFilterEmpty' : 'emptyAddBtn',
        })
      : `<section class="${classMap.panel} p-4 sm:p-5">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm text-slate-900 dark:text-slate-100">
            <thead>
              <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th class="pb-2 pr-3">ID</th>
                <th class="pb-2 pr-3">Vehicle</th>
                <th class="pb-2 pr-3">Schedule</th>
                <th class="pb-2 pr-3">Service / Damage</th>
                <th class="pb-2 pr-3">Status</th>
                <th class="pb-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${paged.rows.map((row) => `
                <tr class="border-b border-slate-100 cursor-pointer transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5" data-maint-row="${row.id}">
                  <td class="py-3 pr-3 font-bold text-slate-900 dark:text-white">${escapeHtml(row.id)}</td>
                  <td class="py-3 pr-3">
                    <p class="font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(row.vehicle)}</p>
                    ${row.vehicleId ? `<p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.vehicleId)}</p>` : ''}
                  </td>
                  <td class="py-3 pr-3 text-slate-700 dark:text-slate-300">${escapeHtml(row.schedule)}</td>
                  <td class="py-3 pr-3">
                    <p class="text-slate-800 dark:text-slate-200">${escapeHtml(row.damage)}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.serviceType || '')}</p>
                  </td>
                  <td class="py-3 pr-3"><span class="${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
                  <td class="py-3 pr-3 text-right whitespace-nowrap">
                    <button data-edit-maint="${row.id}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" title="Edit">
                      <span class="material-symbols-outlined text-[14px] align-middle">edit</span>
                    </button>
                    <button data-delete-maint="${row.id}" class="ml-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10" title="Delete">
                      <span class="material-symbols-outlined text-[14px] align-middle">delete</span>
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div id="maintPagination" class="mt-3 flex justify-end"></div>
      </section>`
    }
  `;

  // ── Events ─────────────────────────────────────────────────
  const openAdd = () => { maintenanceUiState.mode = 'add'; maintenanceUiState.selectedId = ''; rerender(); };

  host.querySelector('#emptyAddBtn')?.addEventListener('click', openAdd);

  // Clear card filter buttons (banner + empty state)
  const clearCardFilter = () => {
    maintenanceUiState.workshopCardGroup = '';
    maintenanceUiState.page = 1;
    rerender();
  };
  host.querySelector('#clearCardFilter')?.addEventListener('click', clearCardFilter);
  host.querySelector('#clearCardFilterEmpty')?.addEventListener('click', clearCardFilter);

  host.querySelector('#refreshMaintenanceBtn')?.addEventListener('click', async () => {
    if (typeof reloadMaintenanceData === 'function') {
      await reloadMaintenanceData();
    } else {
      rerender?.();
    }
    notify('Maintenance records refreshed', 'success');
  });

  host.querySelector('#reportDamageBtn')?.addEventListener('click', () => {
    maintenanceUiState.mode = 'add';
    maintenanceUiState.selectedId = '';
    rerender();
  });

  // Workshop summary card click → toggle filter
  host.querySelectorAll('[data-workshop-card]').forEach((card) => {
    const handler = () => {
      const cardId = card.getAttribute('data-workshop-card');
      // Toggle: clicking the active card deactivates it
      maintenanceUiState.workshopCardGroup =
        maintenanceUiState.workshopCardGroup === cardId ? '' : cardId;
      maintenanceUiState.statusFilter = 'All';
      maintenanceUiState.page = 1;
      rerender();
    };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });

  host.querySelectorAll('[data-filter-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      maintenanceUiState.statusFilter = btn.getAttribute('data-filter-status') || 'All';
      maintenanceUiState.page = 1;
      rerender();
    });
  });

  host.querySelectorAll('[data-maint-row]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-maint]') || e.target.closest('[data-delete-maint]')) return;
      maintenanceUiState.selectedId = row.getAttribute('data-maint-row');
      maintenanceUiState.mode = 'detail';
      rerender();
    });
  });

  host.querySelectorAll('[data-edit-maint]').forEach((btn) => {
    btn.addEventListener('click', () => {
      maintenanceUiState.selectedId = btn.getAttribute('data-edit-maint');
      maintenanceUiState.mode = 'edit';
      rerender();
    });
  });

  host.querySelectorAll('[data-delete-maint]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rid = btn.getAttribute('data-delete-maint');
      const rec = sourceRows.find((r) => r.id === rid);
      openModal({
        title: 'Delete Record',
        content: `<p>Delete maintenance record <strong>${escapeHtml(rid)}</strong> for <strong>${escapeHtml(rec?.vehicle || '')}</strong>?</p><p class="mt-2 text-xs text-slate-500">This action cannot be undone.</p>`,
        onConfirm: () => {
          data.maintenance = data.maintenance.filter((r) => r.id !== rid);
          notify(`Record ${rid} deleted`, 'success');
          rerender();
        },
      });
    });
  });

  const pagHost = host.querySelector('#maintPagination');
  if (pagHost && paged.pages > 1) {
    pagHost.appendChild(renderPagination(paged, (p) => { maintenanceUiState.page = p; rerender(); }));
  }

  return host;
}

// ── Detail View ────────────────────────────────────────────────
function renderDetailView(host, rec, data, notify, rerender) {
  host.innerHTML = `
    <header class="flex flex-wrap items-center gap-3">
      <button id="maintBackBtn" class="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Maintenance Detail</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">${escapeHtml(rec.id)} — ${escapeHtml(rec.vehicle)}</h2>
      </div>
      <div class="ml-auto flex flex-wrap gap-2">
        ${rec.serviceType === 'Damage' && rec.status === 'Completed'
          ? `<button id="billCustomerBtn" class="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20">
               <span class="material-symbols-outlined mr-1 text-[16px] align-middle">receipt_long</span> Bill Customer
             </button>`
          : ''}
        <button id="detailEditBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">edit</span> Edit
        </button>
        <button id="detailDeleteBtn" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">delete</span> Delete
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- Record Info -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-3">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Record Details</h3>
        ${detailField('Maintenance ID', rec.id)}
        ${detailField('Vehicle', rec.vehicle)}
        ${detailField('Vehicle Number', rec.vehicleId || '-')}
        ${detailField('Service Type', rec.serviceType || '-')}
        ${rec.customerName ? detailField('Damaged By', rec.customerName + (rec.customerEmail ? ' (' + rec.customerEmail + ')' : '')) : ''}
        ${rec.bookingRef   ? detailField('Linked Booking', rec.bookingRef) : ''}
        ${detailField('Damage / Service', rec.damage)}
        ${detailField('Scheduled Date', rec.schedule)}
        ${rec.completedAt ? detailField('Completed On', rec.completedAt) : ''}
      </section>

      <!-- Status & Assignment -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-3">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Status &amp; Assignment</h3>
        <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Status</span>
          <span class="${statusClass(rec.status)}">${escapeHtml(rec.status)}</span>
        </div>

        <!-- Quick Status Update -->
        <div class="space-y-2">
          <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Update Status</p>
          <div class="flex flex-wrap gap-2">
            ${['Scheduled','In Progress','Completed','Cancelled'].filter(() => rec.status !== 'Billed').map((s) =>
              `<button data-set-status="${s}" class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                rec.status === s
                  ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10'
              }">${s}</button>`
            ).join('')}
            ${rec.status === 'Billed'
              ? `<span class="rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-violet-300">Billed — charge issued</span>`
              : ''}
          </div>
        </div>

        ${detailField('Technician', rec.technician || '-')}
        ${detailField('Reported By', rec.reportedBy || '-')}
        ${detailField('Cost Estimate', rec.costEstimate ? `NPR ${Number(rec.costEstimate).toLocaleString()}` : '-')}
      </section>

      <!-- Notes -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-3 md:col-span-2">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Notes</h3>
        <p class="text-sm text-slate-700 dark:text-slate-200">${escapeHtml(rec.notes) || '<span class="italic text-slate-400 dark:text-slate-500">No notes.</span>'}</p>
      </section>

      ${rec.status === 'Billed'
        ? `<!-- Billing Banner -->
           <section class="md:col-span-2 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-400/30 dark:bg-violet-500/10">
             <div class="flex items-start gap-3">
               <span class="material-symbols-outlined text-violet-600 dark:text-violet-300 mt-0.5">receipt_long</span>
               <div>
                 <p class="text-sm font-bold text-violet-800 dark:text-violet-200">Damage bill issued</p>
                 <p class="text-xs text-violet-600 dark:text-violet-400 mt-0.5">A payment request has been sent to the customer. Check the Payments module or eSewa for settlement status.</p>
               </div>
             </div>
           </section>`
        : ''}
    </div>
  `;

  host.querySelector('#maintBackBtn')?.addEventListener('click', () => {
    maintenanceUiState.mode = 'list';
    maintenanceUiState.selectedId = '';
    rerender();
  });

  host.querySelector('#billCustomerBtn')?.addEventListener('click', () => {
    maintenanceUiState.mode = 'billing';
    rerender();
  });

  host.querySelector('#detailEditBtn')?.addEventListener('click', () => {
    maintenanceUiState.mode = 'edit';
    rerender();
  });

  host.querySelector('#detailDeleteBtn')?.addEventListener('click', () => {
    openModal({
      title: 'Delete Record',
      content: `<p>Delete <strong>${escapeHtml(rec.id)}</strong> for <strong>${escapeHtml(rec.vehicle)}</strong>?</p>`,
      onConfirm: () => {
        data.maintenance = data.maintenance.filter((r) => r.id !== rec.id);
        maintenanceUiState.mode = 'list';
        maintenanceUiState.selectedId = '';
        notify(`Record ${rec.id} deleted`, 'success');
        rerender();
      },
    });
  });

  host.querySelectorAll('[data-set-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newStatus = btn.getAttribute('data-set-status');
      const idx = data.maintenance.findIndex((r) => r.id === rec.id);
      if (idx >= 0) {
        data.maintenance[idx].status = newStatus;
        if (newStatus === 'Completed' && !data.maintenance[idx].completedAt) {
          data.maintenance[idx].completedAt = new Date().toISOString().slice(0, 10);
        }
      }
      notify(`Status updated to "${newStatus}"`, 'success');
      rerender();
    });
  });
}

// ── Add / Edit Form ─────────────────────────────────────────
function renderMaintenanceForm(host, existing, data, notify, rerender) {
  const isEdit = Boolean(existing);
  const r = existing || {};

  const todayStr = new Date().toISOString().slice(0, 10);
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  const vehicleMap = {};
  for (const v of vehicles) { vehicleMap[v.name || v.vehicle_number || v.id] = v.vehicle_number || v.id; }
  const scheduledMinAttr = isEdit ? '' : `min="${todayStr}"`;
  const completedMinAttr = r.schedule ? `min="${r.schedule}"` : '';
  // For Damage type (default): hide schedule/completed/technician fields
  const isDamageDefault = !r.serviceType || r.serviceType === 'Damage';

  const panelHdr = (icon, label, extraCls = '') =>
    `<div class="mb-4 flex items-center gap-2 ${extraCls}">
      <span class="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">${icon}</span>
      <h3 class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">${label}</h3>
    </div>`;

  host.innerHTML = `
    <header class="flex flex-wrap items-center gap-3">
      <button id="formBackBtn" class="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div>
        <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Quality &rsaquo; Maintenance</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">${isEdit ? 'Edit Record' : isDamageDefault ? 'Report Vehicle Damage' : 'New Maintenance Record'}</h2>
      </div>
    </header>

    <form id="maintForm" class="space-y-4" novalidate>

      <!-- ── 1. Type banner + core identifiers ───────────────────── -->
      <div class="rounded-2xl border ${isDamageDefault
        ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'
        : 'border-teal-200 bg-teal-50 dark:border-teal-500/20 dark:bg-teal-500/10'
      } p-4">
        <div class="flex flex-wrap items-start gap-4">
          <div class="flex items-start gap-2.5 pt-0.5 min-w-[160px]">
            <span class="material-symbols-outlined text-[22px] ${isDamageDefault ? 'text-rose-500 dark:text-rose-400' : 'text-teal-600 dark:text-teal-400'}">${isDamageDefault ? 'car_crash' : 'build'}</span>
            <div>
              <p class="text-xs font-extrabold uppercase tracking-widest ${isDamageDefault ? 'text-rose-700 dark:text-rose-300' : 'text-teal-700 dark:text-teal-300'}">${isDamageDefault ? 'Damage Report' : 'Service Record'}</p>
              <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">${isDamageDefault ? 'Log damage &amp; link responsible customer' : 'Schedule or log a maintenance job'}</p>
            </div>
          </div>
          <div class="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3" style="min-width:0">
            ${formField('Record ID', 'maintId', 'text', isEdit ? r.id : generateMaintenanceId(data.maintenance), !isEdit, isEdit ? '' : 'Auto-generated')}${isEdit ? '' : '<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Auto-generated — you can change it</p>'}
            ${formSelect('Service Type', 'serviceType', SERVICE_TYPES, r.serviceType || 'Damage')}
            ${formSelect('Status', 'status', STATUS_OPTIONS.filter((s) => s !== 'All'), r.status || (isDamageDefault ? 'In Progress' : 'Scheduled'))}
          </div>
        </div>
      </div>

      <!-- ── 2. Vehicle + Key Details (always visible) ──────────── -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">

        <section class="${classMap.panel} p-4 sm:p-5">
          ${panelHdr('directions_car', 'Vehicle')}
          ${vehicleComboField(vehicles, r.vehicle, r.vehicleId)}
        </section>

        <section class="${classMap.panel} p-4 sm:p-5">
          ${panelHdr('info', 'Details')}
          <div class="grid grid-cols-2 gap-3">
            ${formField('Cost Estimate (NPR)', 'costEstimate', 'number', r.costEstimate, false, '0')}
            ${formField('Reported By', 'reportedBy', 'text', r.reportedBy, false, 'Admin / Driver')}
          </div>
        </section>

      </div>

      <!-- ── 3. Description (always visible) ────────────────────── -->
      <section class="${classMap.panel} p-4 sm:p-5">
        ${panelHdr('description', isDamageDefault ? 'Damage Description' : 'Service Description')}
        ${formTextarea('Describe the issue or service required', 'damage', r.damage, true, 'e.g. Deep scratch on rear bumper from parking incident on 2025-05-10')}
      </section>

      <!-- ── 4. Damaged By Customer (Damage only) ───────────────── -->
      <section id="customerPickerSection" class="${classMap.panel} p-4 sm:p-5${(r.serviceType && r.serviceType !== 'Damage') ? ' hidden' : ''}">
        <div class="mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px] text-rose-400">person_search</span>
          <h3 class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">Damaged By Customer</h3>
          <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">Optional</span>
        </div>
        <p class="mb-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Link the customer whose trip caused the damage. Select a completed trip below — name and email auto-fill. You can also type details manually.</p>
        <div class="space-y-3">
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Recent Completed Trips for this Vehicle</label>
            <select id="customerPicker" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-[#1a2632] dark:text-white">
              <option value="">— Select the vehicle above to load recent trips —</option>
            </select>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            ${formField('Customer Name', 'customerName', 'text', r.customerName || '', false, 'Auto-filled from trip')}
            ${formField('Customer Email', 'customerEmail', 'email', r.customerEmail || '', false, 'Auto-filled from trip')}
          </div>
        </div>
        <input type="hidden" name="customerUserId"  value="${escapeHtml(r.customerUserId  || '')}" />
        <input type="hidden" name="linkedBookingId" value="${escapeHtml(r.linkedBookingId || '')}" />
        <input type="hidden" name="bookingRef"      value="${escapeHtml(r.bookingRef      || '')}" />
      </section>

      <!-- ── 5. Schedule (Service / Inspection / Repair only) ───── -->
      <section id="scheduleSection" class="${classMap.panel} p-4 sm:p-5${isDamageDefault ? ' hidden' : ''}">
        ${panelHdr('calendar_month', 'Schedule')}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div id="scheduleDateWrap">${formField('Scheduled Date', 'schedule', 'date', r.schedule, true, '', scheduledMinAttr)}</div>
          <div id="completedDateWrap">${formField('Completed Date', 'completedAt', 'date', r.completedAt, false, '', completedMinAttr)}</div>
          <div id="technicianWrap">${formField('Technician', 'technician', 'text', r.technician, false, 'Assigned technician')}</div>
        </div>
      </section>

      <!-- ── 6. Notes (always visible) ─────────────────────────── -->
      <section class="${classMap.panel} p-4 sm:p-5">
        ${panelHdr('notes', 'Notes')}
        ${formTextarea('Additional remarks or observations', 'notes', r.notes, false, 'e.g. Parts ordered, waiting for delivery…')}
      </section>

      <!-- ── 7. Actions ─────────────────────────────────────────── -->
      <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
        <button type="button" id="formCancelBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
        <button type="submit" class="inline-flex items-center gap-1.5 rounded-xl ${isDamageDefault ? 'bg-rose-500 hover:bg-rose-600' : 'bg-brand-500 hover:bg-brand-600'} px-6 py-2 text-sm font-semibold text-white transition">
          <span class="material-symbols-outlined text-[16px]">${isDamageDefault ? 'report' : 'save'}</span>
          ${isEdit ? 'Save Changes' : isDamageDefault ? 'Submit Damage Report' : 'Create Record'}
        </button>
      </div>

    </form>
  `;

  // Wire up vehicle name → auto-fill vehicle number
  const vehicleInput = host.querySelector('[name="vehicle"]');
  const vehicleIdInput = host.querySelector('[name="vehicleId"]');
  if (vehicleInput && vehicleIdInput) {
    vehicleInput.addEventListener('input', () => {
      const match = vehicleMap[vehicleInput.value];
      if (match) vehicleIdInput.value = match;
    });
  }

  // ── Customer picker ─────────────────────────────────────────
  const serviceTypeEl    = host.querySelector('[name="serviceType"]');
  const pickerSection    = host.querySelector('#customerPickerSection');
  const pickerEl         = host.querySelector('#customerPicker');
  const custNameEl       = host.querySelector('[name="customerName"]');
  const custEmailEl      = host.querySelector('[name="customerEmail"]');
  const custUserIdEl     = host.querySelector('[name="customerUserId"]');
  const custBookingIdEl  = host.querySelector('[name="linkedBookingId"]');
  const custBookingRefEl = host.querySelector('[name="bookingRef"]');

  function toggleCustomerSection() {
    const isDamage = serviceTypeEl?.value === 'Damage';
    pickerSection?.classList.toggle('hidden', !isDamage);
    host.querySelector('#scheduleSection')?.classList.toggle('hidden', isDamage);
    if (isDamage) {
      const schedInput = host.querySelector('[name="schedule"]');
      if (schedInput && !schedInput.value) schedInput.value = new Date().toISOString().slice(0, 10);
    }
  }
  serviceTypeEl?.addEventListener('change', toggleCustomerSection);

  async function triggerCustomerLoad() {
    const vName = vehicleInput?.value?.trim();
    if (vName && serviceTypeEl?.value === 'Damage' && pickerEl) {
      await loadRecentCustomersForVehicle(vName, vehicles, pickerEl);
    }
  }
  vehicleInput?.addEventListener('change', triggerCustomerLoad);
  vehicleInput?.addEventListener('blur',   triggerCustomerLoad);
  if (r.vehicle && (r.serviceType === 'Damage' || !r.serviceType)) triggerCustomerLoad();

  pickerEl?.addEventListener('change', () => {
    const opt = pickerEl.selectedOptions?.[0];
    if (!opt?.value) return;
    if (custNameEl)       custNameEl.value       = opt.dataset.name  || '';
    if (custEmailEl)      custEmailEl.value      = opt.dataset.email || '';
    if (custUserIdEl)     custUserIdEl.value     = opt.dataset.uid   || '';
    if (custBookingIdEl)  custBookingIdEl.value  = opt.value;
    if (custBookingRefEl) custBookingRefEl.value = opt.dataset.code  || '';
  });

  // Wire up schedule date change → update completed date min
  const scheduleInput = host.querySelector('[name="schedule"]');
  const completedInput = host.querySelector('[name="completedAt"]');
  if (scheduleInput && completedInput) {
    scheduleInput.addEventListener('change', () => {
      completedInput.min = scheduleInput.value || '';
      if (completedInput.value && completedInput.value < scheduleInput.value) {
        completedInput.value = '';
      }
    });
  }

  const goBack = () => {
    maintenanceUiState.mode = isEdit ? 'detail' : 'list';
    if (!isEdit) maintenanceUiState.selectedId = '';
    rerender();
  };
  host.querySelector('#formBackBtn')?.addEventListener('click', goBack);
  host.querySelector('#formCancelBtn')?.addEventListener('click', goBack);

  host.querySelector('#maintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const val = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

    const maintId     = val('maintId');
    const vehicle     = val('vehicle');
    const damage      = val('damage');
    const serviceType = val('serviceType');
    // Damage reports auto-use today as schedule date (field hidden)
    let schedule = val('schedule');
    if (!schedule && serviceType === 'Damage') schedule = new Date().toISOString().slice(0, 10);

    if (!maintId || !vehicle || !damage) {
      notify('Please fill all required fields (marked *)', 'error');
      return;
    }
    if (!schedule) {
      notify('Please enter a scheduled date', 'error');
      return;
    }

    // Schedule must not be in the past for new non-Damage records
    if (!isEdit && serviceType !== 'Damage' && schedule < new Date().toISOString().slice(0, 10)) {
      notify('Scheduled date cannot be in the past', 'error');
      return;
    }

    // Completed date must be on or after scheduled date
    const completedAt = val('completedAt');
    if (completedAt && completedAt < schedule) {
      notify('Completed date must be on or after the scheduled date', 'error');
      return;
    }

    // Cost estimate must not be negative
    const costRaw = parseFloat(val('costEstimate'));
    if (!isNaN(costRaw) && costRaw < 0) {
      notify('Cost estimate cannot be negative', 'error');
      return;
    }

    if (!isEdit && data.maintenance.some((r) => r.id === maintId)) {
      notify(`ID "${maintId}" already exists`, 'error');
      return;
    }

    const record = {
      id:              maintId,
      dbId:            isEdit ? (existing.dbId || '') : '',
      vehicle,
      vehicleId:       val('vehicleId'),
      schedule,
      serviceType:     val('serviceType'),
      damage,
      status:          val('status'),
      costEstimate:    isNaN(costRaw) ? 0 : costRaw,
      technician:      val('technician'),
      reportedBy:      val('reportedBy'),
      completedAt,
      notes:           val('notes'),
      customerName:    val('customerName'),
      customerEmail:   val('customerEmail'),
      customerUserId:  val('customerUserId'),
      linkedBookingId: val('linkedBookingId'),
      bookingRef:      val('bookingRef'),
    };

    // Persist to Supabase
    try {
      if (window.SupabaseClient?.isConfigured()) {
        const client = await window.SupabaseClient.init();
        const dbRow = {
          maintenance_id:    record.id,
          vehicle_name:      record.vehicle,
          vehicle_id:        record.vehicleId || null,
          schedule_date:     record.schedule,
          service_type:      record.serviceType,
          description:       record.damage,
          status:            record.status,
          cost_estimate:     record.costEstimate || null,
          technician:        record.technician   || null,
          reported_by:       record.reportedBy   || null,
          completed_at:      record.completedAt  || null,
          notes:             record.notes        || null,
          customer_name:     record.customerName    || null,
          customer_email:    record.customerEmail   || null,
          customer_user_id:  record.customerUserId  || null,
          linked_booking_id: record.linkedBookingId || null,
          booking_ref:       record.bookingRef      || null,
        };
        if (isEdit && existing.dbId) {
          await client.from('maintenance_records').update(dbRow).eq('id', existing.dbId);
          record.dbId = existing.dbId;
        } else {
          const { data: ins } = await client
            .from('maintenance_records').insert(dbRow).select('id').single();
          if (ins?.id) record.dbId = ins.id;
        }
      }
    } catch (dbErr) {
      // console.warn('[maintenance] Supabase save failed:', dbErr.message);
    }

    if (isEdit) {
      const idx = data.maintenance.findIndex((r) => r.id === existing.id);
      if (idx >= 0) data.maintenance[idx] = record;
      notify(`Record ${record.id} updated`, 'success');
    } else {
      data.maintenance.unshift(record);
      notify(`Record ${record.id} created`, 'success');
    }

    maintenanceUiState.selectedId = record.id;
    maintenanceUiState.mode = 'detail';
    rerender();
  });
}

// ── Helpers ───────────────────────────────────────────────────
function workshopCard({ id, label, count, icon, color, subtitle, active }) {
  const palette = {
    amber: {
      base:   'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
      active: 'border-amber-400 bg-amber-100 ring-2 ring-amber-400/40 text-amber-900 dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-100',
      icon:   'bg-amber-200/60 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300',
      count:  'text-amber-900 dark:text-amber-100',
    },
    blue: {
      base:   'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
      active: 'border-blue-400 bg-blue-100 ring-2 ring-blue-400/40 text-blue-900 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-100',
      icon:   'bg-blue-200/60 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300',
      count:  'text-blue-900 dark:text-blue-100',
    },
    rose: {
      base:   'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
      active: 'border-rose-400 bg-rose-100 ring-2 ring-rose-400/40 text-rose-900 dark:border-rose-400 dark:bg-rose-500/20 dark:text-rose-100',
      icon:   'bg-rose-200/60 text-rose-700 dark:bg-rose-500/30 dark:text-rose-300',
      count:  'text-rose-900 dark:text-rose-100',
    },
    emerald: {
      base:   'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
      active: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-400/40 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-100',
      icon:   'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300',
      count:  'text-emerald-900 dark:text-emerald-100',
    },
  };
  const p = palette[color] || palette.amber;
  const cardCls = active ? p.active : p.base;

  return `<article data-workshop-card="${id}" class="workshop-summary-card group relative cursor-pointer select-none rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${cardCls}" role="button" tabindex="0" aria-pressed="${active}">
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.icon} transition">
        <span class="material-symbols-outlined text-[22px]">${icon}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">${label}</p>
        <p class="mt-1 text-3xl font-extrabold leading-none ${p.count}" data-ws-count="${id}">${count}</p>
        <p class="mt-1.5 text-[11px] font-medium opacity-60">${subtitle}</p>
      </div>
    </div>
    ${active ? '<div class="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full bg-current opacity-50"></div>' : ''}
  </article>`;
}

function workshopCardLabel(groupId) {
  if (groupId === CARD_UPCOMING)    return 'Upcoming Services';
  if (groupId === CARD_IN_WORKSHOP) return 'In Workshop';
  if (groupId === CARD_DAMAGE_OPEN) return 'Damage Claims Open';
  if (groupId === CARD_COMPLETED)   return 'Completed';
  return 'All';
}

function detailField(label, value) {
  return `<div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
    <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${label}</span>
    <span class="text-sm font-semibold text-slate-900 dark:text-white">${escapeHtml(value)}</span>
  </div>`;
}

function vehicleComboField(vehicles, selectedName, selectedId) {
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
  return `<div class="space-y-3">
    <div>
      <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle Name <span class="text-rose-500">*</span></label>
      <input name="vehicle" list="maintVehicleList" value="${escapeHtml(selectedName || '')}" placeholder="Type to search vehicles..." required
        class="${inputCls}" />
      <datalist id="maintVehicleList">
        ${vehicles.map((v) => `<option value="${escapeHtml(v.name || v.vehicle_number || v.id)}">${escapeHtml(v.vehicle_number || v.id)}</option>`).join('')}
      </datalist>
    </div>
    <div>
      <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle Number <span class="text-xs font-normal text-slate-400">(auto-filled)</span></label>
      <input name="vehicleId" value="${escapeHtml(selectedId || '')}" placeholder="Auto-filled on selection"
        class="${inputCls}" />
    </div>
  </div>`;
}

function formField(label, name, type, value, required, placeholder, extraHtml = '') {
  const extra = type === 'number' ? ' min="0"' : '';
  return `<div>
    <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">${label}${required ? ' <span class="text-rose-500">*</span>' : ''}</label>
    <input name="${name}" type="${type}" value="${escapeHtml(value || '')}" ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} ${required ? 'required' : ''}${extra}${extraHtml ? ' ' + extraHtml : ''}
      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white" />
  </div>`;
}

function formTextarea(label, name, value, required, placeholder) {
  return `<div>
    <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">${label}${required ? ' <span class="text-rose-500">*</span>' : ''}</label>
    <textarea name="${name}" rows="3" ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} ${required ? 'required' : ''}
      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white">${escapeHtml(value || '')}</textarea>
  </div>`;
}

function formSelect(label, name, options, selected) {
  return `<div>
    <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">${label}</label>
    <select name="${name}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-[#1a2632] dark:text-white">
      ${options.map((o) => `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
    </select>
  </div>`;
}

async function loadRecentCustomersForVehicle(vehicleName, vehicles, pickerEl) {
  pickerEl.innerHTML = '<option value="">Loading recent trips\u2026</option>';
  pickerEl.disabled = true;
  try {
    if (!window.SupabaseClient?.isConfigured()) throw new Error('Supabase not configured');
    const client = await window.SupabaseClient.init();
    const vehicleObj = vehicles.find((v) => v.name === vehicleName);
    if (!vehicleObj?.id) {
      pickerEl.innerHTML = '<option value="">— Vehicle not found in catalog —</option>';
      pickerEl.disabled = false;
      return;
    }
    const { data: bookings, error } = await client
      .from('vehicle_bookings')
      .select('id,booking_code,customer_name,customer_email,customer_user_id,end_date')
      .eq('vehicle_id', vehicleObj.id)
      .eq('status', 'completed')
      .order('end_date', { ascending: false })
      .limit(15);
    if (error || !bookings?.length) {
      pickerEl.innerHTML = '<option value="">— No completed trips found for this vehicle —</option>';
      pickerEl.disabled = false;
      return;
    }
    pickerEl.innerHTML =
      '<option value="">— Pick a customer from their completed trip —</option>' +
      bookings.map((b) =>
        `<option value="${escapeHtml(b.id)}" ` +
        `data-name="${escapeHtml(b.customer_name)}" ` +
        `data-email="${escapeHtml(b.customer_email)}" ` +
        `data-uid="${escapeHtml(b.customer_user_id || '')}" ` +
        `data-code="${escapeHtml(b.booking_code)}" ` +
        `data-end="${escapeHtml(b.end_date)}"` +
        `>${escapeHtml(b.customer_name)} \u2014 ${escapeHtml(b.booking_code)} (returned ${b.end_date})</option>`
      ).join('');
    pickerEl.disabled = false;
  } catch (err) {
    pickerEl.innerHTML = `<option value="">— Error: ${escapeHtml(err.message)} —</option>`;
    pickerEl.disabled = false;
  }
}


function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Completed')  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'In Progress') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (status === 'Cancelled')  return `${base} bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300`;
  if (status === 'Billed')     return `${base} bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}

// ── Billing Form ──────────────────────────────────────────────
function renderBillingForm(host, rec, data, notify, rerender) {
  const estimatedCost = rec.costEstimate ? Number(rec.costEstimate) : 0;

  host.innerHTML = `
    <header class="flex flex-wrap items-center gap-3">
      <button id="billingBackBtn" class="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">Bill Customer — ${escapeHtml(rec.id)}</h2>
      </div>
    </header>

    <!-- Info banner -->
    <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-500/10">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5">info</span>
        <div class="text-sm">
          <p class="font-semibold text-amber-800 dark:text-amber-200">Damage claim: ${escapeHtml(rec.vehicle)} &mdash; ${escapeHtml(rec.damage)}</p>
          <p class="text-amber-700 dark:text-amber-300 mt-0.5">Cost estimate on record: <strong>NPR ${Number(rec.costEstimate || 0).toLocaleString()}</strong>. Adjust below if needed. An eSewa payment link will be emailed to the customer.</p>
        </div>
      </div>
    </div>

    <form id="billingForm" class="grid grid-cols-1 gap-4 md:grid-cols-2" novalidate>

      <!-- Customer Details -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Customer Details</h3>
        ${formField('Customer Name', 'customerName', 'text', rec.customerName || '', true, 'Full name of the customer')}
        ${formField('Customer Email', 'customerEmail', 'email', rec.customerEmail || '', true, 'customer@example.com')}
        ${formField('Booking Reference', 'bookingRef', 'text', rec.bookingRef || '', false, 'BK-XXXX (optional)')}
      </section>

      <!-- Charge Details -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Charge Details</h3>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Amount (NPR) <span class="text-rose-500">*</span></label>
          <input name="amount" type="number" id="billAmount" min="1" step="0.01"
            value="${escapeHtml(estimatedCost > 0 ? String(estimatedCost) : '')}"
            placeholder="Enter charge amount"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <p class="mt-1 text-xs text-slate-400">Pre-filled from cost estimate. Admin may adjust.</p>
        </div>
        ${formTextarea('Reason / Description', 'reason', rec.damage || '', true, 'Explain the damage charge')}
        ${formTextarea('Internal Notes', 'notes', '', false, 'Optional internal remarks (not sent to customer)')}
      </section>

      <!-- Actions -->
      <div class="md:col-span-2 flex justify-end gap-2">
        <button type="button" id="billingCancelBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Cancel</button>
        <button type="submit" id="billingSubmitBtn" class="rounded-xl bg-amber-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">send</span> Issue Bill &amp; Send Email
        </button>
      </div>
    </form>

    <!-- Result panel (hidden until bill is issued) -->
    <div id="billingResult" class="hidden"></div>
  `;

  const goBack = () => {
    maintenanceUiState.mode = 'detail';
    rerender();
  };
  host.querySelector('#billingBackBtn')?.addEventListener('click', goBack);
  host.querySelector('#billingCancelBtn')?.addEventListener('click', goBack);

  host.querySelector('#billingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const val = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

    const customerName  = val('customerName');
    const customerEmail = val('customerEmail');
    const rawAmount     = parseFloat(val('amount'));
    const reason        = val('reason');
    const bookingRef    = val('bookingRef');
    const notes         = val('notes');

    if (!customerName)  { notify('Customer name is required', 'error'); return; }
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      notify('A valid customer email is required', 'error'); return;
    }
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      notify('Amount must be a positive number', 'error'); return;
    }
    if (!reason) { notify('Reason is required', 'error'); return; }

    const submitBtn = host.querySelector('#billingSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Issuing…'; }

    try {
      if (!window.SupabaseClient || !window.SupabaseClient.isConfigured()) {
        throw new Error('Supabase client is not configured.');
      }
      const client = await window.SupabaseClient.init();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) throw new Error('Not authenticated. Please sign in again.');

      const supabaseUrl =
        (window.SupabaseRuntime && window.SupabaseRuntime.config && window.SupabaseRuntime.config.url)
        || (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url)
        || '';

      const fnUrl = supabaseUrl
        ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/damage-billing`
        : '/functions/v1/damage-billing';

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action:          'initiate',
          maintenanceRef:  rec.id,
          maintenanceId:   rec.dbId || '',
          customerName,
          customerEmail,
          amount:          rawAmount,
          reason,
          bookingRef:      bookingRef || '',
          notes:           notes || '',
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Server error ${res.status}`);
      }

      // Update local state
      const idx = data.maintenance.findIndex((r) => r.id === rec.id);
      if (idx >= 0) data.maintenance[idx].status = 'Billed';

      // Show success result panel
      const resultEl = host.querySelector('#billingResult');
      host.querySelector('#billingForm').classList.add('hidden');
      if (resultEl) {
        resultEl.className = 'rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-400/30 dark:bg-emerald-500/10 space-y-3';
        resultEl.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-emerald-600 dark:text-emerald-300 text-3xl">check_circle</span>
            <div>
              <p class="font-bold text-emerald-800 dark:text-emerald-200 text-base">Bill issued successfully</p>
              <p class="text-emerald-700 dark:text-emerald-300 text-sm">Invoice ${escapeHtml(json.billCode)} has been created and a payment link emailed to ${escapeHtml(customerEmail)}.</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border border-emerald-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
              <p class="text-xs text-slate-500 dark:text-slate-400">Invoice</p>
              <p class="font-bold text-slate-900 dark:text-white">${escapeHtml(json.billCode)}</p>
            </div>
            <div class="rounded-xl border border-emerald-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
              <p class="text-xs text-slate-500 dark:text-slate-400">Amount</p>
              <p class="font-bold text-slate-900 dark:text-white">NPR ${Number(json.amount || rawAmount).toLocaleString()}</p>
            </div>
            <div class="rounded-xl border border-emerald-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
              <p class="text-xs text-slate-500 dark:text-slate-400">Customer</p>
              <p class="font-bold text-slate-900 dark:text-white">${escapeHtml(customerEmail)}</p>
            </div>
            <div class="rounded-xl border border-emerald-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
              <p class="text-xs text-slate-500 dark:text-slate-400">Due (72 hrs)</p>
              <p class="font-bold text-slate-900 dark:text-white">${escapeHtml(json.dueAt ? new Date(json.dueAt).toLocaleString() : '—')}</p>
            </div>
          </div>
          <button id="billingDoneBtn" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Back to Record</button>
        `;
        resultEl.querySelector('#billingDoneBtn')?.addEventListener('click', () => {
          maintenanceUiState.mode = 'detail';
          rerender();
        });
      }

      notify(`Bill ${json.billCode} issued. Payment email sent to ${customerEmail}.`, 'success');

    } catch (err) {
      notify(`Billing failed: ${err.message}`, 'error');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span class="material-symbols-outlined mr-1 text-[16px] align-middle">send</span> Issue Bill &amp; Send Email'; }
    }
  });
}
