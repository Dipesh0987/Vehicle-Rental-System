-- Migration 013: Add composite index for overlap query performance
-- Purpose: Add composite index on (vehicle_id, pickup_date, return_date) for efficient overlap queries
-- Status: Up (AddOverlapQueryIndex)

-- Add composite index for overlap query performance
CREATE INDEX idx_bookings_vehicle_dates ON public.bookings(vehicle_id, pickup_date, return_date);

-- Rollback guidance:
-- DROP INDEX IF EXISTS idx_bookings_vehicle_dates;