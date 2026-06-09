'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { listVehicles, toSlug } from '@/services/vehicle-catalog.service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleType, setVehicleType] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupDateTime, setPickupDateTime] = useState('');
  const [dropoffDateTime, setDropoffDateTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listVehicles().then((data) => setVehicles(data.slice(0, 6))).catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate dates
    if (pickupDateTime && dropoffDateTime) {
      const pickup = new Date(pickupDateTime);
      const dropoff = new Date(dropoffDateTime);
      const now = new Date();
      
      if (pickup < now) {
        setError('Pick-up date cannot be in the past');
        return;
      }
      
      if (dropoff <= pickup) {
        setError('Drop-off date must be after pick-up date');
        return;
      }
    }
    
    const params = new URLSearchParams();
    if (vehicleType) params.set('type', vehicleType);
    if (pickupLocation) params.set('location', pickupLocation);
    if (pickupDateTime) params.set('start', pickupDateTime);
    if (dropoffDateTime) params.set('end', dropoffDateTime);
    router.push(`/vehicles?${params.toString()}`);
  };

  return (
    <div className="vrs-page min-h-screen bg-white font-poppins">
      <main id="app" className="vrs-theme-scope min-h-screen">
        <section className="home-hero-shell relative min-h-screen overflow-x-hidden bg-[#F2F3F1] lg:h-screen lg:overflow-hidden">
          <div className="pointer-events-none absolute bottom-[-200px] left-[-80px] z-[1] hidden select-none text-[580px] font-extrabold leading-[0.8] tracking-[0.04em] text-[rgba(11,22,28,0.03)] lg:block" aria-hidden="true">WAS</div>

          <div className="home-side-panel absolute inset-y-0 right-0 w-[42%] overflow-hidden bg-panel animate-panelReveal">
            <div className="pointer-events-none absolute inset-0" style={{background:'rgba(242,243,241,0.98)',clipPath:'polygon(0 0,62% 0,0 70%)'}} aria-hidden="true"></div>
          </div>

          <div className="pointer-events-none absolute bottom-0 right-0 z-[17] hidden w-[44%] max-w-[700px] lg:block" aria-hidden="true">
            <div className="mx-auto h-[16px] w-[68%] translate-y-[1px] rounded-[50%] bg-[rgba(4,14,16,0.42)] blur-[20px]"></div>
          </div>

          <img loading="lazy" src="/assets/images/car-transparent.png"
            alt="ASSelf Nepal - Premium SUV Car Rental Kathmandu Banasthali" width="1600" height="1221" decoding="async"
            className="home-hero-car absolute bottom-0 right-0 z-[18] hidden w-[44%] max-w-[700px] [filter:drop-shadow(0_12px_28px_rgba(4,18,20,0.26))_drop-shadow(0_3px_8px_rgba(4,18,20,0.16))] transition duration-[380ms] hover:scale-[1.01] lg:block animate-floatCar"
          />

          <div className="relative z-20 mx-auto h-full w-[95%] max-w-[1390px]">
            <Header />

            <div className="relative mt-4 h-auto pb-8 lg:mt-5 lg:h-[calc(100vh-112px)] lg:pb-0">
              <div className="home-hero-card relative z-20 w-full opacity-0 animate-floatIn lg:w-[54%]">
                <div className="home-hero-card-panel rounded-md bg-[#F5F6F4] p-5 opacity-0 translate-y-5 transition duration-300 hover:-translate-y-[2px] hover:shadow-[0_18px_34px_rgba(12,35,38,0.1)] animate-fadeUp sm:p-6 lg:p-8">
                  <h1 className="max-w-[760px] text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px] lg:text-[66px]">
                    <span className="text-[#E58C4E]">AS</span>Self - #1 Car Rental in Kathmandu Nepal
                  </h1>
                  <p className="mt-4 max-w-[790px] text-[14px] leading-[1.55] text-[#3E4448] opacity-0 translate-y-5 animate-fadeUp sm:text-[15px] lg:text-[16px] [animation-delay:90ms]">
                    Nepal's premier self-drive car rental service. Rent cars, SUVs, luxury vehicles in Kathmandu, Pokhara, Chitwan with ASSelf. 
                    Drive yourself - no driver needed! Best prices, instant booking, and reliable vehicles for every journey.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-x-2 gap-y-4 opacity-0 translate-y-5 animate-fadeUp lg:grid-cols-2 lg:gap-x-2 [animation-delay:180ms]">
                  <label className="block cursor-pointer rounded-2xl p-1 transition duration-200 hover:-translate-y-[1px] hover:bg-white/40 hover:shadow-[0_8px_16px_rgba(12,35,38,0.08)]">
                    <span className="text-[18px] font-medium text-[#2D3337] lg:text-[16px]">Select Your Vehicle Type</span>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} required
                      className="mt-2 h-[42px] w-full rounded-full border-0 bg-white px-5 text-[14px] text-[#4a545b] outline-none sm:w-[80%] lg:h-[42px] lg:w-[78%] lg:text-[14px]">
                      <option value="">Choose vehicle type</option>
                      {[...new Set(vehicles.map(v => (v.category || v.type || '').toLowerCase().trim()).filter(Boolean))].sort().map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block cursor-pointer rounded-2xl p-1 transition duration-200 hover:-translate-y-[1px] hover:bg-white/40 hover:shadow-[0_8px_16px_rgba(12,35,38,0.08)]">
                    <span className="text-[18px] font-medium text-[#2D3337] lg:text-[16px]">Pick Up Location</span>
                    <input type="text" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Self Drive Kathmandu, Banasthali, Nepal" required
                      className="mt-2 h-[42px] w-full rounded-full border-0 bg-white px-5 text-[14px] text-[#4a545b] outline-none placeholder:text-[#A2A9B0] sm:w-[80%] lg:h-[42px] lg:w-[78%] lg:text-[14px]" />
                  </label>

                  <label className="block cursor-pointer rounded-2xl p-1 transition duration-200 hover:-translate-y-[1px] hover:bg-white/40 hover:shadow-[0_8px_16px_rgba(12,35,38,0.08)]">
                    <span className="text-[18px] font-medium text-[#2D3337] lg:text-[16px]">Date of Pick Up/Time</span>
                    <input type="datetime-local" value={pickupDateTime} onChange={(e) => { setPickupDateTime(e.target.value); setError(''); }} required
                      min={new Date().toISOString().slice(0, 16)}
                      className="mt-2 h-[42px] w-full rounded-full border-0 bg-white px-5 text-[14px] text-[#4a545b] outline-none sm:w-[80%] lg:h-[42px] lg:w-[78%] lg:text-[14px]" />
                  </label>

                  <label className="block cursor-pointer rounded-2xl p-1 transition duration-200 hover:-translate-y-[1px] hover:bg-white/40 hover:shadow-[0_8px_16px_rgba(12,35,38,0.08)]">
                    <span className="text-[18px] font-medium text-[#2D3337] lg:text-[16px]">Date of Drop-off/Time</span>
                    <input type="datetime-local" value={dropoffDateTime} onChange={(e) => { setDropoffDateTime(e.target.value); setError(''); }} required
                      min={pickupDateTime || new Date().toISOString().slice(0, 16)}
                      className="mt-2 h-[42px] w-full rounded-full border-0 bg-white px-5 text-[14px] text-[#4a545b] outline-none sm:w-[80%] lg:h-[42px] lg:w-[78%] lg:text-[14px]" />
                  </label>

                  {error && <p className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] font-semibold text-rose-700 sm:w-[80%] lg:w-[78%]">{error}</p>}

                  <button type="submit"
                    className="mt-2 inline-flex h-[44px] w-full items-center justify-center rounded-full bg-accent text-[18px] font-medium text-white transition duration-200 hover:-translate-y-[2px] hover:brightness-105 hover:shadow-[0_12px_24px_rgba(229,140,78,0.34)] sm:w-[80%] lg:col-span-1 lg:h-[44px] lg:w-[78%] lg:text-[15px]">
                    Browse Vehicles
                  </button>
                </form>
              </div>
            </div>

            <div className="px-2 pt-6 lg:hidden">
              <img loading="lazy" src="/assets/images/car-transparent.png" alt="Luxury SUV available for rent" width="1600" height="1221" decoding="async" className="w-full mix-blend-multiply" />
            </div>
          </div>
        </section>

        <section className="bg-[#EDEEE9] dark:bg-[#1a2228]" style={{padding:'72px 24px 80px'}}>
          <div style={{maxWidth:'1100px',margin:'0 auto'}}>
            <div className="text-center" style={{marginBottom:'56px'}}>
              <h2 className="text-[#1a2a2f] dark:text-slate-100" style={{fontFamily:"'Poppins',sans-serif",fontSize:'42px',fontWeight:700,margin:0,lineHeight:1.15}}>How it Works</h2>
              <p className="text-[#6C7074] dark:text-slate-400" style={{fontFamily:"'Poppins',sans-serif",fontSize:'14px',marginTop:'16px',lineHeight:1.7,maxWidth:'520px',marginLeft:'auto',marginRight:'auto'}}>Follow these simple steps to book your perfect rental car. Fast, easy, and hassle-free vehicle booking experience.</p>
            </div>

            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="dark:bg-[#1a5c52]" style={{width:'88px',height:'88px',borderRadius:'22px',background:'#1a5c52',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform 0.3s,box-shadow 0.3s',cursor:'pointer'}}>
                  <svg width="40" height="40" viewBox="0 0 24 24" className="fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C7.03 2 3 6.03 3 11c0 5.25 9 11 9 11s9-5.75 9-11c0-4.97-4.03-9-9-9zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <h3 className="text-[#1a2a2f] dark:text-slate-100" style={{fontFamily:"'Poppins',sans-serif",fontSize:'18px',fontWeight:600,margin:'20px 0 8px'}}>Choose Location</h3>
                <p className="text-[#6C7074] dark:text-slate-400" style={{fontFamily:"'Poppins',sans-serif",fontSize:'13px',lineHeight:1.65,margin:0,maxWidth:'210px'}}>Select your pickup location from our available branches nearby</p>
              </div>

              <div style={{flex:'0 0 100px',alignItems:'flex-start',justifyContent:'center',paddingTop:'28px'}} className="hiw-arrow">
                <svg width="100" height="48" viewBox="0 0 100 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 38 C 25 2, 75 2, 96 38" className="stroke-[#2D3B37] dark:stroke-slate-500" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              <div className="hiw-mobile-connector">
                <svg width="2" height="40" viewBox="0 0 2 40"><line x1="1" y1="0" x2="1" y2="40" className="stroke-[#2D3B37] dark:stroke-slate-500" strokeWidth="2" strokeDasharray="5 4"/></svg>
              </div>

              <div className="hiw-step">
                <div className="dark:bg-[#d9884f]" style={{width:'88px',height:'88px',borderRadius:'22px',background:'#d9884f',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 24px rgba(217,136,79,0.3)',transition:'transform 0.3s,box-shadow 0.3s',cursor:'pointer'}}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    <circle cx="8" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1.5" fill="currentColor" stroke="none"/>
                  </svg>
                </div>
                <h3 className="text-[#1a2a2f] dark:text-slate-100" style={{fontFamily:"'Poppins',sans-serif",fontSize:'18px',fontWeight:600,margin:'20px 0 8px'}}>Pick-Up Date</h3>
                <p className="text-[#6C7074] dark:text-slate-400" style={{fontFamily:"'Poppins',sans-serif",fontSize:'13px',lineHeight:1.65,margin:0,maxWidth:'210px'}}>Select your preferred date and time for vehicle pickup</p>
              </div>

              <div style={{flex:'0 0 100px',alignItems:'flex-start',justifyContent:'center',paddingTop:'28px'}} className="hiw-arrow">
                <svg width="100" height="48" viewBox="0 0 100 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 38 C 25 2, 75 2, 96 38" className="stroke-[#2D3B37] dark:stroke-slate-500" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              <div className="hiw-mobile-connector">
                <svg width="2" height="40" viewBox="0 0 2 40"><line x1="1" y1="0" x2="1" y2="40" className="stroke-[#2D3B37] dark:stroke-slate-500" strokeWidth="2" strokeDasharray="5 4"/></svg>
              </div>

              <div className="hiw-step">
                <div className="dark:bg-[#1a5c52]" style={{width:'88px',height:'88px',borderRadius:'22px',background:'#1a5c52',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform 0.3s,box-shadow 0.3s',cursor:'pointer'}}>
                  <svg width="40" height="40" viewBox="0 0 24 24" className="fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 11l1.5-4.5h11L19 11H5z"/>
                  </svg>
                </div>
                <h3 className="text-[#1a2a2f] dark:text-slate-100" style={{fontFamily:"'Poppins',sans-serif",fontSize:'18px',fontWeight:600,margin:'20px 0 8px'}}>Book Your Car</h3>
                <p className="text-[#6C7074] dark:text-slate-400" style={{fontFamily:"'Poppins',sans-serif",fontSize:'13px',lineHeight:1.65,margin:0,maxWidth:'210px'}}>Complete your booking and get instant confirmation</p>
              </div>
            </div>
          </div>

          <style>{`
            .hiw-steps { display: flex; align-items: flex-start; justify-content: center; gap: 0; }
            .hiw-arrow { display: none; }
            .hiw-step { flex: 1; max-width: 260px; display: flex; flex-direction: column; align-items: center; text-align: center; }
            .hiw-mobile-connector { display: none; }
            @media (min-width: 1024px) {
              .hiw-arrow { display: flex !important; }
              .hiw-mobile-connector { display: none !important; }
            }
            @media (max-width: 1023px) {
              .hiw-steps { flex-direction: column; align-items: center; gap: 0; }
              .hiw-step { max-width: 300px; }
              .hiw-mobile-connector { display: flex !important; align-items: center; justify-content: center; padding: 12px 0; }
            }
            @keyframes floatCar {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-15px); }
            }
            .animate-floatCar {
              animation: floatCar 4s ease-in-out infinite;
            }
          `}</style>
        </section>

        <div id="homeTopRatedSection" className="bg-[#F5F6F4] dark:bg-[#151d22]" style={{padding:'60px 24px 80px'}}>
          <div style={{maxWidth:'1100px',margin:'0 auto',textAlign:'center'}}>
            <h2 className="text-[#1a2a2f] dark:text-slate-100" style={{fontFamily:"'Poppins',sans-serif",fontSize:'36px',fontWeight:700,margin:'0 0 40px'}}>Top Rated Vehicles</h2>
            {vehicles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{maxWidth:'1100px',margin:'0 auto'}}>
                {vehicles.map((v, idx) => (
                  <div key={v.id}>
                  <div onClick={() => router.push(`/vehicles/${toSlug(v.brand, v.name)}`)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/vehicles/${toSlug(v.brand, v.name)}`); }}
                    className="rounded-2xl border border-[#d6dfd8] bg-white/86 p-0 shadow-[0_10px_20px_rgba(11,34,37,0.09)] overflow-hidden cursor-pointer transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="h-44 overflow-hidden">
                      <img src={v.imageUrl || '/assets/images/car-transparent.png'} alt={v.name} className="w-full h-full object-cover"/>
                    </div>
                    <div className="p-4">
                      <h3 className="text-[16px] font-bold text-[#1d4144]">{v.name}</h3>
                      <p className="text-[12px] text-[#567073] mt-1">{v.brand} {v.model}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[18px] font-extrabold text-[#1f5b57]">NPR {(v.pricePerDay||0).toLocaleString()}<span className="text-[12px] font-normal text-[#567073]">/day</span></span>
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/booking?vehicle=${v.id}`); }}
                          className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white transition hover:-translate-y-[1px] hover:brightness-105">Book</button>
                      </div>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#6C7074] dark:text-slate-400" style={{fontSize:'14px'}}>Loading vehicles…</p>
            )}
          </div>
        </div>

        <section className="bg-[#F5F5F5] dark:bg-[#1a2228]" style={{padding:'80px 24px 100px'}}>
          <div style={{maxWidth:'1200px',margin:'0 auto'}}>
            <div className="text-center mb-12">
              <h2 className="text-[#1a2a2f] dark:text-slate-100" style={{fontFamily:"'Poppins',sans-serif",fontSize:'38px',fontWeight:700,lineHeight:1.2,margin:'0 0 16px'}}>
                Best Services and<br/>Luxuries Cars
              </h2>
              <p className="text-[#6C7074] dark:text-slate-400 mx-auto" style={{fontFamily:"'Poppins',sans-serif",fontSize:'14px',lineHeight:1.7,maxWidth:'450px',margin:'0 auto'}}>
                Experience premium vehicle rental with our top-notch service. We offer a wide range of luxury vehicles for every occasion with exceptional customer care.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <img 
                  src="/assets/images/car-transparent.png" 
                  alt="Luxury Car" 
                  className="w-full max-w-[500px] mx-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
                />
              </div>

              <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-[#253035] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#E8EFED] dark:bg-[#1f403f] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1f5b57" strokeWidth="1.5" className="dark:stroke-[#5bbfb5]">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                        <path d="M12 8v4l3 3"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[#1a2a2f] dark:text-slate-100 font-semibold text-[16px] mb-1" style={{fontFamily:"'Poppins',sans-serif"}}>Customer Support</h4>
                      <p className="text-[#6C7074] dark:text-slate-400 text-[13px]" style={{fontFamily:"'Poppins',sans-serif",lineHeight:1.6}}>24/7 dedicated support team ready to assist you with any queries or concerns.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-[#253035] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#E8EFED] dark:bg-[#1f403f] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1f5b57" strokeWidth="1.5" className="dark:stroke-[#5bbfb5]">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[#1a2a2f] dark:text-slate-100 font-semibold text-[16px] mb-1" style={{fontFamily:"'Poppins',sans-serif"}}>Many Locations</h4>
                      <p className="text-[#6C7074] dark:text-slate-400 text-[13px]" style={{fontFamily:"'Poppins',sans-serif",lineHeight:1.6}}>Multiple pickup and drop-off points across Kathmandu for your convenience.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-[#253035] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#E8EFED] dark:bg-[#1f403f] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1f5b57" strokeWidth="1.5" className="dark:stroke-[#5bbfb5]">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M15 9l-6 6M9 9l6 6"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[#1a2a2f] dark:text-slate-100 font-semibold text-[16px] mb-1" style={{fontFamily:"'Poppins',sans-serif"}}>Free Cancellation</h4>
                      <p className="text-[#6C7074] dark:text-slate-400 text-[13px]" style={{fontFamily:"'Poppins',sans-serif",lineHeight:1.6}}>Flexible booking with free cancellation up to 24 hours before pickup.</p>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F8F9F7] dark:bg-[#151d22]" style={{padding:'60px 24px 80px'}}>
          <div style={{maxWidth:'1100px',margin:'0 auto'}}>
            <h2 className="text-[#1a2a2f] dark:text-slate-100 text-center" style={{fontFamily:"'Poppins',sans-serif",fontSize:'32px',fontWeight:700,margin:'0 0 40px'}}>
              About <span className="text-[#E58C4E]">AS</span>Self - Self Drive Car Rental Nepal
            </h2>
            
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-[#1f5b57] dark:text-[#5bbfb5] font-bold text-[18px] mb-3">#1 Self Drive Car Rental in Nepal</h3>
                <p className="text-[#6C7074] dark:text-slate-400 text-[14px] leading-[1.7] mb-4">
                  Welcome to <strong><span style={{color:'#E58C4E'}}>AS</span>Self</strong>, Nepal's premier self-drive car rental service based in Banasthali, Kathmandu. 
                  We specialize in providing high-quality vehicles for rent without drivers, giving you the freedom to explore Nepal at your own pace.
                </p>
                <p className="text-[#6C7074] dark:text-slate-400 text-[14px] leading-[1.7] mb-4">
                  Whether you need a compact car for city driving in Kathmandu, an SUV for mountain roads to Pokhara, 
                  or a luxury vehicle for a special occasion, we have the perfect vehicle for your needs.
                </p>
              </div>
              
              <div>
                <h3 className="text-[#1f5b57] dark:text-[#5bbfb5] font-bold text-[18px] mb-3">Why Choose ASSelf?</h3>
                <ul className="space-y-2 text-[14px] text-[#6C7074] dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1f5b57] font-bold">✓</span>
                    <span><strong>No Driver Required</strong> - Drive yourself and enjoy complete privacy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1f5b57] font-bold">✓</span>
                    <span><strong>Best Prices</strong> - Competitive daily and monthly rental rates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1f5b57] font-bold">✓</span>
                    <span><strong>Wide Fleet</strong> - Sedans, SUVs, Luxury cars, Vans available</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1f5b57] font-bold">✓</span>
                    <span><strong>Multiple Locations</strong> - Kathmandu, Pokhara, Chitwan service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1f5b57] font-bold">✓</span>
                    <span><strong>24/7 Support</strong> - Roadside assistance and customer service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1f5b57] font-bold">✓</span>
                    <span><strong>Easy Booking</strong> - Instant online reservation system</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-[3px] border-[#2c766e] border-t-transparent rounded-full animate-spin" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
