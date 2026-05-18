import { classMap } from '../config.js';

/**
 * Contact Messages admin module.
 * Fetches messages from the Supabase `contact_messages` table and renders
 * them in a polished, filterable table with status management.
 */

let cachedMessages = [];
let activeFilter = 'all';

async function fetchContactMessages() {
  try {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') return [];
    const client = await window.SupabaseClient.init();
    const { data, error } = await client
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to fetch contact messages:', err);
    return [];
  }
}

async function updateMessageStatus(id, status, notify) {
  try {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') return false;
    const client = await window.SupabaseClient.init();
    const { error } = await client
      .from('contact_messages')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    if (notify) notify(`Message marked as ${status}`, 'success');
    return true;
  } catch (err) {
    console.error('Failed to update contact message status:', err);
    if (notify) notify('Failed to update status', 'error');
    return false;
  }
}

function statusBadge(status) {
  const map = {
    unread:   'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    read:     'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    replied:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    archived: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',
  };
  const cls = map[status] || map.unread;
  return `<span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}">${status}</span>`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filterMessages(messages, filter, query) {
  let filtered = messages;
  if (filter && filter !== 'all') {
    filtered = filtered.filter((m) => m.status === filter);
  }
  if (query && query.trim().length >= 2) {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter((m) => {
      const hay = `${m.name} ${m.email} ${m.subject} ${m.message}`.toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  return filtered;
}

function renderStats(messages) {
  const counts = { total: messages.length, unread: 0, read: 0, replied: 0, archived: 0 };
  messages.forEach((m) => { if (counts[m.status] !== undefined) counts[m.status]++; });

  const cards = [
    { label: 'Total', value: counts.total, icon: 'mail', color: 'text-slate-700 dark:text-slate-200' },
    { label: 'Unread', value: counts.unread, icon: 'mark_email_unread', color: 'text-rose-600 dark:text-rose-400' },
    { label: 'Read', value: counts.read, icon: 'drafts', color: 'text-sky-600 dark:text-sky-400' },
    { label: 'Replied', value: counts.replied, icon: 'reply', color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Archived', value: counts.archived, icon: 'archive', color: 'text-slate-500 dark:text-slate-400' },
  ];

  return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    ${cards.map((c) => `
      <div class="${classMap.panel} p-4 text-center">
        <span class="material-symbols-outlined text-[28px] ${c.color}">${c.icon}</span>
        <p class="mt-1 text-2xl font-extrabold tracking-tight ${c.color}">${c.value}</p>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${c.label}</p>
      </div>
    `).join('')}
  </div>`;
}

function renderTable(messages) {
  if (messages.length === 0) {
    return `<div class="${classMap.panel} p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">inbox</span>
      <p class="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">No messages found</p>
    </div>`;
  }

  return `<div class="${classMap.panel} overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/5">
            <th class="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Sender</th>
            <th class="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Subject</th>
            <th class="hidden px-4 py-3 font-bold text-slate-600 dark:text-slate-300 md:table-cell">Message</th>
            <th class="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Status</th>
            <th class="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Time</th>
            <th class="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-300">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-white/5">
          ${messages.map((m) => `
            <tr data-contact-row-id="${m.id}" class="cursor-pointer transition hover:bg-slate-50/60 dark:hover:bg-white/5 ${m.status === 'unread' ? 'bg-amber-50/40 dark:bg-amber-500/5' : ''}">
              <td class="px-4 py-3">
                <p class="font-semibold text-slate-900 dark:text-white">${escapeHtml(m.name)}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(m.email)}</p>
              </td>
              <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">${escapeHtml(m.subject)}</td>
              <td class="hidden max-w-[260px] truncate px-4 py-3 text-slate-600 dark:text-slate-300 md:table-cell">${escapeHtml(m.message)}</td>
              <td class="px-4 py-3">${statusBadge(m.status)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">${timeAgo(m.created_at)}</td>
              <td class="px-4 py-3 text-right" data-actions-cell>
                <div class="inline-flex gap-1">
                  ${m.status !== 'read' ? `<button data-contact-action="read" data-contact-id="${m.id}" class="rounded-lg p-1.5 text-slate-500 transition hover:bg-sky-100 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-400" title="Mark as read"><span class="material-symbols-outlined text-[18px]">drafts</span></button>` : ''}
                  ${m.status !== 'replied' ? `<button data-contact-action="replied" data-contact-id="${m.id}" class="rounded-lg p-1.5 text-slate-500 transition hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400" title="Mark as replied"><span class="material-symbols-outlined text-[18px]">reply</span></button>` : ''}
                  ${m.status !== 'archived' ? `<button data-contact-action="archived" data-contact-id="${m.id}" class="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-300" title="Archive"><span class="material-symbols-outlined text-[18px]">archive</span></button>` : ''}
                  <button data-contact-action="view" data-contact-id="${m.id}" class="rounded-lg p-1.5 text-slate-500 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-400" title="View full message"><span class="material-symbols-outlined text-[18px]">visibility</span></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderMessageModal(msg) {
  const initials = escapeHtml((msg.name || '??').substring(0, 2).toUpperCase());
  const formattedDate = msg.created_at ? new Date(msg.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return `<div id="contactMsgModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" style="animation:cmFadeIn .2s ease">
    <div class="relative mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_25px_60px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#141d22]" style="animation:cmSlideUp .3s cubic-bezier(0.22,1,0.36,1)">

      <!-- Header Bar -->
      <div class="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#145f59] to-[#1a7a72] px-6 py-4 dark:border-white/5">
        <div class="flex items-center gap-3">
          <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 text-sm font-bold text-white shadow-lg">${initials}</span>
          <div>
            <p class="text-[15px] font-bold text-white">${escapeHtml(msg.name)}</p>
            <p class="text-[12px] font-medium text-white/75">${escapeHtml(msg.email)}</p>
          </div>
        </div>
        <button id="closeContactModal" class="rounded-lg p-1.5 text-white/70 transition hover:bg-white/15 hover:text-white">
          <span class="material-symbols-outlined text-[22px]">close</span>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6">
        <!-- Meta Row -->
        <div class="mb-4 flex flex-wrap items-center gap-3">
          ${statusBadge(msg.status)}
          <span class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span class="material-symbols-outlined text-[14px]">schedule</span>
            ${formattedDate}
          </span>
        </div>

        <!-- Subject -->
        <div class="mb-4">
          <p class="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Subject</p>
          <p class="text-[15px] font-semibold text-slate-900 dark:text-white">${escapeHtml(msg.subject)}</p>
        </div>

        <!-- Message -->
        <div class="mb-5">
          <p class="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Message</p>
          <div class="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-[14px] leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" style="white-space:pre-wrap;max-height:280px;overflow-y:auto">${escapeHtml(msg.message)}</div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/10">
          <div class="flex gap-2">
            <button data-modal-status="read" class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10 dark:hover:text-sky-300">
              <span class="material-symbols-outlined text-[14px]">drafts</span>Read
            </button>
            <button data-modal-status="replied" class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300">
              <span class="material-symbols-outlined text-[14px]">check_circle</span>Replied
            </button>
            <button data-modal-status="archived" class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10">
              <span class="material-symbols-outlined text-[14px]">archive</span>Archive
            </button>
          </div>
          <a href="mailto:${escapeHtml(msg.email)}?subject=Re: ${encodeURIComponent(msg.subject)}" class="inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#145f59,#1a7a72)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,95,89,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(20,95,89,0.4)]">
            <span class="material-symbols-outlined text-[16px]">reply</span> Reply
          </a>
        </div>
      </div>
    </div>
  </div>
  <style>
    @keyframes cmFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes cmSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
  </style>`;
}

export function renderContactsModule({ data, query, notify, rerender }) {
  const host = document.createElement('section');
  host.className = 'space-y-4';

  // Show loading state then fetch
  host.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Inbox</p>
        <h2 class="${classMap.heading}">Contact Messages</h2>
      </div>
      <button id="refreshContactMessages" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/30">
        <span class="material-symbols-outlined mr-1 align-middle text-[16px]">refresh</span>Refresh
      </button>
    </header>
    <div class="flex items-center justify-center py-12">
      <span class="material-symbols-outlined animate-spin text-[32px] text-slate-400">progress_activity</span>
      <span class="ml-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading messages…</span>
    </div>
  `;

  // Async fetch then render
  (async () => {
    cachedMessages = await fetchContactMessages();
    renderContent(host, query, notify, rerender);
  })();

  return host;
}

async function openMessageModal(msg, host, query, notify, rerender) {
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = renderMessageModal(msg);
  document.body.appendChild(modalContainer);
  // Auto-mark as read if unread
  if (msg.status === 'unread') {
    const ok = await updateMessageStatus(msg.id, 'read', null);
    if (ok) {
      msg.status = 'read';
      renderContent(host, query, notify, rerender);
    }
  }
  // Bind close
  modalContainer.querySelector('#closeContactModal')?.addEventListener('click', () => modalContainer.remove());
  modalContainer.querySelector('#contactMsgModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'contactMsgModal') modalContainer.remove();
  });
  // Close on Escape key
  const escHandler = (e) => { if (e.key === 'Escape') { modalContainer.remove(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  // Bind modal status action buttons
  modalContainer.querySelectorAll('[data-modal-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newStatus = btn.getAttribute('data-modal-status');
      const ok = await updateMessageStatus(msg.id, newStatus, notify);
      if (ok) {
        msg.status = newStatus;
        modalContainer.remove();
        renderContent(host, query, notify, rerender);
      }
    });
  });
}

function renderContent(host, query, notify, rerender) {
  const filtered = filterMessages(cachedMessages, activeFilter, query);

  const filterBtns = ['all', 'unread', 'read', 'replied', 'archived'];
  const filterBar = `<div class="flex flex-wrap gap-2">
    ${filterBtns.map((f) => {
      const isActive = f === activeFilter;
      const cls = isActive
        ? 'bg-[#145f59] text-white border-[#145f59] shadow-[0_4px_12px_rgba(20,95,89,0.35)] dark:bg-[#1a7a72] dark:border-[#1a7a72]'
        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-[#e8f5f3] hover:text-[#145f59] hover:border-[#145f59] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-[#1a3a38] dark:hover:text-emerald-300 dark:hover:border-emerald-500';
      return `<button data-contact-filter="${f}" class="rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 ${cls}">${f}</button>`;
    }).join('')}
  </div>`;

  // Keep header
  const header = host.querySelector('header');
  const headerHTML = header ? header.outerHTML : '';

  host.innerHTML = `
    ${headerHTML}
    ${renderStats(cachedMessages)}
    ${filterBar}
    ${renderTable(filtered)}
  `;

  // Bind refresh
  host.querySelector('#refreshContactMessages')?.addEventListener('click', async () => {
    cachedMessages = await fetchContactMessages();
    renderContent(host, query, notify, rerender);
    if (notify) notify('Messages refreshed', 'success');
  });

  // Bind filter buttons
  host.querySelectorAll('[data-contact-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-contact-filter') || 'all';
      renderContent(host, query, notify, rerender);
    });
  });

  // Bind row clicks — clicking anywhere on the row opens the message detail
  host.querySelectorAll('[data-contact-row-id]').forEach((row) => {
    row.addEventListener('click', async (e) => {
      // Skip if the click was on an action button
      if (e.target.closest('[data-actions-cell]')) return;
      const id = row.getAttribute('data-contact-row-id');
      const msg = cachedMessages.find((m) => m.id === id);
      if (!msg) return;
      openMessageModal(msg, host, query, notify, rerender);
    });
  });

  // Bind action buttons (status changes)
  host.querySelectorAll('[data-contact-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-contact-action');
      const id = btn.getAttribute('data-contact-id');
      if (!id) return;

      if (action === 'view') {
        const msg = cachedMessages.find((m) => m.id === id);
        if (!msg) return;
        openMessageModal(msg, host, query, notify, rerender);
        return;
      }

      // Status update
      const ok = await updateMessageStatus(id, action, notify);
      if (ok) {
        const msg = cachedMessages.find((m) => m.id === id);
        if (msg) msg.status = action;
        renderContent(host, query, notify, rerender);
      }
    });
  });
}
