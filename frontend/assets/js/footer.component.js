/**
 * Footer Component for Vehicle Rental System
 * Exact design match from reference image
 */

window.VRSFooter = (function () {
  'use strict';

  function renderFooter() {
    return `
      <footer class="vrs-footer vrs-theme-scope relative mt-20 bg-[#e8e6df] dark:bg-slate-900">
        
        <!-- Car Brand Logos Section -->
        <div class="border-b border-slate-300/50 py-8 dark:border-slate-700">
          <div class="relative z-10 mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-8 px-4 opacity-60 grayscale transition-opacity duration-300 hover:opacity-80 sm:gap-12 lg:justify-between">
            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Ford_logo_flat.svg" alt="Ford" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg" alt="Mercedes" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda_Logo.svg" alt="Honda" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Jeep_logo.svg" alt="Jeep" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/1f/Volvo_Iron_Mark_Black.svg" alt="Volvo" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Mitsubishi_logo.svg" alt="Mitsubishi" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg" alt="Volkswagen" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/84/Audi_logo.svg" alt="Audi" class="h-8 w-auto object-contain sm:h-10" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/66/Hyundai_Motor_Company_logo.svg" alt="Hyundai" class="h-8 w-auto object-contain sm:h-10" />
          </div>
        </div>

        <!-- Main Footer Content -->
        <div class="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            
            <!-- Column 1: Brand & Description -->
            <div>
              <div class="mb-4">
                <h2 class="text-[28px] font-black uppercase leading-none tracking-tight text-slate-800 dark:text-slate-100">RENT A CAR</h2>
                <p class="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Where Quality Meets Affordability</p>
              </div>
              <p class="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                Aliquam nec pede sit. Aliquam blandit leo vitae tristique auctor. Vestibulum eget urna leo. Suspendisse dignissim semper neque, ut sagittis augue leo. Suspendisse dignissim semper neque, ut sagittis augue faucibus vitae. Nunc vehicula.
              </p>
            </div>

            <!-- Column 2: Contact Info -->
            <div>
              <h3 class="mb-6 text-[16px] font-bold text-slate-800 dark:text-slate-100">Contact Info</h3>
              <ul class="space-y-4">
                <li class="flex items-start gap-3">
                  <span class="material-symbols-outlined mt-0.5 text-[20px] text-slate-500 dark:text-slate-400">location_on</span>
                  <div class="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                    <div>867 Yorkshire Circle</div>
                    <div>Rocky Mount, North Carolina</div>
                    <div>27801</div>
                  </div>
                </li>
                <li class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">phone</span>
                  <div class="text-[13px] text-slate-600 dark:text-slate-400">
                    <div>+61-02448-3389</div>
                    <div>+61-01506-1386</div>
                  </div>
                </li>
                <li class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">mail</span>
                  <a href="mailto:hello@ac.com" class="text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400 dark:hover:text-[#ff6b35]">hello@ac.com</a>
                </li>
              </ul>
            </div>

            <!-- Column 3: Information Links -->
            <div>
              <h3 class="mb-6 text-[16px] font-bold text-slate-800 dark:text-slate-100">Information Links</h3>
              <ul class="space-y-3">
                <li><a href="#" class="group inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400 dark:hover:text-[#ff6b35]"><span class="mr-2 text-slate-400">›</span>Book Now</a></li>
                <li><a href="#" class="group inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400 dark:hover:text-[#ff6b35]"><span class="mr-2 text-slate-400">›</span>Our Locations</a></li>
                <li><a href="#" class="group inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400 dark:hover:text-[#ff6b35]"><span class="mr-2 text-slate-400">›</span>Terms & Conditions</a></li>
                <li><a href="#" class="group inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400 dark:hover:text-[#ff6b35]"><span class="mr-2 text-slate-400">›</span>Cancelation</a></li>
                <li><a href="#" class="group inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400 dark:hover:text-[#ff6b35]"><span class="mr-2 text-slate-400">›</span>Privacy Policy</a></li>
              </ul>
            </div>

            <!-- Column 4: Newsletter -->
            <div>
              <h3 class="mb-6 text-[16px] font-bold text-slate-800 dark:text-slate-100">Subscribe To Our Newsletter</h3>
              <form class="mb-6">
                <div class="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-[#ff6b35] focus:ring-2 focus:ring-[#ff6b35]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button 
                    type="submit" 
                    class="rounded-lg bg-[#ff6b35] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#ff5722]"
                  >
                    Submit
                  </button>
                </div>
              </form>
              
              <!-- Social Icons -->
              <div class="flex items-center gap-3">
                <a href="#" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[#1877f2] hover:bg-[#1877f2] hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Facebook">
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="#" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[#E4405F] hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#bc1888] hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Instagram">
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="#" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[#FF0000] hover:bg-[#FF0000] hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="YouTube">
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
                <a href="#" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[#1DA1F2] hover:bg-[#1DA1F2] hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Twitter">
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Copyright -->
        <div class="border-t border-slate-300/50 py-6 dark:border-slate-700">
          <p class="text-center text-[12px] text-slate-500 dark:text-slate-400">
            Copyright ©${new Date().getFullYear()} All rights reserved
          </p>
        </div>
      </footer>
    `;
  }

  function init() {
    if (document.querySelector('.vrs-footer')) {
      return;
    }
    const footerHTML = renderFooter();
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, renderFooter };
})();
