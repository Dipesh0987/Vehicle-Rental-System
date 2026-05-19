-- ============================================================================
-- 003_fix_is_admin_user.sql
-- Run this in Supabase Dashboard → SQL Editor → New Query → paste → Run
-- Fixes is_admin_user() to also check JWT app_metadata claim directly
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims jsonb;
  jwt_role text;
  jwt_app_meta jsonb;
  app_role text;
BEGIN
  -- Get JWT claims
  jwt_claims := coalesce(
    current_setting('request.jwt.claims', true)::jsonb,
    '{}'::jsonb
  );

  -- Check 1: service_role JWT (Edge Functions, server-side calls)
  jwt_role := jwt_claims ->> 'role';
  IF jwt_role = 'service_role' THEN
    RETURN true;
  END IF;

  -- Check 2: app_metadata.role in the JWT itself (fastest, no DB query)
  jwt_app_meta := jwt_claims -> 'app_metadata';
  IF jwt_app_meta IS NOT NULL THEN
    app_role := jwt_app_meta ->> 'role';
    IF app_role = 'admin' OR app_role = 'super_admin' THEN
      RETURN true;
    END IF;
  END IF;

  -- Check 3: Fallback — query auth.users table directly
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data ->> 'role' = 'admin'
    );
  END IF;

  RETURN false;
END;
$$;

-- Verify: this should return true when called by the admin user
-- SELECT public.is_admin_user();
