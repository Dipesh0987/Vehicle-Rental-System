# Database Design (Supabase/Postgres)

This project is connected to Supabase with incremental schema rollout via versioned SQL migrations.

## Current Status

- User profile domain is live (`001`, `002`, `003` migrations)
- Vehicle catalog domain is live (`004_vehicle_catalog.sql`)
- Supabase Storage buckets are configured for profile and vehicle images

## Proposed Domains

- Identity and profiles
- Vehicle catalog
- Rental bookings
- Payments and invoices
- Fleet operations and availability

## Logical Entities

- user_profiles
  - Linked to auth.users
  - Stores display and contact fields
 - vehicles
  - Vehicle metadata, pricing, availability status, and primary image URL
 - vehicle_images
  - Ordered image records (up to 5 per vehicle) with public URL + storage path
- admin_users
  - Admin authorization source table for RLS-protected management operations
- bookings
  - Rental lifecycle states (pending, confirmed, active, completed, cancelled)
- booking_events
  - Audit trail for lifecycle transitions
- payments
  - Payment references and settlement status

## Relationship Plan

- auth.users 1:1 user_profiles
- user_profiles 1:N bookings
- vehicles 1:N bookings
- bookings 1:N booking_events
- bookings 1:N payments

## Design Rules

- UUID primary keys
- created_at and updated_at timestamps in every table
- Soft-delete optional for catalog entities
- RLS enabled by default
- Use explicit status enums/check constraints

## Indexing Strategy (Planned)

- bookings(user_id, created_at desc)
- bookings(vehicle_id, status)
- vehicles(brand, category)
- payments(booking_id, payment_status)

## Security Model

- Public read policy for active vehicle catalog and public vehicle images
- Admin-only insert/update/delete policies for vehicle records and image metadata
- Admin-only storage write access in `vehicle-images` bucket (folder-bound to auth user)
- Users can only read/update their own profile records in `user_profiles`

## Migration Strategy

- Versioned SQL files in database/migrations
- One migration per domain change
- Avoid destructive changes without backfill scripts

## Implemented Migrations

- `001_user_profiles.sql`
- `002_user_profiles_avatar.sql`
- `003_profile_images_storage.sql`
- `004_vehicle_catalog.sql`
