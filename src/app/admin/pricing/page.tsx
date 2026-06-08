'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';

const emptyPromo = { code: '', discount_type: 'percent', discount_percent: '', discount_amount: '', valid_from: '', valid_until: '', is_active: true };

// A promo is expired if its valid_until date is before today
const isExpired = (p: any) => {
  if (!p.valid_until) return false;
  const end = new Date(p.valid_until);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
};

// Effective status shown to the admin
const promoStatus = (p: any) => {
  if (isExpired(p)) return { label: 'Expired', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' };
  if (!p.is_active) return { label: 'Inactive', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300' };
  return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' };
};

export default function AdminPricing() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState<any>(emptyPromo);
  const [saving, setSaving] = useState(false);

  const refreshPromos = async () => {
    const { data } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    setPromos(data || []);
  };

  useEffect(() => {
    (async () => {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from('vehicles').select('id, name, category, price_per_day').order('name'),
        supabase.from('discount_codes').select('*').order('created_at', { ascending: false }),
      ]);
      setVehicles(v || []);
      setPromos(p || []);
      setLoading(false);
    })();
  }, []);

  // Auto-deactivate expired promos in the database (one-time per load)
  useEffect(() => {
    const expiredActive = promos.filter((p) => p.is_active && isExpired(p));
    if (expiredActive.length > 0) {
      (async () => {
        for (const p of expiredActive) {
          await supabase.from('discount_codes').update({ is_active: false }).eq('id', p.id);
        }
        refreshPromos();
      })();
    }
  }, [promos]);

  const openCreate = () => {
    setEditingId(null);
    setPromoForm(emptyPromo);
    setShowPromoForm(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setPromoForm({
      code: p.code || '',
      discount_type: p.discount_type || 'percent',
      discount_percent: p.discount_percent ?? '',
      discount_amount: p.discount_amount ?? '',
      valid_from: p.valid_from || '',
      valid_until: p.valid_until || '',
      is_active: p.is_active ?? true,
    });
    setShowPromoForm(true);
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: promoForm.code.toUpperCase().trim(),
        discount_type: promoForm.discount_type,
        discount_percent: promoForm.discount_type === 'percent' ? Number(promoForm.discount_percent) : 0,
        discount_amount: promoForm.discount_type === 'npr_amount' ? Number(promoForm.discount_amount) : 0,
        valid_from: promoForm.valid_from || null,
        valid_until: promoForm.valid_until || null,
        is_active: promoForm.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from('discount_codes').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Promo code updated!');
      } else {
        const { error } = await supabase.from('discount_codes').insert(payload);
        if (error) throw error;
        toast.success('Promo code created!');
      }
      await refreshPromos();
      setPromoForm(emptyPromo);
      setEditingId(null);
      setShowPromoForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save promo code');
    } finally { setSaving(false); }
  };

  const handleDeletePromo = async (p: any) => {
    if (!confirm(`Delete promo code "${p.code}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('discount_codes').delete().eq('id', p.id);
      if (error) throw error;
      await refreshPromos();
      toast.success('Promo code deleted.');
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const toggleActive = async (p: any) => {
    if (isExpired(p)) { toast.warning('This promo has expired. Update its "Valid Until" date to reactivate.'); return; }
    try {
      const { error } = await supabase.from('discount_codes').update({ is_active: !p.is_active }).eq('id', p.id);
      if (error) throw error;
      await refreshPromos();
      toast.success(`Promo ${!p.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Finance</p><h2 className={heading}>Pricing & Promos</h2></div>
        <button onClick={openCreate} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">+ Create Promo</button>
      </header>

      <section className={`${panel} p-4 sm:p-5`}>
        <h3 className="mb-3 text-base font-extrabold">Vehicle Pricing</h3>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {vehicles.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-100 bg-white/70 p-3 dark:border-white/5 dark:bg-white/5">
                <p className="text-sm font-bold">{v.name}</p>
                <p className="text-xs text-slate-500">{v.category}</p>
                <p className="mt-2 text-lg font-extrabold text-[#1f7668]">NPR {Number(v.price_per_day || 0).toLocaleString()}<span className="text-xs font-semibold text-slate-400">/day</span></p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`${panel} overflow-hidden`}>
        <div className="p-4 sm:p-5"><h3 className="text-base font-extrabold">Promo Codes</h3></div>
        {promos.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No promo codes yet.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Code</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Discount</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Valid Period</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr></thead>
              <tbody>{promos.map((p) => {
                const st = promoStatus(p);
                return (
                <tr key={p.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="px-4 py-3 font-mono font-bold">{p.code}</td>
                  <td className="px-4 py-3 font-semibold">
                    {p.discount_type === 'npr_amount' ? `NPR ${Number(p.discount_amount || 0).toLocaleString()}` : `${p.discount_percent}%`}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.valid_from || '—'} → {p.valid_until || 'No expiry'}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleActive(p)} title={p.is_active ? 'Deactivate' : 'Activate'}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => openEdit(p)} title="Edit"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-[#1f7668] transition hover:bg-[#1f7668]/10 dark:border-white/10">
                        Edit
                      </button>
                      <button onClick={() => handleDeletePromo(p)} title="Delete"
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {showPromoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPromoForm(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1a2228]">
            <h3 className="mb-4 text-lg font-extrabold">{editingId ? 'Edit Promo Code' : 'Create Promo Code'}</h3>
            <form onSubmit={handleSavePromo} className="space-y-3">
              <label className="block"><span className="text-xs font-semibold">Code</span><input value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-white" required /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-semibold">Discount Type</span>
                  <select value={promoForm.discount_type} onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-white">
                    <option value="percent">Percentage (%)</option>
                    <option value="npr_amount">Fixed Amount (NPR)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">{promoForm.discount_type === 'percent' ? 'Discount %' : 'Amount (NPR)'}</span>
                  <input 
                    type="number" 
                    value={promoForm.discount_type === 'percent' ? promoForm.discount_percent : promoForm.discount_amount} 
                    onChange={(e) => setPromoForm({ ...promoForm, [promoForm.discount_type === 'percent' ? 'discount_percent' : 'discount_amount']: e.target.value })} 
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-white" 
                    required 
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-semibold">Valid From</span><input type="date" value={promoForm.valid_from} onChange={(e) => setPromoForm({ ...promoForm, valid_from: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
                <label className="block"><span className="text-xs font-semibold">Valid Until</span><input type="date" value={promoForm.valid_until} onChange={(e) => setPromoForm({ ...promoForm, valid_until: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={promoForm.is_active} onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-[#1f7668]" />
                Active
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[#1f7668] py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : (editingId ? 'Update' : 'Create')}</button>
                <button type="button" onClick={() => setShowPromoForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
