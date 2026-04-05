-- 010_vehicle_number_support.sql
-- Purpose: Add unique vehicle numbers to the vehicle catalog.

alter table public.vehicles
  add column if not exists vehicle_number text;

-- Normalize existing values so uniqueness checks are stable.
update public.vehicles
set vehicle_number = null
where vehicle_number is not null
  and nullif(trim(vehicle_number), '') is null;

update public.vehicles
set vehicle_number = upper(trim(vehicle_number))
where vehicle_number is not null
  and vehicle_number <> upper(trim(vehicle_number));

alter table public.vehicles
  drop constraint if exists vehicles_vehicle_number_not_blank;

alter table public.vehicles
  add constraint vehicles_vehicle_number_not_blank
  check (vehicle_number is null or length(trim(vehicle_number)) > 0);

create unique index if not exists idx_vehicles_vehicle_number_unique
  on public.vehicles (lower(vehicle_number))
  where vehicle_number is not null;

notify pgrst, 'reload schema';
