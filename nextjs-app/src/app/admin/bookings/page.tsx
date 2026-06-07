'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Invoice from '@/components/Invoice';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const STATUS_OPTIONS = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
const TYPE_OPTIONS = ['', 'Sedan', 'SUV', 'Hatchback', 'Luxury', 'Van', 'Electric'];
const PAID_OPTIONS = ['', 'Yes', 'No'];
const fmtNpr = (v: number) => `NPR ${Number(v || 0).toLocaleString()}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const fmtDt = (d: string) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

const Field = ({ label, value }: { label: string, value: string }) => (
  <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '-'}</p>
  </article>
);

const statusCls = (s: string) => {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (s === 'confirmed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (s === 'pending') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (s === 'cancelled') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (s === 'completed') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-200`;
  if (s === 'active') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-slate-100 text-slate-600`;
};

const statusSelectCls = (s: string) => {
  const base = 'w-[140px] rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition';
  if (s === 'confirmed') return `${base} border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200`;
  if (s === 'pending') return `${base} border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200`;
  if (s === 'cancelled') return `${base} border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-200`;
  if (s === 'completed') return `${base} border-slate-300 bg-slate-200 text-slate-800 dark:border-slate-400/30 dark:bg-slate-500/25 dark:text-slate-200`;
  return `${base} border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5`;
};

const paymentPill = (s: string) => {
  const base = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]';
  const k = String(s || '').toLowerCase();
  if (k === 'completed' || k === 'paid') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (k === 'partial') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (k === 'pending') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (k === 'failed' || k === 'expired') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
};

const remainingDuePill = (remaining: number) => {
  const base = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]';
  const rem = Number(remaining) || 0;
  if (rem <= 0) return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
};

function buildOccupancy(bookings: any[]) {
  const tiles: any[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    tiles.push({ weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: bookings.filter((b) => b.start_date <= iso && b.end_date >= iso && !['cancelled', 'completed'].includes(b.status)).length });
  }
  return tiles;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paidFilter, setPaidFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [paymentDetail, setPaymentDetail] = useState<any>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [billModalState, setBillModalState] = useState<{ show: boolean, booking: any }>({ show: false, booking: null });
  const [createForm, setCreateForm] = useState({
    vehicle_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    start_date: '',
    end_date: '',
    pickup_time: '10:00',
    driver_option: 'self_drive',
    pickup_location: '',
    dropoff_location: '',
    notes: '',
    payment_method: 'cash',
    paid_amount: '' as string | number,
    status: 'confirmed'
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showInspection, setShowInspection] = useState(false);
  const [inspectionType, setInspectionType] = useState('before_trip');
  const [inspectionBooking, setInspectionBooking] = useState<any>(null);
  const perPage = 8;

  const autoUpdateBookingStatus = async (bookings: any[]) => {
    const today = new Date().toISOString().split('T')[0];
    const updates: any[] = [];
    
    bookings.forEach(b => {
      if (b.status === 'cancelled') return;
      
      const startDate = b.start_date;
      const endDate = b.end_date;
      let newStatus = null;
      
      if (today >= startDate && today <= endDate && b.status !== 'active') {
        newStatus = 'active';
      } else if (today > endDate && b.status !== 'completed' && b.status !== 'cancelled') {
        newStatus = 'completed';
      }
      
      if (newStatus) {
        updates.push({ id: b.id, status: newStatus });
      }
    });
    
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase.from('bookings').update({ status: update.status }).eq('id', update.id);
      }
    }
    
    return updates.length;
  };

  const fetch_ = async (enableAutoUpdate = false) => {
    setLoading(true);
    const { data, error } = await supabase.from('bookings').select('*, vehicles(name, brand, category, vehicle_number, primary_image_url, image_url)').order('created_at', { ascending: false });
    if (error) console.error('Bookings fetch error:', error.message, error.code, error);
    
    if (enableAutoUpdate && data && data.length > 0) {
      console.log('Auto-updating booking statuses...');
      await autoUpdateBookingStatus(data);
      const { data: refreshedData } = await supabase.from('bookings').select('*, vehicles(name, brand, category, vehicle_number, primary_image_url, image_url)').order('created_at', { ascending: false });
      setBookings(refreshedData || []);
    } else {
      setBookings(data || []);
    }
    
    setLoading(false);
    return data || [];
  };

  const closeBillModal = () => {
    setBillModalState({ show: false, booking: null });
  };

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      
      console.log('Vehicles loaded:', data?.length || 0, data);
      setVehicles(data || []);
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
      alert('Failed to load vehicles: ' + (err.message || 'Unknown error'));
    } finally {
      setVehiclesLoading(false);
    }
  };
  useEffect(() => { fetch_(); }, []);
  useEffect(() => { if (showCreate) fetchVehicles(); }, [showCreate]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let userId = null;
      
      if (createForm.customer_email) {
        const { data: existingCustomer } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', createForm.customer_email)
          .eq('full_name', createForm.customer_name)
          .single();
        
        if (existingCustomer) {
          userId = existingCustomer.id;
          if (createForm.customer_phone) {
            await supabase
              .from('user_profiles')
              .update({ phone: createForm.customer_phone })
              .eq('id', existingCustomer.id);
          }
        } else {
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
              full_name: createForm.customer_name,
              email: createForm.customer_email,
              phone: createForm.customer_phone,
              verification_status: 'guest',
              role: 'customer'
            })
            .select()
            .single();
          if (newProfile) userId = newProfile.id;
        }
      }
      
      const selectedVehicle = vehicles.find((v: any) => v.id === createForm.vehicle_id);
      const days = Math.max(1, Math.ceil((Number(new Date(createForm.end_date)) - Number(new Date(createForm.start_date))) / (1000 * 60 * 60 * 24)));
      const pricePerDay = Number(selectedVehicle?.price_per_day || selectedVehicle?.pricePerDay || selectedVehicle?.price || 0);
      const base = pricePerDay * days;
      const serviceFee = Math.round(base * 0.1);
      const total = base + serviceFee;
      
      // Combine pickup/dropoff locations with notes
      const combinedNotes = [
        createForm.pickup_location ? `Pickup: ${createForm.pickup_location}` : '',
        createForm.dropoff_location ? `Dropoff: ${createForm.dropoff_location}` : '',
        createForm.notes
      ].filter(Boolean).join(' | ');
      
      const { data, error } = await supabase.from('bookings').insert({
        vehicle_id: createForm.vehicle_id,
        customer_name: createForm.customer_name,
        customer_email: createForm.customer_email,
        customer_phone: createForm.customer_phone,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        pickup_time: createForm.pickup_time,
        driver_option: createForm.driver_option,
        notes: combinedNotes,
        status: createForm.status,
        user_id: userId,
        base_amount: base,
        service_fee: serviceFee,
        total_amount: total,
        tax_amount: 0,
        discount_amount: 0,
        paid_amount: Number(createForm.paid_amount || 0),
        is_paid: Number(createForm.paid_amount || 0) >= total,
        remaining_amount: total - Number(createForm.paid_amount || 0),
        payment_status: Number(createForm.paid_amount || 0) >= total ? 'completed' : 'partial'
      }).select().single();
      
      if (error) throw error;
      
      if (Number(createForm.paid_amount || 0) > 0) {
        await supabase.from('payments').insert({
          booking_id: data.id,
          customer_name: createForm.customer_name,
          customer_email: createForm.customer_email,
          payment_method: createForm.payment_method,
          amount: Number(createForm.paid_amount || 0),
          total_booking_amount: total,
          currency: 'NPR',
          status: Number(createForm.paid_amount || 0) >= total ? 'completed' : 'partial',
          method: createForm.payment_method
        });
      }
      
      setShowCreate(false);
      setCreateForm({
        vehicle_id: '', customer_name: '', customer_email: '', customer_phone: '',
        start_date: '', end_date: '', pickup_time: '10:00', driver_option: 'self_drive',
        pickup_location: '', dropoff_location: '', notes: '', payment_method: 'cash', paid_amount: '' as string | number, status: 'confirmed'
      });
      setVehicleSearch('');
      await fetch_();
      alert('Manual booking created successfully!');
    } catch (err: any) {
      alert('Failed to create booking: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeBookings = useMemo(() => bookings.filter((b: any) => b.status !== 'cancelled'), [bookings]);
  
  const filtered = useMemo(() => {
    return activeBookings.filter((b: any) => {
      const q = search.toLowerCase();
      const matchQ = !q || [b.id, b.booking_code, b.status, b.vehicles?.name, b.customer_name, b.customer_email].some((f) => String(f || '').toLowerCase().includes(q));
      const matchDate = !dateFilter || b.start_date === dateFilter || b.end_date === dateFilter;
      const matchStatus = !statusFilter || b.status === statusFilter;
      const matchType = !typeFilter || b.vehicles?.category === typeFilter;
      const matchPaid = !paidFilter || (paidFilter === 'Yes' ? b.is_paid : !b.is_paid);
      return matchQ && matchDate && matchStatus && matchType && matchPaid;
    });
  }, [activeBookings, search, dateFilter, statusFilter, typeFilter, paidFilter]);

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const q = vehicleSearch.toLowerCase();
    return vehicles.filter((v: any) => 
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.brand && v.brand.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      (v.category && v.category.toLowerCase().includes(q)) ||
      (v.vehicle_number && v.vehicle_number.toLowerCase().includes(q))
    );
  }, [vehicles, vehicleSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const activeCount = filtered.filter((b: any) => b.status === 'confirmed' || b.status === 'active').length;
  const totalRevenue = filtered.reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0);
  const hasFilters = dateFilter || statusFilter || typeFilter || paidFilter;
  const occupancy = useMemo(() => buildOccupancy(bookings), [bookings]);

  const clearFilters = () => { setDateFilter(''); setStatusFilter(''); setTypeFilter(''); setPaidFilter(''); setPage(1); };
  const updateStatus = async (id: string, status: string) => { 
    try {
      console.log(`Updating booking ${id} to status: ${status}`);
      
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id); 
      
      if (error) {
        console.error('Status update error:', error);
        alert('Failed to update status: ' + error.message);
        return;
      }
      
      console.log(`Status updated successfully for booking ${id}`);
      
      if (status === 'confirmed') { 
        const booking = bookings.find((b: any) => b.id === id); 
        if (booking) {
          try { 
            await supabase.from('invoices').insert({
              booking_id: booking.id,
              customer_name: booking.customer_name,
              total_amount: booking.total_amount,
              status: 'pending'
            });
          } catch (err) {
            console.log('Invoice creation skipped or failed:', err);
          }
        } 
      } 
      
      const fresh = await fetch_(); 
      if (detail?.id === id) {
        const updated = fresh.find((b: any) => b.id === id);
        setDetail(updated || null);
        console.log('Detail view updated:', updated?.status);
      }
      
      console.log('Status update completed and data refreshed');
    } catch (err: any) {
      console.error('Update status error:', err);
      alert('Error updating status: ' + err.message);
    }
  };
  const handleDelete = async (id: string) => { if (!confirm('Delete this booking permanently?')) return; await supabase.from('bookings').delete().eq('id', id); if (detail?.id === id) setDetail(null); await fetch_(); };

  // Parse pickup/dropoff from notes field
  const parseLocationsFromNotes = (notes: string) => {
    const pickup = notes?.match(/Pickup:\s*([^|]+)/)?.[1]?.trim() || '';
    const dropoff = notes?.match(/Dropoff:\s*([^|]+)/)?.[1]?.trim() || '';
    const otherNotes = notes?.replace(/Pickup:\s*[^|]+\s*\|?\s*/g, '').replace(/Dropoff:\s*[^|]+\s*\|?\s*/g, '').trim() || '';
    return { pickup, dropoff, otherNotes };
  };

  const openEditModal = (b: any) => {
    const { pickup, dropoff, otherNotes } = parseLocationsFromNotes(b.notes || '');
    setEditForm({
      id: b.id,
      customer_name: b.customer_name || '',
      customer_email: b.customer_email || '',
      customer_phone: b.customer_phone || '',
      start_date: b.start_date || '',
      end_date: b.end_date || '',
      pickup_time: b.pickup_time || '10:00',
      driver_option: b.driver_option || 'self_drive',
      pickup_location: pickup || b.pickup_location || '',
      dropoff_location: dropoff || '',
      notes: otherNotes,
      status: b.status || 'pending',
      paid_amount: b.paid_amount || 0
    });
    setShowEdit(true);
  };

  const handleEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    setSaving(true);
    try {
      // Combine pickup/dropoff locations with notes
      const combinedNotes = [
        editForm.pickup_location ? `Pickup: ${editForm.pickup_location}` : '',
        editForm.dropoff_location ? `Dropoff: ${editForm.dropoff_location}` : '',
        editForm.notes
      ].filter(Boolean).join(' | ');

      const paidAmount = editForm.paid_amount === '' ? 0 : Number(editForm.paid_amount) || 0;
      const totalAmount = detail?.total_amount || 0;
      const isPaid = paidAmount >= totalAmount;
      
      const { error } = await supabase.from('bookings').update({
        customer_name: editForm.customer_name,
        customer_email: editForm.customer_email,
        customer_phone: editForm.customer_phone,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        pickup_time: editForm.pickup_time,
        driver_option: editForm.driver_option,
        notes: combinedNotes,
        status: editForm.status,
        paid_amount: paidAmount,
        remaining_amount: totalAmount - paidAmount,
        is_paid: isPaid,
        payment_status: isPaid ? 'completed' : (paidAmount > 0 ? 'partial' : 'pending')
      }).eq('id', editForm.id);

      if (error) throw error;
      setShowEdit(false);
      setEditForm({});
      await fetch_();
      // Refresh detail view if open
      if (detail) {
        const { data: updatedBooking } = await supabase
          .from('bookings')
          .select('*, vehicles:vehicle_id(name, brand, category, vehicle_number, primary_image_url)')
          .eq('id', editForm.id)
          .single();
        if (updatedBooking) setDetail(updatedBooking);
      }
      alert('Booking updated successfully!');
    } catch (err: any) {
      alert('Failed to update booking: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openBillModal = (b: any) => {
    const days = b.start_date && b.end_date 
      ? Math.max(1, Math.ceil((Number(new Date(b.end_date)) - Number(new Date(b.start_date))) / 86400000)) 
      : 1;
    const ratePerDay = days > 0 ? Number(b.base_amount || b.total_amount || 0) / days : 0;
    
    // Parse pickup/dropoff from notes
    const pickupLoc = b.notes?.match(/Pickup:\s*([^|]+)/)?.[1]?.trim() || b.pickup_location || 'Kathmandu';
    const dropoffLoc = b.notes?.match(/Dropoff:\s*([^|]+)/)?.[1]?.trim() || pickupLoc;
    
    const invoiceData = {
      invoiceNumber: `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      bookingRef: b.booking_code || b.id?.slice(0, 12),
      issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      customer: {
        name: b.customer_name || '',
        contact: b.customer_phone || '',
        address: 'Kathmandu, Nepal',
        dob: '',
        license: ''
      },
      vehicle: {
        name: b.vehicles?.name || 'Vehicle',
        plateNo: b.vehicles?.vehicle_number || '',
        type: `${b.vehicles?.category || 'Sedan'} | Automatic`,
        color: 'Blue',
        seat: '5 Seater'
      },
      booking: {
        pickup: `${b.start_date} — ${b.pickup_time || '10:00 AM'} (${pickupLoc})`,
        dropoff: `${b.end_date} — 6:00 PM (${dropoffLoc})`,
        location: pickupLoc,
        purpose: 'Trip',
        driveType: b.driver_option === 'with_driver' ? 'With Driver' : 'Self Drive',
        rentalType: 'Inside Valley'
      },
      lineItems: [
        { description: `${b.vehicles?.name || 'Vehicle'} Rental`, qty: `${days} Days`, rate: ratePerDay }
      ],
      payment: {
        subtotal: b.base_amount || b.total_amount || 0,
        discount: b.discount_amount || 0,
        grandTotal: b.total_amount || 0,
        status: b.is_paid ? 'Paid' : (b.paid_amount > 0 ? 'Partial' : 'Unpaid'),
        method: paymentDetail?.payment_method || paymentDetail?.method || 'Cash',
        paid: b.paid_amount || 0,
        remarks: b.is_paid ? 'Paid in full' : (b.paid_amount > 0 ? `Partial paid. Remaining: NPR ${(b.total_amount - b.paid_amount).toLocaleString()}` : 'Payment pending')
      }
    };
    
    setBillModalState({ show: true, booking: invoiceData });
  };

  const openDetail = async (b: any) => {
    setDetail(b);
    setReceiptUrl(null);
    setPaymentDetail(null);
    
    // Check booking's payment_receipt_url first
    if (b.payment_receipt_url) {
      console.log('Found receipt URL in booking:', b.payment_receipt_url);
      setReceiptUrl(b.payment_receipt_url);
    }
    
    try {
      console.log('Fetching payment for booking:', b.id);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', b.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.log('No payment record found for booking:', b.id);
      } else {
        console.log('Payment record found:', data);
        setPaymentDetail(data);
        
        // Use receipt_url from payment record if available
        if (data?.receipt_url) {
          console.log('Found receipt URL in payment record:', data.receipt_url);
          setReceiptUrl(data.receipt_url);
        }
      }
      
      // Fallback: Try to list files from storage if no receipt_url found yet
      if (!b.payment_receipt_url && (!data || !data?.receipt_url)) {
        try {
          console.log('Trying to list receipts from storage for booking:', b.id);
          const { data: files, error: listError } = await supabase.storage
            .from('payment-receipts')
            .list(`receipts/${b.id}`);
          
          if (!listError && files && files.length > 0) {
            // Get the most recent file
            const sortedFiles = files.sort((a: any, b: any) => 
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );
            const { data: urlData } = supabase.storage
              .from('payment-receipts')
              .getPublicUrl(`receipts/${b.id}/${sortedFiles[0].name}`);
            
            if (urlData?.publicUrl) {
              console.log('Found receipt in storage:', urlData.publicUrl);
              setReceiptUrl(urlData.publicUrl);
            }
          }
        } catch (storageErr) {
          console.log('Storage fallback error:', storageErr);
        }
      }
    } catch (err) {
      console.log('Error fetching payment:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-10 w-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>;
  }

  /* ─── Detail Page ─── */
  if (detail) {
    const b = detail;
    const custName = b.customer_name || 'N/A';
    const custEmail = b.customer_email || '-';
    const custPhone = b.customer_phone || '-';
    const vehName = b.vehicles?.name || 'N/A';
    const vehType = b.vehicles?.category || b.vehicles?.brand || '-';
    const isPaid = b.is_paid || b.payment_status === 'completed' || Number(b.paid_amount || 0) > 0;
    const payStatus = b.payment_status || (isPaid ? 'paid' : 'unpaid');
    const driverLabel = String(b.driver_option || 'self_drive').includes('with') ? 'With Driver' : 'Self Drive';
    
    // Parse pickup/dropoff from notes
    const pickupLoc = b.notes?.match(/Pickup:\s*([^|]+)/)?.[1]?.trim() || b.pickup_location || 'Kathmandu';
    const dropoffLoc = b.notes?.match(/Dropoff:\s*([^|]+)/)?.[1]?.trim() || '';
    const userNotes = b.notes?.replace(/Pickup:\s*[^|]+\s*\|?\s*/g, '').replace(/Dropoff:\s*[^|]+\s*\|?\s*/g, '').trim() || '';

    return (
      <div className="space-y-4">
        <div className={`${panel} p-4 sm:p-6`}>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setDetail(null)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              <span className="material-symbols-outlined text-[16px]">west</span> Back to Bookings
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status:</span>
              <select value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)} className={statusSelectCls(b.status)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Main */}
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Booking Detail Page</p>
                  <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">{b.booking_code || b.id?.slice(0, 8)}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{custName} · {vehName}</p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">{vehType}</span>
                  <span className={paymentPill(payStatus)}>{isPaid ? 'Paid' : 'Unpaid'}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Customer" value={custName} />
                <Field label="Customer Email" value={custEmail} />
                <Field label="Customer Phone" value={custPhone} />
                <Field label="Vehicle" value={vehName} />
                <Field label="Pickup Location" value={pickupLoc} />
                <Field label="Dropoff Location" value={dropoffLoc || 'Same as pickup'} />
                <Field label="Driver Option" value={driverLabel} />
                <Field label="Date From" value={b.start_date || '-'} />
                <Field label="Date To" value={b.end_date || '-'} />
                <Field label="Pickup Time" value={b.pickup_time || '10:00'} />
                <Field label="Payment" value={isPaid ? 'Yes' : 'No'} />
                <Field label="Total" value={fmtNpr(b.total_amount)} />
                <Field label="Base Amount" value={fmtNpr(b.base_amount)} />
                {Number(b.service_fee) > 0 && <Field label="Service Fee" value={fmtNpr(b.service_fee)} />}
                {Number(b.tax_amount) > 0 && <Field label="Tax" value={fmtNpr(b.tax_amount)} />}
                {Number(b.discount_amount) > 0 && <Field label="Discount" value={fmtNpr(b.discount_amount)} />}
                {b.coupon_code && <Field label="Coupon Code" value={b.coupon_code} />}
              </div>

              {/* Payment Receipt Section */}
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">Payment Info</h4>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(b)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                      <span className="material-symbols-outlined text-[14px]">edit</span> Edit Payment
                    </button>
                    {(b.remaining_amount || Number(b.total_amount || 0) - Number(b.paid_amount || 0)) > 0 && (
                      <button onClick={async () => {
                        await supabase.from('bookings').update({ payment_status: 'completed', is_paid: true, paid_amount: b.total_amount, remaining_amount: 0 }).eq('id', b.id);
                        const fresh = await fetch_(); setDetail(fresh.find((x: any) => x.id === b.id) || null);
                      }} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span> Collect Due {fmtNpr(b.remaining_amount || (Number(b.total_amount || 0) - Number(b.paid_amount || 0)))}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <Field label="Payment Status" value={b.payment_status || (isPaid ? 'completed' : 'unpaid')} />
                  <Field label="Payment Method" value={paymentDetail?.payment_method || paymentDetail?.method || 'Not specified'} />
                  <Field label="Total Amount" value={fmtNpr(b.total_amount)} />
                  <Field label="Paid Amount" value={fmtNpr(b.paid_amount)} />
                  <Field label="Remaining Amount" value={fmtNpr(b.remaining_amount || (Number(b.total_amount || 0) - Number(b.paid_amount || 0)))} />
                </div>


                
                {/* Payment Record from Payments Table */}
                {paymentDetail && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">receipt</span>
                      Payment Record #{paymentDetail.id?.slice(0, 8)}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div><span className="text-slate-500">Method:</span> <strong className="text-slate-700 dark:text-slate-200">{paymentDetail.payment_method || paymentDetail.method || 'Not specified'}</strong></div>
                      <div><span className="text-slate-500">Amount:</span> <strong className="text-slate-700 dark:text-slate-200">NPR {Number(paymentDetail.amount).toLocaleString()}</strong></div>
                      <div><span className="text-slate-500">Status:</span> <strong className="text-slate-700 dark:text-slate-200">{paymentDetail.status}</strong></div>
                      <div><span className="text-slate-500">Date:</span> <strong className="text-slate-700 dark:text-slate-200">{fmtDt(paymentDetail.created_at)}</strong></div>
                    </div>
                    
                    {(paymentDetail.receipt_url || receiptUrl) && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs font-bold text-blue-700 mb-1">Uploaded Receipt:</p>
                        <a href={paymentDetail.receipt_url || receiptUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[200px]">
                          <img 
                            src={paymentDetail.receipt_url || receiptUrl} 
                            alt="Payment receipt" 
                            className="w-full max-h-[150px] rounded-lg border border-blue-300 object-contain bg-white" 
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<span class="text-xs text-blue-600 p-2 block">Image failed to load. <a href="' + (paymentDetail.receipt_url || receiptUrl) + '" target="_blank" class="underline">Try direct link</a></span>';
                            }}
                          />
                        </a>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Show receipt from booking if no payment record but receipt exists */}
                {!paymentDetail && receiptUrl && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">receipt</span>
                      Uploaded Payment Receipt
                    </p>
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[200px]">
                      <img 
                        src={receiptUrl} 
                        alt="Payment receipt" 
                        className="w-full max-h-[150px] rounded-lg border border-emerald-300 object-contain bg-white" 
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<span class="text-xs text-emerald-600 p-2 block">Image failed to load. <a href="' + receiptUrl + '" target="_blank" class="underline">Try direct link</a></span>';
                        }}
                      />
                    </a>
                  </div>
                )}
                
                {/* Mark as Paid/Unpaid buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isPaid ? (
                    <button onClick={async () => {
                      await supabase.from('bookings').update({ payment_status: 'completed', is_paid: true, paid_amount: b.total_amount, remaining_amount: 0 }).eq('id', b.id);
                      const fresh = await fetch_(); setDetail(fresh.find((x: any) => x.id === b.id) || null);
                    }} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">payments</span> Mark as Paid (Cash)
                    </button>
                  ) : (
                    <button onClick={async () => {
                      await supabase.from('bookings').update({ payment_status: 'unpaid', is_paid: false, paid_amount: 0, remaining_amount: b.total_amount }).eq('id', b.id);
                      const fresh = await fetch_(); setDetail(fresh.find((x: any) => x.id === b.id) || null);
                    }} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">money_off</span> Mark as Unpaid
                    </button>
                  )}
                </div>
              </div>

              {/* User Notes */}
              {userNotes && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-500/10">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200">User Notes / Message</p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{userNotes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => openBillModal(b)} className="inline-flex items-center gap-1 rounded-xl bg-[#1f7668] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span> Generate Bill
                </button>
                <button onClick={() => openEditModal(b)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">
                  <span className="material-symbols-outlined text-[16px]">edit</span> Edit Booking
                </button>
                <button onClick={() => handleDelete(b.id)} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">
                  <span className="material-symbols-outlined text-[16px]">delete</span> Delete Booking
                </button>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-3">
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="text-sm font-extrabold">Trip Summary</h4>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                  <Field label="Booking Code" value={b.booking_code || '-'} />
                  <Field label="Booking ID" value={b.id || '-'} />
                  <Field label="Status" value={b.status} />
                  <Field label="Created" value={fmtDt(b.created_at)} />
                  <Field label="Last Updated" value={fmtDt(b.updated_at)} />
                  <Field label="Currency" value={b.currency || 'NPR'} />
                </div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                <h4 className="text-sm font-extrabold">Message</h4>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{userNotes || 'No user message recorded for this booking.'}</p>
              </article>
            </aside>
          </div>
        </div>

        {/* Edit Drawer in Detail View */}
        {showEdit && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)}></div>
            <div className="relative w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl dark:bg-[#1a2228]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-extrabold">Edit {b.booking_code || b.id?.slice(0, 8)}</h3>
                <button onClick={() => setShowEdit(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleEditBooking} className="space-y-3">
                <label className="block space-y-1"><span className="text-xs font-semibold">Start Date</span><input type="date" value={editForm.start_date || ''} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} required className={inp} /></label>
                <label className="block space-y-1"><span className="text-xs font-semibold">End Date</span><input type="date" value={editForm.end_date || ''} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} required className={inp} /></label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Time</span><input type="time" value={editForm.pickup_time || ''} onChange={(e) => setEditForm({ ...editForm, pickup_time: e.target.value })} className={inp} /></label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Driver Option</span>
                  <select value={editForm.driver_option || 'self_drive'} onChange={(e) => setEditForm({ ...editForm, driver_option: e.target.value })} className={inp}>
                    <option value="self_drive">Self Drive</option><option value="with_driver">With Driver</option>
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Location</span>
                  <input type="text" value={editForm.pickup_location || ''} onChange={(e) => setEditForm({ ...editForm, pickup_location: e.target.value })} className={inp} placeholder="Enter pickup location" />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Dropoff Location</span>
                  <input type="text" value={editForm.dropoff_location || ''} onChange={(e) => setEditForm({ ...editForm, dropoff_location: e.target.value })} className={inp} placeholder="Enter dropoff location" />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Status</span>
                  <select value={editForm.status || 'pending'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inp}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Paid Amount (NPR)</span>
                  <input type="number" min="0" max={detail?.total_amount || 0} value={editForm.paid_amount === '' ? '' : editForm.paid_amount} onChange={(e) => setEditForm({ ...editForm, paid_amount: e.target.value === '' ? '' : Number(e.target.value) })} className={inp} placeholder="0" />
                </label>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/5">
                  <div className="text-center"><p className="text-slate-500">Total</p><p className="font-bold text-slate-700 dark:text-slate-200">NPR {Number(detail?.total_amount || 0).toLocaleString()}</p></div>
                  <div className="text-center"><p className="text-slate-500">Paid</p><p className="font-bold text-emerald-600 dark:text-emerald-400">NPR {Number(editForm.paid_amount || 0).toLocaleString()}</p></div>
                  <div className="text-center"><p className="text-slate-500">Remaining</p><p className={`font-bold ${(detail?.total_amount || 0) - (editForm.paid_amount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>NPR {((detail?.total_amount || 0) - (editForm.paid_amount || 0)).toLocaleString()}</p></div>
                </div>
                <label className="block space-y-1"><span className="text-xs font-semibold">Notes</span>
                  <textarea rows={3} value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={inp}></textarea>
                </label>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#1f7668] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
              </form>
            </div>
          </div>
        )}

        {/* Invoice Modal in Detail View */}
        {billModalState.show && (
          <div className="fixed inset-0 z-[9999] overflow-auto bg-gray-100">
            <div className="min-h-screen">
              <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center">
                <h2 className="text-lg font-bold">Invoice Preview</h2>
                <button onClick={closeBillModal} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Close</button>
              </div>
              <Invoice booking={billModalState.booking} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bookings</p>
          <h2 className={heading}>Booking Management</h2>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">
          + Create Booking
        </button>
      </header>

      <div className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap gap-3">
          <input placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} className={inp + ' w-48'} />
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inp + ' w-36'} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inp + ' w-32'}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inp + ' w-32'}>
            <option value="">All Types</option>
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)} className={inp + ' w-28'}>
            <option value="">Payment</option>
            {PAID_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {hasFilters && <button onClick={clearFilters} className="text-xs font-semibold text-rose-600 hover:underline">Clear filters</button>}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Active Bookings</p><p className="text-lg font-extrabold">{activeCount}</p></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Revenue</p><p className="text-lg font-extrabold">{fmtNpr(totalRevenue)}</p></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Filtered</p><p className="text-lg font-extrabold">{filtered.length}</p></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Page</p><p className="text-lg font-extrabold">{page} / {totalPages}</p></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-3 py-2 font-semibold">Vehicle</th>
              <th className="px-3 py-2 font-semibold">Customer</th>
              <th className="px-3 py-2 font-semibold">Dates</th>
              <th className="px-3 py-2 font-semibold">Total</th>
              <th className="px-3 py-2 font-semibold">Paid</th>
              <th className="px-3 py-2 font-semibold">Remaining</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Payment</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {paged.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-3 py-2">
                    <p className="font-semibold">{b.vehicles?.name || 'Vehicle'}</p>
                    <p className="text-xs text-slate-500">{b.vehicles?.category} • {b.vehicles?.vehicle_number}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{b.customer_name}</p>
                    <p className="text-xs text-slate-500">{b.customer_phone}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{fmtDate(b.start_date)} → {fmtDate(b.end_date)}</p>
                    <p className="text-xs text-slate-500">{b.pickup_time}</p>
                  </td>
                  <td className="px-3 py-2 font-semibold">{fmtNpr(b.total_amount)}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-emerald-700">{fmtNpr(b.paid_amount || 0)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-semibold ${Number(b.remaining_amount || (b.total_amount - (b.paid_amount || 0))) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtNpr(b.remaining_amount || (Number(b.total_amount || 0) - Number(b.paid_amount || 0)))}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)} className={statusSelectCls(b.status) + ' w-[110px]'}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select 
                      value={b.payment_status || 'pending'} 
                      onChange={async (e) => {
                        const newPaymentStatus = e.target.value;
                        const isPaid = newPaymentStatus === 'completed';
                        const paidAmount = isPaid ? b.total_amount : (newPaymentStatus === 'partial' ? (b.paid_amount || 0) : 0);
                        
                        // Update booking
                        await supabase.from('bookings').update({
                          payment_status: newPaymentStatus,
                          is_paid: isPaid,
                          paid_amount: paidAmount,
                          remaining_amount: isPaid ? 0 : (b.total_amount - paidAmount)
                        }).eq('id', b.id);
                        
                        // Also update payment record if exists
                        await supabase.from('payments').update({
                          status: newPaymentStatus
                        }).eq('booking_id', b.id);
                        
                        await fetch_();
                      }} 
                      className={`w-[100px] rounded-lg border px-2 py-1 text-xs font-semibold outline-none ${
                        b.payment_status === 'completed' ? 'border-emerald-200 bg-emerald-100 text-emerald-700' :
                        b.payment_status === 'partial' ? 'border-amber-200 bg-amber-100 text-amber-700' :
                        'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(b)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600">View</button>
                      <button onClick={() => openEditModal(b)} className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200">Edit</button>
                      <button onClick={() => handleDelete(b.id)} className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Previous</button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Next</button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a2228]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-extrabold">Create Manual Booking</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1 sm:col-span-2"><span className="text-xs font-semibold">Vehicle *</span>
                  {vehiclesLoading ? (
                    <div className={inp + ' flex items-center gap-2'}>
                      <span className="animate-spin w-4 h-4 border-2 border-[#1f7668] border-t-transparent rounded-full"></span>
                      Loading vehicles...
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        placeholder="Search vehicles..." 
                        value={vehicleSearch}
                        onChange={(e) => setVehicleSearch(e.target.value)}
                        className={inp + ' mb-2'}
                      />
                      <select 
                        value={createForm.vehicle_id} 
                        onChange={(e) => {
                          setCreateForm({ ...createForm, vehicle_id: e.target.value });
                          const selected = vehicles.find((v: any) => v.id === e.target.value);
                          if (selected) setVehicleSearch(selected.name);
                        }} 
                        required 
                        className={inp}
                        size={Math.min(5, filteredVehicles.length + 1)}
                      >
                        <option value="">Select Vehicle</option>
                        {filteredVehicles.map((v: any) => {
                          const price = v.price_per_day || v.pricePerDay || v.price || 0;
                          return (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.brand ? `(${v.brand}` : ''} {v.model ? `${v.model})` : v.brand ? ')' : ''} {v.vehicle_number ? `- ${v.vehicle_number}` : ''} - NPR {price.toLocaleString()}/day
                            </option>
                          );
                        })}
                      </select>
                      {filteredVehicles.length === 0 && vehicleSearch && (
                        <p className="text-xs text-amber-600 mt-1">No vehicles found matching "{vehicleSearch}"</p>
                      )}
                    </>
                  )}
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Customer Name *</span>
                  <input type="text" value={createForm.customer_name} onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Customer Phone *</span>
                  <input type="tel" value={createForm.customer_phone} onChange={(e) => setCreateForm({ ...createForm, customer_phone: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1 sm:col-span-2"><span className="text-xs font-semibold">Customer Email</span>
                  <input type="email" value={createForm.customer_email} onChange={(e) => setCreateForm({ ...createForm, customer_email: e.target.value })} className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Start Date *</span>
                  <input type="date" min={new Date().toISOString().split('T')[0]} value={createForm.start_date} onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">End Date *</span>
                  <input type="date" min={createForm.start_date || new Date().toISOString().split('T')[0]} value={createForm.end_date} onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Time</span>
                  <input type="time" value={createForm.pickup_time} onChange={(e) => setCreateForm({ ...createForm, pickup_time: e.target.value })} className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Driver Option</span>
                  <select value={createForm.driver_option} onChange={(e) => setCreateForm({ ...createForm, driver_option: e.target.value })} className={inp}>
                    <option value="self_drive">Self Drive</option>
                    <option value="with_driver">With Driver</option>
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Location *</span>
                  <input type="text" value={createForm.pickup_location} onChange={(e) => setCreateForm({ ...createForm, pickup_location: e.target.value })} required placeholder="Enter pickup location" className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Dropoff Location</span>
                  <input type="text" value={createForm.dropoff_location} onChange={(e) => setCreateForm({ ...createForm, dropoff_location: e.target.value })} placeholder="Enter dropoff location (optional)" className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Payment Method</span>
                  <select value={createForm.payment_method} onChange={(e) => setCreateForm({ ...createForm, payment_method: e.target.value })} className={inp}>
                    <option value="cash">Cash</option>
                    <option value="online">Online Transfer</option>
                    <option value="card">Card</option>
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Paid Amount (NPR)</span>
                  <input 
                    type="number" 
                    min="0" 
                    value={createForm.paid_amount} 
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setCreateForm({ ...createForm, paid_amount: val as any });
                    }} 
                    className={inp} 
                    placeholder="0"
                  />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Status</span>
                  <select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })} className={inp}>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                  </select>
                </label>
                <label className="block space-y-1 sm:col-span-2"><span className="text-xs font-semibold">Notes</span>
                  <textarea rows={2} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} className={inp}></textarea>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={saving} className="rounded-xl bg-[#1f7668] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create Booking'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-6 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {billModalState.show && (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-gray-100">
          <div className="min-h-screen">
            <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center">
              <h2 className="text-lg font-bold">Invoice Preview</h2>
              <button onClick={closeBillModal} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">Close</button>
            </div>
            {/* <Invoice booking={billModalState.booking} /> */}
            <div className="p-8 text-center">Invoice component needs to be converted</div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a2228]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-extrabold">Edit Booking</h3>
              <button onClick={() => setShowEdit(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleEditBooking} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1"><span className="text-xs font-semibold">Customer Name *</span>
                  <input type="text" value={editForm.customer_name || ''} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Customer Email</span>
                  <input type="email" value={editForm.customer_email || ''} onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })} className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Customer Phone *</span>
                  <input type="tel" value={editForm.customer_phone || ''} onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Start Date *</span>
                  <input type="date" value={editForm.start_date || ''} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">End Date *</span>
                  <input type="date" value={editForm.end_date || ''} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} required className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Time</span>
                  <input type="time" value={editForm.pickup_time || ''} onChange={(e) => setEditForm({ ...editForm, pickup_time: e.target.value })} className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Driver Option</span>
                  <select value={editForm.driver_option || 'self_drive'} onChange={(e) => setEditForm({ ...editForm, driver_option: e.target.value })} className={inp}>
                    <option value="self_drive">Self Drive</option>
                    <option value="with_driver">With Driver</option>
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Location</span>
                  <input type="text" value={editForm.pickup_location || ''} onChange={(e) => setEditForm({ ...editForm, pickup_location: e.target.value })} placeholder="Enter pickup location" className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Dropoff Location</span>
                  <input type="text" value={editForm.dropoff_location || ''} onChange={(e) => setEditForm({ ...editForm, dropoff_location: e.target.value })} placeholder="Enter dropoff location" className={inp} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Status</span>
                  <select value={editForm.status || 'pending'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inp}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block space-y-1 sm:col-span-2"><span className="text-xs font-semibold">Notes</span>
                  <textarea rows={2} value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={inp}></textarea>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setShowEdit(false)} className="rounded-xl border border-slate-200 px-6 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInspection && inspectionBooking && (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-slate-100 dark:bg-slate-900">
          <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center shadow">
            <h2 className="text-lg font-bold">Vehicle Inspection</h2>
            <button onClick={() => { setShowInspection(false); setInspectionBooking(null); }} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-semibold">✕ Close</button>
          </div>
          <div className="min-h-screen p-4 sm:p-6">
            {/* <VehicleInspection
              booking={inspectionBooking}
              inspectionType={inspectionType}
              onComplete={async () => {
                setShowInspection(false);
                setInspectionBooking(null);
                const fresh = await fetch_();
                if (detail?.id === inspectionBooking.id) {
                  setDetail(fresh.find((b: any) => b.id === inspectionBooking.id) || null);
                }
              }}
              onCancel={() => {
                setShowInspection(false);
                setInspectionBooking(null);
              }}
            /> */}
            <div className="text-center">VehicleInspection component needs to be converted</div>
          </div>
        </div>
      )}
    </div>
  );
}
