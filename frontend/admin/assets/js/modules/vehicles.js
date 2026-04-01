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

const STATUS_OPTIONS = ['Available', 'Maintenance', 'Inactive'];

export function renderVehiclesModule({ data, query, notify, requestRender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  ensureVehiclesLoaded({ seedVehicles: data.vehicles || [], notify, requestRender });

  const filtered = filterRows(moduleState.vehicles, query || '', ['id', 'name', 'type', 'status', 'fuelType']);
  const sorted = sortRows(filtered, 'createdAt', 'desc');
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

  host.querySelector('#addVehicleBtn')?.addEventListener('click', () => {
    openVehicleCreationDrawer({
      notify,
      onCreated: (createdVehicles) => {
        const rows = (Array.isArray(createdVehicles) ? createdVehicles : [createdVehicles]).filter(Boolean);
        if (!rows.length) {
          return;
        }

        const mergedById = new Map(moduleState.vehicles.map((vehicle) => [vehicle.id, vehicle]));
        rows.forEach((vehicle) => {
          mergedById.set(vehicle.id, vehicle);
        });

        moduleState.vehicles = Array.from(mergedById.values());
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

function openVehicleCreationDrawer({ notify, onCreated }) {
  const fuelTypes = getFuelTypeOptions();
  const localState = {
    entries: [],
    entryCounter: 0,
    submitting: false,
    maxImages: 5,
  };

  function createEntryState() {
    localState.entryCounter += 1;
    return {
      key: `vehicle-entry-${Date.now()}-${localState.entryCounter}`,
      files: [],
      previewUrls: [],
    };
  }

  localState.entries.push(createEntryState());

  const closeDrawer = openDrawer({
    title: 'Add New Vehicle',
    content: renderVehicleFormContent(fuelTypes),
    panelClassName: 'max-w-[780px]',
    panelStyle: 'max-width: 780px;',
    onClose: () => {
      localState.entries.forEach((entry) => {
        entry.previewUrls.forEach((url) => URL.revokeObjectURL(url));
        entry.previewUrls = [];
      });
    },
  });

  const overlayHost = document.getElementById('overlayHost');
  const form = overlayHost?.querySelector('#adminVehicleCreateForm');
  if (!form) {
    return;
  }

  const entriesHost = form.querySelector('#vehicleBatchList');
  const addAnotherButton = form.querySelector('#vehicleAddAnotherBtn');

  const submitButtons = [form.querySelector('#vehicleSubmitBtn')].filter(Boolean);
  const submitLabels = [form.querySelector('#vehicleSubmitLabel')].filter(Boolean);
  const globalError = form.querySelector('#vehicleFormGlobalError');

  function getEntryFieldRefs(entry) {
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

  function getBatchSubmitLabel(count) {
    if (count <= 1) {
      return 'Add Vehicle';
    }

    return `Add ${count} Vehicles`;
  }

  function clearEntryPreviews(entry) {
    entry.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    entry.previewUrls = [];
  }

  function renderEntryImagePreview(entry) {
    const refs = getEntryFieldRefs(entry);
    const previewGrid = refs.previewGrid;
    const imageStats = refs.imageStats;

    if (!previewGrid) {
      return;
    }

    clearEntryPreviews(entry);

    if (!entry.files.length) {
      previewGrid.innerHTML = '<p class="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs font-semibold text-slate-500 dark:border-white/20 dark:text-slate-400">No image selected yet.</p>';

      if (imageStats) {
        imageStats.textContent = `0 / ${localState.maxImages} selected`;
      }

      return;
    }

    if (imageStats) {
      imageStats.textContent = `${entry.files.length} / ${localState.maxImages} selected`;
    }

    previewGrid.innerHTML = entry.files
      .map((file, index) => {
        const objectUrl = URL.createObjectURL(file);
        entry.previewUrls.push(objectUrl);

        return `<article class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
          <img src="${objectUrl}" alt="${file.name}" class="h-24 w-full object-cover" />
          <div class="space-y-1 px-2 py-2">
            <p class="truncate text-xs font-semibold">${file.name}</p>
            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] text-slate-500 dark:text-slate-400">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <button type="button" data-entry-key="${entry.key}" data-remove-image-index="${index}" class="rounded-md border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10">Remove</button>
            </div>
          </div>
        </article>`;
      })
      .join('');

    previewGrid.querySelectorAll('[data-remove-image-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-remove-image-index') || -1);
        if (index < 0) return;
        entry.files.splice(index, 1);
        renderEntryImagePreview(entry);
        syncValidation();
      });
    });
  }

  function updateEntryHeaders() {
    localState.entries.forEach((entry, index) => {
      const article = form.querySelector(`[data-entry-key="${entry.key}"]`);
      if (!article) {
        return;
      }

      const title = article.querySelector('[data-entry-title]');
      const removeButton = article.querySelector('[data-remove-entry]');

      if (title) {
        title.textContent = `Vehicle ${index + 1}`;
      }

      if (removeButton) {
        removeButton.classList.toggle('hidden', localState.entries.length === 1);
        removeButton.disabled = localState.submitting;
      }
    });
  }

  function removeEntry(entryKey) {
    if (localState.entries.length === 1) {
      return;
    }

    const index = localState.entries.findIndex((entry) => entry.key === entryKey);
    if (index < 0) {
      return;
    }

    clearEntryPreviews(localState.entries[index]);
    localState.entries.splice(index, 1);

    const article = form.querySelector(`[data-entry-key="${entryKey}"]`);
    article?.remove();

    updateEntryHeaders();
    syncValidation();
  }

  function bindEntryListeners(entry) {
    const refs = getEntryFieldRefs(entry);

    [refs.name, refs.type, refs.status, refs.seats, refs.pricePerDay, refs.fuelType].forEach((field) => {
      if (!field) return;
      field.addEventListener('input', syncValidation);
      field.addEventListener('change', syncValidation);
    });

    refs.images?.addEventListener('change', () => {
      const pickedFiles = Array.from(refs.images.files || []);
      const mergedFiles = [...entry.files, ...pickedFiles];

      const deduped = [];
      const seen = new Set();

      mergedFiles.forEach((file) => {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        deduped.push(file);
      });

      if (deduped.length > localState.maxImages) {
        notify(`You can upload up to ${localState.maxImages} images per vehicle. Extra files were ignored.`, 'warn');
      }

      entry.files = deduped.slice(0, localState.maxImages);
      refs.images.value = '';

      renderEntryImagePreview(entry);
      syncValidation();
    });

    form.querySelector(`[data-entry-key="${entry.key}"] [data-remove-entry]`)?.addEventListener('click', () => {
      removeEntry(entry.key);
    });

    renderEntryImagePreview(entry);
  }

  function appendEntry(entry) {
    if (!entriesHost) {
      return;
    }

    entriesHost.insertAdjacentHTML(
      'beforeend',
      renderVehicleEntryCard({
        entryKey: entry.key,
        index: localState.entries.length - 1,
        fuelTypes,
        maxImages: localState.maxImages,
      })
    );

    bindEntryListeners(entry);
    updateEntryHeaders();
    syncValidation();
  }

  function setSubmitting(isSubmitting) {
    localState.submitting = isSubmitting;

    if (addAnotherButton) {
      addAnotherButton.disabled = isSubmitting;
    }

    submitButtons.forEach((button) => {
      button.disabled = isSubmitting;
    });

    submitLabels.forEach((label) => {
      label.textContent = isSubmitting
        ? `Adding ${localState.entries.length}...`
        : getBatchSubmitLabel(localState.entries.length);
    });

    form.querySelectorAll('[data-remove-entry]').forEach((button) => {
      button.disabled = isSubmitting;
    });
  }

  function syncValidation() {
    let allValid = true;
    let serviceError = '';

    localState.entries.forEach((entry) => {
      const validation = validateVehicleDraft(getEntryDraft(entry));
      const errors = validation.errors || {};

      ['name', 'type', 'seats', 'pricePerDay', 'fuelType', 'images'].forEach((field) => {
        setEntryFieldError(entry, field, errors[field] || '');
      });

      if (errors.service && !serviceError) {
        serviceError = errors.service;
      }

      if (!validation.valid) {
        allValid = false;
      }
    });

    setGlobalError(serviceError || '');

    submitButtons.forEach((button) => {
      button.disabled = localState.submitting || !localState.entries.length;
    });

    submitLabels.forEach((label) => {
      label.textContent = localState.submitting
        ? `Adding ${localState.entries.length}...`
        : getBatchSubmitLabel(localState.entries.length);
    });

    return { valid: allValid && !serviceError };
  }

  form.querySelector('#vehicleDrawerCancel')?.addEventListener('click', () => {
    closeDrawer?.();
  });

  addAnotherButton?.addEventListener('click', () => {
    if (localState.submitting) {
      return;
    }

    const entry = createEntryState();
    localState.entries.push(entry);
    appendEntry(entry);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (localState.submitting) {
      return;
    }

    setGlobalError('');

    const validation = syncValidation();
    if (!validation.valid) {
      notify('Please resolve form validation errors before submitting.', 'warn');
      return;
    }

    setSubmitting(true);
    const createdVehicles = [];

    try {
      for (const entry of localState.entries) {
        const created = await createAdminVehicle(getEntryDraft(entry));
        createdVehicles.push(created);
      }

      notify(`${createdVehicles.length} vehicle${createdVehicles.length === 1 ? '' : 's'} added successfully and published for booking.`, 'success');
      onCreated?.(createdVehicles);
      closeDrawer?.();
    } catch (error) {
      if (createdVehicles.length) {
        onCreated?.(createdVehicles);
        notify(`${createdVehicles.length} vehicle${createdVehicles.length === 1 ? '' : 's'} were added before an error occurred.`, 'warn');
      }

      const message = normalizeVehicleServiceError(error, error?.message || 'Unable to save vehicle right now.');
      setGlobalError(message);
      notify(message, 'error');
    } finally {
      setSubmitting(false);
      syncValidation();
    }
  });

  appendEntry(localState.entries[0]);
  syncValidation();
}

function renderVehicleFormContent(fuelTypes) {
  return `
    <form id="adminVehicleCreateForm" class="space-y-5 pb-8" novalidate>
      <div id="vehicleFormGlobalError" class="hidden rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300"></div>

      <div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Batch Add</p>
        </div>
        <button id="vehicleAddAnotherBtn" type="button" class="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20">
          <span class="text-base leading-none">+</span>
          <span>Add Another Vehicle</span>
        </button>
      </div>

      <div id="vehicleBatchList" class="space-y-4"></div>

      <div class="mt-6 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-8px_20px_rgba(10,31,34,0.1)] dark:border-white/10 dark:bg-[#151d22]/95">
        <div class="flex flex-wrap items-center justify-end gap-4">
          <button id="vehicleDrawerCancel" type="button" class="min-w-[120px] rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-900/5 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10">Cancel</button>
          <button id="vehicleSubmitBtn" type="submit" style="background-color:#1f7668;border-color:#1f7668;color:#ffffff;" class="min-w-[148px] rounded-xl border px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60">
            <span id="vehicleSubmitLabel" style="color:#ffffff;">Add Vehicle</span>
          </button>
        </div>
      </div>
    </form>
  `;
}

function renderVehicleEntryCard({ entryKey, index, fuelTypes, maxImages }) {
  return `
    <article data-entry-key="${entryKey}" class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h4 data-entry-title class="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Vehicle ${index + 1}</h4>
        <button data-remove-entry="${entryKey}" type="button" class="hidden rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10">Remove</button>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${renderTextField({
          id: `vehicleNameInput-${entryKey}`,
          label: 'Vehicle Name',
          placeholder: 'e.g. Tesla Model 3',
          errorKey: `${entryKey}:name`,
        })}

        ${renderTextField({
          id: `vehicleTypeInput-${entryKey}`,
          label: 'Vehicle Type',
          placeholder: 'e.g. Sedan, SUV, Hatchback',
          errorKey: `${entryKey}:type`,
        })}

        ${renderNumberField({
          id: `vehicleSeatsInput-${entryKey}`,
          label: 'Number of Seats',
          min: 1,
          max: 15,
          placeholder: 'e.g. 5',
          errorKey: `${entryKey}:seats`,
        })}

        ${renderNumberField({
          id: `vehiclePriceInput-${entryKey}`,
          label: 'Price per Day (USD)',
          min: 1,
          max: 100000,
          step: '0.01',
          placeholder: 'e.g. 120',
          errorKey: `${entryKey}:pricePerDay`,
        })}
      </div>

      <div class="mt-2 space-y-1">
        <label for="vehicleFuelTypeInput-${entryKey}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Fuel Type</label>
        <select id="vehicleFuelTypeInput-${entryKey}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900">
          <option value="">Select fuel type</option>
          ${fuelTypes.map((fuelType) => `<option value="${fuelType}">${fuelType}</option>`).join('')}
        </select>
        <p data-error-for="${entryKey}:fuelType" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
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
    </article>
  `;
}

function renderTextField({ id, label, placeholder, errorKey }) {
  return `
    <div class="space-y-1">
      <label for="${id}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">${label}</label>
      <input id="${id}" type="text" placeholder="${placeholder}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
      <p data-error-for="${errorKey}" class="min-h-[1.25rem] text-xs font-semibold text-rose-600"></p>
    </div>
  `;
}

function renderNumberField({ id, label, min, max, step = '1', placeholder, errorKey }) {
  return `
    <div class="space-y-1">
      <label for="${id}" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">${label}</label>
      <input id="${id}" type="number" min="${min}" max="${max}" step="${step}" placeholder="${placeholder}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-900" />
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
