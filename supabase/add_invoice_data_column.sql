-- Add invoice_data storage for edited invoice values.
-- Since 'bookings' is a VIEW, we store invoice data in a separate table.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.booking_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE,
  invoice_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.booking_invoices ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (admins)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.booking_invoices;
CREATE POLICY "Allow all for authenticated" ON public.booking_invoices
  FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_booking_invoices_booking ON public.booking_invoices(booking_id);

SELECT 'booking_invoices table created successfully' AS result;
