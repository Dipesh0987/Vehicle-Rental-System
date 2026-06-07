import supabase from '../lib/supabase';

export async function initiateEsewaPayment(bookingId, amount) {
  const { data, error } = await supabase.functions.invoke('esewa-payment', {
    body: { booking_id: bookingId, amount },
  });
  if (error) throw error;
  return data;
}

export async function verifyPayment(transactionData) {
  const { data, error } = await supabase.functions.invoke('esewa-payment', {
    body: { action: 'verify', ...transactionData },
  });
  if (error) throw error;
  return data;
}

export async function getPaymentByBookingId(bookingId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPaymentReceipt(paymentId) {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listUserPayments(userId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*, bookings(vehicle_id, start_date, end_date, vehicles(name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
