import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';

const shortId = (id) => { const s = String(id || ''); return s.length <= 12 ? s : `${s.slice(0, 8)}...${s.slice(-4)}`; };
const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'CU';
const fmtDt = (v) => v ? new Date(v).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
const verifyMeta = (s, isGuest = false) => {
  if (isGuest) return { key: 'guest', label: 'Guest Customer', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' };
  const n = String(s || '').toLowerCase();
  if (n === 'approved' || n === 'verified') return { key: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' };
  if (n === 'pending') return { key: 'pending', label: 'Pending Review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' };
  if (n === 'rejected') return { key: 'rejected', label: 'Rejected', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' };
  return { key: 'not_submitted', label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' };
};
const kycProgress = (key) => ({ approved: 100, pending: 60, rejected: 25 }[key] || 10);
const locText = (c) => [c.city, c.country].filter(Boolean).join(', ') || 'Location not provided';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [statusTab, setStatusTab] = useState('all');

  const fetch_ = async () => {
    setLoading(true);
    
    // Fetch registered users
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (profilesError) console.error('Profiles fetch error:', profilesError.message);
    
    // Fetch guest customers from bookings (where user_id is null)
    const { data: guestBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('customer_name, customer_email, customer_phone, created_at, id')
      .is('user_id', null)
      .order('created_at', { ascending: false });
    
    if (bookingsError) console.error('Bookings fetch error:', bookingsError.message);
    
    // Transform guest bookings into customer format
    const guestCustomers = (guestBookings || []).map((booking, index) => ({
      id: `guest-${booking.id}`,
      full_name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
      created_at: booking.created_at,
      is_guest: true,
      verification_status: 'guest',
      trips: 1,
    }));
    
    // Combine registered users and guest customers
    const allCustomers = [
      ...(profiles || []).map(p => ({ ...p, is_guest: false })),
      ...guestCustomers
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    console.log('Customers fetched:', allCustomers.length, 'records (', (profiles || []).length, 'registered,', guestCustomers.length, 'guests)');
    setCustomers(allCustomers);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const handleVerification = async (userId, status) => {
    setUpdating(true);
    const { error } = await supabase.from('user_profiles').update({
      verification_status: status,
      verification_reviewed_at: new Date().toISOString(),
      verification_notes: status === 'rejected' ? 'Rejected by admin review. Customer should correct and resubmit verification details.' : 'Approved by admin review.',
    }).eq('id', userId);
    if (error) console.error('Verification update failed:', error);
    await fetch_();
    if (detail?.id === userId) setDetail((prev) => prev ? { ...prev, verification_status: status } : null);
    setUpdating(false);
  };

  const summary = useMemo(() => {
    const s = { total: customers.length, pending: 0, approved: 0, rejected: 0, guest: 0 };
    customers.forEach((c) => { 
      const k = verifyMeta(c.verification_status, c.is_guest).key; 
      if (k === 'guest') s.guest++;
      else if (k === 'pending' || k === 'not_submitted') s.pending++; 
      else if (k === 'approved') s.approved++; 
      else if (k === 'rejected') s.rejected++; 
    });
    return s;
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const q = search.toLowerCase();
      const matchQ = !q || [c.full_name, c.email, c.phone, c.verification_status, c.document_number, c.city, c.country].some((f) => String(f || '').toLowerCase().includes(q));
      const k = verifyMeta(c.verification_status, c.is_guest).key;
      const matchTab = statusTab === 'all' || 
        (statusTab === 'pending' && (k === 'pending' || k === 'not_submitted')) || 
        (statusTab === 'guest' && k === 'guest') ||
        statusTab === k;
      return matchQ && matchTab;
    });
  }, [customers, search, statusTab]);

  const chips = [
    { key: 'all', label: 'All', count: filtered.length },
    { key: 'guest', label: 'Guests', count: summary.guest },
    { key: 'pending', label: 'Pending', count: summary.pending },
    { key: 'approved', label: 'Approved', count: summary.approved },
    { key: 'rejected', label: 'Rejected', count: summary.rejected },
  ];

  /* ─── Detail Page ─── */
  const renderDetail = (row) => {
    const meta = verifyMeta(row.verification_status, row.is_guest);
    const progress = kycProgress(meta.key);
    const Field = ({ label, value }) => (
      <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '—'}</p>
      </article>
    );
    const Stat = ({ label, value }) => (
      <div className="rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-slate-900/40">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{value || '—'}</p>
      </div>
    );
    const Timeline = ({ label, value }) => (
      <div className="flex gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-slate-900/30">
        <span className="mt-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-[#1f7668]"></span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{value || '—'}</p>
        </div>
      </div>
    );
    const ActionBtn = ({ action, label, cls }) => (
      <button disabled={updating || meta.key === action} onClick={() => handleVerification(row.id, action)}
        className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${cls}`}>
        {updating ? 'Updating…' : label}
      </button>
    );

    return (
      <section className={`${panel} p-4 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setDetail(null)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[16px]">west</span> Back to Customers
          </button>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
            {meta.key === 'approved' && <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1 h-3.5 w-3.5"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.2 7.2a1 1 0 01-1.415 0l-3-3a1 1 0 011.415-1.414L8.8 11.786l6.493-6.496a1 1 0 011.41 0z" clipRule="evenodd" /></svg>}
            {meta.label}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Main info */}
          <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              {row.avatar_url ? <img src={row.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-base font-bold text-white">{initials(row.full_name)}</span>}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold tracking-[-0.01em] text-slate-900 dark:text-slate-100">{row.full_name || 'Customer'}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Customer Detail Page</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="User ID" value={shortId(row.id)} />
              <Field label="Email" value={row.email} />
              <Field label="Phone" value={row.phone} />
              <Field label="Location" value={locText(row)} />
              <Field label="Identity" value={[row.document_type, row.document_number].filter(Boolean).join(' — ') || 'No document'} />
              <Field label="Gender" value={row.gender} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {row.email && <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"><span className="material-symbols-outlined text-[14px]">mail</span>Email Customer</a>}
              {row.phone && <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"><span className="material-symbols-outlined text-[14px]">call</span>Call Customer</a>}
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-3">
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <h4 className="text-sm font-extrabold">{row.is_guest ? 'Guest Booking Info' : 'Verification Snapshot'}</h4>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                <Stat label={row.is_guest ? 'Booking Date' : 'Trips'} value={row.is_guest ? fmtDt(row.created_at) : String(row.trips || 0)} />
                {!row.is_guest && <Stat label="Submitted" value={fmtDt(row.verification_submitted_at) || 'Pending'} />}
                {!row.is_guest && <Stat label="Reviewed" value={fmtDt(row.verification_reviewed_at) || 'Not reviewed yet'} />}
              </div>
              {!row.is_guest && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"><span>KYC Completion</span><span>{progress}%</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-200 dark:bg-white/10">
                    <div className="h-2 rounded-full bg-[linear-gradient(90deg,#1f7668,#1b5f8b)] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}
            </article>
            {!row.is_guest && (
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="text-sm font-extrabold">Admin Actions</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Update verification without leaving this focused page.</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {meta.key !== 'approved' && <ActionBtn action="approved" label="Approve" cls="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10" />}
                  {meta.key !== 'rejected' && <ActionBtn action="rejected" label="Reject" cls="border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-500/10" />}
                  {meta.key !== 'pending' && meta.key !== 'not_submitted' && <ActionBtn action="pending" label="Set Pending" cls="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-300 dark:hover:bg-amber-500/10" />}
                </div>
              </article>
            )}
          </aside>
        </div>

        {/* Document + Timeline (hidden for guests) */}
        {!row.is_guest && (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <h4 className="text-sm font-extrabold">Document Preview</h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hover to inspect the uploaded identity proof.</p>
              {(row.document_front_url || row.document_back_url) ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {row.document_front_url && (
                    <div className="group inline-flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 transition hover:border-[#1f7668]/40 dark:border-white/10 dark:bg-white/5">
                      <a href={row.document_front_url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl">
                        <img src={row.document_front_url} alt="Document front" className="h-44 w-full rounded-xl border border-slate-200 object-cover transition duration-300 group-hover:scale-[1.02] dark:border-white/10" />
                      </a>
                      <a href={row.document_front_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>Open Full Image
                      </a>
                    </div>
                  )}
                  {row.document_back_url && (
                    <div className="group inline-flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 transition hover:border-[#1f7668]/40 dark:border-white/10 dark:bg-white/5">
                      <a href={row.document_back_url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl">
                        <img src={row.document_back_url} alt="Document back" className="h-44 w-full rounded-xl border border-slate-200 object-cover transition duration-300 group-hover:scale-[1.02] dark:border-white/10" />
                      </a>
                      <a href={row.document_back_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>Open Full Image
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">No document image uploaded</p>
              )}
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <h4 className="text-sm font-extrabold">Verification Timeline</h4>
              <div className="mt-3 space-y-2">
                <Timeline label="Profile Created" value={shortId(row.id)} />
                <Timeline label="Verification Submitted" value={fmtDt(row.verification_submitted_at) || 'Pending'} />
                <Timeline label="Latest Admin Note" value={row.verification_notes || 'No note added yet'} />
                <Timeline label="Last Reviewed" value={fmtDt(row.verification_reviewed_at) || 'Not reviewed yet'} />
              </div>
            </article>
          </div>
        )}
      </section>
    );
  };

  /* ─── Focus Card ─── */
  const FocusCard = ({ c, i }) => {
    const meta = verifyMeta(c.verification_status, c.is_guest);
    return (
      <button onClick={() => setDetail(c)} style={{ animationDelay: `${Math.min(7, i) * 26}ms` }}
        className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-[#1f7668]/40 hover:shadow-[0_22px_38px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:hover:border-[#1f7668]/50">
        <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#1f7668]/10 blur-2xl transition duration-300 group-hover:scale-110"></span>
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-sm font-bold text-white">{initials(c.full_name)}</span>}
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{c.full_name || 'Customer'}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{c.email || 'No email'}</p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-slate-900/40"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Trips</p><p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-200">{c.trips || 0}</p></div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-slate-900/40"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">User ID</p><p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-200">{shortId(c.id)}</p></div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-slate-900/40"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Submission</p><p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-200">{fmtDt(c.verification_submitted_at) || 'Not submitted yet'}</p></div>
            <div className="rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-slate-900/40"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Location</p><p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-200">{locText(c)}</p></div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#1f7668]/25 bg-[#1f7668]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-[#1f7668] transition group-hover:bg-[#1f7668] group-hover:text-white dark:border-[#1f7668]/40 dark:text-emerald-300 dark:group-hover:bg-[#1f7668] dark:group-hover:text-white">
            <span>View Individual Details</span>
            <span className="material-symbols-outlined text-[14px] transition-transform duration-300 group-hover:translate-x-0.5">east</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Customer Management</p>
        <h2 className={heading}>All Customers &amp; Guest Bookings</h2>
      </header>

      {/* Summary tiles */}
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {[{ l: 'Total Customers', v: summary.total, c: 'text-slate-700 dark:text-slate-200' }, { l: 'Guest Bookings', v: summary.guest, c: 'text-blue-700 dark:text-blue-300' }, { l: 'Pending Review', v: summary.pending, c: 'text-amber-700 dark:text-amber-300' }, { l: 'Approved', v: summary.approved, c: 'text-emerald-700 dark:text-emerald-300' }, { l: 'Rejected', v: summary.rejected, c: 'text-rose-700 dark:text-rose-300' }].map((t, i) => (
            <article key={i} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t.l}</p>
              <p className={`mt-1 text-lg font-extrabold ${t.c}`}>{t.v}</p>
            </article>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={fetch_} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {detail ? `Viewing: ${detail.full_name || 'Customer'}` : 'Click any customer to view details. Guest customers are from direct bookings.'}
          </p>
        </div>
      </section>

      {/* Detail page or Focus grid */}
      {detail ? renderDetail(detail) : (
        <>
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold">Registered Customers</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Focused view with quick hover insights and direct detail-page navigation.</p>
              </div>
              <p className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-white/10 dark:text-slate-300">{filtered.length} visible</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chips.map((ch) => (
                <button key={ch.key} onClick={() => setStatusTab(ch.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.11em] transition ${statusTab === ch.key ? 'border-[#1f7668] bg-[#1f7668] text-white' : 'border-slate-200 text-slate-600 hover:border-[#1f7668] hover:text-[#1f7668] dark:border-white/10 dark:text-slate-300'}`}>
                  {ch.label} ({ch.count})
                </button>
              ))}
            </div>
            <div className="mt-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
            </div>
            {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading…</div> : filtered.length === 0 ? (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">group_off</span>
                <p className="mt-3 text-sm font-semibold text-slate-500">No customers found</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((c, i) => <FocusCard key={c.id} c={c} i={i} />)}
              </div>
            )}
          </section>

          {/* Professional Status Guide */}
          <section className={`${panel} p-4 sm:p-5`}>
            <h3 className="text-base font-extrabold">Professional Status Guide</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[{ t: 'Pending', tone: 'Amber', d: 'Customer profile is waiting for verification submission or review.' }, { t: 'Pending Review', tone: 'Amber', d: 'Customer submitted KYC data and waits for admin decision.' }, { t: 'Approved', tone: 'Green', d: 'Identity verified and trusted for full account usage.' }].map((g, i) => (
                <article key={i} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  <p className="text-sm font-bold">{g.t}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{g.tone}</p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{g.d}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
