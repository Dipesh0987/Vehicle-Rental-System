# Vehicle Rental System

Tailwind-based vehicle rental UI with a separated JS structure.

## Project Structure

- `frontend/index.html` - Main landing page UI
- `frontend/login.html` - Login page with forgot-password flow
- `frontend/registration.html` - Registration page aligned to the same premium theme
- `frontend/vehicles.html` - Professional dummy fleet listing page with multiple brands
- `frontend/vehicle-details.html` - Individual vehicle profile view (query-based static details)
- `frontend/assets/images/car.jpg` - Vehicle image asset
- `frontend/assets/images/car-transparent.png` - Transparent vehicle hero asset
- `frontend/assets/js/supabase.config.js` - Supabase connection config
- `frontend/assets/js/supabase.client.js` - Supabase JS client runtime loader
- `frontend/assets/js/auth.supabase.js` - Shared Supabase auth service (sign-up/sign-in/reset/logout)
- `frontend/assets/js/register.js` - Registration form logic with real Supabase sign-up
- `backend/js/auth.js` - Shared client-side auth/profile UI logic used by frontend pages
- `frontend/assets/js/vehicle-details.js` - Static vehicle data and UI rendering logic for detail page
- `database/migrations/001_user_profiles.sql` - SQL migration for persistent user profile data
- `database/migrations/002_user_profiles_avatar.sql` - SQL migration to add profile image support (`avatar_url`)
- `database/migrations/003_profile_images_storage.sql` - SQL migration for Supabase Storage bucket and RLS policies for profile images
- `database/migrations/004_vehicle_catalog.sql` - SQL migration for vehicle catalog tables, admin policies, and vehicle image storage

## Run

1. Open `frontend/index.html` in a browser (or Live Server).
2. Use navbar or **Browse Vehicles** to open `frontend/vehicles.html`.
3. Click **Show Details** on any card to open per-vehicle route like `frontend/vehicle-details.html?id=camry-hybrid`.
4. The pages load shared script from `backend/js/auth.js`.

## Supabase Auth Setup

1. Confirm `frontend/assets/js/supabase.config.js` has your live project URL and anon key.
2. In Supabase Dashboard -> Authentication -> Providers:
	- Enable Email provider.
	- Enable email confirmation (verification link).
	- Optionally enable Google provider for OAuth sign-in.
3. In Supabase Dashboard -> Authentication -> URL Configuration, include your frontend URLs (example local URLs):
	- `http://127.0.0.1:5500/frontend/login.html`
	- `http://127.0.0.1:5500/frontend/index.html`
	- `http://localhost:5500/frontend/login.html`
	- `http://localhost:5500/frontend/index.html`

## Database Migration

Run this SQL in Supabase SQL Editor:

1. `database/migrations/001_user_profiles.sql`
2. `database/migrations/002_user_profiles_avatar.sql`
3. `database/migrations/003_profile_images_storage.sql`
4. `database/migrations/004_vehicle_catalog.sql`
5. `database/migrations/005_seed_dummy_vehicles.sql`
6. `database/migrations/006_seed_demo_vehicles_rpc.sql`
7. `database/migrations/007_admin_super_admin_bootstrap.sql`
8. `database/migrations/008_admin_login_repair.sql` (safe re-run helper for admin login)
9. `database/migrations/009_vehicle_catalog_repair.sql` (one-shot repair if vehicle tables are missing)

This creates `public.user_profiles` with RLS policies and configures `storage.profile-images` bucket policies so authenticated users can upload/update only their own avatar path.

`004_vehicle_catalog.sql` additionally creates:

- `public.admin_users` (admin authorization source)
- `public.vehicles` (vehicle inventory with strict validation constraints)
- `public.vehicle_images` (up to 5 ordered images per vehicle)
- `storage.vehicle-images` bucket with RLS policies for admin uploads

`005_seed_dummy_vehicles.sql` seeds sample vehicles + image records so they appear in:

- Admin Dashboard -> Vehicle Management
- Public website vehicle search/listing and vehicle details page

## Admin Vehicle Creation Setup

After running migrations `004` to `007`:

1. Open `frontend/admin/login.html`.
2. Sign in with:
	- Username: `admin`
	- Password: `admin123`
3. You will be redirected to `frontend/admin/index.html`.

Admin login auto-bootstrap behavior:

- If the legacy `admin@vehicle-rental.local` auth row is corrupted or missing, the login flow now auto-provisions a clean bootstrap auth user (`admin.bootstrap@vehicle-rental.local`) when you sign in with `admin/admin123`.
- This avoids Supabase Auth `unexpected_failure` schema-query errors caused by legacy manual auth-row inserts.

`007_admin_super_admin_bootstrap.sql` creates/updates:

- Supabase Auth user: `admin@vehicle-rental.local`
- Auth identity for email login
- `public.admin_users` row with role `super_admin`
- Optional `public.user_profiles` row when profile table exists

If you prefer your own admin account, change credentials immediately after bootstrap.

If admin login shows `Invalid admin username or password`, run:

1. `database/migrations/008_admin_login_repair.sql`
2. Retry login with username `admin` and password `admin123`

## One-Click Demo Seed (Admin Panel)

After completing migrations:

1. Open `frontend/admin/index.html`.
2. Go to **Vehicle Management**.
3. Click **Seed Demo Vehicles**.

This action writes demo vehicles directly to Supabase (`public.vehicles` + `public.vehicle_images`) through RPC `public.seed_demo_vehicles()` and immediately appears in:

- Admin Vehicle Management table
- Public vehicle listing/search pages
- Public vehicle details page

If you do not have an admin login yet, this still works after running migration `006_seed_demo_vehicles_rpc.sql`.

If Supabase shows `relation "public.vehicles" does not exist`, run:

1. `database/migrations/004_vehicle_catalog.sql`
2. `database/migrations/005_seed_dummy_vehicles.sql`
3. `database/migrations/006_seed_demo_vehicles_rpc.sql`

Quick repair alternative (single script):

1. `database/migrations/009_vehicle_catalog_repair.sql`

Admin add-vehicle save checklist:

1. Sign in at `frontend/admin/login.html` (or use another account that exists in `public.admin_users` with `is_active = true`).
2. Fill all required fields in the Add Vehicle drawer.
3. Upload at least one valid image (JPG, PNG, or WebP; max 5 MB each).
4. Click **Add Vehicle**.

## Profile Image Best Practice

1. Upload image files to Supabase Storage bucket `profile-images`.
2. Store only the image URL in `public.user_profiles.avatar_url` (not base64 blobs in database).
3. Keep image size bounded (optimized on client before upload).

## Auth Flow

1. Guest clicks **Sign Up** from public pages -> opens `frontend/registration.html`.
2. Registration validates full name, email, and secure password (minimum 8 + special character).
3. Supabase sends email verification link.
4. User is redirected to `frontend/login.html` after successful registration.
5. Successful sign-in redirects to `frontend/index.html`.
6. Public users can still browse `frontend/index.html` without signing in.

## Password Security

1. Passwords are never stored in frontend localStorage/sessionStorage.
2. Passwords are not stored in `public.user_profiles`.
3. Password hashing is handled securely by Supabase Auth on the server side.
4. Client-side code only sends passwords over HTTPS to Supabase Auth endpoints.
