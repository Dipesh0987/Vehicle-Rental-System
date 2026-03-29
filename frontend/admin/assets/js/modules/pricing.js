import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderPricingModule({ data, query, notify }) {
  const host = document.createElement('section');
  const promos = filterRows(data.promotions, query, ['code', 'type', 'discount']);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Pricing</p>
        <h2 class="${classMap.heading}">Dynamic Pricing & Promotions</h2>
      </div>
      <button id="newPromoBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Create Discount Code</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Pricing Rules</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${[
          ['Peak Hour Surge', 'Weekday 18:00-22:00', '+18%'],
          ['Weekend Family Pack', 'SUV + Sedan pools', '-12%'],
          ['Seasonal Winter Rule', 'Dec to Feb', '+7%'],
          ['Electric Fleet Incentive', 'All electric vehicles', '-10%'],
        ]
          .map(
            (rule) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p class="text-sm font-bold">${rule[0]}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">${rule[1]}</p>
              <p class="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-300">${rule[2]}</p>
            </article>`
          )
          .join('')}
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="mb-3 text-base font-extrabold">Promotional Codes</h3>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        ${promos
          .map(
            (promo) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p class="font-mono text-sm font-bold">${promo.code}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">${promo.type}</p>
              <div class="mt-3 flex items-center justify-between">
                <span class="text-sm font-bold">${promo.discount}</span>
                <button data-toggle-promo="${promo.code}" class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-white/10">${promo.active ? 'Disable' : 'Enable'}</button>
              </div>
            </article>`
          )
          .join('')}
      </div>
    </section>
  `;

  host.querySelector('#newPromoBtn')?.addEventListener('click', () => {
    notify('Discount code modal opened', 'success');
  });

  host.querySelectorAll('[data-toggle-promo]').forEach((button) => {
    button.addEventListener('click', () => {
      notify(`Promotion ${button.getAttribute('data-toggle-promo')} updated`, 'info');
    });
  });

  return host;
}
