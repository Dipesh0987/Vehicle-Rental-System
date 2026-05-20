-- ─────────────────────────────────────────────────────────────────
-- 009_maintenance_records.sql
-- Creates the maintenance_records table used by the admin workshop
-- section (damage reports, scheduled services, inspections, repairs).
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.maintenance_records (
  id                 uuid primary key default gen_random_uuid(),
  maintenance_id     text not null,           -- human-readable ID, e.g. M-001
  vehicle_name       text not null,
  vehicle_id         uuid references public.vehicles(id) on delete set null,
  schedule_date      date,
  service_type       text not null default 'Damage'
                       check (service_type in ('Damage','Scheduled Service','Inspection','Repair')),
  description        text not null,
  status             text not null default 'Scheduled'
                       check (status in ('Scheduled','In Progress','Completed','Cancelled','Billed')),
  cost_estimate      numeric(12,2),
  technician         text,
  reported_by        text,
  completed_at       date,
  notes              text,
  customer_name      text,
  customer_email     text,
  customer_user_id   uuid references auth.users(id) on delete set null,
  linked_booking_id  uuid,
  booking_ref        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function public.set_maintenance_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_maintenance_updated_at on public.maintenance_records;
create trigger trg_maintenance_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_maintenance_updated_at();

-- Index for common lookups
create index if not exists idx_maintenance_vehicle_id   on public.maintenance_records(vehicle_id);
create index if not exists idx_maintenance_status        on public.maintenance_records(status);
create index if not exists idx_maintenance_service_type  on public.maintenance_records(service_type);
create index if not exists idx_maintenance_schedule_date on public.maintenance_records(schedule_date desc);

-- RLS: only authenticated users (admins) can access
alter table public.maintenance_records enable row level security;

drop policy if exists "admin_full_access_maintenance" on public.maintenance_records;
create policy "admin_full_access_maintenance"
  on public.maintenance_records
  for all
  to authenticated
  using (true)
  with check (true);

-- Allow realtime replication
alter publication supabase_realtime add table public.maintenance_records;
