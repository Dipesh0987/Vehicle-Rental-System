-- ============================================================================
-- 004_fix_vehicle_bookings_columns.sql
-- Run in Supabase Dashboard → SQL Editor
-- Adds missing columns that the booking service needs
-- ============================================================================

-- Add columns used by booking.service.js that are missing from the original schema
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NPR';
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS base_amount numeric DEFAULT 0;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS payment_deadline timestamptz;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;
ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false;

-- Generate booking_code automatically if not set
CREATE OR REPLACE FUNCTION public.generate_booking_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.booking_code IS NULL OR NEW.booking_code = '' THEN
    NEW.booking_code := 'BK-' || substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_code ON public.vehicle_bookings;
CREATE TRIGGER set_booking_code
  BEFORE INSERT ON public.vehicle_bookings
  FOR EACH ROW EXECUTE FUNCTION public.generate_booking_code();

-- Also ensure users can insert their own bookings (RLS)
DROP POLICY IF EXISTS "Users insert own bookings" ON public.vehicle_bookings;
CREATE POLICY "Users insert own bookings" ON public.vehicle_bookings
  FOR INSERT WITH CHECK (auth.uid() = customer_user_id);

-- Users should also be able to update their own bookings (for cancellation etc)
DROP POLICY IF EXISTS "Users update own bookings" ON public.vehicle_bookings;
CREATE POLICY "Users update own bookings" ON public.vehicle_bookings
  FOR UPDATE USING (auth.uid() = customer_user_id);

SELECT 'vehicle_bookings columns updated' AS status;
