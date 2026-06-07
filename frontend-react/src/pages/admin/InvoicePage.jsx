import Invoice from '../../components/Invoice';

// Sample booking data matching the image
const sampleBooking = {
  invoiceNumber: "INV-2604-006",
  bookingRef: "RS-2604-006",
  issueDate: "Apr 10, 2026",
  customer: {
    name: "Ankit Aryal",
    contact: "9818053609",
    address: "Tarakeshwor-08, Kathmandu",
    dob: "May 20, 2005",
    license: "04-06-00991649"
  },
  vehicle: {
    name: "Neta V-2356",
    plateNo: "Ba-Pra 01-30-Cha-2356",
    type: "Sedan | Automatic | Electric",
    color: "Blue",
    seat: "5 Seater"
  },
  booking: {
    pickup: "Apr 10, 2026 — 2:00 PM",
    dropoff: "Apr 11, 2026 — 7:00 PM",
    location: "Baglung",
    purpose: "Trip",
    driveType: "Self Drive",
    rentalType: "Outside Valley"
  },
  lineItems: [
    { description: "Neta V-2356 Rental", qty: "2 Days", rate: 5500 }
  ],
  payment: {
    subtotal: 11000,
    discount: 1000,
    grandTotal: 10000,
    status: "Paid",
    method: "Bank Transfer",
    paid: 10000,
    remarks: "Paid"
  }
};

export default function InvoicePage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Invoice booking={sampleBooking} />
    </div>
  );
}
