-- 029_maintenance_realtime_billed.sql
-- Purpose: 1) Widen the status CHECK to include 'Billed' so damage-billing
--             records don't violate the constraint.
--          2) Add maintenance_records to the Supabase Realtime publication
--             so the admin dashboard receives live INSERT/UPDATE/DELETE events.
--
-- Safe to re-run (all operations are idempotent).

------------------------------------------------------------------------------
-- 1. Widen status CHECK constraint to include 'Billed'
------------------------------------------------------------------------------
-- Drop the old constraint (ignoring if it doesn't exist)
do $$
begin
  alter table public.maintenance_records
    drop constraint if exists maintenance_records_status_check;
exception when undefined_object then null;
end $$;

alter table public.maintenance_records
  add constraint maintenance_records_status_check
    check (status in ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Billed'));

------------------------------------------------------------------------------
-- 2. Enable Supabase Realtime for maintenance_records
------------------------------------------------------------------------------
-- The default Supabase realtime publication is called "supabase_realtime".
-- Adding the table lets any admin dashboard channel receive row-level events.
do $$
begin
  alter publication supabase_realtime add table public.maintenance_records;
exception when duplicate_object then null;
end $$;

-- Ensure replica identity is FULL so UPDATE/DELETE events carry the old row.
alter table public.maintenance_records replica identity full;

------------------------------------------------------------------------------
-- 3. Composite index for the summary-card count queries
------------------------------------------------------------------------------
create index if not exists idx_maintenance_status_service_type
  on public.maintenance_records (status, service_type);

notify pgrst, 'reload schema';
