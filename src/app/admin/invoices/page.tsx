'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInvoices, getInvoiceById, getInvoiceItems, createInvoice, updateInvoice, deleteInvoice, updateInvoiceStatus } from '@/services/billing.service';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const btnPrimary = 'rounded-xl bg-[#1f7668] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110';
const btnSecondary = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10';
const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

const statusMeta: Record<string, { label: string, cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  partially_paid: { label: 'Partial', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
};

export default function Invoices() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [selected, setSelected] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const pageSize = 20;

  useEffect(() => {
    if (searchParams.get('action') === 'create') setView('create');
  }, [searchParams]);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const { data, count } = await getInvoices({ status: statusFilter, search, limit: pageSize, offset: page * pageSize });
      setInvoices(data); setTotal(count);
    } catch (err) { console.error('Invoice fetch error:', err); setInvoices([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, [statusFilter, search, page]);

  const loadDetail = async (id: string) => {
    const inv = await getInvoiceById(id);
    const its = await getInvoiceItems(id);
    setSelected(inv); setItems(its); setView('detail');
  };

  const [customerBookings, setCustomerBookings] = useState<any[]>([]);

  const openCreate = async () => {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('vehicles').select('id, name, vehicle_number, price_per_day'),
      supabase.from('user_profiles').select('id, full_name, email, phone'),
    ]);
    setVehicles((v || []).map((x: any) => ({ ...x, daily_rate: x.price_per_day }))); setCustomers(c || []);
    setCustomerBookings([]);
    setForm({ invoice_date: new Date().toISOString().split('T')[0], due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], tax_rate: 13, status: 'draft', rental_duration: 1, daily_rate: 0, rental_charges: 0, additional_charges: 0, discount_amount: 0 });
    setView('create');
  };

  const openEdit = async () => {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('vehicles').select('id, name, vehicle_number, price_per_day'),
      supabase.from('user_profiles').select('id, full_name, email, phone'),
    ]);
    setVehicles((v || []).map((x: any) => ({ ...x, daily_rate: x.price_per_day }))); setCustomers(c || []);
    setForm({ ...selected });
    setView('edit');
  };

  const onCustomerSelect = async (customerId: string) => {
    const c = customers.find((x: any) => x.id === customerId);
    const updates: any = { customer_id: customerId, customer_name: c?.full_name || '', customer_email: c?.email || '', customer_phone: c?.phone || '' };
    const { data: bookings } = await supabase.from('bookings').select('*, vehicles(id, name, vehicle_number, price_per_day)').eq('user_id', customerId).or('status.eq.confirmed,status.eq.active,status.eq.completed').order('created_at', { ascending: false });
    setCustomerBookings(bookings || []);
    if (bookings && bookings.length > 0) {
      const bk = bookings[0];
      const veh = bk.vehicles;
      updates.vehicle_id = bk.vehicle_id;
      updates.vehicle_name = veh?.name || '';
      updates.vehicle_reg_no = veh?.vehicle_number || '';
      updates.daily_rate = veh?.price_per_day || 0;
      updates.booking_id = bk.id;
      updates.pickup_date = bk.start_date;
      updates.return_date = bk.end_date;
      const days = bk.start_date && bk.end_date ? Math.max(1, Math.ceil((new Date(bk.end_date).getTime() - new Date(bk.start_date).getTime()) / 86400000)) : 1;
      updates.rental_duration = days;
    }
    const nf = { ...form, ...updates };
    setForm({ ...nf, ...calcTotals(nf) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (view === 'create') {
        const inv = await createInvoice(form);
        await loadDetail(inv.id);
      } else {
        await updateInvoice(selected.id, form);
        await loadDetail(selected.id);
      }
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this invoice permanently?')) return;
    await deleteInvoice(selected.id);
    setView('list'); fetch_();
  };

  const handleStatusChange = async (s: string) => {
    await updateInvoiceStatus(selected.id, s);
    await loadDetail(selected.id);
  };

  const calcTotals = (f: any) => {
    const rental = Number(f.rental_duration || 0) * Number(f.daily_rate || 0);
    const sub = rental + Number(f.additional_charges || 0) - Number(f.discount_amount || 0);
    const tax = sub * (Number(f.tax_rate || 13) / 100);
    return { rental_charges: rental, subtotal: sub, tax_amount: tax, grand_total: sub + tax, outstanding_balance: sub + tax - Number(f.amount_paid || 0) };
  };

  const updateForm = (k: string, v: any) => {
    const nf = { ...form, [k]: v };
    const t = calcTotals(nf);
    setForm({ ...nf, ...t });
  };

  const selectCustomer = (cid: string) => {
    onCustomerSelect(cid);
  };

  const selectVehicle = (vid: string) => {
    const v = vehicles.find((x: any) => x.id === vid);
    if (v) {
      const nf = { ...form, vehicle_id: v.id, vehicle_name: v.name || '', vehicle_reg_no: v.vehicle_number || '', daily_rate: v.daily_rate || v.price_per_day || 0 };
      setForm({ ...nf, ...calcTotals(nf) });
    }
  };

  const selectBooking = (bookingId: string) => {
    const bk = customerBookings.find((x: any) => x.id === bookingId);
    if (bk) {
      const veh = bk.vehicles;
      const days = bk.start_date && bk.end_date ? Math.max(1, Math.ceil((new Date(bk.end_date).getTime() - new Date(bk.start_date).getTime()) / 86400000)) : 1;
      const nf = { ...form, booking_id: bk.id, vehicle_id: bk.vehicle_id, vehicle_name: veh?.name || '', vehicle_reg_no: veh?.vehicle_number || '', daily_rate: veh?.price_per_day || 0, pickup_date: bk.start_date, return_date: bk.end_date, rental_duration: days };
      setForm({ ...nf, ...calcTotals(nf) });
    }
  };

  const downloadPDF = () => {
    const inv = selected;
    if (!inv) return;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.setTextColor(31, 118, 104);
    doc.text('INVOICE', 14, 22);
    doc.setFontSize(10); doc.setTextColor(60, 60, 60);
    doc.text(inv.invoice_number, 14, 30);
    doc.text('Self Drive Car Rental', 140, 16, { align: 'left' });
    doc.text('Kathmandu, Nepal', 140, 22, { align: 'left' });
    doc.text('info@selfdrivecarrental.com', 140, 28, { align: 'left' });
    doc.setDrawColor(200); doc.line(14, 36, 196, 36);
    doc.setFontSize(9);
    doc.text(`Bill To: ${inv.customer_name}`, 14, 44);
    doc.text(`Email: ${inv.customer_email || '—'}`, 14, 50);
    doc.text(`Phone: ${inv.customer_phone || '—'}`, 14, 56);
    doc.text(`Invoice Date: ${fmtDate(inv.invoice_date)}`, 140, 44);
    doc.text(`Due Date: ${fmtDate(inv.due_date)}`, 140, 50);
    doc.text(`Pickup: ${fmtDate(inv.pickup_date)}  Return: ${fmtDate(inv.return_date)}`, 140, 56);
    const rows = [[`Vehicle Rental — ${inv.vehicle_name} (${inv.rental_duration} days)`, `${fmt(inv.daily_rate)}/day`, fmt(inv.rental_charges)]];
    if (Number(inv.additional_charges) > 0) rows.push(['Additional Charges', '', fmt(inv.additional_charges)]);
    items.filter((it: any) => it.item_type !== 'rental').forEach((it: any) => rows.push([it.description, fmt(it.unit_price), fmt(it.amount)]));
    autoTable(doc, { startY: 64, head: [['Description', 'Rate', 'Amount']], body: rows, styles: { fontSize: 9 }, headStyles: { fillColor: [31, 118, 104] }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: ${fmt(inv.subtotal)}`, 140, y);
    if (Number(inv.discount_amount) > 0) doc.text(`Discount: -${fmt(inv.discount_amount)}`, 140, y + 6);
    doc.text(`Tax (${inv.tax_rate}%): ${fmt(inv.tax_amount)}`, 140, y + 12);
    doc.setFontSize(12); doc.setTextColor(31, 118, 104);
    doc.text(`Grand Total: ${fmt(inv.grand_total)}`, 140, y + 22);
    doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text(`Amount Paid: ${fmt(inv.amount_paid)}`, 140, y + 30);
    doc.text(`Outstanding: ${fmt(inv.outstanding_balance)}`, 140, y + 36);
    if (inv.notes) { doc.text('Notes:', 14, y + 46); doc.setFontSize(8); doc.text(inv.notes, 14, y + 52, { maxWidth: 120 }); }
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text('This is a computer generated invoice.', 14, 280);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 285);
    doc.save(`${inv.invoice_number}.pdf`);
  };

  const printInvoice = () => { window.print(); };

  if (view === 'create' || view === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView(selected ? 'detail' : 'list'); }} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">{view === 'create' ? 'Create Invoice' : 'Edit Invoice'}</h2>
        </div>
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer *</label><select value={form.customer_id || ''} onChange={(e) => selectCustomer(e.target.value)} className={inputCls}><option value="">Select customer</option>{customers.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></div>
            {customerBookings.length > 0 && <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">From Booking</label><select value={form.booking_id || ''} onChange={(e) => selectBooking(e.target.value)} className={inputCls}><option value="">Select a booking</option>{customerBookings.map((bk: any) => <option key={bk.id} value={bk.id}>{bk.booking_code || bk.id.slice(0,8)} — {bk.vehicles?.name} ({bk.start_date} to {bk.end_date})</option>)}</select></div>}
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle</label><select value={form.vehicle_id || ''} onChange={(e) => selectVehicle(e.target.value)} className={inputCls}><option value="">Select vehicle</option>{vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.vehicle_number})</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label><select value={form.status || 'draft'} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}><option value="draft">Draft</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Invoice Date</label><input type="date" value={form.invoice_date || ''} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Due Date</label><input type="date" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pickup Date</label><input type="date" value={form.pickup_date || ''} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Return Date</label><input type="date" value={form.return_date || ''} onChange={(e) => setForm({ ...form, return_date: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rental Duration (days)</label><input type="number" min="1" value={form.rental_duration || ''} onChange={(e) => updateForm('rental_duration', e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Daily Rate (Rs.)</label><input type="number" min="0" value={form.daily_rate || ''} onChange={(e) => updateForm('daily_rate', e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Additional Charges</label><input type="number" min="0" value={form.additional_charges || ''} onChange={(e) => updateForm('additional_charges', e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Discount Amount</label><input type="number" min="0" value={form.discount_amount || ''} onChange={(e) => updateForm('discount_amount', e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tax Rate (%)</label><input type="number" min="0" value={form.tax_rate || ''} onChange={(e) => updateForm('tax_rate', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><span className="text-xs text-slate-500">Rental</span><p className="font-bold">{fmt(form.rental_charges)}</p></div>
              <div><span className="text-xs text-slate-500">Tax</span><p className="font-bold">{fmt(form.tax_amount)}</p></div>
              <div><span className="text-xs text-slate-500">Grand Total</span><p className="font-extrabold text-[#1f7668]">{fmt(form.grand_total)}</p></div>
              <div><span className="text-xs text-slate-500">Outstanding</span><p className="font-bold text-amber-600">{fmt(form.outstanding_balance)}</p></div>
            </div>
          </div>
          <div className="mt-4"><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</label><textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={inputCls} /></div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : view === 'create' ? 'Create Invoice' : 'Save Changes'}</button>
            <button onClick={() => setView(selected ? 'detail' : 'list')} className={btnSecondary}>Cancel</button>
          </div>
        </section>
      </div>
    );
  }

  if (view === 'detail' && selected) {
    const sm = statusMeta[selected.status] || statusMeta.draft;
    return (
      <div className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button onClick={() => { setView('list'); setSelected(null); }} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <div className="flex gap-2">
            <button onClick={openEdit} className={btnSecondary}>Edit</button>
            <button onClick={downloadPDF} className={btnPrimary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">picture_as_pdf</span>Download PDF</button>
            <button onClick={printInvoice} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">print</span> Print</button>
            <button onClick={handleDelete} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-400">Delete</button>
          </div>
        </div>

        <section className={`${panel} p-6 print:border-0 print:shadow-none`}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-2xl font-extrabold text-[#1f7668]">INVOICE</h2>
              <p className="mt-1 text-lg font-bold">{selected.invoice_number}</p>
              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sm.cls}`}>{sm.label}</span>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-slate-900 dark:text-slate-100">Self Drive Car Rental</p>
              <p className="text-slate-500">Kathmandu, Nepal</p>
              <p className="text-slate-500">info@selfdrivecarrental.com</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill To</p>
              <p className="mt-1 text-sm font-bold">{selected.customer_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{selected.customer_email}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{selected.customer_phone}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p><span className="text-slate-500">Invoice Date:</span> <span className="font-semibold">{fmtDate(selected.invoice_date)}</span></p>
              <p><span className="text-slate-500">Due Date:</span> <span className="font-semibold">{fmtDate(selected.due_date)}</span></p>
              <p><span className="text-slate-500">Pickup:</span> <span className="font-semibold">{fmtDate(selected.pickup_date)}</span></p>
              <p><span className="text-slate-500">Return:</span> <span className="font-semibold">{fmtDate(selected.return_date)}</span></p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <span>Description</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-3 py-2.5 text-sm">
                <span>Vehicle Rental — {selected.vehicle_name} ({selected.rental_duration} days)</span>
                <span className="text-right">{fmt(selected.daily_rate)}/day</span>
                <span className="text-right font-semibold">{fmt(selected.rental_charges)}</span>
              </div>
              {Number(selected.additional_charges) > 0 && (
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-3 py-2.5 text-sm">
                  <span>Additional Charges</span><span></span><span className="text-right font-semibold">{fmt(selected.additional_charges)}</span>
                </div>
              )}
              {items.filter((it: any) => it.item_type !== 'rental').map((it: any) => (
                <div key={it.id} className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-3 py-2.5 text-sm">
                  <span>{it.description}</span><span className="text-right">{fmt(it.unit_price)}</span><span className="text-right font-semibold">{fmt(it.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{fmt(selected.subtotal)}</span></div>
              {Number(selected.discount_amount) > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-semibold text-rose-600">-{fmt(selected.discount_amount)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Tax ({selected.tax_rate}%)</span><span className="font-semibold">{fmt(selected.tax_amount)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 dark:border-white/10"><span className="font-bold">Grand Total</span><span className="text-lg font-extrabold text-[#1f7668]">{fmt(selected.grand_total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount Paid</span><span className="font-semibold text-emerald-600">{fmt(selected.amount_paid)}</span></div>
              <div className="flex justify-between"><span className="font-bold text-amber-600">Outstanding</span><span className="font-extrabold text-amber-600">{fmt(selected.outstanding_balance)}</span></div>
            </div>
          </div>

          {selected.notes && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5"><p className="text-xs font-bold uppercase text-slate-500">Notes</p><p className="mt-1 text-slate-700 dark:text-slate-300">{selected.notes}</p></div>}

          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {selected.status !== 'paid' && <button onClick={() => handleStatusChange('paid')} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300">Mark Paid</button>}
            {selected.status !== 'cancelled' && <button onClick={() => handleStatusChange('cancelled')} className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300">Cancel Invoice</button>}
            {selected.status === 'draft' && <button onClick={() => handleStatusChange('pending')} className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-300">Send Invoice</button>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Billing</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Invoice Management</h2>
        </div>
        <button onClick={openCreate} className={btnPrimary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">add</span>Create Invoice</button>
      </header>

      <section className={`${panel} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search invoices…" className={`${inputCls} max-w-xs`} />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className={`${inputCls} max-w-[160px]`}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="ml-auto text-xs font-semibold text-slate-500">{total} invoices</span>
        </div>

        {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading…</div> : invoices.length === 0 ? (
          <div className="py-8 text-center"><span className="material-symbols-outlined text-[48px] text-slate-300">description</span><p className="mt-2 text-sm text-slate-500">No invoices found</p></div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
                <th className="px-3 py-2">Invoice #</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {invoices.map((inv: any) => {
                  const sm = statusMeta[inv.status] || statusMeta.draft;
                  return (
                    <tr key={inv.id} onClick={() => loadDetail(inv.id)} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-3 py-2.5 font-semibold text-[#1f7668]">{inv.invoice_number}</td>
                      <td className="px-3 py-2.5">{inv.customer_name}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{inv.vehicle_name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmt(inv.grand_total)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-600">{fmt(inv.outstanding_balance)}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${sm.cls}`}>{sm.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="mt-3 flex items-center justify-between">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className={btnSecondary}>Previous</button>
            <span className="text-xs text-slate-500">Page {page + 1} of {Math.ceil(total / pageSize)}</span>
            <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(page + 1)} className={btnSecondary}>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
