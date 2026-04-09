/**
 * Email Notification Service
 * Integrates with email provider to send booking modification confirmations
 * Supports: SendGrid, Supabase Realtime, or custom webhook
 * 
 * NOTE: In production, integrate with:
 * - SendGrid (https://sendgrid.com)
 * - Mailgun (https://mailgun.com)
 * - AWS SES (https://aws.amazon.com/ses)
 * - Or use Supabase Edge Functions
 */

import { supabase } from './supabase.client.js';

class EmailNotificationService {
  /**
   * Send booking modification confirmation email
   */
  static async sendModificationConfirmation(emailData) {
    const {
      to,
      customerName,
      bookingReference,
      originalDates,
      newDates,
      priceDifference,
      modifiedBooking
    } = emailData;

    try {
      // Option 1: Store in database for async processing
      const { error: insertError } = await supabase.from('notifications').insert([
        {
          user_id: emailData.userId,
          type: 'booking_modification_confirmation',
          recipient: to,
          subject: `Booking ${bookingReference} Updated - Vehicle Rental System`,
          body: this.generateEmailHTML({
            customerName,
            bookingReference,
            originalDates,
            newDates,
            priceDifference,
            modifiedBooking
          }),
          data: emailData,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ]);

      if (insertError) throw insertError;

      // Option 2: Call webhook or edge function (commented out for reference)
      // await this.callEmailWebhook(emailData);

      console.log('Modification confirmation email queued:', to);
      return { success: true, message: 'Confirmation email queued' };
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send refund notification email
   */
  static async sendRefundNotification(emailData) {
    const {
      to,
      customerName,
      bookingReference,
      refundAmount,
      refundReason
    } = emailData;

    try {
      const { error } = await supabase.from('notifications').insert([
        {
          type: 'booking_refund_notification',
          recipient: to,
          subject: `Refund Processed - ${bookingReference}`,
          body: this.generateRefundEmailHTML({
            customerName,
            bookingReference,
            refundAmount,
            refundReason
          }),
          data: emailData,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending refund email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send additional charge notification email
   */
  static async sendChargeNotification(emailData) {
    const {
      to,
      customerName,
      bookingReference,
      chargeAmount,
      chargeReason
    } = emailData;

    try {
      const { error } = await supabase.from('notifications').insert([
        {
          type: 'booking_charge_notification',
          recipient: to,
          subject: `Additional Charge - ${bookingReference}`,
          body: this.generateChargeEmailHTML({
            customerName,
            bookingReference,
            chargeAmount,
            chargeReason
          }),
          data: emailData,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending charge email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Call external email webhook/edge function
   * Replace with your actual endpoint
   */
  static async callEmailWebhook(emailData) {
    try {
      // Example: Call Supabase Edge Function
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailData)
        }
      );

      if (!response.ok) throw new Error('Email webhook failed');
      return await response.json();
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }

  /**
   * Generate HTML for modification confirmation email
   */
  static generateEmailHTML(data) {
    const {
      customerName,
      bookingReference,
      originalDates,
      newDates,
      priceDifference,
      modifiedBooking
    } = data;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 8px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; color: #1f2937; font-size: 16px; margin-bottom: 10px; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { color: #666; }
            .price-highlight { background: #dbeafe; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; border-radius: 4px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
            .alert { padding: 15px; margin: 15px 0; border-radius: 4px; }
            .alert-success { background: #dcfce7; color: #166534; border-left: 4px solid #22c55e; }
            .alert-warning { background: #fef3c7; color: #92400e; border-left: 4px solid #f59e0b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✓ Booking Modified Successfully</h1>
            </div>

            <div class="content">
                <p>Hi ${customerName},</p>

                <p>Your booking has been successfully modified. Here's a summary of the changes:</p>

                <div class="section">
                    <div class="section-title">📋 Booking Reference</div>
                    <div class="detail-row">
                        <span class="detail-label">Reference Number:</span>
                        <strong>${bookingReference}</strong>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📅 Date Changes</div>
                    <div class="detail-row">
                        <span class="detail-label">Original Pickup:</span>
                        <strong>${new Date(originalDates.pickup).toLocaleDateString()}</strong>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">New Pickup:</span>
                        <strong>${new Date(newDates.pickup).toLocaleDateString()}</strong>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Original Dropoff:</span>
                        <strong>${new Date(originalDates.dropoff).toLocaleDateString()}</strong>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">New Dropoff:</span>
                        <strong>${new Date(newDates.dropoff).toLocaleDateString()}</strong>
                    </div>
                </div>

                ${priceDifference.priceDifference !== 0 ? `
                <div class="alert ${priceDifference.isRefund ? 'alert-success' : 'alert-warning'}">
                    <strong>${priceDifference.isRefund ? '💰 Refund' : '💳 Additional Charge'}:</strong>
                    ${priceDifference.isRefund ? 'You will receive' : 'You need to pay'}
                    <strong>$${Math.abs(priceDifference.priceDifference).toFixed(2)}</strong>
                    ${priceDifference.isRefund ? 'back to your account' : 'for the modification'}
                </div>
                ` : ''}

                <div class="section">
                    <div class="section-title">💰 Price Summary</div>
                    <div class="price-highlight">
                        <div class="detail-row">
                            <span>New Total Price:</span>
                            <strong>$${modifiedBooking.total_price.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                <p>If you have any questions or need further assistance, please don't hesitate to contact our customer support team.</p>

                <p>Thank you for choosing Vehicle Rental System!</p>
            </div>

            <div class="footer">
                <p>© 2026 Vehicle Rental System. All rights reserved.</p>
                <p><a href="https://vrs.example.com" style="color: #3b82f6;">Visit our website</a> | <a href="mailto:support@vrs.example.com" style="color: #3b82f6;">Contact Support</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate HTML for refund notification email
   */
  static generateRefundEmailHTML(data) {
    const { customerName, bookingReference, refundAmount, refundReason } = data;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
            .content { background: #f0fdf4; padding: 20px; margin-top: 20px; border-radius: 8px; }
            .amount { font-size: 32px; font-weight: bold; color: #16a34a; text-align: center; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💰 Refund Processed</h1>
            </div>

            <div class="content">
                <p>Hi ${customerName},</p>

                <p>Your refund has been processed for booking ${bookingReference}.</p>

                <div class="amount">
                    + $${refundAmount.toFixed(2)}
                </div>

                <p><strong>Reason:</strong> ${refundReason}</p>

                <p>The refund will be credited to your original payment method within 3-5 business days.</p>

                <p>Thank you for your understanding!</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate HTML for charge notification email
   */
  static generateChargeEmailHTML(data) {
    const { customerName, bookingReference, chargeAmount, chargeReason } = data;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
            .content { background: #fffbeb; padding: 20px; margin-top: 20px; border-radius: 8px; }
            .amount { font-size: 32px; font-weight: bold; color: #d97706; text-align: center; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💳 Additional Charge</h1>
            </div>

            <div class="content">
                <p>Hi ${customerName},</p>

                <p>Your booking modification resulted in an additional charge for booking ${bookingReference}.</p>

                <div class="amount">
                    + $${chargeAmount.toFixed(2)}
                </div>

                <p><strong>Reason:</strong> ${chargeReason}</p>

                <p>This amount will be charged to your payment method on file. If you have any questions, please contact our support team.</p>

                <p>Thank you!</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

export { EmailNotificationService };
