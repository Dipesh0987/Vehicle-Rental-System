'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import NotificationBell from '@/components/ui/NotificationBell';
import BookingsModal from '@/components/ui/BookingsModal';

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path;
  
  // Check if user is an admin (should not show on frontend)
  const isAdminUser = profile?.role && ['super_admin', 'admin', 'staff', 'manager', 'employee'].includes(profile.role);
  
  // Treat admin users as not logged in for frontend display
  const showAsLoggedIn = user && !isAdminUser;
  
  const avatarUrl = profile?.avatar_url || profile?.profile_image_url;
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Guest User';
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navLinkBase = "vrs-global-nav-link bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_2px] bg-[position:0_100%] bg-no-repeat transition-[color,transform,background-size] duration-200 hover:-translate-y-[1px] hover:bg-[length:100%_2px] hover:text-[#183b3f]";

  return (
    <>
      <header className="vrs-theme-scope relative z-[90] mx-auto grid w-[95%] max-w-[1390px] grid-cols-[auto,1fr,auto] items-center gap-6 py-4">
        {/* Brand */}
        <Link href="/" className="group relative text-ink transition duration-200 hover:-translate-y-[1px] hover:text-[#164144]">
          <span className="vrs-brand-wordmark block text-[24px] font-extrabold leading-none tracking-tight lg:text-[34px]">
            <span className="text-[#E58C4E]">AS</span>
            <span className="text-slate-800 dark:text-white">Self</span>
          </span>
          <span className="vrs-brand-tagline -mt-1 block text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300 lg:text-[11px]">Self Drive Car Rental</span>
          <span className="vrs-brand-underline mt-1 block h-[2px] w-20 rounded-full bg-[linear-gradient(90deg,#E58C4E,#2C766E)] opacity-75 animate-glowPulse"></span>
        </Link>

        {/* Desktop nav */}
        <nav className="vrs-global-nav hidden items-center justify-start gap-10 pl-6 text-[16px] font-medium text-[#2F3336] lg:flex">
          <Link href="/" className={isActive('/') ? 'vrs-global-nav-link text-accent' : navLinkBase}>Home</Link>
          <Link href="/vehicles" className={isActive('/vehicles') || isActive('/booking') ? 'vrs-global-nav-link text-accent' : navLinkBase}>Vehicles</Link>
<button type="button" onClick={() => setBookingsOpen(true)} className={navLinkBase + ' cursor-pointer'}>Your Bookings</button>
          <Link href="/vendor-enquiry" className={isActive('/vendor-enquiry') ? 'vrs-global-nav-link text-accent' : navLinkBase}>Become a Vendor</Link>
                    <Link href="/contact" className={isActive('/contact') ? 'vrs-global-nav-link text-accent' : navLinkBase}>Contact</Link>
          
        </nav>

        {/* Right section */}
        <div className="flex items-center justify-end gap-2 pr-1 sm:gap-3 sm:pr-0">
          <button type="button" onClick={toggleTheme} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" aria-label="Toggle theme" title="Toggle theme">
            <span className="material-symbols-outlined">contrast</span>
          </button>

          {/* Hamburger button - mobile only, AFTER theme toggle */}
          <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" aria-label="Menu">
            <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>

          {showAsLoggedIn ? (
            <div data-auth-user className="hidden items-center gap-3 lg:flex">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Profile trigger + dropdown */}
              <div ref={profileRef} className="relative">
                <button type="button" onClick={() => setProfileOpen(!profileOpen)} className="inline-flex cursor-pointer items-center gap-[0.65rem] transition duration-200 hover:-translate-y-[1px] hover:brightness-105">
                  <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[#1b5d5f]/40 bg-[linear-gradient(135deg,#2c766e,#2f5f7b)] text-[0.95rem] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[15px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">{displayName}</span>
                    <span className="text-[11px] text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">{user.email}</span>
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-[#567073] transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Profile dropdown */}
                <div className={`absolute right-0 top-[calc(100%+10px)] z-[130] w-[280px] origin-top-right rounded-[16px] border border-[rgba(23,57,60,0.12)] bg-white p-2 shadow-[0_20px45px_rgba(2,14,16,0.15)] transition duration-200 dark:border-white/10 dark:bg-[#1a2e30] ${profileOpen ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'}`}>
                  {/* User info */}
                  <div className="flex items-center gap-3 rounded-xl bg-[#f3f8f6] px-3 py-3 dark:bg-white/5">
                    <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#1b5d5f]/30 bg-[linear-gradient(135deg,#2c766e,#2f5f7b)] text-[13px] font-semibold text-white">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#12373b] dark:text-white truncate">{displayName}</p>
                      <p className="text-[11px] text-[#567073] dark:text-white/60 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="my-2 h-px bg-[#e8eeec] dark:bg-white/10" />

                  {/* Menu items */}
                  <button type="button" onClick={() => { setProfileOpen(false); setBookingsOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#264447] transition hover:bg-[#f3f8f6] dark:text-white/80 dark:hover:bg-white/5">
                    <span className="material-symbols-outlined text-[18px] text-[#2c766e]">event_note</span>
                    Your Bookings
                  </button>
                  <Link href="/profile-verification" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#264447] transition hover:bg-[#f3f8f6] dark:text-white/80 dark:hover:bg-white/5">
                    <span className="material-symbols-outlined text-[18px] text-[#2c766e]">verified_user</span>
                    Profile Verification
                    {profile?.verification_status === 'approved' || profile?.verification_status === 'verified' ? (
                      <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Verified</span>
                    ) : profile?.verification_status === 'pending' ? (
                      <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                    ) : (
                      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Not Verified</span>
                    )}
                  </Link>

                  <div className="my-2 h-px bg-[#e8eeec] dark:bg-white/10" />

                  <button type="button" onClick={async () => { await signOut(); setProfileOpen(false); router.push('/'); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* Mobile Slide-Out Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <nav className="absolute right-0 top-0 h-full w-[280px] bg-white dark:bg-[#1a2228] shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
              <span className="text-lg font-bold text-slate-800 dark:text-white">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
                <span className="material-symbols-outlined text-slate-600 dark:text-white">close</span>
              </button>
            </div>
            <div className="p-4 space-y-1">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive('/') ? 'bg-[#145f59]/10 text-[#145f59]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <span className="material-symbols-outlined text-[20px]">home</span> Home
              </Link>
              <Link href="/vehicles" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive('/vehicles') ? 'bg-[#145f59]/10 text-[#145f59]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <span className="material-symbols-outlined text-[20px]">directions_car</span> Vehicles
              </Link>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setBookingsOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition">
                <span className="material-symbols-outlined text-[20px]">event_note</span> Your Bookings
              </button>
              <Link href="/vendor-enquiry" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive('/vendor-enquiry') ? 'bg-[#145f59]/10 text-[#145f59]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <span className="material-symbols-outlined text-[20px]">storefront</span> Become a Vendor
              </Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive('/contact') ? 'bg-[#145f59]/10 text-[#145f59]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <span className="material-symbols-outlined text-[20px]">mail</span> Contact
              </Link>
              {showAsLoggedIn && (
                <>
                  <div className="my-3 h-px bg-slate-200 dark:bg-white/10" />
                  <Link href="/profile-verification" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    <span className="material-symbols-outlined text-[20px]">verified_user</span> Profile
                  </Link>
                  <button type="button" onClick={async () => { await signOut(); setMobileMenuOpen(false); router.push('/'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 transition">
                    <span className="material-symbols-outlined text-[20px]">logout</span> Sign Out
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Bookings Modal - Available to all users */}
      <BookingsModal open={bookingsOpen} onClose={() => setBookingsOpen(false)} />
    </>
  );
}
