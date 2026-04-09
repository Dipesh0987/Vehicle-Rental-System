# Booking Modification Feature

## Overview

This feature allows customers to modify existing rental bookings by changing:
- Pickup and dropoff dates
- Rental vehicle
- Locations (optional)

## Key Features

### 1. Date Validation
- New dates are validated against vehicle availability
- Prevents double-booking conflicts
- Automatically checks across all confirmed bookings for the vehicle

### 2. Price Calculation
- Recalculates rental price based on:
  - New duration of stay
  - Vehicle daily rate
  - Service fees (10%)
  - Applicable taxes (10%)
  - Discounts for multi-day rentals (5% for 5+ days)
  - Insurance and add-ons

### 3. Price Adjustments
- **Refund**: If new price is lower than original
- **Charge**: If new price is higher than original
- **No change**: If prices are equal

### 4. Audit Trail
- **booking_events table**: Records all lifecycle events
- **booking_modifications table**: Detailed before/after modification records
- Complete history of all changes with timestamps and user reference

### 5. Email Notifications
- Modification confirmation email
- Refund/charge notifications
- Detailed price breakdown
- Booking reference and dates

## Database Schema

### bookings Table
Main booking record with pricing and status information.

```sql
SELECT * FROM bookings WHERE id = 'booking-id';
```

### booking_events Table
Audit trail for booking lifecycle.

```json
{
  "id": "uuid",
  "booking_id": "uuid",
  "event_type": "modified|confirmed|created|activated|completed|cancelled",
  "event_data": { "original_dates": {}, "new_dates": {}, "price_difference": 0 },
  "performed_by": "uuid (user_id)",
  "created_at": "timestamp"
}
```

### booking_modifications Table
Detailed modification records.

```json
{
  "id": "uuid",
  "booking_id": "uuid",
  "booking_event_id": "uuid",
  "original_pickup_date": "date",
  "new_pickup_date": "date",
  "original_vehicle_id": "uuid",
  "new_vehicle_id": "uuid",
  "original_total_price": 100.00,
  "new_total_price": 110.00,
  "price_difference": 10.00,
  "is_refund": false,
  "is_charge": true,
  "reason": "Customer requested change",
  "status": "approved|pending|rejected|completed",
  "created_at": "timestamp"
}
```

## Frontend Pages

### /frontend/modify-booking.html
Main page for modifying bookings. Query parameter: `?id=booking-id`

**Features:**
- Display current booking details
- Form to update dates and vehicle
- Real-time price preview
- Modification history
- Confirmation and submission

**Access:**
```
http://localhost:5500/frontend/modify-booking.html?id=bk-24003
```

## API/Service Layer

### BookingService
Database operations for bookings.

```javascript
import { BookingService } from './booking-service.js';

// Get user bookings
await BookingService.getUserBookings(userId);

// Get single booking with vehicle details
await BookingService.getBookingDetail(bookingId);

// Validate vehicle availability
await BookingService.validateAvailability(vehicleId, pickupDate, dropoffDate);

// Create modification record
await BookingService.createModification(modificationData);

// Update booking
await BookingService.updateBooking(bookingId, updates);
```

### BookingModificationManager
Orchestrates the complete modification workflow.

```javascript
import { BookingModificationManager } from './booking-modification-manager.js';

// Main modification endpoint
const result = await BookingModificationManager.modifyBooking(bookingId, {
  newPickupDate: '2026-04-15',
  newDropoffDate: '2026-04-20',
  newVehicleId: 'vehicle-id', // optional
  reason: 'Schedule changed'
});

// Get modification history
await BookingModificationManager.getModificationHistory(bookingId);

// Get audit trail
await BookingModificationManager.getAuditTrail(bookingId);
```

### PriceCalculator
Price calculations and breakdowns.

```javascript
import { PriceCalculator } from './price-calculator.js';

// Calculate complete rental price
const pricing = PriceCalculator.calculateRentalPrice({
  vehicleRate: 50,
  pickupDate: '2026-04-15',
  dropoffDate: '2026-04-20',
  insuranceType: 'basic',
  addOns: ['Child Seat', 'GPS Navigation']
});

// Result structure
{
  rentalDays: 5,
  basePrice: 250,
  insurance: 75,
  serviceFee: 25,
  tax: 35,
  totalPrice: 385,
  breakdown: { /* detailed breakdown */ }
}

// Calculate price difference
const diff = PriceCalculator.calculatePriceDifference(originalPrice, newPrice);
// Result: { priceDifference, isRefund, isCharge, amount, change }
```

### EmailNotificationService
Sends confirmation and notification emails.

