-- 023_drivers_table.sql
-- Purpose: Create a dedicated drivers table for driver management (CRUD).

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  driver_id text unique not null,              -- human-readable ID e.g. D-54
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  address text,
  licence_number text not null,
  licence_expiry date not null,
  licence_status text not null default 'Valid'
    check (licence_status in ('Valid', 'Expired', 'Suspended', 'Pending Verification')),
  vehicle_assigned text,                       -- references vehicle id or null
  current_booking text,                        -- references booking id or null
  availability text not null default 'Available'
    check (availability in ('Available', 'On Trip', 'Off Shift', 'On Leave')),
  experience_years integer default 0,
  photo_url text,
  notes text,
  onboarded_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Index for quick availability filtering
create index if not exists idx_drivers_availability on public.drivers(availability);

-- RLS policies
alter table public.drivers enable row level security;

-- Admin read access (authenticated users can read)
create policy "Authenticated users can view drivers"
  on public.drivers for select
  to authenticated
  using (true);

-- Admin write access (authenticated users can insert/update/delete)
create policy "Authenticated users can insert drivers"
  on public.drivers for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update drivers"
  on public.drivers for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete drivers"
  on public.drivers for delete
  to authenticated
  using (true);

-- Auto-update updated_at on modification
create or replace function public.update_drivers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger drivers_updated_at_trigger
  before update on public.drivers
  for each row
  execute function public.update_drivers_updated_at();

notify pgrst, 'reload schema';
