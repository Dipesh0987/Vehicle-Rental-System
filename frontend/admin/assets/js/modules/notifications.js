import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderNotificationsModule({ data, query, notify }) {
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
        <button id="sendEmailAlert" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Send Email Alert</button>
        <button id="sendSmsAlert" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Send SMS Alert</button>
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
            <span class="rounded-full border border-amber-400 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-800 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">Action Required</span>
          </div>
        </section>`
      : ''}

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="space-y-3">
        ${rows
          .map(
            (row) => `<article class="rounded-xl border ${isVerificationNotification(row) ? 'border-amber-300/70 bg-amber-50/50 dark:border-amber-400/30 dark:bg-amber-500/10' : 'border-slate-200 dark:border-white/10'} p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-bold">${row.title}</p>
                <span class="${priorityClass(row.priority)}">${row.priority}</span>
              </div>
              <div class="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span class="rounded-full bg-slate-100 px-2 py-1 font-semibold dark:bg-white/10">${row.channel}</span>
                <span>${row.time}</span>
              </div>
            </article>`
          )
          .join('')}
      </div>
    </section>
  `;

  host.querySelector('#sendEmailAlert')?.addEventListener('click', () => {
    notify('Email alert pipeline triggered', 'success');
  });

  host.querySelector('#sendSmsAlert')?.addEventListener('click', () => {
    notify('SMS alert pipeline triggered', 'success');
  });

  return host;
}

function isVerificationNotification(row) {
  const type = String(row && row.type ? row.type : '').trim().toLowerCase();
  return type === 'verification_queue' || type === 'verification_submission';
}

function priorityClass(priority) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (priority === 'Critical') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (priority === 'High') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
}
