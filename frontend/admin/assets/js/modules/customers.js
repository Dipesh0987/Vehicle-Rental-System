import { classMap } from '../config.js';
import { escapeHtml, formatNpr, formatDateTime, formatDate } from '../utils.js';
import { filterRows, paginateRows, renderPagination, sortRows } from '../table-utils.js';
import { renderEmptyState } from '../ui.js';

const customerUiState = {
  selectedCustomerId: '',
  statusFilter: 'all',
};

export function renderCustomersModule({ data, query, notify, customerVerificationService, reloadCustomersData, rerender }) {
  const host = document.createElement('section');
  const sourceRows = Array.isArray(data && data.customers) ? data.customers : [];
  const rows = sortRows(
    filterRows(sourceRows, query, ['id', 'name', 'email', 'phoneNumber', 'status', 'documentNumber', 'city', 'country']),
    'name'
  );
  const filteredRows = applyStatusFilter(rows, customerUiState.statusFilter);

  const statusSummary = summarizeVerificationStatuses(sourceRows);
  const reviewQueue = collectReviewQueue(sourceRows);
  const reviewQueueCount = reviewQueue.length;
  const topReviewCustomer = reviewQueueCount ? reviewQueue[0] : null;
  const serviceReady = Boolean(customerVerificationService && typeof customerVerificationService.updateVerificationStatus === 'function');
  const selectedCustomer = resolveSelectedCustomer(sourceRows);

  host.className = 'space-y-4';
  host.tabIndex = -1;
  host.setAttribute('data-module-surface', 'customers');
  host.innerHTML = `
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Customer Verification</p>
      <h2 class="${classMap.heading}">KYC & Identity Review</h2>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        ${renderSummaryTile('Total Customers', String(sourceRows.length), 'text-slate-700 dark:text-slate-200')}
        ${renderSummaryTile('Pending Review', String(reviewQueueCount), 'text-amber-700 dark:text-amber-300')}
        ${renderSummaryTile('Approved', String(statusSummary.approved), 'text-emerald-700 dark:text-emerald-300')}
        ${renderSummaryTile('Rejected', String(statusSummary.rejected), 'text-rose-700 dark:text-rose-300')}
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button id="refreshCustomersBtn" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          ${selectedCustomer ? `Viewing: ${escapeHtml(selectedCustomer.name || 'Customer')}` : 'Click any registered customer to open a focused detail page'}
        </p>
        ${serviceReady ? '' : '<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">Verification status updates are unavailable until migration 012 is applied.</p>'}
      </div>
    </section>

    ${selectedCustomer
      ? renderCustomerDetailPage(selectedCustomer, serviceReady)
      : renderCustomerFocusGrid(filteredRows, customerUiState.statusFilter)}

    ${selectedCustomer
      ? ''
      : `<section class="${classMap.panel} p-4 sm:p-5">
          <h3 class="text-base font-extrabold">Professional Status Guide</h3>
          <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            ${renderGuideTile('Pending', 'Amber', 'Customer profile is waiting for verification submission or review.')}
            ${renderGuideTile('Pending Review', 'Amber', 'Customer submitted KYC data and waits for admin decision.')}
            ${renderGuideTile('Approved', 'Green', 'Identity verified and trusted for full account usage.')}
          </div>
        </section>`}
  `;

  host.querySelector('#refreshCustomersBtn')?.addEventListener('click', async () => {
    if (typeof reloadCustomersData === 'function') {
      await reloadCustomersData();
      rerender?.();
    }

    notify('Customer verification data refreshed', 'success');
  });

  host.querySelectorAll('[data-open-customer-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedId = String(button.getAttribute('data-open-customer-id') || '').trim();
      if (!selectedId) {
        return;
      }

      customerUiState.selectedCustomerId = selectedId;
      writeCustomerIdToHash(selectedId);
      rerender?.();
    });
  });

  host.querySelectorAll('[data-customer-status-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextFilter = String(button.getAttribute('data-customer-status-filter') || 'all').trim().toLowerCase();
      customerUiState.statusFilter = nextFilter || 'all';
      rerender?.();
    });
  });

  host.querySelector('[data-back-to-customer-list]')?.addEventListener('click', () => {
    customerUiState.selectedCustomerId = '';
    writeCustomerIdToHash('');
    rerender?.();
  });

  if (selectedCustomer) {
    host.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      customerUiState.selectedCustomerId = '';
      rerender?.();
    });

    window.requestAnimationFrame(() => {
      host.focus();
    });
  }

  host.querySelectorAll('[data-verification-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!serviceReady) {
        notify('Verification status update service is unavailable. Apply migration 012 first.', 'error');
        return;
      }

      const userId = String(button.getAttribute('data-user-id') || '').trim();
      const customerName = String(button.getAttribute('data-customer-name') || 'Customer').trim();
      const nextStatus = String(button.getAttribute('data-verification-action') || '').trim().toLowerCase();
      const reviewNote = nextStatus === 'rejected'
        ? 'Rejected by admin review. Customer should correct and resubmit verification details.'
        : 'Approved by admin review.';

      if (!userId || !nextStatus) {
        notify('Invalid customer verification action payload.', 'error');
        return;
      }

      button.disabled = true;
      const originalContent = button.innerHTML;
      button.classList.add('opacity-70', 'cursor-not-allowed');
      button.innerHTML = '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px] animate-pulse">sync</span><span>Updating...</span></span>';

      try {
        await customerVerificationService.updateVerificationStatus({
          userId,
          status: nextStatus,
          reviewNote,
        });

        const humanLabel = customerVerificationService.statusLabel(nextStatus);
        notify(`${customerName} marked as ${humanLabel}.`, 'success');

        if (typeof reloadCustomersData === 'function') {
          await reloadCustomersData();
        }

        rerender?.();
      } catch (error) {
        const message = customerVerificationService && typeof customerVerificationService.toPublicError === 'function'
          ? customerVerificationService.toPublicError(error, 'Unable to update verification status right now.')
          : 'Unable to update verification status right now.';
        notify(message, 'error');
      } finally {
        button.disabled = false;
        button.classList.remove('opacity-70', 'cursor-not-allowed');
        button.innerHTML = originalContent;
      }
    });
  });

  host.querySelector('#clearCustomerSearch')?.addEventListener('click', () => {
    notify('Clear global search to restore full customer list', 'info');
  });

  return host;
}

