'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

export default function AdminFleet() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'ontrip'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [onTripVehicles, setOnTripVehicles] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [showTripModal, setShowTripModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    processVehicles();
  }, [vehicles, bookings, filterDateFrom, filterDateTo]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: vehData } = await supabase.from('vehicles').select('*, vehicle_images(*)').order('name');
    const { data: bookData, error: bookError } = await supabase.from('bookings').select('*').order('start_date');
    
    if (bookError) {
      console.error('Bookings fetch error:', bookError);
    }
    
    setVehicles(vehData || []);
    
    const activeBookings = (bookData || []).filter((b: any) => 
      b.status === 'confirmed' || b.status === 'active'
    );
    
    setBookings(activeBookings);
    setLoading(false);
  };

  const processVehicles = () => {
    const fromDateStr = filterDateFrom;
    const toDateStr = filterDateTo;
    const bookedVehicleIds = new Set<string>();
    const currentTrips: any[] = [];
    
    bookings.forEach((b: any) => {
      const startDateStr = b.start_date ? b.start_date.split('T')[0] : '';
      const endDateStr = b.end_date ? b.end_date.split('T')[0] : '';
      
      const isActiveStatus = b.status === 'active';
      const isConfirmedStatus = b.status === 'confirmed';
      
      // Check if booking overlaps with the filter date range
      const dateOverlaps = startDateStr <= toDateStr && endDateStr >= fromDateStr;
      
      const isOnTrip = isActiveStatus || (isConfirmedStatus && dateOverlaps);
      
      if (isOnTrip) {
        bookedVehicleIds.add(b.vehicle_id);
        const vehicle = vehicles.find((v: any) => v.id === b.vehicle_id);
        currentTrips.push({ ...b, vehicles: vehicle || null });
      }
    });
    
    const available = vehicles.filter((v: any) => 
      !bookedVehicleIds.has(v.id) && 
      v.status === 'available' &&
      v.is_active !== false
    );
    
    setAvailableVehicles(available);
    setOnTripVehicles(currentTrips);
  };

  const statusDot = (s: string) => {
    const c: Record<string, string> = { available: 'bg-emerald-500', maintenance: 'bg-amber-500', unavailable: 'bg-slate-400', inactive: 'bg-rose-500', booked: 'bg-blue-500' };
    return c[s] || 'bg-slate-400';
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';

  const groups = vehicles.reduce((acc: Record<string, any[]>, v: any) => {
    const cat = v.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Operations</p><h2 className={heading}>Live Fleet & Availability</h2></div>
        <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <span className="mr-1 inline-block h-2 w-2 animate-pulseDot rounded-full bg-emerald-500"></span> Live tracking
        </div>
      </header>

      <section className={`${panel} p-4`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date From</label>
            <input 
              type="date" 
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                if (e.target.value > filterDateTo) setFilterDateTo(e.target.value);
              }}
              className={inp}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date To</label>
            <input 
              type="date" 
              value={filterDateTo}
              min={filterDateFrom}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className={inp}
            />
          </div>
          <div className="flex items-end gap-2">
            <button 
              onClick={() => setActiveTab('all')}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === 'all' ? 'bg-[#1f7668] text-white' : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'}`}
            >
              All ({vehicles.length})
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button 
              onClick={() => setActiveTab('available')}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === 'available' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'}`}
            >
              Available ({availableVehicles.length})
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button 
              onClick={() => setActiveTab('ontrip')}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === 'ontrip' ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'}`}
            >
              On-Trip ({onTripVehicles.length})
            </button>
          </div>
        </div>
      </section>

      {activeTab === 'ontrip' && (
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold">
                <span className="material-symbols-outlined text-blue-500 align-middle mr-1">directions_car</span>
                On-Trip Vehicles
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Showing: All <span className="font-semibold text-blue-600">Active</span> bookings + <span className="font-semibold text-emerald-600">Confirmed</span> from {fmtDate(filterDateFrom)} to {fmtDate(filterDateTo)}
              </p>
            </div>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {onTripVehicles.length} On-Trip
            </span>
          </div>
          
          {onTripVehicles.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-white/5">
              <span className="material-symbols-outlined text-4xl text-slate-400">local_taxi</span>
              <p className="mt-2 text-sm text-slate-500">No vehicles on trip for selected date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="pb-2 pr-3">Vehicle</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3">Trip Dates</th>
                    <th className="pb-2 pr-3">Return Date</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Payment</th>
                    <th className="pb-2 pr-3">Contact</th>
                    <th className="pb-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {onTripVehicles.map((trip: any) => (
                    <tr 
                      key={trip.id} 
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
                      onClick={() => { setSelectedTrip(trip); setShowTripModal(true); }}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          {trip.vehicles?.primary_image_url && (
                            <img src={trip.vehicles.primary_image_url} alt="" className="h-10 w-14 rounded-lg object-cover" />
                          )}
                          <div>
                            <p className="font-bold">{trip.vehicles?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{trip.vehicles?.vehicle_number || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{trip.customer_name || 'N/A'}</p>
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-white/10">{fmtDate(trip.start_date)}</span>
                        <span className="mx-1">→</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-white/10">{fmtDate(trip.end_date)}</span>
                      </td>
                      <td className="py-3 pr-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {trip.end_date === filterDateFrom || trip.end_date === filterDateTo ? 'Returning Today' : fmtDate(trip.end_date)}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${trip.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                          {trip.status === 'active' ? 'On Trip' : 'Confirmed'}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        {(() => {
                          const total = Number(trip.total_amount || 0);
                          const paid = Number(trip.paid_amount || 0);
                          const remaining = total - paid;
                          const isFullyPaid = remaining <= 0;
                          
                          return (
                            <div className="text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500">Total:</span>
                                <span className="font-semibold">NPR {total.toLocaleString()}</span>
                              </div>
                              {isFullyPaid ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                  <span className="material-symbols-outlined text-[10px] mr-0.5">check_circle</span>
                                  Paid
                                </span>
                              ) : (
                                <div className="mt-1">
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                    <span className="material-symbols-outlined text-[10px] mr-0.5">schedule</span>
                                    Due: NPR {remaining.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        <p>{trip.customer_phone || '—'}</p>
                        <p className="text-slate-500">{trip.customer_email || '—'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <button 
                          className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                          onClick={(e) => { e.stopPropagation(); setSelectedTrip(trip); setShowTripModal(true); }}
                        >
                          <span className="material-symbols-outlined text-[14px] align-middle">visibility</span> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showTripModal && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                <span className="material-symbols-outlined text-blue-500 align-middle mr-1">info</span>
                Trip Details
              </h3>
              <button 
                onClick={() => setShowTripModal(false)}
                className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Vehicle Information</h4>
                <div className="flex items-start gap-3">
                  {selectedTrip.vehicles?.primary_image_url && (
                    <img 
                      src={selectedTrip.vehicles.primary_image_url} 
                      alt={selectedTrip.vehicles.name}
                      className="h-20 w-28 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="text-lg font-bold">{selectedTrip.vehicles?.name || 'Unknown Vehicle'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{selectedTrip.vehicles?.vehicle_number || '—'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{selectedTrip.vehicles?.category || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Customer Information</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Full Name</p>
                    <p className="font-semibold">{selectedTrip.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="font-semibold">{selectedTrip.customer_phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="font-semibold">{selectedTrip.customer_email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="font-semibold">{selectedTrip.customer_address || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Trip Dates</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1 rounded-lg bg-white p-3 text-center shadow-sm dark:bg-slate-800">
                    <p className="text-xs text-slate-500">Start Date</p>
                    <p className="text-lg font-bold text-[#1f7668]">{fmtDate(selectedTrip.start_date)}</p>
                    <p className="text-xs text-slate-400">{new Date(selectedTrip.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-slate-400">arrow_forward</span>
                  <div className="flex-1 rounded-lg bg-white p-3 text-center shadow-sm dark:bg-slate-800">
                    <p className="text-xs text-slate-500">End Date</p>
                    <p className="text-lg font-bold text-blue-600">{fmtDate(selectedTrip.end_date)}</p>
                    <p className="text-xs text-slate-400">{new Date(selectedTrip.end_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedTrip.status === 'active' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' 
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  }`}>
                    {selectedTrip.status === 'active' ? 'Currently On Trip' : 'Confirmed Upcoming Trip'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Payment Details</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Total Amount</p>
                    <p className="font-bold text-lg">NPR {Number(selectedTrip.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Paid Amount</p>
                    <p className="font-bold text-lg text-emerald-600">NPR {Number(selectedTrip.paid_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Remaining</p>
                    <p className="font-bold text-lg text-amber-600">NPR {Number((selectedTrip.total_amount || 0) - (selectedTrip.paid_amount || 0)).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Payment Status</p>
                    <p className={`font-semibold ${selectedTrip.is_paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {selectedTrip.is_paid ? 'Paid' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Trip Options</h4>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">person</span>
                    <span className="font-semibold">
                      {String(selectedTrip.driver_option || 'self_drive').includes('with') ? 'With Driver' : 'Self Drive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">location_on</span>
                    <span className="font-semibold">{selectedTrip.pickup_location || 'Main Office'}</span>
                  </div>
                </div>
              </div>

              {selectedTrip.notes && (
                <div className="rounded-xl border border-slate-200 bg-amber-50 p-4 dark:border-white/10 dark:bg-amber-500/10">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600">Special Notes</h4>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{selectedTrip.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowTripModal(false)}
                className="rounded-xl bg-[#1f7668] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'available' && (
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-extrabold">
              <span className="material-symbols-outlined text-emerald-500 align-middle mr-1">check_circle</span>
              Available Vehicles ({fmtDate(filterDateFrom)} - {fmtDate(filterDateTo)})
            </h3>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              {availableVehicles.length} Available
            </span>
          </div>
          
          {availableVehicles.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-white/5">
              <span className="material-symbols-outlined text-4xl text-slate-400">block</span>
              <p className="mt-2 text-sm text-slate-500">No vehicles available for selected date</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {availableVehicles.map((v: any) => (
                <div key={v.id} className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start gap-3">
                    {v.primary_image_url || (v.vehicle_images && v.vehicle_images[0]?.url) ? (
                      <img 
                        src={v.primary_image_url || v.vehicle_images[0]?.url} 
                        alt={v.name}
                        className="h-16 w-24 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10">
                        <span className="material-symbols-outlined text-slate-400">directions_car</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{v.name}</p>
                      <p className="text-xs text-slate-500">{v.vehicle_number}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${statusDot(v.status)}`}></span>
                        <span className="text-xs font-semibold capitalize">{v.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{v.category || '—'}</span>
                    <span className="font-semibold text-[#1f7668]">NPR {Number(v.price_per_day || 0).toLocaleString()}/day</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'all' && (
        <>
          {loading ? <div className="text-center text-sm text-slate-400 py-8">Loading fleet data…</div> : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Object.entries(groups).map(([cat, vehs]) => (
                <section key={cat} className={`${panel} p-4`}>
                  <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{cat} <span className="text-xs font-bold text-slate-400">({vehs.length})</span></h3>
                  <ul className="space-y-2">
                    {vehs.map((v: any) => (
                      <li key={v.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/70 p-3 dark:border-white/5 dark:bg-white/5">
                        <div className="flex items-center gap-2">
                          {v.primary_image_url && (
                            <img src={v.primary_image_url} alt="" className="h-10 w-14 rounded-lg object-cover" />
                          )}
                          <div>
                            <p className="text-sm font-bold">{v.name}</p>
                            <p className="text-xs text-slate-500">{v.vehicle_number} • {v.location || 'Unknown location'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusDot(v.status)}`}></span>
                          <span className="text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">{v.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
