/**
 * Booking Modification Manager
 * Orchestrates the complete modification workflow:
 * - Validation
 * - Price recalculation
 * - Database updates
 * - Event logging
 * - Email notifications
 */

import { BookingService } from './booking-service.js';
import { PriceCalculator } from './price-calculator.js';
import { supabase } from './supabase.client.js';

class BookingModificationManager {
  /**
   * Initiate booking modification workflow
   */
  static async modifyBooking(bookingId, modifications) {
    const {
      newPickupDate,
      newDropoffDate,
      newVehicleId,
      newPickupLocation,
      newDropoffLocation,
      reason = 'Customer requested change',
      insuranceType = 'basic'
    } = modifications;

    try {
      // Step 1: Fetch original booking
      const bookingResult = await BookingService.getBookingDetail(bookingId);
      if (!bookingResult.success) throw new Error('Booking not found');

      const originalBooking = bookingResult.data;
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;

      if (!currentUserId) throw new Error('User not authenticated');

      // Step 2: Validate new dates and vehicle availability
      const availResult = await BookingService.validateAvailability(
        newVehicleId || originalBooking.vehicle_id,
        newPickupDate,
        newDropoffDate,
        bookingId
      );

      if (!availResult.success) {
        return {
          success: false,
          error: 'Failed to check vehicle availability',
          details: availResult.error
        };
      }

      if (!availResult.available) {
        return {
          success: false,
          error: 'Vehicle not available for selected dates',
          conflictDetails: availResult.conflictingBookings
        };
      }

      // Step 3: Calculate prices
      const newVehicleData = await this.getVehicleData(newVehicleId || originalBooking.vehicle_id);
      if (!newVehicleData) throw new Error('Vehicle data not found');

      const originalPrice = PriceCalculator.calculateRentalPrice({
        vehicleRate: newVehicleData.daily_rate,
        pickupDate: originalBooking.pickup_date,
        dropoffDate: originalBooking.dropoff_date,
        insuranceType,
        addOns: originalBooking.add_ons || []
      });

      const newPrice = PriceCalculator.calculateRentalPrice({
        vehicleRate: newVehicleData.daily_rate,
        pickupDate: newPickupDate,
        dropoffDate: newDropoffDate,
        insuranceType,
        addOns: originalBooking.add_ons || []
      });

      const priceDifference = PriceCalculator.calculatePriceDifference(originalPrice, newPrice);

      // Step 4: Create booking event
      const eventResult = await BookingService.createBookingEvent(
        bookingId,
        'modified',
        {
          originalDates: {
            pickup: originalBooking.pickup_date,
            dropoff: originalBooking.dropoff_date
          },
          newDates: {
            pickup: newPickupDate,
            dropoff: newDropoffDate
          },
          priceDifference: priceDifference.priceDifference
        },
        currentUserId
      );

      if (!eventResult.success) throw new Error('Failed to create booking event');

      // Step 5: Create modification record
      const modificationResult = await BookingService.createModification({
        booking_id: bookingId,
        booking_event_id: eventResult.data.id,
        original_pickup_date: originalBooking.pickup_date,
        original_dropoff_date: originalBooking.dropoff_date,
        original_vehicle_id: originalBooking.vehicle_id,
        original_pickup_location: originalBooking.pickup_location,
        original_dropoff_location: originalBooking.dropoff_location,
        original_total_price: originalBooking.total_price,
        new_pickup_date: newPickupDate,
        new_dropoff_date: newDropoffDate,
        new_vehicle_id: newVehicleId || originalBooking.vehicle_id,
        new_pickup_location: newPickupLocation || originalBooking.pickup_location,
        new_dropoff_location: newDropoffLocation || originalBooking.dropoff_location,
        new_total_price: newPrice.totalPrice,
        price_difference: priceDifference.priceDifference,
        is_refund: priceDifference.isRefund,
        is_charge: priceDifference.isCharge,
        reason,
        modified_by: currentUserId,
        status: 'approved' // Auto-approve for now (could add approval workflow)
      });

      if (!modificationResult.success) throw new Error('Failed to create modification record');

      // Step 6: Update booking
      const updateResult = await BookingService.updateBooking(bookingId, {
        pickup_date: newPickupDate,
        dropoff_date: newDropoffDate,
        vehicle_id: newVehicleId || originalBooking.vehicle_id,
        pickup_location: newPickupLocation || originalBooking.pickup_location,
        dropoff_location: newDropoffLocation || originalBooking.dropoff_location,
        base_price: newPrice.basePrice,
        service_fee: newPrice.serviceFee,
        tax_amount: newPrice.tax,
        total_price: newPrice.totalPrice,
        updated_at: new Date().toISOString()
      });

      if (!updateResult.success) throw new Error('Failed to update booking');

      // Step 7: Queue email notification
      await this.queueModificationEmail(
        originalBooking,
        updateResult.data,
        priceDifference,
        currentUserId
      );

      return {
        success: true,
        modification: modificationResult.data,
        booking: updateResult.data,
        priceDifference,
        message: `Booking modified successfully. ${
          priceDifference.isRefund
            ? `You will receive a refund of ${PriceCalculator.formatPrice(priceDifference.amount)}`
            : priceDifference.isCharge
            ? `Please pay the additional charge of ${PriceCalculator.formatPrice(priceDifference.amount)}`
            : 'No price adjustments'
        }`
      };
    } catch (error) {
      console.error('Modification error:', error);
      return {
        success: false,
        error: error.message || 'Failed to modify booking'
      };
    }
  }

  /**
   * Get vehicle pricing data
   */
  static async getVehicleData(vehicleId) {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, brand, daily_rate, category')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      return null;
    }
  }

  /**
   * Queue modification confirmation email
   */
  static async queueModificationEmail(originalBooking, modifiedBooking, priceDifference, userId) {
    try {
      // Get user email
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Queue email notification (would integrate with email service)
      const emailData = {
        to: userData.email,
        subject: 'Your Booking Has Been Successfully Modified',
        bookingReference: originalBooking.booking_reference,
        customerName: userData.full_name,
        originalDates: {
          pickup: originalBooking.pickup_date,
          dropoff: originalBooking.dropoff_date
        },
        newDates: {
          pickup: modifiedBooking.pickup_date,
          dropoff: modifiedBooking.dropoff_date
        },
        priceDifference,
        modifiedBooking
      };

      // Log for now - would send via email service
      console.log('Modification email queued:', emailData);

      // Store in a notifications table if needed
      const { error: notifError } = await supabase.from('notifications').insert([
        {
          user_id: userId,
          type: 'booking_modified',
          subject: emailData.subject,
          data: emailData,
          read: false,
          created_at: new Date().toISOString()
        }
      ]);

      if (notifError) console.warn('Failed to store notification:', notifError);

      return { success: true };
    } catch (error) {
      console.error('Error queuing email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get modification history for a booking
   */
  static async getModificationHistory(bookingId) {
    return await BookingService.getModificationHistory(bookingId);
  }

  /**
   * Get booking audit trail
   */
  static async getAuditTrail(bookingId) {
    return await BookingService.getBookingEvents(bookingId);
  }
}

export { BookingModificationManager };
