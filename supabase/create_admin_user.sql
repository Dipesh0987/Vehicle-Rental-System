-- ============================================================================
-- CREATE SUPER ADMIN USER
-- Username: admin (email: admin@selfcarrental.com)
-- Password: admin123
-- Run this in Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Check if admin already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@selfcarrental.com';

  IF new_user_id IS NOT NULL THEN
    -- Update password and ensure confirmed
    UPDATE auth.users SET
      encrypted_password = crypt('admin123', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = new_user_id;
    RAISE NOTICE 'Admin user already exists (id=%), updated password.', new_user_id;
  ELSE
    -- Create new admin user
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'admin@selfcarrental.com',
      crypt('admin123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin"}',
      NOW(), NOW(),
      '', '', '', ''
    );

    -- Create identity record (required for login to work)
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      new_user_id,
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', 'admin@selfcarrental.com'),
      'email',
      new_user_id::text,
      NOW(), NOW(), NOW()
    );

    RAISE NOTICE 'Admin user created with id=%', new_user_id;
  END IF;

  -- Create or update profile with super_admin role
  INSERT INTO public.user_profiles (id, email, full_name, phone, role, created_at, updated_at)
  VALUES (new_user_id, 'admin@selfcarrental.com', 'Super Admin', '9800000000', 'super_admin', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', full_name = 'Super Admin';

END;
$$;

-- Verify:
SELECT u.id, u.email, p.full_name, p.role
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE u.email = 'admin@selfcarrental.com';

-- ============================================================================
-- DONE! Login with:
--   Username: admin
--   Password: admin123
-- at /admin/login
-- ============================================================================
