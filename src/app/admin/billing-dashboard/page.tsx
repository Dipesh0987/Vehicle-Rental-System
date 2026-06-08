'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { getFinancialDashboard, getRevenueChartData } from '@/services/billing.service';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function BillingDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([getFinancialDashboard(), getRevenueChartData(12)]);
        setStats(s);
        setChartData(c);
      } catch (err) { console.error(err); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading financial data…</div>;

  const summaryCards = [
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue), icon: 'today', color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Monthly Revenue', value: fmt(stats?.monthlyRevenue), icon: 'calendar_month', color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Yearly Revenue', value: fmt(stats?.yearlyRevenue), icon: 'trending_up', color: 'text-violet-600 dark:text-violet-400' },
    { label: 'Total Expenses', value: fmt(stats?.totalExpenses), icon: 'receipt_long', color: 'text-rose-600 dark:text-rose-400' },
    { label: 'Net Profit', value: fmt(stats?.netProfit), icon: 'savings', color: stats?.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
    { label: 'Outstanding', value: fmt(stats?.totalOutstanding), icon: 'warning', color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Total Invoices', value: stats?.totalInvoices, icon: 'description', color: 'text-slate-700 dark:text-slate-200' },
    { label: 'Paid Invoices', value: stats?.paidInvoices, icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Unpaid Invoices', value: stats?.unpaidInvoices, icon: 'pending', color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Pending Verifications', value: stats?.pendingVerifications, icon: 'hourglass_top', color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Total QR Payments', value: fmt(stats?.totalQR), icon: 'qr_code_2', color: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Cash Payments', value: fmt(stats?.totalCash), icon: 'payments', color: 'text-teal-600 dark:text-teal-400' },
  ];

  const revenueChart = {
    labels: chartData.map((d: any) => d.label),
    datasets: [
      { label: 'Income', data: chartData.map((d: any) => d.income), backgroundColor: 'rgba(31,118,104,0.7)', borderRadius: 6 },
      { label: 'Expense', data: chartData.map((d: any) => d.expense), backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 6 },
    ],
  };

  const profitChart = {
    labels: chartData.map((d: any) => d.label),
    datasets: [{
      label: 'Net Profit',
      data: chartData.map((d: any) => d.profit),
      borderColor: '#1f7668',
      backgroundColor: 'rgba(31,118,104,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#1f7668',
    }],
  };

  const paymentDistribution = {
    labels: ['QR Payments', 'Cash Payments'],
    datasets: [{
      data: [stats?.totalQR || 0, stats?.totalCash || 0],
      backgroundColor: ['#6366f1', '#14b8a6'],
      borderWidth: 0,
    }],
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Billing System</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Financial Dashboard</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => router.push('/admin/invoices')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Invoices</button>
          <button onClick={() => router.push('/admin/expenses')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Expenses</button>
          <button onClick={() => router.push('/admin/profitability')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Profitability</button>
          <button onClick={() => router.push('/admin/reports')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Reports</button>
          <button onClick={() => router.push('/admin/audit-logs')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">Audit Logs</button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {summaryCards.map((c, i) => (
          <article key={i} className={`${panel} p-3`}>
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[20px] ${c.color}`}>{c.icon}</span>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{c.label}</p>
            </div>
            <p className={`mt-2 text-lg font-extrabold ${c.color}`}>{c.value}</p>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={`${panel} p-4`}>
          <h3 className="text-sm font-extrabold">Revenue vs Expenses (Monthly)</h3>
          <div className="mt-3 h-[280px]">
            <Bar data={revenueChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} />
          </div>
        </section>
        <section className={`${panel} p-4`}>
          <h3 className="text-sm font-extrabold">Profit Trend</h3>
          <div className="mt-3 h-[280px]">
            <Line data={profitChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className={`${panel} p-4`}>
          <h3 className="text-sm font-extrabold">Payment Distribution</h3>
          <div className="mt-3 flex items-center justify-center" style={{ height: 220 }}>
            <Doughnut data={paymentDistribution} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </section>
        <section className={`${panel} p-4 xl:col-span-2`}>
          <h3 className="text-sm font-extrabold">Quick Actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button onClick={() => router.push('/admin/invoices?action=create')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold transition hover:border-[#1f7668] hover:bg-[#1f7668]/5 dark:border-white/10 dark:hover:border-[#1f7668]">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">add_circle</span>Create Invoice
            </button>
            <button onClick={() => router.push('/admin/expenses?action=add')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold transition hover:border-[#1f7668] hover:bg-[#1f7668]/5 dark:border-white/10 dark:hover:border-[#1f7668]">
              <span className="material-symbols-outlined text-[20px] text-rose-600">add_card</span>Add Expense
            </button>
            <button onClick={() => router.push('/admin/reports')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold transition hover:border-[#1f7668] hover:bg-[#1f7668]/5 dark:border-white/10 dark:hover:border-[#1f7668]">
              <span className="material-symbols-outlined text-[20px] text-violet-600">analytics</span>View Reports
            </button>
            <button onClick={() => router.push('/admin/profitability')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold transition hover:border-[#1f7668] hover:bg-[#1f7668]/5 dark:border-white/10 dark:hover:border-[#1f7668]">
              <span className="material-symbols-outlined text-[20px] text-amber-600">monitoring</span>Profitability
            </button>
            <button onClick={() => router.push('/admin/audit-logs')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold transition hover:border-[#1f7668] hover:bg-[#1f7668]/5 dark:border-white/10 dark:hover:border-[#1f7668]">
              <span className="material-symbols-outlined text-[20px] text-slate-600">history</span>Audit Logs
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
