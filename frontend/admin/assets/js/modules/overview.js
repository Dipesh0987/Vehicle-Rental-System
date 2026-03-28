import { classMap } from '../config.js';
import { renderBarChart, renderLineChart, renderPieChart } from '../charts.js';

export function renderOverviewModule({ data }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const metrics = [
    { label: 'Total Vehicles', value: data.metrics.totalVehicles, delta: '+3.2% this week' },
    { label: 'Active Rentals', value: data.metrics.activeRentals, delta: '+8 currently in transit' },
    { label: 'Daily Bookings', value: data.metrics.dailyBookings, delta: '+14.5% vs yesterday' },
    { label: 'Revenue', value: `$${data.metrics.revenue.toLocaleString()}`, delta: '+12.1% MTD' },
    { label: 'Cancellations', value: data.metrics.cancellations, delta: '-2.4% reduced churn' },
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

    renderBarChart(
      'utilizationBarChart',
      data.utilization.map((item) => item.label),
      data.utilization.map((item) => item.value)
    );
  });

  return host;
}
