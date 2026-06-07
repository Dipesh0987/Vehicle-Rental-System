-- ============================================================================
-- COMPLETE DATABASE SETUP for Self-Car-Rental
-- Run this entire script in your NEW Supabase project's SQL Editor
-- (Supabase Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================================================

-- ===================== 0. CLEAN SLATE =====================
-- Drop everything in reverse dependency order so we can re-run safely.
-- Drop "bookings" as VIEW first (covers case where it's a view), then as TABLE.
DROP VIEW  IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
-- Drop billing tables if they exist from a previous run
DROP TABLE IF EXISTS public.billing_settings CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.vehicle_finances CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.billing_payments CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.refunds CASCADE;
DROP TABLE IF EXISTS public.payment_receipts CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.maintenance_records CASCADE;
DROP TABLE IF EXISTS public.vehicle_images CASCADE;
DROP TABLE IF EXISTS public.vehicle_bookings CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.contact_messages CASCADE;
DROP TABLE IF EXISTS public.discount_codes CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.booking_code_seq;
DROP SEQUENCE IF EXISTS public.refund_code_seq;
DROP SEQUENCE IF EXISTS public.driver_id_seq;

-- ===================== 1. USER PROFILES =====================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                text,
  email                    text,
  phone                    text,
  avatar_url               text,
  date_of_birth            date,
  gender                   text CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  address                  text,
  city                     text,
  state                    text,
  zip_code                 text,
  country                  text DEFAULT 'Nepal',
  role                     text DEFAULT 'customer' CHECK (role IN ('customer','admin','super_admin','manager','staff','driver')),

  -- Verification fields
  verification_status      text DEFAULT 'not_submitted' CHECK (verification_status IN ('not_submitted','pending','approved','rejected')),
  document_type            text CHECK (document_type IN ('driving_license','national_id','passport','other')),
  document_front_url       text,
  document_back_url        text,
  verification_submitted_at timestamptz,
  verification_reviewed_at  timestamptz,
  verification_notes       text,

  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper: Admin check using SECURITY DEFINER to bypass RLS (avoids infinite recursion)
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

CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins full access to profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Auto-confirm email on signup (BEFORE INSERT sets email_confirmed_at)
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

-- Auto-create profile on signup (AFTER INSERT creates user_profiles row)
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

-- ===================== 2. VEHICLES =====================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  brand             text,
  model             text,
  type              text,
  category          text DEFAULT 'SUV',
  transmission      text DEFAULT 'Automatic',
  fuel_type         text DEFAULT 'Petrol',
  seats             integer DEFAULT 5,
  price_per_day     numeric(10,2) DEFAULT 0,
  rating            numeric(3,2) DEFAULT 0,
  location          text,
  status            text DEFAULT 'available' CHECK (status IN ('available','unavailable','maintenance','inactive')),
  available         boolean DEFAULT true,
  is_active         boolean DEFAULT true,
  features          jsonb DEFAULT '[]'::jsonb,
  primary_image_url text,
  image_url         text,
  image_urls        jsonb DEFAULT '[]'::jsonb,
  vehicle_number    text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicles are publicly readable" ON public.vehicles
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage vehicles" ON public.vehicles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================== 3. VEHICLE IMAGES =====================
CREATE TABLE IF NOT EXISTS public.vehicle_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  url         text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON public.vehicle_images(vehicle_id, sort_order);

ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_images_public_read" ON public.vehicle_images
  FOR SELECT USING (true);

CREATE POLICY "vehicle_images_auth_write" ON public.vehicle_images
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================== 4. BOOKINGS (vehicle_bookings) =====================
-- Main table is "vehicle_bookings", but we also create a "bookings" alias table
-- Both the original frontend (uses vehicle_bookings) and React frontend (uses bookings) need to work.

CREATE TABLE IF NOT EXISTS public.vehicle_bookings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code       text UNIQUE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id         uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  customer_name      text,
  customer_email     text,
  customer_phone     text,
  notes              text,
  start_date         date NOT NULL,
  end_date           date NOT NULL,
  pickup_time        text DEFAULT '10:00',
  driver_option      text DEFAULT 'self_drive',
  status             text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','active','completed','cancelled')),

  -- Financial
  currency           text DEFAULT 'NPR',
  base_amount        numeric(12,2) DEFAULT 0,
  service_fee        numeric(12,2) DEFAULT 0,
  tax_amount         numeric(12,2) DEFAULT 0,
  discount_amount    numeric(12,2) DEFAULT 0,
  total_amount       numeric(12,2) DEFAULT 0,
  paid_amount        numeric(12,2) DEFAULT 0,
  remaining_amount   numeric(12,2) DEFAULT 0,
  payment_status     text DEFAULT 'unpaid',
  payment_deadline   timestamptz,
  is_paid            boolean DEFAULT false,

  coupon_code        text,
  discount_percent   numeric(5,2) DEFAULT 0,

  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Generate booking codes (VB-0001, VB-0002, …)
CREATE SEQUENCE IF NOT EXISTS public.booking_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_booking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.booking_code IS NULL OR NEW.booking_code = '' THEN
    NEW.booking_code := 'VB-' || LPAD(nextval('public.booking_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_booking_code ON public.vehicle_bookings;
CREATE TRIGGER trg_generate_booking_code
  BEFORE INSERT ON public.vehicle_bookings
  FOR EACH ROW EXECUTE FUNCTION public.generate_booking_code();

ALTER TABLE public.vehicle_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookings" ON public.vehicle_bookings
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = customer_user_id);

CREATE POLICY "Users can create bookings" ON public.vehicle_bookings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own bookings" ON public.vehicle_bookings
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = customer_user_id);

CREATE POLICY "Admins full access bookings" ON public.vehicle_bookings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- "bookings" is an updatable VIEW pointing to vehicle_bookings.
-- (Pre-existing bookings table/view already dropped in section 0)
CREATE VIEW public.bookings AS
  SELECT * FROM public.vehicle_bookings;

-- Grant permissions so PostgREST can route DML through the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT SELECT ON public.bookings TO anon;

-- ===================== 5. PAYMENTS =====================
CREATE TABLE IF NOT EXISTS public.payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code      text,
  booking_id            uuid REFERENCES public.vehicle_bookings(id) ON DELETE SET NULL,
  customer_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email        text,
  customer_name         text,
  payment_method        text DEFAULT 'esewa',
  payment_type          text,
  amount                numeric(12,2) NOT NULL DEFAULT 0,
  total_booking_amount  numeric(12,2) DEFAULT 0,
  currency              text DEFAULT 'NPR',
  status                text DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  failure_reason        text,

  -- eSewa fields
  esewa_transaction_uuid text,
  esewa_product_code     text,
  esewa_signed_fields    text,
  esewa_signature        text,

  -- Khalti fields
  khalti_pidx            text,
  khalti_transaction_id  text,

  method                 text,

  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = customer_user_id);

CREATE POLICY "Authenticated can create payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins full access payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===================== 6. PAYMENT RECEIPTS =====================
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code    text,
  payment_id      uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  booking_id      uuid REFERENCES public.vehicle_bookings(id) ON DELETE SET NULL,
  customer_user_id uuid,
  email_to        text,
  email_status    text DEFAULT 'pending',
  email_sent_at   timestamptz,
  email_error     text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own receipts" ON public.payment_receipts
  FOR SELECT USING (auth.uid() = customer_user_id);

CREATE POLICY "Admins full access receipts" ON public.payment_receipts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===================== 7. DRIVERS =====================
CREATE TABLE IF NOT EXISTS public.drivers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       text UNIQUE,
  full_name       text NOT NULL,
  email           text,
  phone           text,
  license_number  text,
  license_expiry  date,
  availability    text DEFAULT 'Available' CHECK (availability IN ('Available','On Trip','Off Duty','Suspended')),
  vehicle_assigned text,
  rating          numeric(3,2) DEFAULT 0,
  total_trips     integer DEFAULT 0,
  notes           text,
  onboarded_at    timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Generate driver IDs (DRV-001, DRV-002, …)
CREATE SEQUENCE IF NOT EXISTS public.driver_id_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_driver_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.driver_id IS NULL OR NEW.driver_id = '' THEN
    NEW.driver_id := 'DRV-' || LPAD(nextval('public.driver_id_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_driver_id ON public.drivers;
CREATE TRIGGER trg_generate_driver_id
  BEFORE INSERT ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.generate_driver_id();

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers public read" ON public.drivers
  FOR SELECT USING (true);

CREATE POLICY "Admins manage drivers" ON public.drivers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================== 8. CONTACT MESSAGES =====================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  subject    text,
  message    text NOT NULL,
  status     text DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact messages" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read contact messages" ON public.contact_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================== 9. NOTIFICATIONS =====================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text,
  title      text,
  body       text,
  message    text,
  link_url   text,
  metadata   jsonb,
  is_admin   boolean DEFAULT false,
  read       boolean DEFAULT false,
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins full access notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Mark notifications read function
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = now()
  WHERE id = ANY(p_notification_ids)
    AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = now()
  WHERE user_id = p_user_id AND read = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO authenticated;

-- ===================== 10. DISCOUNT CODES =====================
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  discount_type   text DEFAULT 'percentage',
  max_uses        integer DEFAULT 100,
  used_count      integer DEFAULT 0,
  valid_from      date,
  valid_until     date,
  is_active       boolean DEFAULT true,
  description     text,
  min_booking_days integer DEFAULT 1,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discount codes public read" ON public.discount_codes
  FOR SELECT USING (true);

CREATE POLICY "Admins manage discount codes" ON public.discount_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Validate discount code function
CREATE OR REPLACE FUNCTION public.validate_discount_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code RECORD;
BEGIN
  SELECT * INTO v_code FROM public.discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Code not found or expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_code.code,
    'discount_percent', v_code.discount_percent,
    'discount_type', v_code.discount_type,
    'description', v_code.description
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text) TO anon;

-- ===================== 11. MAINTENANCE RECORDS =====================
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id     text,
  vehicle_name       text,
  vehicle_id         uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  schedule_date      date,
  service_type       text DEFAULT 'Damage'
    CHECK (service_type IN ('Damage','Scheduled Service','Inspection','Repair')),
  description        text NOT NULL,
  status             text DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled','In Progress','Completed','Cancelled','Billed')),
  cost_estimate      numeric(12,2),
  technician         text,
  reported_by        text,
  completed_at       date,
  notes              text,
  customer_name      text,
  customer_email     text,
  customer_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_booking_id  uuid,
  booking_ref        text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON public.maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_records(status);

CREATE OR REPLACE FUNCTION public.set_maintenance_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_updated_at ON public.maintenance_records;
CREATE TRIGGER trg_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_maintenance_updated_at();

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_maintenance" ON public.maintenance_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================== 12. REFUNDS =====================
CREATE TABLE IF NOT EXISTS public.refunds (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  refund_code           text UNIQUE,
  booking_id            uuid REFERENCES public.vehicle_bookings(id) ON DELETE CASCADE,
  payment_id            uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  transaction_code      text,
  customer_user_id      uuid,
  user_id               uuid,
  customer_email        text,
  customer_name         text,
  original_paid_amount  numeric DEFAULT 0,
  refund_amount         numeric DEFAULT 0,
  refund_percentage     numeric DEFAULT 0,
  policy_rule           text DEFAULT 'manual',
  pickup_date           timestamptz,
  cancelled_at          timestamptz,
  hours_before_pickup   numeric DEFAULT 0,
  refund_method         text DEFAULT 'original',
  refund_reference      text,
  status                text DEFAULT 'requested' CHECK (status IN ('requested','initiated','approved','processing','completed','failed','rejected')),
  reason                text,
  status_history        jsonb DEFAULT '[]'::jsonb,
  initiated_by          uuid,
  approved_by           uuid,
  notes                 text,
  rejection_reason      text,
  email_sent            boolean DEFAULT false,
  email_sent_at         timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

CREATE SEQUENCE IF NOT EXISTS public.refund_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_refund_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.refund_code IS NULL OR NEW.refund_code = '' THEN
    NEW.refund_code := 'R-' || LPAD(nextval('public.refund_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_refund_code ON public.refunds;
CREATE TRIGGER trg_generate_refund_code
  BEFORE INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.generate_refund_code();

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own refunds" ON public.refunds
  FOR SELECT USING (customer_user_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Users can request refunds" ON public.refunds
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins manage all refunds" ON public.refunds
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Refund eligibility calculator
CREATE OR REPLACE FUNCTION public.calculate_refund_eligibility(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
  v_paid numeric;
  v_hours numeric;
  v_rule text;
  v_percentage numeric;
  v_refund_amt numeric;
BEGIN
  SELECT * INTO v_booking FROM public.vehicle_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Booking not found'); END IF;
  IF v_booking.status != 'cancelled' THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Booking is not cancelled'); END IF;
  v_paid := COALESCE(v_booking.paid_amount, 0);
  IF v_paid <= 0 THEN RETURN jsonb_build_object('eligible', false, 'reason', 'No payment was made'); END IF;
  IF EXISTS (SELECT 1 FROM public.refunds WHERE booking_id = p_booking_id AND status NOT IN ('rejected', 'failed')) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'A refund is already in progress');
  END IF;
  v_hours := EXTRACT(EPOCH FROM (v_booking.start_date::timestamptz - COALESCE(v_booking.updated_at, now()))) / 3600;
  IF v_hours > 24 THEN v_rule := 'full_refund'; v_percentage := 100;
  ELSIF v_hours >= 2 THEN v_rule := 'partial_refund_50'; v_percentage := 50;
  ELSE v_rule := 'no_refund'; v_percentage := 0;
  END IF;
  v_refund_amt := ROUND(v_paid * (v_percentage / 100.0), 2);
  RETURN jsonb_build_object(
    'eligible', v_percentage > 0, 'rule', v_rule, 'percentage', v_percentage,
    'original_paid', v_paid, 'refund_amount', v_refund_amt,
    'hours_before_pickup', ROUND(v_hours, 1), 'reason',
    CASE WHEN v_percentage = 100 THEN 'Full refund' WHEN v_percentage = 50 THEN 'Partial refund (50%)' ELSE 'No refund' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_refund_eligibility(uuid) TO authenticated;

-- ===================== 13. REALTIME =====================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_records;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===================== 14. STORAGE BUCKETS =====================
-- Create these via Supabase Dashboard → Storage → New Bucket:
-- 1. "profile-images" (Public)
-- 2. "vehicle-images" (Public)

-- ============================================================================
-- SETUP COMPLETE! Now run seed_vehicles.sql to populate vehicles.
-- ============================================================================
SELECT 'Database schema created successfully!' AS status;
