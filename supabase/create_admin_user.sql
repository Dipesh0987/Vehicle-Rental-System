-- =====================================================================
-- Create a working ADMIN login for ASSelf Car Rental (SQL-only method)
-- Login username: rsrentalservices   (password: admin123)
-- Resolves to email: rsrentalservices@selfcarrental.com
-- Run this WHOLE script in the Supabase SQL Editor.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Clean up any previous broken attempt first
DELETE FROM public.user_profiles WHERE email = 'rsrentalservices@selfcarrental.com';
DELETE FROM auth.identities      WHERE provider_id = 'rsrentalservices@selfcarrental.com';
DELETE FROM auth.users           WHERE email = 'rsrentalservices@selfcarrental.com';

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  user_email  text := 'rsrentalservices@selfcarrental.com';
  user_pass   text := 'admin123';
  full_name   text := 'RS Rental Services';
BEGIN
  -- 1) Create the auth user with ALL required columns populated
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, last_sign_in_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    is_super_admin, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', user_email,
    crypt(user_pass, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', full_name, 'email_verified', true),
    now(), now(), now(),
    '', '', '', '', '', '', '', '',
    false, false, false
  );

  -- 2) Create the email identity (required for email/password login)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id, user_email,
    jsonb_build_object('sub', new_user_id::text, 'email', user_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- 3) Create the profile with the admin role
  INSERT INTO public.user_profiles (id, email, full_name, role, created_at)
  VALUES (new_user_id, user_email, full_name, 'super_admin', now())
  ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin',
        full_name = EXCLUDED.full_name;
END $$;

-- Verify (should return exactly one row):
SELECT u.email, u.email_confirmed_at, p.role
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE u.email = 'rsrentalservices@selfcarrental.com';
