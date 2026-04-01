import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';
import { openDrawer, openModal, renderEmptyState } from '../ui.js';

export function renderVehiclesModule({ data, query, notify, catalogService, canWriteCatalog = false, rerender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const filtered = filterRows(data.vehicles, query, ['id', 'name', 'category', 'status']);
  const paged = paginateRows(filtered, 1, 6);

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
                      <button data-edit-id="${vehicle.id}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10" ${canWriteCatalog ? '' : 'disabled title="No write access"'}>Edit</button>
                      <button data-delete-id="${vehicle.id}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50" ${canWriteCatalog ? '' : 'disabled title="No write access"'}>Delete</button>
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
      const id = button.getAttribute('data-edit-id');
      const selectedVehicle = data.vehicles.find((vehicle) => vehicle.id === id);

      if (!canWriteCatalog) {
        notify('Write access is unavailable for vehicle catalog updates.', 'error');
        return;
      }

      if (!selectedVehicle) {
        notify('Unable to open edit drawer: vehicle record not found.', 'error');
        return;
      }

      openDrawer({
        title: 'Edit Vehicle',
        content: renderVehicleEditDrawer(selectedVehicle),
      });

      const editForm = document.getElementById('editVehicleForm');
      editForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
          if (!catalogService || typeof catalogService.saveVehicle !== 'function') {
            throw new Error('Catalog service is unavailable.');
          }

          const payload = {
            name: document.getElementById('editVehicleName')?.value?.trim() || selectedVehicle.name,
            type: document.getElementById('editVehicleType')?.value?.trim() || selectedVehicle.type || selectedVehicle.category,
            seats: document.getElementById('editVehicleSeats')?.value || selectedVehicle.seats || 5,
            price_per_day: document.getElementById('editVehiclePricePerDay')?.value || selectedVehicle.price_per_day || selectedVehicle.daily,
            fuel_type: document.getElementById('editVehicleFuelType')?.value || selectedVehicle.fuel_type || 'Petrol',
            status: document.getElementById('editVehicleStatus')?.value || normalizeStatusForDb(selectedVehicle.status),
            category: document.getElementById('editVehicleCategory')?.value || selectedVehicle.category,
            transmission: document.getElementById('editVehicleTransmission')?.value || selectedVehicle.transmission || 'Automatic',
            rating: document.getElementById('editVehicleRating')?.value || selectedVehicle.rating || 4.6,
            location: document.getElementById('editVehicleLocation')?.value?.trim() || selectedVehicle.location || '',
            available: document.getElementById('editVehicleAvailable')?.checked ?? (selectedVehicle.available ?? true),
            is_active: document.getElementById('editVehicleIsActive')?.checked ?? (selectedVehicle.is_active ?? true),
            brand: document.getElementById('editVehicleBrand')?.value?.trim() || selectedVehicle.brand || 'General',
            primary_image_url: document.getElementById('editVehiclePrimaryImageUrl')?.value?.trim() || selectedVehicle.primary_image_url || selectedVehicle.image,
          };

          if (!payload.name) {
            throw new Error('Vehicle name is required.');
          }

          await catalogService.saveVehicle(payload, selectedVehicle.id);
          document.getElementById('overlayHost')?.replaceChildren();
          rerender?.();
          notify(`Vehicle ${selectedVehicle.id} updated successfully.`, 'success');
        } catch (error) {
          notify(`Failed to update vehicle ${selectedVehicle.id}: ${error.message}`, 'error');
        }
      });

      notify(`Editing ${id}`, 'info');
    });
  });

  host.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-delete-id');

      if (!canWriteCatalog) {
        notify('Write access is unavailable for vehicle catalog updates.', 'error');
        return;
      }

      openModal({
        title: 'Confirm Vehicle Deletion',
        content: `<p>Vehicle <strong>${id}</strong> will be removed from availability and hidden from booking channels.</p>`,
        onConfirm: async () => {
          try {
            if (!catalogService || typeof catalogService.deleteVehicle !== 'function') {
              throw new Error('Catalog service is unavailable.');
            }

            await catalogService.deleteVehicle(id);
            rerender?.();
            notify(`Vehicle ${id} deleted successfully.`, 'success');
          } catch (error) {
            notify(`Failed to delete vehicle ${id}: ${error.message}`, 'error');
          }
        },
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
  const lowered = String(status || '').toLowerCase();
  if (lowered === 'available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (lowered === 'inactive') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}

function renderVehicleEditDrawer(vehicle) {
  const selectedCategory = (value) => (vehicle.category === value ? 'selected' : '');
  const dbStatus = normalizeStatusForDb(vehicle.status);
  const selectedStatus = (value) => (dbStatus === value ? 'selected' : '');
  const safeName = escapeHtml(vehicle.name || '');
  const safeId = escapeHtml(vehicle.id || '');
  const safeImage = escapeHtml(vehicle.primary_image_url || vehicle.image || '');
  const safeType = escapeHtml(vehicle.type || vehicle.category || 'sedan');
  const safeSeats = Number(vehicle.seats || 5);
  const safePricePerDay = Number(vehicle.price_per_day || vehicle.daily || 0);
  const safeFuelType = escapeHtml(vehicle.fuel_type || 'Petrol');
  const safeTransmission = escapeHtml(vehicle.transmission || 'Automatic');
  const safeRating = Number(vehicle.rating || 4.6);
  const safeLocation = escapeHtml(vehicle.location || '');
  const safeBrand = escapeHtml(vehicle.brand || 'General');

  return `
    <form id="editVehicleForm" class="space-y-3" data-vehicle-id="${safeId}">
      <label class="block space-y-1"><span class="text-xs font-semibold">Vehicle Name</span><input id="editVehicleName" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeName}" placeholder="Enter vehicle name" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Type</span><input id="editVehicleType" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeType}" placeholder="sedan" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Seats</span><input id="editVehicleSeats" type="number" min="1" max="15" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeSeats}" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Category</span><select id="editVehicleCategory" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${selectedCategory('SUV')}>SUV</option><option ${selectedCategory('Sedan')}>Sedan</option><option ${selectedCategory('Bike')}>Bike</option><option ${selectedCategory('Electric')}>Electric</option><option ${selectedCategory('Luxury')}>Luxury</option></select></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Fuel Type</span><select id="editVehicleFuelType" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${safeFuelType === 'Petrol' ? 'selected' : ''}>Petrol</option><option ${safeFuelType === 'Diesel' ? 'selected' : ''}>Diesel</option><option ${safeFuelType === 'Electric' ? 'selected' : ''}>Electric</option></select></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Status</span><select id="editVehicleStatus" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${selectedStatus('available')}>available</option><option ${selectedStatus('maintenance')}>maintenance</option><option ${selectedStatus('inactive')}>inactive</option></select></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Price Per Day</span><input id="editVehiclePricePerDay" type="number" min="1" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safePricePerDay}" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Transmission</span><input id="editVehicleTransmission" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeTransmission}" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Rating</span><input id="editVehicleRating" type="number" step="0.01" min="0" max="5" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeRating}" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Location</span><input id="editVehicleLocation" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeLocation}" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Brand</span><input id="editVehicleBrand" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeBrand}" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Primary Image URL</span><input id="editVehiclePrimaryImageUrl" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeImage}" placeholder="https://..." /></label>
      <label class="flex items-center gap-2"><input id="editVehicleAvailable" type="checkbox" class="h-4 w-4" ${vehicle.available !== false ? 'checked' : ''} /><span class="text-xs font-semibold">Available</span></label>
      <label class="flex items-center gap-2"><input id="editVehicleIsActive" type="checkbox" class="h-4 w-4" ${vehicle.is_active !== false ? 'checked' : ''} /><span class="text-xs font-semibold">Is Active</span></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Upload Image</span><input type="file" class="w-full text-xs" /></label>
      <button type="submit" class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save Changes</button>
    </form>
  `;
}

function normalizeStatusForDb(status) {
  const lowered = String(status || '').toLowerCase();
  if (lowered === 'available' || lowered === 'maintenance' || lowered === 'inactive') return lowered;
  if (lowered === 'rented') return 'inactive';
  return 'available';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
