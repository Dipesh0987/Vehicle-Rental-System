import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const FILTER_TABS = ['all', 'unread', 'read', 'replied', 'archived'];

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

export default function AdminContacts() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetch_ = async () => {
    setLoading(true);
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const stats = useMemo(() => {
    const s = { total: messages.length, unread: 0, read: 0, replied: 0, archived: 0 };
    messages.forEach((m) => { const st = m.status || 'unread'; if (s[st] !== undefined) s[st]++; });
    return s;
  }, [messages]);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      const q = search.toLowerCase();
      const matchQ = !q || [m.name, m.email, m.subject, m.message].some((f) => String(f || '').toLowerCase().includes(q));
      const st = m.status || 'unread';
      const matchFilter = filter === 'all' ? st !== 'archived' : st === filter;
      return matchQ && matchFilter;
    });
  }, [messages, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const updateStatus = async (id, status) => {
    await supabase.from('contact_messages').update({ status }).eq('id', id);
    await fetch_();
  };

  const deleteMsg = async (id) => {
    await supabase.from('contact_messages').delete().eq('id', id);
    await fetch_();
  };

  const statusBadge = (s) => {
    const map = {
      unread: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
      read: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
      replied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      archived: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',
    };
    return map[s] || map.unread;
  };

  const statCards = [
    { label: 'Total', value: stats.total, icon: 'mail', color: 'text-slate-700 dark:text-slate-200' },
    { label: 'Unread', value: stats.unread, icon: 'mark_email_unread', color: 'text-rose-600 dark:text-rose-400' },
    { label: 'Read', value: stats.read, icon: 'drafts', color: 'text-sky-600 dark:text-sky-400' },
    { label: 'Replied', value: stats.replied, icon: 'reply', color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Archived', value: stats.archived, icon: 'archive', color: 'text-slate-500 dark:text-slate-400' },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Communication</p>
          <h2 className={heading}>Contact Messages</h2>
        </div>
        <button onClick={fetch_} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((c, i) => (
          <div key={i} className={`${panel} p-4 text-center`}>
            <span className={`material-symbols-outlined text-[28px] ${c.color}`}>{c.icon}</span>
            <p className={`mt-1 text-2xl font-extrabold tracking-tight ${c.color}`}>{c.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTER_TABS.map((t) => (
            <button key={t} onClick={() => { setFilter(t); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filter === t ? 'bg-[#1f7668] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
              }`}>{t}</button>
          ))}
        </div>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search messages…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
      </section>

      {/* Message table */}
      <div className={`${panel} overflow-hidden`}>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : paged.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">inbox</span>
            <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">No messages found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/5">
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Sender</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Subject</th>
                  <th className="hidden px-4 py-3 font-bold text-slate-600 dark:text-slate-300 md:table-cell">Message</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Time</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {paged.map((m) => {
                  const st = m.status || 'unread';
                  return (
                    <tr key={m.id} className={`cursor-pointer transition hover:bg-slate-50/60 dark:hover:bg-white/5 ${st === 'unread' ? 'bg-amber-50/40 dark:bg-amber-500/5' : ''}`}
                      onClick={() => setSelected(m)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{m.email}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{m.subject || 'No subject'}</td>
                      <td className="hidden max-w-[260px] truncate px-4 py-3 text-slate-600 dark:text-slate-300 md:table-cell">{m.message}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusBadge(st)}`}>{st}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{timeAgo(m.created_at)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1">
                          {st !== 'read' && (
                            <button onClick={() => updateStatus(m.id, 'read')} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-sky-100 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-400" title="Mark as read">
                              <span className="material-symbols-outlined text-[18px]">drafts</span>
                            </button>
                          )}
                          {st !== 'replied' && (
                            <button onClick={() => updateStatus(m.id, 'replied')} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400" title="Mark as replied">
                              <span className="material-symbols-outlined text-[18px]">reply</span>
                            </button>
                          )}
                          {st !== 'archived' ? (
                            <button onClick={() => updateStatus(m.id, 'archived')} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-300" title="Archive">
                              <span className="material-symbols-outlined text-[18px]">archive</span>
                            </button>
                          ) : (
                            <button onClick={() => updateStatus(m.id, 'read')} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-400" title="Unarchive">
                              <span className="material-symbols-outlined text-[18px]">unarchive</span>
                            </button>
                          )}
                          <button onClick={() => deleteMsg(m.id)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400" title="Delete">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                          <button onClick={() => setSelected(m)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-400" title="View full message">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <span className="text-xs text-slate-500">{filtered.length} messages • Page {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Message detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" onClick={() => setSelected(null)}></div>
          <div className="relative mx-4 w-full max-w-[540px] overflow-hidden rounded-[18px] bg-white shadow-[0_30px_70px_rgba(0,0,0,0.25)] dark:bg-[#1a2228]">
            <div className="flex items-center justify-between bg-[linear-gradient(135deg,#145f59,#1a7a72)] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">{(selected.name || '??').slice(0, 2).toUpperCase()}</span>
                <div>
                  <p className="font-bold text-white">{selected.name}</p>
                  <p className="text-xs text-white/70">{selected.email}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{selected.subject || 'No subject'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selected.created_at ? new Date(selected.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{selected.message}</p>
              </div>
              <div className="flex gap-2">
                {selected.status !== 'read' && <button onClick={() => { updateStatus(selected.id, 'read'); setSelected(null); }} className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700">Mark Read</button>}
                {selected.status !== 'replied' && <button onClick={() => { updateStatus(selected.id, 'replied'); setSelected(null); }} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">Mark Replied</button>}
                {selected.status !== 'archived' && <button onClick={() => { updateStatus(selected.id, 'archived'); setSelected(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200">Archive</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
