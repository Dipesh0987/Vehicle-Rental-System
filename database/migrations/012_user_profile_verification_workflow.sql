-- 012_user_profile_verification_workflow.sql
-- Purpose: Add a professional KYC verification workflow to user profiles
-- with secure status transitions and admin approval controls.

alter table if exists public.user_profiles
  add column if not exists phone_number text,
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists postal_code text,
  add column if not exists document_type text,
  add column if not exists document_number text,
  add column if not exists document_expiry_date date,
  add column if not exists verification_status text,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists verification_note text;

update public.user_profiles
set verification_status = 'not_submitted'
where verification_status is null;

update public.user_profiles
set country = coalesce(nullif(trim(country), ''), 'Nepal')
where country is null or trim(country) = '';

alter table public.user_profiles
  alter column country set default 'Nepal',
  alter column verification_status set default 'not_submitted',
  alter column verification_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_gender_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_gender_check
      check (
        gender is null
        or lower(gender) in ('male', 'female', 'other', 'prefer_not_to_say')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_document_type_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_document_type_check
      check (
        document_type is null
        or lower(document_type) in ('driving_license', 'national_id', 'passport', 'other')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_verification_status_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_verification_status_check
      check (
        lower(verification_status) in ('not_submitted', 'pending', 'approved', 'rejected')
      );
  end if;
end;
$$;

create index if not exists idx_user_profiles_verification_status
  on public.user_profiles (verification_status, updated_at desc);

create index if not exists idx_user_profiles_verification_submitted_at
  on public.user_profiles (verification_submitted_at desc);

create or replace function public.guard_user_profile_verification_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  requester uuid;
  requester_is_admin boolean := false;
  old_status text := 'not_submitted';
  new_status text := lower(coalesce(trim(new.verification_status), 'not_submitted'));
begin
  requester := auth.uid();

  if requester is not null then
    requester_is_admin := public.is_admin_user(requester);
  end if;

  if tg_op = 'UPDATE' then
    old_status := lower(coalesce(trim(old.verification_status), 'not_submitted'));
  end if;

  if new_status not in ('not_submitted', 'pending', 'approved', 'rejected') then
    new_status := 'not_submitted';
  end if;

  new.verification_status := new_status;

  if not requester_is_admin then
    if tg_op = 'INSERT' then
      if new_status in ('approved', 'rejected') then
        raise exception 'Only admins can set verification status to approved or rejected.';
      end if;

      new.verification_reviewed_at := null;
      new.verification_reviewed_by := null;
      new.verification_note := null;
    else
      if new_status in ('approved', 'rejected') and new_status <> old_status then
        raise exception 'Only admins can change verification status to approved or rejected.';
      end if;

      if new_status = 'pending' and old_status <> 'pending' then
        new.verification_reviewed_at := null;
        new.verification_reviewed_by := null;
        new.verification_note := null;
      else
        new.verification_reviewed_at := old.verification_reviewed_at;
        new.verification_reviewed_by := old.verification_reviewed_by;
        new.verification_note := old.verification_note;
      end if;
    end if;
  end if;

  if new.verification_status = 'pending' then
    if tg_op = 'INSERT' or old_status <> 'pending' or new.verification_submitted_at is null then
      new.verification_submitted_at := now();
    end if;
  elsif new.verification_status = 'not_submitted' then
    new.verification_submitted_at := null;
  elsif new.verification_submitted_at is null then
    new.verification_submitted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_user_profile_verification_write on public.user_profiles;
create trigger trg_guard_user_profile_verification_write
before insert or update on public.user_profiles
for each row
execute function public.guard_user_profile_verification_write();

alter table public.user_profiles enable row level security;

drop policy if exists "Admins can read all user profiles" on public.user_profiles;
create policy "Admins can read all user profiles"
on public.user_profiles
for select
using (public.is_admin_user(auth.uid()));

create or replace function public.admin_update_user_verification_status(
  p_user_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
  reviewer_id uuid;
  updated_row public.user_profiles;
begin
  reviewer_id := auth.uid();

  if not public.is_admin_user(reviewer_id) then
    raise exception 'Only admin users can update verification status.';
  end if;

  normalized_status := lower(trim(coalesce(p_status, '')));

  if normalized_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid verification status: %', p_status;
  end if;

  update public.user_profiles
  set verification_status = normalized_status,
      verification_reviewed_at = case when normalized_status = 'pending' then null else now() end,
      verification_reviewed_by = case when normalized_status = 'pending' then null else reviewer_id end,
      verification_note = case
        when normalized_status = 'pending' then null
        else nullif(trim(coalesce(p_review_note, '')), '')
      end,
      verification_submitted_at = case
        when normalized_status = 'pending' and verification_submitted_at is null then now()
        else verification_submitted_at
      end,
      updated_at = now()
  where id = p_user_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'User profile not found for id: %', p_user_id;
  end if;

  return updated_row;
end;
$$;

grant execute on function public.admin_update_user_verification_status(uuid, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
