import { classMap } from '../config.js';
import { filterRows } from '../table-utils.js';

export function renderNotificationsModule({ data, query, notify, onRefresh }) {
  const host = document.createElement('section');
  const rows = filterRows(data.notifications, query, ['id', 'title', 'channel', 'priority', 'bookingRef']);
  const sorted = rows.slice().sort(sortByRecency);
  const unreadCount = sorted.filter((item) => item.unread).length;

  if (window.adminNotificationFeedTimer) {
    clearTimeout(window.adminNotificationFeedTimer);
  }

  window.adminNotificationFeedTimer = window.setTimeout(() => {
    const newAlert = {
      id: `N-${Date.now()}`,
      title: 'Urgent booking update',
      bookingRef: 'BK-4991',
      channel: 'In-app',
      priority: 'Critical',
      time: 'Just now',
      unread: true,
    };
    data.notifications.unshift(newAlert);
    notify('Critical event received: urgent booking update', 'warn');
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  }, 15000);

  host.className = 'space-y-4';
  host.innerHTML = `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Realtime</p>
        <h2 class="${classMap.heading}">Notification Center</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button id="sendEmailAlert" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Send Email Alert</button>
        <button id="sendSmsAlert" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">Send SMS Alert</button>
        <button id="markAllRead" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-100">Mark all read</button>
      </div>
    </header>

    <section class="${classMap.panel} p-4 sm:p-5">
      <div class="space-y-3 notification-feed">
        ${sorted
          .map((row) => {
            const unreadClass = row.unread ? 'notification-card--unread' : '';
            return `
              <article data-notification-id="${row.id}" class="notification-card rounded-3xl border p-4 shadow-sm ${unreadClass}">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="space-y-2">
                    <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">${row.title}</p>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="notification-pill">${row.bookingRef}</span>
                      <span class="notification-pill ${channelClass(row.channel)}">${row.channel}</span>
                      <span class="notification-pill ${priorityClass(row.priority)}">${row.priority}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-2">
                    <span class="notification-time text-xs font-semibold text-slate-500 dark:text-slate-400">${row.time}</span>
                    ${row.unread ? '<button data-mark-read="' + row.id + '" class="notification-action rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-100">Mark read</button>' : ''}
                  </div>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;

  host.querySelector('#sendEmailAlert')?.addEventListener('click', () => {
    notify('Email alert pipeline triggered', 'success');
  });

  host.querySelector('#sendSmsAlert')?.addEventListener('click', () => {
    notify('SMS alert pipeline triggered', 'success');
  });

  host.querySelector('#markAllRead')?.addEventListener('click', () => {
    data.notifications.forEach((item) => {
      item.unread = false;
    });
    notify('All notifications marked as read', 'info');
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  });

  host.querySelectorAll('[data-mark-read]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-mark-read');
      const notification = data.notifications.find((item) => item.id === id);
      if (!notification) return;
      notification.unread = false;
      notify(`Marked ${notification.bookingRef} as read`, 'info');
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    });
  });

  return host;
}

function parseRelativeTime(value) {
  if (!value) return 0;
  const lower = value.toLowerCase();
  if (lower.includes('just now')) return 0;
  const minutesMatch = lower.match(/(\d+)\s*min/);
  if (minutesMatch) return Number(minutesMatch[1]);
  const hoursMatch = lower.match(/(\d+)\s*hour/);
  if (hoursMatch) return Number(hoursMatch[1]) * 60;
  return 999;
}

function sortByRecency(a, b) {
  return parseRelativeTime(a.time) - parseRelativeTime(b.time);
}

function priorityClass(priority) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (priority === 'Critical') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (priority === 'High') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
}

function channelClass(channel) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (channel === 'SMS') return `${base} bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-950`;
  if (channel === 'Email') return `${base} bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100`;
  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200`;
}
