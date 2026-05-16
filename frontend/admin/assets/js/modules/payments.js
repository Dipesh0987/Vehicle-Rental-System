import { classMap } from '../config.js';
import { filterRows, sortRows } from '../table-utils.js';
import { renderEmptyState } from '../ui.js';

const STATUS_OPTIONS = ['', 'completed', 'pending', 'initiated', 'failed', 'expired', 'cancelled', 'refunded'];
const METHOD_OPTIONS = ['', 'esewa', 'khalti', 'card', 'cash', 'bank_transfer'];

const paymentUiState = {
  selectedTransactionCode: '',
  filters: {
    status: '',
    method: '',
    fromDate: '',
    toDate: '',
  },
  resending: false,
};

export function renderPaymentsModule({ data, query, notify, paymentsService, paymentStats, reloadPaymentsData, rerender }) {
  const host = document.createElement('section');
  const sourceRows = Array.isArray(data && data.payments) ? data.payments : [];
  const selectedPayment = resolveSelectedPayment(sourceRows);
  const stats = paymentStats || computeFallbackStats(sourceRows);

  const filteredBySearch = filterRows(sourceRows, query, [
    'transactionCode', 'bookingCode', 'customerName', 'customerEmail',
    'method', 'paymentType', 'status', 'providerTransactionId', 'providerReference', 'receiptCode',
  ]);
  const filteredRows = applyFilters(filteredBySearch, paymentUiState.filters);
  const sortedRows = sortRowsByCreatedDesc(filteredRows);

  host.className = 'space-y-4';
  host.innerHTML = selectedPayment
    ? renderPaymentDetailPage(selectedPayment)
    : renderListPage({ rows: sortedRows, totalRows: sourceRows.length, stats });

  if (selectedPayment) {
    wireDetailHandlers(host, selectedPayment, { paymentsService, notify, reloadPaymentsData, rerender });
  } else {
    wireListHandlers(host, sortedRows, { paymentsService, notify, reloadPaymentsData, rerender });
  }

  return host;
}

