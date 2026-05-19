-- ============================================================================
-- FULL_SETUP.sql — ONE-SHOT complete database setup
-- Copy ALL of this → Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================================

-- ── pgcrypto extension ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── is_admin_user() function ────────────────────────────────────────────────
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
BEGIN
  _claims := current_setting('request.jwt.claims', true);
  IF _claims IS NULL OR _claims = '' THEN RETURN false; END IF;
  BEGIN _jwt := _claims::jsonb; EXCEPTION WHEN OTHERS THEN RETURN false; END;
  IF (_jwt ->> 'role') = 'service_role' THEN RETURN true; END IF;
  _app_meta := _jwt -> 'app_metadata';
  IF _app_meta IS NOT NULL AND ((_app_meta ->> 'role') = 'admin' OR (_app_meta ->> 'role') = 'super_admin') THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data ->> 'role' = 'admin');
  END IF;
  RETURN false;
END;
$$;

-- ── user_profiles table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text, full_name text, avatar_url text, phone_number text,
  gender text, date_of_birth text, address_line text, city text,
  country text DEFAULT 'Nepal', postal_code text,
  document_type text, document_number text, document_image_url text,
  document_expiry_date text,
  verification_status text DEFAULT 'not_submitted',
  verification_submitted_at timestamptz, verification_reviewed_at timestamptz,
  verification_reviewed_by uuid, verification_note text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ── vehicle_bookings table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text UNIQUE, customer_name text, customer_email text,
  customer_phone text, customer_user_id uuid REFERENCES auth.users(id),
  vehicle_id text, vehicle_name text, vehicle_type text,
  pickup_location text, start_date timestamptz, end_date timestamptz,
  pickup_time text, driver_option text DEFAULT 'Self Drive', user_message text,
  total_amount numeric DEFAULT 0, paid_amount numeric DEFAULT 0,
  remaining_amount numeric DEFAULT 0, payment_status text DEFAULT 'unpaid',
  status text DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.vehicle_bookings ENABLE ROW LEVEL SECURITY;

-- ── payments table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code text UNIQUE, booking_id uuid REFERENCES public.vehicle_bookings(id),
  customer_user_id uuid REFERENCES auth.users(id),
  customer_email text, customer_name text,
  payment_method text DEFAULT 'esewa', payment_type text DEFAULT 'full',
  amount numeric DEFAULT 0, total_booking_amount numeric DEFAULT 0,
  currency text DEFAULT 'NPR', status text DEFAULT 'initiated',
  failure_reason text, provider_reference text, provider_transaction_id text,
  khalti_pidx text, khalti_transaction_id text, khalti_payment_url text,
  initiated_at timestamptz DEFAULT now(), expires_at timestamptz, paid_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ── payment_receipts table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code text UNIQUE, payment_id uuid REFERENCES public.payments(id),
  booking_id uuid REFERENCES public.vehicle_bookings(id),
  customer_user_id uuid REFERENCES auth.users(id),
  email_to text, email_status text DEFAULT 'pending',
  email_sent_at timestamptz, email_error text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- ── maintenance_records table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id text UNIQUE DEFAULT ('MNT-' || substr(gen_random_uuid()::text, 1, 8)),
  vehicle_name text, vehicle_id text,
  schedule_date timestamptz DEFAULT now(), service_type text DEFAULT 'Routine',
  description text, status text DEFAULT 'Scheduled',
  cost_estimate numeric DEFAULT 0, technician text, reported_by text,
  completed_at timestamptz, notes text,
  customer_name text, customer_email text, customer_user_id uuid,
  linked_booking_id uuid, booking_ref text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- ── discount_codes table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, description text,
  discount_type text DEFAULT 'percentage', discount_value numeric DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz DEFAULT (now() + interval '30 days'),
  max_uses integer, current_uses integer DEFAULT 0,
  min_booking_amount numeric, max_discount_amount numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — drop all old, create fresh with dual admin check
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── user_profiles ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin updates all profiles" ON public.user_profiles;

