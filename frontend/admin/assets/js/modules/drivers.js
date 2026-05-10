import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';
import { openModal, renderEmptyState } from '../ui.js';

const AVAILABILITY_OPTIONS = ['All', 'Available', 'On Trip', 'Off Shift', 'On Leave'];
const LICENCE_STATUS_OPTIONS = ['Valid', 'Expired', 'Suspended', 'Pending Verification'];

const driverUiState = {
  selectedDriverId: '',
  availabilityFilter: 'All',
  page: 1,
  mode: 'list', // list | detail | add | edit
};

export function renderDriversModule({ data, query, notify, rerender, driverService, reloadDriversData }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const sourceRows = Array.isArray(data?.drivers) ? data.drivers : [];

  if (driverUiState.mode === 'detail' && driverUiState.selectedDriverId) {
    const driver = sourceRows.find((d) => d.id === driverUiState.selectedDriverId);
    if (driver) {
      renderDetailView(host, driver, data, notify, rerender, driverService);
      return host;
    }
    driverUiState.mode = 'list';
    driverUiState.selectedDriverId = '';
  }

  if (driverUiState.mode === 'add' || driverUiState.mode === 'edit') {
    const editDriver = driverUiState.mode === 'edit'
      ? sourceRows.find((d) => d.id === driverUiState.selectedDriverId)
      : null;
    renderDriverForm(host, editDriver, data, notify, rerender, driverService, reloadDriversData);
    return host;
  }

  // --- List View ---
  let filtered = filterRows(sourceRows, query, ['id', 'name', 'licenceNumber', 'availability', 'assigned', 'phone']);
  if (driverUiState.availabilityFilter !== 'All') {
    filtered = filtered.filter((d) => d.availability === driverUiState.availabilityFilter);
  }

  const paged = paginateRows(filtered, driverUiState.page, 5);

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">Driver Management</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button id="addDriverBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">person_add</span> Add Driver
        </button>
      </div>
    </header>

    <!-- Availability Filter -->
    <div class="flex flex-wrap items-center gap-2">
      ${AVAILABILITY_OPTIONS.map(
        (opt) =>
          `<button data-filter-avail="${opt}" class="rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            driverUiState.availabilityFilter === opt
              ? 'bg-brand-500 text-white'
              : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
          }">${opt}</button>`
      ).join('')}
    </div>

    ${
      paged.rows.length === 0
        ? renderEmptyState({
            title: 'No drivers found',
            message: driverUiState.availabilityFilter !== 'All' ? 'Try changing the availability filter.' : 'Add a new driver to get started.',
            actionLabel: 'Add Driver',
            actionId: 'emptyAddDriverBtn',
          })
        : `<section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-slate-900 dark:text-slate-100">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Driver</th>
              <th class="pb-2 pr-3">Licence Status</th>
              <th class="pb-2 pr-3">Availability</th>
              <th class="pb-2 pr-3">Current Assignment</th>
              <th class="pb-2 pr-3">Phone</th>
              <th class="pb-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${paged.rows
              .map(
                (row) => `<tr class="border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 cursor-pointer" data-driver-row="${row.id}">
                  <td class="py-3 pr-3">
                    <p class="font-bold text-slate-900 dark:text-white">${escapeHtml(row.name)}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.id)}</p>
                  </td>
                  <td class="py-3 pr-3"><span class="${licenceStatusClass(row.licenceStatus)}">${escapeHtml(row.licenceStatus || 'N/A')}</span></td>
                  <td class="py-3 pr-3"><span class="${availabilityClass(row.availability)}">${escapeHtml(row.availability)}</span></td>
                  <td class="py-3 pr-3 text-slate-700 dark:text-slate-300">${escapeHtml(row.assigned)}</td>
                  <td class="py-3 pr-3 text-slate-700 dark:text-slate-300">${escapeHtml(row.phone || '-')}</td>
                  <td class="py-3 pr-3 text-right whitespace-nowrap">
                    <button data-edit-driver="${row.id}" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" title="Edit">
                      <span class="material-symbols-outlined text-[14px] align-middle">edit</span>
                    </button>
                    <button data-delete-driver="${row.id}" class="ml-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10" title="Delete">
                      <span class="material-symbols-outlined text-[14px] align-middle">delete</span>
                    </button>
                  </td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div id="driverPagination" class="mt-3 flex justify-end"></div>
    </section>`
    }
  `;

  // --- Bind Events ---
  // Add driver button
  const addBtn = host.querySelector('#addDriverBtn') || host.querySelector('#emptyAddDriverBtn');
  addBtn?.addEventListener('click', () => {
    driverUiState.mode = 'add';
    driverUiState.selectedDriverId = '';
    rerender();
  });

  // Availability filter
  host.querySelectorAll('[data-filter-avail]').forEach((btn) => {
    btn.addEventListener('click', () => {
      driverUiState.availabilityFilter = btn.getAttribute('data-filter-avail') || 'All';
      driverUiState.page = 1;
      rerender();
    });
  });

  // Row click → detail view
  host.querySelectorAll('[data-driver-row]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-driver]') || e.target.closest('[data-delete-driver]')) return;
      driverUiState.selectedDriverId = row.getAttribute('data-driver-row');
      driverUiState.mode = 'detail';
      rerender();
    });
  });

  // Edit buttons
  host.querySelectorAll('[data-edit-driver]').forEach((btn) => {
    btn.addEventListener('click', () => {
      driverUiState.selectedDriverId = btn.getAttribute('data-edit-driver');
      driverUiState.mode = 'edit';
      rerender();
    });
  });

  // Delete buttons
  host.querySelectorAll('[data-delete-driver]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const driverId = btn.getAttribute('data-delete-driver');
      const driver = sourceRows.find((d) => d.id === driverId);
      openModal({
        title: 'Delete Driver',
        content: `<p>Are you sure you want to delete <strong>${escapeHtml(driver?.name || driverId)}</strong>?</p><p class="mt-2 text-xs text-slate-500">This action cannot be undone.</p>`,
        onConfirm: async () => {
          if (driverService && typeof driverService.deleteDriver === 'function') {
            try {
              await driverService.deleteDriver(driverId);
            } catch (err) {
              notify(`DB delete failed: ${err.message}`, 'error');
              return;
            }
          }
          data.drivers = data.drivers.filter((d) => d.id !== driverId);
          notify(`Driver ${driverId} deleted`, 'success');
          rerender();
        },
      });
    });
  });

  // Pagination
  const pagHost = host.querySelector('#driverPagination');
  if (pagHost && paged.pages > 1) {
    pagHost.appendChild(
      renderPagination(paged, (newPage) => {
        driverUiState.page = newPage;
        rerender();
      })
    );
  }

  return host;
}

