import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getVehicleFinances, recalcAllVehicleFinances } from '../../services/billing.service';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

export default function Profitability() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [sortBy, setSortBy] = useState('net_profit');

  const fetch_ = async () => {
    setLoading(true);
    try {
      const d = await getVehicleFinances();
      setData(d);
    } catch (err) { console.error('Profitability fetch error:', err); setData([]); }
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const handleRecalc = async () => {
    setRecalculating(true);
    try { await recalcAllVehicleFinances(); await fetch_(); } catch (e) { alert(e.message); }
    setRecalculating(false);
  };

  const sorted = [...data].sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
  const topProfit = sorted[0];
  const leastProfit = [...data].sort((a, b) => Number(a.net_profit || 0) - Number(b.net_profit || 0))[0];
  const highestRevenue = [...data].sort((a, b) => Number(b.total_income || 0) - Number(a.total_income || 0))[0];
  const highestExpense = [...data].sort((a, b) => Number(b.total_expenses || 0) - Number(a.total_expenses || 0))[0];
  const mostUtilized = [...data].sort((a, b) => Number(b.utilization_pct || 0) - Number(a.utilization_pct || 0))[0];

  const chartData = {
    labels: sorted.slice(0, 10).map((v) => v.vehicles?.name || 'Vehicle'),
    datasets: [
      { label: 'Income', data: sorted.slice(0, 10).map((v) => Number(v.total_income || 0)), backgroundColor: 'rgba(31,118,104,0.7)', borderRadius: 4 },
      { label: 'Expenses', data: sorted.slice(0, 10).map((v) => Number(v.total_expenses || 0)), backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 4 },
      { label: 'Profit', data: sorted.slice(0, 10).map((v) => Number(v.net_profit || 0)), backgroundColor: 'rgba(99,102,241,0.6)', borderRadius: 4 },
    ],
  };

  const analytics = [
    { label: 'Most Profitable', vehicle: topProfit?.vehicles?.name, value: fmt(topProfit?.net_profit), icon: 'trending_up', color: 'text-emerald-600' },
    { label: 'Least Profitable', vehicle: leastProfit?.vehicles?.name, value: fmt(leastProfit?.net_profit), icon: 'trending_down', color: 'text-rose-600' },
    { label: 'Highest Revenue', vehicle: highestRevenue?.vehicles?.name, value: fmt(highestRevenue?.total_income), icon: 'payments', color: 'text-blue-600' },
    { label: 'Highest Expense', vehicle: highestExpense?.vehicles?.name, value: fmt(highestExpense?.total_expenses), icon: 'receipt_long', color: 'text-amber-600' },
    { label: 'Most Utilized', vehicle: mostUtilized?.vehicles?.name, value: `${Number(mostUtilized?.utilization_pct || 0).toFixed(1)}%`, icon: 'speed', color: 'text-violet-600' },
  ];

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading profitability data…</div>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Analytics</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Vehicle Profitability</h2>
        </div>
        <button onClick={handleRecalc} disabled={recalculating} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">{recalculating ? 'sync' : 'refresh'}</span>{recalculating ? 'Calculating…' : 'Recalculate All'}
        </button>
      </header>

      {/* Analytics Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {analytics.map((a, i) => (
          <article key={i} className={`${panel} p-3`}>
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[20px] ${a.color}`}>{a.icon}</span>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{a.label}</p>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{a.vehicle || '—'}</p>
            <p className={`mt-1 text-lg font-extrabold ${a.color}`}>{a.value}</p>
          </article>
        ))}
      </section>

      {/* Chart */}
      <section className={`${panel} p-4`}>
        <h3 className="text-sm font-extrabold">Vehicle Performance (Top 10)</h3>
        <div className="mt-3 h-[300px]">
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} />
        </div>
      </section>

      {/* Table */}
      <section className={`${panel} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold">All Vehicles</h3>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
            <option value="net_profit">Sort by Profit</option>
            <option value="total_income">Sort by Income</option>
            <option value="total_expenses">Sort by Expenses</option>
            <option value="utilization_pct">Sort by Utilization</option>
            <option value="total_trips">Sort by Trips</option>
          </select>
        </div>
        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No data. Click "Recalculate All" to generate.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
                <th className="px-3 py-2">Vehicle</th><th className="px-3 py-2 text-right">Income</th><th className="px-3 py-2 text-right">Expenses</th><th className="px-3 py-2 text-right">Net Profit</th><th className="px-3 py-2 text-right">Trips</th><th className="px-3 py-2 text-right">Utilization</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {sorted.map((v) => (
                  <tr key={v.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {v.vehicles?.image_url && <img src={v.vehicles.image_url} alt="" className="h-8 w-12 rounded-lg object-cover" />}
                        <div><p className="font-semibold">{v.vehicles?.name || '—'}</p><p className="text-xs text-slate-500">{v.vehicles?.vehicle_number}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{fmt(v.total_income)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-rose-600">{fmt(v.total_expenses)}</td>
                    <td className={`px-3 py-2.5 text-right font-extrabold ${Number(v.net_profit) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(v.net_profit)}</td>
                    <td className="px-3 py-2.5 text-right">{v.total_trips}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-16 rounded-full bg-slate-200 dark:bg-white/10">
                          <div className="h-2 rounded-full bg-[#1f7668]" style={{ width: `${Math.min(100, Number(v.utilization_pct || 0))}%` }}></div>
                        </div>
                        <span className="text-xs font-semibold">{Number(v.utilization_pct || 0).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
