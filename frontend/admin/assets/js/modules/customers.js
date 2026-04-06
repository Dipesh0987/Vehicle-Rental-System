import { classMap } from '../config.js';
import { filterRows, sortRows } from '../table-utils.js';
import { renderEmptyState } from '../ui.js';

export function renderCustomersModule({ data, query, notify, customerVerificationService, reloadCustomersData, rerender }) {
  const host = document.createElement('section');
  const sourceRows = Array.isArray(data && data.customers) ? data.customers : [];
  const rows = sortRows(
    filterRows(sourceRows, query, ['id', 'name', 'email', 'phoneNumber', 'status', 'documentNumber', 'city', 'country']),
    'name'
  );

  const statusSummary = summarizeVerificationStatuses(sourceRows);
  const serviceReady = Boolean(customerVerificationService && typeof customerVerificationService.updateVerificationStatus === 'function');

  host.className = 'space-y-4';
  host.innerHTML = `
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Customer Verification</p>
      <h2 class="${classMap.heading}">KYC & Identity Review</h2>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        ${renderSummaryTile('Total Customers', String(sourceRows.length), 'text-slate-700 dark:text-slate-200')}
        ${renderSummaryTile('Pending Review', String(statusSummary.pending), 'text-amber-700 dark:text-amber-300')}
        ${renderSummaryTile('Approved', String(statusSummary.approved), 'text-emerald-700 dark:text-emerald-300')}
        ${renderSummaryTile('Rejected', String(statusSummary.rejected), 'text-rose-700 dark:text-rose-300')}
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button id="refreshCustomersBtn" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
        ${serviceReady ? '' : '<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">Verification status updates are unavailable until migration 012 is applied.</p>'}
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Customer</th>
              <th class="pb-2 pr-3">Trips</th>
              <th class="pb-2 pr-3">Verification Status</th>
              <th class="pb-2 pr-3">Identity Details</th>
              <th class="pb-2 pr-3">Submission</th>
              <th class="pb-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows
              .map((row) => renderCustomerRow(row, serviceReady))
              .join('')
              : `<tr><td colspan="6" class="py-6">${renderEmptyState({ title: 'No customers found', message: 'No customer profile matched the current search.', actionLabel: 'Clear Search', actionId: 'clearCustomerSearch' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Professional Status Guide</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        ${renderGuideTile('Pending', 'Amber', 'Customer profile is waiting for verification submission or review.')}
        ${renderGuideTile('Pending Review', 'Amber', 'Customer submitted KYC data and waits for admin decision.')}
        ${renderGuideTile('Approved', 'Green', 'Identity verified and trusted for full account usage.')}
      </div>
    </section>
  `;

  host.querySelector('#refreshCustomersBtn')?.addEventListener('click', async () => {
    if (typeof reloadCustomersData === 'function') {
      await reloadCustomersData();
      rerender?.();
    }

    notify('Customer verification data refreshed', 'success');
  });

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
      button.classList.add('opacity-70', 'cursor-not-allowed');

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
      }
    });
  });

  host.querySelector('#clearCustomerSearch')?.addEventListener('click', () => {
    notify('Clear global search to restore full customer list', 'info');
  });

  return host;
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

function renderCustomerRow(row, serviceReady) {
  const statusMeta = verificationStatusMeta(row && row.verificationStatus ? row.verificationStatus : 'not_submitted');
  const documentText = formatDocumentText(row);
  const submittedAt = formatDateTime(row && row.verificationSubmittedAt ? row.verificationSubmittedAt : '');

  return `<tr class="border-b border-slate-100 dark:border-white/5">
    <td class="py-3 pr-3">
      <p class="font-bold">${escapeHtml(row && row.name ? row.name : 'Customer')}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(shortUserId(row && row.id ? row.id : ''))}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row && row.email ? row.email : '-')}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row && row.phoneNumber ? row.phoneNumber : 'No phone')}</p>
    </td>
    <td class="py-3 pr-3 font-semibold">${Number.isFinite(Number(row && row.trips ? row.trips : 0)) ? Number(row.trips) : 0}</td>
    <td class="py-3 pr-3">${renderStatusBadge(statusMeta)}</td>
    <td class="py-3 pr-3">
      <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(documentText)}</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row && row.gender ? `Gender: ${row.gender}` : 'Gender: -')}</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row && row.city ? `${row.city}${row.country ? ', ' + row.country : ''}` : (row && row.country ? row.country : '-'))}</p>
    </td>
    <td class="py-3 pr-3">
      <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(submittedAt || 'Pending')}</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row && row.verificationNote ? row.verificationNote : '-')}</p>
    </td>
    <td class="py-3 pr-3">${renderActionButtons(row, statusMeta, serviceReady)}</td>
  </tr>`;
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

function renderActionButtons(row, statusMeta, serviceReady) {
  if (!serviceReady) {
    return '<span class="text-xs text-slate-500 dark:text-slate-400">Unavailable</span>';
  }

  const userId = escapeHtml(String(row && row.id ? row.id : ''));
  const customerName = escapeHtml(String(row && row.name ? row.name : 'Customer'));

  if (statusMeta.key === 'not_submitted') {
    return '<span class="text-xs font-semibold text-amber-700 dark:text-amber-300">Pending customer submission</span>';
  }

  const approveButton = statusMeta.key === 'approved'
    ? ''
    : `<button data-verification-action="approved" data-user-id="${userId}" data-customer-name="${customerName}" class="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">Approve</button>`;

  const rejectButton = statusMeta.key === 'rejected'
    ? ''
    : `<button data-verification-action="rejected" data-user-id="${userId}" data-customer-name="${customerName}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-500/10">Reject</button>`;

  const pendingButton = statusMeta.key === 'pending'
    ? ''
    : `<button data-verification-action="pending" data-user-id="${userId}" data-customer-name="${customerName}" class="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-300 dark:hover:bg-amber-500/10">Set Pending</button>`;

  return `<div class="flex flex-wrap gap-2">${approveButton}${rejectButton}${pendingButton}</div>`;
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

function formatDateTime(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  try {
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_error) {
    return text;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
