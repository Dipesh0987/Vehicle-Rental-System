-- 015_password_reset_otp_flow.sql
-- Purpose: Add secure 6-digit OTP password reset flow support.

create table if not exists public.password_reset_otps (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  max_attempts smallint not null default 5,
  requested_ip inet,
  requested_user_agent text,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_otps_attempts_non_negative check (attempts >= 0),
  constraint password_reset_otps_max_attempts_positive check (max_attempts between 1 and 10)
);

create index if not exists idx_password_reset_otps_email_created
  on public.password_reset_otps (lower(email), created_at desc);

create index if not exists idx_password_reset_otps_user_created
  on public.password_reset_otps (user_id, created_at desc);

create index if not exists idx_password_reset_otps_expires_at
  on public.password_reset_otps (expires_at);

create unique index if not exists uq_password_reset_otps_active_user
  on public.password_reset_otps (user_id)
  where consumed_at is null;

alter table public.password_reset_otps enable row level security;

drop policy if exists "Service role can manage password reset OTPs" on public.password_reset_otps;
create policy "Service role can manage password reset OTPs"
on public.password_reset_otps
for all
to service_role
using (true)
with check (true);

revoke all on public.password_reset_otps from anon, authenticated;
grant select, insert, update, delete on public.password_reset_otps to service_role;
grant usage, select on sequence public.password_reset_otps_id_seq to service_role;

create or replace function public.password_reset_lookup_user(p_email text)
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id as user_id, lower(u.email)::text as email
  from auth.users u
  left join public.user_profiles up on up.id = u.id
  where lower(u.email) = lower(trim(coalesce(p_email, '')))
  limit 1;
$$;

revoke all on function public.password_reset_lookup_user(text) from public;
grant execute on function public.password_reset_lookup_user(text) to service_role;

notify pgrst, 'reload schema';
