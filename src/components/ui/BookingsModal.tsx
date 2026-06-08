'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getUserBookings } from '@/services/booking.service';
import supabase from '@/lib/supabase';

const fmt = (v: number) => `NPR ${Number(v || 0).toLocaleString()}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const statusTone = (s: string) => {
  const k = (s || '').toLowerCase();
  if (k === 'confirmed' || k === 'active') return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300';
  if (k === 'completed') return 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300';
  if (k === 'cancelled') return 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300';
  return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300';
};

const getGuestBookings = () => {
  try {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('guestBookings') || '[]');
  } catch { return []; }
};

interface Booking {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  base_amount: number;
  service_fee: number;
  tax_amount: number;
  discount_amount: number;
  pickup_time: string;
  driver_option: string;
  customer_email: string;
  customer_phone: string;
  notes: string;
  vehicles?: {
    name: string;
    brand: string;
    model: string;
    image_url: string;
  };
}

export default function BookingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let allBookings: Booking[] = [];
      
      if (user) {
        const userBookings = await getUserBookings(user.id);
        allBookings = [...allBookings, ...userBookings];
      }
      
      const guestBookings = getGuestBookings();
      if (guestBookings.length > 0) {
        const { data: guestDetails } = await supabase
          .from('bookings')
          .select('*, vehicles(name, brand, model, image_url)')
          .in('id', guestBookings.map((b: any) => b.id));
        if (guestDetails) {
          allBookings = [...allBookings, ...guestDetails];
        }
      }
      
      setBookings(allBookings);
      if (allBookings.length > 0) setActiveId(allBookings[0].id);
    } catch { /* ignore */ }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const active = bookings.find((b) => b.id === activeId) || bookings[0] || null;
  const upcoming = bookings.filter((b) => ['confirmed', 'active', 'pending'].includes(b.status)).length;
  const completed = bookings.filter((b) => b.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[rgba(7,22,24,0.52)] transition duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true"
        className="vrs-bookings-card mx-4 w-full max-w-[1060px] rounded-3xl border border-[rgba(22,58,61,0.18)] bg-[linear-gradient(160deg,rgba(255,255,255,0.985),rgba(246,239,229,0.985))] p-5 shadow-[0_28px_70px_rgba(7,31,34,0.24)] sm:p-6 dark:border-[rgba(150,176,188,0.3)] dark:bg-[linear-gradient(160deg,rgba(21,32,39,0.98),rgba(14,24,30,0.98))] dark:text-[#d9e8ee]">

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.01em] text-[#14373b] dark:text-[#edf5f8]">Your Bookings</h2>
            <p className="mt-1 text-[13px] text-[#4e6b6f] dark:text-[#9fb5bf]">Recent and upcoming reservations in one place.</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-full border border-[#d4dfda] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2f565a] transition hover:-translate-y-[1px] hover:bg-[#f4faf7] dark:border-[rgba(150,176,188,0.32)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[#d3e4ea] dark:hover:bg-[rgba(255,255,255,0.1)]">
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] font-semibold text-[#2f5659] dark:text-[#d5e5eb]">
          <p className="rounded-xl border border-[#d5e0db] bg-white px-3 py-2 dark:border-[rgba(150,176,188,0.28)] dark:bg-[rgba(255,255,255,0.04)]">
            Total <span className="ml-1 text-[#17393d] dark:text-[#edf5f8]">{bookings.length}</span>
          </p>
          <p className="rounded-xl border border-[#f2cfb4] bg-[#fff5ec] px-3 py-2 text-[#8b5530] dark:border-[rgba(240,168,114,0.34)] dark:bg-[rgba(201,114,58,0.2)] dark:text-[#ffd9bf]">
            Upcoming <span className="ml-1">{upcoming}</span>
          </p>
          <p className="rounded-xl border border-[#b8dfc8] bg-[#eef9f2] px-3 py-2 text-[#2a6b49] dark:border-[rgba(129,221,170,0.3)] dark:bg-[rgba(43,126,87,0.22)] dark:text-[#d5f4e3]">
            Completed <span className="ml-1">{completed}</span>
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[0.95fr,1.35fr]">
          <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
            {loading && <p className="py-8 text-center text-[13px] text-[#547073] dark:text-[#aac0c9]">Loading bookings…</p>}
            {!loading && bookings.length === 0 && <p className="py-8 text-center text-[13px] text-[#547073] dark:text-[#aac0c9]">No bookings found for your account yet.</p>}
            {bookings.map((b) => (
              <button key={b.id} type="button" onClick={() => setActiveId(b.id)}
                className={`w-full rounded-2xl px-3 py-3 text-left transition ${b.id === activeId
                  ? 'border border-[#f3c9ab] bg-[#fff1e6] dark:border-[rgba(240,168,114,0.38)] dark:bg-[rgba(201,114,58,0.2)]'
                  : 'border border-[#d6dfd9] bg-white hover:border-[#c9d8d2] hover:bg-[#f5faf7] dark:border-[rgba(150,176,188,0.22)] dark:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.09)]'
                }`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-[13px] font-semibold text-[#17393d] dark:text-[#edf5f8]">{b.vehicles?.name || b.vehicles?.brand + ' ' + b.vehicles?.model || 'Vehicle'}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(b.status)}`}>{b.status}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#547073] dark:text-[#aac0c9]">#{b.id?.slice(0, 8)}</p>
                <p className="mt-1 text-[11px] text-[#547073] dark:text-[#aac0c9]">{fmtDate(b.start_date)} to {fmtDate(b.end_date)} &bull; {fmt(b.total_amount)}</p>
              </button>
            ))}
          </div>

          <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-[#d6dfd9] bg-[#f9fcfa] p-4 dark:border-[rgba(150,176,188,0.26)] dark:bg-[rgba(255,255,255,0.04)]">
            {!active ? (
              <p className="py-12 text-center text-[13px] text-[#547073] dark:text-[#aac0c9]">Once you complete a reservation, full details will appear here.</p>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0 pr-1">
                    <h3 className="text-[20px] font-bold leading-tight text-[#17393d] dark:text-[#edf5f8]" style={{ overflowWrap: 'anywhere' }}>
                      {active.vehicles?.name || active.vehicles?.brand + ' ' + active.vehicles?.model || 'Vehicle'}
                    </h3>
                    <p className="mt-1 text-[12px] text-[#547073] dark:text-[#aac0c9]">#{active.id?.slice(0, 8)}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusTone(active.status)}`}>{active.status}</span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-[#d6dfd9] bg-white p-3 text-[12px] text-[#2f5357] sm:grid-cols-2 dark:border-[rgba(150,176,188,0.24)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[#d3e4ea]">
                  <p><span className="block text-[#5f787b] dark:text-[#9eb5be]">Pick-up</span>{fmtDate(active.start_date)} at {active.pickup_time || '10:00'}</p>
                  <p><span className="block text-[#5f787b] dark:text-[#9eb5be]">Drop-off</span>{fmtDate(active.end_date)}</p>
                  <p><span className="block text-[#5f787b] dark:text-[#9eb5be]">Driver Option</span>{active.driver_option === 'self_drive' ? 'Self Drive' : 'With Driver'}</p>
                  <p><span className="block text-[#5f787b] dark:text-[#9eb5be]">Contact</span>{active.customer_email || '—'}</p>
                </div>

                <div className="mt-3 rounded-2xl border border-[#f2d2bb] bg-[#fff7ef] p-3 text-[12px] dark:border-[rgba(240,168,114,0.34)] dark:bg-[rgba(201,114,58,0.2)]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[#8b5530] dark:text-[#ffd9bf]">Booking Total</span>
                    <strong className="text-[16px] text-[#7b4520] dark:text-[#ffe6d2]">{fmt(active.total_amount)}</strong>
                  </div>
                  <div className="space-y-1 text-[#6d5b4d] dark:text-[#f2d8c3]">
                    <p className="flex justify-between"><span>Base Amount</span><span>{fmt(active.base_amount)}</span></p>
                    <p className="flex justify-between"><span>Service Fee</span><span>{fmt(active.service_fee)}</span></p>
                    <p className="flex justify-between"><span>Tax</span><span>{fmt(active.tax_amount)}</span></p>
                    {active.discount_amount > 0 && <p className="flex justify-between"><span>Discount</span><span>-{fmt(active.discount_amount)}</span></p>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-[#547073] sm:grid-cols-2 dark:text-[#aac0c9]">
                  <p className="rounded-xl border border-[#d6dfd9] bg-white px-3 py-2 dark:border-[rgba(150,176,188,0.22)] dark:bg-[rgba(255,255,255,0.04)]">
                    <span className="block text-[#5f787b] dark:text-[#9eb5be]">Phone</span>{active.customer_phone || '—'}
                  </p>
                  <p className="rounded-xl border border-[#d6dfd9] bg-white px-3 py-2 dark:border-[rgba(150,176,188,0.22)] dark:bg-[rgba(255,255,255,0.04)]">
                    <span className="block text-[#5f787b] dark:text-[#9eb5be]">Notes</span>{active.notes || 'None'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => { onClose(); router.push('/my-bookings'); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#2c766e] bg-white px-4 py-2 text-[12px] font-semibold text-[#2c766e] transition hover:-translate-y-[1px] hover:bg-[#f3f8f6]">
                    <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                    View Full Page
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {active.status === 'pending' && (
                      <button type="button" onClick={() => { onClose(); router.push(`/payment?booking=${active.id}`); }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(229,140,78,0.3)] transition hover:-translate-y-[1px] hover:brightness-105">
                        <span className="material-symbols-outlined text-[16px]">credit_card</span>
                        Pay Now
                      </button>
                    )}
                    {active.status !== 'cancelled' && active.status !== 'completed' && (
                      <button type="button" onClick={() => { onClose(); router.push(`/modify-booking?id=${active.id}`); }}
                        className="rounded-full border border-[#d4dfda] bg-white px-4 py-2 text-[12px] font-semibold text-[#2f565a] transition hover:-translate-y-[1px] hover:bg-[#f4faf7] dark:border-[rgba(150,176,188,0.32)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[#d3e4ea]">
                        Modify
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
