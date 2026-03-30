-- 002_user_profiles_avatar.sql
-- Purpose: Add avatar storage support for dynamic profile updates.

alter table if exists public.user_profiles
  add column if not exists avatar_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_profiles'
  ) then
    comment on column public.user_profiles.avatar_url is
      'Profile image URL or data URL used by the frontend profile editor.';
  end if;
end;
$$;
