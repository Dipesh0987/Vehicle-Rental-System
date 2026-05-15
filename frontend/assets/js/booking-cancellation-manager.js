/**
 * Booking Cancellation Manager
 * Handles booking cancellations with refund tracking integration
 */

import { supabase } from './supabase.client.js';
import { RefundService } from './refund-service.js';
import { RefundNotificationService } from './refund-notification-service.js';

class BookingCancellationManager {
  /**
   * Cancel a booking and initiate refund process
   */
  static async cancelBooking(bookingId, cancellationReason = 'Customer requested cancellation') {
    try {
      // Step 1: Fetch booking details
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('id, user_id, booking_reference, status, total_price, payment_method, created_at')
        .eq('id', bookingId)
        .single();

      if (fetchError || !booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Check if booking can be cancelled
      if (!this.canCancelBooking(booking.status)) {
        return { success: false, error: `Cannot cancel a ${booking.status} booking` };
      }

      // Step 2: Calculate refund amount (full refund for now, can add policies later)
      const refundAmount = booking.total_price;
      const refundMethod = booking.payment_method || 'original_payment';

      // Step 3: Create refund tracking record
      const refundRecord = await RefundService.createRefundRecord(
        bookingId,
        refundAmount,
        refundMethod
      );

      if (!refundRecord.success) {
        return { success: false, error: 'Failed to create refund record' };
      }

      const refundId = refundRecord.data.id;

      // Step 4: Create booking event for cancellation
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      const { error: eventError } = await supabase
        .from('booking_events')
        .insert([
          {
            booking_id: bookingId,
            event_type: 'cancelled',
            description: cancellationReason,
            event_data: {
              refund_amount: refundAmount,
              refund_method: refundMethod,
              refund_id: refundId,
              cancellation_reason: cancellationReason
            },
            performed_by: currentUserId
          }
        ]);

      if (eventError) throw eventError;

      // Step 5: Update booking status to cancelled
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Step 6: Send initial notification
      await RefundNotificationService.init();
      await RefundNotificationService.sendRefundProcessingNotification(refundRecord.data);

      // Step 7: Queue email notification
      await this.queueCancellationEmail(booking, refundRecord.data);

      // Step 8: Simulate refund processing (in production, this would be a backend job)
      this.simulateRefundProcessing(refundId, booking);

      return {
        success: true,
        message: 'Booking cancelled successfully. Refund processing has started.',
        bookingId,
        refundId,
        refund: refundRecord.data
      };
    } catch (err) {
      console.error('Error cancelling booking:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if booking can be cancelled
   */
  static canCancelBooking(status) {
    const cancellableStatuses = ['pending', 'confirmed'];
    return cancellableStatuses.includes(status);
  }

  /**
   * Queue cancellation confirmation email
   */
  static async queueCancellationEmail(booking, refund) {
    try {
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', booking.user_id)
        .single();

      if (userError) throw userError;

      const emailData = {
        to: userData.email,
        subject: 'Booking Cancellation Confirmed - Refund Initiated',
        bookingReference: booking.booking_reference,
        customerName: userData.full_name,
        cancellationDate: new Date().toLocaleDateString(),
        refundAmount: refund.refund_amount,
        refundMethod: refund.refund_method,
        refundStatus: refund.status,
        estimatedCreditDate: this.getEstimatedCreditDate()
      };

      // Log notification
      console.log('Cancellation email queued:', emailData);

      return { success: true, emailData };
    } catch (err) {
      console.error('Error queuing cancellation email:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get estimated refund credit date
   */
  static getEstimatedCreditDate() {
    const date = new Date();
    date.setDate(date.getDate() + 3); // 3 business days estimate
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  /**
   * Simulate refund processing (backend job simulation)
   */
  static async simulateRefundProcessing(refundId, booking) {
    // Simulate processing delay and status updates
    setTimeout(async () => {
      try {
        // Update to processing after 2 seconds
        await RefundService.updateRefundStatus(refundId, 'processing', {
          refund_initiated_at: new Date().toISOString()
        });

        // Simulate random success/failure after 5-10 seconds
        const delay = 5000 + Math.random() * 5000;
        setTimeout(async () => {
          const willSucceed = Math.random() < 0.85; // 85% success rate

          if (willSucceed) {
            const refundResult = await RefundService.updateRefundStatus(refundId, 'credited', {
              refund_initiated_at: new Date().toISOString()
            });

            if (refundResult.success) {
              // Send refund credited notification
              await RefundNotificationService.sendRefundCreditedNotification(refundResult.data);
            }
          } else {
            const failureReason = this.generateFailureReason();
            const ticketResult = await RefundNotificationService.createSupportTicketForFailedRefund({
              id: refundId,
              booking_id: booking.id,
              user_id: booking.user_id,
              refund_amount: booking.total_price,
              failure_reason: failureReason,
              status: 'failed'
            });

            await RefundService.failRefund(
              refundId,
              failureReason,
              ticketResult.success ? ticketResult.ticketId : null
            );

            // Send refund failed notification
            await RefundNotificationService.sendRefundFailedNotification({
              id: refundId,
              booking_id: booking.id,
              refund_amount: booking.total_price,
              status: 'failed',
              failure_reason: failureReason
            });
          }
        }, delay);
      } catch (err) {
        console.error('Error in refund simulation:', err);
      }
    }, 2000);
  }

  /**
   * Generate realistic failure reasons for demo purposes
   */
  static generateFailureReason() {
    const reasons = [
      'Card issuer declined the transaction',
      'Bank account verification failed',
      'Invalid bank account information',
      'Insufficient funds in account',
      'Account security block - requires customer verification'
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  /**
   * Get refund status for cancelled booking
   */
  static async getRefundStatus(bookingId) {
    return await RefundService.getRefundDetails(bookingId);
  }

  /**
   * Retry failed refund (admin/system operation)
   */
  static async retryFailedRefund(refundId) {
    try {
      const { data: refund, error: fetchError } = await supabase
        .from('refund_tracking')
        .select('*')
        .eq('id', refundId)
        .single();

      if (fetchError || refund.status !== 'failed') {
        return { success: false, error: 'Refund not found or not in failed state' };
      }

      // Attempt refund processing again
      this.simulateRefundProcessing(refundId, { id: refund.booking_id });

      return { success: true, message: 'Refund retry initiated' };
    } catch (err) {
      console.error('Error retrying refund:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get cancellation history for a user
   */
  static async getUserCancellations(userId) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          status,
          total_price,
          created_at,
          updated_at,
          refund_tracking!booking_id(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'cancelled')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data.map(booking => ({
          ...booking,
          refund: booking.refund_tracking?.[0] || null
        }))
      };
    } catch (err) {
      console.error('Error fetching cancellations:', err);
      return { success: false, error: err.message };
    }
  }
}

window.BookingCancellationManager = BookingCancellationManager;
export { BookingCancellationManager };