function resolveSelectedCustomer(rows) {
  const selectedId = String(customerUiState.selectedCustomerId || readCustomerIdFromHash() || '').trim();
  if (!selectedId) {
    return null;
  }

  const selected = (Array.isArray(rows) ? rows : []).find((row) => String(row && row.id ? row.id : '') === selectedId) || null;
  if (!selected) {
    customerUiState.selectedCustomerId = '';
    writeCustomerIdToHash('');
  }

  customerUiState.selectedCustomerId = selectedId;
  return selected;
}

function readCustomerIdFromHash() {
  const hash = String(window.location.hash || '').trim();
  if (!hash || hash.indexOf('#customer:') !== 0) {
    return '';
  }

  return decodeURIComponent(hash.replace('#customer:', '')).trim();
}

function writeCustomerIdToHash(value) {
  const id = String(value || '').trim();
  if (!id) {
    if (String(window.location.hash || '').indexOf('#customer:') === 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }

  history.replaceState(null, '', `${window.location.pathname}${window.location.search}#customer:${encodeURIComponent(id)}`);
}

function renderSummaryTile(label, value, valueToneClass) {
  return `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
    <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">${escapeHtml(label)}</p>
    <p class="mt-1 text-lg font-extrabold ${valueToneClass}">${escapeHtml(value)}</p>
  </article>`;
}

function renderGuideTile(title, tone, description) {
  return `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
    <p class="text-sm font-bold">${escapeHtml(title)}</p>
    <p class="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(tone)}</p>
    <p class="mt-2 text-xs text-slate-600 dark:text-slate-300">${escapeHtml(description)}</p>
  </article>`;
}

function renderCustomerFocusGrid(rows, activeStatusFilter) {
  const summary = summarizeVerificationStatuses(rows);
  const chips = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'pending', label: 'Pending', count: summary.pending },
    { key: 'approved', label: 'Approved', count: summary.approved },
    { key: 'rejected', label: 'Rejected', count: summary.rejected },
  ];

  if (!rows.length) {
    return `<section class="${classMap.panel} p-4 sm:p-5">
      ${renderEmptyState({ title: 'No customers found', message: 'No customer profile matched the current search.', actionLabel: 'Clear Search', actionId: 'clearCustomerSearch' })}
    </section>`;
  }

  return `<section class="${classMap.panel} p-4 sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-base font-extrabold">Registered Customers</h3>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Focused view with quick hover insights and direct detail-page navigation.</p>
      </div>
      <p class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-white/10 dark:text-slate-300">${rows.length} visible</p>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      ${chips
        .map((chip) => renderFilterChip(chip, activeStatusFilter))
        .join('')}
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows.map((row, index) => renderCustomerFocusCard(row, index)).join('')}
    </div>
  </section>`;
}

