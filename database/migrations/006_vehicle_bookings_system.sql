-- 006_vehicle_bookings_system.sql
-- Purpose: Production-ready booking persistence with overlap protection and RLS.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.vehicle_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  start_date date not null,
  end_date date not null,
  pickup_time time without time zone not null default '10:00',
  status text not null default 'confirmed',
  currency text not null default 'USD',
  base_amount numeric(10, 2) not null default 0 check (base_amount >= 0),
  service_fee numeric(10, 2) not null default 0 check (service_fee >= 0),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  coupon_code text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_bookings_status_check check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  constraint vehicle_bookings_date_check check (end_date >= start_date),
  constraint vehicle_bookings_email_check check (position('@' in customer_email) > 1)
);

create index if not exists idx_vehicle_bookings_vehicle_dates
  on public.vehicle_bookings (vehicle_id, start_date, end_date);

create index if not exists idx_vehicle_bookings_customer
  on public.vehicle_bookings (customer_user_id, created_at desc);

create index if not exists idx_vehicle_bookings_status
  on public.vehicle_bookings (status, created_at desc);

create or replace function public.set_updated_at_vehicle_bookings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_vehicle_booking_code()
returns trigger
language plpgsql
as $$
declare
  random_token text;
begin
  if coalesce(trim(new.booking_code), '') <> '' then
    return new;
  end if;

  random_token := upper(substr(md5(clock_timestamp()::text || random()::text), 1, 6));
  new.booking_code := 'BK-' || to_char(now(), 'YYYYMMDD') || '-' || random_token;
  return new;
end;
$$;

drop trigger if exists trg_vehicle_bookings_set_updated_at on public.vehicle_bookings;
create trigger trg_vehicle_bookings_set_updated_at
before update on public.vehicle_bookings
for each row
execute function public.set_updated_at_vehicle_bookings();

drop trigger if exists trg_vehicle_bookings_generate_code on public.vehicle_bookings;
create trigger trg_vehicle_bookings_generate_code
before insert on public.vehicle_bookings
for each row
execute function public.generate_vehicle_booking_code();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_bookings_no_overlap'
      and conrelid = 'public.vehicle_bookings'::regclass
  ) then
    alter table public.vehicle_bookings
      add constraint vehicle_bookings_no_overlap
      exclude using gist (
        vehicle_id with =,
        daterange(start_date, (end_date + 1), '[)') with &&
      )
      where (status in ('pending', 'confirmed'));
  end if;
end;
$$;

alter table public.vehicle_bookings enable row level security;

drop policy if exists "Public can read vehicle bookings" on public.vehicle_bookings;
create policy "Public can read vehicle bookings"
on public.vehicle_bookings
for select
using (true);

drop policy if exists "Public can create vehicle bookings" on public.vehicle_bookings;
create policy "Public can create vehicle bookings"
on public.vehicle_bookings
for insert
with check (status in ('pending', 'confirmed'));

notify pgrst, 'reload schema';
