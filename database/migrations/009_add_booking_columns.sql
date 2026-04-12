-- Migration 009: Add new columns to bookings table
-- Purpose: Add actual_return_date and deposit_amount columns as per DBA requirements
-- Status: Up (AddBookingColumns)

-- Add new columns
ALTER TABLE public.bookings ADD COLUMN actual_return_date DATE;
ALTER TABLE public.bookings ADD COLUMN deposit_amount DECIMAL(10,2);

-- Rollback guidance:
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS actual_return_date;
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS deposit_amount;