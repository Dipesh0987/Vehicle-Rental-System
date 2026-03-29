-- Supabase/Postgres schema blueprint
-- Connection is active, but physical table creation is intentionally deferred.

-- ---------------------------------------------------------------------------
-- 1) Extensions (planned)
-- ---------------------------------------------------------------------------
-- create extension if not exists "pgcrypto";
-- create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 2) Domains (planned)
-- ---------------------------------------------------------------------------
-- create domain email_text as text check (position('@' in value) > 1);

-- ---------------------------------------------------------------------------
-- 3) Core table stubs (planned, not executed)
-- ---------------------------------------------------------------------------
-- create table user_profiles (...);
-- create table vehicles (...);
-- create table bookings (...);
-- create table booking_events (...);
-- create table payments (...);

-- ---------------------------------------------------------------------------
-- 4) Policy model (planned)
-- ---------------------------------------------------------------------------
-- alter table vehicles enable row level security;
-- create policy "Public can read vehicles" on vehicles for select using (true);

-- ---------------------------------------------------------------------------
-- 5) Migration notes
-- ---------------------------------------------------------------------------
-- Keep each real migration in: database/migrations/NNN_description.sql
-- Always include rollback guidance in comments for destructive changes.
