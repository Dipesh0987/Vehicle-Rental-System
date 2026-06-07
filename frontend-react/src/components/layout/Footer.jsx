import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="vrs-footer vrs-theme-scope relative mt-20 bg-[#e8e6df] dark:bg-slate-900">
      {/* Main Footer Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1.5fr] lg:gap-16">
          {/* Brand & Description */}
          <div className="max-w-[280px]">
            <div className="mb-4">
              <h2 className="text-[28px] font-black uppercase leading-none tracking-tight text-slate-800 dark:text-slate-100">RENT A CAR</h2>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Where Quality Meets Affordability</p>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
              Your trusted partner for premium vehicle rentals. We offer a wide selection of well-maintained cars, transparent pricing, and exceptional customer service. Whether it&apos;s a business trip or family vacation, we make your journey comfortable and hassle-free.
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="mb-5 text-[15px] font-bold text-slate-800 dark:text-slate-100">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-slate-400 dark:text-slate-500">location_on</span>
                <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400"><div>Self Drive Kathmandu</div><div>Banasthali, Nepal</div></div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-slate-400 dark:text-slate-500">phone</span>
                <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400"><a href="tel:+9779704520781" className="transition-colors hover:text-[#ff6b35]">+977 970-452-0781</a></div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-slate-400 dark:text-slate-500">mail</span>
                <a href="mailto:info@rentavehicle.com" className="text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400">info@rentavehicle.com</a>
              </li>
            </ul>
          </div>

          {/* Information Links */}
          <div>
            <h3 className="mb-5 text-[15px] font-bold text-slate-800 dark:text-slate-100">Information Links</h3>
            <ul className="space-y-3">
              <li><Link to="/booking" className="inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400"><span className="mr-2 text-slate-400">›</span>Book Now</Link></li>
              <li><Link to="/vehicles" className="inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400"><span className="mr-2 text-slate-400">›</span>Our Vehicles</Link></li>
              <li><a href="#" className="inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400"><span className="mr-2 text-slate-400">›</span>Terms &amp; Conditions</a></li>
              <li><a href="#" className="inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400"><span className="mr-2 text-slate-400">›</span>Cancellation Policy</a></li>
              <li><a href="#" className="inline-flex items-center text-[13px] text-slate-600 transition-colors hover:text-[#ff6b35] dark:text-slate-400"><span className="mr-2 text-slate-400">›</span>Privacy Policy</a></li>
            </ul>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="mb-5 text-[15px] font-bold text-slate-800 dark:text-slate-100">Follow Us</h3>
            <div className="flex items-center gap-2.5">
              <a href="https://www.facebook.com/DOSnepal1/" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:border-[#1877f2] hover:bg-[#1877f2] hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400" aria-label="Facebook">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-slate-300/50 py-6 dark:border-slate-700">
        <p className="text-center text-[12px] text-slate-500 dark:text-slate-400">Copyright &copy;{year} All rights reserved</p>
      </div>
    </footer>
  );
}
