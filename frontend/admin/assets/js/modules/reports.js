import { classMap } from '../config.js';
import { renderBarChart, renderLineChart } from '../charts.js';

const REPORT_TABS = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'utilization', label: 'Utilization' },
  { id: 'customers', label: 'Customer Behavior' },
];

function formatNepaliRupee(value) {
  return `NPR ${Number(value).toLocaleString('en-IN')}`;
}

function getCurrentWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const sundayOffset = mondayOffset + 6;
  const monday = new Date(today);
  const sunday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  sunday.setDate(today.getDate() + sundayOffset);
  const format = (date) => date.toISOString().slice(0, 10);
  return { start: format(monday), end: format(sunday) };
}

function buildExportFilename(reportType, extension) {
  const range = getCurrentWeekRange();
  return `${reportType.replace(/\s+/g, '_')}_${range.start}_to_${range.end}.${extension}`;
}

function createCsvContent(headers, rows) {
  const escapeCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const csvRows = [headers.map(escapeCell).join(',')];
  rows.forEach((row) => csvRows.push(row.map(escapeCell).join(',')));
  const bom = '\uFEFF';
  return bom + csvRows.join('\r\n');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function createPdfDocument(title, rows) {
  const jspdf = window.jspdf || window.jspPDF || {};
  const jsPDF = jspdf.jsPDF || jspdf;
  if (typeof jsPDF !== 'function') {
    return null;
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title });
  doc.setFontSize(18);
  doc.text(title, 40, 60);
  doc.setFontSize(12);
  let y = 92;
  rows.forEach((row) => {
    doc.text(row.join(' | '), 40, y);
    y += 20;
  });
  return doc;
}

export function renderReportsModule({ data, notify }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';
  let activeTab = 'revenue';

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Business Intelligence</p>
        <h2 class="${classMap.heading}">Advanced Reporting & Analytics</h2>
      </div>
      <div class="flex gap-2">
        <button type="button" id="exportCsvBtn" aria-label="Export revenue report as CSV" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Export CSV</button>
        <button type="button" id="exportPdfBtn" aria-label="Export revenue report as PDF" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Export PDF</button>
      </div>
    </header>

    <section class="${classMap.panel} p-3">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="report tabs">
        ${REPORT_TABS.map((tab) => `<button type="button" data-report-tab="${tab.id}" aria-selected="${tab.id === 'revenue'}" class="rounded-xl px-3 py-2 text-sm font-semibold ${tab.id === 'revenue' ? 'bg-brand-500 text-white' : 'border border-slate-200 dark:border-white/10'}">${tab.label}</button>`).join('')}
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

  function renderRevenueReport() {
    renderLineChart(
      'reportsRevenueChart',
      data.revenueTrend.map((item) => item.label),
      'Revenue',
      data.revenueTrend.map((item) => item.revenue),
      '#f08f5f'
    );
  }

  function renderUtilizationReport() {
    renderBarChart(
      'reportsUtilizationChart',
      data.utilization.map((item) => item.label),
      data.utilization.map((item) => item.value)
    );
  }

  function buildReportRows() {
    return data.revenueTrend.map((item) => [item.label, formatNepaliRupee(item.revenue), item.bookings]);
  }

  function exportCsv() {
    const headers = ['Day', 'Revenue', 'Bookings'];
    const rows = buildReportRows();
    const csv = createCsvContent(headers, rows);
    const filename = buildExportFilename('Revenue_Report', 'csv');
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    notify(`Exported ${filename}`, 'success');
  }

  function exportPdf() {
    const title = `Revenue Report ${getCurrentWeekRange().start} to ${getCurrentWeekRange().end}`;
    const rows = buildReportRows();
    const document = createPdfDocument(title, rows);
    const filename = buildExportFilename('Revenue_Report', 'pdf');
    if (!document) {
      notify('Unable to export PDF. Please try again later.', 'error');
      return;
    }
    document.save(filename);
    notify(`Exported ${filename}`, 'success');
  }

  queueMicrotask(() => {
    renderRevenueReport();
    renderUtilizationReport();
  });

  const exportCsvBtn = host.querySelector('#exportCsvBtn');
  const exportPdfBtn = host.querySelector('#exportPdfBtn');

  exportCsvBtn?.addEventListener('click', exportCsv);
  exportPdfBtn?.addEventListener('click', exportPdf);

  host.querySelectorAll('[data-report-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-report-tab');
      activeTab = tab;
      host.querySelectorAll('[data-report-tab]').forEach((item) => {
        const active = item === button;
        item.setAttribute('aria-selected', String(active));
        item.classList.toggle('bg-brand-500', active);
        item.classList.toggle('text-white', active);
        item.classList.toggle('border', !active);
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

      if (tab === 'revenue') {
        renderRevenueReport();
      }
      if (tab === 'utilization') {
        renderUtilizationReport();
      }
      if (tab === 'customers') {
        renderRevenueReport();
      }
    });
  });

  return host;
}
