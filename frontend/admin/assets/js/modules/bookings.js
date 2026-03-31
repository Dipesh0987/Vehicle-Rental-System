import { classMap } from '../config.js';
import { filterRows, sortRows } from '../table-utils.js';
import { renderEmptyState } from '../ui.js';

export function renderBookingsModule({ data, query, notify, reloadBookingsData }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const allRows = Array.isArray(data && data.bookings) ? data.bookings : [];
  const searchedRows = filterRows(allRows, query, ['id', 'customer', 'customerEmail', 'vehicle', 'type', 'status']);

  const dateFilter = '';
  const statusFilter = '';
  const typeFilter = '';

  const rows = applyAdminFilters(searchedRows, {
    date: dateFilter,
    status: statusFilter,
    type: typeFilter,
  });

  const sortedRows = sortRows(rows, 'start').slice().reverse();
  const totalRevenue = sortedRows.reduce((sum, row) => sum + Number(row && row.total ? row.total : 0), 0);
  const activeCount = sortedRows.filter((row) => String(row && row.status ? row.status : '').toLowerCase() === 'confirmed').length;
  const conflicts = detectConflicts(sortedRows);

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reservations</p>
        <h2 class="${classMap.heading}">Booking & Reservation Control</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          ${sortedRows.length} bookings | ${activeCount} active | $${Math.round(totalRevenue).toLocaleString()} revenue
        </div>
        <button id="refreshBookingsBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
      </div>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Filter by Date</span>
          <input id="bookingDate" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5" value="${escapeHtml(dateFilter)}" />
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Status</span>
          <select id="bookingStatus" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            ${['', 'Confirmed', 'Pending', 'Cancelled', 'Completed'].map((item) => `<option value="${escapeHtml(item)}" ${statusFilter === item ? 'selected' : ''}>${item || 'All'}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Vehicle Type</span>
          <select id="bookingType" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            ${buildTypeOptions(allRows, typeFilter).map((item) => `<option value="${escapeHtml(item)}" ${typeFilter === item ? 'selected' : ''}>${item || 'All'}</option>`).join('')}
          </select>
        </label>
        <button id="detectConflictBtn" class="self-end rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300">Detect Conflicts</button>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="mb-3 text-base font-extrabold">Reservation Table</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Booking</th>
              <th class="pb-2 pr-3">Customer</th>
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Date</th>
              <th class="pb-2 pr-3">Type</th>
              <th class="pb-2 pr-3">Status</th>
              <th class="pb-2 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRows.length
              ? sortedRows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3 font-bold">${escapeHtml(row.id || '-')}</td>
                  <td class="py-3 pr-3">
                    <p class="font-semibold">${escapeHtml(row.customer || '-')}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.customerEmail || '-')}</p>
                  </td>
                  <td class="py-3 pr-3">${escapeHtml(row.vehicle || '-')}</td>
                  <td class="py-3 pr-3">${escapeHtml(row.start || '-')} to ${escapeHtml(row.end || '-')}</td>
                  <td class="py-3 pr-3">${escapeHtml(row.type || '-')}</td>
                  <td class="py-3 pr-3"><span class="${statusClass(row.status)}">${escapeHtml(row.status || 'Confirmed')}</span></td>
                  <td class="py-3 pr-3 font-semibold">$${Number(row.total || 0).toFixed(2)}</td>
                </tr>`
              )
              .join('')
              : `<tr><td colspan="7" class="py-6">${renderEmptyState({ title: 'No reservations yet', message: 'Live bookings will appear here after successful customer checkout.', actionLabel: 'Refresh', actionId: 'emptyRefreshBookings' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Next 7-Day Occupancy</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
        ${buildOccupancyTiles(sortedRows)
          .map(
            (tile) => `<div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">${escapeHtml(tile.weekday)}</p>
              <p class="mt-2 text-sm font-semibold">${escapeHtml(tile.dateLabel)}</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${tile.count} booking${tile.count === 1 ? '' : 's'}</p>
            </div>`
          )
          .join('')}
      </div>
    </section>
  `;

  host.querySelector('#refreshBookingsBtn')?.addEventListener('click', async () => {
    if (typeof reloadBookingsData === 'function') {
      await reloadBookingsData();
    }
    notify('Bookings refreshed from database', 'success');
  });

  host.querySelector('#detectConflictBtn')?.addEventListener('click', () => {
    if (conflicts.length) {
      notify(`Conflict detected: ${conflicts[0]}`, 'error');
      return;
    }
    notify('No booking conflict detected', 'success');
  });

  host.querySelector('#emptyRefreshBookings')?.addEventListener('click', async () => {
    if (typeof reloadBookingsData === 'function') {
      await reloadBookingsData();
    }
    notify('Bookings refreshed from database', 'success');
  });

  const dateInput = host.querySelector('#bookingDate');
  const statusSelect = host.querySelector('#bookingStatus');
  const typeSelect = host.querySelector('#bookingType');

  [dateInput, statusSelect, typeSelect].forEach((control) => {
    control?.addEventListener('input', () => {
      const nextRows = applyAdminFilters(searchedRows, {
        date: dateInput ? dateInput.value : '',
        status: statusSelect ? statusSelect.value : '',
        type: typeSelect ? typeSelect.value : '',
      });

      updateTableRows(host, nextRows);
    });
  });

  return host;
}

function detectConflicts(rows) {
  const grouped = new Map();
  const conflicts = [];
  const conflictEligible = new Set(['confirmed', 'pending']);

  rows.forEach((row) => {
    const status = String(row && row.status ? row.status : '').trim().toLowerCase();
    if (!conflictEligible.has(status)) {
      return;
    }

    const vehicleKey = String(row && row.vehicleId ? row.vehicleId : row && row.vehicle ? row.vehicle : '').trim();
    if (!vehicleKey) {
      return;
    }

    if (!grouped.has(vehicleKey)) {
      grouped.set(vehicleKey, []);
    }

    grouped.get(vehicleKey).push(row);
  });

  grouped.forEach((vehicleRows) => {
    const ordered = vehicleRows
      .slice()
      .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];

      if (String(current.start || '') <= String(previous.end || '')) {
        conflicts.push(`${current.id} overlaps with ${previous.id} on ${current.vehicle}`);
      }
    }
  });

  return conflicts;
}