// ─── Detail View ─────────────────────────────────────────────
function renderDetailView(host, driver, data, notify, rerender, driverService) {
  host.innerHTML = `
    <header class="flex flex-wrap items-center gap-3">
      <button id="driverBackBtn" class="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Driver Detail</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">${escapeHtml(driver.name)}</h2>
      </div>
      <div class="ml-auto flex gap-2">
        <button id="detailEditBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">edit</span> Edit
        </button>
        <button id="detailDeleteBtn" class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10">
          <span class="material-symbols-outlined mr-1 text-[16px] align-middle">delete</span> Delete
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- Personal Info Card -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-3">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Personal Information</h3>
        ${detailField('Full Name', driver.name)}
        ${detailField('Driver ID', driver.id)}
        ${detailField('Phone', driver.phone || '-')}
        ${detailField('Email', driver.email || '-')}
        ${detailField('Date of Birth', driver.dateOfBirth || '-')}
        ${detailField('Address', driver.address || '-')}
      </section>

      <!-- Licence & Assignment Card -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-3">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Licence & Assignment</h3>
        ${detailField('Licence Number', driver.licenceNumber || '-')}
        ${detailField('Licence Expiry', driver.licenceExpiry || '-')}
        <div class="flex items-center justify-between py-1">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Licence Status</span>
          <span class="${licenceStatusClass(driver.licenceStatus)}">${escapeHtml(driver.licenceStatus || 'N/A')}</span>
        </div>
        <div class="flex items-center justify-between py-1">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Availability</span>
          <span class="${availabilityClass(driver.availability)}">${escapeHtml(driver.availability)}</span>
        </div>
        ${detailField('Current Booking', driver.assigned || '-')}
        ${detailField('Vehicle Assigned', driver.vehicleAssigned || '-')}
        ${detailField('Experience', (driver.experienceYears || 0) + ' years')}
      </section>

      <!-- Notes Card -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-3 md:col-span-2">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Notes</h3>
        <p class="text-sm text-slate-700 dark:text-slate-300">${escapeHtml(driver.notes) || 'No notes.'}</p>
        ${driver.onboardedAt ? `<p class="text-xs text-slate-400">Onboarded: ${escapeHtml(driver.onboardedAt)}</p>` : ''}
      </section>
    </div>
  `;

  host.querySelector('#driverBackBtn')?.addEventListener('click', () => {
    driverUiState.mode = 'list';
    driverUiState.selectedDriverId = '';
    rerender();
  });

  host.querySelector('#detailEditBtn')?.addEventListener('click', () => {
    driverUiState.mode = 'edit';
    rerender();
  });

  host.querySelector('#detailDeleteBtn')?.addEventListener('click', () => {
    openModal({
      title: 'Delete Driver',
      content: `<p>Are you sure you want to delete <strong>${escapeHtml(driver.name)}</strong>?</p><p class="mt-2 text-xs text-slate-500">This action cannot be undone.</p>`,
      onConfirm: async () => {
        if (driverService && typeof driverService.deleteDriver === 'function') {
          try {
            await driverService.deleteDriver(driver.id);
          } catch (err) {
            notify(`DB delete failed: ${err.message}`, 'error');
            return;
          }
        }
        data.drivers = data.drivers.filter((d) => d.id !== driver.id);
        driverUiState.mode = 'list';
        driverUiState.selectedDriverId = '';
        notify(`Driver ${driver.id} deleted`, 'success');
        rerender();
      },
    });
  });
}

