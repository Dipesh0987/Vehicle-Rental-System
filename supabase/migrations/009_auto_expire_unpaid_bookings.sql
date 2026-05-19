-- ============================================================================
-- 009_auto_expire_unpaid_bookings.sql
-- Run in Supabase Dashboard → SQL Editor
-- Automatically cancels bookings where the user did not pay within 15 minutes.
-- The payment_deadline column is set when the booking is created.
-- A pg_cron job runs every minute to expire overdue unpaid bookings.
-- ============================================================================

-- 1. Function that finds and cancels unpaid bookings past their deadline.
--    "Cancelled" status frees the reserved dates so others can book.
CREATE OR REPLACE FUNCTION public.expire_unpaid_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.vehicle_bookings
  SET
    status = 'cancelled',
    payment_status = 'expired',
    updated_at = now()
  WHERE
    -- Only target bookings that have a payment deadline set
    payment_deadline IS NOT NULL
    -- Deadline has passed
    AND payment_deadline < now()
    -- Only unpaid bookings (no partial or full payment made)
    AND (payment_status = 'unpaid' OR payment_status IS NULL)
    -- Only bookings still in pending/confirmed state (not already cancelled/completed)
    AND status IN ('pending', 'confirmed')
    -- Double-check: paid_amount must be 0 or null (no payment received at all)
    AND (paid_amount IS NULL OR paid_amount <= 0)
    -- Also check is_paid flag
    AND (is_paid IS NOT TRUE);
END;
$$;

-- 2. Enable the pg_cron extension (already enabled on Supabase by default).
--    This is a no-op if already enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Remove any existing cron job with the same name (idempotent re-run).
DO $$
BEGIN
  PERFORM cron.unschedule('expire-unpaid-bookings');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist yet, ignore
  NULL;
END;
$$;

-- 4. Schedule the function to run every 1 minute.
--    This ensures bookings are cancelled within ~1 minute of their deadline.
SELECT cron.schedule(
  'expire-unpaid-bookings',      -- job name
  '* * * * *',                    -- every minute
  $$SELECT public.expire_unpaid_bookings()$$
);

-- 5. Grant execute permission so the cron worker can call it.
GRANT EXECUTE ON FUNCTION public.expire_unpaid_bookings() TO postgres;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_bookings() TO service_role;

-- 6. Optional: Create an index for faster lookups of unpaid bookings with deadlines.
CREATE INDEX IF NOT EXISTS idx_bookings_payment_deadline_unpaid
  ON public.vehicle_bookings (payment_deadline)
  WHERE payment_status = 'unpaid' AND status IN ('pending', 'confirmed');

SELECT 'Auto-expire unpaid bookings cron job installed' AS status;
