import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const fmtNpr = (v) => `NPR ${Number(v || 0).toLocaleString()}`;
const STATUS_OPTIONS = ['', 'completed', 'pending', 'initiated', 'failed', 'expired', 'cancelled', 'refunded'];
// Payment methods: Cash and Online only
const METHOD_OPTIONS = ['', 'cash', 'online'];

const Field = ({ label, value }) => (
  <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '-'}</p>
  </article>
);

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState('');
  const [methodF, setMethodF] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState(null);
  const [booking, setBooking] = useState(null);
  const perPage = 10;

  // QR Code Management
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
    if (error) console.error('Payments fetch error:', error.message, error.code, error);
    console.log('Payments fetched:', data?.length || 0, 'records');
    setPayments(data || []); setLoading(false);
  };

  // Fetch QR Code from settings
  const fetchQRCode = async () => {
    setQrLoading(true);
    try {
      const { data, error } = await supabase
        .from('billing_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_qr_image')
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('QR fetch error:', error);
      }
      
      if (data?.setting_value) {
        setQrImageUrl(data.setting_value);
      } else {
        setQrImageUrl('');
      }
    } catch (err) {
      console.error('Error fetching QR:', err);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => { fetch_(); fetchQRCode(); }, []);

  const openDetail = async (p) => {
    setDetail(p);
    if (p.booking_id) {
      const { data } = await supabase.from('vehicle_bookings').select('*, vehicles(name)').eq('id', p.booking_id).single();
      setBooking(data);
    } else { setBooking(null); }
  };

  // Calculate stats including outstanding balance from bookings
  const [bookingsForStats, setBookingsForStats] = useState([]);
  
  // Fetch bookings to calculate outstanding (remaining unpaid amount)
  useEffect(() => {
    const fetchBookings = async () => {
      const { data } = await supabase
        .from('vehicle_bookings')
        .select('total_amount, paid_amount, is_paid');
      setBookingsForStats(data || []);
    };
    fetchBookings();
  }, [payments]); // Re-fetch when payments change

  const stats = useMemo(() => {
    const s = { revenueCollected: 0, outstanding: 0, completed: 0, failed: 0, receipts: 0 };
    
    // Revenue from completed payments
    payments.forEach((p) => {
      const st = (p.status || '').toLowerCase();
      const amt = Number(p.amount || 0);
      if (st === 'completed') { s.revenueCollected += amt; s.completed++; }
      else if (st === 'failed' || st === 'expired') s.failed++;
      if (p.receipt_sent) s.receipts++;
    });
    
    // Outstanding = remaining unpaid amount from bookings (total - paid)
    bookingsForStats.forEach((b) => {
      const total = Number(b.total_amount || 0);
      const paid = Number(b.paid_amount || 0);
      if (!b.is_paid && total > paid) {
        s.outstanding += (total - paid);
      }
    });
    
    return s;
  }, [payments, bookingsForStats]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchQ = !q || [p.transaction_code, p.status, p.payment_method, p.customer_name, p.customer_email].some((f) => String(f || '').toLowerCase().includes(q));
      const matchStatus = !statusF || p.status === statusF;
      const matchMethod = !methodF || p.payment_method === methodF;
      const d = p.created_at ? p.created_at.slice(0, 10) : '';
      const matchFrom = !fromDate || d >= fromDate;
      const matchTo = !toDate || d <= toDate;
      return matchQ && matchStatus && matchMethod && matchFrom && matchTo;
    });
  }, [payments, search, statusF, methodF, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const hasFilters = statusF || methodF || fromDate || toDate;
  const clearFilters = () => { setStatusF(''); setMethodF(''); setFromDate(''); setToDate(''); setPage(1); };

  const statusColor = (s) => {
    const c = { completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', initiated: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', expired: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300', cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300', refunded: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' };
    return c[s] || c.pending;
  };

  /* ─── Detail Page ─── */
  if (detail) {
    const p = detail;
    const fmtDt = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    return (
      <div className="space-y-4">
        <div className={`${panel} p-4 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => { setDetail(null); setBooking(null); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined text-[16px]">west</span> Back to Payments
            </button>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColor(p.status)}`}>{p.status}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Transaction Details</p>
              <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">{p.transaction_code || p.id?.slice(0, 8)}</h3>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Customer" value={p.customer_name || 'N/A'} />
                <Field label="Customer Email" value={p.customer_email || '-'} />
                <Field label="Amount" value={fmtNpr(p.amount)} />
                <Field label="Total Booking Amount" value={fmtNpr(p.total_booking_amount)} />
                <Field label="Payment Method" value={String(p.payment_method || p.method || '-').toUpperCase()} />
                <Field label="Currency" value={p.currency || 'NPR'} />
                <Field label="Status" value={p.status} />
                <Field label="Created" value={fmtDt(p.created_at)} />
                {p.failure_reason && <Field label="Failure Reason" value={p.failure_reason} />}
              </div>

              {/* Receipt Image from Booking */}
              {booking?.payment_receipt_url && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">Uploaded Payment Receipt:</p>
                  <a href={booking.payment_receipt_url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
                    <img src={booking.payment_receipt_url} alt="Payment receipt" className="w-full max-h-[400px] rounded-lg border border-emerald-300 object-contain bg-white" onError={(e) => { e.target.style.display = 'none'; }} />
                  </a>
                  <a href={booking.payment_receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline">View full size</a>
                </div>
              )}

              {/* Cash Payment Notice */}
              {(p.payment_method === 'cash' || p.method === 'cash') && p.status === 'pending' && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-500/10">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Cash Payment — Awaiting in-person collection</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">The customer has selected cash payment. Confirm after receiving the amount in person.</p>
                </div>
              )}

              {/* Confirm / Reject */}
              {p.status === 'pending' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={async () => {
                    await supabase.from('payments').update({ status: 'completed' }).eq('id', p.id);
                    if (p.booking_id) {
                      await supabase.from('vehicle_bookings').update({ status: 'confirmed', payment_status: 'completed', is_paid: true, paid_amount: p.amount, remaining_amount: 0 }).eq('id', p.booking_id);
                    }
                    await fetch_();
                    const updated = { ...p, status: 'completed' };
                    setDetail(updated);
                    if (booking) setBooking({ ...booking, payment_status: 'completed', status: 'confirmed' });
                  }} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    <span className="material-symbols-outlined text-[16px] align-middle mr-1">check_circle</span> Confirm Payment
                  </button>
                  <button onClick={async () => {
                    if (!confirm('Reject this payment? The booking reservation will be cancelled and dates freed.')) return;
                    await supabase.from('payments').update({ status: 'failed', failure_reason: 'Rejected by admin' }).eq('id', p.id);
                    if (p.booking_id) {
                      await supabase.from('vehicle_bookings').update({ status: 'cancelled', payment_status: 'rejected', is_paid: false }).eq('id', p.booking_id);
                    }
                    await fetch_();
                    const updated = { ...p, status: 'failed' };
                    setDetail(updated);
                    if (booking) setBooking({ ...booking, payment_status: 'rejected', status: 'cancelled' });
                  }} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
                    <span className="material-symbols-outlined text-[16px] align-middle mr-1">cancel</span> Reject Payment
                  </button>
                </div>
              )}
            </article>

            {/* Sidebar: Booking info */}
            <aside className="space-y-3">
              {booking && (
                <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <h4 className="text-sm font-extrabold">Linked Booking</h4>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                    <Field label="Booking Code" value={booking.booking_code || booking.id?.slice(0, 8)} />
                    <Field label="Vehicle" value={booking.vehicles?.name || '-'} />
                    <Field label="Customer" value={booking.customer_name} />
                    <Field label="Dates" value={`${booking.start_date} → ${booking.end_date}`} />
                    <Field label="Booking Status" value={booking.status} />
                    <Field label="Total" value={fmtNpr(booking.total_amount)} />
                  </div>
                </article>
              )}
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="text-sm font-extrabold">Transaction Info</h4>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                  <Field label="Payment ID" value={p.id} />
                  {p.esewa_transaction_uuid && <Field label="eSewa UUID" value={p.esewa_transaction_uuid} />}
                  {p.khalti_transaction_id && <Field label="Khalti ID" value={p.khalti_transaction_id} />}
                  <Field label="Updated" value={fmtDt(p.updated_at)} />
                </div>
              </article>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p>
          <h2 className={heading}>Payments &amp; Transactions</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{payments.length} transaction{payments.length === 1 ? '' : 's'} on file. Showing {filtered.length}.</p>
        </div>
        <button onClick={fetch_} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
          <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
        </button>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {[
          { label: 'Revenue collected', value: fmtNpr(stats.revenueCollected), color: 'text-emerald-600 dark:text-emerald-300' },
          { label: 'Outstanding', value: fmtNpr(stats.outstanding), color: 'text-amber-600 dark:text-amber-300' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600 dark:text-emerald-300' },
          { label: 'Failed', value: stats.failed, color: 'text-rose-600 dark:text-rose-300' },
          { label: 'Receipts sent', value: stats.receipts, color: 'text-slate-700 dark:text-slate-200' },
        ].map((c, i) => (
          <article key={i} className={`${panel} p-4`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className={`mt-2 text-2xl font-extrabold tracking-[-0.03em] ${c.color}`}>{c.value}</p>
          </article>
        ))}
      </section>

      {/* Filters */}
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm font-semibold">
            <span className="text-slate-600 dark:text-slate-300">Status</span>
            <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All statuses'}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span className="text-slate-600 dark:text-slate-300">Method</span>
            <select value={methodF} onChange={(e) => { setMethodF(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
              {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m ? m.toUpperCase() : 'All methods'}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span className="text-slate-600 dark:text-slate-300">From</span>
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span className="text-slate-600 dark:text-slate-300">To</span>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasFilters && (
            <button onClick={clearFilters} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Clear filters</button>
          )}
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search transactions…"
            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </div>
      </section>

      {/* QR Code Management Section */}
      <section className={`${panel} p-4 sm:p-5`}>
        <h3 className={`${heading} mb-4 flex items-center gap-2`}>
          <span className="material-symbols-outlined text-[#1f7668]">qr_code_scanner</span>
          Payment QR Code
        </h3>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Current QR Display */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">Current QR Code</p>
            {qrImageUrl ? (
              <div className="space-y-3">
                <div className="mx-auto w-[180px] h-[180px] rounded-xl border-2 border-dashed border-[#c8dcd6] bg-white flex items-center justify-center overflow-hidden">
                  <img src={qrImageUrl} alt="Payment QR" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex gap-2 justify-center">
                  <a href={qrImageUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    View Full Size
                  </a>
                  <button 
                    onClick={async () => {
                      if (!confirm('Remove this QR code? Customers will see a fallback message.')) return;
                      await supabase.from('billing_settings').upsert({ setting_key: 'payment_qr_image', setting_value: '' }, { onConflict: 'setting_key' });
                      setQrImageUrl('');
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">qr_code</span>
                <p className="text-sm text-slate-500">No QR code uploaded</p>
                <p className="text-xs text-slate-400 mt-1">Customers will see a fallback message</p>
              </div>
            )}
          </div>

          {/* Upload New QR */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">Upload New QR Code</p>
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-[#1f7668] hover:bg-slate-100">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                  className="hidden" 
                  id="qr-upload"
                />
                <label htmlFor="qr-upload" className="cursor-pointer block">
                  {qrFile ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#1f7668]">{qrFile.name}</p>
                      <p className="text-xs text-slate-500">{(qrFile.size / 1024).toFixed(1)} KB</p>
                      <button 
                        onClick={(e) => { e.preventDefault(); setQrFile(null); }}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Clear selection
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-400">cloud_upload</span>
                      <p className="text-sm text-slate-600">Click to select QR image</p>
                      <p className="text-xs text-slate-400">PNG, JPG, JPEG (max 2MB)</p>
                    </div>
                  )}
                </label>
              </div>
              
              <button
                onClick={async () => {
                  if (!qrFile) return;
                  setQrUploading(true);
                  try {
                    // Upload to Supabase Storage
                    const ext = qrFile.name.split('.').pop();
                    const path = `payment-qr/${Date.now()}.${ext}`;
                    
                    const { error: uploadErr } = await supabase.storage
                      .from('payment-assets')
                      .upload(path, qrFile, { upsert: true });
                    
                    if (uploadErr) throw uploadErr;
                    
                    // Get public URL
                    const { data: urlData } = supabase.storage.from('payment-assets').getPublicUrl(path);
                    const publicUrl = urlData?.publicUrl;
                    
                    if (!publicUrl) throw new Error('Failed to get public URL');
                    
                    // Save to settings
                    const { error: upsertErr } = await supabase
                      .from('billing_settings')
                      .upsert(
                        { setting_key: 'payment_qr_image', setting_value: publicUrl },
                        { onConflict: 'setting_key' }
                      );
                    
                    if (upsertErr) throw upsertErr;
                    
                    setQrImageUrl(publicUrl);
                    setQrFile(null);
                    alert('QR code uploaded successfully!');
                  } catch (err) {
                    alert('Failed to upload: ' + err.message);
                  } finally {
                    setQrUploading(false);
                  }
                }}
                disabled={!qrFile || qrUploading}
                className="w-full rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {qrUploading ? 'Uploading...' : 'Upload QR Code'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className={`${panel} overflow-hidden`}>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : paged.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No payments found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3 pl-4">Transaction</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Amount</th>
                  <th className="pb-2 pr-3">Method</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id} onClick={() => openDetail(p)} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="py-3 pr-3 pl-4"><button className="font-mono text-xs font-bold text-[#1f7668] underline decoration-[#1f7668]/30 underline-offset-2 hover:text-[#185f54] dark:text-emerald-300">{p.transaction_code || p.id?.slice(0, 8)}</button></td>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900 dark:text-white">{p.customer_name || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{p.customer_email}</p>
                    </td>
                    <td className="py-3 pr-3 font-semibold">{fmtNpr(p.amount)}</td>
                    <td className="py-3 pr-3 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">{p.payment_method || 'esewa'}</td>
                    <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColor(p.status)}`}>{p.status}</span></td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <span className="text-xs text-slate-500">{filtered.length} payments • Page {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
