'use client';

import { useState, useEffect, useRef } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense, uploadExpenseReceipt } from '@/services/billing.service';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const btnPrimary = 'rounded-xl bg-[#1f7668] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110';
const btnSecondary = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10';
const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

// Note: exportToCSV uses a local toast variable that will be passed in
const exportToCSV = (data: any[], filename: string, toastFn?: any) => {
  if (!data || data.length === 0) {
    toastFn?.warning('No data to export');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map((row: any) => Object.values(row).map((v: any) => `"${v}"`).join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const categories = [
  { value: 'fuel', label: 'Fuel', icon: 'local_gas_station', color: 'text-orange-600' },
  { value: 'maintenance', label: 'Maintenance', icon: 'build', color: 'text-blue-600' },
  { value: 'repair', label: 'Repair', icon: 'handyman', color: 'text-red-600' },
  { value: 'insurance', label: 'Insurance', icon: 'shield', color: 'text-violet-600' },
  { value: 'staff', label: 'Staff', icon: 'badge', color: 'text-teal-600' },
  { value: 'tax', label: 'Tax', icon: 'receipt', color: 'text-amber-600' },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: 'more_horiz', color: 'text-slate-600' },
];

export default function Expenses() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [form, setForm] = useState<any>({});
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [detailExpense, setDetailExpense] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>('');

  const handleExpenseReceiptSelect = (file: File | null) => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(file && file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
  };

  const fetch_ = async () => {
    setLoading(true);
    try {
      const { data: expensesData, count } = await getExpenses({ category: categoryFilter === 'all' ? null : categoryFilter, search });
      
      const allExpenses = (expensesData || [])
        .sort((a: any, b: any) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
      
      setExpenses(allExpenses);
      setTotal(allExpenses.length);
    } catch (err) { 
      console.error('Expenses fetch error:', err); 
      setExpenses([]); 
      setTotal(0); 
    }
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, [categoryFilter, search]);

  // Real-time subscription for auto-refresh
  useEffect(() => {
    const channel = supabase
      .channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetch_();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        fetch_();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const openForm = async (expense: any = null) => {
    const { data: v } = await supabase.from('vehicles').select('id, name, vehicle_number');
    setVehicles(v || []);
    if (expense) {
      setForm({ ...expense, maintenance_status: expense.status || 'scheduled' });
      setSelected(expense);
    } else {
      setForm({ category: 'fuel', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], vehicle_id: '', vendor_name: '', reference_number: '', maintenance_status: 'scheduled' });
      setSelected(null);
    }
    setReceiptFile(null);
    setView('form');
  };

  const openDetail = (expense: any) => {
    setDetailExpense(expense);
    setView('detail');
  };

  const handleSave = async () => {
    if (!form.category || !form.amount) { toast.warning('Category and amount are required'); return; }
    // Validate: scheduled maintenance/repair date cannot be in past
    if ((form.category === 'maintenance' || form.category === 'repair') && form.maintenance_status === 'scheduled' && form.expense_date) {
      const today = new Date().toISOString().split('T')[0];
      if (form.expense_date < today) { toast.warning('Scheduled date cannot be in the past'); return; }
    }
    setSaving(true);
    try {
      let receiptUrl = form.receipt_url || null;
      if (receiptFile) {
        receiptUrl = await uploadExpenseReceipt(receiptFile);
      }
      const payload: any = {
        category: form.category,
        amount: Number(form.amount),
        description: form.description || null,
        expense_date: form.expense_date,
        vehicle_id: form.vehicle_id || null,
        vendor_name: form.vendor_name || null,
        reference_number: form.reference_number || null,
        receipt_url: receiptUrl,
      };
      // Add maintenance_status for maintenance/repair categories
      const isMaintRepair = form.category === 'maintenance' || form.category === 'repair';
      if (isMaintRepair) {
        payload.status = form.maintenance_status || 'scheduled';
      }

      const saveExpense = async () => {
        try {
          if (selected) {
            await updateExpense(selected.id, payload);
          } else {
            const { data: session } = await supabase.auth.getSession();
            payload.added_by = session?.session?.user?.id;
            await createExpense(payload);
          }
        } catch (err: any) {
          // If status column doesn't exist, retry without it
          if (err.message?.includes('status')) {
            delete payload.status;
            if (selected) {
              await updateExpense(selected.id, payload);
            } else {
              const { data: session } = await supabase.auth.getSession();
              payload.added_by = session?.session?.user?.id;
              await createExpense(payload);
            }
          } else {
            throw err;
          }
        }
      };

      await saveExpense();
      toast.success(selected ? 'Expense updated successfully!' : 'Expense created successfully!');

      // Handle vehicle availability based on status change
      if (isMaintRepair && form.vehicle_id) {
        if (form.maintenance_status === 'completed') {
          await supabase.from('vehicles').update({ status: 'available' }).eq('id', form.vehicle_id);
          toast.info('Vehicle marked as available (maintenance completed).');
        } else {
          await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', form.vehicle_id);
          if (!selected) toast.info('Vehicle marked as under maintenance (unavailable to customers).');
        }
      }

      setView('list'); fetch_();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id);
    toast.success('Expense deleted!');
    fetch_();
  };

  const totalAmount = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const categorySummary = categories.map((c) => ({
    ...c,
    total: expenses.filter((e: any) => e.category === c.value).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
    count: expenses.filter((e: any) => e.category === c.value).length,
  }));

  if (view === 'detail' && detailExpense) {
    const ex = detailExpense;
    const cat = categories.find((c) => c.value === ex.category);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">Expense Details</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className={`${panel} p-4 sm:p-5 lg:col-span-2`}>
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-500">Expense Information</h3>
            
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Expense ID</p>
                <p className="font-mono text-sm font-semibold">{ex.expense_id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="flex items-center gap-1 font-semibold">
                  <span className={`material-symbols-outlined text-[16px] ${cat?.color}`}>{cat?.icon}</span>
                  <span className="capitalize">{ex.category}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount</p>
                <p className="text-lg font-bold text-rose-600">{fmt(ex.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="font-semibold">{fmtDate(ex.expense_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                {(ex.category === 'maintenance' || ex.category === 'repair') ? (
                  <select
                    value={ex.status || 'scheduled'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        await updateExpense(ex.id, { status: newStatus });
                      } catch (err: any) {
                        if (!err.message?.includes('status')) throw err;
                      }
                      if (ex.vehicle_id) {
                        if (newStatus === 'completed') {
                          await supabase.from('vehicles').update({ status: 'available' }).eq('id', ex.vehicle_id);
                          toast.success('Completed — vehicle now available');
                        } else {
                          await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', ex.vehicle_id);
                          toast.success('Status updated — vehicle under maintenance');
                        }
                      } else {
                        toast.success('Status updated');
                      }
                      setDetailExpense({ ...ex, status: newStatus });
                      fetch_();
                    }}
                    className={`mt-1 rounded-full px-2.5 py-1 text-xs font-semibold border-0 outline-none cursor-pointer ${
                      (ex.status || 'scheduled') === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      (ex.status || 'scheduled') === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                ) : (
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    {ex.status || 'Approved'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Reference #</p>
                <p className="font-semibold">{ex.reference_number || '—'}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-500">Description</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{ex.description || 'No description provided'}</p>
            </div>

            {ex.receipt_url && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Receipt</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                  {ex.receipt_url.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex items-center gap-3 p-3">
                      <span className="material-symbols-outlined text-4xl text-red-500">picture_as_pdf</span>
                      <div>
                        <p className="text-sm font-semibold">PDF Receipt</p>
                        <a 
                          href={ex.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-xs text-[#1f7668] hover:underline"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          Open PDF
                        </a>
                      </div>
                    </div>
                  ) : (
                    <a href={ex.receipt_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img 
                        src={ex.receipt_url} 
                        alt="Receipt" 
                        className="max-h-64 w-auto rounded-lg object-contain mx-auto cursor-pointer hover:opacity-90 transition"
                      />
                      <p className="text-center text-xs text-slate-400 mt-1">Click to view full size</p>
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Vehicle</h4>
              {ex.vehicles ? (
                <div>
                  <p className="font-bold">{ex.vehicles.name}</p>
                  <p className="text-xs text-slate-500">{ex.vehicles.vehicle_number}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">General Expense (No Vehicle)</p>
              )}
            </section>

            <section className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Vendor</h4>
              <p className="font-semibold">{ex.vendor_name || '—'}</p>
            </section>

            <section className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</h4>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => openForm(ex)} 
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit Expense
                </button>
                <button 
                  onClick={() => handleDelete(ex.id)} 
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  if (view === 'form') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">{selected ? 'Edit Expense' : 'Add Expense'}</h2>
        </div>
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Category *</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount (Rs.) *</label><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label><input type="date" value={form.expense_date || ''} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vehicle</label><select value={form.vehicle_id || ''} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className={inputCls}><option value="">None / General</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vehicle_number})</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vendor Name</label><input value={form.vendor_name || ''} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Reference #</label><input value={form.reference_number || ''} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} className={inputCls} /></div>
            {(form.category === 'maintenance' || form.category === 'repair') && (
              <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label><select value={form.maintenance_status || 'scheduled'} onChange={(e) => setForm({ ...form, maintenance_status: e.target.value })} className={inputCls}><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></div>
            )}
            <div className="sm:col-span-2 lg:col-span-3"><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Description</label><textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} /></div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Receipt</label>
              <div className="mt-1 flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className={btnSecondary}>Upload Receipt</button>
                <span className="text-xs text-slate-500">{receiptFile?.name || (form.receipt_url ? 'Existing receipt' : 'No file')}</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleExpenseReceiptSelect(e.target.files?.[0] || null)} />
              {/* Preview: newly selected image, or existing receipt image */}
              {receiptPreview ? (
                <img src={receiptPreview} alt="Receipt preview" className="mt-2 max-h-56 w-auto rounded-lg border border-slate-200 object-contain dark:border-white/10" />
              ) : receiptFile && !receiptFile.type.startsWith('image/') ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>{receiptFile.name}</p>
              ) : form.receipt_url && !receiptFile ? (
                form.receipt_url.toLowerCase().endsWith('.pdf') ? (
                  <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-[#1f7668] underline">View current PDF receipt</a>
                ) : (
                  <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={form.receipt_url} alt="Current receipt" className="mt-2 max-h-56 w-auto rounded-lg border border-slate-200 object-contain dark:border-white/10" />
                    <span className="mt-1 inline-block text-xs text-slate-400">Current receipt — click to enlarge</span>
                  </a>
                )
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : selected ? 'Update Expense' : 'Add Expense'}</button>
            <button onClick={() => setView('list')} className={btnSecondary}>Cancel</button>
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
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Expense Management</h2>
        </div>
        <button onClick={() => openForm()} className={btnPrimary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">add</span>Add Expense</button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {categorySummary.map((c) => (
          <button key={c.value} onClick={() => setCategoryFilter(c.value === categoryFilter ? 'all' : c.value)} className={`${panel} p-3 text-left transition ${categoryFilter === c.value ? 'ring-2 ring-[#1f7668]' : ''}`}>
            <span className={`material-symbols-outlined text-[20px] ${c.color}`}>{c.icon}</span>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
            <p className="mt-1 text-sm font-extrabold">{fmt(c.total)}</p>
            <p className="text-[10px] text-slate-400">{c.count} entries</p>
          </button>
        ))}
      </section>

      <section className={`${panel} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses…" className={`${inputCls} max-w-xs`} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputCls} max-w-[160px]`}><option value="all">All Categories</option>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <button 
            onClick={() => {
              const csvData = expenses.map((ex: any) => ({
                'Expense ID': ex.expense_id,
                'Category': ex.category,
                'Vehicle': ex.vehicles?.name || 'General',
                'Vehicle Number': ex.vehicles?.vehicle_number || '—',
                'Description': ex.description || '—',
                'Date': fmtDate(ex.expense_date),
                'Amount': ex.amount,
                'Vendor': ex.vendor_name || '—',
                'Reference': ex.reference_number || '—',
                'Status': ex.status || 'approved',
              }));
              const totalAmt = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
              csvData.push({
                'Expense ID': '',
                'Category': '',
                'Vehicle': '',
                'Vehicle Number': '',
                'Description': 'TOTAL',
                'Date': '',
                'Amount': totalAmt,
                'Vendor': '',
                'Reference': '',
                'Status': ''
              });
              exportToCSV(csvData, `expenses-${new Date().toISOString().slice(0,10)}.csv`);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-white/10"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            Export CSV
          </button>
          <span className="ml-auto text-sm font-semibold text-slate-500">Total: <span className="text-rose-600 font-bold text-lg">{fmt(totalAmount)}</span> ({total} records)</span>
        </div>

        {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading…</div> : expenses.length === 0 ? (
          <div className="py-8 text-center"><span className="material-symbols-outlined text-[48px] text-slate-300">receipt_long</span><p className="mt-2 text-sm text-slate-500">No expenses found</p></div>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
                  <th className="px-3 py-2">ID</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {expenses.map((ex: any) => {
                    const cat = categories.find((c) => c.value === ex.category);
                    const isMaintRepair = ex.category === 'maintenance' || ex.category === 'repair';
                    const expStatus = ex.status || 'approved';
                    return (
                      <tr 
                        key={ex.id} 
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                        onClick={() => openDetail(ex)}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                          {ex.expense_id}
                        </td>
                        <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1"><span className={`material-symbols-outlined text-[16px] ${cat?.color || ''}`}>{cat?.icon || 'receipt'}</span><span className="capitalize">{ex.category}</span></span></td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{ex.vehicles?.name || '—'}</td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate text-slate-600 dark:text-slate-300" title={ex.description}>{ex.description || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{fmtDate(ex.expense_date)}</td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {isMaintRepair ? (
                            <select
                              value={expStatus}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                try {
                                  await updateExpense(ex.id, { status: newStatus });
                                } catch (err: any) {
                                  if (!err.message?.includes('status')) { toast.error(err.message); return; }
                                }
                                if (ex.vehicle_id) {
                                  if (newStatus === 'completed') {
                                    await supabase.from('vehicles').update({ status: 'available' }).eq('id', ex.vehicle_id);
                                    toast.success('Status: Completed — vehicle is now available');
                                  } else {
                                    await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', ex.vehicle_id);
                                    toast.success('Status updated — vehicle under maintenance');
                                  }
                                } else {
                                  toast.success('Status updated');
                                }
                                fetch_();
                              }}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border-0 outline-none cursor-pointer ${
                                expStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                expStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                expStatus === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          ) : (
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                              {expStatus === 'approved' ? 'Approved' : expStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-rose-600">{fmt(ex.amount)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openForm(ex)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" title="Edit"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                            {ex.receipt_url && <a href={ex.receipt_url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" title="Receipt"><span className="material-symbols-outlined text-[16px]">receipt</span></a>}
                            <button onClick={() => handleDelete(ex.id)} className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">Category-wise Breakdown</h3>
              {categories.filter(c => expenses.some((e: any) => e.category === c.value)).map(cat => {
                const catExpenses = expenses.filter((e: any) => e.category === cat.value);
                const catTotal = catExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
                return (
                  <section key={cat.value} className={`${panel} p-4`}>
                    <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined ${cat.color}`}>{cat.icon}</span>
                        <h4 className="font-bold capitalize">{cat.label}</h4>
                        <span className="text-xs text-slate-400">({catExpenses.length} entries)</span>
                      </div>
                      <p className="font-bold text-rose-600">{fmt(catTotal)}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                          {catExpenses.map((ex: any) => (
                            <tr key={ex.id} className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => openDetail(ex)}>
                              <td className="py-2 px-2 font-mono text-xs text-slate-400">{ex.expense_id}</td>
                              <td className="py-2 px-2">{ex.vehicles?.name || 'General'}</td>
                              <td className="py-2 px-2 max-w-[200px] truncate" title={ex.description}>{ex.description || '—'}</td>
                              <td className="py-2 px-2 text-slate-400 text-xs">{fmtDate(ex.expense_date)}</td>
                              <td className="py-2 px-2 text-right font-semibold">{fmt(ex.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
