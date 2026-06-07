import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getPaymentReceipt } from '../services/payment.service';
import supabase from '../lib/supabase';

export default function PaymentReceipt() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get('payment');
  const [receipt, setReceipt] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) { setLoading(false); return; }
    const fetchReceipt = async () => {
      try {
        const { data: p } = await supabase.from('payments').select('*, bookings(*, vehicles(name, brand, model))').eq('id', paymentId).single();
        setPayment(p);
        const r = await getPaymentReceipt(paymentId);
        setReceipt(r);
      } catch {}
      setLoading(false);
    };
    fetchReceipt();
  }, [paymentId]);

  if (loading) {
    return (
      <div className="vrs-theme-scope mx-auto w-[95%] payment-receipt-shell text-center text-[#3d5f61] py-16">
        <span className="material-symbols-outlined animate-spin text-[40px] text-[#1f5b57]">progress_activity</span>
        <h2 className="mt-3 text-[22px] font-extrabold text-[#14373b]">Loading receipt...</h2>
        <p className="mt-1 text-[13.5px]">Pulling transaction <span className="font-mono">{paymentId?.slice(0, 8) || '-'}</span></p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center rounded-3xl border border-[#d5e0db] bg-white p-8">
          <p className="text-[14px] text-[#3d5f61]">Receipt not found.</p>
          <Link to="/" className="text-[13px] font-semibold text-accent mt-2 inline-block">Go Home</Link>
        </div>
      </div>
    );
  }

  const booking = payment.bookings;
  const vehicle = booking?.vehicles;
  const totalAmount = Number(booking?.total_amount || payment.amount || 0);
  const paidAmount = Number(payment.amount || 0);
  const baseAmount = Number(booking?.base_amount || 0);
  const serviceFee = Number(booking?.service_fee || 0);
  const taxAmount = Number(booking?.tax_amount || 0);
  const discount = Number(booking?.discount_amount || 0);

  return (
    <main className="vrs-theme-scope mx-auto w-[95%] pb-14">
      <article className="payment-receipt-shell mx-auto max-w-[760px] rounded-[34px] border border-[rgba(23,57,60,0.14)] bg-[linear-gradient(150deg,rgba(255,255,255,0.95),rgba(246,239,229,0.88))] shadow-[0_24px_52px_rgba(10,31,34,0.1)] backdrop-blur-sm overflow-hidden">
        {/* Receipt Header */}
        <div className="bg-[linear-gradient(155deg,#14373b,#1a5752)] px-6 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">Vehicle Rental Receipt</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.01em]">Receipt <span>{payment.transaction_id || payment.id?.slice(0, 8)}</span></h1>
          <p className="mt-1 text-[13px] text-white/85">Issued {new Date(payment.created_at).toLocaleString()}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer + Booking Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Customer</p>
              <div className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Name</span><strong className="text-[#14373b]">{booking?.customer_name || '-'}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Email</span><strong className="text-[#14373b]">{booking?.customer_email || '-'}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Phone</span><strong className="text-[#14373b]">{booking?.customer_phone || '-'}</strong></div>
              </div>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Booking</p>
              <div className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Booking Code</span><strong className="text-[#14373b]">{booking?.reservation_code || booking?.id?.slice(0, 8) || '-'}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Travel Dates</span><strong className="text-[#14373b]">{booking ? `${booking.start_date} → ${booking.end_date}` : '-'}</strong></div>
              </div>
            </section>
          </div>

          {/* Payment + Amount Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Payment</p>
              <div className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Transaction ID</span><strong className="text-[#14373b]">{payment.transaction_id || payment.id?.slice(0, 8)}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">eSewa Reference</span><strong className="font-mono text-[#14373b]">{payment.esewa_ref || payment.gateway_ref || '-'}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Method</span><strong className="text-[#14373b]">{payment.method || 'eSewa'}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Status</span><strong className="capitalize text-[#14373b]">{payment.status || 'verified'}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Paid at</span><strong className="text-[#14373b]">{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : new Date(payment.created_at).toLocaleString()}</strong></div>
              </div>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Amount</p>
              <div className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">This payment</span><strong className="text-[#7a4c1f]">NPR {paidAmount.toLocaleString()}</strong></div>
                <div className="flex justify-between border-b border-[#e8ebe6] pb-1.5"><span className="text-[#5a7376]">Booking total</span><strong className="text-[#14373b]">NPR {totalAmount.toLocaleString()}</strong></div>
              </div>
            </section>
          </div>

          {/* Totals Breakdown */}
          <div className="rounded-2xl border border-[#d6e2dd] bg-[#f8fcfa] p-4 space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-[#5a7376]">Base amount</span><span className="font-semibold text-[#14373b]">NPR {baseAmount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[#5a7376]">Service fee</span><span className="font-semibold text-[#14373b]">NPR {serviceFee.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[#5a7376]">Tax</span><span className="font-semibold text-[#14373b]">NPR {taxAmount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[#5a7376]">Discount</span><span className="font-semibold text-[#1f6a55]">- NPR {discount.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-[#d6e2dd] pt-2 mt-2"><span className="font-bold text-[#14373b]">Booking total</span><span className="text-[16px] font-extrabold text-[#14373b]">NPR {totalAmount.toLocaleString()}</span></div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()} type="button" className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#264447] transition hover:-translate-y-[1px] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">print</span><span>Print / Save PDF</span>
            </button>
            <Link to="/" className="rounded-full border border-[#d0ddd8] bg-white px-5 py-2 text-[13px] font-semibold text-[#365659] transition hover:bg-[#f3f8f6]">Back to home</Link>
          </div>

          <p className="text-center text-[11px] text-[#728d8c]">Thank you for renting with us. For questions, contact support@rentavehiclenepal.com.</p>
        </div>
      </article>
    </main>
  );
}
