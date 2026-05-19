/**
 * Modify Booking Page - Frontend Logic
 * Handles form interactions, price calculations, and booking modifications
 */

import { supabase } from './supabase.client.js';
import { PriceCalculator } from './price-calculator.js';

// Inline service helpers (replaces deleted legacy booking-service.js / booking-modification-manager.js)
const BookingService = {
  async getBookingDetail(bookingId) {
    try {
      const { data, error } = await supabase
        .from('vehicle_bookings')
        .select('*')
        .eq('id', bookingId)
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

const BookingModificationManager = {
  async modifyBooking(bookingId, changes) {
    try {
      const updates = {};
      if (changes.newPickupDate) updates.start_date = changes.newPickupDate;
      if (changes.newDropoffDate) updates.end_date = changes.newDropoffDate;
      if (changes.newVehicleId) updates.vehicle_id = changes.newVehicleId;
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('vehicle_bookings')
        .update(updates)
        .eq('id', bookingId)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data, message: 'Booking modified successfully.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  async getModificationHistory(bookingId) {
    try {
      const { data, error } = await supabase
        .from('booking_modifications')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

class ModifyBookingPage {
  constructor() {
    this.bookingId = new URLSearchParams(window.location.search).get('id');
    this.currentBooking = null;
    this.currentUser = null;
    this.availableVehicles = [];
    this.init();
  }

  async init() {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.href = '/frontend/login.html';
      return;
    }

    this.currentUser = user;

    // Validate booking ID
    if (!this.bookingId) {
      this.showAlert('error', 'No booking specified. Redirecting...');
      setTimeout(() => {
        window.location.href = '/frontend/vehicles.html';
      }, 2000);
      return;
    }

    // Load page data
    await this.loadBooking();
    await this.loadAvailableVehicles();
    this.setupEventListeners();
    this.loadModificationHistory();
  }

  async loadBooking() {
    const result = await BookingService.getBookingDetail(this.bookingId);
    if (!result.success) {
      this.showAlert('error', 'Failed to load booking details');
      return;
    }

    this.currentBooking = result.data;

    // Populate booking info
    const infoHtml = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-slate-600 dark:text-slate-400">Booking Reference</p>
          <p class="text-lg font-bold text-slate-900 dark:text-white">${this.currentBooking.booking_reference}</p>
        </div>
        <div>
          <p class="text-sm text-slate-600 dark:text-slate-400">Current Status</p>
          <p class="text-lg font-bold">
            <span class="${this.getStatusBadgeClass(this.currentBooking.status)}">
              ${this.currentBooking.status.toUpperCase()}
            </span>
          </p>
        </div>
        <div>
          <p class="text-sm text-slate-600 dark:text-slate-400">Current Dates</p>
          <p class="text-lg font-semibold text-slate-900 dark:text-white">
            ${this.formatDate(this.currentBooking.pickup_date)} → ${this.formatDate(this.currentBooking.dropoff_date)}
          </p>
        </div>
        <div>
          <p class="text-sm text-slate-600 dark:text-slate-400">Current Vehicle</p>
          <p class="text-lg font-semibold text-slate-900 dark:text-white">${this.currentBooking.vehicles?.name || 'N/A'}</p>
        </div>
      </div>
    `;

    document.getElementById('bookingInfo').innerHTML = infoHtml;

    // Set default form values
    document.getElementById('newPickupDate').value = this.currentBooking.pickup_date;
    document.getElementById('newDropoffDate').value = this.currentBooking.dropoff_date;

    // Display original prices
    this.displayOriginalPrices();
  }

  displayOriginalPrices() {
    document.getElementById('originalBasePrice').textContent =
      PriceCalculator.formatPrice(this.currentBooking.base_price || 0);
    document.getElementById('originalServiceFee').textContent =
      PriceCalculator.formatPrice(this.currentBooking.service_fee || 0);
    document.getElementById('originalTax').textContent =
      PriceCalculator.formatPrice(this.currentBooking.tax_amount || 0);
    document.getElementById('originalTotal').textContent =
      PriceCalculator.formatPrice(this.currentBooking.total_price || 0);
  }

  async loadAvailableVehicles() {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, brand, category, daily_rate')
        .eq('is_available', true)
        .order('brand', { ascending: true });

      if (error) throw error;

      this.availableVehicles = data || [];

      // Populate vehicle dropdown
      const vehicleSelect = document.getElementById('newVehicleId');
      this.availableVehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.id;
        option.textContent = `${vehicle.brand} ${vehicle.name} - ${PriceCalculator.formatPrice(vehicle.daily_rate)}/day`;
        vehicleSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading vehicles:', error);
      this.showAlert('error', 'Failed to load available vehicles');
    }
  }

  setupEventListeners() {
    const form = document.getElementById('modificationForm');
    const pickupDateInput = document.getElementById('newPickupDate');
    const dropoffDateInput = document.getElementById('newDropoffDate');
    const vehicleSelect = document.getElementById('newVehicleId');
    const logoutBtn = document.getElementById('logoutBtn');

    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    pickupDateInput.addEventListener('change', () => this.updatePricePreview());
    dropoffDateInput.addEventListener('change', () => this.updatePricePreview());
    vehicleSelect.addEventListener('change', () => this.updatePricePreview());
    logoutBtn.addEventListener('click', () => this.handleLogout());

    // Update preview on load
    this.updatePricePreview();
  }

  async updatePricePreview() {
    const pickupDate = document.getElementById('newPickupDate').value;
    const dropoffDate = document.getElementById('newDropoffDate').value;
    const vehicleId = document.getElementById('newVehicleId').value || this.currentBooking.vehicle_id;

    if (!pickupDate || !dropoffDate) return;

    // Validate dates
    if (new Date(dropoffDate) <= new Date(pickupDate)) {
      this.showAlert('error', 'Dropoff date must be after pickup date');
      return;
    }

    try {
      // Get vehicle pricing data
      const vehicle = this.availableVehicles.find(v => v.id === vehicleId) ||
        { daily_rate: this.currentBooking.vehicles?.daily_rate };

      if (!vehicle) {
        console.error('Vehicle not found');
        return;
      }

      // Calculate new price
      const newPrice = PriceCalculator.calculateRentalPrice({
        vehicleRate: vehicle.daily_rate,
        pickupDate,
        dropoffDate,
        insuranceType: 'basic',
        addOns: this.currentBooking.add_ons || []
      });

      // Calculate original price for comparison
      const originalPrice = PriceCalculator.calculateRentalPrice({
        vehicleRate: this.currentBooking.vehicles?.daily_rate || vehicle.daily_rate,
        pickupDate: this.currentBooking.pickup_date,
        dropoffDate: this.currentBooking.dropoff_date,
        insuranceType: 'basic',
        addOns: this.currentBooking.add_ons || []
      });

      // Display new prices
      document.getElementById('newBasePrice').textContent =
        PriceCalculator.formatPrice(newPrice.basePrice);
      document.getElementById('newServiceFee').textContent =
        PriceCalculator.formatPrice(newPrice.serviceFee);
      document.getElementById('newTax').textContent =
        PriceCalculator.formatPrice(newPrice.tax);
      document.getElementById('newTotal').textContent =
        PriceCalculator.formatPrice(newPrice.totalPrice);

      // Calculate and display price difference
      const diff = PriceCalculator.calculatePriceDifference(originalPrice, newPrice);
      const diffElement = document.getElementById('priceDifference');
      const statusElement = document.getElementById('priceStatus');

      if (diff.priceDifference === 0) {
        diffElement.textContent = 'No change';
        diffElement.className = 'text-2xl font-bold text-slate-900 dark:text-white';
        statusElement.textContent = 'Price remains the same';
      } else if (diff.isRefund) {
        diffElement.textContent = `-${PriceCalculator.formatPrice(diff.amount)}`;
        diffElement.className = 'text-2xl font-bold text-green-600 dark:text-green-400';
        statusElement.textContent = `You'll receive a refund`;
      } else if (diff.isCharge) {
        diffElement.textContent = `+${PriceCalculator.formatPrice(diff.amount)}`;
        diffElement.className = 'text-2xl font-bold text-orange-600 dark:text-orange-400';
        statusElement.textContent = `Additional charge due`;
      }
    } catch (error) {
      console.error('Error updating price preview:', error);
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    const newPickupDate = document.getElementById('newPickupDate').value;
    const newDropoffDate = document.getElementById('newDropoffDate').value;
    const newVehicleId = document.getElementById('newVehicleId').value;
    const reason = document.getElementById('modificationReason').value;

    // Validate
    if (!newPickupDate || !newDropoffDate) {
      this.showAlert('error', 'Please select valid dates');
      return;
    }

    if (new Date(newDropoffDate) <= new Date(newPickupDate)) {
      this.showAlert('error', 'Dropoff date must be after pickup date');
      return;
    }

    // Show loading state
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processing...';

    try {
      const result = await BookingModificationManager.modifyBooking(this.bookingId, {
        newPickupDate,
        newDropoffDate,
        newVehicleId: newVehicleId || undefined,
        reason
      });

      if (result.success) {
        this.showAlert('success', result.message);
        setTimeout(() => {
          window.location.href = '/frontend/vehicles.html';
        }, 3000);
      } else {
        this.showAlert('error', result.error || 'Failed to modify booking');
      }
    } catch (error) {
      console.error('Submission error:', error);
      this.showAlert('error', 'An error occurred while processing your request');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async loadModificationHistory() {
    try {
      const result = await BookingModificationManager.getModificationHistory(this.bookingId);
      if (!result.success || !result.data || result.data.length === 0) {
        document.getElementById('historyContainer').innerHTML =
          '<p class="text-slate-500 dark:text-slate-400">No modifications yet</p>';
        return;
      }

      const historyHtml = result.data.map(mod => `
        <div class="border-l-4 border-blue-500 pl-4 py-3">
          <div class="flex items-start justify-between">
            <div>
              <p class="font-semibold text-slate-900 dark:text-white">
                Modified on ${this.formatDate(mod.created_at)}
              </p>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                ${mod.reason || 'No reason provided'}
              </p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium ${this.getStatusBadgeClass(mod.status)}">
              ${mod.status}
            </span>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p class="text-slate-500 dark:text-slate-400">Dates Changed</p>
              <p class="font-mono text-slate-700 dark:text-slate-300">
                ${this.formatDate(mod.original_pickup_date)} → ${this.formatDate(mod.new_pickup_date)}
              </p>
            </div>
            <div>
              <p class="text-slate-500 dark:text-slate-400">Price Adjustment</p>
              <p class="font-mono font-bold ${mod.price_difference < 0 ? 'text-green-600' : 'text-orange-600'}">
                ${mod.price_difference < 0 ? '-' : '+'}${PriceCalculator.formatPrice(Math.abs(mod.price_difference))}
              </p>
            </div>
          </div>
        </div>
      `).join('');

      document.getElementById('historyContainer').innerHTML = historyHtml;
    } catch (error) {
      console.error('Error loading history:', error);
      document.getElementById('historyContainer').innerHTML =
        '<p class="text-red-600 dark:text-red-400">Failed to load modification history</p>';
    }
  }

  showAlert(type, message) {
    const container = document.getElementById('alertContainer');
    const colors = {
      success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-200',
      error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-200',
      info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-200'
    };

    const alert = document.createElement('div');
    alert.className = `fade-enter-active border rounded-lg p-4 ${colors[type]}`;
    alert.textContent = message;

    container.innerHTML = '';
    container.appendChild(alert);

    setTimeout(() => alert.remove(), 5000);
  }

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusBadgeClass(status) {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200',
      active: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-200'
    };
    return badges[status] || badges.pending;
  }

  async handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/frontend/login.html';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new ModifyBookingPage();
});
