-- ============================================================================
-- 001_admin_schema_setup.sql
-- Run this in your Supabase Dashboard → SQL Editor → New Query → paste → Run
-- Safe to re-run (all statements use IF NOT EXISTS / OR REPLACE).
-- ============================================================================

-- ── 1. is_admin_user() helper ───────────────────────────────────────────────
-- Returns true when the caller has service_role JWT OR their auth.users row
-- has raw_app_meta_data->>'role' = 'admin'.
-- IMPORTANT: In Supabase Dashboard → Authentication → Users → click your
-- admin user → "Edit user" → set app_metadata to: {"role":"admin"}
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_app_meta_data ->> 'role' = 'admin'
  );
END;
$$;


-- ── 2. user_profiles table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  full_name   text,
  avatar_url  text,
  phone_number text,
  gender      text,
  date_of_birth text,
  address_line text,
  city        text,
  country     text DEFAULT 'Nepal',
  postal_code text,
  document_type text,
  document_number text,
  document_image_url text,
  document_expiry_date text,
  verification_status text DEFAULT 'not_submitted',
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_reviewed_by uuid,
  verification_note text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users read/update own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users read own profile'
  ) THEN
    CREATE POLICY "Users read own profile" ON public.user_profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile" ON public.user_profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users insert own profile'
  ) THEN
    CREATE POLICY "Users insert own profile" ON public.user_profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Admin reads ALL profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Admin reads all profiles'
  ) THEN
    CREATE POLICY "Admin reads all profiles" ON public.user_profiles
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;

-- Admin updates ALL profiles (for verification workflow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Admin updates all profiles'
  ) THEN
    CREATE POLICY "Admin updates all profiles" ON public.user_profiles
      FOR UPDATE USING (public.is_admin_user());
  END IF;
END $$;


-- ── 3. admin_list_user_profiles RPC ─────────────────────────────────────────

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

  RETURN QUERY
    SELECT * FROM public.user_profiles
    ORDER BY updated_at DESC;
END;
$$;


-- ── 4. vehicle_bookings table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicle_bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code      text UNIQUE,
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  customer_user_id  uuid REFERENCES auth.users(id),
  vehicle_id        text,
  vehicle_name      text,
  vehicle_type      text,
  pickup_location   text,
  start_date        timestamptz,
  end_date          timestamptz,
  pickup_time       text,
  driver_option     text DEFAULT 'Self Drive',
  user_message      text,
  total_amount      numeric DEFAULT 0,
  paid_amount       numeric DEFAULT 0,
  remaining_amount  numeric DEFAULT 0,
  payment_status    text DEFAULT 'unpaid',
  status            text DEFAULT 'confirmed',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.vehicle_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_bookings' AND policyname = 'Users read own bookings'
  ) THEN
    CREATE POLICY "Users read own bookings" ON public.vehicle_bookings
      FOR SELECT USING (auth.uid() = customer_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_bookings' AND policyname = 'Users insert own bookings'
  ) THEN
    CREATE POLICY "Users insert own bookings" ON public.vehicle_bookings
      FOR INSERT WITH CHECK (auth.uid() = customer_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_bookings' AND policyname = 'Admin reads all bookings'
  ) THEN
    CREATE POLICY "Admin reads all bookings" ON public.vehicle_bookings
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_bookings' AND policyname = 'Admin updates all bookings'
  ) THEN
    CREATE POLICY "Admin updates all bookings" ON public.vehicle_bookings
      FOR UPDATE USING (public.is_admin_user());
  END IF;
END $$;


