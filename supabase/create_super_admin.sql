-- =====================================================================
-- Create Super Admin for ASSelf Drive
-- Username: rsselfdrive (login email: rsselfdrive@selfcarrental.com)
-- Password: selfdrive32@#
-- 
-- Run this in Supabase SQL Editor
-- =====================================================================

-- Step 1: Remove any existing super_admin users
DO $$
DECLARE
  old_admin_id uuid;
BEGIN
  -- Find and remove old super_admin from user_profiles
  FOR old_admin_id IN 
    SELECT id FROM public.user_profiles WHERE role = 'super_admin'
  LOOP
    -- Delete from user_profiles
    DELETE FROM public.user_profiles WHERE id = old_admin_id;
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = old_admin_id;
  END LOOP;
END $$;

-- Step 2: Create the new super admin user
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  login_email text := 'rsselfdrive@selfcarrental.com';
  raw_password text := 'selfdrive32@#';
BEGIN
  -- Check no super_admin exists already
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'A super_admin already exists. Only one is allowed.';
  END IF;

  -- Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    login_email,
    crypt(raw_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'RS Self Drive', 'role', 'super_admin'),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Insert identity for email login
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', login_email),
    'email',
    login_email,
    now(),
    now(),
    now()
  );

  -- Insert into user_profiles
  INSERT INTO public.user_profiles (id, email, full_name, role, created_at)
  VALUES (new_user_id, login_email, 'RS Self Drive', 'super_admin', now());

  RAISE NOTICE 'Super Admin created successfully!';
  RAISE NOTICE 'Login: rsselfdrive (email: rsselfdrive@selfcarrental.com)';
  RAISE NOTICE 'Password: selfdrive32@#';
END $$;

-- Step 3: Add a constraint to ensure only ONE super_admin can ever exist
-- (This uses a partial unique index — PostgreSQL enforces max 1 row with role='super_admin')
DROP INDEX IF EXISTS idx_only_one_super_admin;
CREATE UNIQUE INDEX idx_only_one_super_admin ON public.user_profiles ((true)) WHERE role = 'super_admin';
