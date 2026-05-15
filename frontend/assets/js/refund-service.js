/**
 * Refund Service
 * Manages refund tracking, status updates, and notifications for cancelled bookings
 */

import { supabase } from './supabase.client.js';

class RefundService {
  /**
   * Create refund tracking record for a cancelled booking
   */
  static async createRefundRecord(bookingId, refundAmount, refundMethod = 'credit_card') {
    try {
      const { data, error } = await supabase
        .from('refund_tracking')
        .insert([
          {
            booking_id: bookingId,
            refund_amount: refundAmount,
            refund_method: refundMethod,
            status: 'pending',
            cancellation_date: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating refund record:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Exception creating refund record:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get refund status for a booking
   */
  static async getRefundStatus(bookingId) {
    try {
      const { data, error } = await supabase
        .from('refund_tracking')
        .select('*')
        .eq('booking_id', bookingId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching refund status:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: true, data: null, message: 'No refund record found' };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Exception fetching refund status:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update refund status (admin/system operation)
   */
  static async updateRefundStatus(refundId, newStatus, metadata = {}) {
    try {
      const updateData = {
        status: newStatus,
        last_status_check: new Date().toISOString(),
        ...metadata
      };

      // Set refund_credited_at if status is credited
      if (newStatus === 'credited') {
        updateData.refund_credited_at = new Date().toISOString();
        updateData.notification_sent = false; // Reset for notification logic
      }

      const { data, error } = await supabase
        .from('refund_tracking')
        .update(updateData)
        .eq('id', refundId)
        .select()
        .single();

      if (error) {
        console.error('Error updating refund status:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Exception updating refund status:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Mark refund as failed with reason
   */
  static async failRefund(refundId, failureReason, supportTicketId = null) {
    try {
      const { data: refund, error: fetchError } = await supabase
        .from('refund_tracking')
        .select('retry_count')
        .eq('id', refundId)
        .single();

      if (fetchError) throw new Error('Refund record not found');

      const newRetryCount = (refund.retry_count || 0) + 1;

      const updateData = {
        status: 'failed',
        failure_reason: failureReason,
        retry_count: newRetryCount,
        last_status_check: new Date().toISOString()
      };

      if (supportTicketId) {
        updateData.support_ticket_id = supportTicketId;
      }

      const { data, error } = await supabase
        .from('refund_tracking')
        .update(updateData)
        .eq('id', refundId)
        .select()
        .single();

      if (error) {
        console.error('Error marking refund as failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data, retryCount: newRetryCount };
    } catch (err) {
      console.error('Exception marking refund as failed:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get refund details for booking display
   */
  static async getRefundDetails(bookingId) {
    try {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, total_price, payment_method, status')
        .eq('id', bookingId)
        .eq('status', 'cancelled')
        .single();

      if (bookingError || !booking) {
        return { success: false, error: 'Booking not found or not cancelled' };
      }

      const refundStatus = await this.getRefundStatus(bookingId);
      if (!refundStatus.success) {
        return { success: false, error: 'Unable to fetch refund status' };
      }

      return {
        success: true,
        data: {
          bookingId,
          bookingStatus: booking.status,
          originalPrice: booking.total_price,
          refund: refundStatus.data || {
            refund_amount: booking.total_price,
            refund_method: booking.payment_method || 'original_payment',
            status: 'pending'
          }
        }
      };
    } catch (err) {
      console.error('Exception getting refund details:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Poll refund status (for real-time updates)
   */
  static async pollRefundStatus(refundId, intervalMs = 30000, maxAttempts = 20) {
    return new Promise((resolve) => {
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;

        const { data: refund, error } = await supabase
          .from('refund_tracking')
          .select('status, refund_credited_at, failure_reason')
          .eq('id', refundId)
          .single();

        if (error) {
          console.error('Poll error:', error);
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            resolve({ success: false, error: 'Max poll attempts reached' });
          }
          return;
        }

        // Stop polling if status is credited or failed
        if (refund.status === 'credited' || refund.status === 'failed') {
          clearInterval(pollInterval);
          resolve({ success: true, data: refund, attempts });
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          resolve({ success: false, error: 'Refund still processing', data: refund });
        }
      }, intervalMs);
    });
  }

  /**
   * Get pending refunds for admin dashboard
   */
  static async getPendingRefunds(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('refund_tracking')
        .select(`
          *,
          bookings:booking_id(id, user_id, booking_reference, total_price)
        `)
        .in('status', ['pending', 'processing', 'failed'])
        .order('cancellation_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching pending refunds:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Exception fetching pending refunds:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Simulate refund processing (for demo/testing)
   */
  static async simulateRefundProcessing(refundId, delayMs = 3000) {
    try {
      // Update to processing
      await this.updateRefundStatus(refundId, 'processing');

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Randomly succeed or fail (80% success rate)
      const willSucceed = Math.random() < 0.8;

      if (willSucceed) {
        return await this.updateRefundStatus(refundId, 'credited', {
          refund_initiated_at: new Date().toISOString()
        });
      } else {
        return await this.failRefund(refundId, 'Simulated processing error', null);
      }
    } catch (err) {
      console.error('Exception in refund simulation:', err);
      return { success: false, error: err.message };
    }
  }
}

// Export for use in other modules
window.RefundService = RefundService;
export { RefundService };
