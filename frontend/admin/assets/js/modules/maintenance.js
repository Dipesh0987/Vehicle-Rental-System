import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';
import { openModal, renderEmptyState } from '../ui.js';

const STATUS_OPTIONS = ['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const SERVICE_TYPES  = ['Damage', 'Scheduled Service', 'Inspection', 'Repair'];

const maintenanceUiState = {
  selectedId: '',
  statusFilter: 'All',
  page: 1,
  mode: 'list', // list | detail | add | edit
};

export function renderMaintenanceModule({ data, query, notify, rerender }) {
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

  if (maintenanceUiState.mode === 'add' || maintenanceUiState.mode === 'edit') {
    const editRecord = maintenanceUiState.mode === 'edit'
      ? sourceRows.find((r) => r.id === maintenanceUiState.selectedId)
      : null;
    renderMaintenanceForm(host, editRecord, data, notify, rerender);
    return host;
  }

  // ── List View ──────────────────────────────────────────────
  let filtered = filterRows(sourceRows, query, ['id', 'vehicle', 'damage', 'status', 'serviceType', 'technician']);
  if (maintenanceUiState.statusFilter !== 'All') {
    filtered = filtered.filter((r) => r.status === maintenanceUiState.statusFilter);
  }

  const paged = paginateRows(filtered, maintenanceUiState.page, 8);

  // live summary counts from full source (not filtered)
  const scheduled   = sourceRows.filter((r) => r.status === 'Scheduled').length;
  const inProgress  = sourceRows.filter((r) => r.status === 'In Progress').length;
  const completed   = sourceRows.filter((r) => r.status === 'Completed').length;
  const damageOpen  = sourceRows.filter((r) => r.serviceType === 'Damage' && r.status !== 'Completed' && r.status !== 'Cancelled').length;

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quality</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">Maintenance &amp; Damage</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button id="addMaintenanceBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">add</span> Schedule Service
        </button>
        <button id="reportDamageBtn" class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">car_crash</span> Report Damage
        </button>
      </div>
    </header>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${summaryCard('Scheduled', scheduled, 'amber')}
      ${summaryCard('In Progress', inProgress, 'blue')}
      ${summaryCard('Completed', completed, 'emerald')}
      ${summaryCard('Damage Open', damageOpen, 'rose')}
    </div>

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
          title: 'No records found',
          message: maintenanceUiState.statusFilter !== 'All' ? 'Try a different status filter.' : 'No maintenance records yet.',
          actionLabel: 'Schedule Service',
          actionId: 'emptyAddBtn',
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

  host.querySelector('#addMaintenanceBtn')?.addEventListener('click', openAdd);
  host.querySelector('#emptyAddBtn')?.addEventListener('click', openAdd);
  host.querySelector('#reportDamageBtn')?.addEventListener('click', () => {
    maintenanceUiState.mode = 'add';
    maintenanceUiState.selectedId = '';
    rerender();
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
      <div class="ml-auto flex gap-2">
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
        ${detailField('Vehicle ID', rec.vehicleId || '-')}
        ${detailField('Service Type', rec.serviceType || '-')}
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
            ${['Scheduled','In Progress','Completed','Cancelled'].map((s) =>
              `<button data-set-status="${s}" class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                rec.status === s
                  ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
              }">${s}</button>`
            ).join('')}
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
    </div>
  `;

  host.querySelector('#maintBackBtn')?.addEventListener('click', () => {
    maintenanceUiState.mode = 'list';
    maintenanceUiState.selectedId = '';
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
  for (const v of vehicles) { vehicleMap[v.name || v.id] = v.id; }
  const scheduledMinAttr = isEdit ? '' : `min="${todayStr}"`;
  const completedMinAttr = r.schedule ? `min="${r.schedule}"` : '';

  host.innerHTML = `
    <header class="flex flex-wrap items-center gap-3">
      <button id="formBackBtn" class="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quality</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">${isEdit ? 'Edit Record' : 'New Maintenance / Damage Record'}</h2>
      </div>
    </header>

    <form id="maintForm" class="grid grid-cols-1 gap-4 md:grid-cols-2" novalidate>
      <!-- Vehicle & Service -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Vehicle &amp; Service</h3>
        ${formField('Maintenance ID', 'maintId', 'text', r.id, true, 'e.g. M-305')}
        ${vehicleComboField(vehicles, r.vehicle, r.vehicleId)}
        ${formSelect('Service Type', 'serviceType', SERVICE_TYPES, r.serviceType || 'Damage')}
        ${formTextarea('Damage / Service Description', 'damage', r.damage, true, 'Describe the issue or service required')}
      </section>

      <!-- Schedule & Status -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Schedule &amp; Status</h3>
        ${formField('Scheduled Date', 'schedule', 'date', r.schedule, true, '', scheduledMinAttr)}
        ${formSelect('Status', 'status', STATUS_OPTIONS.filter((s) => s !== 'All'), r.status || 'Scheduled')}
        ${formField('Completed Date', 'completedAt', 'date', r.completedAt, false, '', completedMinAttr)}
        ${formField('Technician', 'technician', 'text', r.technician, false, 'Technician name')}
        ${formField('Reported By', 'reportedBy', 'text', r.reportedBy, false, 'Admin / Driver ID')}
        ${formField('Cost Estimate (NPR)', 'costEstimate', 'number', r.costEstimate, false, '0')}
        ${formTextarea('Notes', 'notes', r.notes, false, 'Additional remarks')}
      </section>

      <!-- Actions -->
      <div class="md:col-span-2 flex justify-end gap-2">
        <button type="button" id="formCancelBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Cancel</button>
        <button type="submit" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          ${isEdit ? 'Save Changes' : 'Create Record'}
        </button>
      </div>
    </form>
  `;

  // Wire up vehicle name → auto-fill vehicle ID
  const vehicleInput = host.querySelector('[name="vehicle"]');
  const vehicleIdInput = host.querySelector('[name="vehicleId"]');
  if (vehicleInput && vehicleIdInput) {
    vehicleInput.addEventListener('input', () => {
      const match = vehicleMap[vehicleInput.value];
      if (match) vehicleIdInput.value = match;
    });
  }

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

  host.querySelector('#maintForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const val = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

    const maintId   = val('maintId');
    const vehicle   = val('vehicle');
    const damage    = val('damage');
    const schedule  = val('schedule');

    if (!maintId || !vehicle || !damage || !schedule) {
      notify('Please fill all required fields (marked *)', 'error');
      return;
    }

    // Schedule must not be in the past for new records
    if (!isEdit && schedule < new Date().toISOString().slice(0, 10)) {
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
      id: maintId,
      vehicle,
      vehicleId: val('vehicleId'),
      schedule,
      serviceType: val('serviceType'),
      damage,
      status: val('status'),
      costEstimate: isNaN(costRaw) ? 0 : costRaw,
      technician: val('technician'),
      reportedBy: val('reportedBy'),
      completedAt,
      notes: val('notes'),
    };

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
function summaryCard(label, count, color) {
  const colors = {
    amber:   'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    blue:    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose:    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  };
  return `<article class="rounded-2xl border p-4 ${colors[color] || colors.amber}">
    <p class="text-xs font-bold uppercase tracking-[0.14em] opacity-70">${label}</p>
    <p class="mt-2 text-3xl font-extrabold">${count}</p>
  </article>`;
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
        ${vehicles.map((v) => `<option value="${escapeHtml(v.name || v.id)}">${escapeHtml(v.id)}</option>`).join('')}
      </datalist>
    </div>
    <div>
      <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle ID <span class="text-xs font-normal text-slate-400">(auto-filled)</span></label>
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
    <select name="${name}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white">
      ${options.map((o) => `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
    </select>
  </div>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Completed')  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'In Progress') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (status === 'Cancelled')  return `${base} bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}