CREATE POLICY "Users read own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin reads all profiles" ON public.user_profiles FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);
CREATE POLICY "Admin updates all profiles" ON public.user_profiles FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);

-- ─── vehicle_bookings ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own bookings" ON public.vehicle_bookings;
DROP POLICY IF EXISTS "Users insert own bookings" ON public.vehicle_bookings;
DROP POLICY IF EXISTS "Admin reads all bookings" ON public.vehicle_bookings;
DROP POLICY IF EXISTS "Admin updates all bookings" ON public.vehicle_bookings;

CREATE POLICY "Users read own bookings" ON public.vehicle_bookings FOR SELECT USING (auth.uid() = customer_user_id);
CREATE POLICY "Users insert own bookings" ON public.vehicle_bookings FOR INSERT WITH CHECK (auth.uid() = customer_user_id);
CREATE POLICY "Admin reads all bookings" ON public.vehicle_bookings FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);
CREATE POLICY "Admin updates all bookings" ON public.vehicle_bookings FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);

-- ─── payments ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
DROP POLICY IF EXISTS "Admin reads all payments" ON public.payments;
DROP POLICY IF EXISTS "Admin updates all payments" ON public.payments;

CREATE POLICY "Users read own payments" ON public.payments FOR SELECT USING (auth.uid() = customer_user_id);
CREATE POLICY "Admin reads all payments" ON public.payments FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);
CREATE POLICY "Admin updates all payments" ON public.payments FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);

-- ─── payment_receipts ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Admin reads all receipts" ON public.payment_receipts;

CREATE POLICY "Users read own receipts" ON public.payment_receipts FOR SELECT USING (auth.uid() = customer_user_id);
CREATE POLICY "Admin reads all receipts" ON public.payment_receipts FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);

-- ─── maintenance_records ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all maintenance" ON public.maintenance_records;
DROP POLICY IF EXISTS "Admin manages maintenance" ON public.maintenance_records;

CREATE POLICY "Admin manages maintenance" ON public.maintenance_records FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);

-- ─── discount_codes ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manages discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Public reads active discounts" ON public.discount_codes;

CREATE POLICY "Admin manages discount codes" ON public.discount_codes FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR public.is_admin_user()
);
CREATE POLICY "Public reads active discounts" ON public.discount_codes FOR SELECT USING (
  is_active = true AND now() BETWEEN valid_from AND valid_until
);


-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN RPC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()
RETURNS SETOF public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Only admin users can list all profiles';
  END IF;
  RETURN QUERY SELECT * FROM public.user_profiles ORDER BY updated_at DESC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN USER SETUP
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove old admin user if exists (clean slate)
DELETE FROM auth.identities WHERE provider_id IN (
  SELECT id::text FROM auth.users WHERE email = 'admin@vehicle-rental.local'
);
DELETE FROM auth.users WHERE email = 'admin@vehicle-rental.local';

-- Create admin auth user (admin / admin123)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
  'authenticated', 'authenticated', 'admin@vehicle-rental.local',
  crypt('admin123', gen_salt('bf')), NOW(),
  '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  '{"full_name":"System Admin"}'::jsonb,
  NOW(), NOW(), '', '', '', ''
);

-- Create identity (required for sign-in)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
  jsonb_build_object('sub', (SELECT id::text FROM auth.users WHERE email = 'admin@vehicle-rental.local'), 'email', 'admin@vehicle-rental.local', 'email_verified', true),
  'email',
  (SELECT id::text FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
  NOW(), NOW(), NOW()
);

-- Create admin profile
INSERT INTO public.user_profiles (id, email, full_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
  'admin@vehicle-rental.local', 'System Admin'
) ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-PROFILE TRIGGER + BACKFILL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any auth users missing a profile row
INSERT INTO public.user_profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='vehicle_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='maintenance_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_records;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '✅ Admin user created' AS status, email, raw_app_meta_data ->> 'role' AS role
FROM auth.users WHERE email = 'admin@vehicle-rental.local';

SELECT '✅ Total profiles' AS status, count(*) AS count FROM public.user_profiles;
