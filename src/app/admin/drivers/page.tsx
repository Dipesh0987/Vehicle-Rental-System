'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
const AVAILABILITY_OPTIONS = ['All', 'Available', 'On Trip', 'Off Shift', 'On Leave'];
const LICENCE_STATUS_OPTIONS = ['Valid', 'Expired', 'Suspended', 'Pending Verification'];

const Field = ({ label, value }: { label: string, value: string }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-900 dark:text-white">{value || '-'}</span>
  </div>
);

const availColor = (s: string) => {
  const c: Record<string, string> = { 'Available': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', 'On Trip': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', 'Off Shift': 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300', 'On Leave': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' };
  return c[s] || c['Available'];
};
const licenceColor = (s: string) => {
  const c: Record<string, string> = { 'Valid': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', 'Expired': 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', 'Suspended': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', 'Pending Verification': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' };
  return c[s] || 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
};

const emptyForm = { full_name: '', email: '', phone: '', date_of_birth: '', address: '', license_number: '', license_expiry: '', licence_status: 'Valid', availability: 'Available', experience_years: '', vehicle_assigned: '', current_assignment: '', notes: '' };

export default function AdminDrivers() {
  const toast = useToast();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [availFilter, setAvailFilter] = useState('All');
  const [mode, setMode] = useState<'list' | 'detail' | 'add' | 'edit'>('list');
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const perPage = 5;

  const fetch_ = async () => {
    setLoading(true);
    const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
    setDrivers(data || []); setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const filtered = useMemo(() => {
    return drivers.filter((d: any) => {
      const q = search.toLowerCase();
      const matchQ = !q || [d.full_name, d.email, d.phone, d.license_number, d.availability, d.driver_id].some((f) => String(f || '').toLowerCase().includes(q));
      const matchAvail = availFilter === 'All' || d.availability === availFilter;
      return matchQ && matchAvail;
    });
  }, [drivers, search, availFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this driver permanently?')) return;
    await supabase.from('drivers').delete().eq('id', id);
    if (detail?.id === id) { setDetail(null); setMode('list'); }
    await fetch_();
  };

  const openDetail = (d: any) => { setDetail(d); setMode('detail'); };
  const openAdd = () => { setForm(emptyForm); setMode('add'); };
  const openEdit = (d: any) => {
    setForm({ full_name: d.full_name || '', email: d.email || '', phone: d.phone || '', date_of_birth: d.date_of_birth || '', address: d.address || '', license_number: d.license_number || '', license_expiry: d.license_expiry || '', licence_status: d.licence_status || 'Valid', availability: d.availability || 'Available', experience_years: d.experience_years || '', vehicle_assigned: d.vehicle_assigned || '', current_assignment: d.current_assignment || '', notes: d.notes || '' });
    setMode('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.license_number) {
      toast.warning('Please fill in name, phone, and license number.');
      return;
    }
    setSaving(true);
    try {
      // Convert empty strings to null — date columns reject '' with a 400 error
      const payload: any = {
        ...form,
        experience_years: form.experience_years ? parseInt(form.experience_years) : null,
        date_of_birth: form.date_of_birth || null,
        license_expiry: form.license_expiry || null,
        email: form.email || null,
      };
      let saveErr = null;
      if (mode === 'edit' && detail) {
        const { error } = await supabase.from('drivers').update(payload).eq('id', detail.id);
        saveErr = error;
      } else {
        const { error } = await supabase.from('drivers').insert(payload);
        saveErr = error;
      }
      if (saveErr) throw saveErr;
      await fetch_();
      if (mode === 'edit' && detail) {
        const { data: fresh } = await supabase.from('drivers').select('*').eq('id', detail.id).single();
        setDetail(fresh); setMode('detail');
      } else { setMode('list'); }
      toast.success(mode === 'edit' ? 'Driver updated successfully!' : 'Driver added successfully!');
    } catch (err: any) {
      toast.error('Failed to save driver: ' + (err?.message || 'Unknown error'));
    } finally { setSaving(false); }
  };

  const u = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  if (mode === 'add' || mode === 'edit') {
    const isEdit = mode === 'edit';
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => setMode(isEdit ? 'detail' : 'list')} className="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>{isEdit ? 'Edit Driver' : 'Onboard New Driver'}</h2>
          </div>
        </header>
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className={`${panel} p-4 sm:p-5 space-y-4`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Personal Information</h3>
            <label className="block"><span className="text-xs font-semibold">Full Name <span className="text-rose-500">*</span></span><input value={form.full_name} onChange={u('full_name')} required className={`mt-1 ${inp}`} placeholder="Enter full name" /></label>
            <label className="block"><span className="text-xs font-semibold">Phone <span className="text-rose-500">*</span></span><input value={form.phone} onChange={u('phone')} required className={`mt-1 ${inp}`} placeholder="+977-98XXXXXXXX" /></label>
            <label className="block"><span className="text-xs font-semibold">Email</span><input type="email" value={form.email} onChange={u('email')} className={`mt-1 ${inp}`} placeholder="email@example.com" /></label>
            <label className="block"><span className="text-xs font-semibold">Date of Birth</span><input type="date" value={form.date_of_birth} onChange={u('date_of_birth')} className={`mt-1 ${inp}`} /></label>
            <label className="block"><span className="text-xs font-semibold">Address</span><textarea value={form.address} onChange={u('address')} rows={2} className={`mt-1 ${inp}`} placeholder="Full address" /></label>
          </section>
          <section className={`${panel} p-4 sm:p-5 space-y-4`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Licence &amp; Work Details</h3>
            {isEdit && detail?.driver_id && <label className="block"><span className="text-xs font-semibold">Driver ID <span className="text-xs font-normal text-slate-400">(auto-assigned)</span></span><input value={detail.driver_id} readOnly className={`mt-1 ${inp} bg-slate-100 cursor-not-allowed`} /></label>}
            <label className="block"><span className="text-xs font-semibold">Licence Number <span className="text-rose-500">*</span></span><input value={form.license_number} onChange={u('license_number')} required className={`mt-1 ${inp}`} placeholder="LIC-XXXX-XXXXX" /></label>
            <label className="block"><span className="text-xs font-semibold">Licence Expiry</span><input type="date" value={form.license_expiry} onChange={u('license_expiry')} className={`mt-1 ${inp}`} /></label>
            <label className="block"><span className="text-xs font-semibold">Licence Status</span>
              <select value={form.licence_status} onChange={u('licence_status')} className={`mt-1 ${inp}`}>{LICENCE_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </label>
            <label className="block"><span className="text-xs font-semibold">Availability</span>
              <select value={form.availability} onChange={u('availability')} className={`mt-1 ${inp}`}>{AVAILABILITY_OPTIONS.filter((o) => o !== 'All').map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </label>
            <label className="block"><span className="text-xs font-semibold">Experience (years)</span><input type="number" min="0" value={form.experience_years} onChange={u('experience_years')} className={`mt-1 ${inp}`} placeholder="0" /></label>
          </section>
          <section className={`${panel} p-4 sm:p-5 space-y-4 md:col-span-2`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-300">Assignment &amp; Notes</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-semibold">Current Assignment</span><input value={form.current_assignment} onChange={u('current_assignment')} className={`mt-1 ${inp}`} placeholder="BK-XXXX or leave empty" /></label>
              <label className="block"><span className="text-xs font-semibold">Vehicle Assigned</span><input value={form.vehicle_assigned} onChange={u('vehicle_assigned')} className={`mt-1 ${inp}`} placeholder="V-XXX or leave empty" /></label>
            </div>
            <label className="block"><span className="text-xs font-semibold">Notes</span><textarea value={form.notes} onChange={u('notes')} rows={2} className={`mt-1 ${inp}`} placeholder="Any remarks about this driver" /></label>
          </section>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setMode(isEdit ? 'detail' : 'list')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#1f7668] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Driver'}</button>
          </div>
        </form>
      </div>
    );
  }

  if (mode === 'detail' && detail) {
    const d = detail;
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setMode('list'); setDetail(null); }} className="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Driver Detail</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>{d.full_name}</h2>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => openEdit(d)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined mr-1 text-[16px] align-middle">edit</span> Edit
            </button>
            <button onClick={() => handleDelete(d.id)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10">
              <span className="material-symbols-outlined mr-1 text-[16px] align-middle">delete</span> Delete
            </button>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className={`${panel} p-4 sm:p-5 space-y-3`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Personal Information</h3>
            <Field label="Full Name" value={d.full_name} />
            <Field label="Driver ID" value={d.driver_id || d.id?.slice(0, 8)} />
            <Field label="Phone" value={d.phone} />
            <Field label="Email" value={d.email} />
            <Field label="Date of Birth" value={d.date_of_birth} />
            <Field label="Address" value={d.address} />
          </section>
          <section className={`${panel} p-4 sm:p-5 space-y-3`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Licence &amp; Assignment</h3>
            <Field label="Licence Number" value={d.license_number} />
            <Field label="Licence Expiry" value={d.license_expiry} />
            <div className="flex items-center justify-between py-1"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Licence Status</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${licenceColor(d.licence_status || 'Valid')}`}>{d.licence_status || 'Valid'}</span></div>
            <div className="flex items-center justify-between py-1"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Availability</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${availColor(d.availability)}`}>{d.availability}</span></div>
            <Field label="Current Assignment" value={d.current_assignment || 'Unassigned'} />
            <Field label="Vehicle Assigned" value={d.vehicle_assigned} />
            <Field label="Experience" value={d.experience_years ? `${d.experience_years} years` : '-'} />
          </section>
          <section className={`${panel} p-4 sm:p-5 space-y-3 md:col-span-2`}>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Notes</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">{d.notes || 'No notes.'}</p>
            {d.onboarded_at && <p className="text-xs text-slate-400">Onboarded: {new Date(d.onboarded_at).toLocaleDateString()}</p>}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p>
          <h2 className={`${heading} text-slate-900 dark:text-white`}>Driver Management</h2>
        </div>
        <button onClick={openAdd} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">
          <span className="material-symbols-outlined mr-1 text-[16px] align-middle">person_add</span> Add Driver
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {AVAILABILITY_OPTIONS.map((opt) => (
          <button key={opt} onClick={() => { setAvailFilter(opt); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${availFilter === opt ? 'bg-[#1f7668] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'}`}>{opt}</button>
        ))}
      </div>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search drivers…" className={inp} />
        </div>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : paged.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No drivers found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3">Driver</th>
                  <th className="pb-2 pr-3">Licence Status</th>
                  <th className="pb-2 pr-3">Availability</th>
                  <th className="pb-2 pr-3">Current Assignment</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((d) => (
                  <tr key={d.id} onClick={() => openDetail(d)} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900 dark:text-white">{d.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{d.driver_id || d.id?.slice(0, 8)}</p>
                    </td>
                    <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${licenceColor(d.licence_status || 'Valid')}`}>{d.licence_status || 'Valid'}</span></td>
                    <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${availColor(d.availability)}`}>{d.availability}</span></td>
                    <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">{d.current_assignment || 'Unassigned'}</td>
                    <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">{d.phone || '—'}</td>
                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(d); setDetail(d); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" title="Edit">
                        <span className="material-symbols-outlined text-[14px] align-middle">edit</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="ml-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10" title="Delete">
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
            <span className="text-xs text-slate-500">{filtered.length} drivers • Page {page}/{totalPages}</span>
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
