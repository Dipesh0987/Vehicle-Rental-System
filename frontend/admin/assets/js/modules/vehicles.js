import { classMap } from '../config.js';
import { escapeHtml, formatNpr, formatDateTime, formatDate } from '../utils.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';
import { openDrawer, openModal, renderEmptyState } from '../ui.js';

const DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=640&q=80';

const TYPE_OPTIONS = ['Sedan', 'SUV', 'Hatchback', 'Luxury', 'Van', 'Electric'];
const STATUS_OPTIONS = ['Available', 'Unavailable', 'Maintenance', 'Inactive'];
const REQUIRED_FUEL_TYPES = ['Petrol', 'Diesel', 'Electric'];
const FALLBACK_ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const vehicleUiState = {
  selectedVehicleId: '',
  currentPage: 1,
};

export function renderVehiclesModule({ data, query, notify, catalogService, canWriteCatalog = false, reloadVehiclesData, rerender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const sourceRows = Array.isArray(data && data.vehicles) ? data.vehicles : [];
  const selectedVehicle = resolveSelectedVehicle(sourceRows);

  const filtered = filterRows(sourceRows, query, [
    'id',
    'name',
    'vehicleNumber',
    'vehicle_number',
    'brand',
    'category',
    'status',
    'fuelType',
    'fuel_type',
    'transmission',
    'location',
  ]);
  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a?.addedAt || a?.addedDate || a?.createdAt || a?.updatedAt || 0).getTime();
    const dateB = new Date(b?.addedAt || b?.addedDate || b?.createdAt || b?.updatedAt || 0).getTime();

    if (dateA !== dateB) {
      return dateB - dateA;
    }

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

  // Reset page if search query changed or current page exceeds available pages
  const maxPage = Math.max(1, Math.ceil(sorted.length / 8));
  if (vehicleUiState.currentPage > maxPage) {
    vehicleUiState.currentPage = 1;
  }

  const paged = paginateRows(sorted, vehicleUiState.currentPage, 8);

  const canCreateCatalog =
    Boolean(catalogService) &&
    (typeof catalogService.createVehicle === 'function' || typeof catalogService.saveVehicle === 'function');

  const canDeleteCatalog =
    Boolean(catalogService) &&
    typeof catalogService.deleteVehicle === 'function';

  const canDeleteWithWrite = canDeleteCatalog && Boolean(canWriteCatalog);

  if (selectedVehicle) {
    host.innerHTML = renderVehicleDetailPage(selectedVehicle);
  } else {
    host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
        <h2 class="${classMap.heading}">Vehicle Management</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button id="refreshVehiclesBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
        <button id="addVehicleBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 ${
          canCreateCatalog ? '' : 'opacity-60 cursor-not-allowed'
        }" ${canCreateCatalog ? '' : 'disabled'}>Add Vehicle</button>
      </div>
    </header>

    ${
      canCreateCatalog
        ? ''
        : '<p class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Catalog write mode is disabled because the shared database service is unavailable.</p>'
    }

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="mb-3 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Vehicle No.</th>
              <th class="pb-2 pr-3">Category</th>
              <th class="pb-2 pr-3">Specs</th>
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
                        <img src="${escapeHtml(vehicle.image || DEFAULT_IMAGE_URL)}" alt="${escapeHtml(vehicle.name)}" class="h-10 w-14 rounded-lg object-cover" />
                        <div>
                          <p class="font-bold">${escapeHtml(formatVehicleTitle(vehicle))}</p>
                          <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(vehicle.id)}</p>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 pr-3">
                      <span class="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-bold tracking-wider text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">${escapeHtml(vehicle.vehicleNumber || vehicle.vehicle_number || '-')}</span>
                    </td>
                    <td class="py-3 pr-3">${escapeHtml(vehicle.category || 'Vehicle')}</td>
                    <td class="py-3 pr-3">
                      <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(vehicle.transmission || 'Automatic')} | ${escapeHtml(vehicle.fuelType || 'Petrol')}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">${Number(vehicle.seats || 5)} seats</p>
                    </td>
                    <td class="py-3 pr-3"><span class="${statusClass(vehicle.status)}">${escapeHtml(vehicle.status || 'Available')}</span></td>
                    <td class="py-3 pr-3">${escapeHtml(formatNpr(vehicle.daily || 0))}</td>
                    <td class="py-3 pr-3">${escapeHtml(formatNpr(vehicle.weekly || 0))}</td>
                    <td class="py-3 pr-3">${escapeHtml(formatNpr(vehicle.seasonal || 0))}</td>
                    <td class="py-3 pr-3">
                      <div class="flex gap-2">
                        <button data-edit-id="${escapeHtml(vehicle.id)}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10" ${canWriteCatalog ? '' : 'disabled title="No write access"'}>Edit</button>
                        <button data-delete-id="${escapeHtml(vehicle.id)}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600 ${
                          canDeleteWithWrite ? '' : 'opacity-60 cursor-not-allowed'
                        }" ${canDeleteWithWrite ? '' : 'disabled title="No write access"'}>Delete</button>
                      </div>
                    </td>
                  </tr>`
                )
                .join('')
              : `<tr><td colspan="9" class="py-6">${renderEmptyState({ title: 'No vehicles found', message: 'Try changing your search query or clear filters.', actionLabel: 'Reset search', actionId: 'resetVehicleSearch' })}</td></tr>`}
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
  }

  const pagerHost = host.querySelector('#vehiclePager');
  if (pagerHost) {
    pagerHost.appendChild(renderPagination(paged, (nextPage) => {
      vehicleUiState.currentPage = nextPage;
      rerender?.();
    }));
  }

  host.querySelector('#refreshVehiclesBtn')?.addEventListener('click', async () => {
    if (typeof reloadVehiclesData === 'function') {
      await reloadVehiclesData();
      notify('Vehicle catalog refreshed', 'success');
    }
  });

  host.querySelector('#addVehicleBtn')?.addEventListener('click', () => {
    if (!canCreateCatalog) {
      notify('Catalog write mode is unavailable', 'error');
      return;
    }

    openVehicleDrawer({
      catalogService,
      notify,
      reloadVehiclesData,
    });
  });

  host.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-edit-id');
      const selectedVehicle = data.vehicles.find((vehicle) => vehicle.id === id);

      if (!selectedVehicle) {
        notify('Unable to open edit drawer: vehicle record not found.', 'error');
        return;
      }

      openDrawer({
        title: 'Edit Vehicle',
        content: renderVehicleEditDrawer(selectedVehicle),
      });

      const editForm = document.getElementById('editVehicleForm');

      // Wire up image file picker to show preview and update URL field
      const editImageFileInput = document.getElementById('editVehicleImageFile');
      const editImagePreview = document.getElementById('editVehicleImagePreview');
      const editImageUrlInput = document.getElementById('editVehiclePrimaryImageUrl');
      let editSelectedFile = null;

      editImageFileInput?.addEventListener('change', () => {
        const file = editImageFileInput.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          notify('Image must be less than 5 MB', 'warn');
          editImageFileInput.value = '';
          return;
        }
        editSelectedFile = file;
        const objectUrl = URL.createObjectURL(file);
        if (editImagePreview) {
          editImagePreview.innerHTML = `<img src="${objectUrl}" alt="New image" class="h-20 w-28 rounded-xl object-cover border border-brand-400 dark:border-brand-300" /><span class="text-xs font-semibold text-brand-600 dark:text-brand-300">${escapeHtml(file.name)}</span>`;
        }
      });

      editForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
          if (!catalogService || (typeof catalogService.updateVehicle !== 'function' && typeof catalogService.saveVehicle !== 'function')) {
            throw new Error('Catalog service is unavailable.');
          }

          // If a file was selected, read it as data URL for the image
          let resolvedImageUrl =
            editImageUrlInput?.value?.trim() ||
            selectedVehicle.primary_image_url ||
            selectedVehicle.image;

          if (editSelectedFile) {
            const dataUrls = await readFilesAsDataUrls([editSelectedFile]);
            if (dataUrls[0]) resolvedImageUrl = dataUrls[0];
          }

          const payload = {
            name: document.getElementById('editVehicleName')?.value?.trim() || selectedVehicle.name,
            type: document.getElementById('editVehicleType')?.value?.trim() || selectedVehicle.type || selectedVehicle.category,
            seats: Number(document.getElementById('editVehicleSeats')?.value || selectedVehicle.seats || 5),
            price_per_day: Number(document.getElementById('editVehiclePricePerDay')?.value || selectedVehicle.price_per_day || selectedVehicle.daily || 0),
            fuel_type: document.getElementById('editVehicleFuelType')?.value || selectedVehicle.fuel_type || selectedVehicle.fuelType || 'Petrol',
            status: document.getElementById('editVehicleStatus')?.value || normalizeStatusForDb(selectedVehicle.status),
            category: document.getElementById('editVehicleCategory')?.value || selectedVehicle.category,
            transmission: document.getElementById('editVehicleTransmission')?.value || selectedVehicle.transmission || 'Automatic',
            rating: Number(document.getElementById('editVehicleRating')?.value || selectedVehicle.rating || 4.6),
            location: document.getElementById('editVehicleLocation')?.value?.trim() || selectedVehicle.location || '',
            available: document.getElementById('editVehicleAvailable')?.checked ?? (selectedVehicle.available ?? true),
            is_active: document.getElementById('editVehicleIsActive')?.checked ?? (selectedVehicle.is_active ?? true),
            brand: document.getElementById('editVehicleBrand')?.value?.trim() || selectedVehicle.brand || 'General',
            primary_image_url: resolvedImageUrl,
          };

          if (!payload.name) {
            throw new Error('Vehicle name is required.');
          }

          if (typeof catalogService.updateVehicle === 'function') {
            await catalogService.updateVehicle(selectedVehicle.id, payload);
          } else {
            await catalogService.saveVehicle({ ...selectedVehicle, ...payload, id: selectedVehicle.id }, selectedVehicle.id);
          }

          document.getElementById('overlayHost')?.replaceChildren();
          if (typeof reloadVehiclesData === 'function') {
            await reloadVehiclesData();
          } else {
            rerender?.();
          }
          notify(`${payload.name || selectedVehicle.name || 'Vehicle'} updated successfully`, 'success');
        } catch (error) {
          notify(`Failed to update ${selectedVehicle.name || 'vehicle'}: ${error.message}`, 'error');
        }
      });

      notify(`Editing ${selectedVehicle.name || id}`, 'info');
    });
  });

  host.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-delete-id');
      openModal({
        title: 'Confirm Vehicle Deletion',
        content: `<p><strong>${escapeHtml((data.vehicles.find((v) => v.id === id) || {}).name || id)}</strong> will be removed from availability and hidden from booking channels.</p>`,
        onConfirm: () => {
          if (!canDeleteWithWrite) {
            notify('Catalog write mode is unavailable', 'error');
            return;
          }

          const vehicleName = (data.vehicles.find((v) => v.id === id) || {}).name || 'Vehicle';
          void (async () => {
            try {
              await catalogService.deleteVehicle(id);
              notify(`${vehicleName} deleted successfully`, 'success');
              if (typeof reloadVehiclesData === 'function') {
                await reloadVehiclesData();
              } else {
                rerender?.();
              }
            } catch (error) {
              const message = catalogService && typeof catalogService.toPublicError === 'function'
                ? catalogService.toPublicError(error, 'Unable to delete vehicle right now.')
                : (error && error.message ? error.message : 'Unknown error');
              notify(`Delete failed: ${message}`, 'error');
            }
          })();
        },
      });
    });
  });

  host.querySelector('[data-back-to-vehicles-list]')?.addEventListener('click', () => {
    vehicleUiState.selectedVehicleId = '';
    writeVehicleIdToHash('');
    rerender?.();
  });

  host.querySelector('#resetVehicleSearch')?.addEventListener('click', () => {
    notify('Reset search from global input', 'info');
  });

  return host;
}

function resolveSelectedVehicle(rows) {
  const selectedId = String(vehicleUiState.selectedVehicleId || readVehicleIdFromHash() || '').trim();
  if (!selectedId) {
    return null;
  }

  const selected = (Array.isArray(rows) ? rows : []).find((row) => String(row && row.id ? row.id : '') === selectedId) || null;
  if (!selected) {
    vehicleUiState.selectedVehicleId = '';
    writeVehicleIdToHash('');
    return null;
  }

  vehicleUiState.selectedVehicleId = selectedId;
  return selected;
}

function readVehicleIdFromHash() {
  const hash = String(window.location.hash || '').trim();
  if (!hash || hash.indexOf('#vehicle:') !== 0) {
    return '';
  }

  return decodeURIComponent(hash.replace('#vehicle:', '')).trim();
}

function writeVehicleIdToHash(value) {
  const id = String(value || '').trim();
  if (!id) {
    if (String(window.location.hash || '').indexOf('#vehicle:') === 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }

  history.replaceState(null, '', `${window.location.pathname}${window.location.search}#vehicle:${encodeURIComponent(id)}`);
}

