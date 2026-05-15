/**
 * Booking Cancellation Integration Module
 * Integrates cancellation UI with refund tracking on booking modification page
 */

import { BookingCancellationManager } from './booking-cancellation-manager.js';
import { RefundService } from './refund-service.js';
import { RefundNotificationService } from './refund-notification-service.js';

class BookingCancellationIntegration {
  constructor() {
    this.bookingId = null;
    this.booking = null;
    this.cancellationModalElement = null;
  }

  /**
   * Initialize cancellation UI on booking page
   */
  async init(bookingId, bookingData = null) {
    this.bookingId = bookingId;
    this.booking = bookingData;

    // Create cancel button
    this.createCancelButton();

    // Create modal for cancellation confirmation
    this.createCancellationModal();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Create cancel button in booking details
   */
  createCancelButton() {
    const bookingActionsElement = document.querySelector('[data-booking-actions]');
    if (!bookingActionsElement) return;

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelBookingBtn';
    cancelBtn.className = 'btn btn-cancel';
    cancelBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      Cancel Booking
    `;
    cancelBtn.setAttribute('aria-label', 'Cancel this booking');

    bookingActionsElement.appendChild(cancelBtn);
  }

  /**
   * Create cancellation confirmation modal
   */
  createCancellationModal() {
    const modal = document.createElement('div');
    modal.id = 'cancellationModal';
    modal.className = 'cancellation-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'cancellationModalTitle');
    modal.innerHTML = `
      <div class="modal-overlay" id="modalOverlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="cancellationModalTitle" class="modal-title">Cancel Booking</h2>
          <button class="modal-close" id="modalCloseBtn" aria-label="Close modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Warning Alert -->
          <div class="alert alert-warning">
            <svg class="alert-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <div>
              <h4>Important Information</h4>
              <p>Cancelling your booking will initiate a refund to your original payment method. Refunds typically take 3-5 business days.</p>
            </div>
          </div>

          <!-- Refund Information -->
          <div class="refund-info-section">
            <h3>Refund Details</h3>
            <div class="refund-info-item">
              <span>Refund Amount:</span>
              <span id="refundAmount" class="amount">$0.00</span>
            </div>
            <div class="refund-info-item">
              <span>Original Payment Method:</span>
              <span id="originalPaymentMethod">-</span>
            </div>
            <div class="refund-info-item">
              <span>Expected Credit Date:</span>
              <span id="expectedCreditDate">3-5 business days</span>
            </div>
          </div>

          <!-- Cancellation Reason -->
          <div class="form-group">
            <label for="cancellationReason" class="form-label">Reason for Cancellation (Optional)</label>
            <textarea
              id="cancellationReason"
              class="form-control"
              placeholder="Help us improve by sharing your reason for cancellation..."
              rows="3"
            ></textarea>
            <p class="form-help">This will help us better serve you in the future.</p>
          </div>

          <!-- Confirmation Checkbox -->
          <div class="form-checkbox">
            <input
              id="confirmCancellation"
              type="checkbox"
              name="confirmCancellation"
              required
            />
            <label for="confirmCancellation">
              I understand that cancelling this booking will initiate a refund and this action cannot be undone.
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button id="cancelModalBtn" class="btn btn-secondary" aria-label="Don't cancel the booking">
            Keep Booking
          </button>
          <button id="confirmCancelBtn" class="btn btn-danger" disabled>
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Confirm Cancellation
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.cancellationModalElement = modal;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Cancel button click
    const cancelBtn = document.getElementById('cancelBookingBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.openCancellationModal());
    }

    // Modal controls
    const modalOverlay = document.getElementById('modalOverlay');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const confirmCheckbox = document.getElementById('confirmCancellation');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');

    if (modalOverlay) modalOverlay.addEventListener('click', () => this.closeCancellationModal());
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => this.closeCancellationModal());
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => this.closeCancellationModal());

    // Enable/disable confirm button based on checkbox
    if (confirmCheckbox) {
      confirmCheckbox.addEventListener('change', (e) => {
        confirmCancelBtn.disabled = !e.target.checked;
      });
    }

    // Confirm cancellation
    if (confirmCancelBtn) {
      confirmCancelBtn.addEventListener('click', () => this.handleCancellation());
    }
  }

  /**
   * Open cancellation modal
   */
  openCancellationModal() {
    if (!this.booking) {
      this.showError('Booking details not loaded');
      return;
    }

    // Update refund information
    this.updateRefundInfo();

    // Show modal with animation
    this.cancellationModalElement.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close cancellation modal
   */
  closeCancellationModal() {
    this.cancellationModalElement.classList.remove('show');
    document.body.style.overflow = '';

    // Reset form
    document.getElementById('confirmCancellation').checked = false;
    document.getElementById('cancellationReason').value = '';
    document.getElementById('confirmCancelBtn').disabled = true;
  }

  /**
   * Update refund information in modal
   */
  updateRefundInfo() {
    const refundAmount = this.booking.total_price || 0;
    const paymentMethod = this.booking.payment_method || 'Original Payment Method';

    document.getElementById('refundAmount').textContent = `$${parseFloat(refundAmount).toFixed(2)}`;
    document.getElementById('originalPaymentMethod').textContent = this.getPaymentMethodLabel(paymentMethod);
    document.getElementById('expectedCreditDate').textContent = '3-5 business days';
  }

  /**
   * Handle cancellation confirmation
   */
  async handleCancellation() {
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const cancellationReason = document.getElementById('cancellationReason').value || 'Customer requested cancellation';

    // Disable button and show loading
    confirmCancelBtn.disabled = true;
    confirmCancelBtn.textContent = 'Processing...';

    try {
      // Call booking cancellation
      const result = await BookingCancellationManager.cancelBooking(
        this.bookingId,
        cancellationReason
      );

      if (!result.success) {
        this.showError(result.error);
        confirmCancelBtn.disabled = false;
        confirmCancelBtn.textContent = 'Confirm Cancellation';
        return;
      }

      // Close modal
      this.closeCancellationModal();

      // Show success message
      this.showSuccess(
        'Booking Cancelled Successfully!',
        'Your refund has been initiated. You will be notified when it\'s processed.'
      );

      // Redirect to refund status page
      setTimeout(() => {
        window.location.href = `/refund-status.html?booking=${this.bookingId}`;
      }, 2000);
    } catch (err) {
      console.error('Error cancelling booking:', err);
      this.showError('An error occurred while processing your cancellation. Please try again.');
      confirmCancelBtn.disabled = false;
      confirmCancelBtn.textContent = 'Confirm Cancellation';
    }
  }

  /**
   * Get payment method label
   */
  getPaymentMethodLabel(method) {
    const labels = {
      'credit_card': 'Credit Card',
      'bank_transfer': 'Bank Transfer',
      'wallet': 'Digital Wallet',
      'original_payment': 'Original Payment Method',
      'debit_card': 'Debit Card',
      'paypal': 'PayPal'
    };
    return labels[method] || method;
  }

  /**
   * Show error toast
   */
  showError(message) {
    RefundNotificationService.showToastNotification('Error', message, 'error', 5000);
  }

  /**
   * Show success toast
   */
  showSuccess(title, message) {
    RefundNotificationService.showToastNotification(title, message, 'success', 5000);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.cancellationModalElement) {
      this.cancellationModalElement.remove();
    }
  }
}

window.BookingCancellationIntegration = BookingCancellationIntegration;
export { BookingCancellationIntegration };
