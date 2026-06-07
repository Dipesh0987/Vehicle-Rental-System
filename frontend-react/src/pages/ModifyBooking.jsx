import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateBookingStatus, calculateQuote } from '../services/booking.service';
import supabase from '../lib/supabase';

const inputCls = "h-12 rounded-xl border border-[#d2dfda] bg-[#fbfdfc] px-3 py-2 text-[14px] outline-none transition focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(44,118,110,0.16)]";

export default function ModifyBooking() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('id');

  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    Promise.all([
      supabase.from('bookings').select('*, vehicles(id, name, brand, model, image_url, price_per_day)').eq('id', bookingId).single(),
      supabase.from('vehicles').select('id, name, brand, model, price_per_day').eq('status', 'available'),
    ]).then(([{ data: b }, { data: v }]) => {
      setBooking(b);
      if (b) { setNewStart(b.start_date || ''); setNewEnd(b.end_date || ''); setNewVehicleId(b.vehicle_id || ''); }
      if (v) setVehicles(v);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [bookingId]);

  const selectedVehicle = useMemo(() => {
    if (!newVehicleId) return booking?.vehicles || null;
    return vehicles.find((v) => v.id === newVehicleId) || booking?.vehicles || null;
  }, [newVehicleId, vehicles, booking]);

  const days = newStart && newEnd ? Math.max(1, Math.ceil((new Date(newEnd) - new Date(newStart)) / 86400000)) : 0;
  const quote = selectedVehicle && days > 0 ? calculateQuote({ pricePerDay: selectedVehicle.price_per_day || 0, days }) : null;

  const handleModify = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setProcessing(true);
    try {
      const updates = {
        start_date: newStart,
        end_date: newEnd,
        ...(newVehicleId && newVehicleId !== booking.vehicle_id ? { vehicle_id: newVehicleId } : {}),
        ...(quote ? { base_amount: quote.base, service_fee: quote.serviceFee, tax_amount: 0, total_amount: quote.total, discount_amount: quote.discountAmount } : {}),
        ...(reason ? { notes: reason } : {}),
      };
      await updateBookingStatus(bookingId, booking.status, updates);
      setSuccess('Booking modified successfully!');
    } catch (err) { setError(err.message); } finally { setProcessing(false); }
  };

  if (loading) {
    return (
      <main className="vrs-theme-scope mx-auto w-[95%] max-w-[720px] py-16 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="vrs-theme-scope mx-auto w-[95%] max-w-[720px] py-16">
        <section className="rounded-[30px] border border-[rgba(23,57,60,0.14)] bg-[linear-gradient(150deg,rgba(255,255,255,0.93),rgba(246,239,229,0.84))] p-6 text-center shadow-[0_24px_52px_rgba(10,31,34,0.1)] sm:p-8">
          <p className="text-[14px] text-[#3d5f61]">Booking not found.</p>
          <Link to="/my-bookings" className="mt-3 inline-block text-[13px] font-semibold text-[#2c766e] underline underline-offset-2">Back to My Bookings</Link>
        </section>
      </main>
    );
  }

  const vehicle = booking.vehicles;

  return (
    <main className="vrs-theme-scope mx-auto w-[95%] max-w-[1390px] pb-14">
      <section className="rounded-[34px] border border-[rgba(23,57,60,0.14)] bg-[linear-gradient(150deg,rgba(255,255,255,0.93),rgba(246,239,229,0.84))] p-5 shadow-[0_24px_52px_rgba(10,31,34,0.1)] backdrop-blur-sm sm:p-7">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3c6667]">Modify Reservation</p>
            <h1 className="mt-1 text-[30px] font-extrabold leading-tight text-[#12373b] sm:text-[38px]">Update Your Booking</h1>
            <p className="mt-1 max-w-[720px] text-[14px] text-[#3d5f61]">Change dates, vehicle, or add a note. Your updated price will reflect instantly.</p>
          </div>
          <Link to="/my-bookings" className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#264447] transition duration-200 hover:-translate-y-[1px] hover:bg-[#f3f8f6]">
            Back to My Bookings
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr,0.95fr] lg:items-start">
          {/* Form Card */}
          <section className="space-y-4 rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-4 shadow-[0_14px_30px_rgba(10,31,34,0.08)] sm:p-5">
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">{error}</div>}
            {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700">{success}</div>}

            {/* Current Booking Info */}
            <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-[0_10px_20px_rgba(10,31,34,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Current Booking</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 text-[13px] text-[#375c5f]">
                <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Vehicle</span><span className="font-semibold text-[#1f4043]">{vehicle?.name || 'N/A'}</span></div>
                <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Dates</span><span>{booking.start_date} → {booking.end_date}</span></div>
                <div className="flex justify-between rounded-xl border border-[#e4ece8] px-3 py-2"><span className="font-semibold">Status</span><span className="capitalize">{booking.status}</span></div>
              </div>
            </div>

            <form onSubmit={handleModify} className="space-y-4">
              {/* Dates */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[12px] font-semibold text-[#315154]">New Start Date</span>
                  <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} min={today} required className={inputCls} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[12px] font-semibold text-[#315154]">New End Date</span>
                  <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} min={newStart || today} required className={inputCls} />
                </label>
              </div>

              {/* Vehicle */}
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Change Vehicle (Optional)</span>
                <select value={newVehicleId} onChange={(e) => setNewVehicleId(e.target.value)} className={inputCls}>
                  <option value={booking.vehicle_id || ''}>{vehicle?.name || 'Current Vehicle'}</option>
                  {vehicles.filter((v) => v.id !== booking.vehicle_id).map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.brand})</option>
                  ))}
                </select>
              </label>

              {/* Reason */}
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Reason for Change (Optional)</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why are you modifying this booking?"
                  className="rounded-xl border border-[#d2dfda] bg-[#fbfdfc] px-3 py-2 text-[14px] outline-none transition focus:border-[#2c766e] focus:shadow-[0_0_0_3px_rgba(44,118,110,0.16)]" />
              </label>

              {/* Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link to="/my-bookings" className="rounded-full border border-[#d0dbd6] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#264447] transition hover:-translate-y-[1px] hover:bg-[#f3f8f6]">
                  Cancel
                </Link>
                <button type="submit" disabled={processing || !quote}
                  className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(217,136,79,0.3)] transition duration-200 hover:-translate-y-[1px] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span>{processing ? 'Saving…' : 'Save Changes'}</span>
                  <span className="transition group-hover:translate-x-[2px]">&rarr;</span>
                </button>
              </div>
            </form>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <article className="rounded-3xl border border-[#d5e0db] bg-[linear-gradient(165deg,#ffffff,#f9f4eb)] p-4 shadow-[0_14px_30px_rgba(10,31,34,0.1)] sm:p-5 lg:sticky lg:top-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Selected Vehicle</p>
              <h2 className="mt-3 text-[24px] font-bold leading-tight text-[#14373b]">{selectedVehicle?.name || 'Vehicle'}</h2>
              {selectedVehicle && <p className="text-[13px] text-[#456467]">{selectedVehicle.brand} {selectedVehicle.model}</p>}
              <div className="mt-4 rounded-2xl border border-[#f2cdae] bg-[linear-gradient(145deg,#fffaf5,#fff1e6)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8e5228]">Price Per Day</p>
                <p className="mt-1 text-[22px] font-extrabold text-[#1f5b57]">NPR {(selectedVehicle?.price_per_day || 0).toLocaleString()} / day</p>
              </div>

              <div className="mt-4 rounded-3xl border border-[#d5e0db] bg-white/95 p-4 shadow-[0_12px_28px_rgba(10,31,34,0.08)] sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3c6667]">Updated Pricing</p>
                {quote ? (
                  <>
                    <div className="mt-3 space-y-2 text-[13px] text-[#3d5f61]">
                      <div className="flex items-center justify-between"><span>Duration</span><span className="font-semibold text-[#24484b]">{days} day{days > 1 ? 's' : ''}</span></div>
                      <div className="flex items-center justify-between"><span>Base</span><span className="font-semibold text-[#24484b]">NPR {(quote.base || 0).toLocaleString()}</span></div>
                      <div className="flex items-center justify-between"><span>Service Fee</span><span className="font-semibold text-[#24484b]">NPR {(quote.serviceFee || 0).toLocaleString()}</span></div>
                      {Number(quote.discountAmount) > 0 && <div className="flex items-center justify-between"><span>Discount</span><span className="font-semibold text-[#16a34a]">-NPR {(quote.discountAmount || 0).toLocaleString()}</span></div>}
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#f2d3bb] bg-[#fff6ef] px-3 py-2.5">
                      <div className="flex items-center justify-between text-[13px] font-semibold text-[#7f4c22]">
                        <span>New Total</span>
                        <span className="text-[16px] font-bold">NPR {(quote.total || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-[13px] text-[#3d5f61]">Select valid dates to see updated pricing.</p>
                )}
              </div>
            </article>
          </aside>
        </div>
      </section>
    </main>
  );
}
