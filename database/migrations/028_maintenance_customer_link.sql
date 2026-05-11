-- 028_maintenance_customer_link.sql
-- Purpose: Link maintenance damage records to the customer who caused the
--          damage, sourced from completed vehicle_bookings.  The billing
--          form can then auto-fill customer name / email / booking ref.
--
-- New columns on maintenance_records:
--   customer_user_id   – auth.users FK (nullable)
--   customer_name      – display name captured at report time
--   customer_email     – email captured at report time
--   linked_booking_id  – UUID FK → vehicle_bookings (nullable)
--   booking_ref        – human-readable booking code copy (e.g. BK-XXXX)
--
-- Safe to re-run (all operations are IF NOT EXISTS / idempotent).

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS customer_user_id   uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name      text,
  ADD COLUMN IF NOT EXISTS customer_email     text,
  ADD COLUMN IF NOT EXISTS linked_booking_id  uuid
    REFERENCES public.vehicle_bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_ref        text;

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_customer_user
  ON public.maintenance_records(customer_user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_linked_booking
  ON public.maintenance_records(linked_booking_id);

NOTIFY pgrst, 'reload schema';
