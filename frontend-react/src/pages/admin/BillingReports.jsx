import { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getRevenueReport, getExpenseReport, getInvoices, getExpenses, getVehicleFinances } from '../../services/billing.service';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const btnPrimary = 'rounded-xl bg-[#1f7668] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110';
const btnSecondary = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10';
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

const reportTypes = [
  { id: 'revenue', label: 'Revenue Report', icon: 'trending_up', desc: 'All invoice revenue by date range' },
  { id: 'expense', label: 'Expense Report', icon: 'receipt_long', desc: 'All expenses by category and date' },
  { id: 'profit_loss', label: 'Profit & Loss', icon: 'analytics', desc: 'Income vs expenses summary' },
  { id: 'vehicle', label: 'Vehicle Performance', icon: 'directions_car', desc: 'Per-vehicle revenue and profit' },
  { id: 'outstanding', label: 'Outstanding Payments', icon: 'warning', desc: 'Unpaid and overdue invoices' },
];

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function BillingReports() {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;
  const [reportType, setReportType] = useState('');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [summary, setSummary] = useState({});

  const generate = async () => {
    setLoading(true); setGenerated(false);
    try {
      let result = [];
      let sum = {};
      if (reportType === 'revenue') {
        result = await getRevenueReport({ from, to });
        const totalRevenue = result.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
        const totalGrand = result.reduce((s, r) => s + Number(r.grand_total || 0), 0);
        sum = { totalRevenue, totalGrand, count: result.length };
      } else if (reportType === 'expense') {
        const { data: d } = await getExpenses({ from, to, limit: 500 });
        result = d;
        sum = { total: result.reduce((s, r) => s + Number(r.amount || 0), 0), count: result.length };
      } else if (reportType === 'profit_loss') {
        const rev = await getRevenueReport({ from, to });
        const { data: exp } = await getExpenses({ from, to, limit: 500 });
        const income = rev.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
        const expense = (exp || []).reduce((s, r) => s + Number(r.amount || 0), 0);
        sum = { income, expense, profit: income - expense, invoiceCount: rev.length, expenseCount: (exp || []).length };
        result = [{ type: 'Summary', income: fmt(income), expense: fmt(expense), profit: fmt(income - expense) }];
      } else if (reportType === 'vehicle') {
        result = await getVehicleFinances();
        sum = { count: result.length, totalProfit: result.reduce((s, r) => s + Number(r.net_profit || 0), 0) };
      } else if (reportType === 'outstanding') {
        const { data: d } = await getInvoices({ status: 'pending', limit: 200 });
        const { data: d2 } = await getInvoices({ status: 'partially_paid', limit: 200 });
        result = [...(d || []), ...(d2 || [])];
        sum = { total: result.reduce((s, r) => s + Number(r.outstanding_balance || 0), 0), count: result.length };
      }
      setData(result); setSummary(sum); setGenerated(true);
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  const getExportRows = () => {
    if (reportType === 'revenue') return data.map((r) => ({ Invoice: r.invoice_number, Customer: r.customer_name, Date: r.invoice_date, Total: r.grand_total, Paid: r.amount_paid, Outstanding: r.outstanding_balance, Status: r.status }));
    if (reportType === 'expense') return data.map((r) => ({ ID: r.expense_id, Category: r.category, Amount: r.amount, Date: r.expense_date, Vehicle: r.vehicles?.name || '', Description: r.description }));
    if (reportType === 'vehicle') return data.map((r) => ({ Vehicle: r.vehicles?.name, Income: r.total_income, Expenses: r.total_expenses, Profit: r.net_profit, Trips: r.total_trips, 'Utilization %': r.utilization_pct }));
    if (reportType === 'outstanding') return data.map((r) => ({ Invoice: r.invoice_number, Customer: r.customer_name, Total: r.grand_total, Paid: r.amount_paid, Outstanding: r.outstanding_balance, Date: r.invoice_date }));
    return data;
  };

  const exportCSV = () => {
    if (!data.length) return;
    downloadCSV(getExportRows(), `${reportType}_report_${from}_${to}.csv`);
  };

  const exportExcel = () => {
    if (!data.length) return;
    const rows = getExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportType}_report_${from}_${to}.xlsx`);
  };

  const exportPDF = () => {
    if (!data.length) return;
    const rows = getExportRows();
    const headers = Object.keys(rows[0]);
    const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' });
    doc.setFontSize(16);
    doc.text(`${reportTypes.find((r) => r.id === reportType)?.label || 'Report'}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${from} to ${to}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 118, 104] },
    });
    doc.save(`${reportType}_report_${from}_${to}.pdf`);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Billing</p>
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Financial Reports</h2>
      </header>

      {/* Report Type Selector */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {reportTypes.map((rt) => (
          <button key={rt.id} onClick={() => { setReportType(rt.id); setGenerated(false); }}
            className={`${panel} p-3 text-left transition ${reportType === rt.id ? 'ring-2 ring-[#1f7668]' : 'hover:border-[#1f7668]/30'}`}>
            <span className="material-symbols-outlined text-[24px] text-[#1f7668]">{rt.icon}</span>
            <p className="mt-2 text-sm font-bold">{rt.label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rt.desc}</p>
          </button>
        ))}
      </section>

      {reportType && (
        <section className={`${panel} p-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></div>
            <button onClick={generate} disabled={loading} className={btnPrimary}>{loading ? 'Generating…' : 'Generate Report'}</button>
            {generated && <button onClick={exportCSV} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">download</span>CSV</button>}
            {generated && <button onClick={exportExcel} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">table_view</span>Excel</button>}
            {generated && <button onClick={exportPDF} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">picture_as_pdf</span>PDF</button>}
            {generated && <button onClick={() => window.print()} className={btnSecondary}><span className="material-symbols-outlined text-[16px] align-middle mr-1">print</span>Print</button>}
          </div>
        </section>
      )}

      {/* Report Results */}
      {generated && (
        <section className={`${panel} p-4`}>
          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {reportType === 'revenue' && <>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Invoices</p><p className="mt-1 text-lg font-extrabold">{summary.count}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Total Billed</p><p className="mt-1 text-lg font-extrabold">{fmt(summary.totalGrand)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Total Collected</p><p className="mt-1 text-lg font-extrabold text-emerald-600">{fmt(summary.totalRevenue)}</p></div>
            </>}
            {reportType === 'expense' && <>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Expenses</p><p className="mt-1 text-lg font-extrabold">{summary.count}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Total Amount</p><p className="mt-1 text-lg font-extrabold text-rose-600">{fmt(summary.total)}</p></div>
            </>}
            {reportType === 'profit_loss' && <>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Income</p><p className="mt-1 text-lg font-extrabold text-emerald-600">{fmt(summary.income)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Expenses</p><p className="mt-1 text-lg font-extrabold text-rose-600">{fmt(summary.expense)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Net Profit</p><p className={`mt-1 text-lg font-extrabold ${summary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(summary.profit)}</p></div>
            </>}
            {reportType === 'outstanding' && <>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Invoices</p><p className="mt-1 text-lg font-extrabold">{summary.count}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold uppercase text-slate-500">Total Outstanding</p><p className="mt-1 text-lg font-extrabold text-amber-600">{fmt(summary.total)}</p></div>
            </>}
          </div>

          {/* Table */}
          {reportType === 'revenue' && data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{data.map((r) => (
                  <tr key={r.id}><td className="px-3 py-2 font-semibold text-[#1f7668]">{r.invoice_number}</td><td className="px-3 py-2">{r.customer_name}</td><td className="px-3 py-2 text-slate-500">{fmtDate(r.invoice_date)}</td><td className="px-3 py-2 text-right font-semibold">{fmt(r.grand_total)}</td><td className="px-3 py-2 text-right font-semibold text-emerald-600">{fmt(r.amount_paid)}</td><td className="px-3 py-2 capitalize">{r.status}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {reportType === 'expense' && data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">ID</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{data.map((r) => (
                  <tr key={r.id}><td className="px-3 py-2 font-mono text-xs">{r.expense_id}</td><td className="px-3 py-2 capitalize">{r.category}</td><td className="px-3 py-2">{r.vehicles?.name || '—'}</td><td className="px-3 py-2 text-slate-500">{fmtDate(r.expense_date)}</td><td className="px-3 py-2 text-right font-semibold text-rose-600">{fmt(r.amount)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {reportType === 'vehicle' && data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2 text-right">Income</th><th className="px-3 py-2 text-right">Expenses</th><th className="px-3 py-2 text-right">Profit</th><th className="px-3 py-2 text-right">Trips</th><th className="px-3 py-2 text-right">Util %</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{data.map((r) => (
                  <tr key={r.id}><td className="px-3 py-2 font-semibold">{r.vehicles?.name}</td><td className="px-3 py-2 text-right text-emerald-600">{fmt(r.total_income)}</td><td className="px-3 py-2 text-right text-rose-600">{fmt(r.total_expenses)}</td><td className="px-3 py-2 text-right font-bold">{fmt(r.net_profit)}</td><td className="px-3 py-2 text-right">{r.total_trips}</td><td className="px-3 py-2 text-right">{Number(r.utilization_pct || 0).toFixed(1)}%</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {reportType === 'outstanding' && data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500 dark:border-white/10"><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{data.map((r) => (
                  <tr key={r.id}><td className="px-3 py-2 font-semibold text-[#1f7668]">{r.invoice_number}</td><td className="px-3 py-2">{r.customer_name}</td><td className="px-3 py-2 text-right">{fmt(r.grand_total)}</td><td className="px-3 py-2 text-right text-emerald-600">{fmt(r.amount_paid)}</td><td className="px-3 py-2 text-right font-bold text-amber-600">{fmt(r.outstanding_balance)}</td><td className="px-3 py-2 capitalize">{r.status}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No data for the selected period.</p>}
        </section>
      )}
    </div>
  );
}
