import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { KeyRound, Edit2, Download, Printer, X, Plus, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Company Branding (Hardcoded)
const COMPANY = {
  name: 'RS RENTAL PVT. LTD.',
  address: 'Pepsicola-32, Kathmandu, Nepal',
  website: 'www.rsrental.com.np',
  email: 'info@rsrental.com.np',
  phone: '+977 9801234567',
};

// Terms & Conditions (Hardcoded, 16 items)
const TERMS = [
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

// Status Badge Component
function StatusBadge({ status }) {
  const styles = {
    Paid: 'bg-green-100 text-green-800',
    Unpaid: 'bg-red-100 text-red-800',
    Partial: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-none ${styles[status] || styles.Unpaid}`}>
      {status}
    </span>
  );
}

// Format currency
const formatRs = (n) => `Rs. ${(n || 0).toLocaleString('en-IN')}`;

export default function Invoice({ booking: initialBooking }) {
  const [editMode, setEditMode] = useState(false);
  const [booking, setBooking] = useState(initialBooking);
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Invoice-${booking.invoiceNumber}`,
  });

  // Update nested booking data
  const updateBooking = (path, value) => {
    setBooking((prev) => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  // Line items handlers
  const addLineItem = () => {
    const newItems = [...(booking.lineItems || []), { description: '', qty: '', rate: 0 }];
    updateBooking('lineItems', newItems);
  };

  const removeLineItem = (idx) => {
    const newItems = booking.lineItems.filter((_, i) => i !== idx);
    updateBooking('lineItems', newItems);
  };

  const updateLineItem = (idx, field, value) => {
    const newItems = booking.lineItems.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    updateBooking('lineItems', newItems);
  };

  // Calculate totals
  const calculateAmount = (qty, rate) => {
    const days = parseFloat(qty) || 0;
    return days * (rate || 0);
  };

  const subtotal = booking.lineItems?.reduce((sum, item) => sum + calculateAmount(item.qty, item.rate), 0) || 0;
  const discount = booking.payment?.discount || 0;
  const grandTotal = subtotal - discount;
  const paidAmount = booking.payment?.paid || 0;
  const remaining = Math.max(0, grandTotal - paidAmount);

  // Editable Field Component
  const EditableField = ({ value, onChange, type = 'text', className = '', placeholder = '' }) => {
    if (editMode) {
      return (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-gray-400 px-1 py-0.5 text-sm rounded-none ${className}`}
          placeholder={placeholder}
        />
      );
    }
    return <span className={className}>{value || '-'}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      {/* Toolbar */}
      <div className="max-w-[794px] mx-auto mb-4 flex gap-2 print:hidden">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-none ${
            editMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800 border border-gray-300'
          }`}
        >
          {editMode ? <X size={16} /> : <Edit2 size={16} />}
          {editMode ? 'Done Editing' : 'Edit Invoice'}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-[#1f7668] text-white font-bold text-sm rounded-none hover:bg-[#185f54]"
        >
          <Download size={16} />
          Download PDF
        </button>
      </div>

      {/* Printable Invoice */}
      <div
        ref={printRef}
        className="max-w-[794px] mx-auto bg-white p-8 shadow-lg print:shadow-none print:p-0"
        style={{ fontFamily: '"DM Mono", monospace' }}
      >
        {/* Top Bar */}
        <div className="flex justify-between items-center text-xs text-gray-500 mb-4 border-b border-gray-200 pb-2">
          <div className="flex gap-4">
            <span>{COMPANY.website}</span>
            <span>{COMPANY.email}</span>
            <span>{COMPANY.phone}</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          {/* Company Left */}
          <div className="flex items-start gap-3">
            <div className="bg-[#1f7668] p-2 rounded-none">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">{COMPANY.name}</h1>
              <p className="text-sm text-gray-600">{COMPANY.address}</p>
            </div>
          </div>

          {/* Invoice Meta Right */}
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-1">CAR RENTAL INVOICE</p>
            <h2 className="text-3xl font-black text-gray-900">{booking.invoiceNumber}</h2>
            <div className="mt-2 text-sm">
              <p><span className="text-gray-500">Booking Ref:</span> <span className="font-semibold">{booking.bookingRef}</span></p>
              <p><span className="text-gray-500">Issue Date:</span> <span className="font-semibold">{booking.issueDate}</span></p>
            </div>
          </div>
        </div>

        {/* Customer | Vehicle Grid */}
        <div className="grid grid-cols-2 gap-0 mb-6">
          {/* Customer */}
          <div className="border border-black p-4">
            <div className="text-xs uppercase tracking-widest font-bold bg-gray-100 px-3 py-1 -mx-4 -mt-4 mb-3">
              Customer
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 w-16 inline-block">Name:</span> 
                <EditableField value={booking.customer?.name} onChange={(v) => updateBooking('customer.name', v)} />
              </p>
              <p><span className="text-gray-500 w-16 inline-block">Contact:</span> 
                <EditableField value={booking.customer?.contact} onChange={(v) => updateBooking('customer.contact', v)} />
              </p>
              <p><span className="text-gray-500 w-16 inline-block">Address:</span> 
                <EditableField value={booking.customer?.address} onChange={(v) => updateBooking('customer.address', v)} />
              </p>
              <p><span className="text-gray-500 w-16 inline-block">DOB:</span> 
                <EditableField value={booking.customer?.dob} onChange={(v) => updateBooking('customer.dob', v)} />
              </p>
              <p><span className="text-gray-500 w-16 inline-block">License:</span> 
                <EditableField value={booking.customer?.license} onChange={(v) => updateBooking('customer.license', v)} />
              </p>
            </div>
          </div>

          {/* Vehicle */}
          <div className="border border-black border-l-0 p-4">
            <div className="text-xs uppercase tracking-widest font-bold bg-gray-100 px-3 py-1 -mx-4 -mt-4 mb-3">
              Vehicle Details
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 w-20 inline-block">Vehicle:</span> 
                <EditableField value={booking.vehicle?.name} onChange={(v) => updateBooking('vehicle.name', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Plate No.:</span> 
                <EditableField value={booking.vehicle?.plateNo} onChange={(v) => updateBooking('vehicle.plateNo', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Type:</span> 
                <EditableField value={booking.vehicle?.type} onChange={(v) => updateBooking('vehicle.type', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Color:</span> 
                <EditableField value={booking.vehicle?.color} onChange={(v) => updateBooking('vehicle.color', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Seat:</span> 
                <EditableField value={booking.vehicle?.seat} onChange={(v) => updateBooking('vehicle.seat', v)} />
              </p>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="border border-black p-4 mb-6 relative">
          <div className="text-xs uppercase tracking-widest font-bold bg-gray-100 px-3 py-1 -mx-4 -mt-4 mb-3">
            Booking Details
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pr-32">
            <div className="space-y-1">
              <p><span className="text-gray-500 w-20 inline-block">Pickup:</span> 
                <EditableField value={booking.booking?.pickup} onChange={(v) => updateBooking('booking.pickup', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Drop-off:</span> 
                <EditableField value={booking.booking?.dropoff} onChange={(v) => updateBooking('booking.dropoff', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Location:</span> 
                <EditableField value={booking.booking?.location} onChange={(v) => updateBooking('booking.location', v)} />
              </p>
              <p><span className="text-gray-500 w-20 inline-block">Purpose:</span> 
                <EditableField value={booking.booking?.purpose} onChange={(v) => updateBooking('booking.purpose', v)} />
              </p>
            </div>
            <div className="space-y-1">
              <p><span className="text-gray-500 w-24 inline-block">Drive Type:</span> 
                <EditableField value={booking.booking?.driveType} onChange={(v) => updateBooking('booking.driveType', v)} />
              </p>
              <p><span className="text-gray-500 w-24 inline-block">Rental Type:</span> 
                <EditableField value={booking.booking?.rentalType} onChange={(v) => updateBooking('booking.rentalType', v)} />
              </p>
            </div>
          </div>
          {/* QR Code */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-center">
            <QRCodeSVG 
              value={`${window.location.origin}/verify/${booking.invoiceNumber}`} 
              size={80} 
              level="M" 
            />
            <p className="text-[10px] text-gray-500 mt-1">SCAN TO VERIFY BOOKING</p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-black mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="text-left p-2 font-bold w-16">S.N</th>
                <th className="text-left p-2 font-bold">Description</th>
                <th className="text-left p-2 font-bold w-24">Qty</th>
                <th className="text-right p-2 font-bold w-28">Rate</th>
                <th className="text-right p-2 font-bold w-28">Amount</th>
                {editMode && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {booking.lineItems?.map((item, idx) => (
                <tr key={idx} className="border-t border-gray-300">
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2">
                    {editMode ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        className="w-full border border-gray-400 px-1 rounded-none"
                      />
                    ) : (
                      item.description
                    )}
                  </td>
                  <td className="p-2">
                    {editMode ? (
                      <input
                        type="text"
                        value={item.qty}
                        onChange={(e) => updateLineItem(idx, 'qty', e.target.value)}
                        className="w-full border border-gray-400 px-1 rounded-none"
                      />
                    ) : (
                      item.qty
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {editMode ? (
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateLineItem(idx, 'rate', Number(e.target.value))}
                        className="w-full border border-gray-400 px-1 rounded-none text-right"
                      />
                    ) : (
                      formatRs(item.rate)
                    )}
                  </td>
                  <td className="p-2 text-right font-medium">{formatRs(calculateAmount(item.qty, item.rate))}</td>
                  {editMode && (
                    <td className="p-2">
                      <button onClick={() => removeLineItem(idx)} className="text-red-600 hover:text-red-800">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {editMode && (
            <button
              onClick={addLineItem}
              className="w-full py-2 border-t border-black bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={16} /> Add Line Item
            </button>
          )}
        </div>

        {/* Payment + Totals */}
        <div className="grid grid-cols-2 gap-0 mb-6">
          {/* Payment Left */}
          <div className="border border-black p-4">
            <div className="text-xs uppercase tracking-widest font-bold bg-gray-100 px-3 py-1 -mx-4 -mt-4 mb-3">
              Payment
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-16">Status:</span>
                {editMode ? (
                  <select
                    value={booking.payment?.status}
                    onChange={(e) => updateBooking('payment.status', e.target.value)}
                    className="border border-gray-400 px-2 py-1 rounded-none"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partial">Partial</option>
                  </select>
                ) : (
                  <StatusBadge status={booking.payment?.status} />
                )}
              </div>
              <p><span className="text-gray-500 w-16 inline-block">Method:</span> 
                <EditableField value={booking.payment?.method} onChange={(v) => updateBooking('payment.method', v)} />
              </p>
              <p><span className="text-gray-500 w-16 inline-block">Paid:</span> 
                <EditableField 
                  type="number" 
                  value={booking.payment?.paid} 
                  onChange={(v) => updateBooking('payment.paid', Number(v))} 
                />
              </p>
              <p><span className="text-gray-500 w-16 inline-block">Remarks:</span> 
                <EditableField value={booking.payment?.remarks} onChange={(v) => updateBooking('payment.remarks', v)} />
              </p>
            </div>
          </div>

          {/* Totals Right */}
          <div className="border border-black border-l-0 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatRs(subtotal)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span className="font-medium">
                  {editMode ? (
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => updateBooking('payment.discount', Number(e.target.value))}
                      className="w-24 border border-gray-400 px-1 rounded-none text-right"
                    />
                  ) : (
                    formatRs(discount)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                <span>Grand Total</span>
                <span>{formatRs(grandTotal)}</span>
              </div>
              
              {/* Paid & Remaining */}
              <div className="mt-3 pt-3 border-t border-dashed border-gray-400 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-medium text-emerald-600">{formatRs(paidAmount)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-sm font-bold text-red-600">
                    <span>Balance Due</span>
                    <span>{formatRs(remaining)}</span>
                  </div>
                )}
                {remaining === 0 && paidAmount > 0 && (
                  <div className="flex justify-between text-sm font-bold text-emerald-600">
                    <span>Status</span>
                    <span>PAID IN FULL</span>
                  </div>
                )}
                {remaining === 0 && paidAmount === 0 && (
                  <div className="flex justify-between text-sm font-bold text-amber-600">
                    <span>Status</span>
                    <span>BALANCE DUE: {formatRs(grandTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="border border-black p-4 mb-8">
          <div className="text-xs uppercase tracking-widest font-bold bg-gray-100 px-3 py-1 -mx-4 -mt-4 mb-3">
            Terms & Conditions
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {TERMS.map((term, idx) => (
              <p key={idx} className="leading-relaxed">{idx + 1}. {term}</p>
            ))}
          </div>
        </div>

        {/* Footer - Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-12 items-end">
          {/* Customer Signature */}
          <div className="text-center pb-2">
            <div className="border-b border-black w-48 mx-auto mb-2"></div>
            <p className="text-sm font-medium">Received by (Customer)</p>
          </div>

          {/* Company Signature */}
          <div className="text-center pb-2">
            <div className="border-b border-black w-48 mx-auto mb-2"></div>
            <p className="text-sm font-medium">Authorized by RS Rental</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&display=swap');
        
        @media print {
          @page { size: A4; margin: 10mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

// Sample usage wrapper component
export function InvoiceApp({ booking }) {
  return <Invoice booking={booking} />;
}

export { COMPANY, TERMS, formatRs, StatusBadge };
