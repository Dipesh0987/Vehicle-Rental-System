'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

// Clear status flow for damage claims
const STATUS_OPTIONS = ['Pending', 'Under Review', 'Sent to Customer', 'Paid', 'Disputed', 'Waived', 'Closed'];
const STATUS_LABELS: Record<string, string> = {
  'Pending': 'Pending Review',
  'Under Review': 'Under Review',
  'Sent to Customer': 'Sent to Customer',
  'Paid': 'Paid',
  'Disputed': 'Disputed',
  'Waived': 'Waived',
  'Closed': 'Closed'
};
const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'Under Review': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'Sent to Customer': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  'Paid': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'Disputed': 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'Waived': 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  'Closed': 'bg-slate-200 text-slate-500 dark:bg-slate-600/20 dark:text-slate-500'
};

const emptyForm = {
  vehicle_id: '', booking_id: '', customer_name: '', customer_email: '', customer_phone: '',
  damage_description: '', damage_location: '', total_damage_cost: '', damage_date: '',
  admin_notes: ''
};

export default function DamageClaims() {
  const router = useRouter();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [mode, setMode] = useState<'list' | 'detail' | 'add'>('list');
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('damage_claims')
        .select(`*, vehicles(id, name, vehicle_number, primary_image_url), bookings(id, booking_id, start_date, end_date)`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching claims:', error);
        setClaims([]);
      } else {
        setClaims(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setClaims([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClaims(); }, []);

  const loadVehiclesAndBookings = async () => {
    const [{ data: v }, { data: b }] = await Promise.all([
      supabase.from('vehicles').select('id, name, vehicle_number').order('name'),
      supabase.from('bookings').select('id, booking_id, vehicle_id, customer_name, customer_email, customer_phone, start_date, end_date, status, vehicles(name, vehicle_number)')
        .eq('status', 'completed').order('end_date', { ascending: false }).limit(50)
    ]);
    setVehicles(v || []);
    setRecentBookings(b || []);
  };

  const stats = useMemo(() => {
    const s = { total: claims.length, pending: 0, inReview: 0, sentToCustomer: 0, paid: 0, disputed: 0, totalAmount: 0, collectedAmount: 0 };
    claims.forEach((c: any) => {
      s.totalAmount += Number(c.total_damage_cost || 0);
      if (c.status === 'Pending') s.pending++;
      else if (c.status === 'Under Review') s.inReview++;
      else if (c.status === 'Sent to Customer') s.sentToCustomer++;
      else if (c.status === 'Paid') { s.paid++; s.collectedAmount += Number(c.total_damage_cost || 0); }
      else if (c.status === 'Disputed') s.disputed++;
    });
    return s;
  }, [claims]);

  const filtered = useMemo(() => {
    return claims.filter((c: any) => {
      const matchesSearch = !search || 
        c.claim_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.vehicles?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.vehicles?.vehicle_number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [claims, search, statusFilter]);

  const openAdd = async () => {
    await loadVehiclesAndBookings();
    setForm({ ...emptyForm, damage_date: new Date().toISOString().slice(0, 10) });
    setMode('add');
  };

  const openDetail = (claim: any) => {
    setSelectedClaim(claim);
    setMode('detail');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.damage_description || !form.total_damage_cost) {
      alert('Please fill in vehicle, description, and damage cost');
      return;
    }
    setSaving(true);
    try {
      // Generate claim number
      const claimNumber = `DC-${Date.now().toString(36).toUpperCase()}`;
      
      const payload = {
        claim_number: claimNumber,
        vehicle_id: form.vehicle_id,
        booking_id: form.booking_id || null,
        customer_name: form.customer_name || null,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        damage_description: form.damage_description,
        damage_location: form.damage_location || null,
        total_damage_cost: parseFloat(form.total_damage_cost),
        damage_date: form.damage_date || null,
        admin_notes: form.admin_notes || null,
        status: 'Pending'
      };
      
      const { error } = await supabase.from('damage_claims').insert(payload);
      if (error) throw error;
      
      await fetchClaims();
      setMode('list');
      alert('Damage claim created successfully!');
    } catch (err: any) {
      alert('Error creating claim: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateClaimStatus = async (claimId: string, newStatus: string) => {
    setSaving(true);
    try {
      const updates: any = { status: newStatus };
      if (['Paid', 'Waived', 'Closed'].includes(newStatus)) {
        updates.resolved_at = new Date().toISOString();
      }
      
      const { error } = await supabase.from('damage_claims').update(updates).eq('id', claimId);
      if (error) throw error;
      
      await fetchClaims();
      if (selectedClaim?.id === claimId) {
        setSelectedClaim((prev: any) => ({ ...prev, ...updates }));
      }
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminNotes = async (claimId: string, notes: string) => {
    await supabase.from('damage_claims').update({ admin_notes: notes }).eq('id', claimId);
  };

  const sendClaimToCustomer = async (claim: any) => {
    const subject = `Damage Claim #${claim.claim_number} - ASSelf Car Rental`;
    const body = `Dear ${claim.customer_name || 'Customer'},

We have identified damage to the vehicle during your recent rental.

Claim Number: ${claim.claim_number}
Vehicle: ${claim.vehicles?.name} (${claim.vehicles?.vehicle_number})
Damage: ${claim.damage_description}
Total Amount: NPR ${Number(claim.total_damage_cost).toLocaleString()}

Please contact us to resolve this matter.

Best regards,
ASSelf Car Rental`;
    
    window.open(`mailto:${claim.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    await updateClaimStatus(claim.id, 'Sent to Customer');
  };

  // Create maintenance record from this damage claim (for repairs)
  const createMaintenanceFromClaim = async (claim: any) => {
    try {
      const payload = {
        vehicle_id: claim.vehicle_id,
        vehicle_name: claim.vehicles?.name,
        service_type: 'Repair',
        status: 'Scheduled',
        description: `Damage Repair: ${claim.damage_description}`,
        schedule_date: new Date().toISOString().slice(0, 10),
        cost_estimate: claim.total_damage_cost,
        notes: `Created from Damage Claim #${claim.claim_number}. Customer: ${claim.customer_name || 'Unknown'}`,
        reported_by: 'Damage Claims'
      };
      
      const { error } = await supabase.from('maintenance_records').insert(payload);
      if (error) throw error;
      
      alert('Maintenance record created! You can track the repair in the Maintenance page.');
      router.push('/admin/maintenance');
    } catch (err: any) {
      alert('Error creating maintenance: ' + err.message);
    }
  };

  const u = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  // ADD NEW CLAIM FORM
  if (mode === 'add') {
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => setMode('list')} className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Claims &rsaquo; New</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>Report Vehicle Damage</h2>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Info Banner */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[28px] text-rose-500">car_crash</span>
              <div>
                <p className="text-sm font-bold text-rose-800 dark:text-rose-200">Customer Damage Claim</p>
                <p className="text-xs text-rose-600 dark:text-rose-400">Record damage caused by a customer and track payment recovery</p>
              </div>
            </div>
          </div>

          {/* Link to Booking (Optional) */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">history</span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Link to Completed Booking (Optional)</h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">Select a completed booking to auto-fill customer details:</p>
            <select
              onChange={(e) => {
                const booking = recentBookings.find((b) => b.id === e.target.value);
                if (booking) {
                  setForm({
                    ...form,
                    booking_id: booking.id,
                    vehicle_id: booking.vehicle_id,
                    customer_name: booking.customer_name || '',
                    customer_email: booking.customer_email || '',
                    customer_phone: booking.customer_phone || ''
                  });
                }
              }}
              className={inp}
            >
              <option value="">— Select a recent booking —</option>
              {recentBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.booking_id} — {b.customer_name} — {b.vehicles?.name} ({b.end_date})
                </option>
              ))}
            </select>
          </section>

          {/* Vehicle & Customer */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">directions_car</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Vehicle</h3>
              </div>
              <label className="block">
                <span className="text-xs font-semibold">Select Vehicle <span className="text-rose-500">*</span></span>
                <select value={form.vehicle_id} onChange={u('vehicle_id')} className={`mt-1 ${inp}`} required>
                  <option value="">Choose vehicle</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vehicle_number})</option>)}
                </select>
              </label>
            </section>

            <section className={`${panel} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Customer Details</h3>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold">Customer Name</span>
                  <input value={form.customer_name} onChange={u('customer_name')} className={`mt-1 ${inp}`} placeholder="Who caused the damage?" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs font-semibold">Email</span>
                    <input type="email" value={form.customer_email} onChange={u('customer_email')} className={`mt-1 ${inp}`} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold">Phone</span>
                    <input value={form.customer_phone} onChange={u('customer_phone')} className={`mt-1 ${inp}`} />
                  </label>
                </div>
              </div>
            </section>
          </div>

          {/* Damage Details */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-rose-400">warning</span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-600">Damage Information</h3>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold">Damage Description <span className="text-rose-500">*</span></span>
                <textarea value={form.damage_description} onChange={u('damage_description')} rows={3} required className={`mt-1 ${inp}`} placeholder="Describe the damage in detail..." />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold">Damage Location</span>
                  <input value={form.damage_location} onChange={u('damage_location')} className={`mt-1 ${inp}`} placeholder="e.g. Front bumper, rear door" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">Damage Cost (NPR) <span className="text-rose-500">*</span></span>
                  <input type="number" min="0" value={form.total_damage_cost} onChange={u('total_damage_cost')} className={`mt-1 ${inp}`} placeholder="Repair cost estimate" required />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">Date of Damage</span>
                  <input type="date" value={form.damage_date} onChange={u('damage_date')} className={`mt-1 ${inp}`} />
                </label>
              </div>
            </div>
          </section>

          {/* Admin Notes */}
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">notes</span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Internal Notes</h3>
            </div>
            <textarea value={form.admin_notes} onChange={u('admin_notes')} rows={2} className={inp} placeholder="Add any internal notes..." />
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <button type="button" onClick={() => setMode('list')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">report</span> {saving ? 'Creating...' : 'Create Damage Claim'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // DETAIL VIEW
  if (mode === 'detail' && selectedClaim) {
    const claim = selectedClaim;
    const isResolved = ['Paid', 'Waived', 'Closed'].includes(claim.status);
    
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setMode('list'); setSelectedClaim(null); }} className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Damage Claim</p>
            <h2 className={`${heading} text-slate-900 dark:text-white`}>#{claim.claim_number}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[claim.status]}`}>
            {STATUS_LABELS[claim.status]}
          </span>
        </header>

        {/* Status Flow Visualization */}
        <div className={`${panel} p-4`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Claim Status Flow</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {['Pending', 'Under Review', 'Sent to Customer', 'Paid'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  claim.status === s ? STATUS_COLORS[s] : 
                  STATUS_OPTIONS.indexOf(claim.status) > STATUS_OPTIONS.indexOf(s) ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 
                  'bg-slate-100 text-slate-400 dark:bg-white/10'
                }`}>
                  {STATUS_OPTIONS.indexOf(claim.status) > STATUS_OPTIONS.indexOf(s) && <span className="material-symbols-outlined text-[14px]">check</span>}
                  {s}
                </div>
                {i < 3 && <span className="material-symbols-outlined text-slate-300 mx-1">arrow_forward</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Customer Info */}
          <div className={`${panel} p-4`}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Customer</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Name:</span> <strong>{claim.customer_name || '—'}</strong></p>
              <p><span className="text-slate-500">Email:</span> <strong>{claim.customer_email || '—'}</strong></p>
              <p><span className="text-slate-500">Phone:</span> <strong>{claim.customer_phone || '—'}</strong></p>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className={`${panel} p-4`}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Vehicle</h3>
            <div className="flex items-center gap-3">
              {claim.vehicles?.primary_image_url && (
                <img src={claim.vehicles.primary_image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />
              )}
              <div className="text-sm">
                <p className="font-semibold">{claim.vehicles?.name}</p>
                <p className="text-slate-500">{claim.vehicles?.vehicle_number}</p>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className={`${panel} p-4 border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10`}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">Damage Cost</h3>
            <p className="text-3xl font-bold text-rose-600">NPR {Number(claim.total_damage_cost).toLocaleString()}</p>
            <p className="text-xs text-rose-500 mt-1">{claim.damage_location || 'Location not specified'}</p>
          </div>
        </div>

        {/* Damage Description */}
        <div className={`${panel} p-4`}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Damage Description</h3>
          <p className="text-sm text-slate-700 dark:text-slate-200">{claim.damage_description}</p>
          {claim.damage_date && <p className="text-xs text-slate-400 mt-2">Damage Date: {claim.damage_date}</p>}
        </div>

        {/* Admin Notes */}
        <div className={`${panel} p-4`}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Admin Notes</h3>
          <textarea
            className={inp}
            rows={2}
            defaultValue={claim.admin_notes || ''}
            onBlur={(e) => updateAdminNotes(claim.id, e.target.value)}
            placeholder="Add internal notes..."
          />
        </div>

        {/* Actions */}
        <div className={`${panel} p-4`}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {/* Status update buttons based on current status */}
            {claim.status === 'Pending' && (
              <button onClick={() => updateClaimStatus(claim.id, 'Under Review')} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">visibility</span> Start Review
              </button>
            )}
            
            {['Pending', 'Under Review'].includes(claim.status) && claim.customer_email && (
              <button onClick={() => sendClaimToCustomer(claim)} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">mail</span> Send to Customer
              </button>
            )}
            
            {!isResolved && (
              <>
                <button onClick={() => updateClaimStatus(claim.id, 'Paid')} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[16px]">payments</span> Mark as Paid
                </button>
                
                <button onClick={() => updateClaimStatus(claim.id, 'Disputed')} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[16px]">gavel</span> Disputed
                </button>
                
                <button onClick={() => updateClaimStatus(claim.id, 'Waived')} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:text-slate-300">
                  <span className="material-symbols-outlined text-[16px]">do_not_disturb</span> Waive
                </button>
              </>
            )}
            
            {claim.status !== 'Closed' && (
              <button onClick={() => updateClaimStatus(claim.id, 'Closed')} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:text-slate-300">
                <span className="material-symbols-outlined text-[16px]">close</span> Close Claim
              </button>
            )}
          </div>
        </div>

        {/* Create Maintenance from Claim */}
        <div className={`${panel} p-4 border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10`}>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[24px] text-teal-600 dark:text-teal-400 mt-0.5">build</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-teal-800 dark:text-teal-200">Need to Repair This Damage?</p>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">Create a maintenance record to track the repair work and costs.</p>
              <button onClick={() => createMaintenanceFromClaim(claim)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                <span className="material-symbols-outlined text-[16px]">add</span> Create Maintenance Record
              </button>
            </div>
          </div>
        </div>

        {/* Resolution Status */}
        {isResolved && (
          <div className={`rounded-2xl border p-4 ${
            claim.status === 'Paid' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' :
            claim.status === 'Waived' ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' :
            'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[20px] ${
                claim.status === 'Paid' ? 'text-emerald-600' : claim.status === 'Waived' ? 'text-amber-600' : 'text-slate-500'
              }`}>
                {claim.status === 'Paid' ? 'check_circle' : claim.status === 'Waived' ? 'do_not_disturb' : 'lock'}
              </span>
              <div>
                <p className={`text-sm font-bold ${
                  claim.status === 'Paid' ? 'text-emerald-800 dark:text-emerald-200' : 
                  claim.status === 'Waived' ? 'text-amber-800 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  Claim {claim.status === 'Paid' ? 'Paid' : claim.status === 'Waived' ? 'Waived' : 'Closed'}
                </p>
                {claim.resolved_at && <p className="text-xs text-slate-500">Resolved on {new Date(claim.resolved_at).toLocaleDateString()}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Claims</p>
          <h2 className={heading}>Customer Damage Claims</h2>
          <p className="mt-1 text-xs text-slate-500">Track and recover costs for vehicle damage caused by customers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchClaims} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10">
            <span className="material-symbols-outlined mr-1 text-[16px] align-middle">refresh</span> Refresh
          </button>
          <button onClick={openAdd} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
            <span className="material-symbols-outlined mr-1 text-[16px] align-middle">add</span> New Damage Claim
          </button>
        </div>
      </header>

      {/* How It Works */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold">How Damage Claims Work:</p>
            <ol className="mt-1 list-decimal list-inside text-xs space-y-0.5 text-blue-700 dark:text-blue-300">
              <li><strong>Create claim</strong> when you discover damage after a rental</li>
              <li><strong>Review</strong> the damage and estimate repair costs</li>
              <li><strong>Send to customer</strong> for payment</li>
              <li><strong>Mark as Paid</strong> when customer pays, or <strong>Waive</strong> if not recoverable</li>
              <li><strong>Create Maintenance</strong> record to track actual repairs (optional)</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className={`${panel} p-4`}>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-slate-500">Total Claims</p>
        </div>
        <div className={`${panel} p-4 border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10`}>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pending}</p>
          <p className="text-xs text-amber-600">Pending</p>
        </div>
        <div className={`${panel} p-4 border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-500/10`}>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.sentToCustomer}</p>
          <p className="text-xs text-purple-600">Sent to Customer</p>
        </div>
        <div className={`${panel} p-4 border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10`}>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.paid}</p>
          <p className="text-xs text-emerald-600">Paid</p>
        </div>
        <div className={`${panel} p-4 border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10`}>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">NPR {stats.totalAmount.toLocaleString()}</p>
          <p className="text-xs text-rose-600">Total Claimed</p>
        </div>
        <div className={`${panel} p-4 border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10`}>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">NPR {stats.collectedAmount.toLocaleString()}</p>
          <p className="text-xs text-emerald-600">Collected</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className={`${panel} flex flex-wrap items-center gap-3 p-3`}>
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input type="text" className={`${inp} pl-10`} placeholder="Search claims, customers, vehicles..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inp} w-auto min-w-[150px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Claims Table */}
      <div className={`${panel} overflow-hidden`}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-rose-500 border-t-transparent"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">car_crash</span>
            <p className="text-slate-500">No damage claims found</p>
            <button onClick={openAdd} className="mt-3 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white">Report Damage</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Claim #</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((claim: any) => (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => openDetail(claim)}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-rose-600">{claim.claim_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {claim.vehicles?.primary_image_url && (
                          <img src={claim.vehicles.primary_image_url} alt="" className="h-8 w-12 rounded object-cover" />
                        )}
                        <div>
                          <p className="font-medium">{claim.vehicles?.name || '—'}</p>
                          <p className="text-xs text-slate-500">{claim.vehicles?.vehicle_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{claim.customer_name || '—'}</p>
                      <p className="text-xs text-slate-500">{claim.customer_email || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[claim.status]}`}>
                        {STATUS_LABELS[claim.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-rose-600">NPR {Number(claim.total_damage_cost).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {claim.damage_date || new Date(claim.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openDetail(claim)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-100 dark:border-white/10">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
