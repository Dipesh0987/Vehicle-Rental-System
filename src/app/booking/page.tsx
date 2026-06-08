'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getVehicleById } from '@/services/vehicle-catalog.service';
import { createBooking, calculateQuote, checkAvailability, validatePromoCode } from '@/services/booking.service';
import { validateNepalPhone, validateEmail, validateName, validateNotPastDate, validateDateRange, validateLocation } from '@/lib/validations';
import { useToast } from '@/components/Toast';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const vehicleId = searchParams.get('vehicle');

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(searchParams.get('start') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end') || '');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [driverOption, setDriverOption] = useState('self_drive');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [couponMsg, setCouponMsg] = useState('');

  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Scroll to and focus the first field that has a validation error
  const focusField = (key: string) => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(`field-${key}`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Delay focus slightly so the smooth scroll isn't interrupted
      setTimeout(() => { try { el.focus({ preventScroll: true }); } catch {} }, 250);
    }
  };

  useEffect(() => {
    if (!vehicleId) { setLoading(false); return; }
    const cached = sessionStorage.getItem('bookingVehicle');
    if (cached) {
      try { setVehicle(JSON.parse(cached)); setLoading(false); return; } catch {}
    }
    getVehicleById(vehicleId).then(setVehicle).catch(() => {}).finally(() => setLoading(false));
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId || !startDate || !endDate) { setAvailable(null); return; }
    checkAvailability(vehicleId, startDate, endDate).then(setAvailable).catch(() => setAvailable(null));
  }, [vehicleId, startDate, endDate]);

  const days = startDate && endDate ? Math.max(1, Math.ceil((Number(new Date(endDate)) - Number(new Date(startDate))) / 86400000)) : 0;
  const quote = vehicle && days > 0 ? calculateQuote({ pricePerDay: vehicle.pricePerDay, days, discountPercent: discountPercent, discountAmount: discountAmount, discountType: discountType }) : null;

  const handleApplyCoupon = async () => {
    setCouponMsg('');
    if (!couponCode.trim()) return;
    try {
      const result = await validatePromoCode(couponCode);
      if (result?.valid) { 
        setDiscountType(result.discount_type || 'percent');
        setDiscountPercent(Number(result.discount_percent) || 0); 
        setDiscountAmount(Number(result.discount_amount) || 0); 
        const discountLabel = result.discount_type === 'npr_amount' 
          ? `Coupon applied: NPR ${Number(result.discount_amount || 0).toLocaleString()} off!`
          : `Coupon applied: ${Number(result.discount_percent || 0)}% off!`;
        setCouponMsg(discountLabel); 
      }
      else { 
        setDiscountPercent(0); 
        setDiscountAmount(0);
        setDiscountType('percent');
        setCouponMsg('Invalid or expired coupon code.'); 
      }
    } catch { setCouponMsg('Failed to validate coupon.'); }
  };

  const handleReview = () => {
    setError('');
    const errors: Record<string, string> = {};
    
    // Date validations
    if (!startDate) {
      errors.startDate = 'Please choose your pick-up date.';
    } else {
      const startValidation = validateNotPastDate(startDate);
      if (!startValidation.valid) errors.startDate = startValidation.message;
    }
    
    if (!endDate) {
      errors.endDate = 'Please choose your drop-off date.';
    } else if (startDate) {
      const rangeValidation = validateDateRange(startDate, endDate);
      if (!rangeValidation.valid) errors.endDate = rangeValidation.message;
    }
    
    // Name validation
    const nameValidation = validateName(customerName);
    if (!nameValidation.valid) errors.customerName = nameValidation.message;
    
    // Phone validation (Nepal format)
    if (!customerPhone) {
      errors.customerPhone = 'Please enter your phone number.';
    } else {
      const phoneValidation = validateNepalPhone(customerPhone);
      if (!phoneValidation.valid) errors.customerPhone = phoneValidation.message;
    }
    
    // Email validation (optional but must be valid if provided)
    if (customerEmail) {
      const emailValidation = validateEmail(customerEmail);
      if (!emailValidation.valid) errors.customerEmail = emailValidation.message;
    }
    
    // Location validations (allow letters + numbers, but not only numbers)
    const pickupValidation = validateLocation(pickupLocation);
    if (!pickupValidation.valid) errors.pickupLocation = pickupValidation.message;

    const dropoffValidation = validateLocation(dropoffLocation);
    if (!dropoffValidation.valid) errors.dropoffLocation = dropoffValidation.message;
    
    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      // Focus + scroll to the first field with an error, in form order
      const order = ['startDate', 'endDate', 'pickupLocation', 'dropoffLocation', 'customerName', 'customerEmail', 'customerPhone'];
      const firstErrorKey = order.find((k) => errors[k]);
      if (firstErrorKey) {
        focusField(firstErrorKey);
        toast.error(errors[firstErrorKey]);
      } else {
        toast.error('Please fix the highlighted fields.');
      }
      setError('Please fix the highlighted fields below.');
      return;
    }
    
    if (available === false) { 
      setError('This vehicle is not available for the selected dates. Please pick different dates.'); 
      toast.error('Vehicle not available for the selected dates.');
      return; 
    }
    setReviewOpen(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true); setError('');
    try {
      const result = await createBooking({
        vehicle_id: vehicleId, start_date: startDate, end_date: endDate, pickup_time: pickupTime,
        driver_option: driverOption, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone,
        pickup_location: pickupLocation, dropoff_location: dropoffLocation, notes, coupon_code: couponCode || null, discount_percent: discountPercent, discount_amount: quote?.discountAmount || 0,
        base_amount: quote?.base || 0, service_fee: quote?.serviceFee || 0, total_amount: quote?.total || 0,
      });
      router.push(`/payment?booking=${result.id}`);
    } catch (err: any) { setError(err.message); setReviewOpen(false); } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>;
  }

  const inputCls = "h-12 rounded-xl border border-[#d2dfda] bg-[#fbfdfc] px-3 py-2 text-[14px] outline-none transition focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(44,118,110,0.16)]";

  return (
    <div className="vrs-page min-h-screen bg-white font-poppins">
      <main id="app" className="vrs-theme-scope min-h-screen">
        <Header />
        <div className="mx-auto w-[95%] max-w-[1390px] pb-14">
      <section className="booking-form-shell rounded-[34px] border border-[rgba(23,57,60,0.14)] bg-[linear-gradient(150deg,rgba(255,255,255,0.93),rgba(246,239,229,0.84))] p-5 shadow-[0_24px_52px_rgba(10,31,34,0.1)] backdrop-blur-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3c6667]">Booking Command Center</p>
            <h1 className="mt-1 text-[30px] font-extrabold leading-tight text-[#12373b] sm:text-[38px]">Secure Vehicle Reservation Flow</h1>
            <p className="mt-1 max-w-[720px] text-[14px] text-[#3d5f61]">Set dates, confirm live availability, and finalize your booking with a guided review sequence.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/vehicles" className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#264447] transition duration-200 hover:-translate-y-[1px] hover:bg-[#f3f8f6] hover:text-[#183b3f]">
              Back to Vehicle Collection
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d5e2dc] bg-[#f6faf8] px-3 py-1.5 text-[12px] font-semibold text-[#2e5e5a]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#2c766e]"></span>
              <span>Live availability enabled</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr,0.95fr] lg:items-start">
          <section className="booking-form-card space-y-4 rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-4 shadow-[0_14px_30px_rgba(10,31,34,0.08)] sm:p-5">
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">{error}</div>}

            <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
              <label className="grid gap-1 content-start">
                <span className="text-[12px] font-semibold text-[#315154]">Vehicle</span>
                <input type="text" readOnly value={vehicle ? vehicle.name : 'No vehicle selected'}
                  className={`${inputCls} bg-[#f3f8f6] font-semibold text-[#2b4d50]`} />
              </label>
              <label className="grid gap-1 content-start">
                <span className="text-[12px] font-semibold text-[#315154]">Pickup Time</span>
                <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputCls} />
              </label>
              <label className="grid gap-1 content-start">
                <span className="text-[12px] font-semibold text-[#315154]">Driver Option</span>
                <select value={driverOption} onChange={(e) => setDriverOption(e.target.value)} className={inputCls}>
                  <option value="self_drive">Self Drive</option>
                  <option value="with_driver">With Driver</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Start Date <span className="text-rose-600">*</span></span>
                <input id="field-startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setFieldErrors({...fieldErrors, startDate: ''}); }} min={today} required className={`${inputCls} ${fieldErrors.startDate ? 'border-rose-400' : ''}`} />
                {fieldErrors.startDate && <span className="text-[11px] text-rose-600">{fieldErrors.startDate}</span>}
              </label>
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">End Date <span className="text-rose-600">*</span></span>
                <input id="field-endDate" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setFieldErrors({...fieldErrors, endDate: ''}); }} min={startDate || today} required className={`${inputCls} ${fieldErrors.endDate ? 'border-rose-400' : ''}`} />
                {fieldErrors.endDate && <span className="text-[11px] text-rose-600">{fieldErrors.endDate}</span>}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Pickup Location <span className="text-rose-600">*</span></span>
                <input id="field-pickupLocation" type="text" value={pickupLocation} onChange={(e) => { setPickupLocation(e.target.value); setFieldErrors({...fieldErrors, pickupLocation: ''}); }} required placeholder="e.g. Banasthali, Kathmandu" className={`${inputCls} ${fieldErrors.pickupLocation ? 'border-rose-400' : ''}`} />
                {fieldErrors.pickupLocation && <span className="text-[11px] text-rose-600">{fieldErrors.pickupLocation}</span>}
              </label>
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Dropoff Location <span className="text-rose-600">*</span></span>
                <input id="field-dropoffLocation" type="text" value={dropoffLocation} onChange={(e) => { setDropoffLocation(e.target.value); setFieldErrors({...fieldErrors, dropoffLocation: ''}); }} required placeholder="e.g. Airport, Kathmandu" className={`${inputCls} ${fieldErrors.dropoffLocation ? 'border-rose-400' : ''}`} />
                {fieldErrors.dropoffLocation && <span className="text-[11px] text-rose-600">{fieldErrors.dropoffLocation}</span>}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Full Name <span className="text-rose-600">*</span></span>
                <input id="field-customerName" type="text" value={customerName} onChange={(e) => { 
                  const val = e.target.value;
                  // Only allow letters and spaces
                  if (/^[a-zA-Z\s'-]*$/.test(val) || val === '') {
                    setCustomerName(val); 
                    setFieldErrors({...fieldErrors, customerName: ''});
                  }
                }} required placeholder="Enter your full name" className={`${inputCls} ${fieldErrors.customerName ? 'border-rose-400' : ''}`} />
                {fieldErrors.customerName && <span className="text-[11px] text-rose-600">{fieldErrors.customerName}</span>}
              </label>
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Email (Optional)</span>
                <input id="field-customerEmail" type="email" value={customerEmail} onChange={(e) => { setCustomerEmail(e.target.value); setFieldErrors({...fieldErrors, customerEmail: ''}); }} placeholder="you@example.com" className={`${inputCls} ${fieldErrors.customerEmail ? 'border-rose-400' : ''}`} />
                {fieldErrors.customerEmail && <span className="text-[11px] text-rose-600">{fieldErrors.customerEmail}</span>}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <label className="grid gap-1 content-start">
                <span className="text-[12px] font-semibold text-[#315154]">Phone <span className="text-rose-600">*</span></span>
                <input id="field-customerPhone" type="tel" value={customerPhone} onChange={(e) => { 
                  const val = e.target.value.replace(/[^\d]/g, ''); // Only digits
                  if (val.length <= 10) {
                    setCustomerPhone(val);
                    setFieldErrors({...fieldErrors, customerPhone: ''});
                  }
                }} required placeholder="98XXXXXXXX" maxLength={10} className={`${inputCls} ${fieldErrors.customerPhone ? 'border-rose-400' : ''}`} />
                {fieldErrors.customerPhone && <span className="text-[11px] text-rose-600">{fieldErrors.customerPhone}</span>}
                <span className="text-[10px] text-[#6b8285]">Nepal number: starts with 97 or 98, 10 digits</span>
              </label>
              <label className="grid gap-1 content-start">
                <span className="text-[12px] font-semibold text-[#315154]">Promo Code</span>
                <div className="flex gap-2 items-stretch">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter promo code" className={`${inputCls} w-full`} />
                  <button type="button" onClick={handleApplyCoupon}
                    className="h-12 flex items-center justify-center rounded-xl border border-[#c8d6d1] bg-white px-4 text-[13px] font-semibold text-[#2e5154] transition hover:-translate-y-[1px] hover:bg-[#f2f8f5]">Apply</button>
                </div>
                {couponMsg && <p className={`text-[12px] font-semibold ${couponMsg.includes('applied') ? 'text-[#16a34a]' : 'text-rose-700'}`}>{couponMsg}</p>}
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-[12px] font-semibold text-[#315154]">Additional Notes (Optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional requests or notes"
                className="rounded-xl border border-[#d2dfda] bg-[#fbfdfc] px-3 py-2 text-[14px] outline-none transition focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(44,118,110,0.16)]" />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d5e2dc] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2e5e5a] shadow-[0_8px_16px_rgba(10,31,34,0.07)]">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${available === true ? 'bg-[#16a34a]' : available === false ? 'bg-rose-500' : 'bg-[#2c766e]'}`}></span>
                <span>{available === true ? 'Vehicle available' : available === false ? 'Not available for these dates' : 'Choose dates to check availability'}</span>
              </div>
              <button type="button" onClick={handleReview} disabled={!quote}
                className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(217,136,79,0.3)] transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_18px_34px_rgba(217,136,79,0.36)] disabled:opacity-50 disabled:cursor-not-allowed">
                <span>Review Booking</span>
                <span className="transition group-hover:translate-x-[2px]">&rarr;</span>
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <article className="booking-solid-panel rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-4 shadow-[0_14px_30px_rgba(10,31,34,0.1)] sm:p-5 lg:sticky lg:top-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Selected Vehicle</p>
              <h2 className="mt-3 text-[24px] font-bold leading-tight text-[#14373b]">{vehicle?.name || 'Vehicle'}</h2>
              {vehicle && <p className="text-[13px] text-[#456467]">{vehicle.brand} {vehicle.model}</p>}
              <div className="booking-price-pill mt-4 rounded-2xl border border-[#f2cdae] bg-[linear-gradient(145deg,#fffaf5,#fff1e6)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8e5228]">Price Per Day</p>
                <p className="mt-1 text-[22px] font-extrabold text-[#1f5b57]">NPR {(vehicle?.pricePerDay || 0).toLocaleString()} / day</p>
              </div>

              <div className="booking-solid-panel mt-4 rounded-3xl border border-[#d5e0db] bg-white/95 p-4 shadow-[0_12px_28px_rgba(10,31,34,0.08)] sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Pricing Summary</p>
                <div className="mt-3 space-y-2 text-[13px] text-[#3d5f61]">
                  <div className="flex items-center justify-between"><span>Duration</span><span className="font-semibold text-[#24484b]">{days} days</span></div>
                  <div className="flex items-center justify-between"><span>Base</span><span className="font-semibold text-[#24484b]">NPR {(quote?.base || 0).toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Service Fee</span><span className="font-semibold text-[#24484b]">NPR {(quote?.serviceFee || 0).toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Discount</span><span className="font-semibold text-[#16a34a]">-NPR {(quote?.discountAmount || 0).toLocaleString()}</span></div>
                </div>
                <div className="booking-total-pill mt-4 rounded-2xl border border-[#f2d3bb] bg-[#fff6ef] px-3 py-2.5">
                  <div className="flex items-center justify-between text-[13px] font-semibold text-[#7f4c22]">
                    <span>Total Due</span>
                    <span className="text-[16px] font-bold">NPR {(quote?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </article>
          </aside>
        </div>
      </section>

      <div className={`fixed inset-0 z-[260] flex items-center justify-center bg-[rgba(8,22,24,0.62)] px-4 transition duration-200 ${reviewOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="booking-review-card w-full max-w-[560px] rounded-[26px] border border-[rgba(23,57,60,0.18)] bg-[linear-gradient(155deg,#ffffff,#f6efe4)] p-5 shadow-[0_30px_80px_rgba(2,14,16,0.46)] sm:p-6">
          <p className="booking-review-kicker text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Confirm Reservation</p>
          <h3 className="booking-review-title mt-1 text-[26px] font-extrabold text-[#14373b]">Review Booking Details</h3>
          <div className="booking-review-summary mt-3 rounded-2xl border border-[#d8e3de] bg-white p-4 text-[13px] text-[#375c5f] shadow-[0_10px_20px_rgba(10,31,34,0.08)] space-y-2">
            <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Vehicle</span><span className="font-semibold text-[#1f4043]">{vehicle?.name}</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Start Date</span><span>{startDate}</span></div>
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">End Date</span><span>{endDate}</span></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Pickup Time</span><span>{pickupTime}</span></div>
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Driver Option</span><span>{driverOption === 'with_driver' ? 'With Driver' : 'Self Drive'}</span></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Pickup Location</span><span>{pickupLocation || '-'}</span></div>
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Dropoff Location</span><span>{dropoffLocation || '-'}</span></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Customer</span><span>{customerName}</span></div>
              <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Phone</span><span>{customerPhone}</span></div>
            </div>
            <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Email</span><span>{customerEmail}</span></div>
            {couponCode && <div className="flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700"><span className="font-semibold">Promo Code</span><span className="font-bold">{couponCode}</span></div>}
            {quote && <div className="booking-review-total mt-2 rounded-xl border border-[#e4ece8] px-3 py-3">
              <div className="space-y-1 text-[12px] text-slate-600">
                <div className="flex items-center justify-between"><span>Duration</span><span className="font-semibold">{days} day{days > 1 ? 's' : ''}</span></div>
                <div className="flex items-center justify-between"><span>Base</span><span className="font-semibold">NPR {(quote.base || 0).toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span>Service Fee</span><span className="font-semibold">NPR {(quote.serviceFee || 0).toLocaleString()}</span></div>
                {Number(quote.discountAmount) > 0 && <div className="flex items-center justify-between text-[#16a34a]"><span>Discount</span><span className="font-semibold">-NPR {(quote.discountAmount || 0).toLocaleString()}</span></div>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold">Total</span>
                <span className="text-[16px] font-bold">NPR {quote.total.toLocaleString()}</span>
              </div>
            </div>}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button onClick={() => setReviewOpen(false)} className="booking-review-cancel rounded-full border border-[#d0ddd8] px-4 py-2 text-[13px] font-semibold text-[#365659] transition hover:bg-[#f3f8f6]">Back</button>
            <button onClick={handleConfirm} disabled={submitting}
              className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? 'Submitting…' : 'Submit Booking'}
            </button>
          </div>
        </div>
      </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}

export default function Booking() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>}>
      <BookingContent />
    </Suspense>
  );
}