function renderFilterChip(chip, activeStatusFilter) {
  const active = String(chip && chip.key ? chip.key : '') === String(activeStatusFilter || 'all');
  return `<button type="button" data-customer-status-filter="${escapeHtml(chip.key)}" aria-pressed="${active ? 'true' : 'false'}" class="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.11em] transition ${
    active
      ? 'border-brand-500 bg-brand-500 text-white'
      : 'border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-300'
  }">
    <span>${escapeHtml(chip.label)} (${Number.isFinite(Number(chip.count)) ? Number(chip.count) : 0})</span>
  </button>`;
}

function renderCustomerFocusCard(row, index) {
  const statusMeta = verificationStatusMeta(row && row.verificationStatus ? row.verificationStatus : 'not_submitted');
  const initials = resolveInitials(row && row.name ? row.name : 'Customer');
  const locationText = formatLocation(row);
  const submissionText = formatDateTime(row && row.verificationSubmittedAt ? row.verificationSubmittedAt : '') || 'Not submitted yet';
  const userId = escapeHtml(String(row && row.id ? row.id : ''));
  const trips = Number.isFinite(Number(row && row.trips ? row.trips : 0)) ? Number(row.trips) : 0;

  const delay = Number.isFinite(Number(index)) ? Math.max(0, Math.min(7, Number(index))) * 26 : 0;

  return `<button type="button" aria-label="Open detail page for ${escapeHtml(row && row.name ? row.name : 'Customer')}" data-open-customer-id="${userId}" style="animation-delay:${delay}ms" class="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-brand-500/40 hover:shadow-[0_22px_38px_rgba(15,23,42,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-400/50 animate-fadeUp">
    <span class="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl transition duration-300 group-hover:scale-110"></span>
    <span class="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-peach/20 blur-2xl transition duration-300 group-hover:scale-110"></span>

    <div class="relative">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-sm font-bold text-white">${escapeHtml(initials)}</span>
          <div class="min-w-0">
            <p class="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">${escapeHtml(row && row.name ? row.name : 'Customer')}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row && row.email ? row.email : 'No email')}</p>
          </div>
        </div>
        ${renderStatusBadge(statusMeta)}
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderCardStat('Trips', String(trips))}
        ${renderCardStat('User ID', shortUserId(row && row.id ? row.id : ''))}
        ${renderCardStat('Submission', submissionText)}
        ${renderCardStat('Location', locationText)}
      </div>

      <div class="mt-3 inline-flex items-center gap-1 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-brand-700 transition group-hover:bg-brand-500 group-hover:text-white dark:border-brand-400/40 dark:bg-brand-400/10 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white">
        <span>View Individual Details</span>
        <span class="material-symbols-outlined text-[14px] transition-transform duration-300 group-hover:translate-x-0.5">east</span>
      </div>
    </div>
  </button>`;
}

function renderCardStat(label, value) {
  return `<div class="rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(value || '-')}</p>
  </div>`;
}

