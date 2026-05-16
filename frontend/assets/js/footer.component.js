/**
 * Footer Component for Vehicle Rental System
 * Professional footer with dark/light mode support
 */

window.VRSFooter = (function () {
  'use strict';

  function renderFooter() {
    return `
      <footer class="vrs-footer vrs-theme-scope relative mt-20 overflow-hidden border-t border-slate-200/40 bg-gradient-to-br from-slate-50/95 via-white to-slate-100/90 backdrop-blur-sm dark:border-white/5 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <!-- Enhanced decorative gradient overlays -->
        <div class="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <div class="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(44,118,110,0.15),transparent_65%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(74,163,153,0.2),transparent_65%)]"></div>
          <div class="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(229,140,78,0.15),transparent_65%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(226,154,102,0.2),transparent_65%)]"></div>
          <div class="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(31,118,104,0.08),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(74,163,153,0.12),transparent_70%)]"></div>
        </div>

        <div class="relative z-10 mx-auto w-[95%] max-w-[1390px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <!-- Main Footer Content -->
          <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
            
            <!-- Brand Column -->
            <div class="lg:col-span-5">
              <div class="mb-6">
                <h2 class="vrs-brand-wordmark bg-[linear-gradient(135deg,#0e2528,#1f7668_55%,#2c9a8a)] bg-clip-text text-[32px] font-black leading-none tracking-tight text-transparent drop-shadow-sm dark:bg-[linear-gradient(135deg,#f6fbfd,#95dacb_55%,#6fc5b7)]">
                  RENT A VEHICLE
                </h2>
                <p class="vrs-brand-tagline mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#1B2E2F]/80 dark:text-[#bfd2da]">
                  Luxury Vehicle Service
                </p>
                <span class="vrs-brand-underline mt-3 block h-[3px] w-32 rounded-full bg-[linear-gradient(90deg,#E58C4E,#2C766E,#1f7668)] opacity-90 shadow-sm dark:bg-[linear-gradient(90deg,#f1b182,#6fc5b7,#4aa399)]"></span>
              </div>
              
              <p class="mt-5 max-w-md text-[15px] leading-relaxed text-slate-600/90 dark:text-slate-300/90">
                Your trusted partner for premium vehicle rentals in Nepal. Experience luxury, reliability, and exceptional service on every journey.
              </p>

              <!-- Social Media Links - Only Facebook & Instagram -->
              <div class="mt-8 flex items-center gap-4">
                <a href="#" class="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200/80 bg-gradient-to-br from-white to-slate-50 text-slate-600 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#1877f2] hover:bg-[#1877f2] hover:text-white hover:shadow-xl hover:shadow-blue-500/25 dark:border-white/10 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300 dark:hover:border-[#1877f2] dark:hover:bg-[#1877f2]" aria-label="Facebook">
                  <svg class="relative z-10 h-6 w-6 transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  <div class="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-600/0 opacity-0 transition-opacity duration-300 group-hover:opacity-20"></div>
                </a>
                <a href="#" class="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200/80 bg-gradient-to-br from-white to-slate-50 text-slate-600 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#bc1888] hover:text-white hover:shadow-xl hover:shadow-pink-500/25 dark:border-white/10 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300 dark:hover:border-transparent" aria-label="Instagram">
                  <svg class="relative z-10 h-6 w-6 transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  <div class="absolute inset-0 bg-gradient-to-br from-pink-400/0 to-purple-600/0 opacity-0 transition-opacity duration-300 group-hover:opacity-20"></div>
                </a>
              </div>
            </div>

            <!-- Quick Links -->
            <div class="lg:col-span-2">
              <h3 class="mb-5 text-[14px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-slate-50">Quick Links</h3>
              <ul class="space-y-3.5">
                <li><a href="index.html" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Home</a></li>
                <li><a href="vehicles.html" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Browse Vehicles</a></li>
                <li><a href="search.html" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Advanced Search</a></li>
                <li><a href="#" data-open-bookings-panel class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>My Bookings</a></li>
                <li><a href="profile-verification.html" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Profile</a></li>
              </ul>
            </div>

            <!-- Services -->
            <div class="lg:col-span-2">
              <h3 class="mb-5 text-[14px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-slate-50">Services</h3>
              <ul class="space-y-3.5">
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Daily Rentals</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Weekly Rentals</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Monthly Rentals</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Airport Transfer</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Corporate Rentals</a></li>
              </ul>
            </div>

            <!-- Support -->
            <div class="lg:col-span-2">
              <h3 class="mb-5 text-[14px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-slate-50">Support</h3>
              <ul class="space-y-3.5">
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Help Center</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>FAQs</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Contact Us</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Terms & Conditions</a></li>
                <li><a href="#" class="group inline-flex items-center text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]"><span class="mr-2 text-[#1f7668] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-[#4aa399]">→</span>Privacy Policy</a></li>
              </ul>
            </div>

            <!-- Contact Info -->
            <div class="lg:col-span-3">
              <h3 class="mb-5 text-[14px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-slate-50">Contact</h3>
              <ul class="space-y-4">
                <li class="flex items-start gap-3">
                  <span class="material-symbols-outlined mt-0.5 text-[20px] text-[#1f7668] dark:text-[#4aa399]">location_on</span>
                  <span class="text-[14px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">Thamel, Kathmandu<br/>Nepal</span>
                </li>
                <li class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-[20px] text-[#1f7668] dark:text-[#4aa399]">phone</span>
                  <a href="tel:+9771234567890" class="text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]">+977 123-456-7890</a>
                </li>
                <li class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-[20px] text-[#1f7668] dark:text-[#4aa399]">mail</span>
                  <a href="mailto:info@rentavehicle.com" class="text-[14px] font-medium text-slate-600 transition-all duration-200 hover:translate-x-1 hover:text-[#1f7668] dark:text-slate-300 dark:hover:text-[#4aa399]">info@rentavehicle.com</a>
                </li>
                <li class="flex items-start gap-3">
                  <span class="material-symbols-outlined mt-0.5 text-[20px] text-[#1f7668] dark:text-[#4aa399]">schedule</span>
                  <span class="text-[14px] font-medium text-slate-600 dark:text-slate-300">24/7 Customer Support</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Divider -->
          <div class="my-10 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent dark:via-slate-600/40"></div>

          <!-- Bottom Bar -->
          <div class="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <p class="text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
              © ${new Date().getFullYear()} <span class="font-semibold text-slate-700 dark:text-slate-300">Rent A Vehicle Nepal</span>. All rights reserved.
            </p>
            
            <div class="flex flex-wrap items-center justify-center gap-5 text-[13px] font-medium">
              <a href="#" class="text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-[#1f7668] dark:text-slate-400 dark:hover:text-[#4aa399]">Privacy</a>
              <span class="text-slate-300 dark:text-slate-600">•</span>
              <a href="#" class="text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-[#1f7668] dark:text-slate-400 dark:hover:text-[#4aa399]">Terms</a>
              <span class="text-slate-300 dark:text-slate-600">•</span>
              <a href="#" class="text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-[#1f7668] dark:text-slate-400 dark:hover:text-[#4aa399]">Sitemap</a>
            </div>
          </div>

          <!-- Trust Badges -->
          <div class="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-slate-200/40 pt-8 dark:border-white/5">
            <div class="group flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <span class="material-symbols-outlined text-[22px] text-emerald-600 transition-transform duration-300 group-hover:scale-110 dark:text-emerald-400">verified</span>
              <span class="text-[13px] font-bold text-slate-700 dark:text-slate-300">Verified Business</span>
            </div>
            <div class="group flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <span class="material-symbols-outlined text-[22px] text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:text-blue-400">security</span>
              <span class="text-[13px] font-bold text-slate-700 dark:text-slate-300">Secure Payments</span>
            </div>
            <div class="group flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <span class="material-symbols-outlined text-[22px] text-amber-600 transition-transform duration-300 group-hover:scale-110 dark:text-amber-400">star</span>
              <span class="text-[13px] font-bold text-slate-700 dark:text-slate-300">4.8/5 Rating</span>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  function init() {
    // Check if footer already exists
    if (document.querySelector('.vrs-footer')) {
      return;
    }

    // Append footer to body
    const footerHTML = renderFooter();
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    renderFooter
  };
})();
