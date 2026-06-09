import supabase from '@/lib/supabase';

const SERVICE_FEE_RATE = 0.05;

export interface QuoteResult {
  base: number;
  serviceFee: number;
  discountAmount: number;
  discountPercent: number;
  total: number;
  days: number;
}

export function calculateQuote({ 
  pricePerDay, 
  days, 
  discountPercent = 0, 
  discountAmount = 0, 
  discountType = 'percent' 
}: {
  pricePerDay: number;
  days: number;
  discountPercent?: number;
  discountAmount?: number;
  discountType?: string;
}): QuoteResult {
  const base = pricePerDay * days;
  const serviceFee = Math.round(base * SERVICE_FEE_RATE);
  const subtotal = base + serviceFee;
  
  let finalDiscountAmount = 0;
  if (discountType === 'npr_amount' && discountAmount > 0) {
    finalDiscountAmount = Math.min(discountAmount, subtotal);
  } else if (discountPercent > 0) {
    finalDiscountAmount = Math.round(subtotal * (discountPercent / 100));
  }
  
  const total = subtotal - finalDiscountAmount;

  return { base, serviceFee, discountAmount: finalDiscountAmount, discountPercent, total, days };
}

export async function checkAvailability(vehicleId: string, startDate: string, endDate: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .in('status', ['confirmed', 'pending', 'active'])
    .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

  if (error) throw error;
  return !data || data.length === 0;
}

export async function validatePromoCode(code: string) {
  const { data, error } = await supabase.rpc('validate_discount_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data;
}

export async function createBooking(payload: any) {
  const isAvailable = await checkAvailability(payload.vehicle_id, payload.start_date, payload.end_date);
  if (!isAvailable) throw new Error('Vehicle is not available for selected dates.');

  const { data: session } = await supabase.auth.getSession();
  let userId = session?.session?.user?.id || null;

  if (!userId && (payload.customer_phone || payload.customer_email)) {
    try {
      const normalizePhone = (p: string) => p?.replace(/[\s\-\+]/g, '').toLowerCase() || '';
      const phoneKey = normalizePhone(payload.customer_phone);
      
      let existingProfile = null;
      
      if (phoneKey) {
        const { data: phoneMatch } = await supabase
          .from('user_profiles')
          .select('id, email, phone')
          .ilike('phone', `%${phoneKey}%`)
          .maybeSingle();
        if (phoneMatch) existingProfile = phoneMatch;
      }
      
      if (!existingProfile && payload.customer_email) {
        const { data: emailMatch } = await supabase
          .from('user_profiles')
          .select('id, email, phone')
          .eq('email', payload.customer_email)
          .maybeSingle();
        if (emailMatch) existingProfile = emailMatch;
      }
      
      if (existingProfile) {
        userId = existingProfile.id;
        const updates: any = {};
        if (payload.customer_phone && !existingProfile.phone) updates.phone = payload.customer_phone;
        if (payload.customer_email && !existingProfile.email) updates.email = payload.customer_email;
        if (Object.keys(updates).length > 0) {
          await supabase.from('user_profiles').update(updates).eq('id', existingProfile.id);
        }
      } else {
        const { data: newProfile, error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            full_name: payload.customer_name,
            email: payload.customer_email || null,
            phone: payload.customer_phone || null,
            verification_status: 'guest',
            role: 'customer'
          })
          .select()
          .single();
        
        if (!profileError && newProfile) {
          userId = newProfile.id;
        }
      }
    } catch (_) {}
  }

  // Combine pickup/dropoff location with notes since bookings is a view
  const combinedNotes = [
    payload.pickup_location ? `Pickup: ${payload.pickup_location}` : '',
    payload.dropoff_location ? `Dropoff: ${payload.dropoff_location}` : '',
    payload.notes || ''
  ].filter(Boolean).join(' | ');

  const bookingData = {
    user_id: userId,
    vehicle_id: payload.vehicle_id,
    start_date: payload.start_date,
    end_date: payload.end_date,
    pickup_time: payload.pickup_time || '10:00',
    driver_option: payload.driver_option || 'self_drive',
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    customer_phone: payload.customer_phone,
    notes: combinedNotes,
    coupon_code: payload.coupon_code || null,
    discount_percent: payload.discount_percent || 0,
    discount_amount: payload.discount_amount || 0,
    base_amount: payload.base_amount || 0,
    service_fee: payload.service_fee || 0,
    tax_amount: 0,
    total_amount: payload.total_amount || 0,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert(bookingData)
    .select()
    .single();

  if (error) throw error;

  if (!userId && data) {
    try {
      if (typeof window !== 'undefined') {
        const guestBookings = JSON.parse(localStorage.getItem('guestBookings') || '[]');
        guestBookings.push({
          id: data.id,
          email: payload.customer_email,
          phone: payload.customer_phone,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('guestBookings', JSON.stringify(guestBookings));
      }
    } catch (_) {}
  }

  if (userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'booking',
        title: 'Booking Submitted',
        body: `Your reservation for ${payload.customer_name || 'a vehicle'} from ${payload.start_date} to ${payload.end_date} has been submitted and is pending confirmation.`,
        message: 'Booking submitted successfully',
        link_url: `/my-bookings?highlight=${data.id}`,
        metadata: { booking_id: data.id, status: 'pending' },
      });
    } catch (_) {}
  }

  try {
    await supabase.from('notifications').insert({
      user_id: null,
      is_admin: true,
      type: 'booking',
      title: `New Booking from ${payload.customer_name || 'a customer'}`,
      body: `${payload.customer_name} booked a vehicle from ${payload.start_date} to ${payload.end_date}. Total: NPR ${Number(payload.total_amount || 0).toLocaleString()}.`,
      message: 'New booking requires confirmation',
      link_url: '/admin/bookings',
      metadata: { booking_id: data.id, customer_name: payload.customer_name, total: payload.total_amount },
    });
  } catch (_) {}

  return data;
}

export async function getUserBookings(userId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, brand, model, image_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateBookingStatus(bookingId: string, status: string, metadata: any = {}) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status, ...metadata, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function requestBookingCancellation(bookingId: string, reason: string) {
  // Try the RPC first; if it doesn't exist, fall back to direct update
  const { data, error } = await supabase.rpc('request_booking_cancellation', {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  
  if (error) {
    // Fallback: if the RPC function doesn't exist, update directly
    if (error.message?.includes('function') || error.message?.includes('does not exist') || error.message?.includes('not found') || error.code === '42883') {
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', notes: reason })
        .eq('id', bookingId);
      if (updateErr) throw updateErr;
      return { success: true };
    }
    throw error;
  }
  return data;
}
