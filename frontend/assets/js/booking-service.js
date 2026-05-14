/**
 * Booking Service
 * Handles all booking-related database operations
 * - Fetch bookings
 * - Retrieve booking details
 * - Get booking history
 * - Calculate price differences
 */

import { supabase } from './supabase.client.js';

class BookingService {
  /**
   * Fetch all bookings for a user
   */
  static async getUserBookings(userId) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          vehicle_id,
          pickup_date,
          pickup_time,
          dropoff_date,
          dropoff_time,
          pickup_location,
          dropoff_location,
          status,
          total_price,
          base_price,
          driver_name,
          add_ons,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch single booking with full details
   */
  static async getBookingDetail(bookingId) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          vehicles(*)
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching booking detail:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get booking modification history
   */
  static async getModificationHistory(bookingId) {
    try {
      const { data, error } = await supabase
        .from('booking_modifications')
        .select(`
          *,
          vehicles(*)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching modification history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get booking events (audit trail)
   */
  static async getBookingEvents(bookingId) {
    try {
      const { data, error } = await supabase
        .from('booking_events')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching booking events:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate new dates against vehicle availability
   * Returns available/unavailable status
   */
  static async validateAvailability(vehicleId, pickupDate, dropoffDate, excludeBookingId = null) {
    try {
      let query = supabase
        .from('bookings')
        .select('id, pickup_date, dropoff_date, status')
        .eq('vehicle_id', vehicleId)
        .in('status', ['confirmed', 'active', 'pending'])
        .not('status', 'eq', 'cancelled');

      // Exclude current booking if modifying
      if (excludeBookingId) {
        query = query.neq('id', excludeBookingId);
      }

      const { data: conflictingBookings, error } = await query;

      if (error) throw error;

      // Check for date conflicts
      const hasConflict = conflictingBookings.some(booking => {
        return !(dropoffDate < booking.pickup_date || pickupDate > booking.dropoff_date);
      });

      return {
        success: true,
        available: !hasConflict,
        conflictingBookings: hasConflict ? conflictingBookings : []
      };
    } catch (error) {
      console.error('Error validating availability:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create booking event for audit trail
   */
  static async createBookingEvent(bookingId, eventType, eventData, performedBy) {
    try {
      const { data, error } = await supabase
        .from('booking_events')
        .insert([
          {
            booking_id: bookingId,
            event_type: eventType,
            event_data: eventData,
            performed_by: performedBy
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating booking event:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create booking modification record
   */
  static async createModification(modificationData) {
    try {
      const { data, error } = await supabase
        .from('booking_modifications')
        .insert([modificationData])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating modification record:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update booking with new dates/vehicle
   */
  static async updateBooking(bookingId, updates) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating booking:', error);
      return { success: false, error: error.message };
    }
  }
}

export { BookingService };
