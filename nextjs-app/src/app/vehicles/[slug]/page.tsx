'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getVehicleBySlug, getVehicleImages } from '@/services/vehicle-catalog.service';
import { calculateQuote, validatePromoCode } from '@/services/booking.service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function VehicleDetails() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [vehicle, setVehicle] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [duration, setDuration] = useState(3);
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState('Try: SAVE10 or WEEKEND50');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState('percent');

  useEffect(() => {
    if (!slug) return;
    getVehicleBySlug(slug)
      .then(async (v) => {
        setVehicle(v);
        if (v?.id) {
          const imgs = await getVehicleImages(v.id).catch(() => []);
          const allImages = imgs.length > 0 ? imgs.map((img: any) => img.image_url || img.url) : (v?.images?.length ? v.images : [v?.imageUrl]);
          setImages(allImages.filter(Boolean));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const today = new Date().toISOString().split('T')[0];
  const quote = vehicle && duration > 0 ? calculateQuote({ pricePerDay: vehicle.pricePerDay, days: duration, discountPercent: discountPercent, discountAmount: discountAmount, discountType: discountType }) : null;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const result = await validatePromoCode(couponCode);
      if (result?.valid) { 
        setDiscountType(result.discount_type || 'percent');
        setDiscountPercent(Number(result.discount_percent) || 0); 
        setDiscountAmount(Number(result.discount_amount) || 0); 
        const discountLabel = result.discount_type === 'npr_amount' 
          ? `NPR ${Number(result.discount_amount || 0).toLocaleString()} discount applied!`
          : `${Number(result.discount_percent || 0)}% discount applied!`;
        setCouponStatus(discountLabel); 
      }
      else { 
        setDiscountPercent(0); 
        setDiscountAmount(0);
        setDiscountType('percent');
        setCouponStatus('Invalid or expired code.'); 
      }
    } catch { setCouponStatus('Failed to validate.'); }
  };

  const handleBook = () => {
    sessionStorage.setItem('bookingVehicle', JSON.stringify(vehicle));
    const searchParams = new URLSearchParams({ vehicle: vehicle.id });
    if (pickupDate) searchParams.set('start', pickupDate);
    router.push(`/booking?${searchParams.toString()}`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold text-ink mb-2">Vehicle not found</h2>
          <Link href="/vehicles" className="text-[13px] font-semibold text-accent hover:underline">Browse all vehicles</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="vrs-page min-h-screen bg-white font-poppins">
      <main id="app" className="vrs-theme-scope min-h-screen">
        <Header />
        <section className="detail-shell detail-stage relative z-10 mx-auto w-[95%] max-w-[1460px] space-y-6 rounded-[34px] p-5 sm:p-7 lg:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] font-semibold text-[#375053]">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/vehicles" className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2 transition hover:-translate-y-[1px]">Back to Fleet Catalog</Link>
          <span className="rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1.5 text-[#2d5759]">Vehicle Intelligence</span>
        </div>
        <p className="rounded-full border border-[#d0dbd6] bg-white px-4 py-2">Vehicle Overview</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.52fr,0.9fr] xl:items-start">
        <div className="space-y-5">
          <article className="detail-card group rounded-3xl border border-[#d5e0db] bg-white/90 p-4">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#eef4f1,#dde8e4)]">
              <img loading="lazy" src={images[heroIdx] || '/assets/images/car-transparent.png'} alt={vehicle.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent"></div>
              {images.length > 1 && (
                <>
                  <button onClick={() => setHeroIdx((p) => (p - 1 + images.length) % images.length)} type="button" aria-label="Previous image"
                    className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/85 text-[#183d40] shadow-[0_14px_28px_rgba(10,31,34,0.2)] backdrop-blur-sm transition duration-200 hover:scale-105 hover:bg-white">
                    <span aria-hidden="true" className="text-[20px] font-bold leading-none">&#10094;</span>
                  </button>
                  <button onClick={() => setHeroIdx((p) => (p + 1) % images.length)} type="button" aria-label="Next image"
                    className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/85 text-[#183d40] shadow-[0_14px_28px_rgba(10,31,34,0.2)] backdrop-blur-sm transition duration-200 hover:scale-105 hover:bg-white">
                    <span aria-hidden="true" className="text-[20px] font-bold leading-none">&#10095;</span>
                  </button>
                  <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/65 bg-[#10292b]/75 px-3 py-1 text-[11px] font-semibold text-white">{heroIdx + 1} / {images.length}</p>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setHeroIdx(i)}
                    className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === heroIdx ? 'border-[#2c766e] ring-2 ring-[#2c766e]/30' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="detail-card rounded-3xl border border-[#d5e0db] bg-white/95 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-panel">{vehicle.brand || 'Brand'}</p>
            <h1 className="mt-2 text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">{vehicle.name}</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#3f5c5f]">{vehicle.description || vehicle.tagline || `${vehicle.brand} ${vehicle.model} — premium rental vehicle.`}</p>
            {vehicle.type && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1 text-[11px] font-semibold text-[#2d5759]">{vehicle.type}</span>
                {vehicle.transmission && <span className="rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1 text-[11px] font-semibold text-[#2d5759]">{vehicle.transmission}</span>}
                {vehicle.fuelType && <span className="rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1 text-[11px] font-semibold text-[#2d5759]">{vehicle.fuelType}</span>}
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-3">
              {[
                { label: 'Seats', value: vehicle.seats },
                { label: 'Transmission', value: vehicle.transmission },
                { label: 'Fuel', value: vehicle.fuelType },
                { label: 'Mileage', value: vehicle.mileage },
                { label: 'Color', value: vehicle.color },
                { label: 'Year', value: vehicle.year },
              ].filter(s => s.value).map(spec => (
                <div key={spec.label} className="rounded-2xl border border-[#d6e2dd] bg-[#f8fcfa] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5a7376]">{spec.label}</p>
                  <p className="mt-0.5 text-[14px] font-bold text-[#1f4246]">{spec.value}</p>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="detail-card rounded-3xl border border-[#d5e0db] bg-white/90 p-5">
              <h2 className="text-[19px] font-bold text-ink">What Is Included</h2>
              <div className="mt-3 grid gap-2">
                {(vehicle.what_is_included || ['Insurance Coverage', 'Roadside Assistance', 'GPS Navigation', 'Free Cancellation (24h)']).map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-[#d6e2dd] bg-[#f8fcfa] px-3 py-2 text-[13px] font-medium text-[#2b4d50]">
                    <span className="text-[#2c766e]">✓</span> {item}
                  </div>
                ))}
              </div>
            </article>
            <article className="detail-card rounded-3xl border border-[#d5e0db] bg-white/90 p-5">
              <h2 className="text-[19px] font-bold text-ink">Vehicle Features</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(vehicle.features || ['AC', 'Bluetooth', 'USB Charging', 'Backup Camera']).map((f: string, i: number) => (
                  <span key={i} className="rounded-full border border-[#d5ddd8] bg-[#f1f7f4] px-3 py-1.5 text-[12px] font-semibold text-[#2d5759]">{f}</span>
                ))}
              </div>
            </article>
          </div>

          <article className="detail-card rounded-3xl border border-[#d5e0db] bg-white/90 p-5">
            <h2 className="text-[19px] font-bold text-ink">Pricing Breakdown</h2>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between rounded-xl border border-[#d6e2dd] bg-[#f8fcfa] px-3 py-2.5 text-[13px]">
                <span className="text-[#4a6569]">Daily Rate</span>
                <span className="font-semibold text-[#214346]">NPR {(vehicle.pricePerDay || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#d6e2dd] bg-[#f8fcfa] px-3 py-2.5 text-[13px]">
                <span className="text-[#4a6569]">Service Fee</span>
                <span className="font-semibold text-[#214346]">5% of base</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#d6e2dd] bg-[#f8fcfa] px-3 py-2.5 text-[13px]">
                <span className="text-[#4a6569]">Tax (VAT)</span>
                <span className="font-semibold text-[#214346]">13%</span>
              </div>
            </div>
          </article>
        </div>

        <div className="space-y-5 xl:self-start">
          <aside className="detail-card rounded-3xl border border-[#d5e0db] bg-white/95 p-5 shadow-[0_16px_30px_rgba(10,31,34,0.08)] xl:sticky xl:top-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-panel">Premium Booking</p>
            <h2 className="mt-2 text-[24px] font-bold text-ink">Reserve This Vehicle</h2>
            <p className="mt-1 text-[13px] text-[#3f5c5f]">Instant date-to-quote flow with secure booking handoff.</p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Pick-up Date</span>
                <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} min={today}
                  className="rounded-xl border border-[#d4dfda] bg-[#fbfdfc] px-3 py-2 text-[13px] text-[#1f4043] outline-none" />
              </label>
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Pick-up Time</span>
                <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}
                  className="rounded-xl border border-[#d4dfda] bg-[#fbfdfc] px-3 py-2 text-[13px] text-[#1f4043] outline-none" />
              </label>
              <label className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Duration (Days)</span>
                <input type="number" min="1" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)}
                  className="rounded-xl border border-[#d4dfda] bg-[#fbfdfc] px-3 py-2 text-[13px] text-[#1f4043] outline-none" />
              </label>
              <div className="grid gap-1">
                <span className="text-[12px] font-semibold text-[#315154]">Coupon Code</span>
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="SAVE10"
                    className="w-full rounded-xl border border-[#d4dfda] bg-[#fbfdfc] px-3 py-2 text-[13px] text-[#1f4043] outline-none" />
                  <button type="button" onClick={handleApplyCoupon}
                    className="rounded-xl border border-[#cad8d2] bg-white px-3 py-2 text-[12px] font-semibold text-[#2b4d50] transition hover:-translate-y-[1px]">Apply</button>
                </div>
                <p className="text-[12px] text-[#5a7376]">{couponStatus}</p>
              </div>
            </div>

            <article className="mt-5 rounded-2xl border border-[#d6e2dd] bg-[#f8fcfa] p-4">
              <div className="mb-3 flex items-center justify-between rounded-xl border border-[#e3ece8] bg-white px-3 py-2">
                <span className="text-[12px] font-semibold text-[#476367]">Daily Rate</span>
                <span className="text-[12px] font-semibold text-[#1f4043]">NPR {(vehicle.pricePerDay || 0).toLocaleString()}</span>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between"><span className="text-[#4a6569]">Base Amount</span><span className="font-semibold text-[#214346]">NPR {(quote?.base || 0).toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span className="text-[#4a6569]">Service Fee</span><span className="font-semibold text-[#214346]">NPR {(quote?.serviceFee || 0).toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span className="text-[#4a6569]">Discount</span><span className="font-semibold text-[#1f6a55]">-NPR {(quote?.discountAmount || 0).toLocaleString()}</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[#f0cfb6] bg-[#fff6ef] px-3 py-2">
                <span className="text-[13px] font-semibold text-[#7f4c22]">Estimated Total</span>
                <span className="text-[15px] font-bold text-[#6d3e18]">NPR {(quote?.total || 0).toLocaleString()}</span>
              </div>
            </article>

            <button onClick={handleBook} type="button"
              className="group mt-4 w-full rounded-full bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_12px_24px_rgba(229,140,78,0.28)] transition duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_16px_30px_rgba(229,140,78,0.36)]">
              Continue to Secure Checkout
            </button>
          </aside>
        </div>
      </div>
    </section>
        <Footer />
      </main>
    </div>
  );
}
