'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

// Simplified statuses - only 3 main ones for clarity
const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed'];
const ALL_STATUS_FILTER = ['All', ...STATUS_OPTIONS];

// Service types - NO "Damage" (damage goes to Damage Claims page)
const TYPE_OPTIONS = ['Scheduled Service', 'Inspection', 'Repair', 'Oil Change', 'Tire Service', 'General Maintenance'];

const Field = ({ label, value }: { label: string, value: string }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-900 dark:text-white">{value || '-'}</span>
  </div>
);

const statusColor = (s: string) => {
  const c: Record<string, string> = {
    'Scheduled': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    'Completed': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  };
  return c[s] || c['Scheduled'];
};

const emptyForm = {
  vehicle_id: '', vehicle_name: '', service_type: 'Scheduled Service', status: 'Scheduled',
  description: '', schedule_date: '', completed_at: '', cost_estimate: '', technician: '',
  reported_by: '', notes: '', provider_name: '', odometer_reading: ''
};

export default function AdminMaintenance() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cardGroup, setCardGroup] = useState('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'list' | 'detail' | 'add' | 'edit'>('list');
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const perPage = 10;

  const fetch_ = async () => {
    setLoading(true);
    const [{ data: m }, { data: v }] = await Promise.all([
      supabase.from('maintenance_records').select('*, vehicles(name, vehicle_number)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, name, vehicle_number').order('name'),
    ]);
    setRecords(m || []); setVehicles(v || []); setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const counts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, total_cost: 0 };
    records.forEach((r: any) => {
      if (r.status === 'Scheduled') c.scheduled++;
      if (r.status === 'In Progress') c.in_progress++;
      if (r.status === 'Completed') {
        c.completed++;
        c.total_cost += Number(r.cost_estimate || 0);
      }
    });
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    let rows = records.filter((r: any) => {
      const q = search.toLowerCase();
      return !q || [r.maintenance_id, r.service_type, r.status, r.description, r.vehicles?.name, r.vehicles?.vehicle_number, r.technician].some((f) => String(f || '').toLowerCase().includes(q));
    });
    if (cardGroup === 'scheduled') rows = rows.filter((r: any) => r.status === 'Scheduled');
    else if (cardGroup === 'inProgress') rows = rows.filter((r: any) => r.status === 'In Progress');
    else if (cardGroup === 'completed') rows = rows.filter((r: any) => r.status === 'Completed');
    if (statusFilter !== 'All') rows = rows.filter((r: any) => r.status === statusFilter);
    return rows;
  }, [records, search, statusFilter, cardGroup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this maintenance record permanently?')) return;
    await supabase.from('maintenance_records').delete().eq('id', id);
    if (detail?.id === id) { setDetail(null); setMode('list'); }
    await fetch_();
  };

  const updateStatus = async (id: string, status: string) => {
    const upd: any = { status };
    if (status === 'Completed') upd.completed_at = new Date().toISOString().slice(0, 10);
    await supabase.from('maintenance_records').update(upd).eq('id', id);
    await fetch_();
    if (detail?.id === id) {
      const { data: fresh } = await supabase.from('maintenance_records').select('*, vehicles(name, vehicle_number)').eq('id', id).single();
      setDetail(fresh);
    }
  };

  const openDetail = (r: any) => { setDetail(r); setMode('detail'); };
  
  const openAdd = () => {
    setForm({ ...emptyForm, schedule_date: new Date().toISOString().slice(0, 10) });
    setMode('add');
  };
  
  const openEdit = (r: any) => {
    setForm({
      vehicle_id: r.vehicle_id || '', vehicle_name: r.vehicle_name || r.vehicles?.name || '',
      service_type: r.service_type || 'Scheduled Service', status: r.status || 'Scheduled',
      description: r.description || '', schedule_date: r.schedule_date || '',
      completed_at: r.completed_at || '', cost_estimate: r.cost_estimate || '',
      technician: r.technician || '', reported_by: r.reported_by || '',
      notes: r.notes || '', provider_name: r.provider_name || '', odometer_reading: r.odometer_reading || ''
    });
    setMode('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.vehicle_id) { alert('Vehicle and description are required'); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: form.vehicle_id || null, vehicle_name: form.vehicle_name,
        service_type: form.service_type, status: form.status, description: form.description,
        schedule_date: form.schedule_date || null, completed_at: form.completed_at || null,
        cost_estimate: form.cost_estimate ? parseFloat(form.cost_estimate) : null,
        technician: form.technician || null, reported_by: form.reported_by || null,
        notes: form.notes || null, provider_name: form.provider_name || null,
        odometer_reading: form.odometer_reading ? parseInt(form.odometer_reading) : null
      };
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
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const u = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const toggleCard = (group: string) => { setCardGroup(cardGroup === group ? '' : group); setStatusFilter('All'); setPage(1); };

  // ADD/EDIT FORM VIEW
  if (mode === 'add' || mode === 'edit') {
    const isEdit = mode === 'edit';
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => setMode(isEdit ? 'detail' : 'list')} className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Fleet &rsaquo; Maintenance</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>{isEdit ? 'Edit Maintenance Record' : 'Schedule New Maintenance'}</h2>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {/* Header banner */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[28px] text-teal-600 dark:text-teal-400">build</span>
              <div>
                <p className="text-sm font-bold text-teal-800 dark:text-teal-200">Vehicle Maintenance</p>
                <p className="text-xs text-teal-600 dark:text-teal-400">Schedule regular services, inspections, and repairs for your fleet vehicles</p>
              </div>
            </div>
          </div>

          {/* Vehicle & Service Type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">directions_car</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Vehicle</h3>
              </div>
              <label className="block">
                <span className="text-xs font-semibold">Select Vehicle <span className="text-rose-500">*</span></span>
                <select value={form.vehicle_id} onChange={(e) => { const vid = e.target.value; const veh = vehicles.find((v) => v.id === vid); setForm({ ...form, vehicle_id: vid, vehicle_name: veh?.name || '' }); }} className={`mt-1 ${inp}`} required>
                  <option value="">Choose vehicle</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vehicle_number})</option>)}
                </select>
              </label>
              <label className="block mt-3">
                <span className="text-xs font-semibold">Odometer Reading (km)</span>
                <input type="number" min="0" value={form.odometer_reading} onChange={u('odometer_reading')} className={`mt-1 ${inp}`} placeholder="Current mileage" />
              </label>
            </section>

            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">category</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Service Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold">Service Type</span>
                  <select value={form.service_type} onChange={u('service_type')} className={`mt-1 ${inp}`}>
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">Status</span>
                  <select value={form.status} onChange={u('status')} className={`mt-1 ${inp}`}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </section>
          </div>

          {/* Description */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">description</span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Service Description</h3>
            </div>
            <label className="block">
              <span className="text-xs font-semibold">What needs to be done? <span className="text-rose-500">*</span></span>
              <textarea value={form.description} onChange={u('description')} rows={3} required className={`mt-1 ${inp}`} placeholder="e.g. Oil change, brake pad replacement, full inspection..." />
            </label>
          </section>

          {/* Schedule & Cost */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Schedule</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold">Scheduled Date</span>
                  <input type="date" value={form.schedule_date} onChange={u('schedule_date')} className={`mt-1 ${inp}`} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">Completed Date</span>
                  <input type="date" value={form.completed_at} onChange={u('completed_at')} className={`mt-1 ${inp}`} />
                </label>
              </div>
            </section>

            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">payments</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Cost & Provider</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold">Cost (NPR)</span>
                  <input type="number" min="0" value={form.cost_estimate} onChange={u('cost_estimate')} className={`mt-1 ${inp}`} placeholder="0" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">Service Provider</span>
                  <input value={form.provider_name} onChange={u('provider_name')} className={`mt-1 ${inp}`} placeholder="Workshop name" />
                </label>
              </div>
            </section>
          </div>

          {/* Assignment */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Assignment</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold">Technician</span>
                <input value={form.technician} onChange={u('technician')} className={`mt-1 ${inp}`} placeholder="Assigned mechanic" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Reported By</span>
                <input value={form.reported_by} onChange={u('reported_by')} className={`mt-1 ${inp}`} placeholder="Who requested this?" />
              </label>
            </div>
          </section>

          {/* Notes */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">notes</span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Notes</h3>
            </div>
            <label className="block">
              <span className="text-xs font-semibold">Additional remarks</span>
              <textarea value={form.notes} onChange={u('notes')} rows={2} className={`mt-1 ${inp}`} placeholder="Parts ordered, waiting for delivery..." />
            </label>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <button type="button" onClick={() => setMode(isEdit ? 'detail' : 'list')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1f7668] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">save</span> {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // DETAIL VIEW
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
            <Field label="Description" value={r.description} />
            <Field label="Scheduled Date" value={r.schedule_date} />
            {r.completed_at && <Field label="Completed On" value={r.completed_at} />}
            {r.odometer_reading && <Field label="Odometer" value={`${Number(r.odometer_reading).toLocaleString()} km`} />}
          </section>

          <section className={`${panel} p-4 sm:p-5 space-y-3`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Status & Cost</h3>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Status</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button key={s} onClick={() => updateStatus(r.id, s)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${r.status === s ? 'border-[#1f7668] bg-[#1f7668]/10 text-[#1f7668]' : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10'}`}>{s}</button>
                ))}
              </div>
            </div>

            <Field label="Technician" value={r.technician} />
            <Field label="Service Provider" value={r.provider_name} />
            <Field label="Reported By" value={r.reported_by} />
            <Field label="Cost" value={r.cost_estimate ? `NPR ${Number(r.cost_estimate).toLocaleString()}` : '-'} />
          </section>

          <section className={`${panel} p-4 sm:p-5 space-y-3 md:col-span-2`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Notes</h3>
            <p className="text-sm text-slate-700 dark:text-slate-200">{r.notes || <span className="italic text-slate-400">No notes.</span>}</p>
          </section>

          {/* Info banner about expenses */}
          {r.status === 'Completed' && r.cost_estimate > 0 && (
            <section className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-300 mt-0.5">receipt_long</span>
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Added to Expenses</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">This completed maintenance record of NPR {Number(r.cost_estimate).toLocaleString()} appears in your Expense Management automatically.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  const cardDef = [
    { id: 'scheduled', label: 'Scheduled', count: counts.scheduled, icon: 'schedule', color: 'amber', sub: 'Awaiting service' },
    { id: 'inProgress', label: 'In Progress', count: counts.in_progress, icon: 'build', color: 'blue', sub: 'Currently in workshop' },
    { id: 'completed', label: 'Completed', count: counts.completed, icon: 'check_circle', color: 'emerald', sub: 'Services finished' },
  ];
  
  const palette: any = {
    amber: { base: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10', active: 'border-amber-400 bg-amber-100 ring-2 ring-amber-400/40 dark:border-amber-400 dark:bg-amber-500/20', icon: 'bg-amber-200/60 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300', text: 'text-amber-800 dark:text-amber-200' },
    blue: { base: 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10', active: 'border-blue-400 bg-blue-100 ring-2 ring-blue-400/40 dark:border-blue-400 dark:bg-blue-500/20', icon: 'bg-blue-200/60 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300', text: 'text-blue-800 dark:text-blue-200' },
    emerald: { base: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10', active: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-400/40 dark:border-emerald-400 dark:bg-emerald-500/20', icon: 'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300', text: 'text-emerald-800 dark:text-emerald-200' },
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Fleet</p>
          <h2 className={heading}>Vehicle Maintenance</h2>
          <p className="mt-1 text-xs text-slate-500">Schedule and track regular vehicle services, inspections, and repairs</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetch_} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">
            <span className="material-symbols-outlined mr-1 text-[16px] align-middle">refresh</span> Refresh
          </button>
          <button onClick={() => openAdd()} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">
            <span className="material-symbols-outlined mr-1 text-[16px] align-middle">add</span> Schedule Maintenance
          </button>
        </div>
      </header>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span><strong>Tip:</strong> For customer damage claims, use the <button onClick={() => router.push('/admin/damage-claims')} className="underline font-semibold hover:text-blue-600">Damage Claims</button> page instead.</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cardDef.map((c) => { const p = palette[c.color]; const active = cardGroup === c.id; return (
          <article key={c.id} onClick={() => toggleCard(c.id)} className={`group relative cursor-pointer select-none rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${active ? p.active : p.base} ${p.text}`} role="button" tabIndex={0}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.icon}`}>
                <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{c.label}</p>
                <p className="mt-1 text-3xl font-extrabold leading-none">{String(c.count)}</p>
                <p className="mt-1.5 text-[11px] font-medium opacity-60">{c.sub}</p>
              </div>
            </div>
            {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full bg-current opacity-50"></div>}
          </article>
        ); })}
      </div>

      {/* Total Cost Summary */}
      <div className={`${panel} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-slate-400">payments</span>
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total Completed Maintenance Cost:</span>
        </div>
        <span className="text-lg font-bold text-rose-600">NPR {counts.total_cost.toLocaleString()}</span>
      </div>

      {/* Active Filter Indicator */}
      {cardGroup && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
          Showing: <strong>{cardDef.find((c) => c.id === cardGroup)?.label}</strong>
          <span className="text-slate-400">({filtered.length} record{filtered.length !== 1 ? 's' : ''})</span>
          <button onClick={() => { setCardGroup(''); setPage(1); }} className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10">Clear</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search maintenance records..."
            className={`${inp} pl-10`} />
        </div>
        {ALL_STATUS_FILTER.map((opt) => (
          <button key={opt} onClick={() => { setStatusFilter(opt); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${statusFilter === opt ? 'bg-[#1f7668] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'}`}>{opt}</button>
        ))}
      </div>

      {/* Table */}
      <section className={`${panel} p-4 sm:p-5`}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1f7668] border-t-transparent"></div>
          </div>
        ) : paged.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-slate-300">build</span>
            <p className="mt-2 text-sm text-slate-500">No maintenance records found</p>
            <button onClick={() => openAdd()} className="mt-3 rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white">Schedule Maintenance</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Service Type</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Schedule</th>
                  <th className="pb-2 pr-3">Cost</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} onClick={() => openDetail(r)} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="py-3 pr-3 font-mono text-xs text-slate-500">{r.maintenance_id || r.id?.slice(0, 8)}</td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.vehicles?.name || r.vehicle_name || '—'}</p>
                      {r.vehicles?.vehicle_number && <p className="text-xs text-slate-500">{r.vehicles.vehicle_number}</p>}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[12px]">build</span>
                        {r.service_type}
                      </span>
                    </td>
                    <td className="py-3 pr-3 max-w-[200px] truncate text-slate-600 dark:text-slate-300" title={r.description}>{r.description || '—'}</td>
                    <td className="py-3 pr-3 text-slate-500">{r.schedule_date || '—'}</td>
                    <td className="py-3 pr-3 font-semibold">{r.cost_estimate ? `NPR ${Number(r.cost_estimate).toLocaleString()}` : '—'}</td>
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

        {/* Pagination */}
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
