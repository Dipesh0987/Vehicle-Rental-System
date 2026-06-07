import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const fmtNpr = (v) => `NPR ${Number(v || 0).toLocaleString()}`;
const toISO = (d) => d.toISOString().slice(0, 10);

// Helper to get first and last day of current month
const getCurrentMonthDates = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { firstDay: toISO(firstDay), lastDay: toISO(lastDay) };
};

// CSV Export helper
const exportToCSV = (data, filename) => {
  const headers = Object.keys(data[0] || {}).join(',');
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

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('revenue');
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toISO(d); });
  const [toDate, setToDate] = useState(() => toISO(new Date()));
  const [dateRange, setDateRange] = useState('this_month'); // 'this_month', 'last_30', 'all_time', 'custom'
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleRevenue, setVehicleRevenue] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: b }, { data: v }] = await Promise.all([
        supabase.from('payments').select('amount, status, created_at, booking_id'),
        supabase.from('vehicle_bookings').select('id, vehicle_id, total_amount, status, created_at, vehicles(id, name, brand, model, category)'),
        supabase.from('vehicles').select('id, name, brand, model, category, status, pricePerDay'),
      ]);
      setPayments(p || []);
      setBookings(b || []);
      setVehicles(v || []);
      
      // Calculate vehicle revenue
      const revenueMap = {};
      (b || []).forEach(booking => {
        const vid = booking.vehicle_id;
        const vInfo = booking.vehicles || {};
        if (!revenueMap[vid]) {
          revenueMap[vid] = {
            vehicle_id: vid,
            name: vInfo.name || 'Unknown',
            brand: vInfo.brand || '',
            model: vInfo.model || '',
            category: vInfo.category || 'Other',
            total_revenue: 0,
            booking_count: 0,
            paid_amount: 0
          };
        }
        revenueMap[vid].total_revenue += Number(booking.total_amount || 0);
        revenueMap[vid].booking_count += 1;
      });
      
      // Add paid amounts from payments
      (p || []).forEach(payment => {
        const booking = (b || []).find(bk => bk.id === payment.booking_id);
        if (booking && payment.status === 'completed') {
          const vid = booking.vehicle_id;
          if (revenueMap[vid]) {
            revenueMap[vid].paid_amount += Number(payment.amount || 0);
          }
        }
      });
      
      setVehicleRevenue(Object.values(revenueMap).sort((a, b) => b.total_revenue - a.total_revenue));
      setLoading(false);
    })();
  }, []);

  const completed = useMemo(() => payments.filter((p) => p.status === 'completed'), [payments]);
  const totalRevenue = useMemo(() => completed.reduce((s, p) => s + Number(p.amount || 0), 0), [completed]);

  // Revenue chart data — daily for the selected range
  const revenueChart = useMemo(() => {
    const labels = []; const data = [];
    const start = new Date(fromDate); const end = new Date(toDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISO(d);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const dayTotal = completed.filter((p) => (p.created_at || '').slice(0, 10) === iso).reduce((s, p) => s + Number(p.amount || 0), 0);
      data.push(dayTotal);
    }
    return { labels, data };
  }, [completed, fromDate, toDate]);


  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Business Intelligence</p>
          <h2 className={heading}>Advanced Reporting &amp; Analytics</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={dateRange} 
            onChange={(e) => {
              const val = e.target.value;
              setDateRange(val);
              if (val === 'this_month') {
                const { firstDay, lastDay } = getCurrentMonthDates();
                setFromDate(firstDay);
                setToDate(lastDay);
              } else if (val === 'last_30') {
                const d = new Date(); d.setDate(d.getDate() - 30);
                setFromDate(toISO(d));
                setToDate(toISO(new Date()));
              } else if (val === 'all_time') {
                setFromDate('2024-01-01');
                setToDate(toISO(new Date()));
              }
              // 'custom' keeps current dates
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <option value="this_month">This Month</option>
            <option value="last_30">Last 30 Days</option>
            <option value="all_time">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5 dark:text-slate-200" />
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5 dark:text-slate-200" />
          <button 
            onClick={() => exportToCSV(vehicleRevenue.map(v => ({
              Vehicle: `${v.brand} ${v.model}`,
              Category: v.category,
              'Total Revenue': v.total_revenue,
              'Booking Count': v.booking_count,
              'Paid Amount': v.paid_amount,
              'Pending Amount': v.total_revenue - v.paid_amount
            })), `vehicle-revenue-${new Date().toISOString().slice(0,10)}.csv`)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[16px] align-middle mr-1">download</span>
            Export CSV
          </button>
        </div>
      </header>

      {loading ? <div className="py-8 text-center text-sm text-slate-400">Loading reports…</div> : (
        <>
          {/* Tab switcher */}
          <section className={`${panel} p-3`}>
            <div className="flex flex-wrap gap-2">
              {[{ key: 'revenue', label: 'Revenue' }, { key: 'vehicles', label: 'Vehicle Revenue' }].map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-[#1f7668] text-white' : 'border border-slate-200 dark:border-white/10'}`}>{t.label}</button>
              ))}
            </div>
          </section>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className={`${panel} xl:col-span-7 p-4 sm:p-5`}>
              <h3 className="mb-3 text-base font-extrabold">Revenue Analysis</h3>
              <div className="h-[290px]">
                <Line data={{
                  labels: revenueChart.labels,
                  datasets: [{
                    label: 'Revenue (NPR)', data: revenueChart.data,
                    borderColor: '#1f7668', backgroundColor: 'rgba(31,118,104,0.1)',
                    fill: true, tension: 0.3, pointRadius: 2,
                  }]
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } } }} />
              </div>
            </section>
          </div>

          {/* Vehicle Revenue Table */}
          {tab === 'vehicles' && (
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-extrabold">Vehicle Revenue Report</h3>
                  <p className="text-xs text-slate-500 mt-1">Ranked by total revenue (High to Low)</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setFromDate('2024-01-01'); setToDate(toISO(new Date())); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-white/10">All Time</button>
                  <button onClick={() => { const d = new Date(); d.setMonth(d.getMonth()-1); setFromDate(toISO(d)); setToDate(toISO(new Date())); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-white/10">Last 30 Days</button>
                  <button onClick={() => { const d = new Date(); d.setDate(1); setFromDate(toISO(d)); setToDate(toISO(new Date())); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-white/10">This Month</button>
                  <button 
                    onClick={() => exportToCSV(vehicleRevenue.map(v => ({
                      Rank: vehicleRevenue.indexOf(v) + 1,
                      Vehicle: `${v.brand} ${v.model}`,
                      Category: v.category,
                      'Total Revenue': v.total_revenue,
                      'Booking Count': v.booking_count,
                      'Paid Amount': v.paid_amount,
                      'Pending Amount': v.total_revenue - v.paid_amount
                    })), `vehicle-revenue-${new Date().toISOString().slice(0,10)}.csv`)}
                    className="rounded-xl bg-[#1f7668] px-3 py-2 text-xs font-semibold text-white hover:bg-[#185f54]"
                  >
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">download</span>
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Vehicle</th>
                      <th className="pb-2 pr-3">Category</th>
                      <th className="pb-2 pr-3 text-right">Total Revenue</th>
                      <th className="pb-2 pr-3 text-center">Bookings</th>
                      <th className="pb-2 pr-3 text-right">Paid</th>
                      <th className="pb-2 pr-3 text-right">Pending</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleRevenue.map((v, i) => (
                      <tr key={v.vehicle_id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="py-3 pr-3 font-bold text-[#1f7668]">{i + 1}</td>
                        <td className="py-3 pr-3 font-semibold">{v.brand} {v.model}</td>
                        <td className="py-3 pr-3 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-white/10">{v.category}</span></td>
                        <td className="py-3 pr-3 text-right font-bold text-emerald-600">{fmtNpr(v.total_revenue)}</td>
                        <td className="py-3 pr-3 text-center">{v.booking_count}</td>
                        <td className="py-3 pr-3 text-right text-emerald-600">{fmtNpr(v.paid_amount)}</td>
                        <td className="py-3 pr-3 text-right text-amber-600">{fmtNpr(v.total_revenue - v.paid_amount)}</td>
                        <td className="py-3 text-right">
                          {v.paid_amount >= v.total_revenue ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Fully Paid</span>
                          ) : v.paid_amount > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Partial</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Unpaid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
