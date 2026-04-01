import { classMap } from '../config.js';
import { filterRows, sortRows } from '../table-utils.js';
import { renderEmptyState } from '../ui.js';

const BOOKING_STATUS_OPTIONS = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];

export function renderBookingsModule({ data, query, notify, reloadBookingsData, bookingService }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const allRows = Array.isArray(data && data.bookings) ? data.bookings : [];
  const searchedRows = filterRows(allRows, query, ['id', 'customer', 'customerEmail', 'customerPhone', 'vehicle', 'type', 'status', 'pickupLocation']);

  const dateFilter = '';
  const statusFilter = '';
  const typeFilter = '';

  const rows = applyAdminFilters(searchedRows, {
    date: dateFilter,
    status: statusFilter,
    type: typeFilter,
  });

  const sortedRows = sortRows(rows, 'createdAt').slice().reverse();
  const totalRevenue = sortedRows.reduce((sum, row) => sum + Number(row && row.total ? row.total : 0), 0);
  const activeCount = sortedRows.filter((row) => String(row && row.status ? row.status : '').toLowerCase() === 'confirmed').length;

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
            ${[''].concat(BOOKING_STATUS_OPTIONS).map((item) => `<option value="${escapeHtml(item)}" ${statusFilter === item ? 'selected' : ''}>${item || 'All'}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Vehicle Type</span>
          <select id="bookingType" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            ${buildTypeOptions(allRows, typeFilter).map((item) => `<option value="${escapeHtml(item)}" ${typeFilter === item ? 'selected' : ''}>${item || 'All'}</option>`).join('')}
          </select>
        </label>
        <button id="clearBookingFiltersBtn" class="hidden self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Clear Filters</button>
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
              <th class="pb-2 pr-3">Pick Up Location</th>
              <th class="pb-2 pr-3">Date From</th>
              <th class="pb-2 pr-3">Date To</th>
              <th class="pb-2 pr-3">Type</th>
              <th class="pb-2 pr-3">Status</th>
              <th class="pb-2 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRows.length
              ? sortedRows
              .map((row) => renderBookingRow(row))
              .join('')
              : `<tr><td colspan="9" class="py-6">${renderEmptyState({ title: 'No reservations yet', message: 'Live bookings will appear here after successful customer checkout.', actionLabel: 'Refresh', actionId: 'emptyRefreshBookings' })}</td></tr>`}
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

  host.querySelector('#emptyRefreshBookings')?.addEventListener('click', async () => {
    if (typeof reloadBookingsData === 'function') {
      await reloadBookingsData();
    }
    notify('Bookings refreshed from database', 'success');
  });

  host.addEventListener('change', async (event) => {
    const selectElement = event.target && event.target.closest('[data-booking-status-select]');
    if (!selectElement || !host.contains(selectElement)) {
      return;
    }

    const rowElement = selectElement.closest('tr[data-booking-id]');
    const previousStatus = normalizeBookingStatusLabel(
      rowElement ? rowElement.getAttribute('data-current-status') : ''
    );

    const bookingId = String(rowElement && rowElement.getAttribute('data-booking-id') ? rowElement.getAttribute('data-booking-id') : '').trim();
    const bookingCode = String(rowElement && rowElement.getAttribute('data-booking-code') ? rowElement.getAttribute('data-booking-code') : '').trim();
    const nextStatus = normalizeBookingStatusLabel(selectElement ? selectElement.value : '');

    if (!bookingId) {
      notify('Booking id is missing for this reservation row.', 'error');
      return;
    }

    if (previousStatus === nextStatus) {
      return;
    }

    if (!bookingService || typeof bookingService.updateBookingStatus !== 'function') {
      notify('Booking status update service is unavailable. Run latest booking migration first.', 'error');
      selectElement.value = previousStatus;
      selectElement.className = statusSelectClass(previousStatus, !bookingId);
      return;
    }

    selectElement.disabled = true;
    selectElement.className = statusSelectClass(nextStatus, !bookingId);

    try {
      const updatedBooking = await bookingService.updateBookingStatus({
        bookingId,
        status: nextStatus,
      });

      const updatedStatus = normalizeBookingStatusLabel(
        updatedBooking && updatedBooking.statusLabel ? updatedBooking.statusLabel : nextStatus
      );

      if (rowElement) {
        rowElement.setAttribute('data-current-status', updatedStatus);
      }

      selectElement.value = updatedStatus;
      selectElement.className = statusSelectClass(updatedStatus, !bookingId);

      notify(`Reservation ${bookingCode || bookingId} marked as ${updatedStatus}.`, 'success');

      if (typeof reloadBookingsData === 'function') {
        await reloadBookingsData();
      }
    } catch (error) {
      const message = bookingService && typeof bookingService.toPublicError === 'function'
        ? bookingService.toPublicError(error, 'Unable to update booking status right now.')
        : 'Unable to update booking status right now.';

      selectElement.value = previousStatus;
      selectElement.className = statusSelectClass(previousStatus, !bookingId);

      notify(message, 'error');
    } finally {
      if (host.isConnected) {
        selectElement.disabled = !bookingId;
        selectElement.className = statusSelectClass(selectElement.value, !bookingId);
      }
    }
  });

  const dateInput = host.querySelector('#bookingDate');
  const statusSelect = host.querySelector('#bookingStatus');
  const typeSelect = host.querySelector('#bookingType');
  const clearFiltersBtn = host.querySelector('#clearBookingFiltersBtn');

  const readFilters = () => ({
    date: dateInput ? dateInput.value : '',
    status: statusSelect ? statusSelect.value : '',
    type: typeSelect ? typeSelect.value : '',
  });

  const hasActiveFilters = (filters) => {
    const current = filters || {};
    return Boolean(String(current.date || '').trim() || String(current.status || '').trim() || String(current.type || '').trim());
  };

  const applyFiltersToTable = () => {
    const filters = readFilters();
    const nextRows = applyAdminFilters(searchedRows, filters);
    updateTableRows(host, nextRows);
    toggleClearFiltersButton(clearFiltersBtn, hasActiveFilters(filters));
  };

  [dateInput, statusSelect, typeSelect].forEach((control) => {
    control?.addEventListener('input', applyFiltersToTable);
    control?.addEventListener('change', applyFiltersToTable);
  });

  clearFiltersBtn?.addEventListener('click', () => {
    if (dateInput) dateInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    applyFiltersToTable();
  });

  toggleClearFiltersButton(clearFiltersBtn, false);

  return host;
}

function toggleClearFiltersButton(button, isVisible) {
  if (!button) {
    return;
  }

  button.classList.toggle('hidden', !isVisible);
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

  const source = sortRows(rows || [], 'createdAt').slice().reverse();
  if (!source.length) {
    target.innerHTML = `<tr><td colspan="9" class="py-6">${renderEmptyState({ title: 'No reservations match', message: 'Adjust filter values to show bookings from your database.', actionLabel: 'Refresh', actionId: 'emptyRefreshBookings' })}</td></tr>`;
    return;
  }

  target.innerHTML = source
    .map((row) => renderBookingRow(row))
    .join('');
}

function normalizeBookingStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'confirmed') return 'Confirmed';
  if (normalized === 'cancelled') return 'Cancelled';
  if (normalized === 'completed') return 'Completed';
  return 'Confirmed';
}

function statusOptionMarkup(currentStatus) {
  const selectedStatus = normalizeBookingStatusLabel(currentStatus);
  return BOOKING_STATUS_OPTIONS.map((status) => `<option value="${status}" style="${statusOptionStyle(status)}" ${status === selectedStatus ? 'selected' : ''}>${status}</option>`).join('');
}

function renderBookingRow(row) {
  const bookingId = String(row && row.bookingId ? row.bookingId : '').trim();
  const bookingCode = String(row && row.id ? row.id : '').trim();
  const currentStatus = normalizeBookingStatusLabel(row && row.status ? row.status : 'Confirmed');
  const isDisabled = !bookingId;
  const disabledState = isDisabled ? 'disabled' : '';

  return `<tr class="border-b border-slate-100 dark:border-white/5" data-booking-id="${escapeHtml(bookingId)}" data-booking-code="${escapeHtml(bookingCode)}" data-current-status="${escapeHtml(currentStatus)}">
    <td class="py-3 pr-3 font-bold">${escapeHtml(row.id || '-')}</td>
    <td class="py-3 pr-3">
      <p class="font-semibold">${escapeHtml(row.customer || '-')}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.customerEmail || '-')}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.customerPhone || '-')}</p>
    </td>
    <td class="py-3 pr-3">${escapeHtml(row.vehicle || '-')}</td>
    <td class="py-3 pr-3">${escapeHtml(row.pickupLocation || '-')}</td>
    <td class="py-3 pr-3">${escapeHtml(row.start || '-')}</td>
    <td class="py-3 pr-3">${escapeHtml(row.end || '-')}</td>
    <td class="py-3 pr-3">${escapeHtml(row.type || '-')}</td>
    <td class="py-3 pr-3">
      <select data-booking-status-select ${disabledState} class="${statusSelectClass(currentStatus, isDisabled)}">
        ${statusOptionMarkup(currentStatus)}
      </select>
    </td>
    <td class="py-3 pr-3 font-semibold">$${Number(row.total || 0).toFixed(2)}</td>
  </tr>`;
}

function statusOptionStyle(status) {
  if (status === 'Confirmed') return 'background-color:#dcfce7;color:#166534;';
  if (status === 'Pending') return 'background-color:#fef3c7;color:#92400e;';
  if (status === 'Cancelled') return 'background-color:#ffe4e6;color:#be123c;';
  if (status === 'Completed') return 'background-color:#e2e8f0;color:#334155;';
  return 'background-color:#ffffff;color:#334155;';
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

function statusSelectClass(status, isDisabled) {
  const normalized = normalizeBookingStatusLabel(status);
  const base = 'w-[140px] rounded-lg border px-2 py-1 text-xs font-semibold outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60';
  const disabled = isDisabled ? ' opacity-60' : '';

  if (normalized === 'Confirmed') return `${base} border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200${disabled}`;
  if (normalized === 'Pending') return `${base} border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200${disabled}`;
  if (normalized === 'Cancelled') return `${base} border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-200${disabled}`;
  if (normalized === 'Completed') return `${base} border-slate-300 bg-slate-200 text-slate-800 dark:border-slate-400/30 dark:bg-slate-500/25 dark:text-slate-200${disabled}`;
  return `${base} border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200${disabled}`;
}
