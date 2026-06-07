import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Billed'];
const ALL_STATUS_FILTER = ['All', ...STATUS_OPTIONS];
const TYPE_OPTIONS = ['Damage', 'Scheduled Service', 'Inspection', 'Repair'];

const Field = ({ label, value }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-900 dark:text-white">{value || '-'}</span>
  </div>
);

const statusColor = (s) => {
  const c = { 'Scheduled': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', 'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', 'Completed': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', 'Cancelled': 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', 'Billed': 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' };
  return c[s] || c['Scheduled'];
};

const emptyForm = { vehicle_id: '', vehicle_name: '', service_type: 'Damage', status: 'Scheduled', description: '', schedule_date: '', completed_at: '', cost_estimate: '', technician: '', reported_by: '', notes: '', customer_name: '', customer_email: '' };

export default function AdminMaintenance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cardGroup, setCardGroup] = useState('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState('list'); // list | detail | add | edit
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [saving, setSaving] = useState(false);
  const perPage = 8;

  const fetch_ = async () => {
    setLoading(true);
    const [{ data: m }, { data: v }] = await Promise.all([
      supabase.from('maintenance_records').select('*, vehicles(name, vehicle_number)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, name, vehicle_number').order('name'),
    ]);
    setRecords(m || []); setVehicles(v || []); setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  // Counts for cards
  const counts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, damage_open: 0 };
    records.forEach((r) => {
      if (r.status === 'Scheduled') c.scheduled++;
      if (r.status === 'In Progress') c.in_progress++;
      if (r.status === 'Completed') c.completed++;
      if (r.service_type === 'Damage' && !['Completed', 'Cancelled', 'Billed'].includes(r.status)) c.damage_open++;
    });
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    let rows = records.filter((r) => {
      const q = search.toLowerCase();
      return !q || [r.maintenance_id, r.service_type, r.status, r.description, r.vehicles?.name, r.vehicles?.vehicle_number, r.technician].some((f) => String(f || '').toLowerCase().includes(q));
    });
    if (cardGroup === 'upcoming') rows = rows.filter((r) => r.status === 'Scheduled');
    else if (cardGroup === 'inWorkshop') rows = rows.filter((r) => r.status === 'In Progress');
    else if (cardGroup === 'damageOpen') rows = rows.filter((r) => r.service_type === 'Damage' && !['Completed', 'Cancelled', 'Billed'].includes(r.status));
    else if (cardGroup === 'completed') rows = rows.filter((r) => r.status === 'Completed');
    if (statusFilter !== 'All') rows = rows.filter((r) => r.status === statusFilter);
    return rows;
  }, [records, search, statusFilter, cardGroup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id) => {
    if (!confirm('Delete this maintenance record permanently?')) return;
    await supabase.from('maintenance_records').delete().eq('id', id);
    if (detail?.id === id) { setDetail(null); setMode('list'); }
    await fetch_();
  };

  const updateStatus = async (id, status) => {
    const upd = { status };
    if (status === 'Completed') upd.completed_at = new Date().toISOString().slice(0, 10);
    await supabase.from('maintenance_records').update(upd).eq('id', id);
    await fetch_();
    if (detail?.id === id) {
      const { data: fresh } = await supabase.from('maintenance_records').select('*, vehicles(name, vehicle_number)').eq('id', id).single();
      setDetail(fresh);
    }
  };

  const openDetail = (r) => { setDetail(r); setMode('detail'); };
  const openAdd = (isDamage = false) => {
    setForm({ ...emptyForm, service_type: isDamage ? 'Damage' : 'Scheduled Service', status: isDamage ? 'In Progress' : 'Scheduled', schedule_date: new Date().toISOString().slice(0, 10) });
    setRecentTrips([]); setMode('add');
  };
  const openEdit = (r) => {
    setForm({ vehicle_id: r.vehicle_id || '', vehicle_name: r.vehicle_name || r.vehicles?.name || '', service_type: r.service_type || 'Damage', status: r.status || 'Scheduled', description: r.description || '', schedule_date: r.schedule_date || '', completed_at: r.completed_at || '', cost_estimate: r.cost_estimate || '', technician: r.technician || '', reported_by: r.reported_by || '', notes: r.notes || '', customer_name: r.customer_name || '', customer_email: r.customer_email || '' });
    setMode('edit');
  };

  const loadTrips = async (vehicleId) => {
    if (!vehicleId) { setRecentTrips([]); return; }
    const { data } = await supabase.from('vehicle_bookings').select('id, booking_code, customer_name, customer_email, end_date').eq('vehicle_id', vehicleId).eq('status', 'completed').order('end_date', { ascending: false }).limit(15);
    setRecentTrips(data || []);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.description) return;
    setSaving(true);
    try {
      const payload = { vehicle_id: form.vehicle_id || null, vehicle_name: form.vehicle_name, service_type: form.service_type, status: form.status, description: form.description, schedule_date: form.schedule_date || null, completed_at: form.completed_at || null, cost_estimate: form.cost_estimate ? parseFloat(form.cost_estimate) : null, technician: form.technician || null, reported_by: form.reported_by || null, notes: form.notes || null, customer_name: form.customer_name || null, customer_email: form.customer_email || null };
      if (mode === 'edit' && detail) {
        await supabase.from('maintenance_records').update(payload).eq('id', detail.id);
      } else {
        await supabase.from('maintenance_records').insert(payload);
      }
      await fetch_();
      if (mode === 'edit' && detail) {
        const { data: fresh } = await supabase.from('maintenance_records').select('*, vehicles(name, vehicle_number)').eq('id', detail.id).single();
        setDetail(fresh); setMode('detail');
      } else { setMode('list'); }
    } catch {} finally { setSaving(false); }
  };

  const u = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleCard = (group) => { setCardGroup(cardGroup === group ? '' : group); setStatusFilter('All'); setPage(1); };

  /* ─── Add / Edit Form ─── */
  if (mode === 'add' || mode === 'edit') {
    const isEdit = mode === 'edit';
    const isDamage = form.service_type === 'Damage';
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => setMode(isEdit ? 'detail' : 'list')} className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Quality &rsaquo; Maintenance</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>{isEdit ? 'Edit Record' : isDamage ? 'Report Vehicle Damage' : 'New Maintenance Record'}</h2>
          </div>
        </header>
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {/* Type banner */}
          <div className={`rounded-2xl border p-4 ${isDamage ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10' : 'border-teal-200 bg-teal-50 dark:border-teal-500/20 dark:bg-teal-500/10'}`}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-start gap-2.5 pt-0.5 min-w-[160px]">
                <span className={`material-symbols-outlined text-[22px] ${isDamage ? 'text-rose-500' : 'text-teal-600'}`}>{isDamage ? 'car_crash' : 'build'}</span>
                <div>
                  <p className={`text-xs font-extrabold uppercase tracking-widest ${isDamage ? 'text-rose-700 dark:text-rose-300' : 'text-teal-700 dark:text-teal-300'}`}>{isDamage ? 'Damage Report' : 'Service Record'}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{isDamage ? 'Log damage & link responsible customer' : 'Schedule or log a maintenance job'}</p>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ minWidth: 0 }}>
                <label className="block"><span className="text-xs font-semibold">Service Type</span>
                  <select value={form.service_type} onChange={u('service_type')} className={`mt-1 ${inp}`}>{TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </label>
                <label className="block"><span className="text-xs font-semibold">Status</span>
                  <select value={form.status} onChange={u('status')} className={`mt-1 ${inp}`}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </label>
              </div>
            </div>
          </div>
          {/* Vehicle + Details */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-slate-400">directions_car</span><h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Vehicle</h3></div>
              <label className="block"><span className="text-xs font-semibold">Vehicle <span className="text-rose-500">*</span></span>
                <select value={form.vehicle_id} onChange={(e) => { const vid = e.target.value; const veh = vehicles.find((v) => v.id === vid); setForm({ ...form, vehicle_id: vid, vehicle_name: veh?.name || '' }); if (isDamage) loadTrips(vid); }} className={`mt-1 ${inp}`} required>
                  <option value="">Select vehicle</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vehicle_number})</option>)}
                </select>
              </label>
            </section>
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-slate-400">info</span><h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Details</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-semibold">Cost Estimate (NPR)</span><input type="number" min="0" value={form.cost_estimate} onChange={u('cost_estimate')} className={`mt-1 ${inp}`} placeholder="0" /></label>
                <label className="block"><span className="text-xs font-semibold">Reported By</span><input value={form.reported_by} onChange={u('reported_by')} className={`mt-1 ${inp}`} placeholder="Admin / Driver" /></label>
              </div>
            </section>
          </div>
          {/* Description */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-slate-400">description</span><h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{isDamage ? 'Damage Description' : 'Service Description'}</h3></div>
            <label className="block"><span className="text-xs font-semibold">{isDamage ? 'Describe the damage' : 'Describe the service required'} <span className="text-rose-500">*</span></span>
              <textarea value={form.description} onChange={u('description')} rows={3} required className={`mt-1 ${inp}`} placeholder={isDamage ? 'e.g. Deep scratch on rear bumper' : 'e.g. Oil change and brake inspection'} />
            </label>
          </section>
          {/* Customer (Damage only) */}
          {isDamage && (
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-rose-400">person_search</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">Damaged By Customer</h3>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">Optional</span>
              </div>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Link the customer whose trip caused the damage. Select a completed trip or type manually.</p>
              {recentTrips.length > 0 && (
                <label className="block mb-3"><span className="text-xs font-semibold">Recent Completed Trips</span>
                  <select onChange={(e) => { const trip = recentTrips.find((t) => t.id === e.target.value); if (trip) setForm({ ...form, customer_name: trip.customer_name || '', customer_email: trip.customer_email || '' }); }} className={`mt-1 ${inp}`}>
                    <option value="">— Pick a customer from their trip —</option>
                    {recentTrips.map((t) => <option key={t.id} value={t.id}>{t.customer_name} — {t.booking_code} (returned {t.end_date})</option>)}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-xs font-semibold">Customer Name</span><input value={form.customer_name} onChange={u('customer_name')} className={`mt-1 ${inp}`} placeholder="Auto-filled from trip" /></label>
                <label className="block"><span className="text-xs font-semibold">Customer Email</span><input type="email" value={form.customer_email} onChange={u('customer_email')} className={`mt-1 ${inp}`} placeholder="Auto-filled from trip" /></label>
              </div>
            </section>
          )}
          {/* Schedule (non-Damage) */}
          {!isDamage && (
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span><h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Schedule</h3></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block"><span className="text-xs font-semibold">Scheduled Date <span className="text-rose-500">*</span></span><input type="date" value={form.schedule_date} onChange={u('schedule_date')} required className={`mt-1 ${inp}`} /></label>
                <label className="block"><span className="text-xs font-semibold">Completed Date</span><input type="date" value={form.completed_at} onChange={u('completed_at')} className={`mt-1 ${inp}`} /></label>
                <label className="block"><span className="text-xs font-semibold">Technician</span><input value={form.technician} onChange={u('technician')} className={`mt-1 ${inp}`} placeholder="Assigned technician" /></label>
              </div>
            </section>
          )}
          {/* Notes */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-slate-400">notes</span><h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Notes</h3></div>
            <label className="block"><span className="text-xs font-semibold">Additional remarks</span><textarea value={form.notes} onChange={u('notes')} rows={2} className={`mt-1 ${inp}`} placeholder="e.g. Parts ordered, waiting for delivery…" /></label>
          </section>
          {/* Actions */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <button type="button" onClick={() => setMode(isEdit ? 'detail' : 'list')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
            <button type="submit" disabled={saving} className={`inline-flex items-center gap-1.5 rounded-xl ${isDamage ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#1f7668] hover:bg-[#185f54]'} px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-50`}>
              <span className="material-symbols-outlined text-[16px]">{isDamage ? 'report' : 'save'}</span> {saving ? 'Saving…' : isEdit ? 'Save Changes' : isDamage ? 'Submit Damage Report' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ─── Detail View ─── */
  if (mode === 'detail' && detail) {
    const r = detail;
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setMode('list'); setDetail(null); }} className="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Maintenance Detail</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>{r.maintenance_id || r.id?.slice(0, 8)} — {r.vehicles?.name || r.vehicle_name || '—'}</h2>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => openEdit(r)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined mr-1 text-[16px] align-middle">edit</span> Edit
            </button>
            <button onClick={() => handleDelete(r.id)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10">
              <span className="material-symbols-outlined mr-1 text-[16px] align-middle">delete</span> Delete
            </button>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className={`${panel} p-4 sm:p-5 space-y-3`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Record Details</h3>
            <Field label="Maintenance ID" value={r.maintenance_id || r.id?.slice(0, 8)} />
            <Field label="Vehicle" value={r.vehicles?.name || r.vehicle_name} />
            <Field label="Vehicle Number" value={r.vehicles?.vehicle_number} />
            <Field label="Service Type" value={r.service_type} />
            {r.customer_name && <Field label="Damaged By" value={`${r.customer_name}${r.customer_email ? ` (${r.customer_email})` : ''}`} />}
            {r.booking_ref && <Field label="Linked Booking" value={r.booking_ref} />}
            <Field label="Description" value={r.description} />
            <Field label="Scheduled Date" value={r.schedule_date} />
            {r.completed_at && <Field label="Completed On" value={r.completed_at} />}
          </section>
          <section className={`${panel} p-4 sm:p-5 space-y-3`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Status &amp; Assignment</h3>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Status</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span>
            </div>
            {r.status !== 'Billed' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {['Scheduled', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
                    <button key={s} onClick={() => updateStatus(r.id, s)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${r.status === s ? 'border-[#1f7668] bg-[#1f7668]/10 text-[#1f7668]' : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10'}`}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {r.status === 'Billed' && <span className="rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-violet-300">Billed — charge issued</span>}
            <Field label="Technician" value={r.technician} />
            <Field label="Reported By" value={r.reported_by} />
            <Field label="Cost Estimate" value={r.cost_estimate ? `NPR ${Number(r.cost_estimate).toLocaleString()}` : '-'} />
          </section>
          <section className={`${panel} p-4 sm:p-5 space-y-3 md:col-span-2`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Notes</h3>
            <p className="text-sm text-slate-700 dark:text-slate-200">{r.notes || <span className="italic text-slate-400">No notes.</span>}</p>
          </section>
          {r.status === 'Billed' && (
            <section className="md:col-span-2 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-400/30 dark:bg-violet-500/10">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-violet-600 dark:text-violet-300 mt-0.5">receipt_long</span>
                <div>
                  <p className="text-sm font-bold text-violet-800 dark:text-violet-200">Damage bill issued</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">A payment request has been sent to the customer. Check the Payments module for settlement status.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  /* ─── List View ─── */
  const cardDef = [
    { id: 'upcoming', label: 'Upcoming Services', count: counts.scheduled, icon: 'schedule', color: 'amber', sub: 'Awaiting workshop slot' },
    { id: 'inWorkshop', label: 'In Workshop', count: counts.in_progress, icon: 'build', color: 'blue', sub: 'Currently being serviced' },
    { id: 'damageOpen', label: 'Damage Claims Open', count: counts.damage_open, icon: 'warning', color: 'rose', sub: 'Pending resolution' },
    { id: 'completed', label: 'Completed', count: counts.completed, icon: 'check_circle', color: 'emerald', sub: 'Services finished' },
  ];
  const palette = {
    amber: { base: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10', active: 'border-amber-400 bg-amber-100 ring-2 ring-amber-400/40 dark:border-amber-400 dark:bg-amber-500/20', icon: 'bg-amber-200/60 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300', text: 'text-amber-800 dark:text-amber-200' },
    blue: { base: 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10', active: 'border-blue-400 bg-blue-100 ring-2 ring-blue-400/40 dark:border-blue-400 dark:bg-blue-500/20', icon: 'bg-blue-200/60 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300', text: 'text-blue-800 dark:text-blue-200' },
    rose: { base: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10', active: 'border-rose-400 bg-rose-100 ring-2 ring-rose-400/40 dark:border-rose-400 dark:bg-rose-500/20', icon: 'bg-rose-200/60 text-rose-700 dark:bg-rose-500/30 dark:text-rose-300', text: 'text-rose-800 dark:text-rose-200' },
    emerald: { base: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10', active: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-400/40 dark:border-emerald-400 dark:bg-emerald-500/20', icon: 'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300', text: 'text-emerald-800 dark:text-emerald-200' },
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quality</p><h2 className={heading}>Maintenance &amp; Damage</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetch_} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
          <button onClick={() => openAdd(true)} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20">
            <span className="material-symbols-outlined mr-1 text-[16px] align-middle">car_crash</span> Report Damage
          </button>
        </div>
      </header>

      {/* Workshop Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cardDef.map((c) => { const p = palette[c.color]; const active = cardGroup === c.id; return (
          <article key={c.id} onClick={() => toggleCard(c.id)} className={`group relative cursor-pointer select-none rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${active ? p.active : p.base} ${p.text}`} role="button" tabIndex="0">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.icon}`}><span className="material-symbols-outlined text-[22px]">{c.icon}</span></div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{c.label}</p>
                <p className="mt-1 text-3xl font-extrabold leading-none">{c.count}</p>
                <p className="mt-1.5 text-[11px] font-medium opacity-60">{c.sub}</p>
              </div>
            </div>
            {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full bg-current opacity-50"></div>}
          </article>
        ); })}
      </div>

      {/* Active card filter banner */}
      {cardGroup && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
          Showing: <strong>{cardDef.find((c) => c.id === cardGroup)?.label}</strong>
          <span className="text-slate-400">({filtered.length} record{filtered.length !== 1 ? 's' : ''})</span>
          <button onClick={() => { setCardGroup(''); setPage(1); }} className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10">Clear</button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUS_FILTER.map((opt) => (
          <button key={opt} onClick={() => { setStatusFilter(opt); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${statusFilter === opt ? 'bg-[#1f7668] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'}`}>{opt}</button>
        ))}
      </div>

      {/* Table */}
      <section className={`${panel} p-4 sm:p-5`}>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : paged.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No records found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Schedule</th>
                  <th className="pb-2 pr-3">Service / Damage</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} onClick={() => openDetail(r)} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">{r.maintenance_id || r.id?.slice(0, 8)}</td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.vehicles?.name || r.vehicle_name || '—'}</p>
                      {r.vehicles?.vehicle_number && <p className="text-xs text-slate-500 dark:text-slate-400">{r.vehicles.vehicle_number}</p>}
                    </td>
                    <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">{r.schedule_date || '—'}</td>
                    <td className="py-3 pr-3">
                      <p className="text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{r.description || '—'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{r.service_type}</p>
                    </td>
                    <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span></td>
                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(r); setDetail(r); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" title="Edit">
                        <span className="material-symbols-outlined text-[14px] align-middle">edit</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="ml-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10" title="Delete">
                        <span className="material-symbols-outlined text-[14px] align-middle">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filtered.length} records • Page {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
