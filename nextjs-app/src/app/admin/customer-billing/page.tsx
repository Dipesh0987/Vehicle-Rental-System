'use client';

import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCustomerBillingHistory } from '@/services/billing.service';
import { supabase } from '@/lib/supabase';
import Invoice from '@/components/Invoice';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

export default function CustomerBilling() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, email, phone, avatar_url').order('full_name');
      
      // Fetch bookings with paid amounts
      const { data: bookings } = await supabase
        .from('bookings')
        .select('customer_name, customer_email, customer_phone, user_id, paid_amount, total_amount')
        .not('customer_name', 'is', null);
      
      const customerMap = new Map<string, any>();
      
      const normalizePhone = (p: string) => p?.replace(/[\s\-\+]/g, '').toLowerCase() || '';
      
      (profiles || []).forEach((p: any) => {
        const phoneKey = normalizePhone(p.phone);
        const emailKey = p.email?.toLowerCase();
        const key = phoneKey || emailKey || p.id;
        customerMap.set(key, {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          avatar_url: p.avatar_url,
          source: 'profile',
          phoneKey: phoneKey,
          totalPaid: 0,
          totalAmount: 0,
          bookingCount: 0
        });
      });
      
      (bookings || []).forEach((b: any) => {
        const phoneKey = normalizePhone(b.customer_phone);
        const emailKey = b.customer_email?.toLowerCase();
        
        let key = phoneKey;
        if (!key && emailKey) key = emailKey;
        if (!key) key = `name-${b.customer_name?.toLowerCase().replace(/\s+/g, '')}`;
        
        if (customerMap.has(key)) {
          const existing = customerMap.get(key);
          if (!existing.phone && b.customer_phone) existing.phone = b.customer_phone;
          if (!existing.email && b.customer_email) existing.email = b.customer_email;
          existing.totalPaid = (existing.totalPaid || 0) + Number(b.paid_amount || 0);
          existing.totalAmount = (existing.totalAmount || 0) + Number(b.total_amount || 0);
          existing.bookingCount = (existing.bookingCount || 0) + 1;
        } else {
          customerMap.set(key, {
            id: b.user_id || `guest-${key}`,
            full_name: b.customer_name,
            email: b.customer_email,
            phone: b.customer_phone,
            avatar_url: null,
            source: 'booking',
            phoneKey: phoneKey,
            totalPaid: Number(b.paid_amount || 0),
            totalAmount: Number(b.total_amount || 0),
            bookingCount: 1
          });
        }
      });
      
      setCustomers(Array.from(customerMap.values()).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
      setLoading(false);
    })();
  }, []);

  const loadHistory = async (customer: any) => {
    setSelected(customer); setHistoryLoading(true);
    try {
      const normalizePhone = (p: string) => p?.replace(/[\s\-\+]/g, '').toLowerCase() || '';
      const phoneQuery = normalizePhone(customer.phone);
      
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id, booking_code, vehicle_id, start_date, end_date, pickup_time, 
          driver_option, base_amount, service_fee, tax_amount, discount_amount, 
          total_amount, paid_amount, remaining_amount, status, payment_status, 
          is_paid, coupon_code, customer_name, customer_email, customer_phone, 
          notes, created_at, 
          vehicles:vehicle_id(name, brand, category, vehicle_number)
        `)
        .order('created_at', { ascending: false });
      
      if (phoneQuery) {
        bookingsQuery = bookingsQuery.ilike('customer_phone', `%${customer.phone.replace(/[\s\-\+]/g, '')}%`);
      } else if (customer.email) {
        bookingsQuery = bookingsQuery.eq('customer_email', customer.email);
      } else {
        bookingsQuery = bookingsQuery.eq('customer_name', customer.full_name);
      }
      
      const { data: bookingsRaw } = await bookingsQuery;
      
      // Deduplicate bookings by ID
      const seenIds = new Set<string>();
      const bookings = (bookingsRaw || []).filter((b: any) => {
        if (seenIds.has(b.id)) return false;
        seenIds.add(b.id);
        return true;
      });
      
      const bookingIds = bookings.map((b: any) => b.id);
      let payments: any[] = [];
      if (bookingIds.length > 0) {
        const { data: payData } = await supabase
          .from('payments')
          .select('*')
          .in('booking_id', bookingIds)
          .order('created_at', { ascending: false });
        payments = payData || [];
      }
      
      const totalSpent = (payments || [])
        .filter((p: any) => p.status === 'completed' || p.status === 'verified')
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      
      const totalOutstanding = (bookings || [])
        .reduce((s: number, b: any) => s + Number(b.remaining_amount || 0), 0);
      
      const h = { 
        invoices: [],
        payments: payments, 
        bookings: bookings || [], 
        totalSpent, 
        totalOutstanding,
        bookingCount: (bookings || []).length
      };
      
      setHistory(h);
    } catch (e) { console.error('Load history error:', e); setHistory(null); }
    setHistoryLoading(false);
  };

  const openInvoice = (booking: any, customer: any) => {
    const days = booking.start_date && booking.end_date 
      ? Math.max(1, Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 86400000)) 
      : 1;
    const ratePerDay = days > 0 ? (booking.base_amount || booking.total_amount || 0) / days : 0;
    
    const invoicePayload = {
      invoiceNumber: `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      bookingRef: booking.booking_code || booking.id?.slice(0, 12),
      issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      customer: {
        name: customer.full_name || booking.customer_name || '',
        contact: customer.phone || booking.customer_phone || '',
        address: 'Kathmandu, Nepal',
        dob: '',
        license: ''
      },
      vehicle: {
        name: booking.vehicles?.name || 'Vehicle',
        plateNo: booking.vehicles?.vehicle_number || '',
        type: `${booking.vehicles?.category || 'Sedan'} | Automatic`,
        color: 'Blue',
        seat: '5 Seater'
      },
      booking: {
        pickup: `${booking.start_date} — ${booking.pickup_time || '10:00 AM'}`,
        dropoff: `${booking.end_date} — 6:00 PM`,
        location: booking.pickup_location || 'Kathmandu',
        purpose: 'Trip',
        driveType: booking.driver_option === 'with_driver' ? 'With Driver' : 'Self Drive',
        rentalType: 'Inside Valley'
      },
      lineItems: [
        { description: `${booking.vehicles?.name || 'Vehicle'} Rental`, qty: `${days} Days`, rate: ratePerDay }
      ],
      payment: {
        subtotal: booking.base_amount || booking.total_amount || 0,
        discount: booking.discount_amount || 0,
        grandTotal: booking.total_amount || 0,
        status: booking.is_paid ? 'Paid' : (booking.paid_amount > 0 ? 'Partial' : 'Unpaid'),
        method: booking.payment_method || 'Bank Transfer',
        paid: booking.paid_amount || 0,
        remarks: booking.is_paid ? 'Paid in full' : (booking.paid_amount > 0 ? `Partial paid. Remaining: NPR ${(booking.total_amount - booking.paid_amount).toLocaleString()}` : 'Payment pending')
      }
    };
    
    setInvoiceData(invoicePayload);
    setShowInvoice(true);
  };

  const filtered = customers.filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.full_name, c.email, c.phone].some((f: any) => String(f || '').toLowerCase().includes(q));
  });

  if (selected && history) {
    const mostRented = history.bookings.reduce((map: Record<string, number>, b: any) => {
      const name = b.vehicles?.name || 'Unknown';
      map[name] = (map[name] || 0) + 1; return map;
    }, {});
    const topVehicle = Object.entries(mostRented).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '—';
    const lastBooking = history.bookings[0]?.created_at;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setSelected(null); setHistory(null); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">{selected.full_name || selected.email}</h2>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <article className={`${panel} p-3`}><p className="text-[10px] font-bold uppercase text-slate-500">Total Bookings</p><p className="mt-1 text-lg font-extrabold">{history.bookings.length}</p></article>
          <article className={`${panel} p-3`}><p className="text-[10px] font-bold uppercase text-slate-500">Total Payments</p><p className="mt-1 text-lg font-extrabold text-emerald-600">{fmt(history.totalSpent)}</p></article>
          <article className={`${panel} p-3`}><p className="text-[10px] font-bold uppercase text-slate-500">Outstanding</p><p className="mt-1 text-lg font-extrabold text-amber-600">{fmt(history.totalOutstanding)}</p></article>
          <article className={`${panel} p-3`}><p className="text-[10px] font-bold uppercase text-slate-500">Most Rented</p><p className="mt-1 text-sm font-bold truncate">{topVehicle}</p></article>
          <article className={`${panel} p-3`}><p className="text-[10px] font-bold uppercase text-slate-500">Last Booking</p><p className="mt-1 text-sm font-bold">{fmtDate(lastBooking)}</p></article>
        </section>

        <section className={`${panel} p-4`}>
          <h3 className="text-sm font-extrabold">Invoices ({history.invoices.length})</h3>
          {history.invoices.length === 0 ? <p className="mt-2 text-sm text-slate-400">No invoices</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Due</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{history.invoices.map((inv: any) => (
                  <tr key={inv.id}><td className="px-3 py-2 font-semibold text-[#1f7668]">{inv.invoice_number}</td><td className="px-3 py-2 text-slate-500">{fmtDate(inv.invoice_date)}</td><td className="px-3 py-2 text-right">{fmt(inv.grand_total)}</td><td className="px-3 py-2 text-right text-emerald-600">{fmt(inv.amount_paid)}</td><td className="px-3 py-2 text-right text-amber-600">{fmt(inv.outstanding_balance)}</td><td className="px-3 py-2 capitalize">{inv.status}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${panel} p-4`}>
          <h3 className="text-sm font-extrabold">Payment Records ({history.payments.length})</h3>
          {history.payments.length === 0 ? <p className="mt-2 text-sm text-slate-400">No payments</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{history.payments.map((p: any) => (
                  <tr key={p.id}><td className="px-3 py-2 text-slate-500">{fmtDate(p.payment_date)}</td><td className="px-3 py-2 text-right font-semibold">{fmt(p.amount)}</td><td className="px-3 py-2 capitalize">{p.payment_method?.replace('_', ' ')}</td><td className="px-3 py-2 capitalize">{p.payment_type}</td><td className="px-3 py-2 capitalize">{p.verification_status}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${panel} p-4`}>
          <h3 className="text-sm font-extrabold">Rental History ({history.bookings.length})</h3>
          {history.bookings.length === 0 ? <p className="mt-2 text-sm text-slate-400">No bookings</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Paid</th><th className="px-3 py-2 text-center">Bill</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{history.bookings.map((b: any, idx: number) => (
                  <tr key={`${b.id}-${idx}`}><td className="px-3 py-2 font-semibold">{b.vehicles?.name || '—'}</td><td className="px-3 py-2 text-slate-500">{fmtDate(b.start_date)}</td><td className="px-3 py-2 text-slate-500">{fmtDate(b.end_date)}</td><td className="px-3 py-2 text-right">{fmt(b.total_amount)}</td><td className="px-3 py-2 capitalize">{b.status}</td><td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.is_paid || b.payment_status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{b.is_paid || b.payment_status === 'completed' ? 'Paid' : 'Unpaid'}</span></td><td className="px-3 py-2 text-center"><button onClick={() => openInvoice(b, selected)} className="inline-flex items-center gap-1 rounded-lg bg-[#1f7668] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#185f54]" title="View Invoice"><span className="material-symbols-outlined text-[14px]">receipt_long</span>Bill</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        {showInvoice && invoiceData && (
          <div className="fixed inset-0 z-[9999] overflow-auto bg-gray-100">
            <div className="min-h-screen">
              <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center">
                <h2 className="text-lg font-bold">Invoice Preview</h2>
                <button 
                  onClick={() => setShowInvoice(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Close
                </button>
              </div>
              <Invoice booking={invoiceData} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Billing</p>
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Customer Billing History</h2>
      </header>

      <section className={`${panel} p-4`}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className={`${inputCls} max-w-sm`} />
        {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading…</div> : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No customers found</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c: any, idx: number) => (
              <button key={`${c.id}-${idx}`} onClick={() => loadHistory(c)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#1f7668] hover:bg-[#1f7668]/5 dark:border-white/10 dark:hover:border-[#1f7668]">
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(140deg,#1f7668,#1b5f8b)] text-sm font-bold text-white">{(c.full_name || c.email || 'C').slice(0, 2).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{c.full_name || 'Customer'}</p>
                  <p className="truncate text-xs text-slate-500">{c.email || c.phone}</p>
                  {c.totalPaid > 0 && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Paid: {fmt(c.totalPaid)}</span>
                      {c.totalAmount - c.totalPaid > 0 && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Due: {fmt(c.totalAmount - c.totalPaid)}</span>
                      )}
                    </div>
                  )}
                  {c.bookingCount > 0 && (
                    <span className="text-[10px] text-slate-400">{c.bookingCount} booking{c.bookingCount > 1 ? 's' : ''}</span>
                  )}
                </div>
                <span className="material-symbols-outlined text-[16px] text-slate-400">chevron_right</span>
              </button>
            ))}
          </div>
        )}
        {historyLoading && <div className="py-4 text-center text-sm text-slate-400">Loading history…</div>}
      </section>
    </div>
  );
}
