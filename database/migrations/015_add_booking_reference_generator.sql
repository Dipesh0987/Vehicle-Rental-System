-- Migration 015: Add trigger to generate booking_reference
-- Purpose: Auto-generate 10-character alphanumeric booking_reference on INSERT
-- Status: Up (AddBookingReferenceGenerator)

-- Create function to generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TRIGGER AS $$
DECLARE
  ref_text TEXT;
  ref_length INTEGER := 10;
BEGIN
  -- Generate a random 10-character alphanumeric string
  ref_text := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR ref_length));

  -- Ensure it's exactly 10 characters and alphanumeric
  WHILE LENGTH(ref_text) < ref_length OR ref_text !~ '^[A-Z0-9]+$' LOOP
    ref_text := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT || ref_text) FROM 1 FOR ref_length));
  END LOOP;

  NEW.booking_reference := ref_text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate booking_reference on INSERT
CREATE TRIGGER generate_booking_reference_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.booking_reference IS NULL)
  EXECUTE FUNCTION generate_booking_reference();

-- Rollback guidance:
-- DROP TRIGGER IF EXISTS generate_booking_reference_trigger ON public.bookings;
-- DROP FUNCTION IF EXISTS generate_booking_reference();