function renderCustomerDetailPage(row, serviceReady) {
  const statusMeta = verificationStatusMeta(row && row.verificationStatus ? row.verificationStatus : 'not_submitted');
  const progress = resolveVerificationProgress(statusMeta.key);
  const documentText = formatDocumentText(row);
  const submittedAt = formatDateTime(row && row.verificationSubmittedAt ? row.verificationSubmittedAt : '') || 'Pending';
  const reviewedAt = formatDateTime(row && row.verificationReviewedAt ? row.verificationReviewedAt : '') || 'Not reviewed yet';
  const locationText = formatLocation(row);
  const trips = Number.isFinite(Number(row && row.trips ? row.trips : 0)) ? Number(row.trips) : 0;

  return `<section class="${classMap.panel} animate-fadeUp p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" title="Return to all registered customers" data-back-to-customer-list class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
        <span class="material-symbols-outlined text-[16px]">west</span>
        <span>Back to Customers</span>
      </button>
      ${renderStatusBadge(statusMeta)}
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
        <div class="flex flex-wrap items-center gap-3">
          <span class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-base font-bold text-white">${escapeHtml(resolveInitials(row && row.name ? row.name : 'Customer'))}</span>
          <div class="min-w-0">
            <h3 class="truncate text-lg font-extrabold tracking-[-0.01em] text-slate-900 dark:text-slate-100">${escapeHtml(row && row.name ? row.name : 'Customer')}</h3>
            <p class="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Customer Detail Page</p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${renderProfileField('User ID', shortUserId(row && row.id ? row.id : '-'))}
          ${renderProfileField('Email', row && row.email ? row.email : '-')}
          ${renderProfileField('Phone', row && row.phoneNumber ? row.phoneNumber : 'No phone')}
          ${renderProfileField('Location', locationText)}
          ${renderProfileField('Identity', documentText)}
          ${renderProfileField('Gender', row && row.gender ? row.gender : '-')}
        </div>

        <div class="mt-3">${renderQuickContactLinks(row)}</div>
      </article>

      <aside class="space-y-3">
        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Verification Snapshot</h4>
          <div class="mt-3 grid grid-cols-1 gap-2 text-xs">
            ${renderCardStat('Trips', String(trips))}
            ${renderCardStat('Submitted', submittedAt)}
            ${renderCardStat('Reviewed', reviewedAt)}
          </div>
          <div class="mt-3">${renderVerificationProgress(progress)}</div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-extrabold">Admin Actions</h4>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Update verification without leaving this focused page.</p>
          <div class="mt-3">${renderActionButtons(row, statusMeta, serviceReady, 'detail')}</div>
        </article>
      </aside>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
        <h4 class="text-sm font-extrabold">Document Preview</h4>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Hover to inspect the uploaded identity proof.</p>
        <div class="mt-3">${renderDocumentPreview(row, 'detail')}</div>
      </article>

      <article class="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
        <h4 class="text-sm font-extrabold">Verification Timeline</h4>
        <div class="mt-3 space-y-2">
          ${renderTimelineItem('Profile Created', shortUserId(row && row.id ? row.id : '-'))}
          ${renderTimelineItem('Verification Submitted', submittedAt)}
          ${renderTimelineItem('Latest Admin Note', row && row.verificationNote ? row.verificationNote : 'No note added yet')}
          ${renderTimelineItem('Last Reviewed', reviewedAt)}
        </div>
      </article>
    </div>
  </section>`;
}

function renderProfileField(label, value) {
  return `<article class="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(value || '-')}</p>
  </article>`;
}

function renderQuickContactLinks(row) {
  const email = String(row && row.email ? row.email : '').trim();
  const phone = String(row && row.phoneNumber ? row.phoneNumber : '').trim();

  const links = [];
  if (email) {
    links.push(`<a href="mailto:${encodeURIComponent(email)}" class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"><span class="material-symbols-outlined text-[14px]">mail</span><span>Email Customer</span></a>`);
  }

  if (phone) {
    const telValue = phone.replace(/[^\d+]/g, '');
    if (telValue) {
      links.push(`<a href="tel:${escapeHtml(telValue)}" class="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"><span class="material-symbols-outlined text-[14px]">call</span><span>Call Customer</span></a>`);
    }
  }

  if (!links.length) {
    return '<p class="text-xs text-slate-500 dark:text-slate-400">No direct contact method is available.</p>';
  }

  return `<div class="flex flex-wrap items-center gap-2">${links.join('')}</div>`;
}

function renderTimelineItem(label, value) {
  return `<div class="flex gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-slate-900/30">
    <span class="mt-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-brand-500"></span>
    <div class="min-w-0">
      <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
      <p class="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(value || '-')}</p>
    </div>
  </div>`;
}

