import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getPaymentByBookingId } from '../services/payment.service';
import supabase from '../lib/supabase';

function useCountdown(deadline) {
  const [remaining, setRemaining] = useState(() => {
    if (!deadline) return 0;
    return Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');
  return { remaining, display: `${mins}:${secs}` };
}

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking');

  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [method, setMethod] = useState('online'); // 'online' | 'cash'
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const fileRef = useRef(null);

  // Fetch QR code from settings
  const fetchQRCode = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_qr_image')
        .single();
      
      if (data?.setting_value) {
        setQrImageUrl(data.setting_value);
      }
    } catch (err) {
      console.error('Error fetching QR code:', err);
    }
  };

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    (async () => {
      try {
        const [{ data }, _, __] = await Promise.all([
          supabase.from('bookings').select('*, vehicles(name, brand, model, image_url)').eq('id', bookingId).single(),
          fetchQRCode(),
          (async () => {
            const existingPayment = await getPaymentByBookingId(bookingId);
            if (existingPayment) setPayment(existingPayment);
          })()
        ]);
        setBooking(data);
      } catch { setError('Failed to load booking details.'); } finally { setLoading(false); }
    })();
  }, [bookingId]);

  const timer = useCountdown(booking?.payment_deadline);

  const handleReceiptUpload = async () => {
    if (!receiptFile || !booking) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const ext = receiptFile.name.split('.').pop();
      const path = `receipts/${bookingId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('payment-receipts').upload(path, receiptFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path);
      const receiptUrl = urlData?.publicUrl || path;

      // Create payment record (receipt stored in storage bucket)
      const { data: paymentData, error: payErr } = await supabase.from('payments').insert({
        booking_id: bookingId,
        user_id: booking.user_id,
        customer_user_id: booking.user_id,
        customer_email: booking.customer_email,
        customer_name: booking.customer_name,
        payment_method: 'online',
        amount: Number(booking.total_amount || 0),
        total_booking_amount: Number(booking.total_amount || 0),
        currency: 'NPR',
        status: 'pending',
        method: 'online_transfer',
      }).select().single();
      if (payErr) throw payErr;

      setPayment(paymentData);

      // User notification (if logged in)
      try {
        if (booking.user_id) {
          await supabase.from('notifications').insert({
            user_id: booking.user_id,
            type: 'payment',
            title: 'Payment Receipt Submitted',
            body: 'Your payment receipt has been submitted and is awaiting admin confirmation.',
            link_url: `/my-bookings?highlight=${bookingId}`,
            metadata: { booking_id: bookingId },
          });
        }
      } catch (_) {}

      // Admin notification
      try {
        await supabase.from('notifications').insert({
          user_id: null, is_admin: true,
          type: 'payment',
          title: `Payment Receipt from ${booking.customer_name}`,
          body: `${booking.customer_name} uploaded a payment receipt of NPR ${Number(booking.total_amount || 0).toLocaleString()} for booking ${bookingId.slice(0, 8)}. Please verify.`,
          link_url: '/admin/payments',
          metadata: { booking_id: bookingId, amount: booking.total_amount },
        });
      } catch (_) {}

      setSuccess('Payment receipt uploaded! Admin will verify and confirm your booking.');
    } catch (err) { setError(err.message || 'Upload failed.'); } finally { setUploading(false); }
  };

  const handleCashPayment = async () => {
    if (!booking) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const { data: paymentData, error: payErr } = await supabase.from('payments').insert({
        booking_id: bookingId,
        user_id: booking.user_id,
        customer_user_id: booking.user_id,
        customer_email: booking.customer_email,
        customer_name: booking.customer_name,
        payment_method: 'cash',
        amount: Number(booking.total_amount || 0),
        total_booking_amount: Number(booking.total_amount || 0),
        currency: 'NPR',
        status: 'pending',
        method: 'cash',
      }).select().single();
      if (payErr) throw payErr;

      // Payment record created - no need to update bookings view
      setPayment(paymentData);

      // Admin notification
      try {
        await supabase.from('notifications').insert({
          user_id: null, is_admin: true,
          type: 'payment',
          title: `Cash Payment selected by ${booking.customer_name}`,
          body: `${booking.customer_name} chose to pay NPR ${Number(booking.total_amount || 0).toLocaleString()} in cash for booking ${bookingId.slice(0, 8)}.`,
          link_url: '/admin/payments',
          metadata: { booking_id: bookingId, amount: booking.total_amount, method: 'cash' },
        });
      } catch (_) {}

      setSuccess('Cash payment selected! Please pay in person when picking up the vehicle. Admin will confirm.');
    } catch (err) { setError(err.message || 'Failed to register cash payment.'); } finally { setUploading(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center rounded-3xl border border-[#d5e0db] bg-white p-8">
          <span className="material-symbols-outlined text-4xl mb-3 block text-[#5a7376]">receipt_long</span>
          <h2 className="text-lg font-bold mb-1 text-[#12373b]">No booking found</h2>
          <Link to="/vehicles" className="text-[13px] font-semibold text-accent">Browse vehicles</Link>
        </div>
      </div>
    );
  }

  const vehicleName = booking.vehicles?.name || 'Vehicle';
  const totalAmount = Number(booking.total_amount || 0);
  const isPaid = payment?.status === 'completed' || payment?.status === 'verified';
  const isReceiptSubmitted = payment?.status === 'pending' && payment;

  return (
    <main className="vrs-theme-scope mx-auto w-[95%] max-w-[1280px] pb-14">
      <section className="rounded-[34px] border border-[rgba(23,57,60,0.14)] bg-[linear-gradient(150deg,rgba(255,255,255,0.93),rgba(246,239,229,0.84))] p-5 shadow-[0_24px_52px_rgba(10,31,34,0.1)] backdrop-blur-sm sm:p-7">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3c6667]">Secure Payment</p>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-[#12373b] sm:text-[34px]">Complete Your Payment</h1>
            <p className="mt-1 max-w-[720px] text-[13.5px] text-[#3d5f61]">Choose Online or Cash payment. Upload your receipt for online payments — admin will confirm.</p>
          </div>
          <Link to="/my-bookings" className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#264447] transition duration-200 hover:-translate-y-[1px] hover:bg-[#f3f8f6]">My Bookings</Link>
        </div>

        {/* 15-min Timer */}
        {booking.payment_deadline && timer.remaining > 0 && !isPaid && !isReceiptSubmitted && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-center ${timer.remaining < 120 ? 'border-rose-300 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-[13px] font-semibold ${timer.remaining < 120 ? 'text-rose-700' : 'text-amber-700'}`}>
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">timer</span>
              Time remaining to complete payment: <span className="font-mono font-bold text-[16px]">{timer.display}</span>
            </p>
            <p className={`text-[11px] mt-0.5 ${timer.remaining < 120 ? 'text-rose-600' : 'text-amber-600'}`}>Booking may be cancelled if payment is not completed in time.</p>
          </div>
        )}
        {booking.payment_deadline && timer.remaining <= 0 && !isPaid && !isReceiptSubmitted && (
          <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-center">
            <p className="text-[13px] font-semibold text-rose-700">Payment window has expired. Please contact support or create a new booking.</p>
          </div>
        )}

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">{error}</div>}
        {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700">{success}</div>}

        {isPaid ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
            <p className="text-[20px] font-extrabold">Payment Confirmed</p>
            <p className="mt-1 text-[13.5px]">Your booking has been paid and confirmed.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/" className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white">Back to home</Link>
              <Link to="/my-bookings" className="rounded-full border border-emerald-300 bg-white px-5 py-2 text-[13px] font-semibold text-emerald-700">View Bookings</Link>
            </div>
          </div>
        ) : isReceiptSubmitted ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            <p className="text-[20px] font-extrabold">Receipt Submitted — Awaiting Confirmation</p>
            <p className="mt-1 text-[13.5px]">Admin will review your payment and confirm the booking. You'll be notified once it's done.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/my-bookings" className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white">View Bookings</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.35fr,0.95fr] lg:items-start">
            {/* Left: Payment methods */}
            <div className="space-y-4">
              {/* Method toggle */}
              <div className="flex rounded-2xl border border-[#d5e0db] bg-white p-1 shadow-[0_4px_12px_rgba(10,31,34,0.06)]">
                <button onClick={() => setMethod('online')} className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition ${method === 'online' ? 'bg-[#14373b] text-white shadow' : 'text-[#3d5f61] hover:bg-[#f3f8f6]'}`}>
                  <span className="material-symbols-outlined text-[16px] align-middle mr-1">account_balance</span> Online Payment
                </button>
                <button onClick={() => setMethod('cash')} className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition ${method === 'cash' ? 'bg-[#14373b] text-white shadow' : 'text-[#3d5f61] hover:bg-[#f3f8f6]'}`}>
                  <span className="material-symbols-outlined text-[16px] align-middle mr-1">payments</span> Cash Payment
                </button>
              </div>

              {method === 'online' ? (
                <div className="rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-5 shadow-[0_14px_30px_rgba(10,31,34,0.08)] space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Online Transfer</p>
                    <h2 className="mt-1 text-[20px] font-bold text-[#14373b]">Scan QR & Upload Receipt</h2>
                    <p className="mt-1 text-[13px] text-[#3d5f61]">Scan the QR code below to pay, then upload a screenshot of your payment confirmation.</p>
                  </div>

                  {/* QR Code - Dynamic from Admin */}
                  <div className="rounded-2xl border border-[#d8e3de] bg-white p-5 text-center shadow-[0_10px_20px_rgba(10,31,34,0.06)]">
                    {qrImageUrl ? (
                      <>
                        <div className="mx-auto w-[200px] h-[200px] rounded-xl border-2 border-dashed border-[#c8dcd6] bg-[#f9fcfa] flex items-center justify-center overflow-hidden">
                          <img src={qrImageUrl} alt="Payment QR Code" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span class="text-[13px] text-[#5a7376]">QR code not available.<br/>Contact admin for bank details.</span>'; }} />
                        </div>
                        <p className="mt-2 text-[12px] font-semibold text-[#3d5f61]">Scan to pay NPR {totalAmount.toLocaleString()}</p>
                        <p className="text-[11px] text-[#5a7a7d]">eSewa / Khalti / Bank Transfer</p>
                      </>
                    ) : (
                      <div className="py-6 text-center">
                        <span className="material-symbols-outlined text-[48px] text-[#c8dcd6]">qr_code</span>
                        <p className="mt-2 text-[13px] text-[#5a7376]">QR code not configured</p>
                        <p className="text-[11px] text-[#5a7a7d]">Please contact admin for payment details</p>
                      </div>
                    )}
                  </div>

                  {/* Receipt Upload */}
                  <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-[0_10px_20px_rgba(10,31,34,0.06)]">
                    <p className="text-[12px] font-semibold text-[#315154] mb-2">Upload Payment Receipt</p>
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="cursor-pointer rounded-xl border-2 border-dashed border-[#c8dcd6] bg-[#f9fcfa] px-4 py-6 text-center transition hover:border-[#2c766e] hover:bg-[#f3faf8]"
                    >
                      <span className="material-symbols-outlined text-[32px] text-[#2c766e]">cloud_upload</span>
                      <p className="mt-1 text-[13px] font-semibold text-[#3d5f61]">{receiptFile ? receiptFile.name : 'Click to select receipt image'}</p>
                      <p className="text-[11px] text-[#5a7a7d]">JPG, PNG, or PDF — Max 5MB</p>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />

                    <button onClick={handleReceiptUpload} disabled={!receiptFile || uploading} type="button"
                      className="mt-3 w-full rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(217,136,79,0.3)] transition duration-200 hover:-translate-y-[1px] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                      {uploading ? 'Uploading…' : 'Submit Payment Receipt'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-5 shadow-[0_14px_30px_rgba(10,31,34,0.08)] space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Cash Payment</p>
                    <h2 className="mt-1 text-[20px] font-bold text-[#14373b]">Pay at Pickup</h2>
                    <p className="mt-1 text-[13px] text-[#3d5f61]">Select this option to pay the full amount in cash when you pick up the vehicle. Admin will confirm your booking upon payment.</p>
                  </div>

                  <div className="rounded-2xl border border-[#c8dcd6] bg-[#f4faf7] p-4 text-center">
                    <span className="material-symbols-outlined text-[40px] text-[#1f5b57]">account_balance_wallet</span>
                    <p className="mt-2 text-[20px] font-extrabold text-[#1a4a3a]">NPR {totalAmount.toLocaleString()}</p>
                    <p className="mt-1 text-[12px] text-[#4f6d5e]">Amount due at vehicle pickup</p>
                  </div>

                  <button onClick={handleCashPayment} disabled={uploading} type="button"
                    className="w-full rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(217,136,79,0.3)] transition duration-200 hover:-translate-y-[1px] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                    {uploading ? 'Processing…' : 'Confirm Cash Payment'}
                  </button>
                </div>
              )}
            </div>

            {/* Right: Booking summary */}
            <aside className="space-y-4">
              <div className="rounded-3xl border border-[#d5e0db] bg-[linear-gradient(155deg,#14373b,#1a5752)] p-5 text-white shadow-[0_14px_30px_rgba(10,31,34,0.15)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Booking Summary</p>
                <h2 className="mt-1 text-[20px] font-bold">{vehicleName}</h2>
                <p className="text-[13px] text-white/70">Reservation <span className="font-mono font-semibold">{booking.reservation_code || booking.id?.slice(0, 8)}</span></p>

                <div className="mt-4 space-y-2 text-[13px]">
                  <div className="flex items-center justify-between border-b border-white/15 pb-2"><span className="text-white/70">Travel dates</span><strong>{booking.start_date} → {booking.end_date}</strong></div>
                  <div className="flex items-center justify-between border-b border-white/15 pb-2"><span className="text-white/70">Driver option</span><strong>{booking.driver_option === 'with_driver' ? 'With Driver' : 'Self Drive'}</strong></div>
                  <div className="flex items-center justify-between border-b border-white/15 pb-2"><span className="text-white/70">Customer</span><strong>{booking.customer_name}</strong></div>
                  <div className="flex items-center justify-between pb-2"><span className="text-white/70">Email</span><strong>{booking.customer_email}</strong></div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/10 p-3 text-[13px]">
                  <div className="flex items-center justify-between"><span className="text-white/78">Total Amount</span><strong className="text-[#f4d3a4] text-[16px]">NPR {totalAmount.toLocaleString()}</strong></div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-5 shadow-[0_14px_30px_rgba(10,31,34,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">How it works</p>
                <div className="mt-3 space-y-3 text-[13px] text-[#3d5f61]">
                  <div className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2c766e] text-[10px] font-bold text-white">1</span><span><strong>Choose payment method</strong> — Online or Cash</span></div>
                  <div className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2c766e] text-[10px] font-bold text-white">2</span><span><strong>Online:</strong> Scan QR, pay, upload receipt</span></div>
                  <div className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2c766e] text-[10px] font-bold text-white">3</span><span><strong>Admin verifies</strong> and confirms your booking</span></div>
                </div>
              </div>

              <button onClick={() => navigate('/')} type="button" className="w-full rounded-full border border-[#d0dbd6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#264447] transition hover:-translate-y-[1px] hover:bg-[#f3f8f6]">Cancel and go home</button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