// ─── Add / Edit Form ─────────────────────────────────────────
function renderDriverForm(host, existingDriver, data, notify, rerender, driverService, reloadDriversData) {
  const isEdit = Boolean(existingDriver);
  const d = existingDriver || {};

  const today = new Date();
  const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const maxDobStr = maxDob.toISOString().slice(0, 10);

  host.innerHTML = `
    <header class="flex flex-wrap items-center gap-3">
      <button id="formBackBtn" class="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
        <h2 class="${classMap.heading} text-slate-900 dark:text-white">${isEdit ? 'Edit Driver' : 'Onboard New Driver'}</h2>
      </div>
    </header>

    <form id="driverForm" class="grid grid-cols-1 gap-4 md:grid-cols-2" novalidate>
      <!-- Personal Information -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Personal Information</h3>
        ${formField('Full Name', 'name', 'text', d.name, true, 'Enter full name')}
        ${formField('Phone', 'phone', 'tel', d.phone, true, '+977-98XXXXXXXX')}
        ${formField('Email', 'email', 'email', d.email, false, 'email@example.com')}
        ${formField('Date of Birth', 'dateOfBirth', 'date', d.dateOfBirth, false, '', 'max="' + maxDobStr + '"')}
        ${formTextarea('Address', 'address', d.address, false, 'Full address')}
      </section>

      <!-- Licence & Work Details -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Licence & Work Details</h3>
        ${formField('Driver ID', 'driverId', 'text', d.id, true, 'e.g. D-55')}
        ${formField('Licence Number', 'licenceNumber', 'text', d.licenceNumber, true, 'LIC-XXXX-XXXXX')}
        ${formField('Licence Expiry', 'licenceExpiry', 'date', d.licenceExpiry, true)}
        ${formSelect('Licence Status', 'licenceStatus', LICENCE_STATUS_OPTIONS, d.licenceStatus || 'Valid')}
        ${formSelect('Availability', 'availability', AVAILABILITY_OPTIONS.filter((o) => o !== 'All'), d.availability || 'Available')}
        ${formField('Experience (years)', 'experienceYears', 'number', d.experienceYears, false, '0')}
      </section>

      <!-- Assignment & Notes -->
      <section class="${classMap.panel} p-4 sm:p-5 space-y-4 md:col-span-2">
        <h3 class="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Assignment & Notes</h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          ${formField('Current Booking', 'assigned', 'text', d.assigned === '-' ? '' : d.assigned, false, 'BK-XXXX or leave empty')}
          ${formField('Vehicle Assigned', 'vehicleAssigned', 'text', d.vehicleAssigned, false, 'V-XXX or leave empty')}
        </div>
        ${formTextarea('Notes', 'notes', d.notes, false, 'Any remarks about this driver')}
      </section>

      <!-- Actions -->
      <div class="md:col-span-2 flex justify-end gap-2">
        <button type="button" id="formCancelBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Cancel</button>
        <button type="submit" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          ${isEdit ? 'Save Changes' : 'Add Driver'}
        </button>
      </div>
    </form>
  `;

  // Back / Cancel
  const goBack = () => {
    driverUiState.mode = isEdit ? 'detail' : 'list';
    if (!isEdit) driverUiState.selectedDriverId = '';
    rerender();
  };
  host.querySelector('#formBackBtn')?.addEventListener('click', goBack);
  host.querySelector('#formCancelBtn')?.addEventListener('click', goBack);

  // Submit
  host.querySelector('#driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const getValue = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

    const fullName = getValue('name');
    const phone = getValue('phone');
    const driverId = getValue('driverId');
    const licenceNumber = getValue('licenceNumber');
    const licenceExpiry = getValue('licenceExpiry');
    const dob = getValue('dateOfBirth');
    const expYears = getValue('experienceYears');

    // Required fields
    if (!fullName || !phone || !driverId || !licenceNumber || !licenceExpiry) {
      notify('Please fill in all required fields (marked with *)', 'error');
      return;
    }

    // Phone: at least 7 digits
    if (!/\d{7,}/.test(phone.replace(/[\s\-+()]/g, ''))) {
      notify('Phone number must contain at least 7 digits', 'error');
      return;
    }

    // Date of birth: must be at least 18 years old
    if (dob) {
      const dobDate = new Date(dob);
      const minBirthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      if (dobDate > minBirthDate) {
        notify('Driver must be at least 18 years old', 'error');
        return;
      }
    }

    // Experience: must not be negative
    if (expYears !== '' && parseInt(expYears, 10) < 0) {
      notify('Experience years cannot be negative', 'error');
      return;
    }

    // Licence expiry: must be a valid future or current date
    if (licenceExpiry && new Date(licenceExpiry) < new Date(new Date().toDateString())) {
      // warn but don't block — licence may already be expired
    }

    // Check duplicate ID
    if (!isEdit || (isEdit && driverId !== existingDriver.id)) {
      if (data.drivers.some((d) => d.id === driverId)) {
        notify(`Driver ID "${driverId}" already exists`, 'error');
        return;
      }
    }

    const driverObj = {
      id: driverId,
      name: fullName,
      phone,
      email: getValue('email'),
      dateOfBirth: getValue('dateOfBirth'),
      address: getValue('address'),
      licenceNumber,
      licenceExpiry,
      licenceStatus: getValue('licenceStatus'),
      availability: getValue('availability'),
      assigned: getValue('assigned') || '-',
      vehicleAssigned: getValue('vehicleAssigned'),
      experienceYears: parseInt(getValue('experienceYears'), 10) || 0,
      photoUrl: d.photoUrl || '',
      notes: getValue('notes'),
      onboardedAt: isEdit ? (d.onboardedAt || '') : new Date().toISOString().slice(0, 10),
    };

    const submitBtn = host.querySelector('#driverForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    if (driverService) {
      try {
        if (isEdit) {
          await driverService.updateDriver(existingDriver.id, driverObj);
        } else {
          await driverService.addDriver(driverObj);
        }
        if (typeof reloadDriversData === 'function') {
          await reloadDriversData();
        }
      } catch (err) {
        notify(`DB save failed: ${err.message}`, 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save Changes' : 'Add Driver'; }
        return;
      }
    }

    if (isEdit) {
      const idx = data.drivers.findIndex((dr) => dr.id === existingDriver.id);
      if (idx >= 0) data.drivers[idx] = driverObj;
      notify(`Driver ${driverObj.name} updated`, 'success');
    } else {
      if (!data.drivers.some((dr) => dr.id === driverObj.id)) {
        data.drivers.unshift(driverObj);
      }
      notify(`Driver ${driverObj.name} onboarded`, 'success');
    }

    driverUiState.selectedDriverId = driverObj.id;
    driverUiState.mode = 'detail';
    rerender();
  });
}

