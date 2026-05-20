-- ============================================================================
-- 013_remove_expired_bookings.sql
-- Run in Supabase Dashboard → SQL Editor
-- 1. Auto-expires unpaid bookings past their 15-min payment_deadline.
-- 2. Deletes all expired bookings and their orphaned payments/receipts.
-- ============================================================================

-- Step 1: Mark unpaid bookings past their deadline as 'expired'
UPDATE public.vehicle_bookings
SET status = 'expired'
WHERE status IN ('pending', 'confirmed')
  AND payment_status = 'unpaid'
  AND payment_deadline IS NOT NULL
  AND payment_deadline < NOW();

-- Step 2: Delete payments linked to expired bookings
DELETE FROM public.payments
WHERE booking_id IN (
  SELECT id FROM public.vehicle_bookings WHERE status = 'expired'
);

-- Step 3: Delete payment receipts linked to expired bookings
DELETE FROM public.payment_receipts
WHERE booking_id IN (
  SELECT id FROM public.vehicle_bookings WHERE status = 'expired'
);

-- Step 4: Delete the expired bookings themselves
DELETE FROM public.vehicle_bookings WHERE status = 'expired';

-- Step 5: Create a reusable function for auto-expiry (can be called by cron)
CREATE OR REPLACE FUNCTION public.expire_unpaid_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Mark unpaid bookings past deadline as expired
  UPDATE public.vehicle_bookings
  SET status = 'expired'
  WHERE status IN ('pending', 'confirmed')
    AND payment_status = 'unpaid'
    AND payment_deadline IS NOT NULL
    AND payment_deadline < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Clean up related records for expired bookings
  DELETE FROM public.payments
  WHERE booking_id IN (
    SELECT id FROM public.vehicle_bookings WHERE status = 'expired'
  );

  DELETE FROM public.payment_receipts
  WHERE booking_id IN (
    SELECT id FROM public.vehicle_bookings WHERE status = 'expired'
  );

  -- Remove the expired bookings
  DELETE FROM public.vehicle_bookings WHERE status = 'expired';

  RETURN expired_count;
END;
$$;

SELECT 'Expired bookings cleaned and expire_unpaid_bookings() function created' AS status;
