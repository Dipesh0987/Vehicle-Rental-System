import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderReviewsModule({ data, query, notify }) {
  const host = document.createElement('section');
  const rows = filterRows(data.reviews, query, ['id', 'customer', 'feedback']);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Experience</p>
      <h2 class="${classMap.heading}">Reviews & Feedback Moderation</h2>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="space-y-3">
        ${rows
          .map(
            (row) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-bold">${row.customer}</p>
                <div class="flex items-center gap-2">
                  <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-white/10">${'★'.repeat(row.rating)}</span>
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${row.id}</span>
                </div>
              </div>
              <p class="mt-2 text-sm text-slate-700 dark:text-slate-300">${row.feedback}</p>
              <div class="mt-3 flex gap-2">
                <button data-approve="${row.id}" class="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Approve</button>
                <button data-hide="${row.id}" class="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-600">Hide</button>
              </div>
            </article>`
          )
          .join('')}
      </div>
    </section>
  `;

  host.querySelectorAll('[data-approve]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Review ${button.getAttribute('data-approve')} approved`, 'success');
    });
  });

  host.querySelectorAll('[data-hide]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Review ${button.getAttribute('data-hide')} hidden`, 'warn');
    });
  });

  return host;
}
