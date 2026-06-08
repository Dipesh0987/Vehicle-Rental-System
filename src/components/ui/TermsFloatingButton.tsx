'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

const TERMS_CONTENT = `TERMS & CONDITIONS
ASSelf - Vehicle Rental Agreement

1. Valid driving license required for self-drive rentals.

2. Vehicle is for personal use only. Commercial, public or rental use prohibited.

3. No illegal activities, off-road driving, or racing allowed.

4. Renter is liable for all traffic fines and violations.

5. Renter responsible for damages due to negligence or reckless driving.

6. In case of breakdown or accident, inform company immediately.

7. Damages not covered by insurance must be paid by renter.

8. In case of damage or accident, rental charges apply for repair.

9. If renter fails to pay dues, company may recover via security cheque.

10. If renter is unreachable after accident, company may use security cheque.

11. Extension/cancellation must be informed 24 hrs prior. Late penalty: NPR 500/hour.

12. NPR 1,000 cleaning fee applies for excessively dirty vehicle.

13. Advance payment confirms booking. Cancellation charges apply.

14. Vehicle must be returned with same fuel level; otherwise charges apply.

15. Vehicle must be returned by 7:00 PM. Late fee: NPR 800/hour.

16. Next day processing at 7:00 AM.

---
By renting a vehicle from ASSelf, you agree to abide by these terms and conditions.

Contact: +977 970-452-0781
Email: info@asselfdrive.com
Location: Banasthali, Kathmandu, Nepal
`;

export default function TermsFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Hide on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const downloadPDF = () => {
    // Create a printable HTML document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download the PDF');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Terms & Conditions - ASSelf</title>
          <style>
            @media print {
              @page { margin: 1in; }
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.8;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
              color: #1a1a1a;
            }
            h1 {
              color: #145f59;
              font-size: 28px;
              text-align: center;
              margin-bottom: 10px;
              border-bottom: 3px solid #145f59;
              padding-bottom: 15px;
            }
            .brand-as { color: #E58C4E; }
            h2 {
              color: #145f59;
              font-size: 16px;
              text-align: center;
              margin-bottom: 30px;
              font-weight: normal;
            }
            .term {
              margin-bottom: 15px;
              padding-left: 30px;
              position: relative;
            }
            .term::before {
              content: counter(term) ".";
              counter-increment: term;
              position: absolute;
              left: 0;
              color: #145f59;
              font-weight: bold;
            }
            ol {
              counter-reset: term;
              list-style: none;
              padding: 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 14px;
              color: #666;
            }
            .contact {
              margin-top: 20px;
              background: #f5f5f5;
              padding: 15px;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <h1>TERMS & CONDITIONS</h1>
          <h2><span class="brand-as">AS</span>Self - Vehicle Rental Agreement</h2>
          <ol>
            <li class="term">Valid driving license required for self-drive rentals.</li>
            <li class="term">Vehicle is for personal use only. Commercial, public or rental use prohibited.</li>
            <li class="term">No illegal activities, off-road driving, or racing allowed.</li>
            <li class="term">Renter is liable for all traffic fines and violations.</li>
            <li class="term">Renter responsible for damages due to negligence or reckless driving.</li>
            <li class="term">In case of breakdown or accident, inform company immediately.</li>
            <li class="term">Damages not covered by insurance must be paid by renter.</li>
            <li class="term">In case of damage or accident, rental charges apply for repair.</li>
            <li class="term">If renter fails to pay dues, company may recover via security cheque.</li>
            <li class="term">If renter is unreachable after accident, company may use security cheque.</li>
            <li class="term">Extension/cancellation must be informed 24 hrs prior. Late penalty: NPR 500/hour.</li>
            <li class="term">NPR 1,000 cleaning fee applies for excessively dirty vehicle.</li>
            <li class="term">Advance payment confirms booking. Cancellation charges apply.</li>
            <li class="term">Vehicle must be returned with same fuel level; otherwise charges apply.</li>
            <li class="term">Vehicle must be returned by 7:00 PM. Late fee: NPR 800/hour.</li>
            <li class="term">Next day processing at 7:00 AM.</li>
          </ol>
          <div class="footer">
            <p><strong>By renting a vehicle from <span class="brand-as">AS</span>Self, you agree to abide by these terms and conditions.</strong></p>
            <div class="contact">
              <p><strong>Contact:</strong> +977 970-452-0781</p>
              <p><strong>Email:</strong> info@asselfdrive.com</p>
              <p><strong>Location:</strong> Banasthali, Kathmandu, Nepal</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Trigger print dialog for PDF save
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 rounded-r-xl bg-[#145f59] px-3 py-3 text-white shadow-lg transition-all hover:pl-4 hover:shadow-xl group"
        title="Terms & Conditions"
      >
        <span className="material-symbols-outlined text-[20px]">gavel</span>
        <span className="text-sm font-semibold whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[150px] transition-all duration-300">
          Terms & Conditions
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#182226] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[linear-gradient(135deg,#145f59,#1a7a72)] px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px]">gavel</span>
                  <div>
                    <h2 className="text-xl font-bold">Terms & Conditions</h2>
                    <p className="text-sm text-white/70"><span className="text-[#ffb87a]">AS</span>Self Vehicle Rental</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-white/10 transition">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
              <ol className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">1</span>
                  <span>Valid driving license required for self-drive rentals.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">2</span>
                  <span>Vehicle is for personal use only. Commercial, public or rental use prohibited.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">3</span>
                  <span>No illegal activities, off-road driving, or racing allowed.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">4</span>
                  <span>Renter is liable for all traffic fines and violations.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">5</span>
                  <span>Renter responsible for damages due to negligence or reckless driving.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">6</span>
                  <span>In case of breakdown or accident, inform company immediately.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">7</span>
                  <span>Damages not covered by insurance must be paid by renter.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">8</span>
                  <span>In case of damage or accident, rental charges apply for repair.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">9</span>
                  <span>If renter fails to pay dues, company may recover via security cheque.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">10</span>
                  <span>If renter is unreachable after accident, company may use security cheque.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center text-xs font-bold">11</span>
                  <span>Extension/cancellation must be informed 24 hrs prior. <strong className="text-amber-600 dark:text-amber-400">Late penalty: NPR 500/hour.</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center text-xs font-bold">12</span>
                  <span><strong className="text-amber-600 dark:text-amber-400">NPR 1,000 cleaning fee</strong> applies for excessively dirty vehicle.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">13</span>
                  <span>Advance payment confirms booking. Cancellation charges apply.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">14</span>
                  <span>Vehicle must be returned with same fuel level; otherwise charges apply.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 flex items-center justify-center text-xs font-bold">15</span>
                  <span>Vehicle must be returned by <strong>7:00 PM</strong>. <strong className="text-rose-600 dark:text-rose-400">Late fee: NPR 800/hour.</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#145f59]/10 text-[#145f59] dark:bg-[#145f59]/20 dark:text-[#5bbfb5] flex items-center justify-center text-xs font-bold">16</span>
                  <span>Next day processing at <strong>7:00 AM</strong>.</span>
                </li>
              </ol>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 dark:bg-[#1c2a2e] px-6 py-4 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">© <span className="text-[#E58C4E]">AS</span>Self • Kathmandu, Nepal</p>
                <button
                  onClick={downloadPDF}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#145f59] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0e4a45]"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
