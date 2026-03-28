import { classMap } from '../config.js';
import { renderBarChart, renderLineChart } from '../charts.js';

export function renderReportsModule({ data, notify }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Business Intelligence</p>
        <h2 class="${classMap.heading}">Advanced Reporting & Analytics</h2>
      </div>
      <div class="flex gap-2">
        <button id="exportCsvBtn" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Export CSV</button>
        <button id="exportPdfBtn" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Export PDF</button>
      </div>
    </header>

    <section class="${classMap.panel} p-3">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="report tabs">
        <button data-report-tab="revenue" class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Revenue</button>
        <button data-report-tab="utilization" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Utilization</button>
        <button data-report-tab="customers" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Customer Behavior</button>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section class="${classMap.panel} xl:col-span-7 p-4 sm:p-5">
        <h3 id="reportPrimaryTitle" class="mb-3 text-base font-extrabold">Revenue Analysis</h3>
        <div class="h-[290px]"><canvas id="reportsRevenueChart"></canvas></div>
      </section>
      <section class="${classMap.panel} xl:col-span-5 p-4 sm:p-5">
        <h3 id="reportSecondaryTitle" class="mb-3 text-base font-extrabold">Vehicle Utilization</h3>
        <div class="h-[290px]"><canvas id="reportsUtilizationChart"></canvas></div>
      </section>
    </div>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Customer Behavior Highlights</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Repeat Customers</p>
          <p class="mt-1 text-2xl font-extrabold">42%</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Returning bookings in last 30 days</p>
        </article>
        <article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Avg Booking Window</p>
          <p class="mt-1 text-2xl font-extrabold">4.3 days</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Lead time before pickup</p>
        </article>
        <article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Top Segment</p>
          <p class="mt-1 text-2xl font-extrabold">SUV</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Highest contribution by revenue</p>
        </article>
      </div>
    </section>
  `;

  queueMicrotask(() => {
    renderLineChart(
      'reportsRevenueChart',
      data.revenueTrend.map((item) => item.label),
      'Revenue',
      data.revenueTrend.map((item) => item.revenue),
      '#f08f5f'
    );

    renderBarChart(
      'reportsUtilizationChart',
      data.utilization.map((item) => item.label),
      data.utilization.map((item) => item.value)
    );
  });

  host.querySelector('#exportCsvBtn')?.addEventListener('click', () => {
    notify('CSV report generated', 'success');
  });

  host.querySelector('#exportPdfBtn')?.addEventListener('click', () => {
    notify('PDF report generated', 'success');
  });

  host.querySelectorAll('[data-report-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-report-tab');
      host.querySelectorAll('[data-report-tab]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('bg-brand-500', active);
        item.classList.toggle('text-white', active);
      });

      const primaryTitle = host.querySelector('#reportPrimaryTitle');
      const secondaryTitle = host.querySelector('#reportSecondaryTitle');
      if (!primaryTitle || !secondaryTitle) return;

      if (tab === 'utilization') {
        primaryTitle.textContent = 'Utilization Heat Trends';
        secondaryTitle.textContent = 'Segment Occupancy';
      } else if (tab === 'customers') {
        primaryTitle.textContent = 'Customer Cohort Revenue';
        secondaryTitle.textContent = 'Retention Segment Split';
      } else {
        primaryTitle.textContent = 'Revenue Analysis';
        secondaryTitle.textContent = 'Vehicle Utilization';
      }
    });
  });

  return host;
}
