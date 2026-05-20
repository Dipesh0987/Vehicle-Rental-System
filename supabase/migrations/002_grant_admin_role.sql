-- ============================================================================
-- 002_grant_admin_role.sql
-- Run this in Supabase Dashboard → SQL Editor → New Query → paste → Run
-- Creates admin user: admin@vehicle-rental.local / admin123
-- ============================================================================

-- Enable pgcrypto if not already enabled (needed for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Delete existing admin user if present (clean re-run)
DELETE FROM auth.users WHERE email = 'admin@vehicle-rental.local';

-- Create the admin auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@vehicle-rental.local',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
  '{"full_name": "System Admin"}'::jsonb,
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Create the identity record (required for Supabase auth sign-in)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
  jsonb_build_object(
    'sub', (SELECT id::text FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
    'email', 'admin@vehicle-rental.local',
    'email_verified', true
  ),
  'email',
  (SELECT id::text FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
  NOW(),
  NOW(),
  NOW()
);

-- Create user_profiles row for admin
INSERT INTO public.user_profiles (id, email, full_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@vehicle-rental.local'),
  'admin@vehicle-rental.local',
  'System Admin'
) ON CONFLICT (id) DO NOTHING;

-- Also grant admin role to ANY other existing users (in case you have more)
-- Remove this line if you only want one admin
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'your-other-email@example.com';

-- Verify
SELECT id, email, raw_app_meta_data ->> 'role' AS role FROM auth.users ORDER BY created_at;
