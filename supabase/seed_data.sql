-- ============================================================================
-- SEED DATA: Admin role, Bookings (cash paid/pending), Promo Codes
-- Run AFTER: setup_new_database.sql → setup_storage_and_columns.sql
--            → billing_schema.sql → seed_vehicles.sql
-- ============================================================================

-- ===================== STEP 1: SET FIRST USER AS ADMIN =====================
-- THIS IS CRITICAL: Without an admin user, RLS blocks all admin panel queries!
UPDATE public.user_profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  AND role != 'super_admin';

-- ===================== STEP 2: BOOKINGS FOR REGISTERED USERS =====================
DO $$
DECLARE
  u1 uuid; u2 uuid; u3 uuid; u4 uuid;
  v1 uuid; v2 uuid; v3 uuid; v4 uuid; v5 uuid; v6 uuid; v7 uuid; v8 uuid;
  u1_name text; u1_email text; u1_phone text;
  u2_name text; u2_email text; u2_phone text;
  u3_name text; u3_email text; u3_phone text;
  u4_name text; u4_email text; u4_phone text;
BEGIN
  -- Get registered users
  SELECT id INTO u1 FROM auth.users ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO u2 FROM auth.users ORDER BY created_at ASC OFFSET 1 LIMIT 1;
  SELECT id INTO u3 FROM auth.users ORDER BY created_at ASC OFFSET 2 LIMIT 1;
  SELECT id INTO u4 FROM auth.users ORDER BY created_at ASC OFFSET 3 LIMIT 1;
  u2 := COALESCE(u2, u1);
  u3 := COALESCE(u3, u1);
  u4 := COALESCE(u4, u1);

  IF u1 IS NULL THEN
    RAISE NOTICE '⚠ No users in auth.users. Register at least one user first, then re-run.';
    RETURN;
  END IF;

  -- Get existing vehicles (from seed_vehicles.sql)
  SELECT id INTO v1 FROM public.vehicles ORDER BY created_at ASC       LIMIT 1;
  SELECT id INTO v2 FROM public.vehicles ORDER BY created_at ASC OFFSET 1 LIMIT 1;
  SELECT id INTO v3 FROM public.vehicles ORDER BY created_at ASC OFFSET 2 LIMIT 1;
  SELECT id INTO v4 FROM public.vehicles ORDER BY created_at ASC OFFSET 3 LIMIT 1;
  SELECT id INTO v5 FROM public.vehicles ORDER BY created_at ASC OFFSET 4 LIMIT 1;
  SELECT id INTO v6 FROM public.vehicles ORDER BY created_at ASC OFFSET 5 LIMIT 1;
  SELECT id INTO v7 FROM public.vehicles ORDER BY created_at ASC OFFSET 6 LIMIT 1;
  SELECT id INTO v8 FROM public.vehicles ORDER BY created_at ASC OFFSET 7 LIMIT 1;

  IF v1 IS NULL THEN
    RAISE NOTICE '⚠ No vehicles found. Run seed_vehicles.sql first, then re-run this script.';
    RETURN;
  END IF;

  -- Fallback vehicles
  v2 := COALESCE(v2, v1); v3 := COALESCE(v3, v1); v4 := COALESCE(v4, v1);
  v5 := COALESCE(v5, v1); v6 := COALESCE(v6, v1); v7 := COALESCE(v7, v1); v8 := COALESCE(v8, v1);

  -- Fetch user details
  SELECT COALESCE(full_name, email), email, phone INTO u1_name, u1_email, u1_phone FROM public.user_profiles WHERE id = u1;
  SELECT COALESCE(full_name, email), email, phone INTO u2_name, u2_email, u2_phone FROM public.user_profiles WHERE id = u2;
  SELECT COALESCE(full_name, email), email, phone INTO u3_name, u3_email, u3_phone FROM public.user_profiles WHERE id = u3;
  SELECT COALESCE(full_name, email), email, phone INTO u4_name, u4_email, u4_phone FROM public.user_profiles WHERE id = u4;

  -- ── 1: CONFIRMED + FULLY PAID (Cash) ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u1, v1, u1_name, u1_email, u1_phone,
    CURRENT_DATE + 2, CURRENT_DATE + 5, '09:00', 'self_drive', 'confirmed',
    25500, 25500, 25500, 0, 'completed', true,
    'Family trip to Pokhara - paid full cash at office'
  );

  -- ── 2: CONFIRMED + FULLY PAID (Cash) ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u2, v5, u2_name, u2_email, u2_phone,
    CURRENT_DATE + 1, CURRENT_DATE + 3, '10:00', 'self_drive', 'confirmed',
    9000, 9000, 9000, 0, 'completed', true,
    'Business meeting transport - paid cash in advance'
  );

  -- ── 3: CONFIRMED + UNPAID (Will pay cash on pickup) ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u3, v2, u3_name, u3_email, u3_phone,
    CURRENT_DATE + 3, CURRENT_DATE + 6, '08:00', 'self_drive', 'confirmed',
    16500, 16500, 0, 16500, 'unpaid', false,
    'Will pay cash on pickup day'
  );

  -- ── 4: PENDING + UNPAID ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u1, v3, u1_name, u1_email, u1_phone,
    CURRENT_DATE + 7, CURRENT_DATE + 9, '11:00', 'self_drive', 'pending',
    6000, 6000, 0, 6000, 'unpaid', false,
    'Weekend getaway - waiting for confirmation'
  );

  -- ── 5: COMPLETED + PAID (Cash with driver) ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u4, v4, u4_name, u4_email, u4_phone,
    CURRENT_DATE - 5, CURRENT_DATE - 2, '10:00', 'with_driver', 'completed',
    19500, 19500, 19500, 0, 'completed', true,
    'Trip completed with driver - cash paid on return'
  );

  -- ── 6: ACTIVE + PARTIAL CASH PAYMENT ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u2, v6, u2_name, u2_email, u2_phone,
    CURRENT_DATE - 1, CURRENT_DATE + 2, '09:30', 'self_drive', 'active',
    17400, 17400, 10000, 7400, 'partial', false,
    'Paid Rs.10,000 advance cash at pickup, rest on return'
  );

  -- ── 7: CONFIRMED + PAID (Cash) ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u3, v7, u3_name, u3_email, u3_phone,
    CURRENT_DATE + 4, CURRENT_DATE + 6, '07:00', 'self_drive', 'confirmed',
    10000, 10000, 10000, 0, 'completed', true,
    'Full cash paid for EV test drive booking'
  );

  -- ── 8: CANCELLED + UNPAID ──
  INSERT INTO public.vehicle_bookings (
    user_id, vehicle_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, driver_option, status,
    base_amount, total_amount, paid_amount, remaining_amount,
    payment_status, is_paid, notes
  ) VALUES (
    u4, v8, u4_name, u4_email, u4_phone,
    CURRENT_DATE + 10, CURRENT_DATE + 12, '10:00', 'self_drive', 'cancelled',
    19000, 19000, 0, 0, 'unpaid', false,
    'Customer cancelled - travel plans changed'
  );

  RAISE NOTICE '✅ Seed complete! 8 bookings created for users: %, %, %, %', u1, u2, u3, u4;
END;
$$;

-- ===================== STEP 3: DISCOUNT / PROMO CODES =====================
INSERT INTO public.discount_codes (code, discount_percent, valid_from, valid_until, is_active, description, max_uses) VALUES
  ('WELCOME10', 10, CURRENT_DATE, CURRENT_DATE + 90, true, '10% off for new customers', 100),
  ('SUMMER25',  25, CURRENT_DATE, CURRENT_DATE + 60, true, 'Summer special 25% discount', 50),
  ('WEEKEND15', 15, CURRENT_DATE, CURRENT_DATE + 30, true, '15% off weekend bookings', 200)
ON CONFLICT (code) DO NOTHING;

-- ===================== DONE =====================
SELECT 'Seed data loaded! First user set as super_admin. 8 bookings (4 paid, 2 unpaid, 1 partial, 1 cancelled). 3 promo codes.' AS status;
