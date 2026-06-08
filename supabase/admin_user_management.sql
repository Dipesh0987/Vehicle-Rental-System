-- =====================================================================
-- Admin user management RPCs for ASSelf Car Rental
-- Lets a SUPER ADMIN change any user's login username (email) and/or
-- password, including their own. Run this in the Supabase SQL Editor.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- admin_update_user_credentials(target_user_id, new_email, new_password)
--   - new_email     : new login email (username@selfcarrental.com). Pass NULL to skip.
--   - new_password  : new password (min 6 chars). Pass NULL to skip.
--   Only callable by a super_admin. SECURITY DEFINER so it can touch auth.*
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
  target_user_id uuid,
  new_email text DEFAULT NULL,
  new_password text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role text;
  clean_email text;
BEGIN
  -- Only a super_admin may run this
  SELECT role INTO caller_role FROM public.user_profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can update user credentials';
  END IF;

  -- Update login email (username)
  IF new_email IS NOT NULL AND length(trim(new_email)) > 0 THEN
    clean_email := lower(trim(new_email));

    -- Reject duplicates
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = clean_email AND id <> target_user_id) THEN
      RAISE EXCEPTION 'That username/email is already taken';
    END IF;

    UPDATE auth.users
       SET email = clean_email,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = target_user_id;

    -- Keep the email identity in sync (login lookups use it)
    UPDATE auth.identities
       SET identity_data = jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(clean_email)),
           provider_id = clean_email,
           updated_at = now()
     WHERE user_id = target_user_id AND provider = 'email';

    UPDATE public.user_profiles SET email = clean_email WHERE id = target_user_id;
  END IF;

  -- Update password
  IF new_password IS NOT NULL AND length(new_password) >= 6 THEN
    UPDATE auth.users
       SET encrypted_password = crypt(new_password, gen_salt('bf')),
           updated_at = now()
     WHERE id = target_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_credentials(uuid, text, text) TO authenticated;
