import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';
import { openDrawer, openModal, renderEmptyState } from '../ui.js';
import {
  createAdminVehicle,
  getFuelTypeOptions,
  loadAdminVehicles,
  normalizeVehicleServiceError,
  validateVehicleDraft,
} from '../services/vehicle-admin.service.js';

export function renderVehiclesModule({ data, query, notify, catalogService, canWriteCatalog = false, rerender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const filtered = filterRows(data.vehicles, query, [
    'id',
    'name',
    'vehicleNumber',
    'brand',
    'category',
    'status',
    'fuelType',
    'transmission',
  ]);
  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a?.addedAt || a?.addedDate || 0).getTime();
    const dateB = new Date(b?.addedAt || b?.addedDate || 0).getTime();

    if (dateA !== dateB) {
      return dateB - dateA;
    }

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
  const paged = paginateRows(sorted, 1, 6);

  const canCreateCatalog =
    Boolean(catalogService) &&
    (typeof catalogService.createVehicle === 'function' || typeof catalogService.saveVehicle === 'function');

  const canDeleteCatalog =
    Boolean(catalogService) &&
    typeof catalogService.deleteVehicle === 'function';

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
        <h2 class="${classMap.heading}">Vehicle Management</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Create and publish vehicles with validated metadata and image uploads.</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="refreshVehiclesBtn" class="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-900/5 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10">Refresh</button>
        <button id="addVehicleBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Add Vehicle</button>
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
      ${moduleState.loading ? renderLoadingState() : ''}
      ${moduleState.error ? `<p class="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300">${moduleState.error}</p>` : ''}

      <div class="mb-3 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Vehicle No.</th>
              <th class="pb-2 pr-3">Category</th>
              <th class="pb-2 pr-3">Specs</th>
              <th class="pb-2 pr-3">Status</th>
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
                      <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(vehicle.vehicleNumber || '-')}</span>
                    </td>
                    <td class="py-3 pr-3">${escapeHtml(vehicle.category || 'Vehicle')}</td>
                    <td class="py-3 pr-3">
                      <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(vehicle.transmission || 'Automatic')} | ${escapeHtml(vehicle.fuelType || 'Petrol')}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">${Number(vehicle.seats || 5)} seats</p>
                    </td>
                    <td class="py-3 pr-3"><span class="${statusClass(vehicle.status)}">${escapeHtml(vehicle.status || 'Available')}</span></td>
                    <td class="py-3 pr-3">$${Number(vehicle.daily || 0).toLocaleString()}</td>
                    <td class="py-3 pr-3">$${Number(vehicle.weekly || 0).toLocaleString()}</td>
                    <td class="py-3 pr-3">$${Number(vehicle.seasonal || 0).toLocaleString()}</td>
                    <td class="py-3 pr-3">
                      <div class="flex gap-2">
                        <button data-delete-id="${escapeHtml(vehicle.id)}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600 ${
                          canDeleteCatalog ? '' : 'opacity-60 cursor-not-allowed'
                        }" ${canDeleteCatalog ? '' : 'disabled'}>Delete</button>
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
  `;

  const pagerHost = host.querySelector('#vehiclePager');
  if (pagerHost) {
    pagerHost.appendChild(
      renderPagination(paged, (nextPage) => {
        moduleState.page = nextPage;
        requestRender?.();
      })
    );
  }

  host.querySelector('#refreshVehiclesBtn')?.addEventListener('click', async () => {
    if (typeof reloadVehiclesData === 'function') {
      await reloadVehiclesData();
      notify('Vehicle catalog refreshed', 'success');
    }
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

  return host;
}

function ensureVehiclesLoaded({ seedVehicles, notify, requestRender }) {
  if (moduleState.initialized || moduleState.loading) {
    return;
  }

  moduleState.loading = true;
  moduleState.error = '';

  loadAdminVehicles(seedVehicles)
    .then((rows) => {
      moduleState.vehicles = rows;
      moduleState.initialized = true;
    })
    .catch((error) => {
      moduleState.error = normalizeVehicleServiceError(error, 'Unable to load vehicles right now.');
      notify(moduleState.error, 'error');
      moduleState.vehicles = [];
      moduleState.initialized = true;
    })
    .finally(() => {
      moduleState.loading = false;
      requestRender?.();
    });
}

function reloadVehicles({ seedVehicles, notify, requestRender }) {
  moduleState.initialized = false;
  ensureVehiclesLoaded({ seedVehicles, notify, requestRender });
  requestRender?.();
}

function renderVehicleCreateForm({ limits, fuelTypes }) {
  return `
    <form id="vehicleCatalogForm" class="space-y-4 pb-6" novalidate>
      <div id="vehicleGlobalError" class="hidden rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300"></div>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">Vehicle Name <span class="text-rose-500">*</span></span>
        <input name="name" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Toyota Corolla" />
        <p data-error-for="name" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
      </label>

      <label class="block space-y-1">
        <span class="text-xs font-semibold">Vehicle Number <span class="text-rose-500">*</span></span>
        <input name="vehicleNumber" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="BA-2-CHA-1234" />
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
        <span class="text-xs font-semibold">Daily Price (USD) <span class="text-rose-500">*</span></span>
        <input name="dailyPrice" type="number" min="${limits.minPricePerDay}" max="${limits.maxPricePerDay}" step="0.01" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" />
        <p data-error-for="pricePerDay" class="min-h-[1.1rem] text-xs font-semibold text-rose-600"></p>
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

      <div class="flex items-center justify-end gap-2 pt-2">
        <button id="vehicleFormCancel" type="button" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Cancel</button>
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
    submitting: false,
  };

  const closeDrawer = openDrawer({
    title: 'Add New Vehicle',
    content: renderVehicleFormContent(fuelTypes),
    onClose: () => {
      localState.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      localState.previewUrls = [];
    },
  });

  const overlayHost = document.getElementById('overlayHost');
  const form = overlayHost?.querySelector('#adminVehicleCreateForm');
  if (!form) {
    return;
  }

  const fieldRefs = {
    name: form.querySelector('#vehicleNameInput'),
    type: form.querySelector('#vehicleTypeInput'),
    seats: form.querySelector('#vehicleSeatsInput'),
    pricePerDay: form.querySelector('#vehiclePriceInput'),
    fuelType: form.querySelector('#vehicleFuelTypeInput'),
    images: form.querySelector('#vehicleImagesInput'),
  };

  const submitButton = form.querySelector('#vehicleSubmitBtn');
  const submitLabel = form.querySelector('#vehicleSubmitLabel');
  const globalError = form.querySelector('#vehicleFormGlobalError');
  const previewGrid = form.querySelector('#vehiclePreviewGrid');

  const errorTargets = {
    name: form.querySelector('[data-error-for="name"]'),
    type: form.querySelector('[data-error-for="type"]'),
    seats: form.querySelector('[data-error-for="seats"]'),
    pricePerDay: form.querySelector('[data-error-for="pricePerDay"]'),
    fuelType: form.querySelector('[data-error-for="fuelType"]'),
    images: form.querySelector('[data-error-for="images"]'),
  };

  function getDraft() {
    return {
      name: form.querySelector(`#vehicleNameInput-${entry.key}`),
      type: form.querySelector(`#vehicleTypeInput-${entry.key}`),
      status: form.querySelector(`#vehicleStatusInput-${entry.key}`),
      seats: form.querySelector(`#vehicleSeatsInput-${entry.key}`),
      pricePerDay: form.querySelector(`#vehiclePriceInput-${entry.key}`),
      fuelType: form.querySelector(`#vehicleFuelTypeInput-${entry.key}`),
      images: form.querySelector(`#vehicleImagesInput-${entry.key}`),
      previewGrid: form.querySelector(`#vehiclePreviewGrid-${entry.key}`),
      imageStats: form.querySelector(`#vehicleImageStats-${entry.key}`),
    };
  }

  function getEntryDraft(entry) {
    const refs = getEntryFieldRefs(entry);

    return {
      name: refs.name?.value || '',
      type: refs.type?.value || '',
      status: refs.status?.value || 'Available',
      seats: refs.seats?.value || '',
      pricePerDay: refs.pricePerDay?.value || '',
      fuelType: refs.fuelType?.value || '',
      images: entry.files,
    };
  }

  function setEntryFieldError(entry, field, message) {
    const refs = getEntryFieldRefs(entry);
    const input = refs[field] || null;
    const target = form.querySelector(`[data-error-for="${entry.key}:${field}"]`);
    const hasError = Boolean(message);

    if (target) {
      target.textContent = message || '';
    }

  const applyErrors = (errors) => {
    ['name', 'vehicleNumber', 'type', 'fuelType', 'seats', 'pricePerDay', 'images'].forEach((key) => {
      setFieldError(key, errors[key] || '');
    });
  };

  function setGlobalError(message) {
    if (!globalError) {
      return;
    }

    if (!message) {
      globalError.classList.add('hidden');
      globalError.textContent = '';
      return;
    }

    globalError.classList.remove('hidden');
    globalError.textContent = message;
  }

  function renderImagePreview() {
    if (!previewGrid) {
      return;
    }

    localState.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    localState.previewUrls = [];

    if (!localState.files.length) {
      previewGrid.innerHTML = '<p class="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs font-semibold text-slate-500 dark:border-white/20 dark:text-slate-400">No image selected yet.</p>';
      return;
    }

    previewGrid.innerHTML = localState.files
      .map((file, index) => {
        const objectUrl = URL.createObjectURL(file);
        localState.previewUrls.push(objectUrl);

        return `<article class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
          <img src="${objectUrl}" alt="${file.name}" class="h-24 w-full object-cover" />
          <div class="space-y-1 px-2 py-2">
            <p class="truncate text-xs font-semibold">${file.name}</p>
            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] text-slate-500 dark:text-slate-400">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <button type="button" data-remove-image-index="${index}" class="rounded-md border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10">Remove</button>
            </div>
          </div>
        </article>`;
      })
      .join('');

    previewGrid.querySelectorAll('[data-remove-image-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-remove-image-index') || -1);
        if (index < 0) return;
        localState.files.splice(index, 1);
        renderImagePreview();
        syncValidation();
      });
    });
  }

  function setSubmitting(isSubmitting) {
    localState.submitting = isSubmitting;
    if (submitButton) {
      submitButton.disabled = isSubmitting || submitButton.disabled;
    }

    if (submitLabel) {
      submitLabel.textContent = isSubmitting ? 'Saving Vehicle...' : 'Save Vehicle';
    }
  }

  function syncValidation() {
    const validation = validateVehicleDraft(getDraft());
    const errors = validation.errors || {};

    ['name', 'type', 'seats', 'pricePerDay', 'fuelType', 'images'].forEach((field) => {
      setFieldError(field, errors[field] || '');
    });

    if (errors.service) {
      setGlobalError(errors.service);
    } else {
      setGlobalError('');
    }

    if (submitButton) {
      submitButton.disabled = !validation.valid || localState.submitting;
    }

    return validation;
  }

  function bindEntryListeners(entry) {
    const refs = getEntryFieldRefs(entry);

    [refs.name, refs.type, refs.status, refs.seats, refs.pricePerDay, refs.fuelType].forEach((field) => {
      if (!field) return;
      field.addEventListener('input', syncValidation);
      field.addEventListener('change', syncValidation);
    });

    fieldRefs.images?.addEventListener('change', () => {
      localState.files = Array.from(fieldRefs.images.files || []);
      renderImagePreview();
      syncValidation();
    });
  }

  form.querySelector('#vehicleDrawerCancel')?.addEventListener('click', () => {
    closeDrawer?.();
  });

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
      vehicleNumber: String(formData.get('vehicleNumber') || '').trim().toUpperCase(),
      type: String(formData.get('category') || '').trim(),
      status: String(formData.get('status') || 'Available').trim(),
      transmission: String(formData.get('transmission') || 'Automatic').trim(),
      fuelType: String(formData.get('fuelType') || '').trim(),
      seats: Number(formData.get('seats') || NaN),
      pricePerDay: Number(formData.get('dailyPrice') || NaN),
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
    if (!values.type) errors.type = 'Vehicle type is required.';
    if (!values.fuelType) errors.fuelType = 'Fuel type is required.';

    if (!Number.isFinite(values.seats) || values.seats < limits.minSeats || values.seats > limits.maxSeats) {
      errors.seats = `Seats must be between ${limits.minSeats} and ${limits.maxSeats}.`;
    }

    if (!Number.isFinite(values.pricePerDay) || values.pricePerDay < limits.minPricePerDay || values.pricePerDay > limits.maxPricePerDay) {
      errors.pricePerDay = `Daily price must be between ${limits.minPricePerDay} and ${limits.maxPricePerDay}.`;
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

    setSubmitting(true);

    try {
      if (typeof catalogService.createVehicle === 'function') {
        await catalogService.createVehicle(values);
      } else {
        const imageUrls = await readFilesAsDataUrls(values.images);
        await catalogService.saveVehicle({
          brand: deriveBrandFromVehicleName(values.name),
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
          rating: 4.6,
        });
      }

      notify('Vehicle added to database', 'success');
      closeOverlay();
      if (typeof reloadVehiclesData === 'function') {
        await reloadVehiclesData();
      }
    } catch (error) {
      const message = normalizeVehicleServiceError(error, 'Unable to save vehicle right now.');
      setGlobalError(message);
      notify(message, 'error');
    } finally {
      setSubmitting(false);
      syncValidation();
    }
  });

  attachFieldListeners();
  renderImagePreview();
  syncValidation();
}

