-- 004_vehicle_catalog.sql
-- Purpose: Production-ready vehicle catalog schema + storage policies for admin vehicle creation.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can view own admin record" on public.admin_users;
create policy "Admins can view own admin record"
on public.admin_users
for select
using (auth.uid() = user_id);

create or replace function public.is_admin_user(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users admin
    where admin.user_id = check_user
      and admin.is_active = true
  );
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to anon, authenticated, service_role;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  type text not null check (char_length(trim(type)) between 2 and 50),
  seats smallint not null check (seats between 1 and 15),
  price_per_day numeric(10,2) not null check (price_per_day > 0 and price_per_day <= 100000),
  fuel_type text not null check (fuel_type in ('Petrol', 'Diesel', 'Electric')),
  status text not null default 'available' check (status in ('available', 'maintenance', 'inactive')),
  primary_image_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  image_url text not null,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (vehicle_id, sort_order)
);

create index if not exists idx_vehicles_status_created_at on public.vehicles (status, created_at desc);
create index if not exists idx_vehicles_type_fuel_seats on public.vehicles (type, fuel_type, seats);
create index if not exists idx_vehicle_images_vehicle_order on public.vehicle_images (vehicle_id, sort_order);

create or replace function public.set_updated_at_vehicles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_vehicles on public.vehicles;
create trigger trg_set_updated_at_vehicles
before update on public.vehicles
for each row
execute function public.set_updated_at_vehicles();

alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;

grant select on public.vehicles to anon, authenticated;
grant select on public.vehicle_images to anon, authenticated;
grant insert, update, delete on public.vehicles to authenticated;
grant insert, update, delete on public.vehicle_images to authenticated;

drop policy if exists "Public can read available vehicles" on public.vehicles;
create policy "Public can read available vehicles"
on public.vehicles
for select
using (status = 'available');

drop policy if exists "Admins can read all vehicles" on public.vehicles;
create policy "Admins can read all vehicles"
on public.vehicles
for select
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert vehicles" on public.vehicles;
create policy "Admins can insert vehicles"
on public.vehicles
for insert
to authenticated
with check (
  public.is_admin_user(auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "Admins can update vehicles" on public.vehicles;
create policy "Admins can update vehicles"
on public.vehicles
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete vehicles" on public.vehicles;
create policy "Admins can delete vehicles"
on public.vehicles
for delete
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "Public can read images for available vehicles" on public.vehicle_images;
create policy "Public can read images for available vehicles"
on public.vehicle_images
for select
using (
  exists (
    select 1
    from public.vehicles vehicle
    where vehicle.id = vehicle_images.vehicle_id
      and vehicle.status = 'available'
  )
);

drop policy if exists "Admins can read all vehicle images" on public.vehicle_images;
create policy "Admins can read all vehicle images"
on public.vehicle_images
for select
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert vehicle images" on public.vehicle_images;
create policy "Admins can insert vehicle images"
on public.vehicle_images
for insert
to authenticated
with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update vehicle images" on public.vehicle_images;
create policy "Admins can update vehicle images"
on public.vehicle_images
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete vehicle images" on public.vehicle_images;
create policy "Admins can delete vehicle images"
on public.vehicle_images
for delete
to authenticated
using (public.is_admin_user(auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view vehicle images" on storage.objects;
create policy "Public can view vehicle images"
on storage.objects
for select
using (bucket_id = 'vehicle-images');

drop policy if exists "Admins can upload vehicle images" on storage.objects;
create policy "Admins can upload vehicle images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-images'
  and public.is_admin_user(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can update vehicle images in storage" on storage.objects;
create policy "Admins can update vehicle images in storage"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-images'
  and public.is_admin_user(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-images'
  and public.is_admin_user(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can delete vehicle images in storage" on storage.objects;
create policy "Admins can delete vehicle images in storage"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-images'
  and public.is_admin_user(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Bootstrap at least one admin before using admin vehicle creation:
-- insert into public.admin_users (user_id, role)
-- values ('YOUR_AUTH_USER_UUID', 'super_admin')
-- on conflict (user_id) do nothing;
