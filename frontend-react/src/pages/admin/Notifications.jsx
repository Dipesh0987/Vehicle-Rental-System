import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';

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

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetch_ = async () => {
    setLoading(true);
    const { data } = await supabase.from('notifications').select('*').eq('is_admin', true).order('created_at', { ascending: false }).limit(50);
    setNotifications(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unread.length) {
      await supabase.from('notifications').update({ read: true }).eq('is_admin', true).eq('read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const kycQueue = useMemo(() => notifications.find((n) => n.type === 'verification_queue'), [notifications]);
  const verificationCount = useMemo(() => notifications.filter((n) => n.type === 'verification_submission').length, [notifications]);

  const filtered = useMemo(() => {
    if (!search) return notifications;
    const q = search.toLowerCase();
    return notifications.filter((n) => [n.title, n.channel, n.priority, n.type].some((f) => String(f || '').toLowerCase().includes(q)));
  }, [notifications, search]);

  const iconFor = (type) => {
    const m = { contact: 'mail', booking: 'event_note', payment: 'credit_card', vehicle: 'directions_car', maintenance: 'build', system: 'info', verification: 'verified', verification_queue: 'pending', verification_submission: 'person_search' };
    return m[type] || 'notifications';
  };

  const iconColor = (type) => {
    const m = { contact: 'text-violet-500', booking: 'text-blue-500', payment: 'text-emerald-500', vehicle: 'text-orange-500', maintenance: 'text-amber-500', system: 'text-slate-500', verification: 'text-teal-500', verification_queue: 'text-amber-600', verification_submission: 'text-teal-500' };
    return m[type] || 'text-slate-400';
  };

  const priorityClass = (p) => {
    const base = 'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide';
    if (p === 'high' || p === 'critical') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
    if (p === 'medium') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
    return `${base} bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400`;
  };

  const navTarget = (n) => {
    const t = (n.type || '').toLowerCase();
    if (t.includes('verification')) return '/admin/customers';
    if (t === 'contact') return '/admin/contacts';
    if (t === 'booking') return '/admin/bookings';
    if (t === 'payment') return '/admin/payments';
    if (t === 'maintenance') return '/admin/maintenance';
    if (t === 'vehicle') return '/admin/vehicles';
    return null;
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Realtime</p>
          <h2 className={heading}>Notification Center</h2>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Send Email Alert</button>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Send SMS Alert</button>
        </div>
      </header>

      {/* KYC Queue Alert */}
      {kycQueue && (
        <section className={`${panel} border-amber-300/70 bg-[linear-gradient(130deg,rgba(255,247,214,0.95),rgba(255,238,191,0.9))] p-4 sm:p-5 dark:border-amber-400/30 dark:bg-amber-500/10`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-amber-800 dark:text-amber-200">KYC Queue Alert</p>
              <p className="mt-1 text-sm font-extrabold text-amber-900 dark:text-amber-100">{kycQueue.title}</p>
              <p className="mt-1 text-xs font-semibold text-amber-800/85 dark:text-amber-200/90">{verificationCount} detailed customer submission alert{verificationCount === 1 ? '' : 's'} generated for review workflow.</p>
            </div>
            <button onClick={() => navigate('/admin/customers')} className="rounded-full border border-amber-400 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-800 transition hover:bg-amber-50 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">Review Now</button>
          </div>
        </section>
      )}

      {/* Search + mark all */}
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notifications…"
            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
          <button onClick={markAllRead} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Mark all read</button>
        </div>
      </section>

      {/* Notification list */}
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="space-y-2">
          {loading ? <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</p> : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No notifications yet.</p>
          ) : filtered.map((n) => {
            const target = navTarget(n);
            const isClickable = Boolean(target);
            const borderCls = !n.read
              ? 'border-blue-200 bg-blue-50/40 dark:border-blue-500/30 dark:bg-blue-500/5'
              : 'border-slate-200 dark:border-white/10';
            return (
              <div key={n.id}
                onClick={() => isClickable && navigate(target)}
                className={`w-full rounded-xl border p-3 text-left transition ${borderCls} ${isClickable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`material-symbols-outlined shrink-0 text-[19px] ${iconColor(n.type)}`}>{iconFor(n.type)}</span>
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{n.title}</p>
                  </div>
                  {n.priority && <span className={priorityClass(n.priority)}>{n.priority}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {n.channel && <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold dark:bg-white/10">{n.channel}</span>}
                  <span>{timeAgo(n.created_at)}</span>
                  {isClickable && <span className="ml-auto material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">arrow_forward</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
