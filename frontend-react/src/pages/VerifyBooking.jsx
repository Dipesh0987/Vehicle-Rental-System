import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, CheckCircle, XCircle, Calendar, User, Car, Phone, MapPin } from 'lucide-react';
import supabase from '../lib/supabase';

const COMPANY = {
  name: 'RS RENTAL PVT. LTD.',
  address: 'Pepsicola-32, Kathmandu, Nepal',
  phone: '+977 9801234567',
  email: 'info@rsrental.com.np'
};

export default function VerifyBooking() {
  const { invoiceNumber } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        // Try to find booking by booking_code matching invoice number
        // The invoice number format is INV-XXXXXX, and bookingRef is similar
        const { data, error } = await supabase
          .from('vehicle_bookings')
          .select(`
            *,
            vehicles(name, brand, category, vehicle_number)
          `)
          .eq('booking_code', invoiceNumber.replace('INV-', ''))
          .single();
        
        if (error || !data) {
          // If not found by booking_code, try searching by id
          const { data: dataById, error: errorById } = await supabase
            .from('vehicle_bookings')
            .select(`
              *,
              vehicles(name, brand, category, vehicle_number)
            `)
            .eq('id', invoiceNumber)
            .single();
            
          if (errorById || !dataById) {
            setError('Booking not found');
            setLoading(false);
            return;
          }
          
          setBooking({
            invoiceNumber: invoiceNumber,
            bookingRef: dataById.booking_code || dataById.id,
            status: dataById.status === 'completed' ? 'Completed' : 
                    dataById.status === 'active' ? 'Active' : 
                    dataById.status === 'confirmed' ? 'Confirmed' : 'Pending',
            verified: true,
            message: 'This is a valid RS Rental booking.',
            customer: {
              name: dataById.customer_name,
              contact: dataById.customer_phone,
            },
            vehicle: {
              name: dataById.vehicles?.name,
            },
            startDate: dataById.start_date,
            endDate: dataById.end_date,
            totalAmount: dataById.total_amount,
          });
        } else {
          setBooking({
            invoiceNumber: invoiceNumber,
            bookingRef: data.booking_code || data.id,
            status: data.status === 'completed' ? 'Completed' : 
                    data.status === 'active' ? 'Active' : 
                    data.status === 'confirmed' ? 'Confirmed' : 'Pending',
            verified: true,
            message: 'This is a valid RS Rental booking.',
            customer: {
              name: data.customer_name,
              contact: data.customer_phone,
            },
            vehicle: {
              name: data.vehicles?.name,
            },
            startDate: data.start_date,
            endDate: data.end_date,
            totalAmount: data.total_amount,
          });
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching booking:', err);
        setError('Failed to verify booking');
        setLoading(false);
      }
    };

    fetchBooking();
  }, [invoiceNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-none shadow-lg text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#1f7668] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-none shadow-lg text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Booking</h1>
          <p className="text-gray-600 mb-4">This QR code could not be verified.</p>
          <p className="text-sm text-gray-500">Invoice: {invoiceNumber}</p>
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500">{COMPANY.name}</p>
            <p className="text-xs text-gray-400">{COMPANY.phone}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-none shadow-lg mb-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-[#1f7668] p-2 rounded-none">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold">{COMPANY.name}</h1>
          </div>
          
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-600 mb-2">Verified</h2>
            <p className="text-gray-600">This is a valid booking</p>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white p-6 rounded-none shadow-lg mb-4">
          <h3 className="text-lg font-bold mb-4 border-b pb-2">Booking Details</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#1f7668] mt-1" />
              <div>
                <p className="text-sm text-gray-500">Invoice Number</p>
                <p className="font-bold">{booking.invoiceNumber}</p>
              </div>
            </div>
            
            {booking.bookingRef && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#1f7668] mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Booking Ref</p>
                  <p className="font-bold">{booking.bookingRef}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-[#1f7668] mt-1" />
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-bold">{booking.customer?.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{booking.customer?.contact}</p>
              </div>
            </div>

            {booking.vehicle?.name && (
              <div className="flex items-start gap-3">
                <Car className="w-5 h-5 text-[#1f7668] mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Vehicle</p>
                  <p className="font-bold">{booking.vehicle.name}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-[#1f7668] mt-1" />
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-sm font-bold rounded-none">
                  {booking.status}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#1f7668] mt-1" />
              <div>
                <p className="text-sm text-gray-500">Verification</p>
                <p className="text-green-600 font-medium">{booking.message}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white p-6 rounded-none shadow-lg text-center">
          <h3 className="text-sm font-bold text-gray-500 mb-2">Need Help?</h3>
          <div className="flex justify-center gap-4 text-sm">
            <a href={`tel:${COMPANY.phone}`} className="flex items-center gap-1 text-[#1f7668]">
              <Phone className="w-4 h-4" />
              Call Us
            </a>
            <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-1 text-[#1f7668]">
              <MapPin className="w-4 h-4" />
              Email
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-4">{COMPANY.address}</p>
        </div>
      </div>
    </div>
  );
}
