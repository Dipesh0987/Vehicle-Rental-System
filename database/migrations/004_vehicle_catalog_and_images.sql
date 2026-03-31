-- 004_vehicle_catalog_and_images.sql
-- Purpose: Create and harden vehicle catalog persistence, image metadata, and storage policies.

create extension if not exists pgcrypto;

create table if not exists public.vehicles (
	id uuid primary key default gen_random_uuid(),
	name text not null default 'Vehicle',
	brand text not null default 'General',
	type text not null default 'sedan',
	category text not null default 'Sedan',
	transmission text not null default 'Automatic',
	fuel_type text not null default 'Petrol',
	seats integer not null default 5,
	price_per_day numeric(10, 2) not null default 0,
	rating numeric(3, 2) not null default 4.6,
	location text not null default '',
	status text not null default 'Available',
	available boolean not null default true,
	is_active boolean not null default true,
	features jsonb not null default '[]'::jsonb,
	image_url text not null default '',
	primary_image_url text not null default '',
	image_urls jsonb not null default '[]'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.vehicles
	add column if not exists name text,
	add column if not exists brand text,
	add column if not exists type text,
	add column if not exists category text,
	add column if not exists transmission text,
	add column if not exists fuel_type text,
	add column if not exists seats integer,
	add column if not exists price_per_day numeric(10, 2),
	add column if not exists rating numeric(3, 2),
	add column if not exists location text,
	add column if not exists status text,
	add column if not exists available boolean,
	add column if not exists is_active boolean,
	add column if not exists features jsonb,
	add column if not exists image_url text,
	add column if not exists primary_image_url text,
	add column if not exists image_urls jsonb,
	add column if not exists created_at timestamptz,
	add column if not exists updated_at timestamptz;

update public.vehicles
set
	name = coalesce(nullif(trim(name), ''), 'Vehicle'),
	brand = coalesce(nullif(trim(brand), ''), 'General'),
	type = coalesce(nullif(trim(type), ''), 'sedan'),
	category = coalesce(nullif(trim(category), ''), 'Sedan'),
	transmission = coalesce(nullif(trim(transmission), ''), 'Automatic'),
	fuel_type = coalesce(nullif(trim(fuel_type), ''), 'Petrol'),
	seats = coalesce(seats, 5),
	price_per_day = coalesce(price_per_day, 0),
	rating = coalesce(rating, 4.6),
	location = coalesce(location, ''),
	status = coalesce(nullif(trim(status), ''), 'Available'),
	available = coalesce(available, true),
	is_active = coalesce(is_active, true),
	image_url = coalesce(image_url, ''),
	primary_image_url = coalesce(primary_image_url, image_url, ''),
	created_at = coalesce(created_at, now()),
	updated_at = coalesce(updated_at, now());

alter table public.vehicles
	alter column name set default 'Vehicle',
	alter column brand set default 'General',
	alter column type set default 'sedan',
	alter column category set default 'Sedan',
	alter column transmission set default 'Automatic',
	alter column fuel_type set default 'Petrol',
	alter column seats set default 5,
	alter column price_per_day set default 0,
	alter column rating set default 4.6,
	alter column location set default '',
	alter column status set default 'Available',
	alter column available set default true,
	alter column is_active set default true,
	alter column image_url set default '',
	alter column primary_image_url set default '',
	alter column created_at set default now(),
	alter column updated_at set default now();

alter table public.vehicles
	alter column name set not null,
	alter column brand set not null,
	alter column type set not null,
	alter column category set not null,
	alter column transmission set not null,
	alter column fuel_type set not null,
	alter column seats set not null,
	alter column price_per_day set not null,
	alter column rating set not null,
	alter column location set not null,
	alter column status set not null,
	alter column available set not null,
	alter column is_active set not null,
	alter column image_url set not null,
	alter column primary_image_url set not null,
	alter column created_at set not null,
	alter column updated_at set not null;

create table if not exists public.vehicle_images (
	id uuid primary key default gen_random_uuid(),
	vehicle_id uuid not null references public.vehicles(id) on delete cascade,
	image_url text not null,
	storage_path text,
	sort_order integer not null default 0,
	is_primary boolean not null default false,
	created_at timestamptz not null default now()
);

alter table public.vehicle_images
	add column if not exists vehicle_id uuid,
	add column if not exists image_url text,
	add column if not exists storage_path text,
	add column if not exists sort_order integer,
	add column if not exists is_primary boolean,
	add column if not exists created_at timestamptz;

update public.vehicle_images
set
	image_url = coalesce(image_url, ''),
	sort_order = coalesce(sort_order, 0),
	is_primary = coalesce(is_primary, false),
	created_at = coalesce(created_at, now())
where image_url is null
	 or sort_order is null
	 or is_primary is null
	 or created_at is null;

alter table public.vehicle_images
	alter column sort_order set default 0,
	alter column is_primary set default false,
	alter column created_at set default now();

create index if not exists idx_vehicles_created_at on public.vehicles (created_at desc);
create index if not exists idx_vehicles_status on public.vehicles (status);
create index if not exists idx_vehicles_price_per_day on public.vehicles (price_per_day);
create index if not exists idx_vehicle_images_vehicle_id on public.vehicle_images (vehicle_id);
create unique index if not exists idx_vehicle_images_vehicle_sort on public.vehicle_images (vehicle_id, sort_order);

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

drop policy if exists "Public can read vehicles" on public.vehicles;
create policy "Public can read vehicles"
on public.vehicles
for select
using (true);

drop policy if exists "Public can manage vehicles" on public.vehicles;
create policy "Public can manage vehicles"
on public.vehicles
for all
using (true)
with check (true);

drop policy if exists "Public can read vehicle images table" on public.vehicle_images;
create policy "Public can read vehicle images table"
on public.vehicle_images
for select
using (true);

drop policy if exists "Public can manage vehicle images table" on public.vehicle_images;
create policy "Public can manage vehicle images table"
on public.vehicle_images
for all
using (true)
with check (true);

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

drop policy if exists "Public can upload vehicle images" on storage.objects;
create policy "Public can upload vehicle images"
on storage.objects
for insert
with check (bucket_id = 'vehicle-images');

drop policy if exists "Public can update vehicle images" on storage.objects;
create policy "Public can update vehicle images"
on storage.objects
for update
using (bucket_id = 'vehicle-images')
with check (bucket_id = 'vehicle-images');

drop policy if exists "Public can delete vehicle images" on storage.objects;
create policy "Public can delete vehicle images"
on storage.objects
for delete
using (bucket_id = 'vehicle-images');

notify pgrst, 'reload schema';
