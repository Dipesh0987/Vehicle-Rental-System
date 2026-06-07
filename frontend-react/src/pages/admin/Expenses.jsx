import { useState, useEffect, useRef } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense, uploadExpenseReceipt } from '../../services/billing.service';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const btnPrimary = 'rounded-xl bg-[#1f7668] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110';
const btnSecondary = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10';
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

// CSV Export helper
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','));
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
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState('list'); // 'list', 'form', 'detail'
  const [form, setForm] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailExpense, setDetailExpense] = useState(null);
  const fileRef = useRef(null);
  const [receiptFile, setReceiptFile] = useState(null);

  const fetch_ = async () => {
    setLoading(true);
    try {
      // Fetch expenses from expenses table
      const { data: expensesData, count } = await getExpenses({ category: categoryFilter === 'all' ? null : categoryFilter, search });
      
      // Fetch maintenance records that should appear as expenses
      // (completed maintenance with cost_estimate > 0 and not billed to customer)
      let maintenanceQuery = supabase
        .from('maintenance_records')
        .select('*, vehicles(name, vehicle_number)')
        .eq('status', 'Completed')
        .gt('cost_estimate', 0);
      
      // Filter by search if provided
      if (search) {
        maintenanceQuery = maintenanceQuery.or(`description.ilike.%${search}%,service_type.ilike.%${search}%`);
      }
      
      const { data: maintenanceData } = await maintenanceQuery.order('completed_at', { ascending: false });
      
      // Convert maintenance records to expense format
      const maintenanceAsExpenses = (maintenanceData || [])
        .filter(m => m.service_type !== 'damage' || !m.customer_name) // Exclude damage billed to customer
        .map(m => ({
          id: `maint-${m.id}`, // Prefix to distinguish from regular expenses
          expense_id: `MAINT-${m.id.slice(0, 8).toUpperCase()}`,
          category: 'maintenance',
          amount: m.cost_estimate,
          description: `Maintenance: ${m.service_type} - ${m.description || 'No description'}`,
          expense_date: m.completed_at || m.scheduled_date,
          vehicle_id: m.vehicle_id,
          vehicles: m.vehicles,
          vendor_name: m.provider_name || m.technician || 'Maintenance Provider',
          reference_number: m.maintenance_id || '',
          status: 'approved',
          is_maintenance: true, // Flag to identify maintenance records
          maintenance_data: m, // Full maintenance data for reference
        }));
      
      // Filter maintenance by category if filter is set
      let filteredMaintenance = maintenanceAsExpenses;
      if (categoryFilter && categoryFilter !== 'all') {
        filteredMaintenance = maintenanceAsExpenses.filter(m => m.category === categoryFilter);
      }
      
      // Merge and sort by date
      const allExpenses = [...(expensesData || []), ...filteredMaintenance]
        .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
      
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

  const openForm = async (expense = null) => {
    const { data: v } = await supabase.from('vehicles').select('id, name, vehicle_number');
    setVehicles(v || []);
    if (expense) {
      setForm({ ...expense });
      setSelected(expense);
    } else {
      setForm({ category: 'fuel', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], vehicle_id: '', vendor_name: '', reference_number: '' });
      setSelected(null);
    }
    setReceiptFile(null);
    setView('form');
  };

  const openDetail = (expense) => {
    setDetailExpense(expense);
    setView('detail');
  };

  const handleSave = async () => {
    if (!form.category || !form.amount) { alert('Category and amount are required'); return; }
    setSaving(true);
    try {
      let receiptUrl = form.receipt_url || null;
      if (receiptFile) {
        receiptUrl = await uploadExpenseReceipt(receiptFile);
      }
      const payload = {
        category: form.category,
        amount: Number(form.amount),
        description: form.description || null,
        expense_date: form.expense_date,
        vehicle_id: form.vehicle_id || null,
        vendor_name: form.vendor_name || null,
        reference_number: form.reference_number || null,
        receipt_url: receiptUrl,
      };
      if (selected) {
        await updateExpense(selected.id, payload);
      } else {
        const { data: session } = await supabase.auth.getSession();
        payload.added_by = session?.session?.user?.id;
        await createExpense(payload);
      }
      setView('list'); fetch_();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    // Prevent deleting maintenance records from expenses page
    if (typeof id === 'string' && id.startsWith('maint-')) {
      alert('This expense is linked to a maintenance record. Please delete it from the Maintenance page instead.');
      return;
    }
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id);
    fetch_();
  };

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const categorySummary = categories.map((c) => ({
    ...c,
    total: expenses.filter((e) => e.category === c.value).reduce((s, e) => s + Number(e.amount || 0), 0),
    count: expenses.filter((e) => e.category === c.value).length,
  }));

  /* ─── DETAIL VIEW ─── */
  if (view === 'detail' && detailExpense) {
    const ex = detailExpense;
    const cat = categories.find((c) => c.value === ex.category);
    const isMaintenance = ex.is_maintenance;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle">west</span> Back</button>
          <h2 className="text-lg font-extrabold">Expense Details</h2>
          {isMaintenance && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <span className="material-symbols-outlined text-[14px] mr-1">build</span>
              From Maintenance
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main Info */}
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
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {ex.status || 'Approved'}
                </span>
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

            {/* Receipt Image */}
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

            {ex.maintenance_data && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">Maintenance Details</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Service Type:</span> <strong>{ex.maintenance_data.service_type}</strong></div>
                  <div><span className="text-slate-500">Scheduled Date:</span> <strong>{fmtDate(ex.maintenance_data.scheduled_date)}</strong></div>
                  <div><span className="text-slate-500">Technician:</span> <strong>{ex.maintenance_data.technician || '—'}</strong></div>
                  <div><span className="text-slate-500">Provider:</span> <strong>{ex.maintenance_data.provider_name || '—'}</strong></div>
                </div>
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Vehicle Info */}
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

            {/* Vendor Info */}
            <section className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Vendor</h4>
              <p className="font-semibold">{ex.vendor_name || '—'}</p>
            </section>

            {/* Receipt */}
            {ex.receipt_url && (
              <section className={`${panel} p-4 sm:p-5`}>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Receipt</h4>
                <div className="space-y-2">
                  <a 
                    href={ex.receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1f7668] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#185f54]"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    View Receipt
                  </a>
                  <p className="text-xs text-slate-400">
                    {ex.receipt_url.endsWith('.pdf') ? 'PDF Document' : 'Image File'}
                  </p>
                </div>
              </section>
            )}

            {/* Actions */}
            <section className={`${panel} p-4 sm:p-5`}>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</h4>
              <div className="flex flex-col gap-2">
                {!isMaintenance && (
                  <button 
                    onClick={() => openForm(ex)} 
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit Expense
                  </button>
                )}
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

  /* ─── FORM VIEW ─── */
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
            <div className="sm:col-span-2 lg:col-span-3"><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Description</label><textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} /></div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Receipt</label>
              <div className="mt-1 flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className={btnSecondary}>Upload Receipt</button>
                <span className="text-xs text-slate-500">{receiptFile?.name || (form.receipt_url ? 'Existing receipt' : 'No file')}</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
              {form.receipt_url && !receiptFile && <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-[#1f7668] underline">View current receipt</a>}
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

  /* ─── LIST VIEW ─── */
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Billing</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Expense Management</h2>
        </div>
        <button onClick={() => openForm()} className={btnPrimary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">add</span>Add Expense</button>
      </header>

      {/* Category Summary */}
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
              const csvData = expenses.map(ex => ({
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
                'Source': ex.is_maintenance ? 'Maintenance' : 'Manual Entry'
              }));
              // Add total row
              const totalAmount = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
              csvData.push({
                'Expense ID': '',
                'Category': '',
                'Vehicle': '',
                'Vehicle Number': '',
                'Description': 'TOTAL',
                'Date': '',
                'Amount': totalAmount,
                'Vendor': '',
                'Reference': '',
                'Status': '',
                'Source': ''
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
            {/* Summary Table */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
                  <th className="px-3 py-2">ID</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {expenses.map((ex) => {
                    const cat = categories.find((c) => c.value === ex.category);
                    const isMaintenance = ex.is_maintenance;
                    return (
                      <tr 
                        key={ex.id} 
                        className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5 ${isMaintenance ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                        onClick={() => openDetail(ex)}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            {ex.expense_id}
                            {isMaintenance && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" title="From Maintenance">
                                <span className="material-symbols-outlined text-[10px]">build</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1"><span className={`material-symbols-outlined text-[16px] ${cat?.color || ''}`}>{cat?.icon || 'receipt'}</span><span className="capitalize">{ex.category}</span></span></td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{ex.vehicles?.name || '—'}</td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate text-slate-600 dark:text-slate-300" title={ex.description}>{ex.description || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{fmtDate(ex.expense_date)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-rose-600">{fmt(ex.amount)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {!isMaintenance && (
                              <button onClick={() => openForm(ex)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" title="Edit"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                            )}
                            {ex.receipt_url && <a href={ex.receipt_url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" title="Receipt"><span className="material-symbols-outlined text-[16px]">receipt</span></a>}
                            <button onClick={() => handleDelete(ex.id)} className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title={isMaintenance ? 'Delete from Maintenance page' : 'Delete'}><span className="material-symbols-outlined text-[16px]">delete</span></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Category-wise Breakdown */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">Category-wise Breakdown</h3>
              {categories.filter(c => expenses.some(e => e.category === c.value)).map(cat => {
                const catExpenses = expenses.filter(e => e.category === cat.value);
                const catTotal = catExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
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
                          {catExpenses.map(ex => (
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
