-- 024_maintenance_table.sql
-- Purpose: Create maintenance_records table to persist vehicle maintenance
--          and damage records, replacing in-memory seed data.

create table if not exists public.maintenance_records (
  id              uuid primary key default gen_random_uuid(),
  maintenance_id  text unique not null,          -- human-readable e.g. M-301
  vehicle_name    text not null,                 -- free-text vehicle name / ref
  vehicle_id      text,                          -- optional link to vehicles table
  schedule_date   date not null,
  service_type    text not null default 'Damage' -- 'Damage' | 'Scheduled Service' | 'Inspection' | 'Repair'
    check (service_type in ('Damage', 'Scheduled Service', 'Inspection', 'Repair')),
  description     text not null,                 -- damage detail / service notes
  status          text not null default 'Scheduled'
    check (status in ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  cost_estimate   numeric(10,2),
  technician      text,
  notes           text,
  reported_by     text,
  completed_at    date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  created_by      uuid references auth.users(id)
);

-- Index for status filtering
create index if not exists idx_maintenance_status on public.maintenance_records(status);
create index if not exists idx_maintenance_schedule on public.maintenance_records(schedule_date);

-- RLS
alter table public.maintenance_records enable row level security;

create policy "Authenticated users can view maintenance records"
  on public.maintenance_records for select
  to authenticated using (true);

create policy "Authenticated users can insert maintenance records"
  on public.maintenance_records for insert
  to authenticated with check (true);

create policy "Authenticated users can update maintenance records"
  on public.maintenance_records for update
  to authenticated using (true) with check (true);

create policy "Authenticated users can delete maintenance records"
  on public.maintenance_records for delete
  to authenticated using (true);

-- Auto-update updated_at
create or replace function public.update_maintenance_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger maintenance_updated_at_trigger
  before update on public.maintenance_records
  for each row
  execute function public.update_maintenance_updated_at();

-- Seed sample records (run once; harmless if ids already exist)
insert into public.maintenance_records
  (maintenance_id, vehicle_name, vehicle_id, schedule_date, service_type, description, status, cost_estimate, technician)
values
  ('M-301', 'Honda City',    'V-112', '2026-03-31', 'Damage',            'Front bumper scratch',  'Scheduled',   2500,  'Ram Thapa'),
  ('M-302', 'BMW 5 Series',  null,    '2026-04-03', 'Repair',            'Brake replacement',     'In Progress', 8500,  'Sanjay K.'),
  ('M-303', 'Tesla Model 3', 'V-110', '2026-04-06', 'Scheduled Service', 'Tire rotation',         'Completed',   1200,  'Ram Thapa'),
  ('M-304', 'Toyota Fortuner','V-111','2026-05-10', 'Inspection',        'Annual safety check',   'Scheduled',   3000,  null)
on conflict (maintenance_id) do nothing;

notify pgrst, 'reload schema';
