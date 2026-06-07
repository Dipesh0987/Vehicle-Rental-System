import supabase from '../lib/supabase';

export async function listUserRefunds(userId) {
  const { data, error } = await supabase
    .from('refunds')
    .select('*, bookings(vehicle_id, start_date, end_date, vehicles(name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getRefundByBookingId(bookingId) {
  const { data, error } = await supabase
    .from('refunds')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkRefundEligibility(bookingId) {
  const { data, error } = await supabase.rpc('calculate_refund_eligibility', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data;
}

export async function initiateRefund(bookingId, reason) {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) throw new Error('Must be signed in.');
  const userId = session.session.user.id;

  const { data, error } = await supabase
    .from('refunds')
    .insert({
      booking_id: bookingId,
      user_id: userId,
      reason,
      status: 'requested',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function formatRefundAmount(amount) {
  return `NPR ${Number(amount || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;
}
