-- ============================================================
-- Fix: Allow admins to UPDATE user_profiles (approve/reject verification)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure the is_admin() helper exists (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. Drop the old policy (may or may not exist in different forms)
DROP POLICY IF EXISTS "Admins full access to profiles" ON public.user_profiles;

-- 3. Recreate with BOTH `USING` and `WITH CHECK`
--    USING  → governs SELECT and DELETE
--    WITH CHECK → governs INSERT and UPDATE
CREATE POLICY "Admins full access to profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING ( auth.uid() = id OR public.is_admin() )
  WITH CHECK ( auth.uid() = id OR public.is_admin() );

-- 4. Also add the missing verification_notes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'verification_notes'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN verification_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'verification_reviewed_at'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN verification_reviewed_at timestamptz;
  END IF;
END $$;

-- 5. Also ensure notifications table has channel and priority columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'channel'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN channel text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN priority text;
  END IF;
END $$;

-- 6. Add user_profiles to realtime publication so status changes push to users
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT 'Admin update policy fixed successfully' AS result;
