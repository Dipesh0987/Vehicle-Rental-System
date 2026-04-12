-- Migration 008: Rename booking table columns to match requirements
-- Purpose: Update column names to align with DBA specifications
-- Status: Up (RenameBookingColumns)

-- Rename columns to match requirements
ALTER TABLE public.bookings RENAME COLUMN id TO booking_id;
ALTER TABLE public.bookings RENAME COLUMN dropoff_date TO return_date;
ALTER TABLE public.bookings RENAME COLUMN base_price TO daily_rate_snapshot;
ALTER TABLE public.bookings RENAME COLUMN total_price TO total_amount;

-- Rollback guidance:
-- ALTER TABLE public.bookings RENAME COLUMN booking_id TO id;
-- ALTER TABLE public.bookings RENAME COLUMN return_date TO dropoff_date;
-- ALTER TABLE public.bookings RENAME COLUMN daily_rate_snapshot TO base_price;
-- ALTER TABLE public.bookings RENAME COLUMN total_amount TO total_price;