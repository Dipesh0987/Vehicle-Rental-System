-- Migration 010: Update booking_reference column length
-- Purpose: Change booking_reference from VARCHAR(20) to VARCHAR(12) as per DBA requirements
-- Status: Up (UpdateBookingReferenceLength)

-- Update column type
ALTER TABLE public.bookings ALTER COLUMN booking_reference TYPE VARCHAR(12);

-- Rollback guidance:
-- ALTER TABLE public.bookings ALTER COLUMN booking_reference TYPE VARCHAR(20);