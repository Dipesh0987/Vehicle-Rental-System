-- ============================================================================
-- 003_fix_is_admin_user.sql
-- COMPREHENSIVE FIX — Run in Supabase Dashboard → SQL Editor
-- Fixes is_admin_user() AND rebuilds all admin RLS policies
-- ============================================================================

-- ── 1. Fix is_admin_user() ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claims text;
  _jwt jsonb;
  _app_meta jsonb;
  _role text;
BEGIN
  -- Read JWT claims safely
  _claims := current_setting('request.jwt.claims', true);
  IF _claims IS NULL OR _claims = '' THEN
    RETURN false;
  END IF;

  BEGIN
    _jwt := _claims::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  -- Check 1: service_role
  IF (_jwt ->> 'role') = 'service_role' THEN
    RETURN true;
  END IF;

  -- Check 2: app_metadata.role in JWT
  _app_meta := _jwt -> 'app_metadata';
  IF _app_meta IS NOT NULL THEN
    _role := _app_meta ->> 'role';
    IF _role = 'admin' OR _role = 'super_admin' THEN
      RETURN true;
    END IF;
  END IF;

  -- Check 3: query auth.users table
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


-- ── 2. Fix admin_list_user_profiles RPC ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()
RETURNS SETOF public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Only admin users can list all profiles';
  END IF;
  RETURN QUERY SELECT * FROM public.user_profiles ORDER BY updated_at DESC;
END;
$$;


-- ── 3. Drop ALL existing admin policies and recreate them ───────────────────
-- Using inline check as BACKUP so if is_admin_user() fails, the inline
-- check still works.

-- Helper: inline admin check expression used in policies
-- (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

-- ─── user_profiles ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.user_profiles;
CREATE POLICY "Admin reads all profiles" ON public.user_profiles
  FOR SELECT USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin updates all profiles" ON public.user_profiles;
CREATE POLICY "Admin updates all profiles" ON public.user_profiles
  FOR UPDATE USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── vehicle_bookings ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all bookings" ON public.vehicle_bookings;
CREATE POLICY "Admin reads all bookings" ON public.vehicle_bookings
  FOR SELECT USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin updates all bookings" ON public.vehicle_bookings;
CREATE POLICY "Admin updates all bookings" ON public.vehicle_bookings
  FOR UPDATE USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── payments ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all payments" ON public.payments;
CREATE POLICY "Admin reads all payments" ON public.payments
  FOR SELECT USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin updates all payments" ON public.payments;
CREATE POLICY "Admin updates all payments" ON public.payments
  FOR UPDATE USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── payment_receipts ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all receipts" ON public.payment_receipts;
CREATE POLICY "Admin reads all receipts" ON public.payment_receipts
  FOR SELECT USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── maintenance_records ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all maintenance" ON public.maintenance_records;
CREATE POLICY "Admin reads all maintenance" ON public.maintenance_records
  FOR SELECT USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin manages maintenance" ON public.maintenance_records;
CREATE POLICY "Admin manages maintenance" ON public.maintenance_records
  FOR ALL USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── discount_codes ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manages discount codes" ON public.discount_codes;
CREATE POLICY "Admin manages discount codes" ON public.discount_codes
  FOR ALL USING (
    public.is_admin_user()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );


-- ── 4. Ensure admin user has the role set ───────────────────────────────────

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'admin@vehicle-rental.local'
  AND (raw_app_meta_data ->> 'role') IS DISTINCT FROM 'admin';


-- ── 5. Verify ───────────────────────────────────────────────────────────────

SELECT email, raw_app_meta_data ->> 'role' AS admin_role
FROM auth.users
WHERE email = 'admin@vehicle-rental.local';
