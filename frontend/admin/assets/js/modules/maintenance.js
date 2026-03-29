import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderMaintenanceModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = filterRows(data.maintenance, query, ['id', 'vehicle', 'status', 'damage']);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quality</p>
        <h2 class="${classMap.heading}">Maintenance & Damage Reporting</h2>
      </div>
      <button id="newDamageBtn" class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300">Report Damage</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Maintenance ID</th>
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Schedule</th>
              <th class="pb-2 pr-3">Damage / Service</th>
              <th class="pb-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3 font-bold">${row.id}</td>
                  <td class="py-3 pr-3">${row.vehicle}</td>
                  <td class="py-3 pr-3">${row.schedule}</td>
                  <td class="py-3 pr-3">${row.damage}</td>
                  <td class="py-3 pr-3"><span class="${statusClass(row.status)}">${row.status}</span></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Service Cycle Tracking</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Upcoming Services</p>
          <p class="mt-1 text-2xl font-extrabold">14</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">In Workshop</p>
          <p class="mt-1 text-2xl font-extrabold">5</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Damage Claims Open</p>
          <p class="mt-1 text-2xl font-extrabold">3</p>
        </div>
      </div>
    </section>
  `;

  host.querySelector('#newDamageBtn')?.addEventListener('click', () => {
    notify('Damage report drawer opened', 'warn');
  });

  return host;
}

function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'In Progress') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}
