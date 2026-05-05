import { classMap } from '../config.js';
import { filterRows, paginateRows, renderPagination } from '../table-utils.js';

let pricingUiState = {
  showCreateForm: false,
  editingCodeId: null,
  discountCodes: [],
  page: 1,
  pageSize: 10,
  isLoading: false,
  hasLoaded: false,
};

let pricingClientPromise = null;

async function getPricingClient() {
  if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
    return window.SupabaseRuntime.client;
  }

  if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') {
    throw new Error('Supabase client bootstrap is missing.');
  }

  if (!window.SupabaseClient.isConfigured()) {
    throw new Error('Supabase configuration is missing.');
  }

  if (!pricingClientPromise) {
    pricingClientPromise = window.SupabaseClient.init();
  }

  return pricingClientPromise;
}

async function initializePricingModule() {
  pricingUiState.isLoading = true;

  try {
    const client = await getPricingClient();
    const { data, error } = await client.from('discount_codes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    pricingUiState.discountCodes = data || [];
  } catch (error) {
    console.error('Error loading discount codes:', error);
    pricingUiState.discountCodes = [];
  } finally {
    pricingUiState.isLoading = false;
    pricingUiState.hasLoaded = true;
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
  const pagination = paginateRows(filteredCodes, pricingUiState.page, pricingUiState.pageSize);
  const paginatedCodes = pagination.rows;

  return `
    <div class="space-y-6">
      <header class="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-5">
        <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div class="min-w-0 space-y-1">
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
            <h2 class="${classMap.heading}">Discount Code Management</h2>
            <p class="max-w-2xl text-sm text-slate-600 dark:text-slate-400">Create, review, and adjust promotional codes with a clear audit trail.</p>
          </div>

          <div class="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              ${pricingUiState.discountCodes.length} total codes
            </span>
            <button id="createDiscountBtn" class="inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              + Create Discount Code
            </button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div class="relative inline-flex items-center">
            <input type="text" id="pricingSearchInput" placeholder="Search codes, descriptions, or promo labels..."
              value="${searchTerm}"
              class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-100">
            <span class="pointer-events-none absolute right-4 inline-flex text-slate-400" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="M20 20l-3.5-3.5"></path>
              </svg>
            </span>
          </div>

          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5 md:min-w-[240px] md:justify-end">
            <span class="font-medium text-slate-600 dark:text-slate-300">Showing</span>
            <span class="font-semibold text-slate-900 dark:text-white">${paginatedCodes.length} of ${filteredCodes.length}</span>
          </div>
        </div>
      </header>

      <!-- Discount Table -->
      ${paginatedCodes.length > 0 ? `
        <div class="overflow-hidden rounded-2xl border border-slate-200 shadow-xs dark:border-white/10">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-white/10 dark:from-white/5 dark:to-white/3">
                <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Code</th>
                <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Discount</th>
                <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Valid Period</th>
                <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Usage</th>
                <th class="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</th>
                <th class="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-white/10">
              ${paginatedCodes.map(code => renderDiscountTable(code)).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 p-12 text-center dark:border-white/10 dark:from-white/5 dark:to-transparent">
          <svg class="mx-auto mb-4 h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-base font-medium text-slate-700 dark:text-slate-300">No discount codes yet</p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Create your first promotional code to get started</p>
        </div>
      `}

      <!-- Pagination -->
      ${pagination.pages > 1 ? `<div id="pricingPaginationContainer"></div>` : ''}
    </div>
  `;
}

function renderPricingLoadingState() {
  return `
    <section class="space-y-4">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
          <h2 class="${classMap.heading}">Discount Code Management</h2>
        </div>
      </header>

      <div class="${classMap.panel} p-6 sm:p-8">
        <div class="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <span class="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 dark:border-white/20 dark:border-t-brand-400"></span>
          Loading discount codes...
        </div>
      </div>
    </section>
  `;
}

function renderDiscountTable(code) {
  const discountDisplay = code.discount_type === 'percentage' ? `${code.discount_value}%` : `NPR ${code.discount_value.toFixed(2)}`;
  const validFrom = new Date(code.valid_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const validUntil = new Date(code.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const usage = code.max_uses ? `${code.current_uses}/${code.max_uses}` : `${code.current_uses}`;
  const usagePercent = code.max_uses ? Math.round((code.current_uses / code.max_uses) * 100) : 0;

  return `
    <tr class="transition-colors duration-200 hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100/60 dark:bg-brand-500/10">
            <svg class="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 01.586 1.414v5c0 1.104-.896 2-2 2H4c-1.104 0-2-.896-2-2V5c0-1.104.896-2 2-2z"></path>
            </svg>
          </div>
          <div>
            <p class="font-mono text-sm font-semibold text-slate-900 dark:text-white">${escapeHtml(code.code)}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${code.description ? escapeHtml(code.description.substring(0, 30)) : 'No description'}</p>
          </div>
        </div>
      </td>
      <td class="px-6 py-4">
        <div>
          <p class="font-semibold text-slate-900 dark:text-white">${discountDisplay}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">${code.discount_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}</p>
        </div>
      </td>
      <td class="px-6 py-4">
        <div class="space-y-1">
          <p class="text-sm text-slate-900 dark:text-white">${validFrom}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">to ${validUntil}</p>
        </div>
      </td>
      <td class="px-6 py-4">
        <div class="min-w-[140px]">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">${usage}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">${usagePercent}%</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div class="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-300" style="width: ${usagePercent}%"></div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-center">
        <span class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${code.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-400'}">
          <span class="h-2 w-2 rounded-full ${code.is_active ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          ${code.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="px-6 py-4">
        <div class="flex items-center justify-end gap-2">
          <button data-toggle-code="${code.id}" class="group relative inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/10 ${code.is_active ? 'text-slate-600 dark:text-slate-400' : 'text-brand-600 dark:text-brand-400'}" title="${code.is_active ? 'Disable code' : 'Enable code'}">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${code.is_active ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5-4a2 2 0 11-4 0 2 2 0 014 0z"></path>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'}
            </svg>
          </button>
          <button data-edit-code="${code.id}" class="group relative inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10" title="Edit code">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button data-delete-code="${code.id}" class="group relative inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10" title="Delete code">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
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
            pattern="^[A-Z0-9_\\-]{3,20}$" maxlength="20">
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
      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="submit" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
          Create Code
        </button>
        <button type="button" id="cancelFormBtn" class="rounded-xl border border-slate-200 px-6 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10">
          Cancel
        </button>
      </div>
    </form>
  `;
}

function renderEditDiscountCodeForm(code) {
  return `
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
        <h2 class="${classMap.heading}">Edit Discount Code</h2>
      </div>
      <button id="cancelEditBtn" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10">Cancel</button>
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
      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="submit" class="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
          Update Code
        </button>
        <button type="button" id="cancelEditFormBtn" class="rounded-xl border border-slate-200 px-6 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10">
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
    const client = await getPricingClient();
    const user = client.auth.getUser().then(r => r.data.user);
    
    const formData = {
      code: form.querySelector('#codeInput').value.toUpperCase().trim(),
      description: form.querySelector('#descriptionInput').value.trim(),
      discount_type: form.querySelector('#discountTypeSelect').value,
      discount_value: parseFloat(form.querySelector('#discountValueInput').value),
      valid_from: new Date(form.querySelector('#validFromInput').value).toISOString(),
      valid_until: new Date(form.querySelector('#validUntilInput').value).toISOString(),
      max_uses: form.querySelector('#maxUsesInput').value ? parseInt(form.querySelector('#maxUsesInput').value) : null,
      min_booking_amount: form.querySelector('#minBookingInput').value ? parseFloat(form.querySelector('#minBookingInput').value) : null,
      created_by: (await user).id,
    };

    try {
      const client = await getPricingClient();
      const { data, error } = await client.from('discount_codes').insert([formData]).select();
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
      const client = await getPricingClient();
      const { data, error } = await client.from('discount_codes').update(updateData).eq('id', codeId).select();
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
        const client = await getPricingClient();
        const { data, error } = await client.from('discount_codes').update({ is_active: !code.is_active }).eq('id', codeId).select();
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
        const client = await getPricingClient();
        const { error } = await client.from('discount_codes').delete().eq('id', codeId);
        if (error) throw error;

        pricingUiState.discountCodes = pricingUiState.discountCodes.filter(c => c.id !== codeId);
        notify('Discount code deleted successfully', 'success');
        rerender?.();
      } catch (error) {
        notify(`Error deleting discount code: ${error.message}`, 'error');
      }
    });
  });

  // Setup pagination
  const paginationContainer = host.querySelector('#pricingPaginationContainer');
  if (paginationContainer) {
    const searchTerm = host.querySelector('#pricingSearchInput')?.value.toLowerCase() || '';
    const filteredCodes = filterRows(pricingUiState.discountCodes, searchTerm, ['code', 'description']);
    const pagination = paginateRows(filteredCodes, pricingUiState.page, pricingUiState.pageSize);
    
    const paginationElement = renderPagination({ page: pagination.page, pages: pagination.pages }, (page) => {
      pricingUiState.page = page;
      rerender?.();
    });
    paginationContainer.innerHTML = '';
    paginationContainer.appendChild(paginationElement);
  }
}

export function renderPricingModule({ data, query, notify, rerender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  if (!pricingUiState.hasLoaded && !pricingUiState.isLoading) {
    initializePricingModule()
      .then(() => rerender?.())
      .catch((error) => {
        console.error('Error initializing pricing module:', error);
        rerender?.();
      });
  }

  if (!pricingUiState.hasLoaded) {
    host.innerHTML = renderPricingLoadingState();
    return host;
  }

  if (pricingUiState.showCreateForm) {
    const content = renderCreateDiscountCodeForm();
    host.innerHTML = content;
    setupPricingEventListeners(host, { notify, rerender });
    return host;
  }

  if (pricingUiState.editingCodeId) {
    const code = pricingUiState.discountCodes.find(c => c.id === pricingUiState.editingCodeId);
    if (code) {
      const content = renderEditDiscountCodeForm(code);
      host.innerHTML = content;
      setupPricingEventListeners(host, { notify, rerender });
      return host;
    }
  }

  const content = renderPricingOverview();
  host.innerHTML = content;
  setupPricingEventListeners(host, { notify, rerender });
  return host;
}

export { initializePricingModule };
