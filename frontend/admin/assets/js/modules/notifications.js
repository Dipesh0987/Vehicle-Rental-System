import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderNotificationsModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = filterRows(data.notifications, query, ['id', 'title', 'channel', 'priority']);

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

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="space-y-3">
        ${rows
          .map(
            (row) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
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

function priorityClass(priority) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (priority === 'Critical') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (priority === 'High') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
}
