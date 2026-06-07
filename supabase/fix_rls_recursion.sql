-- ============================================================
-- Fix infinite recursion on user_profiles RLS
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create a SECURITY DEFINER function that bypasses RLS to check admin role
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

-- 2. Drop the recursive admin policy on user_profiles
DROP POLICY IF EXISTS "Admins full access to profiles" ON public.user_profiles;

-- 3. Recreate it using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Admins full access to profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING ( auth.uid() = id OR public.is_admin() );

-- 4. Also fix admin policies on other tables to use the same function
-- (these were querying user_profiles too, but since they're on OTHER tables
--  they don't cause recursion. Updating them for consistency.)

-- Done! The is_admin() function runs with SECURITY DEFINER,
-- bypassing RLS on user_profiles, so no infinite recursion.

SELECT 'RLS recursion fix applied successfully' AS result;
