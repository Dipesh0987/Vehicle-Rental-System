import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderDriversModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = filterRows(data.drivers, query, ['id', 'name', 'availability', 'assigned']);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
      <h2 class="${classMap.heading}">Driver Management</h2>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Driver</th>
              <th class="pb-2 pr-3">Availability</th>
              <th class="pb-2 pr-3">Assigned Booking</th>
              <th class="pb-2 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3">
                    <p class="font-bold">${row.name}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${row.id}</p>
                  </td>
                  <td class="py-3 pr-3"><span class="${availabilityClass(row.availability)}">${row.availability}</span></td>
                  <td class="py-3 pr-3">${row.assigned}</td>
                  <td class="py-3 pr-3"><button data-assign="${row.id}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-white/10">Assign Driver</button></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  host.querySelectorAll('[data-assign]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Driver ${button.getAttribute('data-assign')} assignment panel opened`, 'info');
    });
  });

  return host;
}

function availabilityClass(value) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (value === 'Available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (value === 'On Trip') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
}