function renderListPage({ rows, totalRows, stats }) {
  const filters = paymentUiState.filters;
  return `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
        <h2 class="${classMap.heading}">Payments &amp; Transactions</h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${totalRows} transaction${totalRows === 1 ? '' : 's'} on file. Showing ${rows.length}.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button id="reloadPaymentsBtn" class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
          <span class="material-symbols-outlined text-[16px]">refresh</span>
          <span>Refresh</span>
        </button>
        <button id="expireStaleBtn" class="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-300">
          <span class="material-symbols-outlined text-[16px]">timer_off</span>
          <span>Expire stale</span>
        </button>
      </div>
    </header>

    <section class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
      ${renderStatCard('Revenue collected', formatNpr(stats.revenuePaid), 'text-emerald-600 dark:text-emerald-300', 'paid_total')}
      ${renderStatCard('Outstanding', formatNpr(stats.revenueOutstanding), 'text-amber-600 dark:text-amber-300', 'outstanding')}
      ${renderStatCard('Completed', String(stats.countCompleted), 'text-emerald-600 dark:text-emerald-300', 'count_completed')}
      ${renderStatCard('Failed', String(stats.countFailed + stats.countExpired), 'text-rose-600 dark:text-rose-300', 'count_failed')}
      ${renderStatCard('Receipts sent', String(stats.receiptsSent), 'text-slate-700 dark:text-slate-200', 'receipts_sent')}
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Status</span>
          <select id="paymentsFilterStatus" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            ${STATUS_OPTIONS.map((value) => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${value ? capitalize(value) : 'All statuses'}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Method</span>
          <select id="paymentsFilterMethod" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            ${METHOD_OPTIONS.map((value) => `<option value="${value}" ${filters.method === value ? 'selected' : ''}>${value ? value.toUpperCase() : 'All methods'}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">From</span>
          <input id="paymentsFilterFromDate" type="date" value="${escapeHtml(filters.fromDate)}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5" />
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">To</span>
          <input id="paymentsFilterToDate" type="date" value="${escapeHtml(filters.toDate)}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5" />
        </label>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button id="paymentsClearFiltersBtn" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Clear filters</button>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Transaction</th>
              <th class="pb-2 pr-3">Booking</th>
              <th class="pb-2 pr-3">Customer</th>
              <th class="pb-2 pr-3">Method</th>
              <th class="pb-2 pr-3">Type</th>
              <th class="pb-2 pr-3">Amount</th>
              <th class="pb-2 pr-3">Booking ledger</th>
              <th class="pb-2 pr-3">Status</th>
              <th class="pb-2 pr-3">Receipt</th>
              <th class="pb-2 pr-3">Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows.map(renderTableRow).join('')
              : `<tr><td colspan="10" class="py-6">${renderEmptyState({ title: 'No transactions found', message: 'Adjust filters or wait for new bookings to come through.' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTableRow(row) {
  return `<tr data-payment-row="${escapeHtml(row.transactionCode)}" class="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
    <td class="py-3 pr-3 font-bold">${escapeHtml(row.transactionCode || '-')}</td>
    <td class="py-3 pr-3">${escapeHtml(row.bookingCode || row.bookingId.slice(0, 8) || '-')}</td>
    <td class="py-3 pr-3">
      <div class="font-semibold">${escapeHtml(row.customerName || '-')}</div>
      <div class="text-xs text-slate-500">${escapeHtml(row.customerEmail || '-')}</div>
    </td>
    <td class="py-3 pr-3 uppercase">${escapeHtml(row.method || '-')}</td>
    <td class="py-3 pr-3 capitalize">${escapeHtml(row.paymentType || '-')}</td>
    <td class="py-3 pr-3 font-semibold">${formatNpr(row.amount)}</td>
    <td class="py-3 pr-3 text-xs">
      <div>Total ${formatNpr(row.bookingTotalAmount)}</div>
      <div class="text-emerald-600 dark:text-emerald-300">Paid ${formatNpr(row.bookingPaidAmount)}</div>
      <div class="text-amber-600 dark:text-amber-300">Remaining ${formatNpr(row.bookingRemainingAmount)}</div>
    </td>
    <td class="py-3 pr-3"><span class="${statusPillClass(row.status)}">${escapeHtml(prettyStatus(row.status))}</span></td>
    <td class="py-3 pr-3 text-xs">
      ${row.receiptCode ? `<div class="font-semibold">${escapeHtml(row.receiptCode)}</div>` : '<div class="text-slate-400">-</div>'}
      ${row.receiptEmailStatus ? `<div class="${receiptEmailToneClass(row.receiptEmailStatus)}">${escapeHtml(row.receiptEmailStatus)}</div>` : ''}
    </td>
    <td class="py-3 pr-3 text-xs text-slate-500">${escapeHtml(formatDateTime(row.paidAt || row.createdAt))}</td>
  </tr>`;
}

function renderStatCard(label, value, valueClass, key) {
  return `<article data-stat="${key}" class="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-1 text-lg font-extrabold ${valueClass}">${escapeHtml(value)}</p>
  </article>`;
}

function renderPaymentDetailPage(row) {
  const statusKey = String(row.status || '').toLowerCase();
  const isCompleted = statusKey === 'completed';

  return `<section class="${classMap.panel} animate-fadeUp p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" data-back-to-payments-list class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[16px]">west</span>
        <span>Back to Payments</span>
      </button>
      <div class="flex flex-wrap items-center gap-2">
        ${isCompleted ? `<button data-action="resend-receipt" class="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300"><span class="material-symbols-outlined text-[16px]">forward_to_inbox</span><span>Resend receipt</span></button>` : ''}
        <span class="${statusPillClass(row.status)}">${escapeHtml(prettyStatus(row.status))}</span>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Transaction Detail</p>
        <h3 class="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">${escapeHtml(row.transactionCode || '-')}</h3>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(row.customerName || 'Customer')} &middot; ${escapeHtml(row.bookingCode || row.bookingId.slice(0, 8) || '-')}</p>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${renderField('Amount', formatNpr(row.amount))}
          ${renderField('Method', String(row.method || '').toUpperCase())}
          ${renderField('Payment type', capitalize(row.paymentType || ''))}
          ${renderField('Currency', row.currency || 'NPR')}
          ${renderField('Provider reference', row.providerReference || '-')}
          ${renderField('Provider txn id', row.providerTransactionId || '-')}
          ${renderField('Initiated at', formatDateTime(row.initiatedAt))}
          ${renderField('Paid at', formatDateTime(row.paidAt))}
          ${renderField('Expires at', formatDateTime(row.expiresAt))}
          ${row.failureReason ? renderField('Failure reason', row.failureReason) : ''}
        </div>
      </article>

      <aside class="space-y-3">
        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Booking ledger</h4>
          <div class="mt-3 space-y-2 text-xs">
            ${renderField('Booking', row.bookingCode || row.bookingId)}
            ${renderField('Travel', `${formatDate(row.bookingTravelStartDate)} → ${formatDate(row.bookingTravelEndDate)}`)}
            ${renderField('Booking total', formatNpr(row.bookingTotalAmount))}
            ${renderField('Paid so far', formatNpr(row.bookingPaidAmount))}
            ${renderField('Remaining', formatNpr(row.bookingRemainingAmount))}
            ${renderField('Booking status', capitalize(row.bookingStatus || ''))}
            ${renderField('Payment status', prettyBookingPaymentStatus(row.bookingPaymentStatus))}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Receipt</h4>
          <div class="mt-3 space-y-2 text-xs">
            ${renderField('Receipt code', row.receiptCode || '-')}
            ${renderField('Email status', row.receiptEmailStatus || 'pending')}
            ${renderField('Sent to', row.receiptEmailTo || '-')}
            ${renderField('Sent at', formatDateTime(row.receiptEmailSentAt))}
            ${row.receiptEmailError ? renderField('Last error', row.receiptEmailError) : ''}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Customer</h4>
          <div class="mt-3 space-y-2 text-xs">
            ${renderField('Name', row.customerName || '-')}
            ${renderField('Email', row.customerEmail || '-')}
          </div>
        </article>
      </aside>
    </div>
  </section>`;
}

function renderField(label, value) {
  return `<article class="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(value || '-')}</p>
  </article>`;
}

function wireListHandlers(host, rows, { paymentsService, notify, reloadPaymentsData, rerender }) {
  const reloadBtn = host.querySelector('#reloadPaymentsBtn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      try {
        if (typeof reloadPaymentsData === 'function') await reloadPaymentsData();
        rerender?.();
      } finally {
        reloadBtn.disabled = false;
      }
    });
  }

  const expireBtn = host.querySelector('#expireStaleBtn');
  if (expireBtn) {
    expireBtn.addEventListener('click', async () => {
      if (!paymentsService || typeof paymentsService.expireStale !== 'function') {
        notify('Payments service is unavailable.', 'error');
        return;
      }
      expireBtn.disabled = true;
      try {
        const result = await paymentsService.expireStale();
        notify(`Expired ${Number(result.expired || 0)} stale payment(s).`, 'success');
        if (typeof reloadPaymentsData === 'function') await reloadPaymentsData();
        rerender?.();
      } catch (error) {
        notify(error.message || 'Could not expire stale payments.', 'error');
      } finally {
        expireBtn.disabled = false;
      }
    });
  }

  const statusSelect = host.querySelector('#paymentsFilterStatus');
  const methodSelect = host.querySelector('#paymentsFilterMethod');
  const fromDateInput = host.querySelector('#paymentsFilterFromDate');
  const toDateInput = host.querySelector('#paymentsFilterToDate');
  const clearBtn = host.querySelector('#paymentsClearFiltersBtn');

  function applyFiltersAndRerender() {
    paymentUiState.filters = {
      status: statusSelect ? statusSelect.value : '',
      method: methodSelect ? methodSelect.value : '',
      fromDate: fromDateInput ? fromDateInput.value : '',
      toDate: toDateInput ? toDateInput.value : '',
    };
    rerender?.();
  }

  [statusSelect, methodSelect, fromDateInput, toDateInput].forEach((control) => {
    control?.addEventListener('change', applyFiltersAndRerender);
    control?.addEventListener('input', applyFiltersAndRerender);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      paymentUiState.filters = { status: '', method: '', fromDate: '', toDate: '' };
      rerender?.();
    });
  }

  host.querySelectorAll('[data-payment-row]').forEach((rowEl) => {
    rowEl.addEventListener('click', () => {
      const code = rowEl.getAttribute('data-payment-row') || '';
      paymentUiState.selectedTransactionCode = code;
      writeTransactionCodeToHash(code);
      rerender?.();
    });
  });
}

function wireDetailHandlers(host, row, { paymentsService, notify, reloadPaymentsData, rerender }) {
  const backBtn = host.querySelector('[data-back-to-payments-list]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      paymentUiState.selectedTransactionCode = '';
      writeTransactionCodeToHash('');
      rerender?.();
    });
  }

  const resendBtn = host.querySelector('[data-action="resend-receipt"]');
  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      if (!paymentsService || typeof paymentsService.resendReceipt !== 'function') {
        notify('Payments service is unavailable.', 'error');
        return;
      }
      if (paymentUiState.resending) return;
      paymentUiState.resending = true;
      resendBtn.disabled = true;
      const original = resendBtn.innerHTML;
      resendBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">progress_activity</span><span>Sending...</span>';
      try {
        await paymentsService.resendReceipt(row.transactionCode);
        notify(`Receipt for ${row.transactionCode} resent.`, 'success');
        if (typeof reloadPaymentsData === 'function') await reloadPaymentsData();
        rerender?.();
      } catch (error) {
        notify(error.message || 'Could not resend receipt.', 'error');
      } finally {
        paymentUiState.resending = false;
        resendBtn.disabled = false;
        resendBtn.innerHTML = original;
      }
    });
  }
}

function applyFilters(rows, filters) {
  const status = String(filters.status || '').trim().toLowerCase();
  const method = String(filters.method || '').trim().toLowerCase();
  const from = parseDate(filters.fromDate);
  const to = parseDate(filters.toDate, true);

  return rows.filter((row) => {
    if (status && String(row.status || '').toLowerCase() !== status) return false;
    if (method && String(row.method || '').toLowerCase() !== method) return false;
    if (from || to) {
      const created = Date.parse(String(row.createdAt || row.paidAt || ''));
      if (!Number.isFinite(created)) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }
    return true;
  });
}

function parseDate(value, endOfDay = false) {
  const text = String(value || '').trim();
  if (!text) return 0;
  const ms = Date.parse(text + (endOfDay ? 'T23:59:59' : 'T00:00:00'));
  return Number.isFinite(ms) ? ms : 0;
}

function sortRowsByCreatedDesc(rows) {
  return rows.slice().sort((a, b) => {
    const aMs = Date.parse(String(a.createdAt || a.paidAt || ''));
    const bMs = Date.parse(String(b.createdAt || b.paidAt || ''));
    return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
  });
}

function resolveSelectedPayment(rows) {
  const selectedCode = String(paymentUiState.selectedTransactionCode || readTransactionCodeFromHash() || '').trim();
  if (!selectedCode) return null;

  const selected = (Array.isArray(rows) ? rows : []).find(
    (row) => String(row && row.transactionCode ? row.transactionCode : '') === selectedCode
  ) || null;

  if (!selected) {
    paymentUiState.selectedTransactionCode = '';
    writeTransactionCodeToHash('');
    return null;
  }

  paymentUiState.selectedTransactionCode = selectedCode;
  return selected;
}

function readTransactionCodeFromHash() {
  const hash = String(window.location.hash || '').trim();
  if (!hash || hash.indexOf('#payment:') !== 0) return '';
  return decodeURIComponent(hash.replace('#payment:', '')).trim();
}

function writeTransactionCodeToHash(value) {
  const code = String(value || '').trim();
  if (!code) {
    if (String(window.location.hash || '').indexOf('#payment:') === 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}#payment:${encodeURIComponent(code)}`);
}

function statusPillClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold capitalize';
  const key = String(status || '').toLowerCase();
  if (key === 'completed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (key === 'pending' || key === 'initiated') return `${base} bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
  if (key === 'failed' || key === 'expired' || key === 'cancelled') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (key === 'refunded') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
}

function receiptEmailToneClass(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'sent') return 'mt-1 text-emerald-600 dark:text-emerald-300';
  if (key === 'failed') return 'mt-1 text-rose-600 dark:text-rose-300';
  return 'mt-1 text-slate-500 dark:text-slate-400';
}

function prettyStatus(status) {
  const key = String(status || '').toLowerCase();
  if (!key) return 'Unknown';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function prettyBookingPaymentStatus(status) {
  const key = String(status || '').toLowerCase();
  if (!key) return '-';
  if (key === 'partial') return 'Partially Paid';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function capitalize(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNpr(value) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `NPR ${normalized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  const d = new Date(text.length === 10 ? `${text}T00:00:00` : text);
  if (Number.isNaN(d.getTime())) return text;
  try {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_e) { return text; }
}

function formatDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  try {
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (_e) { return text; }
}

function computeFallbackStats(rows) {
  return {
    revenuePaid: rows.filter((r) => r.status === 'completed').reduce((sum, r) => sum + Number(r.amount || 0), 0),
    revenueOutstanding: 0,
    countCompleted: rows.filter((r) => r.status === 'completed').length,
    countPartial: 0,
    countFailed: rows.filter((r) => r.status === 'failed').length,
    countExpired: rows.filter((r) => r.status === 'expired').length,
    countPending: rows.filter((r) => r.status === 'pending' || r.status === 'initiated').length,
    receiptsSent: rows.filter((r) => r.receiptEmailStatus === 'sent').length,
    receiptsFailed: rows.filter((r) => r.receiptEmailStatus === 'failed').length,
  };
}
