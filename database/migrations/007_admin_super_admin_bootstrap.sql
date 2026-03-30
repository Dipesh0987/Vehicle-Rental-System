-- 007_admin_super_admin_bootstrap.sql
-- Purpose: Bootstrap default admin credentials and bind the user as super_admin.
-- Default login after running this migration:
--   username: admin
--   password: admin123

create extension if not exists pgcrypto;

do $$
declare
  bootstrap_username text := 'admin';
  bootstrap_email text := 'admin@vehicle-rental.local';
  bootstrap_password text := 'admin123';
  bootstrap_user_id uuid;
begin
  select u.id
  into bootstrap_user_id
  from auth.users u
  where lower(u.email) = lower(bootstrap_email)
  limit 1;

  if bootstrap_user_id is null then
    bootstrap_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      bootstrap_user_id,
      'authenticated',
      'authenticated',
      bootstrap_email,
      crypt(bootstrap_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', 'Platform Super Admin', 'display_name', 'Admin', 'username', bootstrap_username),
      now(),
      now()
    );
  else
    update auth.users
    set
      encrypted_password = crypt(bootstrap_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Platform Super Admin', 'display_name', 'Admin', 'username', bootstrap_username),
      updated_at = now()
    where id = bootstrap_user_id;
  end if;

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    bootstrap_user_id,
    bootstrap_email,
    jsonb_build_object(
      'sub', bootstrap_user_id::text,
      'email', bootstrap_email,
      'email_verified', true,
      'username', bootstrap_username
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update
  set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = excluded.updated_at;

  if to_regclass('public.admin_users') is not null then
    insert into public.admin_users (user_id, role, is_active)
    values (bootstrap_user_id, 'super_admin', true)
    on conflict (user_id) do update
    set
      role = 'super_admin',
      is_active = true;
  end if;

  if to_regclass('public.user_profiles') is not null then
    insert into public.user_profiles (id, email, full_name)
    values (bootstrap_user_id, bootstrap_email, 'Platform Super Admin')
    on conflict (id) do update
    set
      email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now();
  end if;
end;
$$;
