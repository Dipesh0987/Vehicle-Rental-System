/**
 * Booking Error Handler
 * Handles booking-related errors and displays user-friendly messages
 * Uses Tailwind CSS for styling
 */

class BookingErrorHandler {
  /**
   * Show availability conflict error
   */
  static showConflictError(conflictingBookings, containerId = 'bookingErrorContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const conflictDates = conflictingBookings.map(booking => {
      const pickup = new Date(booking.pickup_date).toLocaleDateString();
      const dropoff = new Date(booking.dropoff_date).toLocaleDateString();
      return `${pickup} - ${dropoff}`;
    }).join(', ');

    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-sm font-medium text-red-800">
              Vehicle Not Available
            </h3>
            <div class="mt-2 text-sm text-red-700">
              <p>This vehicle is already booked for the selected dates: <strong>${conflictDates}</strong></p>
              <p class="mt-2">Please select different dates or choose another vehicle.</p>
            </div>
            <div class="mt-4">
              <button type="button"
                      onclick="BookingErrorHandler.showDatePicker()"
                      class="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Change Dates
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Show general booking error
   */
  static showGeneralError(message, containerId = 'bookingErrorContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-sm font-medium text-red-800">
              Booking Error
            </h3>
            <div class="mt-2 text-sm text-red-700">
              <p>${message}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Clear error messages
   */
  static clearErrors(containerId = 'bookingErrorContainer') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
  }

  /**
   * Show success message
   */
  static showSuccess(message, containerId = 'bookingSuccessContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-sm font-medium text-green-800">
              Booking Confirmed
            </h3>
            <div class="mt-2 text-sm text-green-700">
              <p>${message}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      container.classList.add('hidden');
    }, 5000);
  }

  /**
   * Focus on date picker (to be implemented by specific page)
   */
  static showDatePicker() {
    const pickupDate = document.getElementById('bookingPickupDate');
    if (pickupDate) {
      pickupDate.focus();
      pickupDate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Validate booking form before submission
   */
  static validateBookingForm() {
    const pickupDate = document.getElementById('bookingPickupDate');
    const dropoffDate = document.getElementById('bookingDropoffDate') || this.calculateDropoffDate();
    const duration = document.getElementById('bookingDuration');

    const errors = [];

    if (!pickupDate || !pickupDate.value) {
      errors.push('Please select a pickup date');
    } else {
      const pickup = new Date(pickupDate.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (pickup < today) {
        errors.push('Pickup date cannot be in the past');
      }
    }

    if (!dropoffDate) {
      errors.push('Please specify dropoff date');
    } else {
      const dropoff = new Date(typeof dropoffDate === 'string' ? dropoffDate : dropoffDate.value);
      const pickup = new Date(pickupDate.value);

      if (dropoff <= pickup) {
        errors.push('Dropoff date must be after pickup date');
      }
    }

    if (errors.length > 0) {
      this.showGeneralError(errors.join('<br>'));
      return false;
    }

    return true;
  }

  /**
   * Calculate dropoff date from pickup date and duration
   */
  static calculateDropoffDate() {
    const pickupDate = document.getElementById('bookingPickupDate');
    const duration = document.getElementById('bookingDuration');

    if (!pickupDate || !pickupDate.value || !duration || !duration.value) {
      return null;
    }

    const pickup = new Date(pickupDate.value);
    const days = parseInt(duration.value) || 1;

    const dropoff = new Date(pickup);
    dropoff.setDate(pickup.getDate() + days);

    return dropoff.toISOString().split('T')[0];
  }
}

// Export for use in other modules
window.BookingErrorHandler = BookingErrorHandler;</content>
<parameter name="filePath">c:\Users\LENOVO\Desktop\Vehicle Rental\Vehicle-Rental-System\frontend\assets\js\booking-error-handler.js