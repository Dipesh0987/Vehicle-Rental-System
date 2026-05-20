-- ─────────────────────────────────────────────────────────────────
-- 010_maintenance_add_missing_columns.sql
-- Adds any columns that may be missing from a pre-existing
-- maintenance_records table.  Every statement is IF NOT EXISTS safe.
-- ─────────────────────────────────────────────────────────────────

alter table public.maintenance_records
  add column if not exists maintenance_id     text,
  add column if not exists vehicle_name       text,
  add column if not exists vehicle_id         uuid,
  add column if not exists schedule_date      date,
  add column if not exists service_type       text,
  add column if not exists description        text,
  add column if not exists status             text,
  add column if not exists cost_estimate      numeric(12,2),
  add column if not exists technician         text,
  add column if not exists reported_by        text,
  add column if not exists completed_at       date,
  add column if not exists notes              text,
  add column if not exists customer_name      text,
  add column if not exists customer_email     text,
  add column if not exists customer_user_id   uuid,
  add column if not exists linked_booking_id  uuid,
  add column if not exists booking_ref        text,
  add column if not exists created_at         timestamptz default now(),
  add column if not exists updated_at         timestamptz default now();

-- Notify PostgREST to reload the schema cache
notify pgrst, 'reload schema';
