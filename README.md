# Vehicle Rental System

Tailwind-based vehicle rental UI with a separated JS structure.

## Project Structure

- `frontend/index.html` - Main landing page UI
- `frontend/login.html` - Login page with forgot-password flow
- `frontend/registration.html` - Registration page aligned to the same premium theme
- `frontend/vehicles.html` - Professional dummy fleet listing page with multiple brands
- `frontend/vehicle-details.html` - Individual vehicle profile view (query-based static details)
- `frontend/booking.html` - Customer booking flow with availability check, confirmation modal, and success feedback
- `frontend/assets/images/car.jpg` - Vehicle image asset
- `frontend/assets/images/car-transparent.png` - Transparent vehicle hero asset
- `frontend/assets/js/supabase.config.js` - Supabase connection config
- `frontend/assets/js/supabase.client.js` - Supabase JS client runtime loader
- `frontend/assets/js/auth.supabase.js` - Shared Supabase auth service (sign-up/sign-in/reset/logout)
- `frontend/assets/js/vehicle-catalog.service.js` - Shared vehicle catalog data service used by public/admin pages
- `frontend/assets/js/booking.service.js` - Shared booking data service (quote, validation, availability, persistence)
- `frontend/assets/js/booking-page.js` - Booking page controller with confirmation and success flows
- `frontend/assets/js/register.js` - Registration form logic with real Supabase sign-up
- `backend/js/auth.js` - Shared client-side auth/profile UI logic used by frontend pages
- `frontend/assets/js/vehicle-details.js` - Static vehicle data and UI rendering logic for detail page
- `database/migrations/001_user_profiles.sql` - SQL migration for persistent user profile data
- `database/migrations/002_user_profiles_avatar.sql` - SQL migration to add profile image support (`avatar_url`)
- `database/migrations/003_profile_images_storage.sql` - SQL migration for Supabase Storage bucket and RLS policies for profile images
- `database/migrations/004_vehicle_catalog_and_images.sql` - SQL migration for vehicle catalog tables, image table, and vehicle image storage policies
- `database/migrations/005_vehicle_catalog_schema_hotfix.sql` - SQL migration to backfill required vehicle columns/defaults for legacy projects
- `database/migrations/006_vehicle_bookings_system.sql` - SQL migration for secure booking persistence and overlap prevention

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
4. `database/migrations/004_vehicle_catalog_and_images.sql`
5. `database/migrations/005_vehicle_catalog_schema_hotfix.sql`
6. `database/migrations/006_vehicle_bookings_system.sql`

This creates `public.user_profiles`, `public.vehicles`, `public.vehicle_images`, and `public.vehicle_bookings`, plus storage policies for both `profile-images` and `vehicle-images` buckets.

For compatibility with the current frontend admin runtime, migration `004_vehicle_catalog_and_images.sql` uses permissive public write policies for vehicle catalog objects. Tighten these policies before production.

Migration `006_vehicle_bookings_system.sql` adds database-level overlap protection through an exclusion constraint so double-booking is blocked even under concurrent requests.

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
