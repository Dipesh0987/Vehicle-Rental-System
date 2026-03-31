-- 005_vehicle_catalog_schema_hotfix.sql
-- Purpose: Hotfix existing deployments where public.vehicles exists but misses required catalog columns.

alter table public.vehicles
  add column if not exists name text,
  add column if not exists brand text,
  add column if not exists type text,
  add column if not exists fuel_type text,
  add column if not exists seats integer,
  add column if not exists price_per_day numeric(10, 2),
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.vehicles
set
  name = coalesce(nullif(trim(name), ''), 'Vehicle'),
  brand = coalesce(nullif(trim(brand), ''), 'General'),
  type = coalesce(nullif(trim(type), ''), 'sedan'),
  fuel_type = coalesce(nullif(trim(fuel_type), ''), 'Petrol'),
  seats = coalesce(seats, 5),
  price_per_day = coalesce(price_per_day, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where name is null
   or brand is null
   or type is null
   or fuel_type is null
   or seats is null
   or price_per_day is null
   or created_at is null
   or updated_at is null;

alter table public.vehicles
  alter column name set default 'Vehicle',
  alter column brand set default 'General',
  alter column type set default 'sedan',
  alter column fuel_type set default 'Petrol',
  alter column seats set default 5,
  alter column price_per_day set default 0,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.vehicles
  alter column name set not null,
  alter column brand set not null,
  alter column type set not null,
  alter column fuel_type set not null,
  alter column seats set not null,
  alter column price_per_day set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

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

notify pgrst, 'reload schema';
