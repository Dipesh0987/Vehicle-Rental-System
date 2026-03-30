# Admin Dashboard Module

This directory contains the enterprise-grade admin console for the Vehicle Rental System.

## Entry Point

- `login.html` - admin sign-in page (required before dashboard access).
- `index.html` - protected admin dashboard shell.

## JS Structure

- `assets/js/app.js` - bootstraps shell, routing, and module rendering.
- `assets/js/admin-auth.js` - admin session guard, role checks, and login helpers.
- `assets/js/login.js` - login page interactions and submit flow.
- `assets/js/shell.js` - sidebar/top navigation, quick actions, and toasts.
- `assets/js/data.js` - in-memory seed data for all admin domains.
- `assets/js/modules/` - feature modules (overview, vehicles, bookings, customers, drivers, payments, pricing, maintenance, reviews, admins, notifications, reports).
- `assets/js/ui.js` - reusable modal/drawer/empty-state utilities.
- `assets/js/table-utils.js` - sorting, filtering, and pagination helpers.
- `assets/js/charts.js` - Chart.js wrapper utilities.

## Design Notes

- Desktop-first responsive layout with mobile sidebar and adaptive cards.
- Light/dark mode support with persistent state.
- Consistent card system, spacing, interaction states, and feedback toasts.

## Vehicle Creation (Production)

- `assets/js/modules/vehicles.js` now uses real Supabase-backed data loading and creation state instead of demo-only drawer stubs.
- `assets/js/services/vehicle-admin.service.js` acts as the module service adapter.
- Shared runtime dependency: `../assets/js/vehicle-catalog.service.js` (loaded by `index.html`).

### Validation Rules

- All fields are mandatory: name, type, seats, price/day, fuel type, and images.
- Fuel type is constrained to `Petrol`, `Diesel`, or `Electric`.
- Image uploads are constrained to 1-5 files, with JPG/PNG/WebP mime types, maximum 5 MB per image.

### Data Flow

1. Admin submits form in vehicles module.
2. Validation runs client-side and again at DB level via constraints.
3. Vehicle row is inserted in `public.vehicles`.
4. Images upload to `storage.vehicle-images` and records are inserted into `public.vehicle_images`.
5. `primary_image_url` is updated and a catalog change event is broadcast.

### Required Backend Setup

- Run migrations in order:
	- `database/migrations/004_vehicle_catalog.sql`
	- `database/migrations/005_seed_dummy_vehicles.sql`
	- `database/migrations/006_seed_demo_vehicles_rpc.sql`
	- `database/migrations/007_admin_super_admin_bootstrap.sql`
	- `database/migrations/008_admin_login_repair.sql` (safe to re-run if admin login fails)
	- `database/migrations/009_vehicle_catalog_repair.sql` (one-shot repair for missing vehicle tables)

Default admin login after migration 007:

- Username: `admin`
- Password: `admin123`

Login resilience behavior:

- If legacy admin auth data is broken in Supabase (`unexpected_failure` / schema query error), signing in with `admin/admin123` now auto-bootstraps a clean auth account and continues.

If login returns `Invalid admin username or password`, run `database/migrations/008_admin_login_repair.sql` in Supabase SQL Editor and retry.
