'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { jsPDF } from 'jspdf';

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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 95, 89);
    doc.text('TERMS & CONDITIONS', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('ASSelf - Vehicle Rental Agreement', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setDrawColor(20, 95, 89);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    // Terms
    const terms = [
      'Valid driving license required for self-drive rentals.',
      'Vehicle is for personal use only. Commercial, public or rental use prohibited.',
      'No illegal activities, off-road driving, or racing allowed.',
      'Renter is liable for all traffic fines and violations.',
      'Renter responsible for damages due to negligence or reckless driving.',
      'In case of breakdown or accident, inform company immediately.',
      'Damages not covered by insurance must be paid by renter.',
      'In case of damage or accident, rental charges apply for repair.',
      'If renter fails to pay dues, company may recover via security cheque.',
      'If renter is unreachable after accident, company may use security cheque.',
      'Extension/cancellation must be informed 24 hrs prior. Late penalty: NPR 500/hour.',
      'NPR 1,000 cleaning fee applies for excessively dirty vehicle.',
      'Advance payment confirms booking. Cancellation charges apply.',
      'Vehicle must be returned with same fuel level; otherwise charges apply.',
      'Vehicle must be returned by 7:00 PM. Late fee: NPR 800/hour.',
      'Next day processing at 7:00 AM.',
    ];

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    terms.forEach((term, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${term}`, maxWidth);
      if (y + lines.length * 6 > 270) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += lines.length * 6 + 4;
    });

    // Footer
    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('By renting a vehicle from ASSelf, you agree to abide by these terms.', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.text('Contact: +977 970-452-0781 | Email: info@asselfdrive.com', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('Location: Banasthali, Kathmandu, Nepal', pageWidth / 2, y, { align: 'center' });

    doc.save('ASSelf-Terms-and-Conditions.pdf');
  };

  return (
    <>
      {/* Floating Button - positioned to not obstruct mobile content */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-0 bottom-24 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-40 flex items-center gap-1.5 rounded-r-xl bg-[#145f59] px-2.5 py-2.5 sm:px-3 sm:py-3 text-white shadow-lg transition-all hover:pl-4 hover:shadow-xl group"
        title="Terms & Conditions"
        aria-label="View Terms and Conditions"
      >
        <span className="material-symbols-outlined text-[18px] sm:text-[20px]">gavel</span>
        <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[150px] transition-all duration-300">
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
