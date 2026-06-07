import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyPayment } from '../services/payment.service';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [paymentData, setPaymentData] = useState(null);
  const [failReason, setFailReason] = useState('');

  const refId = searchParams.get('refId') || searchParams.get('transaction_code') || '-';

  useEffect(() => {
    const verify = async () => {
      try {
        const oid = searchParams.get('oid');
        const ref = searchParams.get('refId');
        const amt = searchParams.get('amt');
        if (!oid || !ref) { setStatus('failed'); setFailReason('Missing payment reference.'); return; }
        const result = await verifyPayment({ oid, refId: ref, amt });
        if (result?.verified || result?.success) { setStatus('success'); setPaymentData(result); }
        else { setStatus('failed'); setFailReason(result?.message || 'Verification failed.'); }
      } catch (err) { setStatus('failed'); setFailReason(err.message || 'Network error.'); }
    };
    verify();
  }, [searchParams]);

  return (
    <main className="vrs-theme-scope mx-auto w-[95%] max-w-[820px] pb-14">
      <section className="rounded-[34px] border border-[rgba(23,57,60,0.14)] bg-[linear-gradient(150deg,rgba(255,255,255,0.95),rgba(246,239,229,0.88))] p-6 shadow-[0_24px_52px_rgba(10,31,34,0.1)] backdrop-blur-sm sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3c6667]">Payment Status</p>

        {/* Verifying */}
        {status === 'verifying' && (
          <div className="mt-4 rounded-3xl border border-[#d5e0db] bg-white p-8 text-center text-[#3d5f61]">
            <span className="material-symbols-outlined animate-spin text-[40px] text-[#1f5b57]">progress_activity</span>
            <h2 className="mt-3 text-[22px] font-extrabold text-[#14373b]">Verifying your payment...</h2>
            <p className="mt-1 text-[13.5px]">We are double-checking with eSewa. This usually takes a few seconds.</p>
            <p className="mt-3 text-[12px] text-[#5f7a7d]">eSewa transaction id: <span className="font-mono">{refId}</span></p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="mt-3 rounded-3xl border border-emerald-200 bg-[linear-gradient(155deg,#ffffff,#eaf7ef)] p-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2c766e,#1f5b57)] text-[26px] text-white shadow-[0_14px_32px_rgba(31,91,87,0.34)]">&#10003;</div>
            <h2 className="mt-4 text-[28px] font-extrabold leading-tight text-[#133438]">Payment received</h2>
            <p className="mt-1 text-[13.5px] text-[#2e5255]">Thank you. Your booking is now confirmed and a receipt is on its way to your inbox.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#cfe5d8] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4f7867]">Transaction ID</p>
                <p className="mt-1 text-[18px] font-extrabold text-[#14373b]">{paymentData?.transaction_code || paymentData?.payment_id || '-'}</p>
              </div>
              <div className="rounded-2xl border border-[#cfe5d8] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4f7867]">eSewa Reference</p>
                <p className="mt-1 break-all text-[14px] font-mono text-[#14373b]">{refId}</p>
              </div>
            </div>

            {paymentData?.amount && (
              <div className="mt-4 rounded-2xl border border-[#f2d3bb] bg-[#fff6ef] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7f4c22]">Amount Paid</span>
                  <span className="text-[24px] font-extrabold text-[#6d3e18]">NPR {Number(paymentData.amount).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {paymentData?.payment_id && (
                <button onClick={() => navigate(`/payment-receipt?payment=${paymentData.payment_id}`)} className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition hover:-translate-y-[1px] hover:brightness-105">View receipt</button>
              )}
              <Link to="/" className="rounded-full border border-[#d0ddd8] bg-white px-5 py-2 text-[13px] font-semibold text-[#365659] transition hover:bg-[#f3f8f6]">Back to home</Link>
            </div>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="mt-3 rounded-3xl border border-rose-200 bg-[linear-gradient(155deg,#ffffff,#fff1f2)] p-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#9b1f3a,#b94350)] text-[26px] text-white">!</div>
            <h2 className="mt-4 text-[28px] font-extrabold leading-tight text-[#7a142a]">Payment did not complete</h2>
            <p className="mt-1 text-[13.5px] text-[#7a142a]/80">We could not finalize this transaction. No charge was applied to your account.</p>

            <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-600">Reason</p>
              <p className="mt-1 text-[14px] font-semibold text-[#7a142a]">{failReason || 'Unknown error'}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/vehicles" className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition hover:-translate-y-[1px] hover:brightness-105">Retry payment</Link>
              <Link to="/" className="rounded-full border border-[#d0ddd8] bg-white px-5 py-2 text-[13px] font-semibold text-[#365659] transition hover:bg-[#f3f8f6]">Back to home</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
