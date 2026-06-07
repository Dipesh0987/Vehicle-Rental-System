import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBillingPayments, createBillingPayment, verifyPayment, getInvoices } from '../../services/billing.service';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const btnPrimary = 'rounded-xl bg-[#1f7668] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110';
const btnSecondary = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10';
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDt = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const vsMeta = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
};

export default function BillingPayments() {
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [view, setView] = useState('list'); // list | detail | record
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [invoicesList, setInvoicesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { if (searchParams.get('action') === 'record') openRecord(); }, [searchParams]);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const { data, count } = await getBillingPayments({ status: statusFilter, method: methodFilter });
      setPayments(data); setTotal(count);
    } catch (err) { console.error('BillingPayments fetch error:', err); setPayments([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, [statusFilter, methodFilter]);

  const openRecord = async () => {
    const { data } = await getInvoices({ status: 'pending', limit: 100 });
    setInvoicesList(data || []);
    setForm({ payment_method: 'cash', payment_type: 'full', amount: '', invoice_id: '', notes: '' });
    setView('record');
  };

  const handleRecord = async () => {
    if (!form.invoice_id || !form.amount) { alert('Select invoice and enter amount'); return; }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      await createBillingPayment({
        invoice_id: form.invoice_id,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_type: form.payment_type,
        transaction_ref: form.transaction_ref || null,
        notes: form.notes || null,
        verification_status: form.payment_method === 'cash' ? 'verified' : 'pending',
        verified_by: form.payment_method === 'cash' ? session?.session?.user?.id : null,
        verified_at: form.payment_method === 'cash' ? new Date().toISOString() : null,
        created_by: session?.session?.user?.id,
        customer_id: invoicesList.find(i => i.id === form.invoice_id)?.customer_id || null,
      });
      setView('list'); fetch_();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleVerify = async (approved) => {
    if (!approved && !rejectReason) { alert('Enter rejection reason'); return; }
    setSaving(true);
    try {
      await verifyPayment(selected.id, approved, approved ? null : rejectReason);
      setView('list'); fetch_();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  /* ─── RECORD PAYMENT ─── */
  if (view === 'record') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">Record Payment</h2>
        </div>
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Invoice</label><select value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} className={inputCls}><option value="">Select invoice</option>{invoicesList.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name} ({fmt(i.outstanding_balance)} due)</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount (Rs.)</label><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Payment Method</label><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={inputCls}><option value="cash">Cash</option><option value="online_qr">Online QR</option><option value="bank_transfer">Bank Transfer</option><option value="other">Other</option></select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Payment Type</label><select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })} className={inputCls}><option value="full">Full Payment</option><option value="partial">Partial Payment</option><option value="advance">Advance Payment</option></select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Transaction Ref</label><input value={form.transaction_ref || ''} onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })} className={inputCls} placeholder="Optional" /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</label><input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleRecord} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Record Payment'}</button>
            <button onClick={() => setView('list')} className={btnSecondary}>Cancel</button>
          </div>
        </section>
      </div>
    );
  }

  /* ─── DETAIL VIEW ─── */
  if (view === 'detail' && selected) {
    const vs = vsMeta[selected.verification_status] || vsMeta.pending;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView('list'); setSelected(null); }} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">Payment Detail</h2>
        </div>
        <section className={`${panel} p-5`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Invoice</p><p className="mt-1 font-semibold text-[#1f7668]">{selected.invoices?.invoice_number || '—'}</p></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Customer</p><p className="mt-1 font-semibold">{selected.invoices?.customer_name || '—'}</p></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Amount</p><p className="mt-1 text-lg font-extrabold text-emerald-600">{fmt(selected.amount)}</p></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Method</p><p className="mt-1 font-semibold capitalize">{selected.payment_method?.replace('_', ' ')}</p></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Type</p><p className="mt-1 font-semibold capitalize">{selected.payment_type}</p></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Date</p><p className="mt-1 font-semibold">{fmtDt(selected.payment_date)}</p></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Status</p><p className="mt-1"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${vs.cls}`}>{vs.label}</span></p></div>
            {selected.transaction_ref && <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Transaction Ref</p><p className="mt-1 font-semibold">{selected.transaction_ref}</p></div>}
            {selected.notes && <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Notes</p><p className="mt-1 text-slate-700 dark:text-slate-300">{selected.notes}</p></div>}
          </div>

          {/* Receipt Image from storage */}
          {(selected.payment_screenshot || selected.receipt_url) && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 mb-2">
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">receipt</span>
                Payment Receipt
              </p>
              <a href={selected.receipt_url || selected.payment_screenshot} target="_blank" rel="noopener noreferrer">
                <img src={selected.receipt_url || selected.payment_screenshot} alt="Payment receipt" className="max-h-[300px] rounded-xl border border-emerald-300 object-contain bg-white" onError={(e) => e.target.style.display='none'} />
              </a>
              <a href={selected.receipt_url || selected.payment_screenshot} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-emerald-700 underline">View Full Receipt</a>
            </div>
          )}

          {selected.verification_status === 'pending' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Verify Payment</h4>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Review the payment proof and approve or reject.</p>
              <div className="mt-3 space-y-2">
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason (required for reject)" className={inputCls} rows={2} />
                <div className="flex gap-2">
                  <button onClick={() => handleVerify(true)} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">{saving ? '…' : 'Approve'}</button>
                  <button onClick={() => handleVerify(false)} disabled={saving} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">{saving ? '…' : 'Reject'}</button>
                </div>
              </div>
            </div>
          )}

          {selected.verification_status === 'rejected' && selected.rejection_reason && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-400/20 dark:bg-rose-500/5">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Rejection Reason</p>
              <p className="mt-1 text-sm text-rose-600 dark:text-rose-300">{selected.rejection_reason}</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  /* ─── LIST VIEW ─── */
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Billing</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Payment Management</h2>
        </div>
        <button onClick={openRecord} className={btnPrimary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">add</span>Record Payment</button>
      </header>

      <section className={`${panel} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} max-w-[160px]`}><option value="all">All Status</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={`${inputCls} max-w-[160px]`}><option value="all">All Methods</option><option value="cash">Cash</option><option value="online_qr">Online QR</option><option value="bank_transfer">Bank Transfer</option></select>
          <span className="ml-auto text-xs font-semibold text-slate-500">{total} payments</span>
        </div>

        {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading…</div> : payments.length === 0 ? (
          <div className="py-8 text-center"><span className="material-symbols-outlined text-[48px] text-slate-300">credit_card_off</span><p className="mt-2 text-sm text-slate-500">No payments found</p></div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
                <th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {payments.map((p) => {
                  const vs = vsMeta[p.verification_status] || vsMeta.pending;
                  return (
                    <tr key={p.id} onClick={() => { setSelected(p); setView('detail'); setRejectReason(''); }} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-3 py-2.5 font-semibold text-[#1f7668]">{p.invoices?.invoice_number || '—'}</td>
                      <td className="px-3 py-2.5">{p.invoices?.customer_name || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmt(p.amount)}</td>
                      <td className="px-3 py-2.5 capitalize text-slate-600 dark:text-slate-300">{p.payment_method?.replace('_', ' ')}</td>
                      <td className="px-3 py-2.5 capitalize text-slate-500">{p.payment_type}</td>
                      <td className="px-3 py-2.5 text-slate-500">{fmtDt(p.payment_date)}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${vs.cls}`}>{vs.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
