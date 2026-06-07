-- ============================================
-- Make payment-receipts bucket PUBLIC
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. First, let's check if the bucket exists
SELECT * FROM storage.buckets WHERE id = 'payment-receipts';

-- 2. If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Make the bucket public (if it already exists but is private)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'payment-receipts';

-- 4. Create a policy to allow anyone to view/download files
CREATE POLICY IF NOT EXISTS "Public Access to Receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-receipts');

-- Or if that errors, try this:
-- DROP POLICY IF EXISTS "Public Access to Receipts" ON storage.objects;
-- CREATE POLICY "Public Access to Receipts" ON storage.objects FOR SELECT USING (bucket_id = 'payment-receipts');

-- 5. Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Auth users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-receipts');

-- 6. Verify the bucket is now public
SELECT id, name, public FROM storage.buckets WHERE id = 'payment-receipts';

-- ============================================
-- ALSO: Check if bookings table has payment_receipt_url column
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name LIKE '%receipt%';

-- If column doesn't exist, add it:
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

-- ============================================
-- Check payments table for receipt_url column
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
AND column_name LIKE '%receipt%';

-- If column doesn't exist, add it:
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- ============================================
-- Check existing receipts
-- ============================================
SELECT id, booking_id, receipt_url, created_at 
FROM payments 
WHERE receipt_url IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- Check bookings with receipt URLs
SELECT id, booking_code, payment_receipt_url, created_at 
FROM bookings 
WHERE payment_receipt_url IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
