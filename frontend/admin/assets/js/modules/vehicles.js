import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination, sortRows } from '../table-utils.js';
import { openDrawer, openModal, renderEmptyState } from '../ui.js';

export function renderVehiclesModule({ data, query, notify }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const filtered = filterRows(data.vehicles, query, ['id', 'name', 'category', 'status']);
  const sorted = sortRows(filtered, 'name');
  const paged = paginateRows(sorted, 1, 6);

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
        <h2 class="${classMap.heading}">Vehicle Management</h2>
      </div>
      <button id="addVehicleBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Add Vehicle</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="mb-3 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Category</th>
              <th class="pb-2 pr-3">Status</th>
              <th class="pb-2 pr-3">Daily</th>
              <th class="pb-2 pr-3">Weekly</th>
              <th class="pb-2 pr-3">Seasonal</th>
              <th class="pb-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${paged.rows.length
              ? paged.rows
              .map(
                (vehicle) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3">
                    <div class="flex items-center gap-3">
                      <img src="${vehicle.image}" alt="${vehicle.name}" class="h-10 w-14 rounded-lg object-cover" />
                      <div>
                        <p class="font-bold">${vehicle.name}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${vehicle.id}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 pr-3">${vehicle.category}</td>
                  <td class="py-3 pr-3"><span class="${statusClass(vehicle.status)}">${vehicle.status}</span></td>
                  <td class="py-3 pr-3">$${vehicle.daily}</td>
                  <td class="py-3 pr-3">$${vehicle.weekly}</td>
                  <td class="py-3 pr-3">$${vehicle.seasonal}</td>
                  <td class="py-3 pr-3">
                    <div class="flex gap-2">
                      <button data-edit-id="${vehicle.id}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-white/10">Edit</button>
                      <button data-delete-id="${vehicle.id}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600">Delete</button>
                    </div>
                  </td>
                </tr>`
              )
              .join('')
              : `<tr><td colspan="7" class="py-6">${renderEmptyState({ title: 'No vehicles found', message: 'Try changing your search query or clear filters.', actionLabel: 'Reset search', actionId: 'resetVehicleSearch' })}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="vehiclePager" class="mt-3"></div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Flexible Pricing Model</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Daily</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Base rates by demand index and vehicle condition.</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Weekly</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Auto-discount tiers with weekend uplift controls.</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Seasonal</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Holiday and event-specific pricing with floor thresholds.</p>
        </div>
      </div>
    </section>
  `;

  const pagerHost = host.querySelector('#vehiclePager');
  if (pagerHost) {
    pagerHost.appendChild(renderPagination(paged, () => notify('Pagination demo wired in utility layer')));
  }

  host.querySelector('#addVehicleBtn')?.addEventListener('click', () => {
    openDrawer({
      title: 'Add Vehicle',
      content: `
        <div class="space-y-3">
          <label class="block space-y-1"><span class="text-xs font-semibold">Vehicle Name</span><input class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Enter vehicle name" /></label>
          <label class="block space-y-1"><span class="text-xs font-semibold">Category</span><select class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option>SUV</option><option>Sedan</option><option>Bike</option><option>Electric</option><option>Luxury</option></select></label>
          <label class="block space-y-1"><span class="text-xs font-semibold">Upload Image</span><input type="file" class="w-full text-xs" /></label>
          <button class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save Vehicle</button>
        </div>
      `,
    });
    notify('Vehicle creation drawer opened', 'success');
  });

  host.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Editing ${button.getAttribute('data-edit-id')}`, 'info');
    });
  });

  host.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-delete-id');
      openModal({
        title: 'Confirm Vehicle Deletion',
        content: `<p>Vehicle <strong>${id}</strong> will be removed from availability and hidden from booking channels.</p>`,
        onConfirm: () => notify(`Deletion requested for ${id}`, 'warn'),
      });
    });
  });

  host.querySelector('#resetVehicleSearch')?.addEventListener('click', () => {
    notify('Reset search from global input', 'info');
  });

  return host;
}

function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'Rented') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}
