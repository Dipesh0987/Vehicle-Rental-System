-- Fix RLS policy for vendor_enquiries to allow anonymous inserts
-- Run this in Supabase SQL Editor

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow public insert" ON vendor_enquiries;

-- Create policy allowing anonymous users to insert
CREATE POLICY "Allow anonymous insert" ON vendor_enquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow authenticated users to insert (just in case they're logged in)
DROP POLICY IF EXISTS "Allow authenticated insert" ON vendor_enquiries;
CREATE POLICY "Allow authenticated insert" ON vendor_enquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE vendor_enquiries ENABLE ROW LEVEL SECURITY;

-- Check policies
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'vendor_enquiries';