```javascript
import { EmailNotificationService } from './email-notification-service.js';

// Send modification confirmation
await EmailNotificationService.sendModificationConfirmation({
  to: 'customer@example.com',
  customerName: 'John Doe',
  bookingReference: 'VRS-2026-24003',
  originalDates: { pickup: '2026-03-28', dropoff: '2026-03-31' },
  newDates: { pickup: '2026-04-15', dropoff: '2026-04-20' },
  priceDifference: { /* ... */ },
  modifiedBooking: { /* ... */ }
});

// Send refund notification
await EmailNotificationService.sendRefundNotification({
  to: 'customer@example.com',
  customerName: 'John Doe',
  bookingReference: 'VRS-2026-24003',
  refundAmount: 50.00,
  refundReason: 'Price reduced due to shorter rental period'
});

// Send charge notification
await EmailNotificationService.sendChargeNotification({
  to: 'customer@example.com',
  customerName: 'John Doe',
  bookingReference: 'VRS-2026-24003',
  chargeAmount: 75.00,
  chargeReason: 'Price increased for upgraded vehicle'
});
```

## Integration Steps

### 1. Database Setup
Run migrations in Supabase SQL Editor:
```sql
-- Run in this order:
1. execute 004_bookings_table.sql
2. execute 005_booking_events_and_modifications.sql
```

### 2. Add vehicles Table (if not exists)
Ensure `public.vehicles` table exists with:
- `id` (UUID)
- `name` (VARCHAR)
- `brand` (VARCHAR)
- `daily_rate` (DECIMAL)
- `category` (VARCHAR)
- `is_available` (BOOLEAN)

### 3. Frontend Integration
Add link to modify booking in customer dashboard:
```html
<a href="/frontend/modify-booking.html?id=${bookingId}">
  Modify Booking
</a>
```

### 4. Email Service Integration
Currently emails are queued in the `notifications` table. To send actual emails:

Option A: Set up Supabase Edge Function
```javascript
// supabase/functions/send-email/index.ts
export async function sendEmail(req: Request) {
  const emailData = await req.json();
  // Integrate with SendGrid/Mailgun/SES
  return new Response(JSON.stringify({ success: true }));
}
```

Option B: Integrate SendGrid directly
```javascript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
await sgMail.send({
  to: emailData.to,
  from: 'noreply@vrs.example.com',
  subject: emailData.subject,
  html: emailData.body
});
```

## Workflow

```
Customer visits booking detail
      ↓
Clicks "Modify Booking"
      ↓
System loads: modify-booking.html?id=booking-id
      ↓
Page loads booking details and available vehicles
      ↓
Customer changes dates/vehicle
      ↓
Real-time price calculation updates
      ↓
Form submission triggers BookingModificationManager.modifyBooking()
      ↓
Validation: availability check, date validation
      ↓
Price calculation: original vs new
      ↓
Create booking_event record
      ↓
Create booking_modifications record
      ↓
Update bookings table
      ↓
Queue email notifications
      ↓
Show success message
      ↓
Redirect to bookings list
```

## Error Handling

### Validation Errors
- Date validation: "Dropoff date must be after pickup date"
- Availability: "Selected dates are not available for this vehicle"
- Booking not found: "Booking not found"

### Database Errors
- Transaction failures trigger rollback
- User-friendly error messages displayed
- Detailed logs in console

### Email Errors
- Queued but optional (non-blocking)
- Logged for debugging
- Retry mechanism can be implemented

## Testing

### Manual Testing
1. Navigate to modify booking page with valid booking ID
2. Change pickup date to a future date
3. Verify price updates automatically
4. Submit form
5. Check for success message
6. Verify modification in database

### Automated Testing (Future)
- Unit tests for price calculator
- Integration tests for booking modification flow
- Database transaction tests

## Customization

### Adjust Fee Percentages
In `PriceCalculator`:
```javascript
SERVICE_FEE_PERCENTAGE = 0.10; // Change to 0.15 for 15%
TAX_PERCENTAGE = 0.10;
DISCOUNT_PERCENTAGE_MULTI_DAY = 0.05;
```

### Add/Remove Insurance Types
In `PriceCalculator.INSURANCE_DAILY_RATES`:
```javascript
INSURANCE_DAILY_RATES = {
  basic: 15.00,
  standard: 25.00,
  premium: 40.00,
  luxury: 60.00 // Add new type
};
```

### Modify Email Template
Edit HTML in `EmailNotificationService.generateEmailHTML()`

## Known Limitations

1. Manual refund processing required (integrate with payment gateway)
2. Email service requires setup with third-party provider
3. No approval workflow (auto-approved for MVP)
4. Vehicle data must exist in `vehicles` table

## Future Enhancements

- [ ] Payment gateway integration for automated refunds/charges
- [ ] SMS notifications
- [ ] Modification approval workflow (for premium bookings)
- [ ] Loyalty points adjustment
- [ ] Bulk modification tools for admins
- [ ] Modification restrictions (e.g., max X days before rental)

## Support

For issues or questions about this feature:
1. Check database migration status in Supabase
2. Verify user authentication
3. Review browser console for errors
4. Check Supabase logs for database errors