function renderVehicleDetailPage(vehicle) {
  return `<section class="${classMap.panel} animate-fadeUp p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" data-back-to-vehicles-list class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[16px]">west</span>
        <span>Back to Vehicles</span>
      </button>
      <span class="${statusClass(vehicle && vehicle.status ? vehicle.status : 'Available')}">${escapeHtml(vehicle && vehicle.status ? vehicle.status : 'Available')}</span>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
        <div class="flex flex-wrap items-start gap-4">
          <img src="${escapeHtml(vehicle && vehicle.image ? vehicle.image : DEFAULT_IMAGE_URL)}" alt="${escapeHtml(vehicle && vehicle.name ? vehicle.name : 'Vehicle')}" class="h-40 w-full max-w-[260px] rounded-2xl object-cover" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Vehicle Detail Page</p>
            <h3 class="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">${escapeHtml(formatVehicleTitle(vehicle))}</h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(vehicle && vehicle.id ? vehicle.id : '')} · <span class="font-mono font-semibold tracking-wider">${escapeHtml(vehicle && (vehicle.vehicleNumber || vehicle.vehicle_number) ? (vehicle.vehicleNumber || vehicle.vehicle_number) : 'No vehicle number')}</span></p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button data-edit-id="${escapeHtml(vehicle && vehicle.id ? vehicle.id : '')}" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Edit Vehicle</button>
              <button data-delete-id="${escapeHtml(vehicle && vehicle.id ? vehicle.id : '')}" class="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600">Delete Vehicle</button>
            </div>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${renderVehicleField('Category', vehicle && vehicle.category ? vehicle.category : '-')}
          ${renderVehicleField('Brand', vehicle && vehicle.brand ? vehicle.brand : '-')}
          ${renderVehicleField('Transmission', vehicle && vehicle.transmission ? vehicle.transmission : '-')}
          ${renderVehicleField('Fuel Type', vehicle && vehicle.fuelType ? vehicle.fuelType : '-')}
          ${renderVehicleField('Seats', String(vehicle && vehicle.seats ? vehicle.seats : '5'))}
          ${renderVehicleField('Location', vehicle && vehicle.location ? vehicle.location : '-')}
          ${renderVehicleField('Daily', formatNpr(vehicle && vehicle.daily ? vehicle.daily : 0))}
          ${renderVehicleField('Weekly', formatNpr(vehicle && vehicle.weekly ? vehicle.weekly : 0))}
          ${renderVehicleField('Seasonal', formatNpr(vehicle && vehicle.seasonal ? vehicle.seasonal : 0))}
          ${renderVehicleField('Rating', String(vehicle && vehicle.rating ? vehicle.rating : '4.6'))}
        </div>
      </article>

      <aside class="space-y-3">
        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Vehicle Snapshot</h4>
          <div class="mt-3 space-y-2 text-xs">
            ${renderVehicleField('Vehicle ID', vehicle && vehicle.id ? vehicle.id : '-')}
            ${renderVehicleField('Vehicle Number', vehicle && (vehicle.vehicleNumber || vehicle.vehicle_number) ? (vehicle.vehicleNumber || vehicle.vehicle_number) : '-')}
            ${renderVehicleField('Status', vehicle && vehicle.status ? vehicle.status : '-')}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Features</h4>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(Array.isArray(vehicle && vehicle.features) && vehicle.features.length ? vehicle.features.join(', ') : 'No features listed.')}</p>
        </article>
      </aside>
    </div>
  </section>`;
}

