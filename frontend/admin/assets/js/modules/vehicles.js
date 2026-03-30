import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination, sortRows } from '../table-utils.js';
import { openDrawer, openModal, renderEmptyState } from '../ui.js';
import {
  createAdminVehicle,
  getFuelTypeOptions,
  loadAdminVehicles,
  normalizeVehicleServiceError,
  validateVehicleDraft,
} from '../services/vehicle-admin.service.js';

const moduleState = {
  initialized: false,
  loading: false,
  vehicles: [],
  page: 1,
  pageSize: 8,
  error: '',
};

export function renderVehiclesModule({ data, query, notify, requestRender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  ensureVehiclesLoaded({ seedVehicles: data.vehicles || [], notify, requestRender });

  const filtered = filterRows(moduleState.vehicles, query || '', ['id', 'name', 'type', 'status', 'fuelType']);
  const sorted = sortRows(filtered, 'name');
  const paged = paginateRows(sorted, moduleState.page, moduleState.pageSize);
  moduleState.page = paged.page;

  const total = moduleState.vehicles.length;
  const availableCount = moduleState.vehicles.filter((item) => item.status === 'Available').length;

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
    </header>

    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <article class="${classMap.panel} p-4">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Fleet Total</p>
        <p class="mt-1 text-2xl font-extrabold">${total}</p>
      </article>
      <article class="${classMap.panel} p-4">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Bookable Now</p>
        <p class="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-300">${availableCount}</p>
      </article>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      ${moduleState.loading ? renderLoadingState() : ''}
      ${moduleState.error ? `<p class="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300">${moduleState.error}</p>` : ''}

      <div class="mb-3 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Type</th>
              <th class="pb-2 pr-3">Seats</th>
              <th class="pb-2 pr-3">Fuel</th>
              <th class="pb-2 pr-3">Price/Day</th>
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
                        <div class="h-11 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
                          ${vehicle.primaryImage
                            ? `<img src="${vehicle.primaryImage}" alt="${vehicle.name}" class="h-full w-full object-cover" />`
                            : '<div class="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-500">NO IMG</div>'}
                        </div>
                        <div>
                          <p class="font-bold">${vehicle.name}</p>
                          <p class="text-xs text-slate-500 dark:text-slate-400">${vehicle.id}</p>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 pr-3">${vehicle.type}</td>
                    <td class="py-3 pr-3">${vehicle.seats}</td>
                    <td class="py-3 pr-3">${vehicle.fuelType}</td>
                    <td class="py-3 pr-3">${formatCurrency(vehicle.pricePerDay)}</td>
                    <td class="py-3 pr-3"><span class="${statusClass(vehicle.status)}">${vehicle.status}</span></td>
                    <td class="py-3 pr-3">
                      <button data-delete-id="${vehicle.id}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10">Delete</button>
                    </td>
                  </tr>`
                )
                .join('')
              : `<tr><td colspan="7" class="py-6">${renderEmptyState({ title: 'No vehicles found', message: 'Add a new vehicle or adjust your search query.' })}</td></tr>`}
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

  host.querySelector('#refreshVehiclesBtn')?.addEventListener('click', () => {
    reloadVehicles({ seedVehicles: data.vehicles || [], notify, requestRender });
  });

  host.querySelector('#addVehicleBtn')?.addEventListener('click', () => {
    openVehicleCreationDrawer({
      notify,
      onCreated: (vehicle) => {
        moduleState.vehicles = [vehicle, ...moduleState.vehicles.filter((row) => row.id !== vehicle.id)];
        moduleState.page = 1;
        requestRender?.();
      },
    });
  });

  host.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-delete-id');
      openModal({
        title: 'Delete Vehicle',
        content: `<p>This demo only ships vehicle creation. Deletion for <strong>${id}</strong> is intentionally disabled in this release.</p>`,
        onConfirm: () => notify('Deletion workflow is not enabled yet.', 'info'),
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
      name: fieldRefs.name?.value || '',
      type: fieldRefs.type?.value || '',
      seats: fieldRefs.seats?.value || '',
      pricePerDay: fieldRefs.pricePerDay?.value || '',
      fuelType: fieldRefs.fuelType?.value || '',
      images: localState.files,
    };
  }

  function setFieldError(field, message) {
    const input = fieldRefs[field];
    const target = errorTargets[field];
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

  function attachFieldListeners() {
    Object.values(fieldRefs).forEach((field) => {
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

      <div class="space-y-2">
        <label for="vehicleImagesInput" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Vehicle Images</label>
        <input id="vehicleImagesInput" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        <p class="text-xs text-slate-500 dark:text-slate-400">Upload between 1 and 5 files. Allowed formats: JPG, PNG, WebP. Max 5 MB per image.</p>
        <p data-error-for="images" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
        <div id="vehiclePreviewGrid" class="grid grid-cols-1 gap-2 sm:grid-cols-2"></div>
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
  if (status === 'Inactive') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
}
