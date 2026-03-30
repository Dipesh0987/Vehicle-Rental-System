-- Supabase/Postgres schema blueprint
-- Source-of-truth implementation lives in database/migrations/*.sql.

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
-- 3) Current implemented domains
-- ---------------------------------------------------------------------------
-- Implemented in migrations:
-- - 001_user_profiles.sql
-- - 002_user_profiles_avatar.sql
-- - 003_profile_images_storage.sql
-- - 004_vehicle_catalog.sql

-- ---------------------------------------------------------------------------
-- 4) Policy model
-- ---------------------------------------------------------------------------
-- Public read: available vehicles + vehicle images.
-- Admin write: vehicles + vehicle_images + vehicle-images storage bucket.

-- ---------------------------------------------------------------------------
-- 5) Migration notes
-- ---------------------------------------------------------------------------
-- Keep each real migration in: database/migrations/NNN_description.sql
-- Always include rollback guidance in comments for destructive changes.