function renderVehicleField(label, value) {
  return `<article class="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(value || '-')}</p>
  </article>`;
}

function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  const lowered = String(status || '').toLowerCase();
  if (lowered === 'available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (lowered === 'inactive' || lowered === 'unavailable' || lowered === 'rented') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (lowered === 'maintenance') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-200`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}

function renderVehicleEditDrawer(vehicle) {
  const selectedCategory = (value) => (String(vehicle?.category || '') === value ? 'selected' : '');
  const dbStatus = normalizeStatusForDb(vehicle?.status);
  const selectedStatus = (value) => (dbStatus === value ? 'selected' : '');
  const safeType = escapeHtml(vehicle?.type || vehicle?.category || 'sedan');
  const safeSeats = Number(vehicle?.seats || 5);
  const safePricePerDay = Number(vehicle?.price_per_day || vehicle?.daily || 0);
  const safeFuelType = escapeHtml(vehicle?.fuel_type || vehicle?.fuelType || 'Petrol');
  const safeTransmission = escapeHtml(vehicle?.transmission || 'Automatic');
  const safeRating = Number(vehicle?.rating || 4.6);
  const safeLocation = escapeHtml(vehicle?.location || '');
  const safeBrand = escapeHtml(vehicle?.brand || 'General');
  const safeImage = escapeHtml(vehicle?.primary_image_url || vehicle?.image || '');

  return `
    <form id="editVehicleForm" class="space-y-4" data-vehicle-id="${escapeHtml(vehicle?.id)}">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block space-y-1"><span class="text-xs font-semibold">Vehicle Name</span><input id="editVehicleName" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${escapeHtml(vehicle?.name)}" placeholder="Enter vehicle name" /></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Brand</span><input id="editVehicleBrand" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeBrand}" /></label>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block space-y-1"><span class="text-xs font-semibold">Type</span><input id="editVehicleType" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeType}" placeholder="sedan" /></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Category</span><select id="editVehicleCategory" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${selectedCategory('SUV')}>SUV</option><option ${selectedCategory('Sedan')}>Sedan</option><option ${selectedCategory('Bike')}>Bike</option><option ${selectedCategory('Electric')}>Electric</option><option ${selectedCategory('Luxury')}>Luxury</option></select></label>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block space-y-1"><span class="text-xs font-semibold">Seats</span><input id="editVehicleSeats" type="number" min="1" max="15" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${Number.isFinite(safeSeats) ? safeSeats : 5}" /></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Transmission</span><input id="editVehicleTransmission" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeTransmission}" /></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Fuel Type</span><select id="editVehicleFuelType" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${safeFuelType === 'Petrol' ? 'selected' : ''}>Petrol</option><option ${safeFuelType === 'Diesel' ? 'selected' : ''}>Diesel</option><option ${safeFuelType === 'Electric' ? 'selected' : ''}>Electric</option></select></label>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block space-y-1"><span class="text-xs font-semibold">Status</span><select id="editVehicleStatus" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${selectedStatus('available')}>available</option><option ${selectedStatus('maintenance')}>maintenance</option><option ${selectedStatus('inactive')}>inactive</option></select></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Price Per Day</span><input id="editVehiclePricePerDay" type="number" min="1" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${Number.isFinite(safePricePerDay) ? safePricePerDay : 0}" /></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Rating</span><input id="editVehicleRating" type="number" step="0.01" min="0" max="5" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${Number.isFinite(safeRating) ? safeRating : 4.6}" /></label>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block space-y-1"><span class="text-xs font-semibold">Location</span><input id="editVehicleLocation" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeLocation}" /></label>
        <label class="block space-y-1"><span class="text-xs font-semibold">Primary Image URL</span><input id="editVehiclePrimaryImageUrl" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${safeImage}" placeholder="https://..." /></label>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2"><input id="editVehicleAvailable" type="checkbox" class="h-4 w-4" ${vehicle?.available !== false ? 'checked' : ''} /><span class="text-xs font-semibold">Available</span></label>
        <label class="flex items-center gap-2"><input id="editVehicleIsActive" type="checkbox" class="h-4 w-4" ${vehicle?.is_active !== false ? 'checked' : ''} /><span class="text-xs font-semibold">Is Active</span></label>
      </div>

      <div class="space-y-2">
        <span class="text-xs font-semibold">Current Image</span>
        <div id="editVehicleImagePreview" class="flex items-center gap-3">
          ${safeImage ? `<img src="${safeImage}" alt="Current" class="h-20 w-28 rounded-xl object-cover border border-slate-200 dark:border-white/10" />` : '<p class="text-xs text-slate-400">No image set</p>'}
        </div>
        <label class="block space-y-1">
          <span class="text-xs font-semibold">Replace Image (upload file)</span>
          <input id="editVehicleImageFile" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
          <p class="text-[11px] text-slate-500 dark:text-slate-400">Selecting a file will replace the current image. Max 5 MB.</p>
        </label>
      </div>

      <button type="submit" class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save Changes</button>
    </form>
  `;
}

function normalizeStatusForDb(status) {
  const lowered = String(status || '').toLowerCase();
  if (lowered === 'available' || lowered === 'maintenance' || lowered === 'inactive') return lowered;
  if (lowered === 'rented' || lowered === 'unavailable') return 'inactive';
  return 'available';
}

function formatVehicleTitle(vehicle) {
  const brand = String(vehicle && vehicle.brand ? vehicle.brand : '').trim();
  const name = String(vehicle && vehicle.name ? vehicle.name : '').trim();
  const brandLower = brand.toLowerCase();
  const nameLower = name.toLowerCase();

  if (name) {
    if (!brand || brandLower === 'general') {
      return name;
    }

    if (nameLower === brandLower || nameLower.startsWith(`${brandLower} `)) {
      return name;
    }
  }

  if (brand && name) {
    return `${brand} ${name}`;
  }

  return name || brand || 'Vehicle';
}

function getCatalogLimits(catalogService) {
  const limits = (catalogService && catalogService.limits) || {};

  const maxImages = Number.isFinite(Number(limits.maxImages)) ? Number(limits.maxImages) : 5;
  const maxImageSizeBytes = Number.isFinite(Number(limits.maxImageSizeBytes))
    ? Number(limits.maxImageSizeBytes)
    : 5 * 1024 * 1024;
  const minSeats = Number.isFinite(Number(limits.minSeats)) ? Number(limits.minSeats) : 1;
  const maxSeats = Number.isFinite(Number(limits.maxSeats)) ? Number(limits.maxSeats) : 15;
  const minPricePerDay = Number.isFinite(Number(limits.minPricePerDay)) ? Number(limits.minPricePerDay) : 1;
  const maxPricePerDay = Number.isFinite(Number(limits.maxPricePerDay)) ? Number(limits.maxPricePerDay) : 100000;

  return {
    maxImages,
    maxImageSizeBytes,
    minSeats,
    maxSeats,
    minPricePerDay,
    maxPricePerDay,
  };
}

function normalizeBulkEnum(value, options, fallback) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }

  const match = options.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return match || fallback;
}

