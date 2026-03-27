# Database Design (Supabase/Postgres)

This project is connected to Supabase and is prepared for incremental schema rollout.

## Current Goal

- Connection setup only
- No physical tables created yet
- Design-first planning for consistent future migrations

## Proposed Domains

- Identity and profiles
- Vehicle catalog
- Rental bookings
- Payments and invoices
- Fleet operations and availability

## Logical Entities (Draft)

- user_profiles
  - Linked to auth.users
  - Stores display and contact fields
- vehicles
  - Vehicle metadata and pricing strategy
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

## Security Model (Planned)

- Public read policy for active vehicle catalog
- Authenticated users can create bookings
- Users can only read/update their own bookings
- Admin role policies reserved for management actions

## Migration Strategy

- Versioned SQL files in database/migrations
- One migration per domain change
- Avoid destructive changes without backfill scripts