-- ── 5. payments table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code        text UNIQUE,
  booking_id              uuid REFERENCES public.vehicle_bookings(id),
  customer_user_id        uuid REFERENCES auth.users(id),
  customer_email          text,
  customer_name           text,
  payment_method          text DEFAULT 'esewa',
  payment_type            text DEFAULT 'full',
  amount                  numeric DEFAULT 0,
  total_booking_amount    numeric DEFAULT 0,
  currency                text DEFAULT 'NPR',
  status                  text DEFAULT 'initiated',
  failure_reason          text,
  provider_reference      text,
  provider_transaction_id text,
  khalti_pidx             text,
  khalti_transaction_id   text,
  khalti_payment_url      text,
  initiated_at            timestamptz DEFAULT now(),
  expires_at              timestamptz,
  paid_at                 timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Users read own payments'
  ) THEN
    CREATE POLICY "Users read own payments" ON public.payments
      FOR SELECT USING (auth.uid() = customer_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Admin reads all payments'
  ) THEN
    CREATE POLICY "Admin reads all payments" ON public.payments
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Admin updates all payments'
  ) THEN
    CREATE POLICY "Admin updates all payments" ON public.payments
      FOR UPDATE USING (public.is_admin_user());
  END IF;
END $$;


-- ── 6. payment_receipts table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code      text UNIQUE,
  payment_id        uuid REFERENCES public.payments(id),
  booking_id        uuid REFERENCES public.vehicle_bookings(id),
  customer_user_id  uuid REFERENCES auth.users(id),
  email_to          text,
  email_status      text DEFAULT 'pending',
  email_sent_at     timestamptz,
  email_error       text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_receipts' AND policyname = 'Users read own receipts'
  ) THEN
    CREATE POLICY "Users read own receipts" ON public.payment_receipts
      FOR SELECT USING (auth.uid() = customer_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_receipts' AND policyname = 'Admin reads all receipts'
  ) THEN
    CREATE POLICY "Admin reads all receipts" ON public.payment_receipts
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;


-- ── 7. maintenance_records table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id      text UNIQUE DEFAULT ('MNT-' || substr(gen_random_uuid()::text, 1, 8)),
  vehicle_name        text,
  vehicle_id          text,
  schedule_date       timestamptz DEFAULT now(),
  service_type        text DEFAULT 'Routine',
  description         text,
  status              text DEFAULT 'Scheduled',
  cost_estimate       numeric DEFAULT 0,
  technician          text,
  reported_by         text,
  completed_at        timestamptz,
  notes               text,
  customer_name       text,
  customer_email      text,
  customer_user_id    uuid,
  linked_booking_id   uuid,
  booking_ref         text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_records' AND policyname = 'Admin reads all maintenance'
  ) THEN
    CREATE POLICY "Admin reads all maintenance" ON public.maintenance_records
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_records' AND policyname = 'Admin manages maintenance'
  ) THEN
    CREATE POLICY "Admin manages maintenance" ON public.maintenance_records
      FOR ALL USING (public.is_admin_user());
  END IF;
END $$;


-- ── 8. discount_codes table (pricing & promo) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  description         text,
  discount_type       text DEFAULT 'percentage',
  discount_value      numeric DEFAULT 0,
  valid_from          timestamptz DEFAULT now(),
  valid_until         timestamptz DEFAULT (now() + interval '30 days'),
  max_uses            integer,
  current_uses        integer DEFAULT 0,
  min_booking_amount  numeric,
  max_discount_amount numeric,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'discount_codes' AND policyname = 'Admin manages discount codes'
  ) THEN
    CREATE POLICY "Admin manages discount codes" ON public.discount_codes
      FOR ALL USING (public.is_admin_user());
  END IF;
END $$;

-- Public users can read active discount codes (to validate at checkout)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'discount_codes' AND policyname = 'Public reads active discounts'
  ) THEN
    CREATE POLICY "Public reads active discounts" ON public.discount_codes
      FOR SELECT USING (is_active = true AND now() BETWEEN valid_from AND valid_until);
  END IF;
END $$;


-- ── 9. Realtime: enable publication for admin live-sync ─────────────────────

DO $$
BEGIN
  -- Add tables to supabase_realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'maintenance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_records;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication might not exist or table already added; safe to ignore
  NULL;
END $$;


-- ── 10. Auto-create user_profiles row on sign-up ────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first to make idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 11. Backfill: create profile rows for existing auth users ───────────────

INSERT INTO public.user_profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- DONE. All tables, functions, policies, and triggers are ready.
-- Verify in Supabase Dashboard → Table Editor that the tables appear.
-- ============================================================================
