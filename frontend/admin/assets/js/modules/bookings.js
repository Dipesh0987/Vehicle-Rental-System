import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination, sortRows } from '../table-utils.js';
import { openDrawer, openModal, renderEmptyState } from '../ui.js';

const BOOKING_STATUS_OPTIONS = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];
const PAYMENT_FILTER_OPTIONS = ['', 'Yes', 'No'];
const COLUMN_STORAGE_KEY = 'vrs-admin-booking-visible-columns';
const bookingUiState = {
  page: 1,
  pageSize: 8,
  selectedBookingId: '',
};
const BOOKING_TABLE_COLUMNS = [
  { key: 'booking', label: 'Booking' },
  { key: 'customer', label: 'Customer' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'pickupLocation', label: 'Pick Up Location' },
  { key: 'start', label: 'Date From' },
  { key: 'end', label: 'Date To' },
  { key: 'type', label: 'Type' },
  { key: 'driverOption', label: 'Driver Option' },
  { key: 'status', label: 'Status' },
  { key: 'payment', label: 'Paid' },
  { key: 'total', label: 'Total' },
  { key: 'actions', label: 'Action' },
];

export function renderBookingsModule({ data, query, notify, reloadBookingsData, bookingService, rerender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const sourceRows = Array.isArray(data && data.bookings) ? data.bookings : [];
  const selectedBooking = resolveSelectedBooking(sourceRows);
  const dateFilter = '';
  const statusFilter = '';
  const typeFilter = '';
  const paymentFilter = '';
  let visibleColumns = loadVisibleColumns();

  const getSearchedRows = () => filterRows(
    sourceRows,
    query,
    ['id', 'customer', 'customerEmail', 'customerPhone', 'vehicle', 'type', 'driverOption', 'status', 'pickupLocation', 'paymentLabel']
  );

  const initialRows = applyAdminFilters(getSearchedRows(), {
    date: dateFilter,
    status: statusFilter,
    type: typeFilter,
    payment: paymentFilter,
  });

  const initialSortedRows = sortRows(initialRows, 'createdAt').slice().reverse();
  const initialPaged = paginateRows(initialSortedRows, bookingUiState.page, bookingUiState.pageSize);
  bookingUiState.page = initialPaged.page;
  const totalRevenue = initialSortedRows.reduce((sum, row) => sum + Number(row && row.total ? row.total : 0), 0);
  const activeCount = initialSortedRows.filter((row) => String(row && row.status ? row.status : '').toLowerCase() === 'confirmed').length;

  host.innerHTML = `
    ${selectedBooking ? renderBookingDetailPage(selectedBooking) : `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reservations</p>
        <h2 class="${classMap.heading}">Booking & Reservation Control</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          ${initialSortedRows.length} bookings | ${activeCount} active | ${escapeHtml(formatNpr(totalRevenue))} revenue
        </div>
        <button id="toggleBookingColumnsBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Columns</button>
        <button id="refreshBookingsBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
      </div>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-5">
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
            ${buildTypeOptions(getSearchedRows(), typeFilter).map((item) => `<option value="${escapeHtml(item)}" ${typeFilter === item ? 'selected' : ''}>${item || 'All'}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Paid</span>
          <select id="bookingPayment" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            ${PAYMENT_FILTER_OPTIONS.map((item) => `<option value="${escapeHtml(item)}" ${paymentFilter === item ? 'selected' : ''}>${item || 'All'}</option>`).join('')}
          </select>
        </label>
        <button id="clearBookingFiltersBtn" class="hidden self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Clear Filters</button>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5 relative">
      <h3 class="mb-3 text-base font-extrabold">Reservation Table</h3>
      <div id="bookingUserMessageTop" class="booking-user-message-top mb-3 hidden rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"></div>

      <div id="bookingColumnPanel" class="hidden absolute right-4 top-4 z-10 w-[250px] rounded-xl border border-slate-200 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-[#11181d]"></div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              ${BOOKING_TABLE_COLUMNS.map((column) => `<th data-col="${column.key}" class="pb-2 pr-3">${column.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="bookingRowsBody">
            ${renderTableBody(initialPaged.rows, visibleColumns, initialSortedRows.length)}
          </tbody>
        </table>
      </div>
      <div id="bookingPager" class="mt-3"></div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Next 7-Day Occupancy</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
        ${buildOccupancyTiles(initialSortedRows)
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
    `}
  `;

  const rowsBody = host.querySelector('#bookingRowsBody');
  const dateInput = host.querySelector('#bookingDate');
  const statusSelect = host.querySelector('#bookingStatus');
  const typeSelect = host.querySelector('#bookingType');
  const paymentSelect = host.querySelector('#bookingPayment');
  const clearFiltersBtn = host.querySelector('#clearBookingFiltersBtn');
  const columnPanel = host.querySelector('#bookingColumnPanel');
  const pagerHost = host.querySelector('#bookingPager');
  const userMessageTop = host.querySelector('#bookingUserMessageTop');

  host.querySelector('[data-back-to-bookings-list]')?.addEventListener('click', () => {
    bookingUiState.selectedBookingId = '';
    writeBookingIdToHash('');
    rerender?.();
  });

  function getFilteredSortedRows() {
    return sortRows(applyAdminFilters(getSearchedRows(), readFilters()), 'createdAt').slice().reverse();
  }

  function renderPager(totalRows) {
    if (!pagerHost) {
      return;
    }

    pagerHost.replaceChildren();
    const paged = paginateRows(totalRows || [], bookingUiState.page, bookingUiState.pageSize);
    bookingUiState.page = paged.page;
    pagerHost.appendChild(renderPagination(paged, (nextPage) => {
      bookingUiState.page = nextPage;
      applyFiltersToTable();
      const tablePanel = host.querySelector('#bookingRowsBody');
      tablePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function renderColumnPanel() {
    if (!columnPanel) {
      return;
    }

    columnPanel.innerHTML = `
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Toggle Columns</p>
      <div class="space-y-2">
        ${BOOKING_TABLE_COLUMNS.map((column) => `
          <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <input type="checkbox" class="h-4 w-4" data-column-toggle="${column.key}" ${visibleColumns.has(column.key) ? 'checked' : ''} />
            <span>${column.label}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  function readFilters() {
    return {
      date: dateInput ? dateInput.value : '',
      status: statusSelect ? statusSelect.value : '',
      type: typeSelect ? typeSelect.value : '',
      payment: paymentSelect ? paymentSelect.value : '',
    };
  }

  function hasActiveFilters(filters) {
    const current = filters || {};
    return Boolean(
      String(current.date || '').trim() ||
      String(current.status || '').trim() ||
      String(current.type || '').trim() ||
      String(current.payment || '').trim()
    );
  }

  function applyFiltersToTable() {
    const sorted = getFilteredSortedRows();
    const paged = paginateRows(sorted, bookingUiState.page, bookingUiState.pageSize);
    bookingUiState.page = paged.page;

    if (rowsBody) {
      rowsBody.innerHTML = renderTableBody(paged.rows, visibleColumns, sorted.length);
    }

    renderPager(sorted);
    applyColumnVisibility(host, visibleColumns);
    renderTopUserMessage(sorted);
    toggleClearFiltersButton(clearFiltersBtn, hasActiveFilters(readFilters()));
  }

  function renderTopUserMessage(rows) {
    if (!userMessageTop) {
      return;
    }

    const source = Array.isArray(rows) ? rows : [];
    const latestWithMessage = source.find((row) => String(row && row.userMessage ? row.userMessage : '').trim());

    if (!latestWithMessage) {
      userMessageTop.classList.add('hidden');
      userMessageTop.textContent = '';
      return;
    }

    const bookingId = String(latestWithMessage.bookingId || latestWithMessage.id || '').trim();
    userMessageTop.innerHTML = `<strong class="booking-user-message-label cursor-pointer hover:underline" data-open-booking-from-message="${escapeHtml(bookingId)}">User Message (${escapeHtml(latestWithMessage.id || latestWithMessage.bookingId || '-')})</strong><span class="booking-user-message-value">: ${escapeHtml(latestWithMessage.userMessage)}</span>`;
    userMessageTop.classList.remove('hidden');
  }

  async function refreshRowsFromDatabase(successMessage) {
    if (typeof reloadBookingsData === 'function') {
      await reloadBookingsData();
    }

    applyFiltersToTable();
    if (successMessage) {
      notify(successMessage, 'success');
    }
  }

  host.querySelector('#refreshBookingsBtn')?.addEventListener('click', async () => {
    await refreshRowsFromDatabase('Bookings refreshed from database');
  });

  host.querySelector('#toggleBookingColumnsBtn')?.addEventListener('click', () => {
    renderColumnPanel();
    columnPanel?.classList.toggle('hidden');
  });

  host.addEventListener('change', async (event) => {
    const toggleInput = event.target && event.target.closest('[data-column-toggle]');
    if (toggleInput) {
      const key = toggleInput.getAttribute('data-column-toggle');
      if (toggleInput.checked) {
        visibleColumns.add(key);
      } else if (visibleColumns.size > 1) {
        visibleColumns.delete(key);
      } else {
        toggleInput.checked = true;
      }

      saveVisibleColumns(visibleColumns);
      applyColumnVisibility(host, visibleColumns);
      if (rowsBody) {
        const rows = getFilteredSortedRows();
        const paged = paginateRows(rows, bookingUiState.page, bookingUiState.pageSize);
        bookingUiState.page = paged.page;
        rowsBody.innerHTML = renderTableBody(paged.rows, visibleColumns, rows.length);
      }
      renderPager(getFilteredSortedRows());
      return;
    }

    const selectElement = event.target && event.target.closest('[data-booking-status-select]');
    if (selectElement) {
      const rowElement = selectElement.closest('tr[data-booking-id]');
      const previousStatus = normalizeBookingStatusLabel(rowElement ? rowElement.getAttribute('data-current-status') : '');
      const bookingId = String(rowElement && rowElement.getAttribute('data-booking-id') ? rowElement.getAttribute('data-booking-id') : '').trim();
      const bookingCode = String(rowElement && rowElement.getAttribute('data-booking-code') ? rowElement.getAttribute('data-booking-code') : '').trim();
      const nextStatus = normalizeBookingStatusLabel(selectElement.value);

      if (!bookingId || previousStatus === nextStatus) {
        return;
      }

      if (!bookingService || typeof bookingService.updateBookingStatus !== 'function') {
        notify('Booking status update service is unavailable.', 'error');
        selectElement.value = previousStatus;
        selectElement.className = statusSelectClass(previousStatus, false);
        return;
      }

      selectElement.disabled = true;
      try {
        await bookingService.updateBookingStatus({
          bookingId,
          status: nextStatus,
        });

        if (rowElement) {
          rowElement.setAttribute('data-current-status', nextStatus);
        }

        await refreshRowsFromDatabase(`Reservation ${bookingCode || bookingId} marked as ${nextStatus}.`);
      } catch (error) {
        const message = bookingService && typeof bookingService.toPublicError === 'function'
          ? bookingService.toPublicError(error, 'Unable to update booking status right now.')
          : 'Unable to update booking status right now.';
        notify(message, 'error');
        selectElement.value = previousStatus;
      } finally {
        if (host.isConnected) {
          selectElement.disabled = false;
        }
      }
      return;
    }

    const paymentSelectElement = event.target && event.target.closest('[data-booking-payment-select]');
    if (paymentSelectElement) {
      const rowElement = paymentSelectElement.closest('tr[data-booking-id]');
      const bookingId = String(rowElement && rowElement.getAttribute('data-booking-id') ? rowElement.getAttribute('data-booking-id') : '').trim();
      const bookingCode = String(rowElement && rowElement.getAttribute('data-booking-code') ? rowElement.getAttribute('data-booking-code') : '').trim();
      const previousValue = String(paymentSelectElement.getAttribute('data-current-payment') || 'no').toLowerCase();
      const nextValue = String(paymentSelectElement.value || 'no').toLowerCase();

      if (!bookingId || previousValue === nextValue) {
        return;
      }

      if (!bookingService || typeof bookingService.updateBookingByAdmin !== 'function') {
        notify('Booking payment update service is unavailable.', 'error');
        paymentSelectElement.value = previousValue;
        paymentSelectElement.className = paymentSelectClass(previousValue === 'yes', false);
        return;
      }

      const rows = getSearchedRows();
      const row = rows.find((item) => String(item && item.bookingId ? item.bookingId : '') === bookingId);
      if (!row) {
        notify('Booking row not found for payment update.', 'error');
        paymentSelectElement.value = previousValue;
        paymentSelectElement.className = paymentSelectClass(previousValue === 'yes', false);
        return;
      }

      paymentSelectElement.disabled = true;
      paymentSelectElement.className = paymentSelectClass(nextValue === 'yes', true);

      try {
        await bookingService.updateBookingByAdmin({
          bookingId,
          startDate: row.start,
          endDate: row.end,
          pickupTime: row.pickupTime || '10:00',
          driverOption: String(row.driverOption || 'Self Drive').toLowerCase().includes('with') ? 'with_driver' : 'self_drive',
          status: row.status,
          paymentDone: nextValue === 'yes',
          pickupLocation: row.pickupLocation,
          userMessage: row.userMessage,
        });

        paymentSelectElement.setAttribute('data-current-payment', nextValue);
        await refreshRowsFromDatabase(`Reservation ${bookingCode || bookingId} payment updated to ${nextValue === 'yes' ? 'Yes' : 'No'}.`);
      } catch (error) {
        const message = bookingService && typeof bookingService.toPublicError === 'function'
          ? bookingService.toPublicError(error, 'Unable to update booking payment right now.')
          : 'Unable to update booking payment right now.';
        notify(message, 'error');
        paymentSelectElement.value = previousValue;
        paymentSelectElement.setAttribute('data-current-payment', previousValue);
      } finally {
        if (host.isConnected) {
          const activeValue = String(paymentSelectElement.getAttribute('data-current-payment') || paymentSelectElement.value || 'no').toLowerCase();
          paymentSelectElement.className = paymentSelectClass(activeValue === 'yes', false);
          paymentSelectElement.disabled = false;
        }
      }
      return;
    }
  });

  host.addEventListener('click', (event) => {
    const target = event.target;
    if (!target) {
      return;
    }

    const messageLink = target.closest('[data-open-booking-from-message]');
    if (messageLink) {
      const bookingId = String(messageLink.getAttribute('data-open-booking-from-message') || '').trim();
      if (bookingId) {
        bookingUiState.selectedBookingId = bookingId;
        writeBookingIdToHash(bookingId);
        rerender?.();
      }
      return;
    }

    const openBookingButton = target.closest('[data-open-booking-id]');
    if (openBookingButton) {
      const bookingId = String(openBookingButton.getAttribute('data-open-booking-id') || '').trim();
      if (!bookingId) {
        return;
      }

      bookingUiState.selectedBookingId = bookingId;
      writeBookingIdToHash(bookingId);
      rerender?.();
      return;
    }

    if (target.id === 'emptyRefreshBookings') {
      void refreshRowsFromDatabase('Bookings refreshed from database');
      return;
    }

    const editButton = target.closest('[data-edit-booking-id]');
    if (editButton) {
      const bookingId = String(editButton.getAttribute('data-edit-booking-id') || '').trim();
      const rows = getSearchedRows();
      const row = rows.find((item) => String(item && item.bookingId ? item.bookingId : '') === bookingId);

      if (!row) {
        notify('Unable to open booking editor.', 'error');
        return;
      }

      openDrawer({
        title: `Edit ${escapeHtml(row.id || bookingId)}`,
        content: renderBookingEditDrawer(row),
      });

      const editForm = document.getElementById('editBookingForm');
      editForm?.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();

        if (!bookingService || typeof bookingService.updateBookingByAdmin !== 'function') {
          notify('Booking edit service is unavailable.', 'error');
          return;
        }

        const payload = {
          bookingId,
          startDate: document.getElementById('editBookingStartDate')?.value,
          endDate: document.getElementById('editBookingEndDate')?.value,
          pickupTime: document.getElementById('editBookingPickupTime')?.value,
          driverOption: document.getElementById('editBookingDriverOption')?.value,
          status: document.getElementById('editBookingStatus')?.value,
          paymentDone: document.getElementById('editBookingPaymentDone')?.value === 'yes',
          pickupLocation: document.getElementById('editBookingPickupLocation')?.value,
          userMessage: document.getElementById('editBookingUserMessage')?.value,
        };

        try {
          await bookingService.updateBookingByAdmin(payload);
          document.getElementById('overlayHost')?.replaceChildren();
          void refreshRowsFromDatabase(`Reservation ${row.id || bookingId} updated`);
        } catch (error) {
          const message = bookingService && typeof bookingService.toPublicError === 'function'
            ? bookingService.toPublicError(error, 'Unable to update reservation right now.')
            : 'Unable to update reservation right now.';
          notify(message, 'error');
        }
      });
      return;
    }

    const deleteButton = target.closest('[data-delete-booking-id]');
    if (deleteButton) {
      const bookingId = String(deleteButton.getAttribute('data-delete-booking-id') || '').trim();
      const bookingCode = String(deleteButton.getAttribute('data-delete-booking-code') || '').trim();

      openModal({
        title: 'Delete Reservation',
        content: `<p>Reservation <strong>${escapeHtml(bookingCode || bookingId)}</strong> will be permanently removed.</p>`,
        onConfirm: () => {
          if (!bookingService || typeof bookingService.deleteBookingByAdmin !== 'function') {
            notify('Booking delete service is unavailable.', 'error');
            return;
          }

          void (async () => {
            try {
              await bookingService.deleteBookingByAdmin({ bookingId });
              await refreshRowsFromDatabase(`Reservation ${bookingCode || bookingId} deleted`);
            } catch (error) {
              const message = bookingService && typeof bookingService.toPublicError === 'function'
                ? bookingService.toPublicError(error, 'Unable to delete reservation right now.')
                : 'Unable to delete reservation right now.';
              notify(message, 'error');
            }
          })();
        },
      });
      return;
    }
  });

  [dateInput, statusSelect, typeSelect, paymentSelect].forEach((control) => {
    control?.addEventListener('input', applyFiltersToTable);
    control?.addEventListener('change', applyFiltersToTable);
  });

  clearFiltersBtn?.addEventListener('click', () => {
    if (dateInput) dateInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    if (paymentSelect) paymentSelect.value = '';
    bookingUiState.page = 1;
    applyFiltersToTable();
  });

  [dateInput, statusSelect, typeSelect, paymentSelect].forEach((control) => {
    control?.addEventListener('input', () => {
      bookingUiState.page = 1;
    });
    control?.addEventListener('change', () => {
      bookingUiState.page = 1;
    });
  });

  toggleClearFiltersButton(clearFiltersBtn, false);
  renderColumnPanel();
  applyColumnVisibility(host, visibleColumns);
  renderTopUserMessage(initialSortedRows);
  renderPager(initialSortedRows);

  return host;
}

function renderBookingEditDrawer(row) {
  const currentStatus = normalizeBookingStatusLabel(row && row.status ? row.status : 'Confirmed');
  const driverOptionLabel = String(row && row.driverOption ? row.driverOption : 'Self Drive').toLowerCase();
  const driverOption = driverOptionLabel.includes('with') ? 'with_driver' : 'self_drive';
  const paymentDone = row && row.paymentDone ? 'yes' : 'no';

  return `
    <form id="editBookingForm" class="space-y-3">
      <label class="block space-y-1"><span class="text-xs font-semibold">Start Date</span><input id="editBookingStartDate" type="date" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${escapeHtml(row && row.start ? row.start : '')}" required /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">End Date</span><input id="editBookingEndDate" type="date" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${escapeHtml(row && row.end ? row.end : '')}" required /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Pickup Time</span><input id="editBookingPickupTime" type="time" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${escapeHtml(row && row.pickupTime ? row.pickupTime : '10:00')}" required /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Driver Option</span>
        <select id="editBookingDriverOption" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <option value="self_drive" ${driverOption === 'self_drive' ? 'selected' : ''}>Self Drive</option>
          <option value="with_driver" ${driverOption === 'with_driver' ? 'selected' : ''}>With Driver</option>
        </select>
      </label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Status</span>
        <select id="editBookingStatus" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          ${BOOKING_STATUS_OPTIONS.map((option) => `<option value="${option}" ${currentStatus === option ? 'selected' : ''}>${option}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Payment Done</span>
        <select id="editBookingPaymentDone" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <option value="yes" ${paymentDone === 'yes' ? 'selected' : ''}>Yes</option>
          <option value="no" ${paymentDone === 'no' ? 'selected' : ''}>No</option>
        </select>
      </label>
      <label class="block space-y-1"><span class="text-xs font-semibold">User Message</span><textarea id="editBookingUserMessage" rows="3" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">${escapeHtml(row && row.userMessage ? row.userMessage : '')}</textarea></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Pickup Location</span><textarea id="editBookingPickupLocation" rows="3" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">${escapeHtml(row && row.pickupLocation ? row.pickupLocation : '')}</textarea></label>
      <button type="submit" class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save Changes</button>
    </form>
  `;
}

function loadVisibleColumns() {
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) {
      return new Set(BOOKING_TABLE_COLUMNS.map((column) => column.key));
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return new Set(BOOKING_TABLE_COLUMNS.map((column) => column.key));
    }

    const allowedKeys = new Set(BOOKING_TABLE_COLUMNS.map((column) => column.key));
    return new Set(parsed.filter((key) => allowedKeys.has(key)));
  } catch (_error) {
    return new Set(BOOKING_TABLE_COLUMNS.map((column) => column.key));
  }
}

function saveVisibleColumns(columnsSet) {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(Array.from(columnsSet)));
  } catch (_error) {
    // Ignore local storage write errors.
  }
}

function applyColumnVisibility(host, visibleColumns) {
  BOOKING_TABLE_COLUMNS.forEach((column) => {
    host.querySelectorAll(`[data-col="${column.key}"]`).forEach((element) => {
      element.classList.toggle('hidden', !visibleColumns.has(column.key));
    });
  });
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
  const payment = String(filters && filters.payment ? filters.payment : '').trim().toLowerCase();

  return source.filter((row) => {
    const rowStatus = String(row && row.status ? row.status : '').toLowerCase();
    const rowType = String(row && row.type ? row.type : '').toLowerCase();
    const rowStart = String(row && row.start ? row.start : '');
    const rowEnd = String(row && row.end ? row.end : '');
    const rowPayment = row && row.paymentDone ? 'yes' : 'no';

    if (status && rowStatus !== status) {
      return false;
    }

    if (type && rowType !== type) {
      return false;
    }

    if (payment && rowPayment !== payment) {
      return false;
    }

    if (date && !(rowStart <= date && rowEnd >= date)) {
      return false;
    }

    return true;
  });
}

function renderTableBody(rows, visibleColumns, totalCount = 0) {
  const source = Array.isArray(rows) ? rows : [];
  const visibleCount = Math.max(1, BOOKING_TABLE_COLUMNS.filter((column) => visibleColumns.has(column.key)).length);

  if (!totalCount) {
    return `<tr><td colspan="${visibleCount}" class="py-6">${renderEmptyState({ title: 'No reservations found', message: 'Adjust filters or booking data to show reservations.', actionLabel: 'Refresh', actionId: 'emptyRefreshBookings' })}</td></tr>`;
  }

  return source.map((row) => renderBookingRow(row)).join('');
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
  const paymentDone = Boolean(row && row.paymentDone);

  return `<tr class="border-b border-slate-100 dark:border-white/5" data-booking-id="${escapeHtml(bookingId)}" data-booking-code="${escapeHtml(bookingCode)}" data-current-status="${escapeHtml(currentStatus)}">
    <td data-col="booking" class="py-3 pr-3 font-bold"><button type="button" data-open-booking-id="${escapeHtml(bookingId)}" class="text-left text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:decoration-brand-500/50">${escapeHtml(row.id || '-')}</button></td>
    <td data-col="customer" class="booking-customer-cell py-3 pr-3">
      ${row && row.userMessage ? `<p class="booking-user-message-chip mb-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">User Message: ${escapeHtml(row.userMessage)}</p>` : ''}
      <p class="booking-customer-name font-semibold">${escapeHtml(row.customer || '-')}</p>
      <p class="booking-customer-meta text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.customerEmail || '-')}</p>
      <p class="booking-customer-meta text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.customerPhone || '-')}</p>
    </td>
    <td data-col="vehicle" class="booking-vehicle-cell py-3 pr-3">
      <p class="font-semibold">${escapeHtml(row.vehicleName || row.vehicle || '-')}</p>
      ${row.vehicleType ? `<p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.vehicleType)}</p>` : ''}
    </td>
    <td data-col="pickupLocation" class="py-3 pr-3">${escapeHtml(row.pickupLocation || '-')}</td>
    <td data-col="start" class="py-3 pr-3">${escapeHtml(row.start || '-')}</td>
    <td data-col="end" class="py-3 pr-3">${escapeHtml(row.end || '-')}</td>
    <td data-col="type" class="py-3 pr-3">${escapeHtml(row.type || '-')}</td>
    <td data-col="driverOption" class="py-3 pr-3">${escapeHtml(row.driverOption || 'Self Drive')}</td>
    <td data-col="status" class="booking-status-cell py-3 pr-3">
      <select data-booking-status-select class="booking-status-select ${statusSelectClass(currentStatus, false)}">
        ${statusOptionMarkup(currentStatus)}
      </select>
    </td>
    <td data-col="payment" class="py-3 pr-3">
      <div class="flex flex-col gap-1">
        <span class="${bookingPaymentPillClass(row.paymentStatus)}">${escapeHtml(row.paymentStatusLabel || (paymentDone ? 'Paid' : 'Unpaid'))}</span>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">Paid ${escapeHtml(formatNpr(row.paidAmount || 0))}</span>
        <span class="text-[11px] text-amber-600 dark:text-amber-300">Due ${escapeHtml(formatNpr(row.remainingAmount || 0))}</span>
        <select data-booking-payment-select data-current-payment="${paymentDone ? 'yes' : 'no'}" class="${paymentSelectClass(paymentDone, false)}">
          <option value="yes" ${paymentDone ? 'selected' : ''}>Yes</option>
          <option value="no" ${!paymentDone ? 'selected' : ''}>No</option>
        </select>
      </div>
    </td>
    <td data-col="total" class="py-3 pr-3 font-semibold">${escapeHtml(formatNpr(row.total || 0))}</td>
    <td data-col="actions" class="py-3 pr-3">
      <div class="flex gap-2">
        <button data-edit-booking-id="${escapeHtml(bookingId)}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-white/10">Edit</button>
        <button data-delete-booking-id="${escapeHtml(bookingId)}" data-delete-booking-code="${escapeHtml(bookingCode)}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600">Delete</button>
      </div>
    </td>
  </tr>`;
}

function resolveSelectedBooking(rows) {
  const selectedId = String(bookingUiState.selectedBookingId || readBookingIdFromHash() || '').trim();
  if (!selectedId) {
    return null;
  }

  const selected = (Array.isArray(rows) ? rows : []).find((row) => String(row && (row.bookingId || row.id) ? (row.bookingId || row.id) : '') === selectedId) || null;
  if (!selected) {
    bookingUiState.selectedBookingId = '';
    writeBookingIdToHash('');
    return null;
  }

  bookingUiState.selectedBookingId = selectedId;
  return selected;
}

function readBookingIdFromHash() {
  const hash = String(window.location.hash || '').trim();
  if (!hash || hash.indexOf('#booking:') !== 0) {
    return '';
  }

  return decodeURIComponent(hash.replace('#booking:', '')).trim();
}

function writeBookingIdToHash(value) {
  const id = String(value || '').trim();
  if (!id) {
    if (String(window.location.hash || '').indexOf('#booking:') === 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }

  history.replaceState(null, '', `${window.location.pathname}${window.location.search}#booking:${encodeURIComponent(id)}`);
}

function renderBookingDetailPage(row) {
  const status = normalizeBookingStatusLabel(row && row.status ? row.status : 'Confirmed');
  const paymentDone = Boolean(row && row.paymentDone);
  const hasPaymentReceipt = row && (row.paymentId || row.transactionId || row.paidAmount > 0);

  return `<section class="${classMap.panel} animate-fadeUp p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" data-back-to-bookings-list class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[16px]">west</span>
        <span>Back to Bookings</span>
      </button>
      <span class="${statusSelectClass(status, false)} inline-flex w-auto items-center">${escapeHtml(status)}</span>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Booking Detail Page</p>
            <h3 class="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">${escapeHtml(row && row.id ? row.id : 'Booking')}</h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(row && row.customer ? row.customer : 'Customer')} · ${escapeHtml(row && (row.vehicleName || row.vehicle) ? (row.vehicleName || row.vehicle) : 'Vehicle')}</p>
          </div>
          <div class="flex flex-col items-end gap-2 text-right">
            <span class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">${escapeHtml(row && (row.type || row.vehicleType) ? (row.type || row.vehicleType) : 'Vehicle')}</span>
            <span class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">${paymentDone ? 'Paid' : 'Unpaid'}</span>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${renderBookingField('Customer', row && row.customer ? row.customer : '-')}
          ${renderBookingField('Customer Email', row && row.customerEmail ? row.customerEmail : '-')}
          ${renderBookingField('Customer Phone', row && row.customerPhone ? row.customerPhone : '-')}
          ${renderBookingField('Vehicle', row && (row.vehicleName || row.vehicle) ? (row.vehicleName || row.vehicle) : '-')}
          ${renderBookingField('Pickup Location', row && row.pickupLocation ? row.pickupLocation : '-')}
          ${renderBookingField('Driver Option', row && row.driverOption ? row.driverOption : '-')}
          ${renderBookingField('Date From', row && row.start ? row.start : '-')}
          ${renderBookingField('Date To', row && row.end ? row.end : '-')}
          ${renderBookingField('Payment', paymentDone ? 'Yes' : 'No')}
          ${renderBookingField('Total', formatNpr(row && row.total ? row.total : 0))}
        </div>

        ${hasPaymentReceipt ? `
        <div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <h4 class="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">Payment Receipt</h4>
          <div class="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            ${row.paymentId ? renderBookingField('Payment ID', row.paymentId) : ''}
            ${row.transactionId ? renderBookingField('Transaction ID', row.transactionId) : ''}
            ${row.paymentMethod ? renderBookingField('Payment Method', row.paymentMethod) : ''}
            ${row.paidAmount ? renderBookingField('Paid Amount', formatNpr(row.paidAmount)) : ''}
            ${row.remainingAmount ? renderBookingField('Remaining Amount', formatNpr(row.remainingAmount)) : ''}
            ${row.paymentDate ? renderBookingField('Payment Date', row.paymentDate) : ''}
            ${row.paymentStatus ? renderBookingField('Payment Status', row.paymentStatus) : ''}
          </div>
        </div>
        ` : ''}

        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" data-edit-booking-id="${escapeHtml(row && row.bookingId ? row.bookingId : '')}" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Edit Booking</button>
          <button type="button" data-delete-booking-id="${escapeHtml(row && row.bookingId ? row.bookingId : '')}" data-delete-booking-code="${escapeHtml(row && row.id ? row.id : '')}" class="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600">Delete Booking</button>
        </div>
      </article>

      <aside class="space-y-3">
        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Trip Summary</h4>
          <div class="mt-3 grid grid-cols-1 gap-2 text-xs">
            ${renderBookingField('Booking Code', row && row.id ? row.id : '-')}
            ${renderBookingField('Booking ID', row && row.bookingId ? row.bookingId : '-')}
            ${renderBookingField('Created', row && row.createdAt ? row.createdAt : '-')}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Message</h4>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(row && row.userMessage ? row.userMessage : 'No user message recorded for this booking.')}</p>
        </article>
      </aside>
    </div>
  </section>`;
}

function renderBookingField(label, value) {
  return `<article class="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(value || '-')}</p>
  </article>`;
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
    // Try multiple fields for vehicle type
    const type = String(row && (row.type || row.vehicleType) ? (row.type || row.vehicleType) : '').trim();
    if (type) {
      values.add(type);
    }
  });

  const options = Array.from(values);
  options.sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });

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
  const base = 'w-[170px] max-w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold leading-tight outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60';
  const disabled = isDisabled ? ' opacity-60' : '';

  if (normalized === 'Confirmed') return `${base} border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200${disabled}`;
  if (normalized === 'Pending') return `${base} border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200${disabled}`;
  if (normalized === 'Cancelled') return `${base} border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-200${disabled}`;
  if (normalized === 'Completed') return `${base} border-slate-300 bg-slate-200 text-slate-800 dark:border-slate-400/30 dark:bg-slate-500/25 dark:text-slate-200${disabled}`;
  return `${base} border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200${disabled}`;
}

function bookingPaymentPillClass(status) {
  const base = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]';
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (key === 'partial') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (key === 'failed' || key === 'expired') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (key === 'refunded') return `${base} bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
}

function paymentSelectClass(paymentDone, isDisabled) {
  const base = 'w-[90px] rounded-lg border px-2 py-1 text-xs font-semibold outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60';
  const disabled = isDisabled ? ' opacity-60' : '';
  if (paymentDone) {
    return `${base} border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200${disabled}`;
  }

  return `${base} border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200${disabled}`;
}

function formatNpr(value) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `NPR ${normalized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
