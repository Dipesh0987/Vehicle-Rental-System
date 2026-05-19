import { classMap, SEGMENT_COLORS, SEGMENT_COLOR_LIST } from '../config.js';
import { renderBarChart, renderLineChart, renderSegmentUtilizationChart } from '../charts.js';
import { computeSegmentUtilization, getStaticUtilization } from '../services/utilization.service.js';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export function renderReportsModule({ data, notify }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const range = defaultRange();

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Business Intelligence</p>
        <h2 class="${classMap.heading}">Advanced Reporting & Analytics</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs font-semibold text-slate-500 dark:text-slate-400">From</label>
        <input id="reportDateStart" type="date" value="${toISODate(range.start)}"
          class="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5 dark:text-slate-200" />
        <label class="text-xs font-semibold text-slate-500 dark:text-slate-400">To</label>
        <input id="reportDateEnd" type="date" value="${toISODate(range.end)}"
          class="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5 dark:text-slate-200" />
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
        <div class="mb-3 flex items-center justify-between">
          <h3 id="reportSecondaryTitle" class="text-base font-extrabold">Utilization by Segment</h3>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">0-100 %</span>
        </div>
        <div class="h-[290px]"><canvas id="reportsSegmentUtilChart"></canvas></div>
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

  // ---- Chart rendering helpers ----

  function getUtilData(startDate, endDate) {
    const bookings = Array.isArray(data.bookings) ? data.bookings : [];
    const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];

    if (bookings.length && vehicles.length) {
      return computeSegmentUtilization({ bookings, vehicles, startDate, endDate });
    }
    return getStaticUtilization(data);
  }

  function getSegmentColors(utilRows) {
    return utilRows.map((r) => SEGMENT_COLORS[r.label] || '#94a3b8');
  }

  function renderCharts() {
    const startInput = host.querySelector('#reportDateStart');
    const endInput   = host.querySelector('#reportDateEnd');
    const startDate  = startInput ? new Date(startInput.value + 'T00:00:00') : range.start;
    const endDate    = endInput   ? new Date(endInput.value   + 'T23:59:59') : range.end;

    renderLineChart(
      'reportsRevenueChart',
      data.revenueTrend.map((item) => item.label),
      'Revenue',
      data.revenueTrend.map((item) => item.revenue),
      '#f08f5f'
    );

    const utilRows = getUtilData(startDate, endDate);
    renderSegmentUtilizationChart(
      'reportsSegmentUtilChart',
      utilRows.map((r) => r.label),
      utilRows.map((r) => r.value),
      getSegmentColors(utilRows)
    );
  }

  queueMicrotask(renderCharts);

  // ---- Date filter change ----
  host.querySelector('#reportDateStart')?.addEventListener('change', renderCharts);
  host.querySelector('#reportDateEnd')?.addEventListener('change', renderCharts);

  // ---- Export buttons ----
  host.querySelector('#exportCsvBtn')?.addEventListener('click', () => {
    notify('CSV report generated', 'success');
  });

  host.querySelector('#exportPdfBtn')?.addEventListener('click', () => {
    notify('PDF report generated', 'success');
  });

  // ---- Tab switching ----
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
        secondaryTitle.textContent = 'Utilization by Segment';
      }
    });
  });

  return host;
}
