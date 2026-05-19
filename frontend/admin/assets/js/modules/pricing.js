import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';

const pricingUiState = {
  showCreateForm: false,
  editingCodeId: null,
  discountCodes: [],
  page: 1,
  pageSize: 6,
};

export async function initializePricingModule() {
  try {
    if (!window.supabase || typeof window.supabase.from !== 'function') {
      // console.warn('Supabase client not initialized for pricing module');
      pricingUiState.discountCodes = [];
      return;
    }

    const { data, error } = await window.supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    pricingUiState.discountCodes = Array.isArray(data) ? data : [];
  } catch (error) {
    // console.warn('Failed to load discount codes:', error);
    pricingUiState.discountCodes = [];
  }
}

export function renderPricingModule({ data, query, notify, rerender }) {
  const host = document.createElement('section');

  host.className = 'space-y-4';
  host.innerHTML = pricingUiState.showCreateForm
    ? renderCreateDiscountCodeForm()
    : pricingUiState.editingCodeId
      ? renderEditDiscountCodeForm()
      : renderPricingOverview(query);

  // Event delegation
  setupPricingEventListeners(host, { notify, rerender });

  return host;
}

function renderPricingOverview(query) {
  const searchableRows = filterRows(pricingUiState.discountCodes, query, ['code', 'description', 'discount_type']);
  const paged = paginateRows(searchableRows, pricingUiState.page, pricingUiState.pageSize);

  return `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Pricing</p>
        <h2 class="${classMap.heading}">Dynamic Pricing & Promotions</h2>
      </div>
      <button id="createDiscountBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Create Discount Code</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold mb-4">Discount Codes</h3>
      ${paged.rows.length === 0 ? renderEmptyDiscount() : renderDiscountTable(paged.rows)}
      ${paged.totalPages > 1 ? renderPagination(pricingUiState.page, paged.totalPages, (page) => {
        pricingUiState.page = page;
      }) : ''}
    </section>
  `;
}

function renderEmptyDiscount() {
  return `
    <div class="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center dark:border-white/10">
      <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">No discount codes yet</p>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Create your first promotional code to get started</p>
    </div>
  `;
}

function renderDiscountTable(codes) {
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-200 dark:border-white/10">
          <tr class="text-left">
            <th class="px-3 py-3 font-semibold">Code</th>
            <th class="px-3 py-3 font-semibold">Type</th>
            <th class="px-3 py-3 font-semibold">Discount</th>
            <th class="px-3 py-3 font-semibold">Validity</th>
            <th class="px-3 py-3 font-semibold">Usage</th>
            <th class="px-3 py-3 font-semibold">Status</th>
            <th class="px-3 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${codes.map(code => renderDiscountCodeRow(code)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDiscountCodeRow(code) {
  const isExpired = new Date(code.valid_until) < new Date();
  const isActive = code.is_active && !isExpired;
  const currentDate = new Date().toISOString().split('T')[0];
  const validFrom = new Date(code.valid_from).toISOString().split('T')[0];
  const validUntil = new Date(code.valid_until).toISOString().split('T')[0];
  const discountDisplay = code.discount_type === 'percentage' ? `${code.discount_value}%` : `NPR ${code.discount_value}`;
  const maxUsesDisplay = code.max_uses ? `${code.current_uses} / ${code.max_uses}` : 'Unlimited';

  return `
    <tr class="border-b border-slate-200 dark:border-white/10">
      <td class="px-3 py-3">
        <span class="font-mono font-bold text-brand-600 dark:text-brand-300">${escapeHtml(code.code)}</span>
      </td>
      <td class="px-3 py-3">
        <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-white/10">
          ${code.discount_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
        </span>
      </td>
      <td class="px-3 py-3 font-semibold">${discountDisplay}</td>
      <td class="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
        <div>${validFrom} to ${validUntil}</div>
      </td>
      <td class="px-3 py-3 text-xs">${maxUsesDisplay}</td>
      <td class="px-3 py-3">
        <span class="rounded-full px-2 py-1 text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-400'}">
          ${isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
        </span>
      </td>
      <td class="px-3 py-3">
        <div class="flex gap-2">
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
        <div>
          <label class="block text-sm font-semibold mb-2">Max Discount Amount (For %)</label>
          <input type="number" id="maxDiscountInput" min="0" step="0.01" 
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

function renderEditDiscountCodeForm() {
  const code = pricingUiState.discountCodes.find(c => c.id === pricingUiState.editingCodeId);
  if (!code) return renderPricingOverview('');

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
      max_discount_amount: form.querySelector('#maxDiscountInput').value ? parseFloat(form.querySelector('#maxDiscountInput').value) : null,
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
