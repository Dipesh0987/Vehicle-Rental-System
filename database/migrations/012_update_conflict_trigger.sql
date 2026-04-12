-- Migration 012: Update booking conflict prevention trigger
-- Purpose: Update trigger to use return_date instead of dropoff_date for overlap checking
-- Status: Up (UpdateBookingConflictTrigger)

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS booking_conflict_check ON public.bookings;
DROP FUNCTION IF EXISTS check_booking_conflict();

-- Create updated function to check for booking conflicts using return_date
CREATE OR REPLACE FUNCTION check_booking_conflict()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's any conflicting booking for the same vehicle
  -- Only check bookings that are not cancelled
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE vehicle_id = NEW.vehicle_id
      AND status IN ('pending', 'confirmed', 'active')
      AND booking_id != COALESCE(NEW.booking_id, '00000000-0000-0000-0000-000000000000'::UUID)  -- Exclude current booking if updating
      AND NOT (NEW.return_date < pickup_date OR NEW.pickup_date > return_date)
  ) THEN
    RAISE EXCEPTION 'Vehicle is not available for the selected dates';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated trigger to enforce booking conflict check
CREATE TRIGGER booking_conflict_check
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_conflict();

-- Rollback guidance:
-- DROP TRIGGER IF EXISTS booking_conflict_check ON public.bookings;
-- DROP FUNCTION IF EXISTS check_booking_conflict();
-- -- Then recreate the original function from migration 007