function renderVerificationProgress(progress) {
  const safe = Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(progress))) : 0;
  return `<div>
    <div class="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
      <span>KYC Completion</span>
      <span>${safe}%</span>
    </div>
    <div class="mt-1 h-2 rounded-full bg-slate-200 dark:bg-white/10">
      <div class="h-2 rounded-full bg-[linear-gradient(90deg,#1f7668,#1b5f8b)] transition-all duration-500" style="width:${safe}%"></div>
    </div>
  </div>`;
}

function renderDocumentPreview(row, variant = 'compact') {
  const imageUrl = normalizeDocumentImageUrl(row && row.documentImageUrl ? row.documentImageUrl : '');
  if (!imageUrl) {
    return '<p class="mt-2 text-[11px] text-slate-400 dark:text-slate-500">No document image uploaded</p>';
  }

  const escapedUrl = escapeHtml(imageUrl);
  if (variant === 'detail') {
    return `<div class="group inline-flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 transition hover:border-brand-500/40 dark:border-white/10 dark:bg-white/5">
      <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="overflow-hidden rounded-xl">
        <img src="${escapedUrl}" alt="Document preview" class="h-44 w-full rounded-xl border border-slate-200 object-cover transition duration-300 group-hover:scale-[1.02] dark:border-white/10" />
      </a>
      <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
        <span class="material-symbols-outlined text-[14px]">open_in_new</span>
        <span>Open Full Image</span>
      </a>
    </div>`;
  }

  return `<div class="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-white/5">
    <img src="${escapedUrl}" alt="Document preview" class="h-12 w-20 rounded-md border border-slate-200 object-cover dark:border-white/10" />
    <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">Open</a>
  </div>`;
}

function renderStatusBadge(meta) {
  if (meta.key === 'approved') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.2 7.2a1 1 0 01-1.415 0l-3-3a1 1 0 011.415-1.414L8.8 11.786l6.493-6.496a1 1 0 011.41 0z" clip-rule="evenodd"></path></svg>
      <span>${escapeHtml(meta.label)}</span>
    </span>`;
  }

  return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}">${escapeHtml(meta.label)}</span>`;
}

function renderActionButtons(row, statusMeta, serviceReady, variant = 'inline') {
  if (!serviceReady) {
    return '<span class="text-xs text-slate-500 dark:text-slate-400">Unavailable</span>';
  }

  const userId = escapeHtml(String(row && row.id ? row.id : ''));
  const customerName = escapeHtml(String(row && row.name ? row.name : 'Customer'));
  const isDetail = variant === 'detail';

  if (statusMeta.key === 'not_submitted') {
    return '<span class="text-xs font-semibold text-amber-700 dark:text-amber-300">Pending customer submission</span>';
  }

  const baseButtonClass = isDetail
    ? 'w-full rounded-xl border px-3 py-2 text-sm font-semibold transition'
    : 'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition';

  const approveButton = statusMeta.key === 'approved'
    ? ''
    : `<button data-verification-action="approved" data-user-id="${userId}" data-customer-name="${customerName}" class="${baseButtonClass} border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">Approve</button>`;

  const rejectButton = statusMeta.key === 'rejected'
    ? ''
    : `<button data-verification-action="rejected" data-user-id="${userId}" data-customer-name="${customerName}" class="${baseButtonClass} border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-500/10">Reject</button>`;

  const pendingButton = statusMeta.key === 'pending'
    ? ''
    : `<button data-verification-action="pending" data-user-id="${userId}" data-customer-name="${customerName}" class="${baseButtonClass} border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-300 dark:hover:bg-amber-500/10">Set Pending</button>`;

  return `<div class="${isDetail ? 'grid grid-cols-1 gap-2' : 'flex flex-wrap gap-2'}">${approveButton}${rejectButton}${pendingButton}</div>`;
}

function summarizeVerificationStatuses(rows) {
  const summary = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const status = verificationStatusMeta(row && row.verificationStatus ? row.verificationStatus : 'not_submitted').key;
    if (status === 'pending' || status === 'not_submitted') summary.pending += 1;
    else if (status === 'approved') summary.approved += 1;
    else if (status === 'rejected') summary.rejected += 1;
  });

  return summary;
}

