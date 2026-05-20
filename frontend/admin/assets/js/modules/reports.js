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
          <p id="reportRepeatPct" class="mt-1 text-2xl font-extrabold">–</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Customers with 2+ bookings</p>
        </article>
        <article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Avg Booking Duration</p>
          <p id="reportAvgDuration" class="mt-1 text-2xl font-extrabold">–</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Average rental days per booking</p>
        </article>
        <article class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Top Segment</p>
          <p id="reportTopSegment" class="mt-1 text-2xl font-extrabold">–</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Most booked vehicle category</p>
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

  function buildRevenueChartData(startDate, endDate) {
    const payments = Array.isArray(data.payments) ? data.payments : [];
    const dayMs = 86400000;
    const labels = [];
    const values = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const s = new Date(startDate);
    const e = new Date(endDate);
    const totalDays = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / dayMs));

    for (let i = 0; i < totalDays && i < 31; i++) {
      const d = new Date(s.getTime() + i * dayMs);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      labels.push(totalDays <= 7 ? dayNames[d.getDay()] : iso.slice(5));

      let rev = 0;
      payments.forEach((p) => {
        const pDate = String(p.paid_at || p.created_at || '').slice(0, 10);
        if (pDate === iso && String(p.status || '').toLowerCase() === 'completed') {
          rev += Number(p.amount || 0);
        }
      });
      values.push(Math.round(rev));
    }

    return { labels, values };
  }

  function computeCustomerBehavior() {
    const bookings = Array.isArray(data.bookings) ? data.bookings : [];

    // Repeat customers: customers with 2+ bookings
    const customerMap = {};
    bookings.forEach((b) => {
      const key = b.customerEmail || b.customerUserId || b.customer;
      if (key) customerMap[key] = (customerMap[key] || 0) + 1;
    });
    const totalCustomers = Object.keys(customerMap).length;
    const repeatCustomers = Object.values(customerMap).filter((c) => c >= 2).length;
    const repeatPct = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    // Average booking duration in days
    let totalDays = 0;
    let countWithDates = 0;
    bookings.forEach((b) => {
      if (b.start && b.end) {
        const s = new Date(b.start);
        const e = new Date(b.end);
        if (!isNaN(s) && !isNaN(e) && e > s) {
          totalDays += Math.ceil((e.getTime() - s.getTime()) / 86400000);
          countWithDates++;
        }
      }
    });
    const avgDuration = countWithDates > 0 ? (totalDays / countWithDates).toFixed(1) : '0';

    // Top segment by booking count
    const segCounts = {};
    bookings.forEach((b) => {
      const seg = b.vehicleType || b.type || 'Other';
      segCounts[seg] = (segCounts[seg] || 0) + 1;
    });
    const topSeg = Object.entries(segCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      repeatPct: repeatPct + '%',
      avgDuration: avgDuration + ' days',
      topSegment: topSeg ? topSeg[0] : '–',
    };
  }

  function renderCharts() {
    const startInput = host.querySelector('#reportDateStart');
    const endInput   = host.querySelector('#reportDateEnd');
    const startDate  = startInput ? new Date(startInput.value + 'T00:00:00') : range.start;
    const endDate    = endInput   ? new Date(endInput.value   + 'T23:59:59') : range.end;

    const revData = buildRevenueChartData(startDate, endDate);
    renderLineChart(
      'reportsRevenueChart',
      revData.labels,
      'Revenue',
      revData.values,
      '#f08f5f'
    );

    const utilRows = getUtilData(startDate, endDate);
    renderSegmentUtilizationChart(
      'reportsSegmentUtilChart',
      utilRows.map((r) => r.label),
      utilRows.map((r) => r.value),
      getSegmentColors(utilRows)
    );

    // Fill customer behavior highlights
    const behavior = computeCustomerBehavior();
    const repeatEl = host.querySelector('#reportRepeatPct');
    const durationEl = host.querySelector('#reportAvgDuration');
    const topSegEl = host.querySelector('#reportTopSegment');
    if (repeatEl) repeatEl.textContent = behavior.repeatPct;
    if (durationEl) durationEl.textContent = behavior.avgDuration;
    if (topSegEl) topSegEl.textContent = behavior.topSegment;
  }

  queueMicrotask(renderCharts);

  // ---- Date filter change ----
  host.querySelector('#reportDateStart')?.addEventListener('change', renderCharts);
  host.querySelector('#reportDateEnd')?.addEventListener('change', renderCharts);

  // ---- Export buttons ----
  host.querySelector('#exportCsvBtn')?.addEventListener('click', () => {
    try {
      const bookings = Array.isArray(data.bookings) ? data.bookings : [];
      const headers = ['Booking ID', 'Customer', 'Vehicle', 'Start', 'End', 'Status', 'Payment Status', 'Total'];
      const rows = bookings.map((b) => [
        b.id || '', b.customer || '', b.vehicle || '', b.start || '', b.end || '',
        b.status || '', b.paymentStatusLabel || b.paymentStatus || '', b.total || 0
      ]);
      const csvContent = [headers, ...rows].map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fleet-report-' + toISODate(new Date()) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      notify('CSV report downloaded', 'success');
    } catch (err) {
      notify('CSV export failed: ' + err.message, 'error');
    }
  });

  host.querySelector('#exportPdfBtn')?.addEventListener('click', () => {
    try {
      const bookings = Array.isArray(data.bookings) ? data.bookings : [];
      const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
      const metrics = data.metrics || {};
      const lines = [
        'FLEET REPORT - ' + toISODate(new Date()),
        '='.repeat(50),
        '',
        'SUMMARY',
        'Total Vehicles: ' + (metrics.totalVehicles || vehicles.length),
        'Active Rentals: ' + (metrics.activeRentals || 0),
        'Daily Bookings: ' + (metrics.dailyBookings || 0),
        'Revenue: NPR ' + (metrics.revenue || 0),
        '',
        'BOOKINGS (' + bookings.length + ' total)',
        '-'.repeat(50),
      ];
      bookings.forEach((b) => {
        lines.push([b.id, b.customer, b.vehicle, b.start + ' - ' + b.end, b.status, 'NPR ' + (b.total || 0)].join(' | '));
      });
      lines.push('', 'VEHICLES (' + vehicles.length + ' total)', '-'.repeat(50));
      vehicles.forEach((v) => {
        lines.push([v.name, v.category, v.status, 'NPR ' + (v.daily || 0) + '/day'].join(' | '));
      });
      const textContent = lines.join('\n');
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fleet-report-' + toISODate(new Date()) + '.txt';
      a.click();
      URL.revokeObjectURL(url);
      notify('Report downloaded (text format)', 'success');
    } catch (err) {
      notify('Report export failed: ' + err.message, 'error');
    }
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
