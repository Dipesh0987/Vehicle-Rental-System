'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { listVehicles, toSlug } from '@/services/vehicle-catalog.service';
import { checkAvailability } from '@/services/booking.service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const TRANSMISSIONS_FALLBACK = ['Automatic', 'Manual'];
const FUEL_TYPES_FALLBACK = ['Petrol', 'Diesel', 'Electric', 'Hybrid'];

function formatNpr(n: number) { return `NPR ${Number(n || 0).toLocaleString()}`; }

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <>
      {Array.from({ length: full }, (_, i) => <i key={`f${i}`} className="fas fa-star text-[#e8a54b] text-[11px]" />)}
      {half && <i className="fas fa-star-half-alt text-[#e8a54b] text-[11px]" />}
      {Array.from({ length: empty }, (_, i) => <i key={`e${i}`} className="far fa-star text-[#d4ddd7] text-[11px]" />)}
    </>
  );
}

function formatFeature(f: string) {
  return String(f).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function VehiclesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic vehicle types and brands — derived from actual data, no hardcoding
  const VEHICLE_TYPES = useMemo(() => {
    const types = vehicles
      .map((v) => (v.category || v.type || '').toLowerCase().trim())
      .filter(Boolean);
    return [...new Set(types)].sort();
  }, [vehicles]);

  const VEHICLE_BRANDS = useMemo(() => {
    const brands = vehicles
      .map((v) => (v.brand || '').trim())
      .filter(Boolean);
    return [...new Set(brands)].sort();
  }, [vehicles]);

  // Dynamic transmission and fuel type lists from actual vehicle data
  const TRANSMISSIONS = useMemo(() => {
    const t = vehicles.map((v) => (v.transmission || '').trim()).filter(Boolean);
    const unique = [...new Set(t)].sort();
    return unique.length > 0 ? unique : TRANSMISSIONS_FALLBACK;
  }, [vehicles]);

  const FUEL_TYPES = useMemo(() => {
    const f = vehicles.map((v) => (v.fuelType || v.fuel_type || '').trim()).filter(Boolean);
    const unique = [...new Set(f)].sort();
    return unique.length > 0 ? unique : FUEL_TYPES_FALLBACK;
  }, [vehicles]);

  const [pickupLocation, setPickupLocation] = useState(searchParams.get('location') || '');
  const [pickupDateTime, setPickupDateTime] = useState(searchParams.get('start') || '');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [dropoffDateTime, setDropoffDateTime] = useState(searchParams.get('end') || '');
  const [sortBy, setSortBy] = useState('relevance');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Read type from URL params and pre-select the vehicle type filter
  const urlType = searchParams.get('type')?.toLowerCase() || '';
  const [selectedTypes, setSelectedTypes] = useState<string[]>(urlType ? [urlType] : []);
  const [selectedTransmissions, setSelectedTransmissions] = useState<string[]>([]);
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 50000]);
  const [minSeats, setMinSeats] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    listVehicles().then(setVehicles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Sync URL type parameter with selectedTypes when URL changes
  useEffect(() => {
    const typeFromUrl = searchParams.get('type')?.toLowerCase() || '';
    if (typeFromUrl) {
      setSelectedTypes(prev => {
        if (prev.length !== 1 || prev[0] !== typeFromUrl) {
          return [typeFromUrl];
        }
        return prev;
      });
    }
  }, [searchParams]);

  useEffect(() => {
    async function checkAllAvailability() {
      if (!pickupDateTime || !dropoffDateTime || vehicles.length === 0) {
        setAvailabilityMap({});
        return;
      }
      
      setCheckingAvailability(true);
      const startDate = new Date(pickupDateTime).toISOString().split('T')[0];
      const endDate = new Date(dropoffDateTime).toISOString().split('T')[0];
      
      const availability: Record<string, boolean> = {};
      await Promise.all(
        vehicles.map(async (v) => {
          try {
            const isAvailable = await checkAvailability(v.id, startDate, endDate);
            availability[v.id] = isAvailable;
          } catch {
            availability[v.id] = false;
          }
        })
      );
      
      setAvailabilityMap(availability);
      setCheckingAvailability(false);
    }
    
    checkAllAvailability();
  }, [pickupDateTime, dropoffDateTime, vehicles]);

  const toggleArr = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    setArr((prev: string[]) => prev.includes(val) ? prev.filter((x: string) => x !== val) : [...prev, val]);
  };

  const filtered = useMemo(() => {
    let result = vehicles.filter(v => {
      if (pickupDateTime && dropoffDateTime) {
        if (Object.keys(availabilityMap).length > 0 && availableOnly && !availabilityMap[v.id]) return false;
      } else {
        if (availableOnly && v.status !== 'available') return false;
      }
      
      if (selectedTypes.length && !selectedTypes.includes((v.type || v.category || '').toLowerCase())) return false;
      if (selectedTransmissions.length && !selectedTransmissions.includes(v.transmission)) return false;
      if (selectedFuels.length && !selectedFuels.includes(v.fuelType)) return false;
      if (selectedBrands.length && !selectedBrands.includes(v.brand)) return false;
      if (v.pricePerDay < priceRange[0] || v.pricePerDay > priceRange[1]) return false;
      if ((v.seats || 0) < minSeats) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const hay = `${v.name} ${v.brand} ${v.model} ${v.type} ${(v.features || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    switch (sortBy) {
      case 'price-low': result.sort((a, b) => a.pricePerDay - b.pricePerDay); break;
      case 'price-high': result.sort((a, b) => b.pricePerDay - a.pricePerDay); break;
      case 'rating': result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      default: break;
    }
    return result;
  }, [vehicles, sortBy, selectedTypes, selectedTransmissions, selectedFuels, selectedBrands, priceRange, minSeats, searchText, availableOnly, availabilityMap, pickupDateTime, dropoffDateTime]);

  const clearAll = () => {
    setPickupLocation(''); setPickupDateTime(''); setDropoffLocation(''); setDropoffDateTime('');
    setSortBy('relevance'); setSelectedTypes([]); setSelectedTransmissions([]); setSelectedFuels([]);
    setSelectedBrands([]); setPriceRange([0, 50000]); setMinSeats(1); setSearchText(''); setAvailableOnly(true);
  };

  const hasActiveFilters = selectedTypes.length || selectedTransmissions.length || selectedFuels.length || selectedBrands.length || priceRange[0] > 0 || priceRange[1] < 50000 || minSeats > 1 || searchText;

  const filterSidebar = (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#d4ddd7] bg-[linear-gradient(145deg,#ffffff,#f6f2ea)] px-4 py-4 shadow-[0_12px_24px_rgba(9,30,34,0.1)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b7376]">Refine Results</p>
        <p className="mt-1 text-[15px] font-bold text-[#1f4043]">Search Filters</p>
        <button onClick={clearAll} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#f0cdb4] bg-[#fff2e8] py-2.5 text-sm font-semibold text-[#b26431] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffe8d7]">
          <i className="fas fa-rotate-left"></i> Reset All Filters
        </button>
      </section>

      <div>
        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search by brand, model, or feature…"
          className="w-full rounded-2xl border border-[#d4ddd7] bg-white px-4 py-2.5 text-sm font-medium text-[#203f42] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
      </div>

      <FilterSection icon="fa-car" label="Vehicle Type">
        {VEHICLE_TYPES.map(t => (
          <FilterCheck key={t} checked={selectedTypes.includes(t)} onChange={() => toggleArr(selectedTypes, setSelectedTypes, t)} label={t.charAt(0).toUpperCase() + t.slice(1)} />
        ))}
      </FilterSection>

      <FilterSection icon="fa-industry" label="Brand">
        {VEHICLE_BRANDS.map(b => (
          <FilterCheck key={b} checked={selectedBrands.includes(b)} onChange={() => toggleArr(selectedBrands, setSelectedBrands, b)} label={b} />
        ))}
      </FilterSection>

      <FilterSection icon="fa-gears" label="Transmission">
        {TRANSMISSIONS.map(t => (
          <FilterCheck key={t} checked={selectedTransmissions.includes(t)} onChange={() => toggleArr(selectedTransmissions, setSelectedTransmissions, t)} label={t} />
        ))}
      </FilterSection>

      <FilterSection icon="fa-gas-pump" label="Fuel Type">
        {FUEL_TYPES.map(f => (
          <FilterCheck key={f} checked={selectedFuels.includes(f)} onChange={() => toggleArr(selectedFuels, setSelectedFuels, f)} label={f} />
        ))}
      </FilterSection>

      <FilterSection icon="fa-money-bill-wave" label="Daily Rate">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-[#d6e0da] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#4a6568]">{formatNpr(priceRange[0])}</span>
            <span className="rounded-full border border-[#d6e0da] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#4a6568]">{formatNpr(priceRange[1])}</span>
          </div>
          <input type="range" min="0" max="50000" step="500" value={priceRange[0]} onChange={e => setPriceRange([Math.min(Number(e.target.value), priceRange[1]), priceRange[1]])}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" />
          <input type="range" min="0" max="50000" step="500" value={priceRange[1]} onChange={e => setPriceRange([priceRange[0], Math.max(Number(e.target.value), priceRange[0])])}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" />
        </div>
      </FilterSection>

      <FilterSection icon="fa-person" label="Seating Capacity">
        <div className="space-y-2">
          <span className="rounded-full border border-[#d6e0da] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#4a6568]">{minSeats}+ seats</span>
          <input type="range" min="1" max="9" step="1" value={minSeats} onChange={e => setMinSeats(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" />
        </div>
      </FilterSection>

      <FilterSection icon="fa-calendar-check" label="Availability">
        <FilterCheck checked={availableOnly} onChange={() => setAvailableOnly(!availableOnly)} label={pickupDateTime && dropoffDateTime ? "Only show vehicles available for selected dates" : "Only show available vehicles"} />
        {pickupDateTime && dropoffDateTime && (
          <p className="text-[10px] text-[#6a8a8d] mt-1">Filtering by date availability</p>
        )}
      </FilterSection>
    </div>
  );

  return (
    <div className="vrs-page min-h-screen bg-white font-poppins">
      <main id="app" className="vrs-theme-scope min-h-screen">
        <Header />
        <div className="mx-auto w-[95%] max-w-[1460px] pb-14 pt-2 lg:pt-4">
      <section className="elite-stage premium-surface relative mb-8 overflow-hidden rounded-[32px] p-6 sm:p-8 lg:p-9">
        <div className="pointer-events-none absolute -right-8 top-8 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(217,136,79,0.24),transparent_70%)]"></div>
        <div className="grid gap-6 lg:grid-cols-[1.25fr,0.9fr] lg:items-end">
          <div>
            <p className="premium-chip inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">Fleet Discovery Hub</p>
            <h1 className="mt-4 max-w-[760px] text-[34px] font-extrabold leading-[1.04] tracking-[-0.028em] text-ink sm:text-[48px]">
              Find Your Exact Rental Vehicle in Minutes
            </h1>
            <p className="mt-4 max-w-[820px] text-[16px] leading-relaxed text-[#355053]">
              Search live fleet inventory with date-aware availability, transparent NPR pricing, and curated vehicle insights organized by brand and class for confident booking.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <article className="rounded-2xl border border-[#d6dfd8] bg-white/86 px-4 py-3 shadow-[0_10px_20px_rgba(11,34,37,0.09)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#567073]">Real-Time Inventory</p>
              <p className="mt-1 text-[17px] font-bold text-[#1d4144]">Live Catalog Sync</p>
            </article>
            <article className="rounded-2xl border border-[#d6dfd8] bg-white/86 px-4 py-3 shadow-[0_10px_20px_rgba(11,34,37,0.09)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#567073]">Booking Ready</p>
              <p className="mt-1 text-[17px] font-bold text-[#1d4144]">NPR Pricing Clarity</p>
            </article>
            <article className="rounded-2xl border border-[#d6dfd8] bg-white/86 px-4 py-3 shadow-[0_10px_20px_rgba(11,34,37,0.09)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#567073]">Date Intelligence</p>
              <p className="mt-1 text-[17px] font-bold text-[#1d4144]">Booked Vehicles Hidden</p>
            </article>
          </div>
        </div>
      </section>

      <div className="elite-stage elite-search-shell premium-surface relative z-20 mb-8 rounded-[32px] p-5 [animation-delay:90ms] sm:p-6 lg:p-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[rgba(22,56,59,0.12)] pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#587175]">Journey Search</p>
            <h2 className="premium-section-title mt-1 text-[24px] font-bold tracking-[-0.015em]">Plan Pickup, Return, and Dates</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.11em] text-[#4a6568]"><i className="fas fa-map-marker-alt mr-2 text-accent"></i>Pickup Location</label>
            <input type="text" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="For booking reference only" className="w-full rounded-2xl border border-[#d4ded9] bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
            <p className="text-[10px] text-[#6a8a8d]">For reference only - not used for filtering</p>
          </div>
          <div className="space-y-2">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.11em] text-[#4a6568]"><i className="fas fa-calendar-check mr-2 text-accent"></i>Pickup Date *</label>
            <input type="datetime-local" value={pickupDateTime} onChange={(e) => setPickupDateTime(e.target.value)} className="w-full rounded-2xl border border-[#d4ded9] bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </div>
          <div className="space-y-2">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.11em] text-[#4a6568]"><i className="fas fa-map-marker-alt mr-2 text-accent"></i>Return Location</label>
            <input type="text" value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} placeholder="For booking reference only" className="w-full rounded-2xl border border-[#d4ded9] bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
            <p className="text-[10px] text-[#6a8a8d]">For reference only - not used for filtering</p>
          </div>
          <div className="space-y-2">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.11em] text-[#4a6568]"><i className="fas fa-calendar-times mr-2 text-accent"></i>Return Date *</label>
            <input type="datetime-local" value={dropoffDateTime} onChange={(e) => setDropoffDateTime(e.target.value)} className="w-full rounded-2xl border border-[#d4ded9] bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </div>
          <div className="flex items-end md:col-span-2 lg:col-span-1">
            <button disabled={checkingAvailability} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_24px_rgba(229,140,78,0.35)] disabled:opacity-50">
              {checkingAvailability ? (
                <><i className="fas fa-spinner fa-spin"></i> Checking...</>
              ) : (
                <><i className="fas fa-search"></i> Search</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(290px,320px)_minmax(0,1fr)] items-start">
        <aside className="hidden lg:block sticky top-4">
          <div className="overflow-hidden rounded-[30px] border border-[#d4ddd7] bg-[linear-gradient(165deg,#ffffff,#f8f3ea)] shadow-[0_22px_44px_rgba(10,31,34,0.12)]">
            <header className="border-b border-[rgba(22,56,59,0.12)] px-5 py-4 sm:px-6 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(246,242,234,0.9))]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a7377]">Search Intelligence</p>
              <h3 className="mt-1 text-[22px] font-bold tracking-[-0.015em] text-[#1f4246]">Filters</h3>
            </header>
            <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              {filterSidebar}
            </div>
          </div>
        </aside>

        <button onClick={() => setMobileFilterOpen(true)} className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-white shadow-[0_16px_30px_rgba(229,140,78,0.45)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 lg:hidden" title="Open Filters">
          <span className="material-symbols-outlined text-[20px]">tune</span>
          <span className="text-sm font-semibold">Filters</span>
        </button>

        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilterOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-[340px] max-w-[90vw] overflow-y-auto bg-white dark:bg-[#1a2228] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1f4246]">Filters</h3>
                <button onClick={() => setMobileFilterOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
              </div>
              {filterSidebar}
            </div>
          </div>
        )}

        <div className="min-w-0">
          <div className="elite-stage mb-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-[#d9e2de] bg-white/92 p-5 shadow-[0_12px_28px_rgba(10,31,34,0.08)] [animation-delay:140ms] sm:flex-row sm:p-6">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-[#4a6568]">Live Catalog</p>
              <p className="mt-1 text-[18px] font-bold text-ink"><span>{filtered.length}</span> vehicles found</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-w-[230px] rounded-xl border border-[#d4ded9] bg-white px-4 py-2.5 text-sm font-semibold text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25">
                <option value="relevance">Sort by: Relevance</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
              {hasActiveFilters && (
                <button onClick={clearAll} className="flex items-center gap-2 rounded-xl border border-[#f4cfb3] bg-[#fff4eb] px-4 py-2.5 text-sm font-semibold text-accent transition hover:-translate-y-0.5">
                  <i className="fas fa-times-circle"></i> Clear All
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-[24px] border border-[#d4ddd7] bg-white p-0 animate-pulse shadow-[0_14px_30px_rgba(10,31,34,0.1)]">
                  <div className="h-52 rounded-t-[24px] bg-gray-200" />
                  <div className="p-5 space-y-3"><div className="h-5 w-3/4 rounded bg-gray-200" /><div className="h-4 w-1/2 rounded bg-gray-200" /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-[#d9e2de] bg-white/90 py-16 text-center shadow-[0_12px_28px_rgba(10,31,34,0.08)] animate-fadeIn">
              <i className="fas fa-search mb-4 text-6xl text-muted"></i>
              <h3 className="mb-2 text-2xl font-bold text-ink">No vehicles found</h3>
              <p className="mb-6 text-muted">Try adjusting your search criteria or filters</p>
              <button onClick={clearAll} className="rounded-full bg-accent px-6 py-3 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_24px_rgba(229,140,78,0.35)]">Reset Search</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {filtered.map((v, idx) => {
                const feats = Array.isArray(v.features) ? v.features : [];
                const reviewCount = Math.floor((v.rating || 0) * 8 + 5);
                return (
                  <div key={v.id}>
                  <div
                    onClick={() => router.push(`/vehicles/${toSlug(v.brand, v.name)}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/vehicles/${toSlug(v.brand, v.name)}`); }}
                    className="group cursor-pointer overflow-hidden rounded-[24px] border border-[#d4ddd7] bg-[linear-gradient(165deg,#ffffff,#f8f3ea)] shadow-[0_14px_30px_rgba(10,31,34,0.1)] transition-[box-shadow,border-color] duration-300 hover:shadow-[0_24px_42px_rgba(10,31,34,0.16)]">
                    <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#2a5c5f] to-[#1f5659]">
                      <img src={v.imageUrl || '/assets/images/car-transparent.png'} alt={v.name} loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        onError={e => { (e.target as HTMLImageElement).src = '/assets/images/car-transparent.png'; }} />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d2528]/62 via-[#0d2528]/10 to-transparent" />
                      {v.status === 'available'
                        ? <div className="absolute left-4 top-4 rounded-full border border-[#b7e1c7] bg-[#e9fff1] px-3 py-1 text-[11px] font-semibold text-[#1b6a3d]"><i className="fas fa-check-circle mr-1" />Available</div>
                        : <div className="absolute left-4 top-4 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"><i className="fas fa-clock mr-1" />Booked</div>
                      }
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 rounded-xl border border-white/25 bg-[#10292b]/52 px-3 py-2 text-white backdrop-blur-sm">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">{v.type || v.category || 'Vehicle'}</p>
                        <p className="text-[11px] font-semibold">{formatNpr(v.pricePerDay)} / day</p>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[20px] font-bold leading-tight text-ink">{v.brand} {v.name}</h3>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#628083]">
                            {v.plateNumber ? `Vehicle No. ${v.plateNumber}` : (v.name ? `Vehicle No. ${v.brand?.charAt(0) || ''}${v.name?.charAt(0) || ''}-${String(idx + 1).padStart(3, '0')}` : 'Verified fleet listing')}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4 grid grid-cols-2 gap-2 text-[12px] text-[#4f686b] font-semibold">
                        <div className="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i className="fas fa-gears mr-1 text-[#5a7477]" />{v.transmission || 'Auto'}</div>
                        <div className="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i className="fas fa-gas-pump mr-1 text-[#5a7477]" />{v.fuelType || 'Petrol'}</div>
                        <div className="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i className="fas fa-person mr-1 text-[#5a7477]" />{v.seats || 5} Seats</div>
                        <div className="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i className="fas fa-list-check mr-1 text-[#5a7477]" />{feats.length} Features</div>
                      </div>

                      {feats.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          {feats.slice(0, 3).map((f: string, i: number) => (
                            <span key={i} className="rounded-full border border-[#d7dfda] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#406064]">{formatFeature(f)}</span>
                          ))}
                          {feats.length > 3 && <span className="rounded-full border border-[#d7dfda] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6a8184]">+{feats.length - 3}</span>}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/vehicles/${toSlug(v.brand, v.name)}`); }}
                          className="flex-1 rounded-xl border border-[#d7dfda] bg-white py-2.5 font-semibold text-[#22494d] transition duration-200 hover:-translate-y-0.5 hover:border-[#8ea8ab]">
                          View Details
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/booking?vehicle=${v.id}`); }}
                          className="flex-1 rounded-xl border border-[#1f7668] bg-white py-2.5 font-semibold text-[#1f7668] transition duration-200 hover:-translate-y-0.5 hover:border-[#16584d] hover:bg-[#1f7668] hover:text-white hover:shadow-[0_10px_22px_rgba(31,118,104,0.28)]">
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}

function FilterSection({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-[#d7e0da] bg-white/85 px-4 py-4 shadow-[0_8px_18px_rgba(9,30,34,0.07)]">
      <div className="mb-3 flex cursor-pointer items-center gap-2" onClick={() => setOpen(!open)}>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#d1ddd8] bg-white text-[#2f5e62]">
          <i className={`fas ${icon} text-[12px]`} />
        </span>
        <h3 className="flex-1 text-sm font-semibold text-[#1f4043]">{label}</h3>
        <i className={`fas fa-chevron-down text-xs text-[#698083] transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </div>
      {open && <div className="space-y-2 pl-1">{children}</div>}
    </div>
  );
}

function FilterCheck({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white/80 p-2 text-sm text-[#30484b] transition hover:border-[#d4ddd8] hover:bg-white">
      <input type="checkbox" checked={checked} onChange={onChange}
        className="h-4 w-4 rounded border-[#c7d5cf] text-accent focus:ring-accent/30" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export default function Vehicles() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>}>
      <VehiclesContent />
    </Suspense>
  );
}