// ─── Helper Renderers ────────────────────────────────────────
function detailField(label, value) {
  return `<div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
    <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${label}</span>
    <span class="text-sm font-semibold text-slate-900 dark:text-white">${escapeHtml(value)}</span>
  </div>`;
}

function formField(label, name, type, value, required, placeholder, extraHtml = '') {
  const extraAttrs = type === 'number' ? ' min="0"' : '';
  return `<div>
    <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">${label}${required ? ' <span class="text-rose-500">*</span>' : ''}</label>
    <input name="${name}" type="${type}" value="${escapeHtml(value || '')}" ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} ${required ? 'required' : ''}${extraAttrs}${extraHtml ? ' ' + extraHtml : ''}
      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white" />
  </div>`;
}

function formTextarea(label, name, value, required, placeholder) {
  return `<div>
    <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">${label}${required ? ' <span class="text-rose-500">*</span>' : ''}</label>
    <textarea name="${name}" rows="2" ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} ${required ? 'required' : ''}
      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white">${escapeHtml(value || '')}</textarea>
  </div>`;
}

function formSelect(label, name, options, selected) {
  return `<div>
    <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">${label}</label>
    <select name="${name}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white">
      ${options.map((o) => `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
    </select>
  </div>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function availabilityClass(value) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (value === 'Available') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (value === 'On Trip') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (value === 'On Leave') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
}

function licenceStatusClass(value) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (value === 'Valid') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (value === 'Expired') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (value === 'Suspended') return `${base} bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300`;
  if (value === 'Pending Verification') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
}
