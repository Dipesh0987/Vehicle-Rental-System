import { classMap } from '../config.js';
import { renderBarChart, renderLineChart, renderPieChart } from '../charts.js';
import { buildActivityFeed, ACTIVITY_TYPES, formatRelativeTime } from '../services/activity-feed.service.js';

// Module-level timer so we cancel it on the next render cycle
let _activityTimer = null;

function renderActivityItem(ev) {
  const cfg = ACTIVITY_TYPES[ev.type] || {
    icon: 'notifications', iconHex: '#64748b',
    badgeCls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',
  };
  const safeDetail = String(ev.detail || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <li data-activity-module="${ev.module || ''}"
        class="group flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
      <span class="material-symbols-outlined mt-0.5 flex-shrink-0 text-[20px]" style="color:${cfg.iconHex}">${cfg.icon}</span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badgeCls}">${ev.type}</span>
        <span class="truncate text-[13px] text-slate-700 dark:text-slate-300">${safeDetail}</span>
      </span>
      <span data-ts="${ev.ts || ''}" class="flex-shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">${ev.time}</span>
    </li>`;
}

export function renderOverviewModule({ data, navigate, rerender }) {
  if (_activityTimer) { clearInterval(_activityTimer); _activityTimer = null; }
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const driverRows = Array.isArray(data.drivers) ? data.drivers : [];
  const availableDrivers = driverRows.filter((d) => d.availability === 'Available').length;

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

      <section class="${classMap.panel} xl:col-span-6 p-4 sm:p-5 flex flex-col">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <h3 class="text-base font-extrabold">Live Activity</h3>
          </div>
          <button id="viewActivityLogBtn"
            class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">
            View log
          </button>
        </div>
        ${(() => {
          const feed = buildActivityFeed(data, 8);
          if (!feed.length) return `
            <div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-slate-400 dark:text-slate-500">
              <span class="material-symbols-outlined text-[32px] opacity-40">history</span>
              <p class="text-sm font-semibold">No recent activity</p>
            </div>`;
          return `<ul id="activityFeedList" class="-mx-1 space-y-0.5">${feed.map(renderActivityItem).join('')}</ul>`;
        })()}
      </section>
    </div>
  `;

  // ── "View log" navigates to notifications / audit log ───────────────
  host.querySelector('#viewActivityLogBtn')?.addEventListener('click', () => {
    navigate?.('notifications');
  });

  // ── Clicking an activity row navigates to its module ─────────────────
  host.querySelector('#activityFeedList')?.addEventListener('click', (e) => {
    const li = e.target.closest('[data-activity-module]');
    const mod = li?.getAttribute('data-activity-module');
    if (mod) navigate?.(mod);
  });

  // ── Refresh relative timestamps every 30 s (self-cancels on unmount) ─
  _activityTimer = setInterval(() => {
    const list = document.getElementById('activityFeedList');
    if (!list) { clearInterval(_activityTimer); _activityTimer = null; return; }
    list.querySelectorAll('[data-ts]').forEach((el) => {
      const updated = formatRelativeTime(el.getAttribute('data-ts'));
      if (el.textContent !== updated) el.textContent = updated;
    });
  }, 30_000);

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

function formatNpr(value) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `NPR ${Math.round(normalized).toLocaleString()}`;
}