function applyAdminFilters(rows, filters) {
  const source = Array.isArray(rows) ? rows : [];
  const date = String(filters && filters.date ? filters.date : '').trim();
  const status = String(filters && filters.status ? filters.status : '').trim().toLowerCase();
  const type = String(filters && filters.type ? filters.type : '').trim().toLowerCase();

  return source.filter((row) => {
    const rowStatus = String(row && row.status ? row.status : '').toLowerCase();
    const rowType = String(row && row.type ? row.type : '').toLowerCase();
    const rowStart = String(row && row.start ? row.start : '');
    const rowEnd = String(row && row.end ? row.end : '');

    if (status && rowStatus !== status) {
      return false;
    }

    if (type && rowType !== type) {
      return false;
    }

    if (date && !(rowStart <= date && rowEnd >= date)) {
      return false;
    }

    return true;
  });
}

function updateTableRows(host, rows) {
  const target = host.querySelector('tbody');
  if (!target) {
    return;
  }

  const source = sortRows(rows || [], 'start').slice().reverse();
  if (!source.length) {
    target.innerHTML = `<tr><td colspan="7" class="py-6">${renderEmptyState({ title: 'No reservations match', message: 'Adjust filter values to show bookings from your database.', actionLabel: 'Refresh', actionId: 'emptyRefreshBookings' })}</td></tr>`;
    return;
  }

  target.innerHTML = source
    .map(
      (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
        <td class="py-3 pr-3 font-bold">${escapeHtml(row.id || '-')}</td>
        <td class="py-3 pr-3">
          <p class="font-semibold">${escapeHtml(row.customer || '-')}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.customerEmail || '-')}</p>
        </td>
        <td class="py-3 pr-3">${escapeHtml(row.vehicle || '-')}</td>
        <td class="py-3 pr-3">${escapeHtml(row.start || '-')} to ${escapeHtml(row.end || '-')}</td>
        <td class="py-3 pr-3">${escapeHtml(row.type || '-')}</td>
        <td class="py-3 pr-3"><span class="${statusClass(row.status)}">${escapeHtml(row.status || 'Confirmed')}</span></td>
        <td class="py-3 pr-3 font-semibold">$${Number(row.total || 0).toFixed(2)}</td>
      </tr>`
    )
    .join('');
}

function buildTypeOptions(rows, selectedType) {
  const values = new Set(['']);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const type = String(row && row.type ? row.type : '').trim();
    if (type) {
      values.add(type);
    }
  });

  const options = Array.from(values);
  options.sort((a, b) => a.localeCompare(b));

  if (selectedType && !options.includes(selectedType)) {
    options.push(selectedType);
  }

  return options;
}

function buildOccupancyTiles(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const today = new Date();
  const tiles = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const count = source.filter((row) => {
      const start = String(row && row.start ? row.start : '');
      const end = String(row && row.end ? row.end : '');
      return start && end && start <= isoDate && end >= isoDate;
    }).length;

    tiles.push({
      weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count,
    });
  }

  return tiles;
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
  if (status === 'Confirmed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'Ongoing') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (status === 'Pending') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (status === 'Completed') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-200`;
  return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
}
