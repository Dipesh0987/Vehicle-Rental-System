# Refund Tracking Integration Guide

**Quick Start for Developers**

This guide explains how to integrate refund tracking into your booking management pages.

---

## Installation

### 1. Include Required Scripts

Add these scripts to your HTML page (e.g., `modify-booking.html`):

```html
<!-- At the end of <body>, after main content -->
<script src="assets/js/supabase.client.js"></script>
<script src="assets/js/refund-service.js"></script>
<script src="assets/js/refund-tracking.js"></script>
<script src="assets/js/refund-notification-service.js"></script>
<script src="assets/js/booking-cancellation-manager.js"></script>
<script src="assets/js/booking-cancellation-integration.js"></script>
```

### 2. CSS Styling

The CSS is already included in `frontend/assets/css/tailwind.input.css`. Ensure it's linked:

```html
<link rel="stylesheet" href="assets/css/tailwind.css">
```

---

## Basic Usage

### 1. Initialize Cancellation UI on Booking Page

```javascript
// In your booking details page (e.g., modify-booking.html)
document.addEventListener('DOMContentLoaded', async () => {
  const bookingId = getBookingIdFromUrl(); // Get booking ID
  const bookingData = {
    total_price: 450.00,
    payment_method: 'credit_card',
    // ... other booking fields
  };

  // Initialize cancellation integration
  const cancellation = new BookingCancellationIntegration();
  await cancellation.init(bookingId, bookingData);
});
```

### 2. Create a Cancel Button Placeholder

Add a div with data attribute in your booking actions section:

```html
<!-- In modify-booking.html -->
<div class="booking-actions" data-booking-actions>
  <!-- Cancel button will be injected here -->
</div>
```

### 3. Display Refund Status Page

Link users to refund tracking after cancellation:

```html
<!-- Link to refund status page -->
<a href="refund-status.html?booking=BOOKING_ID">View Refund Status</a>
```

---

## Advanced Usage

### Manually Cancel a Booking

```javascript
// Without UI modal
const result = await BookingCancellationManager.cancelBooking(
  bookingId,
  'Customer requested cancellation'
);

if (result.success) {
  console.log('Booking cancelled, refund ID:', result.refundId);
  // Redirect or show confirmation
} else {
  console.error('Cancellation failed:', result.error);
}
```

### Check Refund Status Programmatically

```javascript
// Get refund details
const refundData = await RefundService.getRefundStatus(bookingId);

if (refundData.success && refundData.data) {
  const refund = refundData.data;
  console.log('Refund Status:', refund.status);
  console.log('Refund Amount:', refund.refund_amount);
  console.log('Refund Method:', refund.refund_method);
}
```

### Send Custom Notification

```javascript
// Initialize notification service
await RefundNotificationService.init();

// Send credited notification
await RefundNotificationService.sendRefundCreditedNotification({
  id: refundId,
  booking_id: bookingId,
  refund_amount: 450.00,
  refund_method: 'credit_card'
});
```

### Subscribe to Refund Updates

```javascript
// Subscribe to push notifications for a booking
const subscription = await RefundNotificationService.subscribeToRefundUpdates(bookingId);

if (subscription.success) {
  console.log('Subscribed to refund updates');
}
```

### Admin: Get Pending Refunds

```javascript
// Get all pending refunds (admin only)
const pending = await RefundService.getPendingRefunds(50);

if (pending.success) {
  pending.data.forEach(refund => {
    console.log(`Pending refund: ${refund.id} - $${refund.refund_amount}`);
  });
}
```

### Admin: Update Refund Status

```javascript
// Update refund status (requires admin role)
const result = await RefundService.updateRefundStatus(
  refundId,
  'credited',
  {
    refund_initiated_at: new Date().toISOString()
  }
);
```

---

## Module Reference

### RefundService

