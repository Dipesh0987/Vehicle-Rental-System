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
          const payload = {
            name: document.getElementById('editVehicleName')?.value?.trim() || selectedVehicle.name,
            category: document.getElementById('editVehicleCategory')?.value || selectedVehicle.category,
            status: selectedVehicle.status,
            daily: selectedVehicle.daily,
            weekly: selectedVehicle.weekly,
            seasonal: selectedVehicle.seasonal,
            image: selectedVehicle.image,
          };

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
      openModal({
        title: 'Confirm Vehicle Deletion',
        content: `<p>Vehicle <strong>${id}</strong> will be removed from availability and hidden from booking channels.</p>`,
        onConfirm: () => {
          if (!canDeleteCatalog) {
            notify('Catalog write mode is unavailable', 'error');
            return;
          }

          void (async () => {
            try {
              await catalogService.deleteVehicle(id);
              notify(`Vehicle ${id} deleted`, 'success');
              if (typeof reloadVehiclesData === 'function') {
                await reloadVehiclesData();
              }
            } catch (error) {
              notify(`Delete failed: ${error.message || 'Unknown error'}`, 'error');
            }
          })();
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

function openVehicleCreationDrawer({ notify, onCreated }) {
  const fuelTypes = getFuelTypeOptions();
  const localState = {
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

    if (input) {
      input.classList.toggle('border-rose-400', hasError);
      input.classList.toggle('focus:border-rose-500', hasError);
      input.classList.toggle('focus:ring-rose-200', hasError);
    }
  }

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

    const validation = syncValidation();
    if (!validation.valid) {
      notify('Please resolve form validation errors before submitting.', 'warn');
      return;
    }

    setSubmitting(true);

    try {
      const created = await createAdminVehicle(getDraft());
      notify('Vehicle saved successfully and published for booking.', 'success');
      onCreated?.(created);
      closeDrawer?.();
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
  if (status === 'Available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'Unavailable') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (status === 'Maintenance') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (status === 'Inactive') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}

function renderVehicleEditDrawer(vehicle) {
  const selectedCategory = (value) => (vehicle.category === value ? 'selected' : '');

  return `
    <form id="editVehicleForm" class="space-y-3" data-vehicle-id="${vehicle.id}">
      <label class="block space-y-1"><span class="text-xs font-semibold">Vehicle Name</span><input id="editVehicleName" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" value="${vehicle.name}" placeholder="Enter vehicle name" /></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Category</span><select id="editVehicleCategory" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"><option ${selectedCategory('SUV')}>SUV</option><option ${selectedCategory('Sedan')}>Sedan</option><option ${selectedCategory('Bike')}>Bike</option><option ${selectedCategory('Electric')}>Electric</option><option ${selectedCategory('Luxury')}>Luxury</option></select></label>
      <label class="block space-y-1"><span class="text-xs font-semibold">Upload Image</span><input type="file" class="w-full text-xs" /></label>
      <button type="submit" class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save Changes</button>
    </form>
  `;
}
