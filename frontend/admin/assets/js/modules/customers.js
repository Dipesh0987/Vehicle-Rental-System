import { classMap } from '../config.js';
import { filterRows, sortRows } from '../table-utils.js';
import { openModal, renderEmptyState } from '../ui.js';

export function renderCustomersModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = sortRows(filterRows(data.customers, query, ['id', 'name', 'status']), 'name');

  host.className = 'space-y-4';
  host.innerHTML = `
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CRM</p>
      <h2 class="${classMap.heading}">Customer Management</h2>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Customer</th>
              <th class="pb-2 pr-3">Trips</th>
              <th class="pb-2 pr-3">Verification</th>
              <th class="pb-2 pr-3">Documents</th>
              <th class="pb-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3">
                    <p class="font-bold">${row.name}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${row.id}</p>
                  </td>
                  <td class="py-3 pr-3">${row.trips}</td>
                  <td class="py-3 pr-3">${row.verified ? '<span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Verified</span>' : '<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Pending</span>'}</td>
                  <td class="py-3 pr-3">${row.documents.join(', ')}</td>
                  <td class="py-3 pr-3">
                    <div class="flex gap-2">
                      <button data-flag="${row.id}" class="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700">Flag</button>
                      <button data-blacklist="${row.id}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600">Blacklist</button>
                    </div>
                  </td>
                </tr>`
              )
              .join('')
              : `<tr><td colspan="5" class="py-6">${renderEmptyState({ title: 'No customers found', message: 'No profile matched the current search.', actionLabel: 'Clear Search', actionId: 'clearCustomerSearch' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Profile Insights</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        ${rows
          .slice(0, 3)
          .map(
            (row) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p class="text-sm font-bold">${row.name}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Status: ${row.status}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Booking history: ${row.trips} completed rentals</p>
            </article>`
          )
          .join('')}
      </div>
    </section>
  `;

  host.querySelectorAll('[data-flag]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Customer ${button.getAttribute('data-flag')} flagged`, 'warn');
    });
  });

  host.querySelectorAll('[data-blacklist]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-blacklist');
      openModal({
        title: 'Blacklist Customer',
        content: `<p>This will block <strong>${id}</strong> from new bookings until manual review.</p>`,
        onConfirm: () => notify(`Customer ${id} blacklisted`, 'error'),
      });
    });
  });

  host.querySelector('#clearCustomerSearch')?.addEventListener('click', () => {
    notify('Clear global search to restore full customer list', 'info');
  });

  return host;
}
