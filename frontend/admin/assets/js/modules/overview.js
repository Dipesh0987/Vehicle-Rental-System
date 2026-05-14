import { classMap, SEGMENT_COLORS } from '../config.js';
import { renderBarChart, renderLineChart, renderPieChart, renderSegmentUtilizationChart } from '../charts.js';
import { getWorkshopSummaryCounts } from './maintenance.js';

export function renderOverviewModule({ data, navigate }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const driverRows = Array.isArray(data.drivers) ? data.drivers : [];
  const availableDrivers = driverRows.filter((d) => d.availability === 'Available').length;
  const ws = getWorkshopSummaryCounts(data);

  const metrics = [
    { label: 'Total Vehicles', value: data.metrics.totalVehicles, delta: '+3.2% this week' },
    { label: 'Active Rentals', value: data.metrics.activeRentals, delta: '+8 currently in transit' },
    { label: 'Daily Bookings', value: data.metrics.dailyBookings, delta: '+14.5% vs yesterday' },
    { label: 'Revenue', value: formatNpr(data.metrics.revenue), delta: '+12.1% MTD' },
    { label: 'Drivers', value: driverRows.length, delta: `${availableDrivers} available now` },
  ];

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Overview</p>
        <h2 class="${classMap.heading}">Enterprise Fleet Snapshot</h2>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Sync window: last 5 minutes
      </div>
    </header>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      ${metrics
        .map(
          (item) => `<article class="${classMap.panel} card-hover p-4">
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">${item.label}</p>
            <p class="mt-2 text-2xl font-extrabold tracking-[-0.03em]">${item.value}</p>
            <p class="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">${item.delta}</p>
          </article>`
        )
        .join('')}
    </div>

    <!-- Workshop Priorities -->
    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-extrabold">Workshop Priorities</h3>
        <button data-go-maintenance class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">View all</button>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        ${overviewWorkshopMini('schedule', 'Upcoming Services', ws.upcoming, 'amber')}
        ${overviewWorkshopMini('build', 'In Workshop', ws.inWorkshop, 'blue')}
        ${overviewWorkshopMini('warning', 'Damage Claims Open', ws.damageClaimsOpen, 'rose')}
      </div>
    </section>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section class="${classMap.panel} xl:col-span-7 p-4 sm:p-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-extrabold">Revenue Trend</h3>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Last 7 days</span>
        </div>
        <div class="h-[290px]"><canvas id="revenueChart"></canvas></div>
      </section>

      <section class="${classMap.panel} xl:col-span-5 p-4 sm:p-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-extrabold">Fleet Mix</h3>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Category share</span>
        </div>
        <div class="h-[290px]"><canvas id="fleetPieChart"></canvas></div>
      </section>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section class="${classMap.panel} xl:col-span-6 p-4 sm:p-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-extrabold">Utilization by Segment</h3>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Current capacity use</span>
        </div>
        <div class="h-[280px]"><canvas id="utilizationBarChart"></canvas></div>
      </section>

      <section class="${classMap.panel} xl:col-span-6 p-4 sm:p-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-extrabold">Recent Activity</h3>
          <button class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200">View log</button>
        </div>
        <ul class="space-y-2">
          ${data.activities
            .map(
              (activity) => `<li class="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-bold">${activity.type}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-300">${activity.detail}</p>
                  </div>
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${activity.time}</span>
                </div>
              </li>`
            )
            .join('')}
        </ul>
      </section>
    </div>
  `;

  // Navigate to maintenance on click
  host.querySelectorAll('[data-go-maintenance]').forEach((el) => {
    el.addEventListener('click', () => { if (navigate) navigate('maintenance'); });
  });

  queueMicrotask(() => {
    renderLineChart(
      'revenueChart',
      data.revenueTrend.map((item) => item.label),
      'Revenue',
      data.revenueTrend.map((item) => item.revenue),
      '#1f7668'
    );

    renderPieChart(
      'fleetPieChart',
      data.fleetCategory.map((item) => item.type),
      data.fleetCategory.map((item) => item.count)
    );

    const utilColors = data.utilization.map((item) => SEGMENT_COLORS[item.label] || '#94a3b8');
    renderSegmentUtilizationChart(
      'utilizationBarChart',
      data.utilization.map((item) => item.label),
      data.utilization.map((item) => item.value),
      utilColors
    );
  });

  return host;
}

function formatNpr(value) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `NPR ${Math.round(normalized).toLocaleString()}`;
}

function overviewWorkshopMini(icon, label, count, color) {
  const bg = {
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
    blue:  'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10',
    rose:  'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10',
  };
  const txt = {
    amber: 'text-amber-700 dark:text-amber-300',
    blue:  'text-blue-700 dark:text-blue-300',
    rose:  'text-rose-700 dark:text-rose-300',
  };
  return `<div data-go-maintenance class="cursor-pointer rounded-xl border p-3 transition hover:shadow-sm ${bg[color] || bg.amber}">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined text-[20px] ${txt[color] || ''}">${icon}</span>
      <span class="text-xs font-bold uppercase tracking-[0.12em] ${txt[color] || ''}">${label}</span>
    </div>
    <p class="mt-1 text-2xl font-extrabold ${txt[color] || ''}">${count}</p>
  </div>`;
}
