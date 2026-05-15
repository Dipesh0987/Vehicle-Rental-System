/**
 * Refund Tracking Module
 * Displays refund status and handles real-time updates in the booking view
 */

import { RefundService } from './refund-service.js';

class RefundTrackingModule {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.refundId = null;
    this.bookingId = null;
    this.pollInterval = null;
  }

  /**
   * Initialize refund tracking display for a cancelled booking
   */
  async init(bookingId) {
    this.bookingId = bookingId;

    try {
      const refundData = await RefundService.getRefundDetails(bookingId);

      if (!refundData.success) {
        this.showError('Unable to load refund information');
        return;
      }

      const { refund } = refundData.data;
      this.refundId = refund.id;

      this.render(refund);
      this.setupAutoRefresh(refund);
    } catch (err) {
      console.error('Error initializing refund tracking:', err);
      this.showError('Failed to initialize refund tracking');
    }
  }

  /**
   * Render refund status display
   */
  render(refund) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="refund-tracking-card">
        <div class="refund-header">
          <div class="refund-title-section">
            <h3 class="refund-title">Refund Status</h3>
            <p class="refund-subtitle">Tracking your cancellation refund</p>
          </div>
          <div class="refund-status-badge" data-status="${refund.status}">
            ${this.getStatusLabel(refund.status)}
          </div>
        </div>

        <div class="refund-details">
          <!-- Refund Amount -->
          <div class="refund-detail-item">
            <span class="refund-detail-label">Refund Amount</span>
            <span class="refund-detail-value amount">
              $${parseFloat(refund.refund_amount).toFixed(2)}
            </span>
          </div>

          <!-- Refund Method -->
          <div class="refund-detail-item">
            <span class="refund-detail-label">Refund Method</span>
            <span class="refund-detail-value">
              ${this.getRefundMethodLabel(refund.refund_method)}
            </span>
          </div>

          <!-- Status Timeline -->
          <div class="refund-timeline">
            ${this.renderTimeline(refund)}
          </div>

          <!-- Current Status Description -->
          <div class="refund-status-description">
            ${this.getStatusDescription(refund)}
          </div>

          ${this.renderFailureSection(refund)}
          ${this.renderSupportSection(refund)}
        </div>

        <!-- Auto-refresh indicator -->
        <div class="refund-refresh-indicator">
          <span class="refresh-text">Auto-refreshing every 30 seconds</span>
          <span class="refresh-dot"></span>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupEventListeners();
  }

  /**
   * Render timeline showing refund progress
   */
  renderTimeline(refund) {
    const steps = [
      {
        label: 'Cancelled',
        status: 'completed',
        date: refund.cancellation_date,
        icon: 'check'
      },
      {
        label: 'Processing',
        status: refund.status === 'pending' ? 'pending' : 'completed',
        date: refund.refund_initiated_at,
        icon: 'clock'
      },
      {
        label: 'Credited',
        status: refund.status === 'credited' ? 'completed' : (refund.status === 'failed' ? 'failed' : 'pending'),
        date: refund.refund_credited_at,
        icon: refund.status === 'credited' ? 'check' : 'hourglass'
      }
    ];

    return `
      <div class="timeline">
        ${steps.map((step, index) => `
          <div class="timeline-step" data-step-status="${step.status}">
            <div class="timeline-marker">
              ${this.getStepIcon(step.icon, step.status)}
            </div>
            <div class="timeline-content">
              <p class="timeline-label">${step.label}</p>
              ${step.date ? `<p class="timeline-date">${this.formatDate(step.date)}</p>` : ''}
            </div>
            ${index < steps.length - 1 ? '<div class="timeline-connector"></div>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render failure section if refund failed
   */
  renderFailureSection(refund) {
    if (refund.status !== 'failed') return '';

    return `
      <div class="refund-failure-section alert-warning">
        <div class="failure-header">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 9v2m0 4v2m-9-11h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V4a2 2 0 012-2z"/>
          </svg>
          <h4>Refund Processing Failed</h4>
        </div>
        <p class="failure-reason">${refund.failure_reason || 'An error occurred during refund processing'}</p>
        <p class="failure-retry">Retry attempt: ${refund.retry_count || 0}</p>
      </div>
    `;
  }

  /**
   * Render support contact section
   */
  renderSupportSection(refund) {
    if (refund.status === 'credited') return '';

    return `
      <div class="refund-support-section">
        <h4 class="support-title">Need Help?</h4>
        <p class="support-text">
          ${refund.status === 'failed' 
            ? 'Our support team will help resolve your refund issue.'
            : 'Contact us if you have questions about your refund.'}
        </p>
        <div class="support-actions">
          <button class="btn btn-contact-support" id="contactSupportBtn">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Contact Support
          </button>
          <button class="btn btn-view-ticket" id="viewTicketBtn" ${!refund.support_ticket_id ? 'style="display:none;"' : ''}>
            View Support Ticket
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Setup automatic refresh of refund status
   */
  setupAutoRefresh(initialRefund) {
    // Don't auto-refresh if refund is already completed
    if (initialRefund.status === 'credited' || initialRefund.status === 'failed') {
      return;
    }

    this.pollInterval = setInterval(async () => {
      try {
        const statusResult = await RefundService.getRefundStatus(this.bookingId);
        if (statusResult.success && statusResult.data) {
          const refund = statusResult.data;

          // Re-render if status changed
          if (refund.status !== initialRefund.status) {
            this.render(refund);
            initialRefund = refund;

            // Stop polling if completed
            if (refund.status === 'credited' || refund.status === 'failed') {
              this.stopAutoRefresh();
              this.showNotification(refund);
            }
          }
        }
      } catch (err) {
        console.error('Error auto-refreshing refund status:', err);
      }
    }, 30000); // Refresh every 30 seconds
  }

  /**
   * Stop auto-refresh interval
   */
  stopAutoRefresh() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Show notification when refund status changes
   */
  showNotification(refund) {
    if (!window.analytics) return;

    if (refund.status === 'credited') {
      window.analytics.trackEvent('refund_credited', {
        booking_id: this.bookingId,
        refund_amount: refund.refund_amount,
        refund_method: refund.refund_method
      });

      this.showSuccessNotification(
        'Refund Credited!',
        `Your refund of $${parseFloat(refund.refund_amount).toFixed(2)} has been credited.`
      );
    } else if (refund.status === 'failed') {
      this.showErrorNotification(
        'Refund Failed',
        'There was an issue processing your refund. Our support team will contact you.'
      );
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const contactBtn = document.getElementById('contactSupportBtn');
    const ticketBtn = document.getElementById('viewTicketBtn');

    if (contactBtn) {
      contactBtn.addEventListener('click', () => this.handleContactSupport());
    }

    if (ticketBtn) {
      ticketBtn.addEventListener('click', () => this.handleViewTicket());
    }
  }

  /**
   * Handle contact support button
   */
  async handleContactSupport() {
    // Navigate to contact page with booking reference
    window.location.href = `/contact.html?booking=${this.bookingId}&issue=refund`;
  }

  /**
   * Handle view support ticket
   */
  handleViewTicket() {
    // In production, this would navigate to support ticket view
    alert('Support ticket view would open here');
  }

  /**
   * Helper: Get status label
   */
  getStatusLabel(status) {
    const labels = {
      'pending': 'Pending',
      'processing': 'Processing',
      'credited': '✓ Credited',
      'failed': '✗ Failed'
    };
    return labels[status] || status;
  }

  /**
   * Helper: Get refund method label
   */
  getRefundMethodLabel(method) {
    const labels = {
      'credit_card': 'Credit Card',
      'bank_transfer': 'Bank Transfer',
      'wallet': 'Digital Wallet',
      'original_payment': 'Original Payment Method'
    };
    return labels[method] || method;
  }

  /**
   * Helper: Get status description
   */
  getStatusDescription(refund) {
    const descriptions = {
      'pending': 'Your refund has been initiated. We are processing your cancellation.',
      'processing': 'Your refund is being processed. Please allow 1-3 business days.',
      'credited': 'Your refund has been successfully credited to your account!',
      'failed': 'Your refund encountered an issue. Our team is working to resolve it.'
    };
    return `<p class="status-text">${descriptions[refund.status] || 'Unknown status'}</p>`;
  }

  /**
   * Helper: Get step icon SVG
   */
  getStepIcon(icon, status) {
    if (status === 'failed') {
      return '<svg class="step-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    }
    if (status === 'completed') {
      return '<svg class="step-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    }
    return '<svg class="step-icon spinning" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1m8.485 8.485l2.121-2.121m4 8h3m-8.485 8.485l2.121 2.121m-10.97-2.121l2.121 2.121m-10-8h-3m2.121-8.485l2.121-2.121"/></svg>';
  }

  /**
   * Helper: Format date
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="refund-error">
        <svg class="error-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Show success notification
   */
  showSuccessNotification(title, message) {
    this.showToast(title, message, 'success');
  }

  /**
   * Show error notification
   */
  showErrorNotification(title, message) {
    this.showToast(title, message, 'error');
  }

  /**
   * Show toast notification
   */
  showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopAutoRefresh();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

window.RefundTrackingModule = RefundTrackingModule;
export { RefundTrackingModule };