function renderVehicleFormContent(fuelTypes) {
  return `
    <form id="adminVehicleCreateForm" class="space-y-4" novalidate>
      <p class="text-sm text-slate-600 dark:text-slate-300">All fields are mandatory. Uploaded images are validated for count, type, and file size before submission.</p>

      <div id="vehicleFormGlobalError" class="hidden rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300"></div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${renderTextField({
          id: 'vehicleNameInput',
          label: 'Vehicle Name',
          placeholder: 'e.g. Tesla Model 3',
          errorKey: 'name',
        })}

        ${renderTextField({
          id: 'vehicleTypeInput',
          label: 'Vehicle Type',
          placeholder: 'e.g. Sedan, SUV, Hatchback',
          errorKey: 'type',
        })}

        ${renderNumberField({
          id: 'vehicleSeatsInput',
          label: 'Number of Seats',
          min: 1,
          max: 15,
          placeholder: 'e.g. 5',
          errorKey: 'seats',
        })}

        ${renderNumberField({
          id: 'vehiclePriceInput',
          label: 'Price per Day (USD)',
          min: 1,
          max: 100000,
          step: '0.01',
          placeholder: 'e.g. 120',
          errorKey: 'pricePerDay',
        })}
      </div>

      <div class="space-y-1">
        <label for="vehicleFuelTypeInput" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Fuel Type</label>
        <select id="vehicleFuelTypeInput" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900">
          <option value="">Select fuel type</option>
          ${fuelTypes.map((fuelType) => `<option value="${fuelType}">${fuelType}</option>`).join('')}
        </select>
        <p data-error-for="fuelType" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
      </div>

      <div class="mt-2 space-y-1">
        <label for="vehicleStatusInput-${entryKey}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Status</label>
        <select id="vehicleStatusInput-${entryKey}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900">
          ${STATUS_OPTIONS.map((status) => `<option value="${status}" ${status === 'Available' ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </div>

      <div class="mt-2 space-y-2">
        <label for="vehicleImagesInput-${entryKey}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Vehicle Images</label>
        <input id="vehicleImagesInput-${entryKey}" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        <div class="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>Select up to ${maxImages} files. Max 5 MB each.</p>
          <p id="vehicleImageStats-${entryKey}" class="font-semibold text-brand-700 dark:text-brand-200">0 / ${maxImages} selected</p>
        </div>
        <p data-error-for="${entryKey}:images" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
        <div id="vehiclePreviewGrid-${entryKey}" class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"></div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button id="vehicleDrawerCancel" type="button" class="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-900/5 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10">Cancel</button>
        <button id="vehicleSubmitBtn" type="submit" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-brand-600" disabled>
          <span id="vehicleSubmitLabel">Save Vehicle</span>
        </button>
      </div>
    </form>
  `;
}

function renderTextField({ id, label, placeholder, errorKey }) {
  return `
    <div class="space-y-1">
      <label for="${id}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">${label}</label>
      <input id="${id}" type="text" placeholder="${placeholder}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
      <p data-error-for="${errorKey}" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
    </div>
  `;
}

function renderNumberField({ id, label, min, max, step = '1', placeholder, errorKey }) {
  return `
    <div class="space-y-1">
      <label for="${id}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">${label}</label>
      <input id="${id}" type="number" min="${min}" max="${max}" step="${step}" placeholder="${placeholder}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
      <p data-error-for="${errorKey}" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
    </div>
  `;
}

function renderLoadingState() {
  return `<div class="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
    <span class="inline-flex h-3 w-3 animate-pulse rounded-full bg-brand-500"></span>
    Syncing vehicles from Supabase...
  </div>`;
}

function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
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
