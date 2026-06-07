-- Add payment columns to the underlying bookings table
-- First, find the actual table name (usually vehicle_bookings or similar)

-- Option 1: If the underlying table is 'vehicle_bookings'
ALTER TABLE IF EXISTS public.vehicle_bookings 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP WITH TIME ZONE;

-- Option 2: If the underlying table is 'bookings_base' or similar
-- Uncomment and modify based on your actual table structure:
-- ALTER TABLE IF EXISTS public.bookings_base 
-- ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash',
-- ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
-- ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT,
-- ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP WITH TIME ZONE;

-- Refresh the view after adding columns
-- DROP VIEW IF EXISTS public.bookings;
-- CREATE VIEW public.bookings AS SELECT * FROM public.vehicle_bookings;

-- Or recreate the view with new columns included
COMMENT ON TABLE public.bookings IS 'View on vehicle_bookings table with payment fields';
