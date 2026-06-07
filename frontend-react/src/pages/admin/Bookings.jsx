import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';
import { createInvoiceFromBooking } from '../../services/billing.service';
import Invoice from '../../components/Invoice';
import VehicleInspection from '../../components/admin/VehicleInspection';

const panel = 'rounded-2xl border border-[rgba(24,34,39,0.12)] bg-white/85 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none';
const heading = 'text-[20px] font-extrabold tracking-[-0.02em]';
const STATUS_OPTIONS = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
const TYPE_OPTIONS = ['', 'Sedan', 'SUV', 'Hatchback', 'Luxury', 'Van', 'Electric'];
const PAID_OPTIONS = ['', 'Yes', 'No'];
const fmtNpr = (v) => `NPR ${Number(v || 0).toLocaleString()}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const fmtDt = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7668] dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

const Field = ({ label, value }) => (
  <article className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '-'}</p>
  </article>
);

const statusCls = (s) => {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold';
  if (s === 'confirmed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (s === 'pending') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (s === 'cancelled') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  if (s === 'completed') return `${base} bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-200`;
  if (s === 'active') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  return `${base} bg-slate-100 text-slate-600`;
};

const statusSelectCls = (s) => {
  const base = 'w-[140px] rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition';
  if (s === 'confirmed') return `${base} border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200`;
  if (s === 'pending') return `${base} border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200`;
  if (s === 'cancelled') return `${base} border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-200`;
  if (s === 'completed') return `${base} border-slate-300 bg-slate-200 text-slate-800 dark:border-slate-400/30 dark:bg-slate-500/25 dark:text-slate-200`;
  return `${base} border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5`;
};

const paymentPill = (s) => {
  const base = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]';
  const k = String(s || '').toLowerCase();
  if (k === 'completed' || k === 'paid') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  if (k === 'partial') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
  if (k === 'pending') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300`;
  if (k === 'failed' || k === 'expired') return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200`;
};

const remainingDuePill = (remaining) => {
  const base = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]';
  const rem = Number(remaining) || 0;
  if (rem <= 0) return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
};

function buildOccupancy(bookings) {
  const tiles = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    tiles.push({ weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: bookings.filter((b) => b.start_date <= iso && b.end_date >= iso && !['cancelled', 'completed'].includes(b.status)).length });
  }
  return tiles;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paidFilter, setPaidFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [billModalState, setBillModalState] = useState({ show: false, booking: null });
  const [createForm, setCreateForm] = useState({
    vehicle_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    start_date: '',
    end_date: '',
    pickup_time: '10:00',
    driver_option: 'self_drive',
    notes: '',
    payment_method: 'cash',
    paid_amount: '',
    status: 'confirmed'
  });
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showInspection, setShowInspection] = useState(false);
  const [inspectionType, setInspectionType] = useState('before_trip');
  const [inspectionBooking, setInspectionBooking] = useState(null);
  const perPage = 8;

  // Auto-update booking status based on dates
  const autoUpdateBookingStatus = async (bookings) => {
    const today = new Date().toISOString().split('T')[0];
    const updates = [];
    
    bookings.forEach(b => {
      if (b.status === 'cancelled') return; // Don't update cancelled
      
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
    
    // Batch update in Supabase
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase.from('vehicle_bookings').update({ status: update.status }).eq('id', update.id);
      }
    }
    
    return updates.length;
  };

  const fetch_ = async (enableAutoUpdate = false) => {
    setLoading(true);
    const { data, error } = await supabase.from('vehicle_bookings').select('*, vehicles(name, brand, category, vehicle_number, primary_image_url, image_url)').order('created_at', { ascending: false });
    if (error) console.error('Bookings fetch error:', error.message, error.code, error);
    
    // Only auto-update statuses when explicitly enabled (not on every load)
    if (enableAutoUpdate && data && data.length > 0) {
      console.log('Auto-updating booking statuses...');
      await autoUpdateBookingStatus(data);
      // Re-fetch to get updated statuses
      const { data: refreshedData } = await supabase.from('vehicle_bookings').select('*, vehicles(name, brand, category, vehicle_number, primary_image_url, image_url)').order('created_at', { ascending: false });
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
      // Fetch all vehicles with minimal fields
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
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      alert('Failed to load vehicles: ' + (err.message || 'Unknown error'));
    } finally {
      setVehiclesLoading(false);
    }
  };
  useEffect(() => { fetch_(); }, []);
  useEffect(() => { if (showCreate) fetchVehicles(); }, [showCreate]);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let userId = null;
      
      // Check for existing customer with same name and email (avoid duplicates)
      if (createForm.customer_email) {
        const { data: existingCustomer } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', createForm.customer_email)
          .eq('full_name', createForm.customer_name)
          .single();
        
        if (existingCustomer) {
          userId = existingCustomer.id;
          // Update phone if provided
          if (createForm.customer_phone) {
            await supabase
              .from('user_profiles')
              .update({ phone: createForm.customer_phone })
              .eq('id', existingCustomer.id);
          }
        } else {
          // Create new customer profile
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
      
      const selectedVehicle = vehicles.find(v => v.id === createForm.vehicle_id);
      const days = Math.max(1, Math.ceil((new Date(createForm.end_date) - new Date(createForm.start_date)) / (1000 * 60 * 60 * 24)));
      const pricePerDay = selectedVehicle?.price_per_day || selectedVehicle?.pricePerDay || selectedVehicle?.price || 0;
      const base = pricePerDay * days;
      const serviceFee = Math.round(base * 0.1);
      const total = base + serviceFee;
      
      const { data, error } = await supabase.from('vehicle_bookings').insert({
        vehicle_id: createForm.vehicle_id,
        customer_name: createForm.customer_name,
        customer_email: createForm.customer_email,
        customer_phone: createForm.customer_phone,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        pickup_time: createForm.pickup_time,
        driver_option: createForm.driver_option,
        notes: createForm.notes,
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
      
      // Create payment record if paid
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
        notes: '', payment_method: 'cash', paid_amount: '', status: 'confirmed'
      });
      setVehicleSearch('');
      await fetch_();
      alert('Manual booking created successfully!');
    } catch (err) {
      alert('Failed to create booking: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter out cancelled bookings from main view (they go to Trash)
  const activeBookings = useMemo(() => bookings.filter(b => b.status !== 'cancelled'), [bookings]);
  
  const filtered = useMemo(() => {
    return activeBookings.filter((b) => {
      const q = search.toLowerCase();
      const matchQ = !q || [b.id, b.booking_code, b.status, b.vehicles?.name, b.customer_name, b.customer_email].some((f) => String(f || '').toLowerCase().includes(q));
      const matchDate = !dateFilter || b.start_date === dateFilter || b.end_date === dateFilter;
      const matchStatus = !statusFilter || b.status === statusFilter;
      const matchType = !typeFilter || b.vehicles?.category === typeFilter;
      const matchPaid = !paidFilter || (paidFilter === 'Yes' ? b.is_paid : !b.is_paid);
      return matchQ && matchDate && matchStatus && matchType && matchPaid;
    });
  }, [activeBookings, search, dateFilter, statusFilter, typeFilter, paidFilter]);

  // Filter vehicles based on search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const q = vehicleSearch.toLowerCase();
    return vehicles.filter(v => 
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.brand && v.brand.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      (v.category && v.category.toLowerCase().includes(q)) ||
      (v.vehicle_number && v.vehicle_number.toLowerCase().includes(q))
    );
  }, [vehicles, vehicleSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const activeCount = filtered.filter((b) => b.status === 'confirmed' || b.status === 'active').length;
  const totalRevenue = filtered.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const hasFilters = dateFilter || statusFilter || typeFilter || paidFilter;
  const occupancy = useMemo(() => buildOccupancy(bookings), [bookings]);

  const clearFilters = () => { setDateFilter(''); setStatusFilter(''); setTypeFilter(''); setPaidFilter(''); setPage(1); };
  const updateStatus = async (id, status) => { 
    try {
      console.log(`Updating booking ${id} to status: ${status}`);
      
      const { error } = await supabase.from('vehicle_bookings').update({ status }).eq('id', id); 
      
      if (error) {
        console.error('Status update error:', error);
        alert('Failed to update status: ' + error.message);
        return;
      }
      
      console.log(`Status updated successfully for booking ${id}`);
      
      if (status === 'confirmed') { 
        const booking = bookings.find((b) => b.id === id); 
        if (booking) {
          try { 
            await createInvoiceFromBooking(booking); 
          } catch (err) {
            console.log('Invoice creation skipped or failed:', err);
          }
        } 
      } 
      
      // Refresh without auto-update to keep the status we just set
      const fresh = await fetch_(); 
      if (detail?.id === id) {
        const updated = fresh.find((b) => b.id === id);
        setDetail(updated || null);
        console.log('Detail view updated:', updated?.status);
      }
      
      console.log('Status update completed and data refreshed');
    } catch (err) {
      console.error('Update status error:', err);
      alert('Error updating status: ' + err.message);
    }
  };
  const handleDelete = async (id) => { if (!confirm('Delete this booking permanently?')) return; await supabase.from('vehicle_bookings').delete().eq('id', id); if (detail?.id === id) setDetail(null); await fetch_(); };

  // Bill Generation Functions
  const openBillModal = (b) => {
    // Transform booking data to Invoice props format
    const days = b.start_date && b.end_date 
      ? Math.max(1, Math.ceil((new Date(b.end_date) - new Date(b.start_date)) / 86400000)) 
      : 1;
    const ratePerDay = days > 0 ? (b.base_amount || b.total_amount || 0) / days : 0;
    
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
        pickup: `${b.start_date} — ${b.pickup_time || '10:00 AM'}`,
        dropoff: `${b.end_date} — 6:00 PM`,
        location: b.pickup_location || 'Kathmandu',
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

  const openDetail = async (b) => {
    setDetail(b);
    setReceiptUrl(null);
    setPaymentDetail(null);
    
    // Fetch payment details for this booking
    try {
      console.log('Fetching payment for booking:', b.id);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', b.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.log('No payment record found for booking:', b.id);
      } else {
        console.log('Payment record found:', data);
        setPaymentDetail(data);
        
        // Check for receipt in storage bucket
        if (data?.receipt_url) {
          setReceiptUrl(data.receipt_url);
        } else {
          // Try to fetch from payment-receipts bucket
          const { data: files } = await supabase.storage
            .from('payment-receipts')
            .list(`receipts/${b.id}`);
          if (files && files.length > 0) {
            const { data: url } = supabase.storage
              .from('payment-receipts')
              .getPublicUrl(`receipts/${b.id}/${files[0].name}`);
            setReceiptUrl(url?.publicUrl || null);
          }
        }
      }
    } catch (err) {
      console.log('Error fetching payment details:', err);
      setPaymentDetail(null);
      setReceiptUrl(null);
    }
  };
  const openEdit = (b) => {
    setEditForm({ 
      start_date: b.start_date || '', 
      end_date: b.end_date || '', 
      pickup_time: b.pickup_time || '10:00', 
      driver_option: b.driver_option || 'self_drive', 
      status: b.status || 'pending', 
      is_paid: b.is_paid || false, 
      paid_amount: b.paid_amount || 0,
      notes: b.notes || ''
      // Note: payment_type and payment_method don't exist in vehicle_bookings table
    });
    setShowEdit(true);
  };

  // Handle collecting remaining due payment
  const handleCollectDue = async (b, fullPayment = false) => {
    // Calculate remaining if not set: total - paid
    const calculatedRemaining = Number(b.total_amount || 0) - Number(b.paid_amount || 0);
    const remaining = Number(b.remaining_amount ?? calculatedRemaining);
    if (remaining <= 0) {
      alert('No remaining amount due');
      return;
    }
    
    const confirmMsg = fullPayment 
      ? `Collect full remaining NPR ${remaining.toLocaleString()}?`
      : `Collect partial payment? Current remaining: NPR ${remaining.toLocaleString()}`;
    
    if (!confirm(confirmMsg)) return;
    
    const amountToAdd = fullPayment ? remaining : prompt(`Enter partial payment amount (max NPR ${remaining.toLocaleString()}):`);
    if (amountToAdd === null) return;
    
    const paymentAmount = Number(amountToAdd);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert('Invalid amount');
      return;
    }
    if (paymentAmount > remaining) {
      alert('Payment exceeds remaining amount');
      return;
    }
    
    try {
      const newPaid = Number(b.paid_amount || 0) + paymentAmount;
      const newRemaining = Number(b.total_amount || 0) - newPaid;
      const isFullyPaid = newRemaining <= 0;
      
      await supabase.from('vehicle_bookings').update({
        paid_amount: newPaid,
        remaining_amount: newRemaining > 0 ? newRemaining : 0,
        is_paid: isFullyPaid,
        payment_status: isFullyPaid ? 'completed' : 'partial'
      }).eq('id', b.id);
      
      // Create payment record
      await supabase.from('payments').insert({
        booking_id: b.id,
        customer_name: b.customer_name,
        customer_email: b.customer_email,
        amount: paymentAmount,
        payment_method: 'cash',
        status: 'completed',
        total_booking_amount: b.total_amount,
        currency: 'NPR'
      });
      
      // Refresh without auto-update
      const fresh = await fetch_();
      if (detail?.id === b.id) {
        const updatedBooking = fresh.find(x => x.id === b.id);
        setDetail(updatedBooking || null);
      }
      
      const successMsg = isFullyPaid 
        ? `Full payment of NPR ${paymentAmount.toLocaleString()} collected! Booking is now fully paid.`
        : `NPR ${paymentAmount.toLocaleString()} collected successfully! Remaining: NPR ${newRemaining.toLocaleString()}`;
      alert(successMsg);
    } catch (err) {
      alert('Failed to record payment: ' + err.message);
    }
  };
  const handleEditSave = async (e) => {
    e.preventDefault(); 
    if (!detail) return; 
    setSaving(true);
    
    try {
      const remaining = detail.total_amount - Number(editForm.paid_amount || 0);
      
      // Build update payload explicitly - only include columns that exist in vehicle_bookings table
      const updatePayload = {
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        pickup_time: editForm.pickup_time,
        driver_option: editForm.driver_option,
        status: editForm.status,
        paid_amount: Number(editForm.paid_amount || 0),
        notes: editForm.notes || null, // Send null if empty string to avoid 400 error
        remaining_amount: remaining > 0 ? remaining : 0,
        is_paid: remaining <= 0
        // Note: payment_method and payment_type don't exist in vehicle_bookings table
      };
      
      const { error } = await supabase.from('vehicle_bookings').update(updatePayload).eq('id', detail.id);
      
      if (error) {
        console.error('Update error:', error);
        alert('Failed to save: ' + error.message);
      } else {
        setShowEdit(false); 
        const fresh = await fetch_(); 
        setDetail(fresh.find((b) => b.id === detail.id) || null);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save changes: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

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
    const hasReceipt = isPaid || Number(b.paid_amount || 0) > 0;

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
                <Field label="Pickup Location" value={b.pickup_location || b.notes || '-'} />
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
                    {/* Edit Payment Button */}
                    <button 
                      onClick={() => { setDetail(b); openEdit(b); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                      title="Edit payment amount"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      Edit Payment
                    </button>
                    {/* Collect Due Button - show when there's remaining amount */}
                    {(b.remaining_amount || Number(b.total_amount || 0) - Number(b.paid_amount || 0)) > 0 && (
                      <button 
                        onClick={() => handleCollectDue(b, true)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        title="Collect full remaining payment"
                      >
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Collect Due {fmtNpr(b.remaining_amount || (Number(b.total_amount || 0) - Number(b.paid_amount || 0)))}
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
                  {b.payment_deadline && <Field label="Payment Deadline" value={fmtDt(b.payment_deadline)} />}
                </div>
                
                {/* Payment Record from Payments Table */}
                {paymentDetail && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">receipt</span>
                      Payment Record #{paymentDetail.id?.slice(0, 8)}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div><span className="text-slate-500">Method:</span> <strong className="text-slate-700">{paymentDetail.payment_method || paymentDetail.method || 'Not specified'}</strong></div>
                      <div><span className="text-slate-500">Amount:</span> <strong className="text-slate-700">NPR {Number(paymentDetail.amount).toLocaleString()}</strong></div>
                      <div><span className="text-slate-500">Status:</span> <strong className="text-slate-700">{paymentDetail.status}</strong></div>
                      <div><span className="text-slate-500">Date:</span> <strong className="text-slate-700">{fmtDt(paymentDetail.created_at)}</strong></div>
                    </div>
                    
                    {/* Receipt Image from payment record */}
                    {paymentDetail.receipt_url && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs font-bold text-blue-700 mb-1">Uploaded Receipt:</p>
                        <a href={paymentDetail.receipt_url} target="_blank" rel="noopener noreferrer" className="block max-w-[200px]">
                          <img src={paymentDetail.receipt_url} alt="Payment receipt" className="w-full max-h-[150px] rounded-lg border border-blue-300 object-contain bg-white" onError={(e) => { e.target.style.display = 'none'; }} />
                        </a>
                        <a href={paymentDetail.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-blue-700 underline">View full receipt</a>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Receipt from Storage Bucket */}
                {receiptUrl && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">cloud_upload</span>
                      Storage Receipt
                    </p>
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[200px]">
                      <img src={receiptUrl} alt="Payment receipt from storage" className="w-full max-h-[150px] rounded-lg border border-emerald-300 object-contain bg-white" onError={(e) => e.target.style.display='none'} />
                    </a>
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline">View full receipt</a>
                  </div>
                )}
                {(b.payment_status === 'receipt_submitted' || b.payment_status === 'cash_pending') && b.status !== 'confirmed' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={async () => {
                      await supabase.from('vehicle_bookings').update({ status: 'confirmed', payment_status: 'completed', is_paid: true, paid_amount: b.total_amount, remaining_amount: 0 }).eq('id', b.id);
                      await supabase.from('payments').update({ status: 'completed' }).eq('booking_id', b.id);
                      try { await createInvoiceFromBooking(b); } catch (_) {}
                      const fresh = await fetch_(); setDetail(fresh.find((x) => x.id === b.id) || null);
                    }} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">check_circle</span> Confirm Payment
                    </button>
                    <button onClick={async () => {
                      if (!confirm('Reject this payment and cancel the booking? The reserved dates will be freed.')) return;
                      await supabase.from('vehicle_bookings').update({ status: 'cancelled', payment_status: 'rejected', is_paid: false }).eq('id', b.id);
                      await supabase.from('payments').update({ status: 'failed', failure_reason: 'Rejected by admin' }).eq('booking_id', b.id);
                      const fresh = await fetch_(); setDetail(fresh.find((x) => x.id === b.id) || null);
                    }} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">cancel</span> Reject & Cancel
                    </button>
                  </div>
                )}
                {/* Manual paid toggle for cash payments or admin override */}
                {b.payment_status !== 'receipt_submitted' && b.payment_status !== 'cash_pending' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isPaid ? (
                      <button onClick={async () => {
                        await supabase.from('vehicle_bookings').update({ payment_status: 'completed', is_paid: true, paid_amount: b.total_amount, remaining_amount: 0 }).eq('id', b.id);
                        try { await createInvoiceFromBooking(b); } catch (_) {}
                        const fresh = await fetch_(); setDetail(fresh.find((x) => x.id === b.id) || null);
                      }} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
                        <span className="material-symbols-outlined text-[14px] align-middle mr-1">payments</span> Mark as Paid (Cash)
                      </button>
                    ) : (
                      <button onClick={async () => {
                        await supabase.from('vehicle_bookings').update({ payment_status: 'unpaid', is_paid: false, paid_amount: 0, remaining_amount: b.total_amount }).eq('id', b.id);
                        const fresh = await fetch_(); setDetail(fresh.find((x) => x.id === b.id) || null);
                      }} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
                        <span className="material-symbols-outlined text-[14px] align-middle mr-1">money_off</span> Mark as Unpaid
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* User Message */}
              {b.notes && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-500/10">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200">User Notes / Message</p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{b.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => openBillModal(b)} className="inline-flex items-center gap-1 rounded-xl bg-[#1f7668] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span> Generate Bill
                </button>
                <button onClick={() => openEdit(b)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">
                  <span className="material-symbols-outlined text-[16px]">edit</span> Edit Booking
                </button>
                <button onClick={() => handleDelete(b.id)} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">
                  <span className="material-symbols-outlined text-[16px]">delete</span> Delete Booking
                </button>
              </div>

              {/* Vehicle Inspection Section */}
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-extrabold text-blue-800 dark:text-blue-200">
                    <span className="material-symbols-outlined text-[16px] align-middle mr-1">checklist</span>
                    Vehicle Inspection
                  </h4>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    b.inspection_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    b.inspection_status === 'after_done' ? 'bg-blue-100 text-blue-700' :
                    b.inspection_status === 'before_done' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {b.inspection_status === 'completed' ? 'Completed' :
                     b.inspection_status === 'after_done' ? 'After Trip Done' :
                     b.inspection_status === 'before_done' ? 'Before Trip Done' :
                     'Pending'}
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                  Complete vehicle inspection before and after the trip to track condition and detect damages.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => {
                      console.log('Before Trip clicked, booking:', b.id);
                      setInspectionBooking(b);
                      setInspectionType('before_trip');
                      setShowInspection(true);
                      console.log('showInspection set to true');
                    }}
                    disabled={b.inspection_status === 'before_done' || b.inspection_status === 'after_done' || b.inspection_status === 'completed'}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      b.inspection_status === 'before_done' || b.inspection_status === 'after_done' || b.inspection_status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {b.inspection_status === 'before_done' || b.inspection_status === 'after_done' || b.inspection_status === 'completed' ? 'check_circle' : 'directions_car'}
                    </span>
                    {b.inspection_status === 'before_done' || b.inspection_status === 'after_done' || b.inspection_status === 'completed' ? 'Before Trip ✓' : 'Before Trip Inspection'}
                  </button>
                  <button 
                    onClick={() => {
                      setInspectionBooking(b);
                      setInspectionType('after_trip');
                      setShowInspection(true);
                    }}
                    disabled={!b.inspection_status || b.inspection_status === 'pending' || b.inspection_status === 'after_done' || b.inspection_status === 'completed'}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      b.inspection_status === 'after_done' || b.inspection_status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                        : !b.inspection_status || b.inspection_status === 'pending'
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {b.inspection_status === 'after_done' || b.inspection_status === 'completed' ? 'check_circle' : 'search'}
                    </span>
                    {b.inspection_status === 'after_done' || b.inspection_status === 'completed' ? 'After Trip ✓' : 'After Trip Inspection'}
                  </button>
                </div>
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
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{b.notes || 'No user message recorded for this booking.'}</p>
              </article>
            </aside>
          </div>
        </div>

        {/* Edit Drawer */}
        {showEdit && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)}></div>
            <div className="relative w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl dark:bg-[#1a2228]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-extrabold">Edit {b.booking_code || b.id?.slice(0, 8)}</h3>
                <button onClick={() => setShowEdit(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleEditSave} className="space-y-3">
                <label className="block space-y-1"><span className="text-xs font-semibold">Start Date</span><input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} required className={inp} /></label>
                <label className="block space-y-1"><span className="text-xs font-semibold">End Date</span><input type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} required className={inp} /></label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Pickup Time</span><input type="time" value={editForm.pickup_time} onChange={(e) => setEditForm({ ...editForm, pickup_time: e.target.value })} className={inp} /></label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Driver Option</span>
                  <select value={editForm.driver_option} onChange={(e) => setEditForm({ ...editForm, driver_option: e.target.value })} className={inp}>
                    <option value="self_drive">Self Drive</option><option value="with_driver">With Driver</option>
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Status</span>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inp}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </label>
                <label className="block space-y-1"><span className="text-xs font-semibold">Paid Amount (NPR)</span>
                  <input 
                    type="number" 
                    min="0"
                    max={detail?.total_amount || 0}
                    value={editForm.paid_amount} 
                    onChange={(e) => setEditForm({ ...editForm, paid_amount: Number(e.target.value) })} 
                    className={inp}
                    placeholder="Enter amount paid"
                  />
                </label>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/5">
                  <div className="text-center">
                    <p className="text-slate-500">Total</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">NPR {Number(detail?.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500">Paid</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">NPR {Number(editForm.paid_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500">Remaining</p>
                    <p className={`font-bold ${(detail?.total_amount || 0) - (editForm.paid_amount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      NPR {((detail?.total_amount || 0) - (editForm.paid_amount || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
                <label className="block space-y-1"><span className="text-xs font-semibold">Notes / User Message</span>
                  <textarea rows="3" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={inp}></textarea>
                </label>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#1f7668] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54] disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
              </form>
            </div>
          </div>
        )}

        {/* Invoice Modal - rendered in detail view */}
        {billModalState.show && (
          <div className="fixed inset-0 z-[9999] overflow-auto bg-gray-100">
            <div className="min-h-screen">
              <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center">
                <h2 className="text-lg font-bold">Invoice Preview</h2>
                <button 
                  onClick={closeBillModal}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Close
                </button>
              </div>
              <Invoice booking={billModalState.booking} />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reservations</p>
          <h2 className={heading}>Booking &amp; Reservation Control</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {filtered.length} bookings | {activeCount} active | {fmtNpr(totalRevenue)} revenue
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#1f7668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185f54]">
            <span className="material-symbols-outlined text-[16px] align-middle mr-1">add</span>
            Create Booking
          </button>
          <button onClick={fetch_} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">Refresh</button>
        </div>
      </header>

      <section className={`${panel} p-4 sm:p-5`}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <label className="space-y-1 text-sm font-semibold"><span className="text-slate-600 dark:text-slate-300">Filter by Date</span>
            <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} className={inp} />
          </label>
          <label className="space-y-1 text-sm font-semibold"><span className="text-slate-600 dark:text-slate-300">Status</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inp}><option value="">All</option>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select>
          </label>
          <label className="space-y-1 text-sm font-semibold"><span className="text-slate-600 dark:text-slate-300">Vehicle Type</span>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className={inp}>{TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || 'All'}</option>)}</select>
          </label>
          <label className="space-y-1 text-sm font-semibold"><span className="text-slate-600 dark:text-slate-300">Paid</span>
            <select value={paidFilter} onChange={(e) => { setPaidFilter(e.target.value); setPage(1); }} className={inp}>{PAID_OPTIONS.map((p) => <option key={p} value={p}>{p || 'All'}</option>)}</select>
          </label>
          {hasFilters && <button onClick={clearFilters} className="self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Clear Filters</button>}
        </div>
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <h3 className="mb-3 text-base font-extrabold">Reservation Table</h3>
        <div className="mb-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by customer, vehicle, ID…" className={inp} />
        </div>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Loading bookings…</div> : paged.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No bookings found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-3">Booking</th><th className="pb-2 pr-3">Customer</th><th className="pb-2 pr-3">Vehicle</th><th className="pb-2 pr-3">Vehicle No</th>
                  <th className="pb-2 pr-3">Date From</th><th className="pb-2 pr-3">Date To</th><th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Driver</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Paid</th>
                  <th className="pb-2 pr-3">Remaining Due</th><th className="pb-2 pr-3">Total</th><th className="pb-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((b) => {
                  const isPd = b.is_paid || Number(b.paid_amount || 0) > 0;
                  return (
                    <tr key={b.id} className={`border-b border-slate-100 dark:border-white/5 transition ${b.status === 'active' ? 'bg-blue-50/70 dark:bg-blue-500/10' : b.status === 'completed' ? 'bg-slate-50/50 dark:bg-slate-500/5' : ''}`}>
                      <td className="py-3 pr-3">
                        <button onClick={() => openDetail(b)} className="text-left font-bold text-[#1f7668] underline decoration-[#1f7668]/30 underline-offset-2 hover:text-[#185f54] dark:text-emerald-300">{b.booking_code || b.id?.slice(0, 8)}</button>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{b.pickup_time || '10:00'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        {b.notes && <p className="mb-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">User: {b.notes.slice(0, 60)}{b.notes.length > 60 ? '…' : ''}</p>}
                        <p className="font-semibold">{b.customer_name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{b.customer_email || '-'}</p>
                        <p className="text-xs text-slate-500">{b.customer_phone || '-'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{b.vehicles?.name || 'N/A'}</p>
                        {b.vehicles?.category && <p className="text-xs text-slate-500">{b.vehicles.category}</p>}
                      </td>
                      <td className="py-3 pr-3 text-xs font-medium text-[#1f7668]">
                        {b.vehicles?.vehicle_number || '—'}
                      </td>
                      <td className="py-3 pr-3 text-xs">{b.start_date || '-'}</td>
                      <td className="py-3 pr-3 text-xs">{b.end_date || '-'}</td>
                      <td className="py-3 pr-3 text-xs">{b.vehicles?.category || '—'}</td>
                      <td className="py-3 pr-3 text-xs">{String(b.driver_option || 'self_drive').includes('with') ? 'With Driver' : 'Self Drive'}</td>
                      <td className="py-3 pr-3">
                        <select value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)} className={statusSelectCls(b.status)}>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col gap-1">
                          <button onClick={async () => {
                            if (isPd) {
                              await supabase.from('vehicle_bookings').update({ payment_status: 'unpaid', is_paid: false, paid_amount: 0, remaining_amount: b.total_amount }).eq('id', b.id);
                            } else {
                              await supabase.from('vehicle_bookings').update({ payment_status: 'completed', is_paid: true, paid_amount: b.total_amount, remaining_amount: 0 }).eq('id', b.id);
                            }
                            await fetch_();
                          }} className={`${paymentPill(b.payment_status || (isPd ? 'paid' : 'unpaid'))} cursor-pointer`} title="Click to toggle">{isPd ? 'Paid' : 'Unpaid'}</button>
                          <span className="text-[11px] text-slate-500">Paid {fmtNpr(b.paid_amount || 0)}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col gap-1">
                          <span className={`${remainingDuePill(b.remaining_amount)}`}>{fmtNpr(b.remaining_amount || 0)}</span>
                          {(b.remaining_amount || 0) > 0 && (
                            <button 
                              onClick={() => handleCollectDue(b, true)}
                              className="rounded-full bg-emerald-500 p-1 text-white shadow hover:bg-emerald-600 flex items-center justify-center w-fit"
                              title="Collect full remaining payment"
                            >
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-semibold">{fmtNpr(b.total_amount)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => openDetail(b)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-slate-100 dark:border-white/10" title="View">
                            <span className="material-symbols-outlined text-[14px] align-middle">visibility</span>
                          </button>
                          <button onClick={() => { setDetail(b); openEdit(b); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-slate-100 dark:border-white/10" title="Edit">
                            <span className="material-symbols-outlined text-[14px] align-middle">edit</span>
                          </button>
                          <button onClick={() => handleDelete(b.id)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30" title="Delete">
                            <span className="material-symbols-outlined text-[14px] align-middle">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filtered.length} bookings • Page {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
            </div>
          </div>
        )}
      </section>

      <section className={`${panel} p-4 sm:p-5`}>
        <h3 className="text-base font-extrabold">Next 7-Day Occupancy</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          {occupancy.map((tile, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{tile.weekday}</p>
              <p className="mt-2 text-sm font-semibold">{tile.dateLabel}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tile.count} booking{tile.count === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trash Bookings - Cancelled Bookings Section */}
      {(() => {
        const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
        if (cancelledBookings.length === 0) return null;
        
        return (
          <section className={`${panel} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500">delete</span>
                Trash Bookings (Cancelled)
              </h3>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">{cancelledBookings.length} cancelled</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Cancelled bookings are shown here. Vehicle dates are now available for new bookings.</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="pb-2 pr-3">Booking</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3">Vehicle</th>
                    <th className="pb-2 pr-3">Dates</th>
                    <th className="pb-2 pr-3">Cancelled Date</th>
                    <th className="pb-2 pr-3">Total</th>
                    <th className="pb-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledBookings.slice(0, 10).map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 dark:border-white/5 bg-rose-50/30 dark:bg-rose-500/5">
                      <td className="py-3 pr-3">
                        <span className="font-mono text-xs text-slate-500">{b.id?.slice(0, 8)}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-600">{b.customer_name || 'N/A'}</p>
                        <p className="text-xs text-slate-400">{b.customer_phone || '-'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-600">{b.vehicles?.name || 'N/A'}</p>
                        <p className="text-xs text-slate-400">{b.vehicles?.vehicle_number || '-'}</p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {b.start_date} → {b.end_date}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {b.updated_at ? new Date(b.updated_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-600">{fmtNpr(b.total_amount)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex gap-1">
                          <button 
                            onClick={async () => {
                              if (!confirm('Restore this booking? Vehicle availability will be blocked again.')) return;
                              await supabase.from('vehicle_bookings').update({ status: 'pending' }).eq('id', b.id);
                              await fetch_();
                            }} 
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            title="Restore booking"
                          >
                            <span className="material-symbols-outlined text-[14px] align-middle">restore</span>
                          </button>
                          <button 
                            onClick={() => handleDelete(b.id)} 
                            className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            title="Delete permanently"
                          >
                            <span className="material-symbols-outlined text-[14px] align-middle">delete_forever</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cancelledBookings.length > 10 && (
                <p className="mt-2 text-xs text-slate-500 text-center">...and {cancelledBookings.length - 10} more cancelled bookings</p>
              )}
            </div>
          </section>
        );
      })()}

      {/* Create Manual Booking Modal */}
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
                          const selected = vehicles.find(v => v.id === e.target.value);
                          if (selected) setVehicleSearch(selected.name);
                        }} 
                        required 
                        className={inp}
                        size={Math.min(5, filteredVehicles.length + 1)}
                      >
                        <option value="">Select Vehicle</option>
                        {filteredVehicles.map(v => {
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
                      setCreateForm({ ...createForm, paid_amount: val });
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
                  <textarea rows="2" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} className={inp}></textarea>
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

      {/* Invoice Modal */}
      {billModalState.show && (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-gray-100">
          <div className="min-h-screen">
            <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center">
              <h2 className="text-lg font-bold">Invoice Preview</h2>
              <button 
                onClick={closeBillModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Close
              </button>
            </div>
            <Invoice booking={billModalState.booking} />
          </div>
        </div>
      )}

      {/* Vehicle Inspection Modal */}
      {showInspection && inspectionBooking && (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-slate-100 dark:bg-slate-900">
          <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between items-center shadow">
            <h2 className="text-lg font-bold">Vehicle Inspection</h2>
            <button 
              onClick={() => { setShowInspection(false); setInspectionBooking(null); }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-semibold"
            >
              ✕ Close
            </button>
          </div>
          <div className="min-h-screen p-4 sm:p-6">
            <VehicleInspection
              booking={inspectionBooking}
              inspectionType={inspectionType}
              onComplete={async () => {
                setShowInspection(false);
                setInspectionBooking(null);
                const fresh = await fetch_();
                if (detail?.id === inspectionBooking.id) {
                  setDetail(fresh.find(b => b.id === inspectionBooking.id) || null);
                }
              }}
              onCancel={() => {
                setShowInspection(false);
                setInspectionBooking(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
