-- Migration 007: Add booking conflict prevention
-- Purpose: Prevent double booking of vehicles with overlapping dates
-- Status: Up (AddBookingConflictPrevention)

-- Create function to check for booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflict()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's any conflicting booking for the same vehicle
  -- Only check bookings that are not cancelled
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE vehicle_id = NEW.vehicle_id
      AND status IN ('pending', 'confirmed', 'active')
      AND id != COALESCE(NEW.id, 0)  -- Exclude current booking if updating
      AND NOT (NEW.dropoff_date < pickup_date OR NEW.pickup_date > dropoff_date)
  ) THEN
    RAISE EXCEPTION 'Vehicle is not available for the selected dates';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce booking conflict check
CREATE TRIGGER booking_conflict_check
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_conflict();

-- Rollback guidance:
-- DROP TRIGGER IF EXISTS booking_conflict_check ON public.bookings;
-- DROP FUNCTION IF EXISTS check_booking_conflict();</content>
<parameter name="filePath">c:\Users\LENOVO\Desktop\Vehicle Rental\Vehicle-Rental-System\database\migrations\007_booking_conflict_prevention.sql