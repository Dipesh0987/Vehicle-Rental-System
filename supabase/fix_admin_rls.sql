-- ============================================================================
-- QUICK FIX: Resolve 500 errors, empty admin pages, and registration issues
-- Run this ONCE in Supabase SQL Editor → it fixes everything immediately
-- ============================================================================

-- ─── FIX 0: Auto-confirm email + create profile on signup ───

-- Confirm ALL existing unconfirmed users so they can login now
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- BEFORE INSERT trigger: auto-set email_confirmed_at so GoTrue sees it as confirmed
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.email_confirmed_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirm ON auth.users;
CREATE TRIGGER on_auth_user_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email();

-- AFTER INSERT trigger: create user profile with full_name and phone from registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.user_profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── STEP 1: Create the safe admin-check function (SECURITY DEFINER bypasses RLS) ───
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- ─── STEP 2: Fix user_profiles policies (was causing infinite recursion) ───
DROP POLICY IF EXISTS "Admins full access to profiles" ON public.user_profiles;
CREATE POLICY "Admins full access to profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 3: Fix vehicle_bookings policies ───
DROP POLICY IF EXISTS "Admins full access bookings" ON public.vehicle_bookings;
CREATE POLICY "Admins full access bookings" ON public.vehicle_bookings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 4: Fix payments policies ───
DROP POLICY IF EXISTS "Admins full access payments" ON public.payments;
CREATE POLICY "Admins full access payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 5: Fix payment_receipts policies ───
DROP POLICY IF EXISTS "Admins full access receipts" ON public.payment_receipts;
CREATE POLICY "Admins full access receipts" ON public.payment_receipts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 6: Fix notifications policies ───
DROP POLICY IF EXISTS "Admins full access notifications" ON public.notifications;
CREATE POLICY "Admins full access notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 7: Fix refunds policies ───
DROP POLICY IF EXISTS "Admins manage all refunds" ON public.refunds;
CREATE POLICY "Admins manage all refunds" ON public.refunds
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 8: Create missing profiles for ALL auth users ───
-- This ensures every auth.users row has a corresponding user_profiles row
INSERT INTO public.user_profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  'customer'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ─── STEP 9: SET admin@selfcarrental.com AS SUPER ADMIN ───
UPDATE public.user_profiles
SET role = 'super_admin', full_name = 'Super Admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@selfcarrental.com');

-- Also set first user as super_admin (fallback)
UPDATE public.user_profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'super_admin');

-- Verify it worked:
SELECT id, email, full_name, role FROM public.user_profiles
WHERE role IN ('admin', 'super_admin');

-- ============================================================================
-- DONE! Now log out and log back in to admin panel. All pages will show data.
-- ============================================================================
