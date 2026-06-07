import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function Layout() {
  return (
    <div className="vrs-page bg-paper text-slate-900 antialiased">
      {/* Background blobs (matches vehicles.html / booking.html) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(229,140,78,0.45),rgba(229,140,78,0.08))] blur-sm"></div>
        <div className="absolute right-[-90px] top-36 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_38%_35%,rgba(44,118,110,0.48),rgba(44,118,110,0.08))] blur-sm"></div>
        <div className="absolute bottom-[-130px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(14,37,40,0.18),rgba(14,37,40,0.04))] blur-md"></div>
      </div>

      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