```javascript
// Static methods for refund management

RefundService.createRefundRecord(bookingId, amount, method)
  // Returns: { success, data: { refund object } }

RefundService.getRefundStatus(bookingId)
  // Returns: { success, data: { refund object } or null }

RefundService.updateRefundStatus(refundId, status, metadata)
  // Returns: { success, data: { updated refund } }

RefundService.failRefund(refundId, reason, ticketId)
  // Returns: { success, data, retryCount }

RefundService.getRefundDetails(bookingId)
  // Returns: { success, data: { bookingId, originalPrice, refund } }

RefundService.pollRefundStatus(refundId, intervalMs, maxAttempts)
  // Returns Promise with status polling result

RefundService.getPendingRefunds(limit)
  // Returns: { success, data: [ refunds ] }
```

### RefundTrackingModule

```javascript
// Class for UI management

const tracker = new RefundTrackingModule('container-id');

tracker.init(bookingId)
  // Initialize tracking display

tracker.render(refund)
  // Re-render with new refund data

tracker.setupAutoRefresh(refund)
  // Start 30-second polling

tracker.stopAutoRefresh()
  // Stop polling

tracker.destroy()
  // Cleanup resources
```

### RefundNotificationService

```javascript
// Static methods for notifications

RefundNotificationService.init()
  // Request browser notification permission

RefundNotificationService.sendRefundCreditedNotification(data)
  // Push notification for successful refund

RefundNotificationService.sendRefundFailedNotification(data)
  // Push notification for failed refund

RefundNotificationService.showToastNotification(title, message, type, duration)
  // In-app toast notification

RefundNotificationService.sendEmailNotification(bookingId, data, type)
  // Send email (backend integration)

RefundNotificationService.createSupportTicketForFailedRefund(data)
  // Auto-create support ticket
```

### BookingCancellationManager

```javascript
// Static methods for cancellation workflow

BookingCancellationManager.cancelBooking(bookingId, reason)
  // Returns: { success, message, refundId, refund }

BookingCancellationManager.canCancelBooking(status)
  // Returns: boolean

BookingCancellationManager.getRefundStatus(bookingId)
  // Returns: { success, data: refund details }

BookingCancellationManager.retryFailedRefund(refundId)
  // Returns: { success, message }

BookingCancellationManager.getUserCancellations(userId)
  // Returns: { success, data: [ cancelled bookings with refunds ] }
```

### BookingCancellationIntegration

```javascript
// Class for UI integration

const integration = new BookingCancellationIntegration();

integration.init(bookingId, bookingData)
  // Initialize cancellation UI

integration.openCancellationModal()
  // Show cancellation dialog

integration.closeCancellationModal()
  // Hide cancellation dialog

integration.destroy()
  // Cleanup
```

---

## Event Handling

### Listen for Cancellation

```javascript
// The cancellation modal fires a custom event on completion
window.addEventListener('booking-cancelled', (event) => {
  const { bookingId, refundId } = event.detail;
  console.log('Booking cancelled, redirecting to refund tracking');
});
```

### Handle Refund Status Changes

```javascript
// Refund updates are logged to window.RefundTrackingModule
// Listen for custom analytics events if analytics is available

if (window.analytics) {
  window.addEventListener('refund_credited', (data) => {
    // Handle refund credited
  });
}
```

---

## Customization

### Change Auto-Refresh Interval

```javascript
// In RefundTrackingModule.setupAutoRefresh()
// Change the 30000 (30 seconds) to your desired interval
this.pollInterval = setInterval(async () => {
  // ... polling logic
}, 30000); // <- Change this value
```

### Customize Status Badges

```javascript
// In RefundTrackingModule.getStatusLabel()
// Modify the labels object to change displayed text
const labels = {
  'pending': 'Awaiting Processing', // Changed from 'Pending'
  'processing': 'In Progress',       // Changed from 'Processing'
  'credited': '✓ Success',            // Changed from '✓ Credited'
  'failed': '✗ Error'                 // Changed from '✗ Failed'
};
```

### Modify Notification Text

