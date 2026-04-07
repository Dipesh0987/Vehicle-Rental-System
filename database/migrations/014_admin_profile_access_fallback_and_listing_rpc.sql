-- 014_admin_profile_access_fallback_and_listing_rpc.sql
-- Purpose: Keep admin profile listing working for bootstrap admin emails and
-- expose a safe RPC for reading user profiles in admin tools.

create or replace function public.is_admin_user(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.admin_users admin
      where admin.user_id = coalesce(check_user, auth.uid())
        and admin.is_active = true
    )
    or (
      coalesce(check_user, auth.uid()) = auth.uid()
      and lower(coalesce(auth.jwt() ->> 'email', '')) in (
        'admin.bootstrap@vehicle-rental.local',
        'admin@vehicle-rental.local'
      )
    );
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to anon, authenticated, service_role;

create or replace function public.admin_list_user_profiles()
returns setof public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admin users can list user profiles.';
  end if;

  return query
  select up.*
  from public.user_profiles up
  order by up.updated_at desc nulls last, up.created_at desc nulls last;
end;
$$;

grant execute on function public.admin_list_user_profiles() to authenticated, service_role;

notify pgrst, 'reload schema';
