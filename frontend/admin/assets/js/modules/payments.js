import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';
import { openModal, renderEmptyState } from '../ui.js';

export function renderPaymentsModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = filterRows(data.payments, query, ['id', 'booking', 'method', 'status', 'invoice']);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
        <h2 class="${classMap.heading}">Payments & Transactions</h2>
      </div>
      <button id="exportPaymentsBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10">Export Revenue Report</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Transaction</th>
              <th class="pb-2 pr-3">Booking</th>
              <th class="pb-2 pr-3">Method</th>
              <th class="pb-2 pr-3">Amount</th>
              <th class="pb-2 pr-3">Invoice</th>
              <th class="pb-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3 font-bold">${row.id}</td>
                  <td class="py-3 pr-3">${row.booking}</td>
                  <td class="py-3 pr-3">${row.method}</td>
                  <td class="py-3 pr-3">$${row.amount}</td>
                  <td class="py-3 pr-3"><button data-invoice="${row.invoice}" class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-white/10">${row.invoice}</button></td>
                  <td class="py-3 pr-3"><span class="${statusClass(row.status)}">${row.status}</span></td>
                </tr>`
              )
              .join('')
              : `<tr><td colspan="6" class="py-6">${renderEmptyState({ title: 'No transactions found', message: 'There are no transactions for the current filter scope.' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Payment Security & Methods</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-sm font-bold">Supported methods</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Card, UPI, wallet, cash, bank transfer</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-sm font-bold">Fraud checks</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Velocity, blacklist, and suspicious retry monitoring</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-sm font-bold">Invoice pipeline</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Auto-generated PDF invoices with tax entries</p>
        </div>
      </div>
    </section>
  `;

  host.querySelector('#exportPaymentsBtn')?.addEventListener('click', () => {
    openModal({
      title: 'Export Revenue Report',
      content: '<p>Choose a date range and channel mix before exporting in production. This demo exports mock monthly totals.</p>',
      onConfirm: () => notify('Revenue report export queued', 'success'),
    });
  });

  host.querySelectorAll('[data-invoice]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Invoice ${button.getAttribute('data-invoice')} generated`, 'info');
    });
  });

  return host;
}

function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Paid') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'Partially Paid') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
}