function applyStatusFilter(rows, statusFilter) {
  const filter = String(statusFilter || 'all').trim().toLowerCase();
  if (filter === 'all') {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = verificationStatusMeta(row && row.verificationStatus ? row.verificationStatus : 'not_submitted').key;
    if (filter === 'pending') {
      return key === 'pending' || key === 'not_submitted';
    }

    return key === filter;
  });
}

function collectReviewQueue(rows) {
  return sortCustomersForReviewQueue(
    (Array.isArray(rows) ? rows : []).filter((row) => {
      const key = verificationStatusMeta(row && row.verificationStatus ? row.verificationStatus : 'not_submitted').key;
      return key === 'pending' || key === 'rejected' || key === 'not_submitted';
    })
  );
}

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortCustomersForReviewQueue(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];

  list.sort((left, right) => {
    const leftPriority = customerReviewPriority(left);
    const rightPriority = customerReviewPriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftSubmitted = toTimestamp(left && left.verificationSubmittedAt ? left.verificationSubmittedAt : '');
    const rightSubmitted = toTimestamp(right && right.verificationSubmittedAt ? right.verificationSubmittedAt : '');
    if (leftSubmitted !== rightSubmitted) {
      return rightSubmitted - leftSubmitted;
    }

    const leftUpdated = toTimestamp(left && left.updatedAt ? left.updatedAt : '');
    const rightUpdated = toTimestamp(right && right.updatedAt ? right.updatedAt : '');
    if (leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }

    const leftCreated = toTimestamp(left && left.createdAt ? left.createdAt : '');
    const rightCreated = toTimestamp(right && right.createdAt ? right.createdAt : '');
    return rightCreated - leftCreated;
  });

  return list;
}

function customerReviewPriority(customer) {
  const status = verificationStatusMeta(customer && customer.verificationStatus ? customer.verificationStatus : 'not_submitted').key;
  const submittedAt = toTimestamp(customer && customer.verificationSubmittedAt ? customer.verificationSubmittedAt : '');
  const hasSubmission = submittedAt > 0;

  if (status === 'pending' && hasSubmission) return 0;
  if (status === 'rejected' && hasSubmission) return 1;
  if (status === 'not_submitted') return 2;
  if (status === 'approved') return 3;
  return 4;
}

function verificationStatusMeta(statusValue) {
  const normalized = String(statusValue || '').trim().toLowerCase();

  if (normalized === 'approved') {
    return {
      key: 'approved',
      label: 'Approved',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    };
  }

  if (normalized === 'pending') {
    return {
      key: 'pending',
      label: 'Pending Review',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    };
  }

  if (normalized === 'rejected') {
    return {
      key: 'rejected',
      label: 'Rejected',
      className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    };
  }

  return {
    key: 'not_submitted',
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  };
}

function formatDocumentText(row) {
  const docs = Array.isArray(row && row.documents ? row.documents : []) ? row.documents : [];
  const docLabel = docs.length ? docs[0] : 'No document';
  const docNumber = String(row && row.documentNumber ? row.documentNumber : '').trim();
  if (!docNumber) {
    return docLabel;
  }

  return `${docLabel} (${docNumber})`;
}

function normalizeDocumentImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (
    raw.indexOf('data:image/') === 0 ||
    raw.indexOf('https://') === 0 ||
    raw.indexOf('http://') === 0 ||
    raw.charAt(0) === '/'
  ) {
    return raw;
  }

  return '';
}

function shortUserId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '-';
  }

  if (raw.length <= 12) {
    return raw;
  }

  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

function resolveInitials(value) {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return 'CU';
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

function resolveVerificationProgress(statusKey) {
  const key = String(statusKey || '').trim().toLowerCase();
  if (key === 'approved') {
    return 100;
  }

  if (key === 'pending') {
    return 60;
  }

  if (key === 'rejected') {
    return 25;
  }

  return 10;
}

function formatLocation(row) {
  const city = String(row && row.city ? row.city : '').trim();
  const country = String(row && row.country ? row.country : '').trim();
  if (city) {
    return `${city}${country ? `, ${country}` : ''}`;
  }

  if (country) {
    return country;
  }

  return 'Location not provided';
}

