import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../lib/supabase';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';

export default function Overview() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ totalVehicles: 0, available: 0, activeRentals: 0, totalBookings: 0, dailyBookings: 0, revenue: 0, drivers: 0, availableDrivers: 0 });
  const [activities, setActivities] = useState([]);
  const [revenueByDay, setRevenueByDay] = useState({ labels: [], data: [] });
  const [fleetMix, setFleetMix] = useState({ labels: [], data: [] });
  const [utilizationData, setUtilizationData] = useState({ labels: [], booked: [], available: [] });
  const [workshop, setWorkshop] = useState({ upcoming: 0, inWorkshop: 0, damage: 0 });
  const [loading, setLoading] = useState(true);

  // Fetch workshop counts - extracted for reuse
  const fetchWorkshopCounts = useCallback(async () => {
    try {
      // Fetch maintenance records
      const { data: maint, error } = await supabase.from('maintenance_records').select('status, service_type');
      if (error) {
        console.error('Error fetching maintenance records:', error);
      }
      
      // Fetch open damage claims
      const { data: claims, error: claimsError } = await supabase
        .from('damage_claims')
        .select('status')
        .in('status', ['pending', 'reviewed', 'sent_to_customer', 'disputed']);
      
      if (claimsError) {
        console.error('Error fetching damage claims:', claimsError);
      }
      
      const ws = { upcoming: 0, inWorkshop: 0, damage: 0 };
      (maint || []).forEach((m) => {
        // Status values are Title Case: 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Billed'
        if (m.status === 'Scheduled') ws.upcoming++;
        if (m.status === 'In Progress') ws.inWorkshop++;
      });
      
      // Count open damage claims
      ws.damage = (claims || []).length;
      
      console.log('Calculated workshop counts:', ws);
      setWorkshop(ws);
    } catch (err) {
      console.error('Error in fetchWorkshopCounts:', err);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        
        // Fetch core metrics
        const [{ count: totalVehicles }, { count: availableVehicles }, { count: totalBookings }, { count: driverCount }] = await Promise.all([
          supabase.from('vehicles').select('*', { count: 'exact', head: true }),
          supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'available'),
          supabase.from('vehicle_bookings').select('*', { count: 'exact', head: true }),
          supabase.from('drivers').select('*', { count: 'exact', head: true }),
        ]);

        // Fetch active bookings (currently in progress - start_date <= today <= end_date, status not cancelled)
        const { count: activeRentalsCount } = await supabase
          .from('vehicle_bookings')
          .select('*', { count: 'exact', head: true })
          .lte('start_date', today)
          .gte('end_date', today)
          .not('status', 'in', '(cancelled,completed)');

        // Fetch today's bookings
        const { count: dailyBookings } = await supabase
          .from('vehicle_bookings')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());

        // Calculate revenue from payments table (most accurate)
        // Only count completed payments
        const { data: completedPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed');
        
        const revenue = (completedPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

        // Recent activity from bookings
        const { data: recentBookings } = await supabase.from('vehicle_bookings').select('id, status, created_at, vehicles(name), customer_name').order('created_at', { ascending: false }).limit(5);
        const acts = (recentBookings || []).map((b) => ({
          type: `Booking ${b.status}`,
          detail: `${b.vehicles?.name || 'Vehicle'} - ${b.customer_name || 'Customer'}`,
          time: new Date(b.created_at).toLocaleString(),
        }));

        setMetrics({ 
          totalVehicles: totalVehicles || 0, 
          available: availableVehicles || 0, 
          activeRentals: activeRentalsCount || 0, 
          totalBookings: totalBookings || 0, 
          dailyBookings: dailyBookings || 0, 
          revenue,
          drivers: driverCount || 0, 
          availableDrivers: 0 
        });
        setActivities(acts);

        // Workshop counts
        await fetchWorkshopCounts();

        // Revenue by day (last 7 days) - from vehicle_bookings paid_amount
        const days = [];
        const dayLabels = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          days.push(d.toISOString().split('T')[0]);
          dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        }
        const revArr = await Promise.all(days.map(async (day) => {
          const next = new Date(day); next.setDate(next.getDate() + 1);
          const { data: dayBookings } = await supabase
            .from('vehicle_bookings')
            .select('paid_amount')
            .or('status.eq.confirmed,status.eq.completed,status.eq.active')
            .gt('paid_amount', 0)
            .gte('created_at', day)
            .lt('created_at', next.toISOString().split('T')[0]);
          return (dayBookings || []).reduce((s, b) => s + Number(b.paid_amount || 0), 0);
        }));
        setRevenueByDay({ labels: dayLabels, data: revArr });

        // Fleet mix by category
        const { data: allVehicles } = await supabase.from('vehicles').select('category');
        const catMap = {};
        (allVehicles || []).forEach((v) => { const c = v.category || 'Other'; catMap[c] = (catMap[c] || 0) + 1; });
        setFleetMix({ labels: Object.keys(catMap), data: Object.values(catMap) });

        // Utilization by category - count vehicles currently booked
        const { data: bookedVehicles } = await supabase
          .from('vehicle_bookings')
          .select('vehicles(category)')
          .lte('start_date', today)
          .gte('end_date', today)
          .or('status.eq.confirmed,status.eq.active');
        const bookedMap = {};
        (bookedVehicles || []).forEach((b) => { const c = b.vehicles?.category || 'Other'; bookedMap[c] = (bookedMap[c] || 0) + 1; });
        const cats = Object.keys(catMap);
        setUtilizationData({ labels: cats, booked: cats.map((c) => bookedMap[c] || 0), available: cats.map((c) => (catMap[c] || 0) - (bookedMap[c] || 0)) });

      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  // Periodic refresh every 30 seconds for workshop counts
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWorkshopCounts();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchWorkshopCounts]);

  // Realtime subscription for maintenance_records changes
  useEffect(() => {
    console.log('Setting up realtime subscription for maintenance_records...');
    const subscription = supabase
      .channel('maintenance_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'maintenance_records' },
        (payload) => {
          console.log('Real-time update received:', payload);
          fetchWorkshopCounts();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from maintenance_changes...');
      subscription.unsubscribe();
    };
  }, [fetchWorkshopCounts]);

  const formatNpr = (v) => `NPR ${Number(v || 0).toLocaleString()}`;

  const metricCards = [
    { label: 'Total Vehicles', value: metrics.totalVehicles, delta: `${metrics.available} available now` },
    { label: 'Active Rentals', value: metrics.activeRentals, delta: `${metrics.totalBookings} total bookings` },
    { label: 'Daily Bookings', value: metrics.dailyBookings, delta: "Today's bookings" },
    { label: 'Revenue', value: formatNpr(metrics.revenue), delta: 'From completed payments' },
    { label: 'Drivers', value: metrics.drivers, delta: `${metrics.availableDrivers} available now` },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => <div key={i} className={`${panel} p-4 h-28`}><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div><div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Overview</p>
          <h2 className={heading}>Enterprise Fleet Snapshot</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          Sync window: last 5 minutes
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((item, i) => (
          <article key={i} className={`${panel} card-hover p-4`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">{item.value}</p>
            <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{item.delta}</p>
          </article>
        ))}
      </div>

      {/* Workshop Priorities */}
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold">Workshop Priorities</h3>
          <button onClick={() => navigate('/admin/maintenance')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">View all</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <WorkshopMini icon="schedule" label="Upcoming Services" count={workshop.upcoming} color="amber" onClick={() => navigate('/admin/maintenance')} />
          <WorkshopMini icon="build" label="In Workshop" count={workshop.inWorkshop} color="blue" onClick={() => navigate('/admin/maintenance')} />
          <WorkshopMini icon="warning" label="Damage Claims Open" count={workshop.damage} color="rose" onClick={() => navigate('/admin/damage-claims')} />
        </div>
      </section>

      {/* Charts + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className={`${panel} xl:col-span-7 p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold">Revenue Trend</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Last 7 days</span>
          </div>
          <div className="h-[290px]">
            <Bar data={{ labels: revenueByDay.labels, datasets: [{ label: 'Revenue (NPR)', data: revenueByDay.data, backgroundColor: 'rgba(31,118,104,0.7)', borderRadius: 8, borderSkipped: false }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false } } } }} />
          </div>
        </section>

        <section className={`${panel} xl:col-span-5 p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold">Fleet Mix</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Category share</span>
          </div>
          <div className="h-[290px] flex items-center justify-center">
            {fleetMix.labels.length > 0 ? (
              <Doughnut data={{ labels: fleetMix.labels, datasets: [{ data: fleetMix.data, backgroundColor: ['#1f7668','#f08f5f','#2f5f7b','#e2c75e','#9b59b6','#3498db','#e74c3c','#1abc9c'], borderWidth: 0 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', font: { size: 11, weight: 600 } } } }, cutout: '62%' }} />
            ) : (
              <p className="text-sm text-slate-400">No vehicle data</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className={`${panel} xl:col-span-6 p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold">Utilization by Segment</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current capacity use</span>
          </div>
          <div className="h-[280px]">
            <Bar data={{ labels: utilizationData.labels, datasets: [{ label: 'Booked', data: utilizationData.booked, backgroundColor: 'rgba(240,143,95,0.75)', borderRadius: 6, borderSkipped: false }, { label: 'Available', data: utilizationData.available, backgroundColor: 'rgba(31,118,104,0.5)', borderRadius: 6, borderSkipped: false }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 11, weight: 600 }, padding: 12 } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } } } }} />
          </div>
        </section>

        <section className={`${panel} xl:col-span-6 p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold">Recent Activity</h3>
            <button onClick={() => navigate('/admin/bookings')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">View log</button>
          </div>
          <ul className="space-y-2">
            {activities.length === 0 && <li className="text-sm text-slate-400 py-4 text-center">No recent activity</li>}
            {activities.map((a, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{a.type}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{a.detail}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{a.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function WorkshopMini({ icon, label, count, color, onClick }) {
  const bg = { amber: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10', blue: 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10', rose: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10' };
  const txt = { amber: 'text-amber-700 dark:text-amber-300', blue: 'text-blue-700 dark:text-blue-300', rose: 'text-rose-700 dark:text-rose-300' };
  return (
    <div onClick={onClick} className={`cursor-pointer rounded-xl border p-3 transition hover:shadow-sm ${bg[color]}`}>
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-[20px] ${txt[color]}`}>{icon}</span>
        <span className={`text-xs font-bold uppercase tracking-[0.12em] ${txt[color]}`}>{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-extrabold ${txt[color]}`}>{count}</p>
    </div>
  );
}
