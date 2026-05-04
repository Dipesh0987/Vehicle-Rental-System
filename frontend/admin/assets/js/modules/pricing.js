import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../utils/table-utils.js';

let pricingUiState = {
  showCreateForm: false,
  editingCodeId: null,
  discountCodes: [],
  page: 1,
  pageSize: 10,
};

async function initializePricingModule() {
  try {
    const { data, error } = await window.supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    pricingUiState.discountCodes = data || [];
  } catch (error) {
    console.error('Error loading discount codes:', error);
    pricingUiState.discountCodes = [];
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function renderPricingOverview() {
  const searchInput = document.getElementById('pricingSearchInput');
  const searchTerm = searchInput?.value.toLowerCase() || '';
  
  const filteredCodes = filterRows(pricingUiState.discountCodes, searchTerm, ['code', 'description']);
  const paginatedCodes = paginateRows(filteredCodes, pricingUiState.page, pricingUiState.pageSize);

  return `
    <div class="space-y-6">
      <!-- Header -->
      <header class="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 class="${classMap.heading}">Discount Code Management</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Create and manage promotional codes</p>
        </div>
        <button id="createDiscountBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          + Create Discount Code
        </button>
      </header>

      <!-- Search -->
      <div class="relative">
        <input type="text" id="pricingSearchInput" placeholder="Search codes..." 
          value="${searchTerm}"
          class="w-full rounded-lg border border-slate-200 px-4 py-2 pl-10 dark:border-white/10 dark:bg-white/5">
        <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
      </div>

      <!-- Discount Table -->
      ${paginatedCodes.length > 0 ? `
        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
          <table class="w-full text-sm">
            <thead class="${classMap.tableHead}">
              <tr>
                <th class="px-4 py-3 text-left font-semibold">Code</th>
                <th class="px-4 py-3 text-left font-semibold">Type</th>
                <th class="px-4 py-3 text-left font-semibold">Discount</th>
                <th class="px-4 py-3 text-left font-semibold">Valid Period</th>
                <th class="px-4 py-3 text-left font-semibold">Usage</th>
                <th class="px-4 py-3 text-center font-semibold">Status</th>
                <th class="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${paginatedCodes.map(code => renderDiscountTable(code)).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="rounded-lg border border-slate-200 dark:border-white/10 p-8 text-center">
          <p class="text-slate-600 dark:text-slate-400">No discount codes found</p>
        </div>
      `}

      <!-- Pagination -->
      ${filteredCodes.length > pricingUiState.pageSize ? renderPagination(pricingUiState.page, Math.ceil(filteredCodes.length / pricingUiState.pageSize), (page) => {
        pricingUiState.page = page;
        // Trigger re-render via module manager
        document.getElementById('pricingModule')?.dispatchEvent(new CustomEvent('rerender'));
      }) : ''}
    </div>
  `;
}

function renderDiscountTable(code) {
  const discountDisplay = code.discount_type === 'percentage' ? `${code.discount_value}%` : `NPR ${code.discount_value.toFixed(2)}`;
  const validFrom = new Date(code.valid_from).toLocaleDateString();
  const validUntil = new Date(code.valid_until).toLocaleDateString();
  const usage = code.max_uses ? `${code.current_uses}/${code.max_uses}` : `${code.current_uses}`;

  return `
    <tr class="border-t border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">
      <td class="px-4 py-3 font-mono font-semibold text-brand-600 dark:text-brand-400">${escapeHtml(code.code)}</td>
      <td class="px-4 py-3">${code.discount_type === 'percentage' ? 'Percentage' : 'Fixed'}</td>
      <td class="px-4 py-3">${discountDisplay}</td>
      <td class="px-4 py-3 text-xs">${validFrom} - ${validUntil}</td>
      <td class="px-4 py-3">${usage}</td>
      <td class="px-4 py-3 text-center">
        <span class="inline-block px-2 py-1 rounded text-xs font-semibold ${code.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'}">
          ${code.is_active ? 'Active' : 'Disabled'}
        </span>
      </td>
      <td class="px-4 py-3 text-right">
        <div class="flex justify-end gap-2">
          <button data-toggle-code="${code.id}" class="text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10">
            ${code.is_active ? 'Disable' : 'Enable'}
          </button>
          <button data-edit-code="${code.id}" class="text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10">
            Edit
          </button>
          <button data-delete-code="${code.id}" class="text-xs font-semibold px-2 py-1 rounded border border-rose-200 text-rose-600 dark:border-rose-400/30 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderCreateDiscountCodeForm() {
  return `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="${classMap.heading}">Create New Discount Code</h2>
      </div>
      <button id="cancelBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10">Cancel</button>
    </header>

    <form id="discountCodeForm" class="${classMap.panel} p-6 sm:p-8">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label class="block text-sm font-semibold mb-2">Code</label>
          <input type="text" id="codeInput" placeholder="e.g., SUMMER2024" required 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5" 
            pattern="^[A-Z0-9_-]{3,20}$" maxlength="20">
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">Letters, numbers, dash, underscore (3-20 chars)</p>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Description</label>
          <input type="text" id="descriptionInput" placeholder="e.g., Summer Season Promotion" 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Discount Type</label>
          <select id="discountTypeSelect" class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (NPR)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Discount Value</label>
          <input type="number" id="discountValueInput" placeholder="e.g., 15" min="0.01" step="0.01" required 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Valid From</label>
          <input type="datetime-local" id="validFromInput" required 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Valid Until</label>
          <input type="datetime-local" id="validUntilInput" required 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Max Uses (Leave blank for unlimited)</label>
          <input type="number" id="maxUsesInput" min="1" 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Min Booking Amount (Optional)</label>
          <input type="number" id="minBookingInput" min="0" step="0.01" 
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
      </div>
      <div class="mt-6 flex gap-3">
        <button type="submit" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          Create Code
        </button>
        <button type="button" id="cancelFormBtn" class="rounded-xl border border-slate-200 px-6 py-2 text-sm font-semibold dark:border-white/10">
          Cancel
        </button>
      </div>
    </form>
  `;
}

function renderEditDiscountCodeForm(code) {
  return `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="${classMap.heading}">Edit Discount Code</h2>
      </div>
      <button id="cancelEditBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10">Cancel</button>
    </header>

    <form id="discountCodeEditForm" class="${classMap.panel} p-6 sm:p-8">
      <input type="hidden" id="codeIdInput" value="${code.id}">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label class="block text-sm font-semibold mb-2">Code</label>
          <input type="text" disabled value="${escapeHtml(code.code)}"
            class="w-full rounded-lg border border-slate-200 px-4 py-2 bg-slate-50 dark:border-white/10 dark:bg-white/5 cursor-not-allowed">
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">Code cannot be changed</p>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Description</label>
          <input type="text" id="editDescriptionInput" value="${escapeHtml(code.description)}"
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Max Uses</label>
          <input type="number" id="editMaxUsesInput" value="${code.max_uses || ''}" min="1"
            class="w-full rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Current Uses: ${code.current_uses}</label>
          <input type="text" disabled value="${code.current_uses || 0}"
            class="w-full rounded-lg border border-slate-200 px-4 py-2 bg-slate-50 dark:border-white/10 dark:bg-white/5 cursor-not-allowed">
        </div>
      </div>
      <div class="mt-6 flex gap-3">
        <button type="submit" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          Update Code
        </button>
        <button type="button" id="cancelEditFormBtn" class="rounded-xl border border-slate-200 px-6 py-2 text-sm font-semibold dark:border-white/10">
          Cancel
        </button>
      </div>
    </form>
  `;
}

function setupPricingEventListeners(host, { notify, rerender }) {
  // Create button
  host.querySelector('#createDiscountBtn')?.addEventListener('click', () => {
    pricingUiState.showCreateForm = true;
    rerender?.();
  });

  // Cancel buttons
  host.querySelector('#cancelBtn')?.addEventListener('click', () => {
    pricingUiState.showCreateForm = false;
    rerender?.();
  });

  host.querySelector('#cancelFormBtn')?.addEventListener('click', () => {
    pricingUiState.showCreateForm = false;
    rerender?.();
  });

  host.querySelector('#cancelEditBtn')?.addEventListener('click', () => {
    pricingUiState.editingCodeId = null;
    rerender?.();
  });

  host.querySelector('#cancelEditFormBtn')?.addEventListener('click', () => {
    pricingUiState.editingCodeId = null;
    rerender?.();
  });

  // Create form submit
  host.querySelector('#discountCodeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = host.querySelector('#discountCodeForm');
    const formData = {
      code: form.querySelector('#codeInput').value.toUpperCase().trim(),
      description: form.querySelector('#descriptionInput').value.trim(),
      discount_type: form.querySelector('#discountTypeSelect').value,
      discount_value: parseFloat(form.querySelector('#discountValueInput').value),
      valid_from: new Date(form.querySelector('#validFromInput').value).toISOString(),
      valid_until: new Date(form.querySelector('#validUntilInput').value).toISOString(),
      max_uses: form.querySelector('#maxUsesInput').value ? parseInt(form.querySelector('#maxUsesInput').value) : null,
      min_booking_amount: form.querySelector('#minBookingInput').value ? parseFloat(form.querySelector('#minBookingInput').value) : null,
    };

    try {
      const { data, error } = await window.supabase.from('discount_codes').insert([formData]).select();
      if (error) throw error;

      pricingUiState.discountCodes.push(data[0]);
      pricingUiState.showCreateForm = false;
      notify('Discount code created successfully', 'success');
      rerender?.();
    } catch (error) {
      notify(`Error creating discount code: ${error.message}`, 'error');
    }
  });

  // Edit form submit
  host.querySelector('#discountCodeEditForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = host.querySelector('#discountCodeEditForm');
    const codeId = form.querySelector('#codeIdInput').value;
    const updateData = {
      description: form.querySelector('#editDescriptionInput').value.trim(),
      max_uses: form.querySelector('#editMaxUsesInput').value ? parseInt(form.querySelector('#editMaxUsesInput').value) : null,
    };

    try {
      const { data, error } = await window.supabase.from('discount_codes').update(updateData).eq('id', codeId).select();
      if (error) throw error;

      const index = pricingUiState.discountCodes.findIndex(c => c.id === codeId);
      if (index !== -1) {
        pricingUiState.discountCodes[index] = data[0];
      }
      pricingUiState.editingCodeId = null;
      notify('Discount code updated successfully', 'success');
      rerender?.();
    } catch (error) {
      notify(`Error updating discount code: ${error.message}`, 'error');
    }
  });

  // Toggle enable/disable
  host.querySelectorAll('[data-toggle-code]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codeId = btn.getAttribute('data-toggle-code');
      const code = pricingUiState.discountCodes.find(c => c.id === codeId);
      
      try {
        const { data, error } = await window.supabase.from('discount_codes').update({ is_active: !code.is_active }).eq('id', codeId).select();
        if (error) throw error;

        const index = pricingUiState.discountCodes.findIndex(c => c.id === codeId);
        if (index !== -1) {
          pricingUiState.discountCodes[index] = data[0];
        }
        notify(`Discount code ${!code.is_active ? 'enabled' : 'disabled'}`, 'success');
        rerender?.();
      } catch (error) {
        notify(`Error updating discount code: ${error.message}`, 'error');
      }
    });
  });

  // Edit button
  host.querySelectorAll('[data-edit-code]').forEach(btn => {
    btn.addEventListener('click', () => {
      pricingUiState.editingCodeId = btn.getAttribute('data-edit-code');
      rerender?.();
    });
  });

  // Delete button
  host.querySelectorAll('[data-delete-code]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codeId = btn.getAttribute('data-delete-code');
      const code = pricingUiState.discountCodes.find(c => c.id === codeId);
      
      if (!confirm(`Delete discount code ${code.code}? This action cannot be undone.`)) return;

      try {
        const { error } = await window.supabase.from('discount_codes').delete().eq('id', codeId);
        if (error) throw error;

        pricingUiState.discountCodes = pricingUiState.discountCodes.filter(c => c.id !== codeId);
        notify('Discount code deleted successfully', 'success');
        rerender?.();
      } catch (error) {
        notify(`Error deleting discount code: ${error.message}`, 'error');
      }
    });
  });
}

export function renderPricingModule(host, { data, query, notify, rerender }) {
  if (pricingUiState.showCreateForm) {
    const content = renderCreateDiscountCodeForm();
    host.innerHTML = content;
    setupPricingEventListeners(host, { notify, rerender });
    return;
  }

  if (pricingUiState.editingCodeId) {
    const code = pricingUiState.discountCodes.find(c => c.id === pricingUiState.editingCodeId);
    if (code) {
      const content = renderEditDiscountCodeForm(code);
      host.innerHTML = content;
      setupPricingEventListeners(host, { notify, rerender });
      return;
    }
  }

  const content = renderPricingOverview();
  host.innerHTML = content;
  setupPricingEventListeners(host, { notify, rerender });
}

export { initializePricingModule };