```javascript
// In RefundNotificationService.sendRefundCreditedNotification()
const notification = new Notification('Custom Title', {
  body: 'Custom notification message',
  // ... other options
});
```

---

## Testing

### Test Cancel Workflow

1. Open `modify-booking.html` with a valid booking
2. Click "Cancel Booking" button
3. Review refund details in modal
4. Enter cancellation reason (optional)
5. Check confirmation checkbox
6. Click "Confirm Cancellation"
7. Should redirect to `refund-status.html?booking=ID`

### Test Refund Status Updates

1. Navigate to `refund-status.html?booking=BOOKING_ID`
2. Observe the timeline with "Pending" status
3. Auto-refresh every 30 seconds
4. In demo mode, status updates automatically:
   - +2s: "Processing"
   - +5-10s: "Credited" or "Failed"

### Test Notifications

1. Ensure notifications are enabled in browser
2. Trigger a refund status update
3. Push notification should appear
4. Clicking notification opens refund tracking page

### Test on Mobile

1. Open on mobile device or use browser dev tools responsive mode
2. Verify modal is responsive
3. Check touch interactions work
4. Confirm notifications display correctly

---

## Troubleshooting

### Modal not showing

**Problem:** Cancel button not visible or modal doesn't open

**Solution:**
- Ensure `data-booking-actions` div exists in HTML
- Check console for JavaScript errors
- Verify `BookingCancellationIntegration` is initialized
- Confirm CSS file is linked

### Refund status not updating

**Problem:** Status stuck on "Pending"

**Solution:**
- Open browser DevTools console
- Check for errors
- Verify Supabase connection works
- Check RLS policies allow read access
- Manually refresh page

### Notifications not appearing

**Problem:** No push notifications received

**Solution:**
- Check browser notification permissions: `Notification.permission`
- Verify `RefundNotificationService.init()` called successfully
- Check browser notification settings for your domain
- Ensure Service Worker is registered (if using push subscriptions)

### Data not loading in refund tracking

**Problem:** Refund tracking page shows loading spinner indefinitely

**Solution:**
- Check booking ID in URL: `?booking=BOOKING_ID`
- Verify booking exists and is cancelled
- Check database connection
- Check RLS policies
- Review browser console for errors

---

## Browser Support

- Chrome 90+ ✓
- Firefox 88+ ✓
- Safari 14+ ✓
- Edge 90+ ✓
- Mobile browsers (iOS Safari, Chrome Mobile) ✓

**Notifications support:**
- Push notifications: Chrome, Firefox, Edge (not Safari)
- Toast notifications: All browsers ✓

---

## Performance Considerations

### Polling Interval
- Default: 30 seconds
- Shorter intervals increase server load
- Recommend 30-60 seconds for production

### Database Queries
- Refund status queries are indexed
- Add caching if frequent queries to same refund
- Consider batch queries for admin dashboard

### Notifications
- Push notifications are browser-level, minimal impact
- Toast notifications only when refund changes
- Email/SMS notifications are backend operations

---

## Security Notes

1. **User Privacy**: Users only see their own refunds (RLS enforced)
2. **Admin Operations**: Only admins can update refund status
3. **Payment Data**: Full payment details not stored/displayed
4. **HTTPS Required**: For push notifications in production
5. **Auth Required**: All operations require authenticated user

---

## Next Steps

1. Review [REFUND_TRACKING_GUIDE.md](../REFUND_TRACKING_GUIDE.md) for detailed feature documentation
2. Test all workflows in development environment
3. Configure backend email/SMS services
4. Set up support ticket system integration
5. Deploy to staging for QA
6. Configure production monitoring
7. Train customer support team
8. Launch feature with announcement

---

## Support

For issues or questions:
- Check troubleshooting section above
- Review console logs for error messages
- See [REFUND_TRACKING_GUIDE.md](../REFUND_TRACKING_GUIDE.md) for detailed docs
- Contact: development@rentavehicle.com

---

**Last Updated:** May 15, 2026
