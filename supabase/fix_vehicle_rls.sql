-- Fix vehicle access for admin bookings
-- Run this in Supabase SQL Editor

-- Enable RLS on vehicles table (if not already enabled)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated to read vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow public to read vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow anon to read vehicles" ON vehicles;
DROP POLICY IF EXISTS "Enable read access for all users" ON vehicles;

-- Create policy to allow authenticated users to read vehicles
CREATE POLICY "Allow authenticated to read vehicles" 
ON vehicles 
FOR SELECT 
TO authenticated 
USING (true);

-- Create policy to allow anonymous/public users to read vehicles (for booking creation)
CREATE POLICY "Allow anon to read vehicles" 
ON vehicles 
FOR SELECT 
TO anon 
USING (true);

-- Alternative: Single policy for all users
-- CREATE POLICY "Enable read access for all users" 
-- ON vehicles 
-- FOR SELECT 
-- USING (true);

-- Verify the policies were created
SELECT * FROM pg_policies WHERE tablename = 'vehicles';
