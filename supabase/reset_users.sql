-- Reset all users and create only the admin account
-- Run this in Supabase SQL Editor

-- 1. Delete all dependent tables first
DELETE FROM public.user_profiles;
DO $$ BEGIN DELETE FROM public.profiles; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM public.notifications; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM public.payments; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM public.vehicle_bookings; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2. Drop any remaining FK constraints referencing auth.users, then delete
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_schema, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_schema = 'auth' AND ccu.table_name = 'users' AND tc.constraint_type = 'FOREIGN KEY'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- 3. Delete all auth users
DELETE FROM auth.users;

-- 3. Create admin user with email: admin@selfcarrental.com, password: admin123
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@selfcarrental.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin"}',
  'authenticated',
  'authenticated',
  NOW(),
  NOW(),
  '',
  ''
);

-- 4. Create or update admin profile in user_profiles
INSERT INTO public.user_profiles (id, full_name, email, role, verification_status)
SELECT id, 'Admin', 'admin@selfcarrental.com', 'admin', 'approved'
FROM auth.users WHERE email = 'admin@selfcarrental.com'
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Admin',
  email = 'admin@selfcarrental.com',
  role = 'admin',
  verification_status = 'approved';
