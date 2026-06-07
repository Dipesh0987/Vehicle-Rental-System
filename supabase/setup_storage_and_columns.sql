-- ============================================================
-- Run this in the Supabase SQL Editor
-- Creates the storage bucket and required columns
-- ============================================================

-- 1. Create the 'profile-images' storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow anyone (authenticated) to upload to profile-images
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
  CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'profile-images');
END $$;

-- 3. Allow anyone to read from profile-images (public bucket)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
  CREATE POLICY "Allow public read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'profile-images');
END $$;

-- 4. Allow users to update/overwrite their own files
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
  CREATE POLICY "Allow authenticated update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'profile-images');
END $$;

-- 5. Ensure user_profiles has all the required columns
DO $$
BEGIN
  -- Verification columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='verification_status') THEN
    ALTER TABLE public.user_profiles ADD COLUMN verification_status text DEFAULT 'not_submitted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='document_type') THEN
    ALTER TABLE public.user_profiles ADD COLUMN document_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='document_front_url') THEN
    ALTER TABLE public.user_profiles ADD COLUMN document_front_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='document_back_url') THEN
    ALTER TABLE public.user_profiles ADD COLUMN document_back_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='verification_submitted_at') THEN
    ALTER TABLE public.user_profiles ADD COLUMN verification_submitted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.user_profiles ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='profile_image_url') THEN
    ALTER TABLE public.user_profiles ADD COLUMN profile_image_url text;
  END IF;
END $$;

-- 6. Create the 'payment-receipts' storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Allow authenticated upload to payment-receipts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow receipt uploads" ON storage.objects;
  CREATE POLICY "Allow receipt uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'payment-receipts');
END $$;

-- 8. Allow public read from payment-receipts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow receipt read" ON storage.objects;
  CREATE POLICY "Allow receipt read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'payment-receipts');
END $$;

-- 9. Ensure vehicle_bookings has payment_receipt_url and payment_status columns
-- (The "bookings" name is a view over vehicle_bookings)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehicle_bookings' AND column_name='payment_receipt_url') THEN
    ALTER TABLE public.vehicle_bookings ADD COLUMN payment_receipt_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehicle_bookings' AND column_name='payment_status') THEN
    ALTER TABLE public.vehicle_bookings ADD COLUMN payment_status text DEFAULT 'unpaid';
  END IF;
END $$;

-- Recreate the bookings view so the new columns are visible through it
DROP VIEW IF EXISTS public.bookings;
CREATE VIEW public.bookings AS SELECT * FROM public.vehicle_bookings;
GRANT ALL ON public.bookings TO authenticated;
GRANT SELECT ON public.bookings TO anon;

-- 10. Create the 'billing-receipts' storage bucket (for expense receipts & payment screenshots)
INSERT INTO storage.buckets (id, name, public)
VALUES ('billing-receipts', 'billing-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 11. Allow authenticated upload to billing-receipts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow billing receipt uploads" ON storage.objects;
  CREATE POLICY "Allow billing receipt uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'billing-receipts');
END $$;

-- 12. Allow public read from billing-receipts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow billing receipt read" ON storage.objects;
  CREATE POLICY "Allow billing receipt read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'billing-receipts');
END $$;

-- 13. Allow authenticated update on billing-receipts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow billing receipt update" ON storage.objects;
  CREATE POLICY "Allow billing receipt update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'billing-receipts');
END $$;

-- Done!
SELECT 'Storage bucket and columns created successfully' AS result;
