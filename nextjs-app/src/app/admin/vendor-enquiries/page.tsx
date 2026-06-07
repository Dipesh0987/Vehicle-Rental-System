'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
const fmtNpr = (v: number) => `NPR ${Number(v || 0).toLocaleString()}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

const statusCls = (s: string) => {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (s === 'approved') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (s === 'pending') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (s === 'rejected') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  return `${base} bg-slate-100 text-slate-600`;
};

const serviceLabel = (s: string) => {
  if (s === 'self_drive') return 'Self-Drive';
  if (s === 'with_driver') return 'With Driver';
  if (s === 'both') return 'Both';
  return s;
};

const Field = ({ label, value }: { label: string, value: string }) => (
  <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '-'}</p>
  </article>
);

export default function AdminVendorEnquiries() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const perPage = 10;

  const fetch_ = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vendor_enquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Fetch error:', error);
    setEnquiries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const filtered = useMemo(() => {
    return enquiries.filter((e: any) => {
      const q = search.toLowerCase();
      const matchQ = !q || [e.full_name, e.business_name, e.email, e.phone, e.city].some(f => String(f || '').toLowerCase().includes(q));
      const matchStatus = !statusFilter || e.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [enquiries, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const pendingCount = enquiries.filter(e => e.status === 'pending').length;
  const approvedCount = enquiries.filter(e => e.status === 'approved').length;
  const rejectedCount = enquiries.filter(e => e.status === 'rejected').length;

  const clearFilters = () => { setStatusFilter(''); setSearch(''); setPage(1); };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this vendor enquiry?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('vendor_enquiries').update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      await fetch_();
      if (detail?.id === id) {
        const updated = enquiries.find(e => e.id === id);
        if (updated) setDetail({ ...updated, status: 'approved' });
      }
      alert('Vendor enquiry approved!');
    } catch (err: any) {
      alert('Failed to approve: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('vendor_enquiries').update({
        status: 'rejected',
        rejection_reason: rejectReason || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      setShowReject(false);
      setRejectReason('');
      await fetch_();
      if (detail?.id === id) {
        const updated = enquiries.find(e => e.id === id);
        if (updated) setDetail({ ...updated, status: 'rejected', rejection_reason: rejectReason });
      }
      alert('Vendor enquiry rejected.');
    } catch (err: any) {
      alert('Failed to reject: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this enquiry permanently?')) return;
    await supabase.from('vendor_enquiries').delete().eq('id', id);
    if (detail?.id === id) setDetail(null);
    await fetch_();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* Detail View */
  if (detail) {
    const e = detail;
    return (
      <div className="space-y-4">
        <div className={`${panel} p-4 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setDetail(null)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined text-[16px]">west</span> Back to List
            </button>
            <span className={statusCls(e.status)}>{e.status.charAt(0).toUpperCase() + e.status.slice(1)}</span>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Vendor Enquiry</p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">{e.business_name}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{e.full_name} • {e.city}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Submitted</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtDateTime(e.created_at)}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Full Name" value={e.full_name} />
              <Field label="Business Name" value={e.business_name} />
              <Field label="Email" value={e.email} />
              <Field label="Phone" value={e.phone} />
              <Field label="City / Location" value={e.city} />
              <Field label="Fleet Size" value={`${e.fleet_count} cars`} />
              <Field label="Service Type" value={serviceLabel(e.service_type)} />
              <Field label="Price Range" value={`${fmtNpr(e.price_min)} - ${fmtNpr(e.price_max)}`} />
              <Field label="Terms Accepted" value={e.terms_accepted ? 'Yes' : 'No'} />
            </div>

            {e.description && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-2">Description</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{e.description}</p>
              </div>
            )}

            {/* Car Images */}
            {e.car_images && e.car_images.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Car Images ({e.car_images.length})</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {e.car_images.map((img: string, idx: number) => (
                    <button key={idx} onClick={() => setImageModal(img)} className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#1f7668] transition">
                      <img src={img} alt={`Car ${idx + 1}`} className="w-full h-24 object-cover transition group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                        <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition">zoom_in</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {e.rejection_reason && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">Rejection Reason</p>
                <p className="text-sm text-rose-700 dark:text-rose-300">{e.rejection_reason}</p>
              </div>
            )}

            {/* Action Buttons */}
            {e.status === 'pending' && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => handleApprove(e.id)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Approve Vendor
                </button>
                <button onClick={() => setShowReject(true)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Reject
                </button>
              </div>
            )}

            {/* Reject Modal */}
            {showReject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#182226]">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Reject Vendor Enquiry</h3>
                  <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (optional)" rows={4} className={inp + ' resize-none'} />
                  <div className="mt-4 flex justify-end gap-3">
                    <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200">Cancel</button>
                    <button onClick={() => handleReject(e.id)} disabled={saving} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Reject</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image Modal */}
        {imageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setImageModal(null)}>
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={imageModal} alt="Car" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
              <button onClick={() => setImageModal(null)} className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-100">
                <span className="material-symbols-outlined text-slate-700">close</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* List View */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`${panel} p-4 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className={heading}>Vendor Enquiries</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manage vendor partnership applications</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-1.5 dark:bg-amber-500/20">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">pending</span>
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{pendingCount} Pending</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-1.5 dark:bg-emerald-500/20">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{approvedCount} Approved</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, phone, city..." className={inp + ' pl-10'} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inp + ' w-[150px]'}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          {(search || statusFilter) && (
            <button onClick={clearFilters} className="text-sm font-semibold text-[#1f7668] hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={`${panel} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Vendor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Contact</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">City</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Fleet</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Service</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Price Range</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Submitted</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No vendor enquiries found
                  </td>
                </tr>
              ) : (
                paged.map((e: any) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/5 transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{e.business_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{e.full_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 dark:text-slate-200">{e.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{e.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{e.city}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{e.fleet_count} cars</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{serviceLabel(e.service_type)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {fmtNpr(e.price_min)} - {fmtNpr(e.price_max)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusCls(e.status)}>{e.status.charAt(0).toUpperCase() + e.status.slice(1)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setDetail(e)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" title="View">
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        {e.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(e.id)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Approve">
                              <span className="material-symbols-outlined text-[18px]">check</span>
                            </button>
                            <button onClick={() => { setDetail(e); setShowReject(true); }} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Reject">
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/10" title="Delete">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
                Prev
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
