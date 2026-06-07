import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f7668] focus:ring-2 focus:ring-[#1f7668]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

const STATUS_OPTIONS = ['pending', 'reviewed', 'sent_to_customer', 'paid', 'disputed', 'waived', 'closed'];
const STATUS_LABELS = {
  pending: 'Pending Review',
  reviewed: 'Reviewed',
  sent_to_customer: 'Sent to Customer',
  paid: 'Paid',
  disputed: 'Disputed',
  waived: 'Waived',
  closed: 'Closed'
};
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  sent_to_customer: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  disputed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  waived: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  closed: 'bg-slate-200 text-slate-600 dark:bg-slate-600/20 dark:text-slate-400'
};

export default function DamageClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimItems, setClaimItems] = useState([]);
  const [mode, setMode] = useState('list'); // 'list', 'detail'
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('damage_claims')
      .select(`
        *,
        vehicles(name, vehicle_number, primary_image_url),
        vehicle_bookings(booking_id, start_date, end_date)
      `)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching claims:', error);
    setClaims(data || []);
    setLoading(false);
  };

  const fetchClaimDetails = async (claim) => {
    const { data: items } = await supabase
      .from('damage_claim_items')
      .select('*')
      .eq('claim_id', claim.id)
      .order('created_at');
    
    setClaimItems(items || []);
    setSelectedClaim(claim);
    setMode('detail');
  };

  const updateClaimStatus = async (claimId, newStatus) => {
    setSaving(true);
    try {
      const updates = { status: newStatus };
      if (['paid', 'waived', 'closed'].includes(newStatus)) {
        updates.resolved_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('damage_claims')
        .update(updates)
        .eq('id', claimId);
      
      if (error) throw error;
      
      await fetchClaims();
      if (selectedClaim?.id === claimId) {
        setSelectedClaim(prev => ({ ...prev, ...updates }));
      }
      alert('Status updated successfully!');
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminNotes = async (claimId, notes) => {
    const { error } = await supabase
      .from('damage_claims')
      .update({ admin_notes: notes })
      .eq('id', claimId);
    
    if (error) {
      alert('Failed to save notes: ' + error.message);
    }
  };

  const sendClaimToCustomer = async (claim) => {
    // In a real app, this would send an email
    const subject = `Damage Claim #${claim.claim_number} - Self Car Rental`;
    const body = `Dear ${claim.customer_name},\n\nWe have identified damage to the vehicle during your recent rental.\n\nClaim Number: ${claim.claim_number}\nVehicle: ${claim.vehicles?.name}\nTotal Amount: NPR ${Number(claim.total_damage_cost).toLocaleString()}\n\nPlease contact us to resolve this matter.\n\nBest regards,\nSelf Car Rental`;
    
    // Open email client
    window.open(`mailto:${claim.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    
    // Update status
    await updateClaimStatus(claim.id, 'sent_to_customer');
  };

  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      const matchesSearch = !search || 
        c.claim_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.vehicles?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.vehicles?.vehicle_number?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [claims, search, statusFilter]);

  const stats = useMemo(() => {
    const s = { total: claims.length, pending: 0, open: 0, resolved: 0, totalAmount: 0, collectedAmount: 0 };
    claims.forEach(c => {
      s.totalAmount += Number(c.total_damage_cost || 0);
      if (c.status === 'pending') s.pending++;
      else if (['reviewed', 'sent_to_customer', 'disputed'].includes(c.status)) s.open++;
      else if (['paid', 'waived', 'closed'].includes(c.status)) {
        s.resolved++;
        if (c.status === 'paid') s.collectedAmount += Number(c.total_damage_cost || 0);
      }
    });
    return s;
  }, [claims]);

  // Detail View
  if (mode === 'detail' && selectedClaim) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setMode('list'); setSelectedClaim(null); }}
            className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h2 className={heading}>Damage Claim #{selectedClaim.claim_number}</h2>
            <p className="text-sm text-slate-500">Created {new Date(selectedClaim.created_at).toLocaleDateString()}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[selectedClaim.status]}`}>
            {STATUS_LABELS[selectedClaim.status]}
          </span>
        </div>

        {/* Claim Info */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Customer Info */}
          <div className={`${panel} p-4`}>
            <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Customer Information</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Name:</span> <strong>{selectedClaim.customer_name || '-'}</strong></p>
              <p><span className="text-slate-500">Email:</span> <strong>{selectedClaim.customer_email || '-'}</strong></p>
              <p><span className="text-slate-500">Phone:</span> <strong>{selectedClaim.customer_phone || '-'}</strong></p>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className={`${panel} p-4`}>
            <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Vehicle Information</h3>
            <div className="flex items-center gap-3">
              {selectedClaim.vehicles?.primary_image_url && (
                <img src={selectedClaim.vehicles.primary_image_url} alt="" className="h-16 w-24 rounded-lg object-cover" />
              )}
              <div className="text-sm">
                <p className="font-semibold">{selectedClaim.vehicles?.name}</p>
                <p className="text-slate-500">{selectedClaim.vehicles?.vehicle_number}</p>
                <p className="text-slate-500">Booking: {selectedClaim.vehicle_bookings?.booking_id}</p>
              </div>
            </div>
          </div>

          {/* Claim Summary */}
          <div className={`${panel} p-4`}>
            <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Claim Summary</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Total Damage Cost:</span></p>
              <p className="text-2xl font-bold text-rose-600">NPR {Number(selectedClaim.total_damage_cost).toLocaleString()}</p>
              <p><span className="text-slate-500">Items:</span> <strong>{claimItems.length} damaged parts</strong></p>
            </div>
          </div>
        </div>

        {/* Damaged Parts */}
        <div className={`${panel} p-4`}>
          <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Damaged Parts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="px-3 py-2 text-left font-semibold">Part</th>
                  <th className="px-3 py-2 text-left font-semibold">Before</th>
                  <th className="px-3 py-2 text-left font-semibold">After</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {claimItems.map(item => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium">{item.part_name}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        {item.before_condition?.replace('_', ' ') || 'Good'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                        {item.after_condition?.replace('_', ' ') || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.damage_description || '-'}</td>
                    <td className="px-3 py-2 text-right font-semibold">{Number(item.repair_cost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-white/20">
                  <td colSpan={4} className="px-3 py-2 text-right font-bold">Total:</td>
                  <td className="px-3 py-2 text-right text-lg font-bold text-rose-600">
                    NPR {Number(selectedClaim.total_damage_cost).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Admin Notes */}
        <div className={`${panel} p-4`}>
          <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Admin Notes</h3>
          <textarea
            className={inp}
            rows={3}
            defaultValue={selectedClaim.admin_notes || ''}
            onBlur={(e) => updateAdminNotes(selectedClaim.id, e.target.value)}
            placeholder="Add internal notes about this claim..."
          />
        </div>

        {/* Customer Response */}
        {selectedClaim.customer_response && (
          <div className={`${panel} border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10`}>
            <h3 className="mb-2 font-semibold text-blue-700 dark:text-blue-300">Customer Response</h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">{selectedClaim.customer_response}</p>
          </div>
        )}

        {/* Actions */}
        <div className={`${panel} p-4`}>
          <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {selectedClaim.status === 'pending' && (
              <button
                onClick={() => updateClaimStatus(selectedClaim.id, 'reviewed')}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check</span> Mark as Reviewed
              </button>
            )}
            
            {['pending', 'reviewed'].includes(selectedClaim.status) && (
              <button
                onClick={() => sendClaimToCustomer(selectedClaim)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">mail</span> Send to Customer
              </button>
            )}
            
            {!['paid', 'waived', 'closed'].includes(selectedClaim.status) && (
              <>
                <button
                  onClick={() => updateClaimStatus(selectedClaim.id, 'paid')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">payments</span> Mark as Paid
                </button>
                
                <button
                  onClick={() => updateClaimStatus(selectedClaim.id, 'waived')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-500 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">do_not_disturb</span> Waive Claim
                </button>
                
                <button
                  onClick={() => updateClaimStatus(selectedClaim.id, 'disputed')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">gavel</span> Mark Disputed
                </button>
              </>
            )}
            
            {selectedClaim.status !== 'closed' && (
              <button
                onClick={() => updateClaimStatus(selectedClaim.id, 'closed')}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
              >
                <span className="material-symbols-outlined text-[16px]">close</span> Close Claim
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Claims</p>
          <h2 className={heading}>Damage Claims</h2>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className={`${panel} p-4`}>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-slate-500">Total Claims</p>
        </div>
        <div className={`${panel} border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10`}>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pending}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">Pending Review</p>
        </div>
        <div className={`${panel} border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10`}>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.open}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Open Claims</p>
        </div>
        <div className={`${panel} border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10`}>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.resolved}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Resolved</p>
        </div>
        <div className={`${panel} border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10`}>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">NPR {stats.totalAmount.toLocaleString()}</p>
          <p className="text-xs text-rose-600 dark:text-rose-400">Total Damages</p>
        </div>
      </div>

      {/* Filters */}
      <div className={`${panel} flex flex-wrap items-center gap-3 p-3`}>
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            type="text"
            className={`${inp} pl-10`}
            placeholder="Search claims, customers, vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`${inp} w-auto`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Claims List */}
      <div className={`${panel} overflow-hidden`}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1f7668] border-t-transparent"></div>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <span className="material-symbols-outlined mb-2 text-4xl">folder_off</span>
            <p>No damage claims found</p>
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
                {filteredClaims.map(claim => (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-[#1f7668]">{claim.claim_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {claim.vehicles?.primary_image_url && (
                          <img src={claim.vehicles.primary_image_url} alt="" className="h-8 w-12 rounded object-cover" />
                        )}
                        <div>
                          <p className="font-medium">{claim.vehicles?.name}</p>
                          <p className="text-xs text-slate-500">{claim.vehicles?.vehicle_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{claim.customer_name || '-'}</p>
                      <p className="text-xs text-slate-500">{claim.customer_email}</p>
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
                      {new Date(claim.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => fetchClaimDetails(claim)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-100 dark:border-white/10"
                      >
                        View Details
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