function parseBulkFeatures(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBulkVehicleRows(rawText, limits) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
  const errors = [];

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const columns = line.split('|').map((item) => item.trim());

    if (columns.length < 6) {
      errors.push(`Line ${lineNo}: Expected at least 6 values (name|vehicleNumber|type|fuelType|seats|dailyPrice).`);
      return;
    }

    const [name, vehicleNumberRaw, type, fuelType, seatsRaw, dailyPriceRaw, statusRaw, transmissionRaw, locationRaw, featuresRaw] = columns;
    const vehicleNumber = String(vehicleNumberRaw || '').toUpperCase();
    const seats = Number(seatsRaw);
    const pricePerDay = Number(dailyPriceRaw);

    if (!name) {
      errors.push(`Line ${lineNo}: Vehicle name is required.`);
      return;
    }

    if (!vehicleNumber) {
      errors.push(`Line ${lineNo}: Vehicle number is required.`);
      return;
    }

    if (!type) {
      errors.push(`Line ${lineNo}: Vehicle type is required.`);
      return;
    }

    if (!fuelType) {
      errors.push(`Line ${lineNo}: Fuel type is required.`);
      return;
    }

    if (!Number.isFinite(seats) || seats < limits.minSeats || seats > limits.maxSeats) {
      errors.push(`Line ${lineNo}: Seats must be between ${limits.minSeats} and ${limits.maxSeats}.`);
      return;
    }

    if (!Number.isFinite(pricePerDay) || pricePerDay < limits.minPricePerDay || pricePerDay > limits.maxPricePerDay) {
      errors.push(`Line ${lineNo}: Daily price must be between ${limits.minPricePerDay} and ${limits.maxPricePerDay}.`);
      return;
    }

    rows.push({
      name,
      vehicleNumber,
      type,
      fuelType,
      seats,
      pricePerDay,
      status: normalizeBulkEnum(statusRaw, STATUS_OPTIONS, 'Available'),
      transmission: normalizeBulkEnum(transmissionRaw, ['Automatic', 'Manual'], 'Automatic'),
      location: String(locationRaw || '').trim(),
      features: parseBulkFeatures(featuresRaw),
    });
  });

  return {
    rows,
    errors,
  };
}

