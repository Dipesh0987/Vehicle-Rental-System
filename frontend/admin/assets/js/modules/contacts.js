import { classMap } from '../config.js';

/**
 * Contact Messages admin module.
 * Fetches messages from the Supabase `contact_messages` table and renders
 * them in a polished, filterable table with status management.
 */

let cachedMessages = [];
let activeFilter = 'all';
let selectedIds = new Set();

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

async function deleteMessages(ids, notify) {
  try {
    if (!ids.length) return false;
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') return false;
    const client = await window.SupabaseClient.init();
    const { error } = await client
      .from('contact_messages')
      .delete()
      .in('id', ids);
    if (error) throw error;
    // Remove from local cache
    cachedMessages = cachedMessages.filter((m) => !ids.includes(m.id));
    selectedIds.clear();
    if (notify) notify(`${ids.length} message${ids.length > 1 ? 's' : ''} deleted`, 'success');
    return true;
  } catch (err) {
    console.error('Failed to delete contact messages:', err);
    if (notify) notify('Failed to delete messages', 'error');
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
  if (filter === 'all') {
    // 'All' excludes archived messages
    filtered = filtered.filter((m) => m.status !== 'archived');
  } else if (filter) {
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

  const allChecked = messages.length > 0 && messages.every((m) => selectedIds.has(m.id));

  return `<div class="${classMap.panel} overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/5">
            <th class="w-10 px-3 py-3"><input type="checkbox" id="selectAllContact" class="h-4 w-4 cursor-pointer rounded accent-[#145f59]" ${allChecked ? 'checked' : ''} /></th>
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
            <tr data-contact-row-id="${m.id}" class="cursor-pointer transition hover:bg-slate-50/60 dark:hover:bg-white/5 ${m.status === 'unread' ? 'bg-amber-50/40 dark:bg-amber-500/5' : ''} ${selectedIds.has(m.id) ? 'bg-[#e8f5f3] dark:bg-[#1a3a38]' : ''}">
              <td class="w-10 px-3 py-3" data-actions-cell><input type="checkbox" data-select-msg="${m.id}" class="h-4 w-4 cursor-pointer rounded accent-[#145f59]" ${selectedIds.has(m.id) ? 'checked' : ''} /></td>
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
                  <button data-contact-action="delete" data-contact-id="${m.id}" class="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400" title="Delete"><span class="material-symbols-outlined text-[18px]">delete</span></button>
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
  return `
  <style>
    @keyframes cmFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes cmSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
    .cm-overlay { position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);animation:cmFadeIn .2s ease; }
    .cm-card { position:relative;margin:0 16px;width:100%;max-width:540px;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,0.25);animation:cmSlideUp .3s cubic-bezier(0.22,1,0.36,1); }
    .cm-card-header { display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:linear-gradient(135deg,#145f59,#1a7a72);border-bottom:1px solid rgba(255,255,255,0.1); }
    .cm-avatar { display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);background:rgba(255,255,255,0.2);font-size:14px;font-weight:700;color:#fff; }
    .cm-sender-info { margin-left:12px; }
    .cm-sender-name { font-size:15px;font-weight:700;color:#fff;margin:0; }
    .cm-sender-email { font-size:12px;color:rgba(255,255,255,0.75);margin:2px 0 0; }
    .cm-close-btn { background:rgba(255,255,255,0.12);border:none;border-radius:8px;padding:6px;cursor:pointer;color:rgba(255,255,255,0.8);transition:background .2s; }
    .cm-close-btn:hover { background:rgba(255,255,255,0.25); }
    .cm-body { padding:24px; }
    .cm-meta { display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:18px; }
    .cm-status-badge { display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em; }
    .cm-status-unread { background:#fee2e2;color:#b91c1c; }
    .cm-status-read { background:#e0f2fe;color:#0369a1; }
    .cm-status-replied { background:#d1fae5;color:#047857; }
    .cm-status-archived { background:#f1f5f9;color:#475569; }
    .cm-time { font-size:12px;color:#64748b;display:flex;align-items:center;gap:4px; }
    .cm-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin:0 0 6px; }
    .cm-subject { font-size:15px;font-weight:600;color:#1e293b;margin:0 0 18px; }
    .cm-message-box { background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;max-height:260px;overflow-y:auto;margin-bottom:20px; }
    .cm-actions { display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:16px;flex-wrap:wrap;gap:8px; }
    .cm-action-btn { display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;color:#475569;background:#fff;cursor:pointer;transition:all .2s; }
    .cm-action-btn:hover { border-color:#145f59;color:#145f59;background:#f0fdfa; }
    .cm-reply-btn { display:inline-flex;align-items:center;gap:6px;padding:8px 20px;border-radius:12px;background:linear-gradient(135deg,#145f59,#1a7a72);color:#fff;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(20,95,89,0.3);transition:transform .2s,box-shadow .2s; }
    .cm-reply-btn:hover { transform:translateY(-2px);box-shadow:0 8px 22px rgba(20,95,89,0.4); }
  </style>
  <div id="contactMsgModal" class="cm-overlay">
    <div class="cm-card">
      <div class="cm-card-header">
        <div style="display:flex;align-items:center">
          <span class="cm-avatar">${initials}</span>
          <div class="cm-sender-info">
            <p class="cm-sender-name">${escapeHtml(msg.name)}</p>
            <p class="cm-sender-email">${escapeHtml(msg.email)}</p>
          </div>
        </div>
        <button id="closeContactModal" class="cm-close-btn">
          <span class="material-symbols-outlined" style="font-size:22px">close</span>
        </button>
      </div>
      <div class="cm-body">
        <div class="cm-meta">
          <span class="cm-status-badge cm-status-${msg.status || 'unread'}">${msg.status || 'unread'}</span>
          <span class="cm-time">
            <span class="material-symbols-outlined" style="font-size:14px">schedule</span>
            ${formattedDate}
          </span>
        </div>
        <p class="cm-label">Subject</p>
        <p class="cm-subject">${escapeHtml(msg.subject)}</p>
        <p class="cm-label">Message</p>
        <div class="cm-message-box">${escapeHtml(msg.message)}</div>
        <div class="cm-actions">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button data-modal-status="read" class="cm-action-btn">
              <span class="material-symbols-outlined" style="font-size:14px">drafts</span>Read
            </button>
            <button data-modal-status="replied" class="cm-action-btn">
              <span class="material-symbols-outlined" style="font-size:14px">check_circle</span>Replied
            </button>
            <button data-modal-status="archived" class="cm-action-btn">
              <span class="material-symbols-outlined" style="font-size:14px">archive</span>Archive
            </button>
            <button data-modal-delete class="cm-action-btn" style="color:#dc2626;border-color:#fecaca">
              <span class="material-symbols-outlined" style="font-size:14px">delete</span>Delete
            </button>
          </div>
          <a href="mailto:${escapeHtml(msg.email)}?subject=Re: ${encodeURIComponent(msg.subject)}" class="cm-reply-btn">
            <span class="material-symbols-outlined" style="font-size:16px">reply</span> Reply
          </a>
        </div>
      </div>
    </div>
  </div>`;
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
  modalContainer.style.cssText = 'position:fixed;inset:0;z-index:9999;';
  modalContainer.innerHTML = renderMessageModal(msg);
  // Append inside #adminApp so Tailwind classes are in scope
  const appRoot = document.getElementById('adminApp') || document.body;
  appRoot.appendChild(modalContainer);
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

  // Bind modal delete button
  modalContainer.querySelector('[data-modal-delete]')?.addEventListener('click', async () => {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    const ok = await deleteMessages([msg.id], notify);
    if (ok) {
      modalContainer.remove();
      renderContent(host, query, notify, rerender);
    }
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

  const bulkBar = selectedIds.size > 0 ? `
    <div class="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
      <span class="text-sm font-semibold text-rose-700 dark:text-rose-300">${selectedIds.size} selected</span>
      <button id="bulkDeleteBtn" class="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700">
        <span class="material-symbols-outlined text-[15px]">delete</span>Delete Selected
      </button>
      <button id="clearSelectionBtn" class="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/20">Clear</button>
    </div>` : '';

  host.innerHTML = `
    ${headerHTML}
    ${renderStats(cachedMessages)}
    ${filterBar}
    ${bulkBar}
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

  // Select-all checkbox
  host.querySelector('#selectAllContact')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const visibleIds = filtered.map((m) => m.id);
    if (checked) {
      visibleIds.forEach((id) => selectedIds.add(id));
    } else {
      visibleIds.forEach((id) => selectedIds.delete(id));
    }
    renderContent(host, query, notify, rerender);
  });

  // Individual checkboxes
  host.querySelectorAll('[data-select-msg]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = cb.getAttribute('data-select-msg');
      if (e.target.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      renderContent(host, query, notify, rerender);
    });
  });

  // Bulk delete
  host.querySelector('#bulkDeleteBtn')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${selectedIds.size} message${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    await deleteMessages([...selectedIds], notify);
    renderContent(host, query, notify, rerender);
  });

  // Clear selection
  host.querySelector('#clearSelectionBtn')?.addEventListener('click', () => {
    selectedIds.clear();
    renderContent(host, query, notify, rerender);
  });

  // Bind row clicks — clicking anywhere on the row opens the message detail
  host.querySelectorAll('[data-contact-row-id]').forEach((row) => {
    row.addEventListener('click', async (e) => {
      if (e.target.closest('[data-actions-cell]')) return;
      const id = row.getAttribute('data-contact-row-id');
      const msg = cachedMessages.find((m) => m.id === id);
      if (!msg) return;
      openMessageModal(msg, host, query, notify, rerender);
    });
  });

  // Bind action buttons (status changes + delete)
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

      if (action === 'delete') {
        if (!confirm('Delete this message? This cannot be undone.')) return;
        await deleteMessages([id], notify);
        renderContent(host, query, notify, rerender);
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
