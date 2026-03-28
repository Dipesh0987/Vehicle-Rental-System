import { classMap } from '../config.js';
import { filterRows, sortRows } from '../table-utils.js';
import { openDrawer, renderEmptyState } from '../ui.js';

export function renderBookingsModule({ data, query, notify }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  const rows = sortRows(filterRows(data.bookings, query, ['id', 'customer', 'vehicle', 'type', 'status']), 'start');

  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reservations</p>
        <h2 class="${classMap.heading}">Booking & Reservation Control</h2>
      </div>
      <button id="manualBookingBtn" class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">Manual Booking</button>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Filter by Date</span>
          <input id="bookingDate" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5" />
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Status</span>
          <select id="bookingStatus" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            <option value="">All</option>
            <option>Confirmed</option>
            <option>Ongoing</option>
            <option>Pending</option>
            <option>Cancelled</option>
          </select>
        </label>
        <label class="space-y-1 text-sm font-semibold">
          <span class="text-slate-600 dark:text-slate-300">Vehicle Type</span>
          <select id="bookingType" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-white/5">
            <option value="">All</option>
            <option>SUV</option>
            <option>Sedan</option>
            <option>Electric</option>
            <option>Luxury</option>
          </select>
        </label>
        <button id="detectConflictBtn" class="self-end rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300">Detect Conflicts</button>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="mb-3 text-base font-extrabold">Reservation Table</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th class="pb-2 pr-3">Booking</th>
              <th class="pb-2 pr-3">Customer</th>
              <th class="pb-2 pr-3">Vehicle</th>
              <th class="pb-2 pr-3">Date</th>
              <th class="pb-2 pr-3">Type</th>
              <th class="pb-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows
              .map(
                (row) => `<tr class="border-b border-slate-100 dark:border-white/5">
                  <td class="py-3 pr-3 font-bold">${row.id}</td>
                  <td class="py-3 pr-3">${row.customer}</td>
                  <td class="py-3 pr-3">${row.vehicle}</td>
                  <td class="py-3 pr-3">${row.start} to ${row.end}</td>
                  <td class="py-3 pr-3">${row.type}</td>
                  <td class="py-3 pr-3"><span class="${statusClass(row.status)}">${row.status}</span></td>
                </tr>`
              )
              .join('')
              : `<tr><td colspan="6" class="py-6">${renderEmptyState({ title: 'No reservations match', message: 'Use status and date filters to refine reservations.', actionLabel: 'Create Booking', actionId: 'emptyCreateBooking' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="${classMap.panel} p-4 sm:p-5">
      <h3 class="text-base font-extrabold">Calendar View</h3>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          .map(
            (day, index) => `<div class="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">${day}</p>
              <p class="mt-2 text-sm font-semibold">${index + 28} Mar</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${index % 2 === 0 ? '2 bookings' : '1 booking'}</p>
            </div>`
          )
          .join('')}
      </div>
    </section>
  `;

  host.querySelector('#manualBookingBtn')?.addEventListener('click', () => {
    openDrawer({
      title: 'Manual Booking Creation',
      content: `
        <div class="space-y-3">
          <label class="block space-y-1"><span class="text-xs font-semibold">Customer</span><input class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Search customer" /></label>
          <label class="block space-y-1"><span class="text-xs font-semibold">Vehicle</span><input class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" placeholder="Select vehicle" /></label>
          <div class="grid grid-cols-2 gap-2">
            <label class="block space-y-1"><span class="text-xs font-semibold">Start</span><input type="date" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" /></label>
            <label class="block space-y-1"><span class="text-xs font-semibold">End</span><input type="date" class="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" /></label>
          </div>
          <button class="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Create Booking</button>
        </div>
      `,
    });
    notify('Manual booking form opened', 'success');
  });

  host.querySelector('#detectConflictBtn')?.addEventListener('click', () => {
    const conflicts = detectConflicts(rows);
    if (conflicts.length) {
      notify(`Conflict detected: ${conflicts[0]}`, 'error');
      return;
    }
    notify('No booking conflict detected', 'success');
  });

  host.querySelector('#emptyCreateBooking')?.addEventListener('click', () => {
    host.querySelector('#manualBookingBtn')?.click();
  });

  return host;
}

function detectConflicts(rows) {
  const index = new Map();
  const conflicts = [];

  rows.forEach((row) => {
    const key = `${row.vehicle}-${row.start}`;
    if (index.has(key)) {
      conflicts.push(`${row.id} overlaps with ${index.get(key)} on ${row.vehicle}`);
    } else {
      index.set(key, row.id);
    }
  });

  return conflicts;
}

function statusClass(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Confirmed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (status === 'Ongoing') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (status === 'Pending') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
}
