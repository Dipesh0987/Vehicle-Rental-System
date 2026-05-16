const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const PORT = process.env.PORT || 3001;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables. KPIs will fail until configured.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

function parseDateParam(val, fallback) {
  if (!val) return fallback;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

app.get('/api/kpis', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startISO = parseDateParam(start_date, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const endISO = parseDateParam(end_date, new Date().toISOString());

    // Fetch bookings within range
    const { data: bookingsInRange, error: inRangeErr } = await supabase
      .from('bookings')
      .select('id, user_id, vehicle_id, created_at, pickup_date, total_price')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (inRangeErr) throw inRangeErr;

    // Fetch distinct users who had bookings before the start (returning customers calculation)
    const { data: bookingsBefore, error: beforeErr } = await supabase
      .from('bookings')
      .select('user_id')
      .lt('created_at', startISO)
      .limit(10000);

    if (beforeErr) throw beforeErr;

    const usersInRange = new Set(bookingsInRange.map(b => b.user_id));
    const usersBefore = new Set((bookingsBefore || []).map(b => b.user_id));

    let returningCount = 0;
    usersInRange.forEach(u => { if (usersBefore.has(u)) returningCount++; });

    const repeatCustomersPct = usersInRange.size === 0 ? 0 : (returningCount / usersInRange.size) * 100;

    // Avg booking window: days between created_at and pickup_date
    const windows = bookingsInRange
      .map(b => {
        try {
          const created = new Date(b.created_at);
          const pickup = new Date(b.pickup_date);
          const diff = (pickup - created) / (1000 * 60 * 60 * 24);
          return diff;
        } catch (e) { return null; }
      })
      .filter(x => typeof x === 'number' && !Number.isNaN(x));

    const avgBookingWindow = windows.length === 0 ? 0 : (windows.reduce((a, b) => a + b, 0) / windows.length);

    // Top segment: sum revenue by vehicle category
    const vehicleIds = Array.from(new Set(bookingsInRange.map(b => b.vehicle_id).filter(Boolean)));
    let categoryByVehicle = {};
    if (vehicleIds.length > 0) {
      const { data: vehicles, error: vehErr } = await supabase
        .from('vehicles')
        .select('id, category')
        .in('id', vehicleIds);

      if (vehErr) throw vehErr;
      categoryByVehicle = (vehicles || []).reduce((acc, v) => { acc[v.id] = v.category; return acc; }, {});
    }

    const revenueByCategory = {};
    bookingsInRange.forEach(b => {
      const cat = categoryByVehicle[b.vehicle_id] || 'unknown';
      const price = parseFloat(b.total_price) || 0;
      revenueByCategory[cat] = (revenueByCategory[cat] || 0) + price;
    });

    const topSegment = Object.keys(revenueByCategory).reduce((best, cat) => {
      if (!best) return { category: cat, revenue: revenueByCategory[cat] };
      if (revenueByCategory[cat] > best.revenue) return { category: cat, revenue: revenueByCategory[cat] };
      return best;
    }, null);

    res.json({
      repeat_customers_pct: Number(repeatCustomersPct.toFixed(2)),
      avg_booking_window_days: Number(avgBookingWindow.toFixed(2)),
      top_segment: topSegment ? { category: topSegment.category, revenue: Number(topSegment.revenue.toFixed(2)) } : { category: null, revenue: 0 },
      meta: { start_date: startISO, end_date: endISO }
    });
  } catch (err) {
    console.error('KPI error', err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`KPI server listening on port ${PORT}`);
});
