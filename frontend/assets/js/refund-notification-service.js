/**
 * Refund Notification Service
 * Handles push notifications and user alerts for refund status changes
 */

class RefundNotificationService {
  /**
   * Initialize notification service
   */
  static async init() {
    // Check if the browser supports notifications
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    // Request permission if not already granted
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return Notification.permission === 'granted';
  }

  /**
   * Send refund credited notification
   */
  static sendRefundCreditedNotification(refundData) {
    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    const notification = new Notification('Refund Credited! 🎉', {
      icon: '/assets/images/refund-icon.png',
      badge: '/assets/images/refund-badge.png',
      tag: `refund-credited-${refundData.booking_id}`,
      requireInteraction: false,
      body: `Your refund of $${parseFloat(refundData.refund_amount).toFixed(2)} has been credited to ${refundData.refund_method}.`,
      data: {
        bookingId: refundData.booking_id,
        refundId: refundData.id,
        action: 'view_booking'
      }
    });

    // Handle notification click
    notification.addEventListener('click', () => {
      window.focus();
      // Navigate to booking view
      window.location.href = `/modify-booking.html?id=${refundData.booking_id}`;
      notification.close();
    });

    // Log notification event
    this.logNotificationEvent('refund_credited', refundData);
  }

  /**
   * Send refund failed notification
   */
  static sendRefundFailedNotification(refundData) {
    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    const notification = new Notification('Refund Processing Failed ⚠️', {
      icon: '/assets/images/error-icon.png',
      badge: '/assets/images/error-badge.png',
      tag: `refund-failed-${refundData.booking_id}`,
      requireInteraction: true,
      body: `We encountered an issue processing your refund. Please contact our support team for assistance.`,
      data: {
        bookingId: refundData.booking_id,
        refundId: refundData.id,
        action: 'contact_support'
      }
    });

    // Handle notification click
    notification.addEventListener('click', () => {
      window.focus();
      // Navigate to contact page
      window.location.href = `/contact.html?booking=${refundData.booking_id}&issue=refund_failed`;
      notification.close();
    });

    // Log notification event
    this.logNotificationEvent('refund_failed', refundData);
  }

  /**
   * Send refund processing started notification
   */
  static sendRefundProcessingNotification(refundData) {
    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    const notification = new Notification('Refund Processing Started', {
      icon: '/assets/images/processing-icon.png',
      badge: '/assets/images/processing-badge.png',
      tag: `refund-processing-${refundData.booking_id}`,
      requireInteraction: false,
      body: `Your refund of $${parseFloat(refundData.refund_amount).toFixed(2)} is being processed. You will be notified when it's credited.`,
      data: {
        bookingId: refundData.booking_id,
        refundId: refundData.id,
        action: 'view_tracking'
      }
    });

    // Handle notification click
    notification.addEventListener('click', () => {
      window.focus();
      // Navigate to booking view
      window.location.href = `/modify-booking.html?id=${refundData.booking_id}`;
      notification.close();
    });

    // Log notification event
    this.logNotificationEvent('refund_processing_started', refundData);
  }

  /**
   * Show in-app toast notification
   */
  static showToastNotification(title, message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `refund-toast refund-toast-${type}`;
    toast.innerHTML = `
      <div class="refund-toast-content">
        <div class="refund-toast-title">${title}</div>
        <div class="refund-toast-message">${message}</div>
      </div>
      <button class="refund-toast-close" aria-label="Close notification">×</button>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Close button handler
    const closeBtn = toast.querySelector('.refund-toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });

    // Auto close after duration
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);

    return toast;
  }

  /**
   * Send email notification (backend integration)
   */
  static async sendEmailNotification(bookingId, refundData, notificationType = 'credited') {
    try {
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          refund_data: refundData,
          notification_type: notificationType,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Email notification failed: ${response.statusText}`);
      }

      return { success: true };
    } catch (err) {
      console.error('Error sending email notification:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send SMS notification (backend integration)
   */
  static async sendSMSNotification(bookingId, refundData, notificationType = 'credited') {
    try {
      const response = await fetch('/api/notifications/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          refund_data: refundData,
          notification_type: notificationType,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`SMS notification failed: ${response.statusText}`);
      }

      return { success: true };
    } catch (err) {
      console.error('Error sending SMS notification:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Create support ticket and notify user
   */
  static async createSupportTicketForFailedRefund(refundData) {
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Refund Processing Failed - ${refundData.booking_id}`,
          description: `Refund of $${parseFloat(refundData.refund_amount).toFixed(2)} failed to process. Reason: ${refundData.failure_reason}`,
          category: 'refund_issue',
          priority: 'high',
          refund_id: refundData.id,
          booking_id: refundData.booking_id,
          user_id: refundData.user_id
        })
      });

      if (!response.ok) {
        throw new Error(`Support ticket creation failed: ${response.statusText}`);
      }

      const ticketData = await response.json();
      return { success: true, ticketId: ticketData.id };
    } catch (err) {
      console.error('Error creating support ticket:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Log notification events for analytics
   */
  static logNotificationEvent(eventType, refundData) {
    if (!window.analytics) return;

    window.analytics.trackEvent(`refund_notification_${eventType}`, {
      booking_id: refundData.booking_id,
      refund_id: refundData.id,
      refund_amount: refundData.refund_amount,
      refund_method: refundData.refund_method,
      status: refundData.status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Subscribe to refund status updates via Service Worker
   */
  static async subscribeToRefundUpdates(bookingId) {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return { success: false, error: 'Service Workers not supported' };
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications for specific booking
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.vapidPublicKey
      });

      // Send subscription to backend
      const response = await fetch('/api/refund-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          subscription: subscription
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register refund subscription');
      }

      return { success: true, subscription };
    } catch (err) {
      console.error('Error subscribing to refund updates:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Batch notify all pending refunds (for admin)
   */
  static async notifyPendingRefunds() {
    try {
      const response = await fetch('/api/refund-notifications/send-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to send pending notifications');
      }

      const result = await response.json();
      return { success: true, notificationsSent: result.count };
    } catch (err) {
      console.error('Error sending pending notifications:', err);
      return { success: false, error: err.message };
    }
  }

  // VAPID public key for Web Push (should be configured from environment)
  static vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || null;
}

window.RefundNotificationService = RefundNotificationService;
export { RefundNotificationService };
