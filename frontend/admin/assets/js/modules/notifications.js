import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderNotificationsModule({ data, query, notify, navigate }) {
  const host = document.createElement('section');
  const allRows = Array.isArray(data && data.notifications) ? data.notifications : [];
  const rows = filterRows(allRows, query, ['id', 'title', 'channel', 'priority']);
  const queueSummary = allRows.find((row) => String(row && row.type ? row.type : '') === 'verification_queue') || null;
  const verificationRows = allRows.filter((row) => String(row && row.type ? row.type : '') === 'verification_submission');

  host.className = 'space-y-4';
  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Realtime</p>
        <h2 class="${classMap.heading}">Notification Center</h2>
      </div>
      <div class="flex gap-2">
        <button id="sendEmailAlert" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Send Email Alert</button>
        <button id="sendSmsAlert"   class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Send SMS Alert</button>
      </div>
    </header>

    ${queueSummary
      ? `<section class="${classMap.panel} border-amber-300/70 bg-[linear-gradient(130deg,rgba(255,247,214,0.95),rgba(255,238,191,0.9))] p-4 sm:p-5 dark:border-amber-400/30 dark:bg-amber-500/10">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.13em] text-amber-800 dark:text-amber-200">KYC Queue Alert</p>
              <p class="mt-1 text-sm font-extrabold text-amber-900 dark:text-amber-100">${queueSummary.title}</p>
              <p class="mt-1 text-xs font-semibold text-amber-800/85 dark:text-amber-200/90">${verificationRows.length} detailed customer submission alert${verificationRows.length === 1 ? '' : 's'} generated for review workflow.</p>
            </div>
            <button data-nav-to="customers" class="rounded-full border border-amber-400 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-800 transition hover:bg-amber-50 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">Review Now</button>
          </div>
        </section>`
      : ''}

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="space-y-2">
        ${rows.length === 0
          ? '<p class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No notifications yet.</p>'
          : rows.map((row) => {
              const navTarget = resolveNavTarget(row);
              const icon = resolveIcon(row);
              const isClickable = Boolean(navTarget);
              return `<${isClickable ? `button data-nav-to="${navTarget}"` : 'article'} class="w-full rounded-xl border text-left transition ${notifBorderClass(row)} ${isClickable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : ''} p-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="material-symbols-outlined shrink-0 text-[19px] ${icon.color}">${icon.name}</span>
                    <p class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">${row.title}</p>
                  </div>
                  <span class="${priorityClass(row.priority)}">${row.priority}</span>
                </div>
                <div class="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span class="rounded-full bg-slate-100 px-2 py-1 font-semibold dark:bg-white/10">${row.channel}</span>
                  <span>${row.time}</span>
                  ${isClickable ? '<span class="ml-auto material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">arrow_forward</span>' : ''}
                </div>
              </${isClickable ? 'button' : 'article'}>`;
            }).join('')
        }
      </div>
    </section>
  `;

  host.querySelector('#sendEmailAlert')?.addEventListener('click', () => notify('Email alert pipeline triggered', 'success'));
  host.querySelector('#sendSmsAlert')?.addEventListener('click',   () => notify('SMS alert pipeline triggered', 'success'));

  host.querySelectorAll('[data-nav-to]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-nav-to');
      if (target && typeof navigate === 'function') navigate(target);
    });
  });

  return host;
}

function resolveNavTarget(row) {
  const type = String(row && row.type ? row.type : '').trim().toLowerCase();
  if (type === 'verification_queue' || type === 'verification_submission') return 'customers';
  if (type === 'booking_created') return 'bookings';
  if (type === 'payment_success' || type === 'payment_initiated' || type === 'payment_due') return 'payments';
  if (type === 'damage_bill_issued' || type === 'damage_bill_overdue' || type === 'damage_bill_paid') return 'maintenance';
  return '';
}

function resolveIcon(row) {
  const type = String(row && row.type ? row.type : '').trim().toLowerCase();
  if (type === 'verification_queue' || type === 'verification_submission') return { name: 'verified_user', color: 'text-amber-500 dark:text-amber-400' };
  if (type === 'booking_created') return { name: 'event_note', color: 'text-brand-500 dark:text-brand-400' };
  if (type.startsWith('payment')) return { name: 'credit_card', color: 'text-emerald-500 dark:text-emerald-400' };
  if (type.startsWith('damage')) return { name: 'car_crash', color: 'text-rose-500 dark:text-rose-400' };
  return { name: 'notifications', color: 'text-slate-400 dark:text-slate-500' };
}

function notifBorderClass(row) {
  const type = String(row && row.type ? row.type : '').trim().toLowerCase();
  if (type === 'verification_queue' || type === 'verification_submission') return 'border-amber-300/70 bg-amber-50/50 dark:border-amber-400/30 dark:bg-amber-500/10';
  if (type === 'booking_created') return 'border-brand-300/60 bg-brand-50/40 dark:border-brand-400/30 dark:bg-brand-500/10';
  if (type.startsWith('damage')) return 'border-rose-300/60 bg-rose-50/40 dark:border-rose-400/30 dark:bg-rose-500/10';
  return 'border-slate-200 dark:border-white/10';
}

function priorityClass(priority) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (priority === 'Critical') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (priority === 'High')     return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (priority === 'Normal')   return `${base} bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
}
