-- Fix drivers table - Add missing columns
-- Run this in Supabase SQL Editor

-- Add address column if it doesn't exist
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS address TEXT;

-- Add other potentially missing columns
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS licence_status TEXT DEFAULT 'Valid';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_assigned TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_assignment TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email TEXT;

-- Enable RLS policies for full CRUD
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) to do everything
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drivers' AND policyname = 'Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON drivers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
