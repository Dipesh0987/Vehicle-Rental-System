/**
 * Footer Component for Vehicle Rental System
 * Premium dark-teal footer with light/dark mode support
 */

window.VRSFooter = (function () {
  'use strict';

  var YEAR = new Date().getFullYear();

  function socialIcon(label, href, svg, hoverBg) {
    return '<a href="' + href + '" class="vrs-footer-social" data-hover="' + hoverBg + '" aria-label="' + label + '">' + svg + '</a>';
  }

  function renderFooter() {
    return '<footer class="vrs-footer vrs-theme-scope relative">' +

      /* ── Accent gradient stripe ── */
      '<div class="h-[3px] w-full bg-[linear-gradient(90deg,#145f59_0%,#2c766e_35%,#d9884f_70%,#c47337_100%)]"></div>' +

      /* ── Main body ── */
      '<div class="vrs-footer-body relative overflow-hidden">' +

        /* Decorative circle */
        '<div class="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full opacity-[0.04]" style="background:radial-gradient(circle,#ffffff 0%,transparent 70%)" aria-hidden="true"></div>' +

        '<div class="relative z-10 mx-auto w-full max-w-[1220px] px-5 pb-10 pt-14 sm:px-8">' +

          /* ── 4-column grid ── */
          '<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1.5fr] md:gap-10">' +

            /* Col 1 — Brand */
            '<div>' +
              '<h2 class="vrs-footer-brand text-[26px] font-extrabold uppercase leading-none tracking-tight lg:text-[30px]">RENT A VEHICLE</h2>' +
              '<p class="vrs-footer-tagline mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">Luxury Vehicle Service</p>' +
              '<span class="mt-3 block h-[2px] w-16 rounded-full bg-[linear-gradient(90deg,#d9884f,#2c766e)]"></span>' +
              '<p class="vrs-footer-muted mt-5 max-w-[300px] text-[13px] leading-[1.7]">' +
                'Your trusted partner for premium vehicle rentals across Nepal. Well-maintained fleet, transparent pricing, and 24/7 support\u00a0\u2014\u00a0making every journey comfortable and hassle-free.' +
              '</p>' +
              /* Social row */
              '<div class="mt-6 flex items-center gap-2.5">' +
                socialIcon('Facebook', '#', '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', '#1877f2') +
                socialIcon('Instagram', '#', '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>', '#E4405F') +
                socialIcon('YouTube', '#', '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>', '#FF0000') +
                socialIcon('X / Twitter', '#', '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>', '#1DA1F2') +
              '</div>' +
            '</div>' +

            /* Col 2 — Quick Links */
            '<div>' +
              '<h3 class="vrs-footer-heading mb-5 text-[14px] font-bold uppercase tracking-[0.14em]">Quick Links</h3>' +
              '<ul class="space-y-3">' +
                '<li><a href="index.html" class="vrs-footer-link"><span class="material-symbols-outlined mr-2 text-[14px] align-middle opacity-50">chevron_right</span>Home</a></li>' +
                '<li><a href="vehicles.html" class="vrs-footer-link"><span class="material-symbols-outlined mr-2 text-[14px] align-middle opacity-50">chevron_right</span>Our Vehicles</a></li>' +
                '<li><a href="booking.html" class="vrs-footer-link"><span class="material-symbols-outlined mr-2 text-[14px] align-middle opacity-50">chevron_right</span>Book Now</a></li>' +
                '<li><a href="#" class="vrs-footer-link"><span class="material-symbols-outlined mr-2 text-[14px] align-middle opacity-50">chevron_right</span>Terms &amp; Conditions</a></li>' +
                '<li><a href="#" class="vrs-footer-link"><span class="material-symbols-outlined mr-2 text-[14px] align-middle opacity-50">chevron_right</span>Privacy Policy</a></li>' +
              '</ul>' +
            '</div>' +

            /* Col 3 — Contact */
            '<div>' +
              '<h3 class="vrs-footer-heading mb-5 text-[14px] font-bold uppercase tracking-[0.14em]">Contact Us</h3>' +
              '<ul class="space-y-4">' +
                '<li class="flex items-start gap-3">' +
                  '<span class="material-symbols-outlined mt-0.5 text-[18px] text-[#d9884f]">location_on</span>' +
                  '<div class="vrs-footer-muted text-[13px] leading-relaxed">' +
                    '<div>Thamel, Kathmandu</div><div>Nepal, 44600</div>' +
                  '</div>' +
                '</li>' +
                '<li class="flex items-start gap-3">' +
                  '<span class="material-symbols-outlined mt-0.5 text-[18px] text-[#d9884f]">phone</span>' +
                  '<div class="vrs-footer-muted text-[13px] leading-relaxed">' +
                    '<div>+977-01-4XXXXXX</div><div>+977-98XXXXXXXX</div>' +
                  '</div>' +
                '</li>' +
                '<li class="flex items-start gap-3">' +
                  '<span class="material-symbols-outlined mt-0.5 text-[18px] text-[#d9884f]">mail</span>' +
                  '<a href="mailto:info@rentavehiclenepal.com" class="vrs-footer-link text-[13px]">info@rentavehiclenepal.com</a>' +
                '</li>' +
                '<li class="flex items-start gap-3">' +
                  '<span class="material-symbols-outlined mt-0.5 text-[18px] text-[#d9884f]">schedule</span>' +
                  '<div class="vrs-footer-muted text-[13px] leading-relaxed">' +
                    '<div>Sun\u2013Fri: 7 AM \u2013 8 PM</div><div>Sat: 8 AM \u2013 5 PM</div>' +
                  '</div>' +
                '</li>' +
              '</ul>' +
            '</div>' +

            /* Col 4 — Newsletter */
            '<div>' +
              '<h3 class="vrs-footer-heading mb-5 text-[14px] font-bold uppercase tracking-[0.14em]">Newsletter</h3>' +
              '<p class="vrs-footer-muted mb-4 text-[13px] leading-[1.65]">Get exclusive deals, travel tips, and fleet updates delivered to your inbox.</p>' +
              '<form class="vrs-footer-newsletter" onsubmit="event.preventDefault();var b=this.querySelector(\'button\');b.textContent=\'Subscribed!\';b.disabled=true;setTimeout(function(){b.textContent=\'Subscribe\';b.disabled=false},2500)">' +
                '<div class="flex flex-col gap-2.5 sm:flex-row">' +
                  '<input type="email" placeholder="Your email address" required ' +
                    'class="vrs-footer-input flex-1 rounded-lg border px-4 py-2.5 text-[13px] outline-none transition focus:ring-2" />' +
                  '<button type="submit" ' +
                    'class="whitespace-nowrap rounded-lg bg-[linear-gradient(135deg,#d9884f,#c47337)] px-6 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(201,114,58,0.3)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(201,114,58,0.36)] active:scale-[0.98]">' +
                    'Subscribe' +
                  '</button>' +
                '</div>' +
              '</form>' +

              /* Trust badges */
              '<div class="mt-6 flex flex-wrap items-center gap-3">' +
                '<span class="vrs-footer-badge"><span class="material-symbols-outlined mr-1 text-[14px] text-[#2c766e]">verified_user</span>Secure Booking</span>' +
                '<span class="vrs-footer-badge"><span class="material-symbols-outlined mr-1 text-[14px] text-[#2c766e]">support_agent</span>24/7 Support</span>' +
              '</div>' +
            '</div>' +

          '</div>' + /* end grid */
        '</div>' + /* end container */
      '</div>' + /* end body */

      /* ── Copyright bar ── */
      '<div class="vrs-footer-copy">' +
        '<div class="mx-auto flex w-full max-w-[1220px] flex-col items-center justify-between gap-3 px-5 py-4 sm:flex-row sm:px-8">' +
          '<p class="vrs-footer-copy-text text-[13px] font-medium">\u00a9 ' + YEAR + ' Rent A Vehicle Nepal. All rights reserved.</p>' +
          '<p class="vrs-footer-copy-text text-[12px]">Designed with <span style="color:#d9884f">\u2764</span> in Kathmandu</p>' +
        '</div>' +
      '</div>' +

    '</footer>';
  }

  function bindSocialHovers() {
    document.querySelectorAll('.vrs-footer-social').forEach(function (el) {
      var color = el.getAttribute('data-hover');
      el.addEventListener('mouseenter', function () { el.style.borderColor = color; el.style.backgroundColor = color; el.style.color = '#fff'; });
      el.addEventListener('mouseleave', function () { el.style.borderColor = ''; el.style.backgroundColor = ''; el.style.color = ''; });
    });
  }

  function init() {
    if (document.querySelector('.vrs-footer')) return;
    document.body.insertAdjacentHTML('beforeend', renderFooter());
    bindSocialHovers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, renderFooter };
})();
