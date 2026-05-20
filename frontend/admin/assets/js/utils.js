/**
 * utils.js — Shared admin utility functions
 * Centralises helpers previously duplicated across 9+ module files.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatNpr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'NPR 0';
  return 'NPR ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}

export function statusBadge(status, map) {
  const cls = (map && map[status]) || 'bg-slate-100 text-slate-600';
  return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(status)}</span>`;
}

export function formField(label, name, value = '', type = 'text', required = false, extra = '') {
  return `
    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${escapeHtml(label)}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input type="${type}" name="${name}" value="${escapeHtml(String(value ?? ''))}"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2d7068] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        ${required ? 'required' : ''} ${extra}/>
    </div>`;
}

export function formSelect(label, name, options, selected = '', required = false) {
  const opts = options.map(o => {
    const val = typeof o === 'object' ? o.value : o;
    const lbl = typeof o === 'object' ? o.label : o;
    return `<option value="${escapeHtml(val)}" ${val === selected ? 'selected' : ''}>${escapeHtml(lbl)}</option>`;
  }).join('');
  return `
    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${escapeHtml(label)}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <select name="${name}"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2d7068] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        ${required ? 'required' : ''}>${opts}</select>
    </div>`;
}

export function formTextarea(label, name, value = '', rows = 3, required = false) {
  return `
    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${escapeHtml(label)}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <textarea name="${name}" rows="${rows}"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2d7068] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        ${required ? 'required' : ''}>${escapeHtml(String(value ?? ''))}</textarea>
    </div>`;
}

export function detailField(label, value) {
  return `
    <div class="flex flex-col gap-0.5">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(label)}</span>
      <span class="text-sm text-slate-800 dark:text-slate-200">${escapeHtml(String(value ?? '—'))}</span>
    </div>`;
}
