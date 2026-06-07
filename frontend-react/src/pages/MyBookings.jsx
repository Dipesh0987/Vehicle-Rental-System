import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserBookings, requestBookingCancellation } from '../services/booking.service';
import supabase from '../lib/supabase';

const statusColor = (s) => {
  const map = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-rose-100 text-rose-700',
    expired: 'bg-slate-100 text-slate-500',
  };
  return map[s] || 'bg-slate-100 text-slate-600';
};

// Get guest bookings from localStorage
const getGuestBookings = () => {
  try {
    return JSON.parse(localStorage.getItem('guestBookings') || '[]');
  } catch { return []; }
};

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      let allBookings = [];
      
      // Load logged in user bookings
      if (user) {
        const userBookings = await getUserBookings(user.id);
        allBookings = [...allBookings, ...userBookings];
      }
      
      // Load guest bookings from localStorage
      const guestBookings = getGuestBookings();
      if (guestBookings.length > 0) {
        const { data: guestDetails } = await supabase
          .from('bookings')
          .select('*, vehicles(name, brand, model, image_url)')
          .in('id', guestBookings.map(b => b.id));
        if (guestDetails) {
          allBookings = [...allBookings, ...guestDetails];
        }
      }
      
      setBookings(allBookings);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setCancellingId(id);
    try {
      await requestBookingCancellation(id, 'Cancelled by user');
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
    } catch (err) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <main className="vrs-theme-scope mx-auto w-[95%] max-w-[1390px] pb-14 pt-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3c6667]">My Account</p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-[#12373b] sm:text-[36px]">Your Bookings</h1>
          <p className="mt-1 text-[14px] text-[#3d5f61]">Track and manage all your vehicle reservations.</p>
        </div>
        <Link to="/vehicles" className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#264447] transition hover:-translate-y-[1px]">
          Browse Vehicles
        </Link>
      </div>

      {/* Filter pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        {['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-2 text-[12px] font-semibold capitalize transition ${filter === f ? 'border-[#2c766e] bg-[#e8f2ef] text-[#1f5b57]' : 'border-[#d4ded9] bg-white text-[#264447] hover:bg-[#f3f8f6]'}`}>
            {f === 'all' ? `All (${bookings.length})` : `${f} (${bookings.filter((b) => b.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-[rgba(23,57,60,0.12)] bg-white/80 p-10 text-center shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-[#aabcb8]">event_busy</span>
          <p className="mt-3 text-[16px] font-semibold text-[#14373b]">No bookings found</p>
          <p className="mt-1 text-[13px] text-[#567073]">
            {filter === 'all' ? "You haven't made any bookings yet." : `No ${filter} bookings.`}
          </p>
          <Link to="/vehicles" className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-[13px] font-semibold text-white transition hover:-translate-y-[1px] hover:brightness-105">
            Book a Vehicle
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const v = b.vehicles || {};
            const imgUrl = v.image_url || '/assets/images/car-transparent.png';
            return (
              <div key={b.id} className="rounded-[20px] border border-[rgba(23,57,60,0.12)] bg-white/90 shadow-[0_6px_16px_rgba(10,31,34,0.06)] overflow-hidden transition hover:shadow-md">
                <div className="flex flex-col sm:flex-row">
                  {/* Vehicle image */}
                  <div className="sm:w-[200px] h-[140px] sm:h-auto bg-[#eef3f1] flex-shrink-0 overflow-hidden">
                    <img src={imgUrl} alt={v.name || 'Vehicle'} className="w-full h-full object-cover" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[16px] font-bold text-[#12373b]">{v.brand} {v.name || v.model}</h3>
                        <p className="text-[12px] text-[#567073] mt-0.5">Booking #{b.id?.slice(0, 8)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize ${statusColor(b.status)}`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                      <div>
                        <p className="font-semibold text-[#567073]">Pick-up</p>
                        <p className="font-bold text-[#12373b]">{formatDate(b.start_date)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#567073]">Return</p>
                        <p className="font-bold text-[#12373b]">{formatDate(b.end_date)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#567073]">Total</p>
                        <p className="font-bold text-[#1f5b57]">NPR {(b.total_amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#567073]">Driver</p>
                        <p className="font-bold text-[#12373b] capitalize">{(b.driver_option || 'self_drive').replace('_', ' ')}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <button onClick={() => handleCancel(b.id)} disabled={cancellingId === b.id}
                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40">
                          {cancellingId === b.id ? 'Cancelling…' : 'Cancel Booking'}
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => navigate(`/modify-booking?id=${b.id}`)}
                          className="rounded-full border border-[#d0dbd6] bg-white px-4 py-1.5 text-[12px] font-semibold text-[#264447] transition hover:bg-[#f3f8f6]">
                          Modify
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
