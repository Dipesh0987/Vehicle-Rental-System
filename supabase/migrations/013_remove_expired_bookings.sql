-- ============================================================================
-- 013_remove_expired_bookings.sql
-- Run in Supabase Dashboard → SQL Editor
-- Deletes all bookings with status 'expired' and their orphaned payments.
-- ============================================================================

-- 1. Delete payments linked to expired bookings
DELETE FROM public.payments
WHERE booking_id IN (
  SELECT id FROM public.vehicle_bookings WHERE status = 'expired'
);

-- 2. Delete payment receipts linked to expired bookings
DELETE FROM public.payment_receipts
WHERE booking_id IN (
  SELECT id FROM public.vehicle_bookings WHERE status = 'expired'
);

-- 3. Delete the expired bookings themselves
DELETE FROM public.vehicle_bookings WHERE status = 'expired';

SELECT 'All expired bookings and related records removed' AS status;