function renderVehicleCreateForm({ limits, fuelTypes }) {
  return `
    <form id="vehicleCatalogForm" class="space-y-4 pb-6" novalidate>
      <div id="vehicleGlobalError" class="hidden rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300"></div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block space-y-1">
          <span class="text-xs font-semibold">Vehicle Name <span class="text-rose-500">*</span></span>
          <input name="name" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Toyota Corolla" />
          <p data-error-for="name" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
        </label>

        <label class="block space-y-1">
          <span class="text-xs font-semibold">Brand</span>
          <input name="brand" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Toyota" />
        </label>
      </div>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">Vehicle Number <span class="text-rose-500">*</span></span>
        <input name="vehicleNumber" class="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono uppercase tracking-wider dark:border-white/10 dark:bg-white/5" placeholder="BA-2-CHA-1234" />
        <p class="text-[11px] text-slate-500 dark:text-slate-400">Format: <span class="font-mono font-semibold">XX-0-XXX-0000</span> (e.g. BA-2-CHA-1234)</p>
        <p data-error-for="vehicleNumber" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
      </label>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block space-y-1">
          <span class="text-xs font-semibold">Vehicle Type <span class="text-rose-500">*</span></span>
          <select name="category" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <option value="">Select category</option>
            ${TYPE_OPTIONS.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}
          </select>
          <p data-error-for="type" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
        </label>

        <label class="block space-y-1">
          <span class="text-xs font-semibold">Status</span>
          <select name="status" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            ${STATUS_OPTIONS.map((status) => `<option value="${escapeHtml(status)}" ${status === 'Available' ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block space-y-1">
          <span class="text-xs font-semibold">Transmission</span>
          <select name="transmission" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <option value="Automatic">Automatic</option>
            <option value="Manual">Manual</option>
          </select>
        </label>

        <label class="block space-y-1">
          <span class="text-xs font-semibold">Fuel Type <span class="text-rose-500">*</span></span>
          <select name="fuelType" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <option value="">Select fuel</option>
            ${fuelTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}
          </select>
          <p data-error-for="fuelType" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
        </label>

        <label class="block space-y-1">
          <span class="text-xs font-semibold">Seats <span class="text-rose-500">*</span></span>
          <input name="seats" type="number" min="${limits.minSeats}" max="${limits.maxSeats}" value="5" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" />
          <p data-error-for="seats" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
        </label>
      </div>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">Daily Price (NPR) <span class="text-rose-500">*</span></span>
        <input name="dailyPrice" type="number" min="${limits.minPricePerDay}" max="${limits.maxPricePerDay}" step="0.01" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" />
        <p data-error-for="pricePerDay" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
      </label>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">User Rating</span>
        <input name="rating" type="number" min="0" max="5" step="0.1" value="4.6" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" />
        <p class="text-[11px] text-slate-500 dark:text-slate-400">This value feeds the public rating filter.</p>
        <p data-error-for="rating" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
      </label>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">Location</span>
        <input name="location" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Kathmandu" />
      </label>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">Features (comma separated)</span>
        <input name="features" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="AC, GPS, Bluetooth" />
      </label>

      <div class="space-y-2">
        <label class="block text-xs font-semibold">Vehicle Images <span class="text-rose-500">*</span></label>
        <input id="vehicleImageInput" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <p>Required. Up to ${limits.maxImages} images, max ${(limits.maxImageSizeBytes / (1024 * 1024)).toFixed(0)} MB each.</p>
          <p id="vehicleImageCount" class="font-semibold text-brand-700 dark:text-brand-200">0 / ${limits.maxImages}</p>
        </div>
        <p data-error-for="images" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
        <div id="vehicleImagePreviewGrid" class="grid grid-cols-2 gap-2"></div>
      </div>

      <div id="vehicleSuccessBanner" class="hidden rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-400/30 dark:bg-emerald-500/10">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-300">check_circle</span>
          <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-200" id="vehicleSuccessText">Vehicle added successfully!</p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button id="vehicleFormCancel" type="button" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Cancel</button>
        <button id="vehicleFormAddAnother" type="button" class="rounded-xl border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10">Add & Add Another</button>
        <button id="vehicleFormSubmit" type="submit" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Add Vehicle</button>
      </div>
    </form>
  `;
}

function openVehicleDrawer({ catalogService, notify, reloadVehiclesData }) {
  const limits = getCatalogLimits(catalogService);
  const runtimeFuelTypes = Array.isArray(catalogService?.fuelTypes) && catalogService.fuelTypes.length
    ? catalogService.fuelTypes
    : REQUIRED_FUEL_TYPES;
  const fuelTypes = REQUIRED_FUEL_TYPES.filter((fuel) =>
    runtimeFuelTypes.some((candidate) => String(candidate).toLowerCase() === fuel.toLowerCase())
  );

  const allowedImageMimeTypes = Array.isArray(catalogService?.allowedImageMimeTypes) && catalogService.allowedImageMimeTypes.length
    ? catalogService.allowedImageMimeTypes.map((item) => String(item).toLowerCase())
    : FALLBACK_ALLOWED_IMAGE_MIME_TYPES;

  const state = {
    files: [],
    previewUrls: [],
  };

  openDrawer({
    title: 'Add Vehicle',
    content: renderVehicleCreateForm({ limits, fuelTypes }),
  });

  const form = document.getElementById('vehicleCatalogForm');
  if (!form) {
    return;
  }

  const imageInput = form.querySelector('#vehicleImageInput');
  const imageCountEl = form.querySelector('#vehicleImageCount');
  const previewGrid = form.querySelector('#vehicleImagePreviewGrid');
  const globalError = form.querySelector('#vehicleGlobalError');
  const submitBtn = form.querySelector('#vehicleFormSubmit');
  const addAnotherBtn = form.querySelector('#vehicleFormAddAnother');
  const successBanner = form.querySelector('#vehicleSuccessBanner');
  const successText = form.querySelector('#vehicleSuccessText');
  let addAnotherMode = false;
  let addedCount = 0;
  let lastAddedName = '';

  const closeOverlay = () => {
    state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    state.previewUrls = [];

    const overlayHost = document.getElementById('overlayHost');
    if (overlayHost) {
      overlayHost.innerHTML = '';
    }
  };

  const setGlobalError = (message) => {
    if (!globalError) return;

    if (!message) {
      globalError.textContent = '';
      globalError.classList.add('hidden');
      return;
    }

    globalError.textContent = message;
    globalError.classList.remove('hidden');
  };

  const setFieldError = (field, message) => {
    const target = form.querySelector(`[data-error-for="${field}"]`);
    if (target) {
      target.textContent = message || '';
    }
  };

  const applyErrors = (errors) => {
    ['name', 'vehicleNumber', 'type', 'fuelType', 'seats', 'pricePerDay', 'rating', 'images'].forEach((key) => {
      setFieldError(key, errors[key] || '');
    });
  };

  const refreshImagePreview = () => {
    if (!previewGrid) {
      return;
    }

    state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    state.previewUrls = [];

    if (imageCountEl) {
      imageCountEl.textContent = `${state.files.length} / ${limits.maxImages}`;
    }

    if (!state.files.length) {
      previewGrid.innerHTML = '<p class="col-span-2 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs font-semibold text-slate-500 dark:border-white/20 dark:text-slate-400">No image selected yet.</p>';
      return;
    }

    previewGrid.innerHTML = state.files
      .map((file, index) => {
        const objectUrl = URL.createObjectURL(file);
        state.previewUrls.push(objectUrl);
        return `<article class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
          <img src="${objectUrl}" alt="${escapeHtml(file.name)}" class="h-24 w-full object-cover" />
          <div class="flex items-center justify-between gap-2 px-2 py-2">
            <p class="truncate text-[11px] font-semibold">${escapeHtml(file.name)}</p>
            <button type="button" data-remove-image-index="${index}" class="rounded-md border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-600">Remove</button>
          </div>
        </article>`;
      })
      .join('');

    previewGrid.querySelectorAll('[data-remove-image-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-remove-image-index') || -1);
        if (index < 0) return;

        state.files.splice(index, 1);
        refreshImagePreview();
      });
    });
  };

  const mergeSelectedFiles = (pickedFiles) => {
    const merged = [...state.files, ...pickedFiles];
    const deduped = [];
    const seen = new Set();

    merged.forEach((file) => {
      const key = `${file.name}::${file.size}::${file.lastModified}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      deduped.push(file);
    });

    if (deduped.length > limits.maxImages) {
      notify(`You can upload up to ${limits.maxImages} images. Extra files were ignored.`, 'warn');
    }

    state.files = deduped.slice(0, limits.maxImages);
    refreshImagePreview();
  };

  imageInput?.addEventListener('change', () => {
    const pickedFiles = Array.from(imageInput.files || []);
    mergeSelectedFiles(pickedFiles);
    imageInput.value = '';
  });

  form.querySelector('#vehicleFormCancel')?.addEventListener('click', () => {
    closeOverlay();
  });

  addAnotherBtn?.addEventListener('click', () => {
    addAnotherMode = true;
    form.requestSubmit?.() || form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  const resetFormForAnother = () => {
    // Reset form fields but keep category/status/transmission/fuel defaults
    const savedCategory = form.querySelector('[name="category"]')?.value || '';
    const savedStatus = form.querySelector('[name="status"]')?.value || 'Available';
    const savedTransmission = form.querySelector('[name="transmission"]')?.value || 'Automatic';
    const savedFuelType = form.querySelector('[name="fuelType"]')?.value || '';
    const savedLocation = form.querySelector('[name="location"]')?.value || '';

    form.reset();

    // Restore defaults that are likely the same for the next vehicle
    if (savedCategory) form.querySelector('[name="category"]').value = savedCategory;
    if (savedStatus) form.querySelector('[name="status"]').value = savedStatus;
    if (savedTransmission) form.querySelector('[name="transmission"]').value = savedTransmission;
    if (savedFuelType) form.querySelector('[name="fuelType"]').value = savedFuelType;
    if (savedLocation) form.querySelector('[name="location"]').value = savedLocation;
    form.querySelector('[name="seats"]').value = '5';
    form.querySelector('[name="rating"]').value = '4.6';

    // Clear images
    state.files = [];
    refreshImagePreview();

    // Clear errors
    applyErrors({});
    setGlobalError('');

    // Show success banner briefly
    addedCount += 1;
    if (successBanner && successText) {
      successText.textContent = `${lastAddedName || 'Vehicle'} added successfully! (${addedCount} added this session)`;
      successBanner.classList.remove('hidden');
      setTimeout(() => {
        successBanner.classList.add('hidden');
      }, 4000);
    }

    // Scroll to top of form
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Focus the name field
    form.querySelector('[name="name"]')?.focus();
  };

  refreshImagePreview();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    setGlobalError('');

    if (!catalogService || (typeof catalogService.createVehicle !== 'function' && typeof catalogService.saveVehicle !== 'function')) {
      notify('Catalog write mode is unavailable', 'error');
      return;
    }

    const formData = new FormData(form);

    const values = {
      name: String(formData.get('name') || '').trim(),
      brand: String(formData.get('brand') || '').trim(),
      vehicleNumber: String(formData.get('vehicleNumber') || '').trim().toUpperCase(),
      type: String(formData.get('category') || '').trim(),
      status: String(formData.get('status') || 'Available').trim(),
      transmission: String(formData.get('transmission') || 'Automatic').trim(),
      fuelType: String(formData.get('fuelType') || '').trim(),
      seats: Number(formData.get('seats') || NaN),
      pricePerDay: Number(formData.get('dailyPrice') || NaN),
      rating: Number(formData.get('rating') || NaN),
      location: String(formData.get('location') || '').trim(),
      features: String(formData.get('features') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      images: state.files.slice(),
    };

    const errors = {};

    if (!values.name) errors.name = 'Vehicle name is required.';
    if (!values.vehicleNumber) errors.vehicleNumber = 'Vehicle number is required.';
    else if (!isValidVehicleNumberFormat(values.vehicleNumber)) errors.vehicleNumber = 'Invalid format. Use XX-0-XXX-0000 (e.g. BA-2-CHA-1234).';
    if (!values.type) errors.type = 'Vehicle type is required.';
    if (!values.fuelType) errors.fuelType = 'Fuel type is required.';

    if (!Number.isFinite(values.seats) || values.seats < limits.minSeats || values.seats > limits.maxSeats) {
      errors.seats = `Seats must be between ${limits.minSeats} and ${limits.maxSeats}.`;
    }

    if (!Number.isFinite(values.pricePerDay) || values.pricePerDay < limits.minPricePerDay || values.pricePerDay > limits.maxPricePerDay) {
      errors.pricePerDay = `Daily price must be between ${limits.minPricePerDay} and ${limits.maxPricePerDay}.`;
    }

    if (Number.isFinite(values.rating) && (values.rating < 0 || values.rating > 5)) {
      errors.rating = 'Rating must be between 0 and 5.';
    }

    if (!values.images.length) {
      errors.images = 'At least one image is required.';
    } else if (values.images.length > limits.maxImages) {
      errors.images = `You can upload up to ${limits.maxImages} images.`;
    }

    if (!errors.images) {
      for (let i = 0; i < values.images.length; i += 1) {
        const file = values.images[i];
        const mime = String(file.type || '').toLowerCase();
        const size = Number(file.size || 0);

        if (!allowedImageMimeTypes.includes(mime)) {
          errors.images = 'Only JPG, PNG, and WEBP images are allowed.';
          break;
        }

        if (!Number.isFinite(size) || size <= 0 || size > limits.maxImageSizeBytes) {
          errors.images = `Each image must be less than ${(limits.maxImageSizeBytes / (1024 * 1024)).toFixed(0)} MB.`;
          break;
        }
      }
    }

    applyErrors(errors);

    if (Object.keys(errors).length) {
      notify('Please resolve form validation errors before submitting.', 'warn');
      return;
    }

    submitBtn?.setAttribute('disabled', 'true');
    submitBtn?.classList.add('opacity-70', 'cursor-not-allowed');

    try {
      if (typeof catalogService.createVehicle === 'function') {
        await catalogService.createVehicle(values);
      } else {
        const imageUrls = await readFilesAsDataUrls(values.images);
        await catalogService.saveVehicle({
          brand: values.brand || deriveBrandFromVehicleName(values.name),
          name: values.name,
          vehicleNumber: values.vehicleNumber,
          category: values.type,
          type: values.type,
          status: values.status,
          transmission: values.transmission,
          fuelType: values.fuelType,
          seats: values.seats,
          daily: values.pricePerDay,
          pricePerDay: values.pricePerDay,
          imageUrls,
          primaryImageUrl: imageUrls[0] || DEFAULT_IMAGE_URL,
          features: values.features,
          location: values.location,
          rating: Number.isFinite(values.rating) ? values.rating : 4.6,
        });
      }

      lastAddedName = values.name || 'Vehicle';
      notify(`${lastAddedName} added successfully`, 'success');

      if (addAnotherMode) {
        addAnotherMode = false;
        resetFormForAnother();
        // Reload data in background so the table updates
        if (typeof reloadVehiclesData === 'function') {
          reloadVehiclesData();
        }
      } else {
        closeOverlay();
        if (typeof reloadVehiclesData === 'function') {
          await reloadVehiclesData();
        }
      }
    } catch (error) {
      const errorMessage =
        catalogService && typeof catalogService.toPublicError === 'function'
          ? catalogService.toPublicError(error, 'Unable to save vehicle right now.')
          : String(error?.message || 'Unable to save vehicle right now.');

      setGlobalError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      submitBtn?.removeAttribute('disabled');
      submitBtn?.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  });
}

async function readFilesAsDataUrls(files) {
  const values = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event?.target?.result || ''));
      reader.onerror = () => reject(new Error('Unable to read selected image.'));
      reader.readAsDataURL(file);
    });

    if (dataUrl) {
      values.push(dataUrl);
    }
  }

  return values;
}

function isValidVehicleNumberFormat(value) {
  const cleaned = String(value || '').trim().toUpperCase();
  if (!cleaned) return false;
  // Nepali vehicle number format: XX-0-XXX-0000
  // Examples: BA-2-CHA-1234, BA-3-PA-2222, LU-1-KHA-5678
  // Pattern: 2 letters, dash, 1-2 digits, dash, 2-3 letters, dash, 4 digits
  return /^[A-Z]{2}-\d{1,2}-[A-Z]{2,3}-\d{4}$/.test(cleaned);
}


function deriveBrandFromVehicleName(vehicleName) {
  const cleaned = String(vehicleName || '').trim();
  if (!cleaned) {
    return 'General';
  }

  const firstWord = cleaned.split(/\s+/)[0] || '';
  return firstWord || 'General';
}
