-- Migration 011: Add CHECK constraint for return_date validation
-- Purpose: Ensure return_date is greater than pickup_date as per DBA requirements
-- Status: Up (AddReturnDateCheckConstraint)

-- Add CHECK constraint
ALTER TABLE public.bookings ADD CONSTRAINT chk_return_date_after_pickup
  CHECK (return_date > pickup_date);

-- Rollback guidance:
-- ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS chk_return_date_after_pickup;